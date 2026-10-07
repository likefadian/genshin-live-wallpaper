import * as THREE from 'three';
import type {SceneAtmosphere,ParticleKind,TimeWeights} from '../content/atmosphere';
import type {Pair} from '../content/package-contract';
import type {SceneLight} from '../content/scene-environment';
import {fireflyPopulation,particlePopulation} from './atmosphere-state';

const kinds:ParticleKind[]=['mist','ray','dust','butterfly','kite','firefly','star','ember'];
const particleVertex=`
precision highp float;
attribute vec4 aRect,aInfo,aColor;
attribute vec3 aRandom;
attribute vec2 aStretch;
attribute float aLamp;
uniform float uSeconds,uWind,uFireflies;
uniform vec4 uWeights,uLamps[8];
varying vec2 vLocal,vWorld;
varying vec4 vColor;
varying float vKind,vOpacity,vPhase;
float hash(float n){return fract(sin(n*91.713)*43758.5453);}
float noise(float n){float i=floor(n),f=fract(n);return mix(hash(i),hash(i+1.),f*f*(3.-2.*f))*2.-1.;}
void main(){
 float kind=aInfo.x,seed=aRandom.x*90.,t=uSeconds,speed=aRandom.z;
 vec2 center=aRect.xy+aRect.zw*vec2(aRandom.x,aRandom.y),size=vec2(aInfo.w)*aStretch;
 float opacity=0.,angle=0.;
 if(kind<.5){
  center.x=aRect.x+fract(aRandom.x+t*speed/max(aRect.z,1.))*aRect.z;
  center.y+=sin(t*.08+seed)*16.;opacity=uWeights.x;
 }else if(kind<1.5){
  center+=vec2(sin(t*.07+seed)*15.,size.y*.34);angle=-.28-.12*sin(seed);
  opacity=uWeights.x*(.7+.3*sin(t*.11+seed));
 }else if(kind<2.5){
  center.x=aRect.x+fract(aRandom.x+t*speed/max(aRect.z,1.))*aRect.z;
  center.y=aRect.y+fract(aRandom.y-t*speed*.18/max(aRect.w,1.))*aRect.w;
  center+=vec2(uWind*9.+sin(t*.5+seed)*4.,sin(t*.3+seed)*8.);
  opacity=max(uWeights.x*.75,uWeights.z)*(1.-pow(abs(fract(aRandom.x+t*speed/max(aRect.z,1.))*2.-1.),8.));
 }else if(kind<3.5){
  center+=vec2(sin(t*.19+seed)*aRect.z*.2+noise(t*.14+seed)*32.,sin(t*.31+seed)*aRect.w*.18);
  center.x+=uWind*6.;angle=.14*sin(t*.6+seed);
  opacity=uWeights.y*smoothstep(.2,.6,.5+.5*sin(t*.18+seed));
 }else if(kind<4.5){
  center+=vec2(sin(t*.045+seed)*45.+uWind*3.,sin(t*.065+seed)*12.);angle=.08*sin(t*.2+seed);
  opacity=uWeights.y;
 }else if(kind<5.5){
  center+=vec2(sin(t*.23+seed)*aRect.z*.12+noise(t*.33+seed)*30.,sin(t*.35+seed)*aRect.w*.17+noise(t*.29+seed+10.)*22.);
  center.x+=uWind*12.;opacity=clamp(uFireflies-aInfo.y,0.,1.);
  opacity*=.58+.42*(.5+.5*sin(t*1.2+seed+noise(t*.27+seed)));
 }else if(kind<6.5){
  opacity=uWeights.w*(.28+.72*pow(.5+.5*sin(t*(.45+aRandom.y)+seed),2.));
 }else{
  vec4 lamp=vec4(0.);for(int i=0;i<8;i++){if(float(i)==aLamp)lamp=uLamps[i];}
  float life=fract(t*(.12+speed*.005)+aRandom.y);
  center=lamp.xy+vec2(sin(seed+life*7.)*(8.+life*12.)+uWind*life*8.,-life*(25.+aInfo.w*12.));
  opacity=max(uWeights.z*.5,uWeights.w)*sin(life*3.14159)*lamp.z;
 }
 // Canvas +y points down. Flip local y as well to retain front-facing winding.
 vec2 local=vec2(position.x,-position.y)*2.,offset=local*size*.5;
 offset=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*offset;
 vec2 world=center+offset;
 vLocal=local;vWorld=world;vColor=aColor;vKind=kind;vOpacity=opacity;vPhase=t*(15.+aRandom.y*7.)+seed;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(world.x,-world.y,0.,1.);
}`;
const particleFragment=`
precision highp float;
uniform sampler2D uSceneData,uCharacter;
uniform vec2 uCanvas,uCharacterOrigin,uCharacterSize;
uniform float uAvoidCharacter;
varying vec2 vLocal,vWorld;
varying vec4 vColor;
varying float vKind,vOpacity,vPhase;
float ellipse(vec2 p,vec2 c,vec2 r){return 1.-smoothstep(.7,1.,length((p-c)/r));}
void main(){
 vec2 p=vLocal;float r=dot(p,p),shape=0.;vec3 color=vColor.rgb;
 if(vKind<.5){shape=exp(-r*4.)*.8;}
 else if(vKind<1.5){shape=exp(-p.x*p.x*5.)*pow(1.-abs(p.y),1.8);}
 else if(vKind<2.5){shape=exp(-r*5.);}
 else if(vKind<3.5){
  float flap=.3+.7*abs(sin(vPhase));p.x/=flap;
  float upper=max(ellipse(p,vec2(-.48,.16),vec2(.42,.56)),ellipse(p,vec2(.48,.16),vec2(.42,.56)));
  float lower=max(ellipse(p,vec2(-.36,-.42),vec2(.32,.35)),ellipse(p,vec2(.36,-.42),vec2(.32,.35)));
  float body=ellipse(p,vec2(0.,-.05),vec2(.055,.56));shape=max(max(upper,lower),body);
  color*=.52+.48*smoothstep(.1,.65,abs(p.x));color=mix(color,vec3(.23,.17,.09),body);
  color=mix(color,color*.48,step(.61,abs(p.x)+p.y*.2));
 }else if(vKind<4.5){
  vec2 q=vec2(p.x,p.y-.52);float diamond=1.-smoothstep(.4,.52,abs(q.x)+abs(q.y)*.75);
  float tail=(1.-smoothstep(.025,.08,abs(p.x-.1*sin(p.y*12.+vPhase*.12))))*step(p.y,.25)*step(-.98,p.y);
  shape=max(diamond,tail*.7);color*=.65+.35*step(q.x,0.);
 }else if(vKind<5.5){
  float core=exp(-r*45.);shape=clamp(core*1.25+exp(-r*6.)*.28,0.,1.);
  color=mix(color,vec3(1.,1.,.5),core);
 }else if(vKind<6.5){
  float cross=exp(-abs(p.x)*20.-abs(p.y)*3.)+exp(-abs(p.y)*20.-abs(p.x)*3.);
  shape=max(exp(-r*28.),cross*.22);
 }else{shape=exp(-r*8.);}
 vec2 sceneUv=vec2(vWorld.x/uCanvas.x,1.-vWorld.y/uCanvas.y);
 if(vKind>5.5&&vKind<6.5)shape*=texture2D(uSceneData,clamp(sceneUv,0.,1.)).r;
 float alpha=shape*vOpacity*vColor.a;
 if(uAvoidCharacter>.5){
  // The albedo tile shares the exact frame and alpha used by the moving character.
  vec2 characterUv=(vWorld-uCharacterOrigin)/uCharacterSize;
  if(characterUv.x>=0.&&characterUv.y>=0.&&characterUv.x<=1.&&characterUv.y<=1.){
   float coverage=texture2D(uCharacter,vec2(characterUv.x*.5,1.-characterUv.y*.5)).a;
   alpha*=1.-smoothstep(.02,.95,coverage);
  }
 }
 if(alpha<.002)discard;
 gl_FragColor=vec4(color,alpha);
}`;

