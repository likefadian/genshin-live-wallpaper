export type Normal=readonly [number,number,number];
export type Jacobian=readonly [number,number,number,number];
function normalize(vector:readonly number[]):Normal {
  if(vector.length!==3||!vector.every(Number.isFinite))throw new Error('normal must have three finite components');
  const length=Math.hypot(...vector);
  if(length<1e-12)throw new Error('zero normal has no direction');
  return [vector[0]/length,vector[1]/length,vector[2]/length];
}
/** Linear data: signed components use center 128 and positive scale 127. */
export function decodeNormalBytes(bytes:readonly number[]):Normal {
  if(bytes.length!==3||bytes.some(v=>!Number.isInteger(v)||v<1||v>255))throw new Error('normal bytes must be in 1..255');
  return normalize(bytes.map(v=>(v-128)/127));
}
/** Image axes x right, y down, z toward viewer. UV supplies the inverse deformation.
 * Normals transform by the inverse transpose, not by sampling the original RGB alone.
 */
export function transformNormalFromInverseJacobian(normal:readonly number[],inverse:readonly number[]):Normal {
  if(inverse.length!==4||!inverse.every(Number.isFinite))throw new Error('Jacobian must contain four finite values');
  if(Math.abs(inverse[0]*inverse[3]-inverse[1]*inverse[2])<1e-10)throw new Error('singular deformation has no inverse direction');
  const n=normalize(normal);
  return normalize([inverse[0]*n[0]+inverse[2]*n[1],inverse[1]*n[0]+inverse[3]*n[1],n[2]]);
}
export function inverseJacobianFromUv(uv:Float32Array,width:number,height:number,x:number,y:number):Jacobian {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||uv.length!==width*height*2)throw new Error('UV dimensions do not match the field');
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)throw new Error('UV sample outside field');
  const x0=Math.max(0,x-1),x1=Math.min(width-1,x+1),y0=Math.max(0,y-1),y1=Math.min(height-1,y+1);
  const at=(sx:number,sy:number,c:number)=>uv[(sy*width+sx)*2+c];
  const k:Jacobian=[
    (at(x1,y,0)-at(x0,y,0))*(width-1)/(x1-x0),
    (at(x,y1,0)-at(x,y0,0))*(width-1)/(y1-y0),
    (at(x1,y,1)-at(x0,y,1))*(height-1)/(x1-x0),
    (at(x,y1,1)-at(x,y0,1))*(height-1)/(y1-y0),
  ];
  if(!k.every(Number.isFinite))throw new Error('UV field has nonfinite derivatives');
  return k;
}
