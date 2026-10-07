export type PatchTile=readonly [number,number,number,number,number,number]; // destination x/y, width/height, packed x/y; PNG top-left coordinates
export interface FramePatches {packedSize:readonly [number,number];atlasSize:readonly [number,number];tiles:readonly PatchTile[];hashes:readonly string[]}
interface Identity {fps:number;frameCount:number;atlasSize:readonly number[];requiredChannels:readonly string[]}
export function validateFramePatches(manifest:unknown,spec:Identity,sourceHashes:readonly string[]):FramePatches{
 if(!manifest||typeof manifest!=='object')throw Error('frame patches manifest invalid');const data=manifest as Record<string,any>;
 if(data.schemaVersion!==1||data.encoding!=='rgba8-independent-tiles')throw Error('frame patches encoding unsupported');
 if(data.baseFrame!==0)throw Error('frame patches base frame must be zero');
 for(const key of ['fps','frameCount'] as const)if(data[key]!==spec[key])throw Error('frame patches '+key+' mismatch');
 for(const key of ['atlasSize','requiredChannels'] as const)if(!Array.isArray(data[key])||data[key].length!==spec[key].length||data[key].some((v:unknown,i:number)=>v!==spec[key][i]))throw Error('frame patches '+key+' mismatch');
 if(!Array.isArray(data.packedSize)||data.packedSize.length!==2||data.packedSize.some((v:unknown)=>!Number.isSafeInteger(v)||Number(v)<=0)||data.packedSize[0]*data.packedSize[1]>=spec.atlasSize[0]*spec.atlasSize[1])throw Error('frame patches packed dimensions invalid');
 if(!Array.isArray(data.tiles)||!data.tiles.length||data.tiles.length>8192)throw Error('frame patches tiles invalid');
 const tiles:PatchTile[]=data.tiles.map((tile:unknown)=>{
  if(!Array.isArray(tile)||tile.length!==6||tile.some(v=>!Number.isSafeInteger(v)||v<0)||tile[2]===0||tile[3]===0)throw Error('frame patches tile invalid');
  const [x,y,w,h,sx,sy]=tile;
  if(x+w>spec.atlasSize[0]||y+h>spec.atlasSize[1])throw Error('frame patches destination out of bounds');
  if(sx+w>data.packedSize[0]||sy+h>data.packedSize[1])throw Error('frame patches packed source out of bounds');
  return [...tile] as unknown as PatchTile;
 });
 for(let i=0;i<tiles.length;i++)for(let j=0;j<i;j++)for(const offset of [0,4]){
  const a=tiles[i],b=tiles[j];if(a[offset]<b[offset]+b[2]&&b[offset]<a[offset]+a[2]&&a[offset+1]<b[offset+1]+b[3]&&b[offset+1]<a[offset+1]+a[3])throw Error('frame patches tile overlap');
 }
 if(!Array.isArray(data.frames)||data.frames.length!==spec.frameCount||sourceHashes.length!==spec.frameCount)throw Error('frame patches frame records incomplete');
 const hashes=data.frames.map((frame:any,index:number)=>{
  if(frame.frame!==index||frame.sourceSha256!==sourceHashes[index])throw Error('frame patches source sequence mismatch at '+index);
  if(typeof frame.sha256!=='string'||!/^[a-f0-9]{64}$/.test(frame.sha256))throw Error('frame patches sha256 invalid');
  return frame.sha256 as string;
 });
 return {packedSize:[...data.packedSize] as [number,number],atlasSize:[...spec.atlasSize] as [number,number],tiles,hashes};
}
export function patchVertexData(plan:FramePatches){
 const positions:number[]=[],uvs:number[]=[],H=plan.atlasSize[1],[PW,PH]=plan.packedSize;
 for(const [x,y,w,h,sx,sy] of plan.tiles){
  const corners=[[x,H-y,sx/PW,1-sy/PH],[x,H-y-h,sx/PW,1-(sy+h)/PH],[x+w,H-y,(sx+w)/PW,1-sy/PH],[x+w,H-y-h,(sx+w)/PW,1-(sy+h)/PH]];
  for(const index of [0,1,2,1,3,2]){const p=corners[index];positions.push(p[0],p[1],0);uvs.push(p[2],p[3]);}
 }
 return {positions:new Float32Array(positions),uvs:new Float32Array(uvs)};
}