/** Two static instance batches; trajectories and sprite shapes stay on the GPU. */
export class EnvironmentParticles {
 private meshes:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>[]=[];
 private lamps=Array.from({length:8},()=>new THREE.Vector4());
 private config:SceneAtmosphere;
 private populations:Record<string,number>={};
 private uniforms:Record<string,THREE.IUniform>;
 constructor(scene:THREE.Scene,config:SceneAtmosphere,canvas:Pair,lamps:SceneLight[],sceneOrder:number,characterOrder:number){
  this.config=config;
  this.uniforms={uSeconds:{value:0},uWind:{value:0},uFireflies:{value:0},uWeights:{value:new THREE.Vector4()},uCanvas:{value:new THREE.Vector2(...canvas)},uSceneData:{value:null},uLamps:{value:this.lamps},uCharacter:{value:null},uCharacterOrigin:{value:new THREE.Vector2()},uCharacterSize:{value:new THREE.Vector2(1,1)}};
  let seed=config.seed>>>0,fireflyIndex=0;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
  const lampIndices=lamps.map((lamp,i)=>lamp.floating?i:-1).filter(i=>i>=0);
  for(const layer of ['behind','front'] as const){
   const rects:number[]=[],infos:number[]=[],colors:number[]=[],randoms:number[]=[],stretches:number[]=[],anchors:number[]=[];
   for(const emitter of config.emitters.filter(e=>e.layer===layer))for(let i=0;i<emitter.count;i++){
    const kind=kinds.indexOf(emitter.kind),sx=random(),sy=random();
    rects.push(...emitter.rect);infos.push(kind,emitter.kind==='firefly'?fireflyIndex++:i,emitter.count,emitter.size[0]+random()*(emitter.size[1]-emitter.size[0]));
    colors.push(...emitter.color,emitter.opacity);randoms.push(sx,sy,emitter.speed);stretches.push(...emitter.stretch);
    anchors.push(lampIndices.length?lampIndices[i%lampIndices.length]:-1);
   }
   if(!infos.length)continue;
   const base=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=base.index;
   geometry.setAttribute('position',base.getAttribute('position'));geometry.setAttribute('uv',base.getAttribute('uv'));
   for(const [name,data,size] of [['aRect',rects,4],['aInfo',infos,4],['aColor',colors,4],['aRandom',randoms,3],['aStretch',stretches,2],['aLamp',anchors,1]] as const)geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(data),size));
   geometry.instanceCount=infos.length/4;base.dispose();
   const material=new THREE.ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,uniforms:{...this.uniforms,uAvoidCharacter:{value:layer==='front'?1:0}},transparent:true,depthTest:false,depthWrite:false});
   const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=layer==='behind'?(sceneOrder+characterOrder)/2:characterOrder+.5;
   scene.add(mesh);this.meshes.push(mesh);
  }
 }
 setMask(texture:THREE.Texture){this.uniforms.uSceneData.value=texture}
 setCharacter(texture:THREE.Texture,origin:Pair,size:Pair){this.uniforms.uCharacter.value=texture;this.uniforms.uCharacterOrigin.value.set(...origin);this.uniforms.uCharacterSize.value.set(...size)}
 update(seconds:number,weights:TimeWeights,wind:number,lamps:SceneLight[],visible:boolean){
  const u=this.uniforms;u.uSeconds.value=seconds;u.uWeights.value.set(...weights);u.uWind.value=wind;u.uFireflies.value=fireflyPopulation(this.config,weights);
  for(let i=0;i<8;i++){const l=lamps[i];this.lamps[i].set(l?.position[0]??0,l?.position[1]??0,l?1:0,0)}
  this.meshes.forEach(mesh=>mesh.visible=visible);this.populations=visible?particlePopulation(this.config,weights):{};
 }
 snapshot(){return {enabled:this.meshes.some(m=>m.visible),instances:this.meshes.reduce((n,m)=>n+m.geometry.instanceCount,0),batches:this.meshes.filter(m=>m.visible).length,population:this.populations}}
 destroy(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose()}this.meshes=[]}
}
