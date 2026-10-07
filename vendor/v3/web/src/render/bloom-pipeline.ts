import * as THREE from 'three';
import type {SceneAtmosphere,TimeWeights} from '../content/atmosphere';
import type {Pair} from '../content/package-contract';
import {weighted,weightedColor} from './atmosphere-state';

const screenVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const colorFunctions=`
vec3 decodeSrgb(vec3 c){c=max(c,vec3(0.));return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 encodeSrgb(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
`;
const extractFragment=`
precision highp float;varying vec2 vUv;
uniform sampler2D uSource,uCharacter;
uniform vec2 uSourceTexel,uCharacterOrigin,uCharacterSize;
uniform vec4 uViewport;
uniform float uThreshold,uKnee,uCharacterGain;
${colorFunctions}
void main(){
 vec2 d=uSourceTexel*.5;
 vec3 color=(decodeSrgb(texture2D(uSource,vUv+d).rgb)+decodeSrgb(texture2D(uSource,vUv-d).rgb)+decodeSrgb(texture2D(uSource,vUv+vec2(d.x,-d.y)).rgb)+decodeSrgb(texture2D(uSource,vUv+vec2(-d.x,d.y)).rgb))*.25;
 float brightness=dot(color,vec3(.2126,.7152,.0722));
 float knee=clamp(brightness-uThreshold+uKnee,0.,2.*uKnee);
 float contribution=max(brightness-uThreshold,knee*knee/(4.*uKnee+.00001))/max(brightness,.00001);
 // Suppress bloom from ordinary skin, white fabric and dark hair; emitters stay luminous.
 vec2 world=uViewport.xy+vec2(vUv.x,1.-vUv.y)*uViewport.zw;
 vec2 p=(world-uCharacterOrigin)/uCharacterSize;float coverage=0.;
 if(p.x>=0.&&p.y>=0.&&p.x<=1.&&p.y<=1.)coverage=texture2D(uCharacter,vec2(p.x*.5,1.-p.y*.5)).a;
 color*=contribution*mix(1.,uCharacterGain,coverage);
 gl_FragColor=vec4(color,1.);
}`;
const blurFragment=`
precision highp float;varying vec2 vUv;uniform sampler2D uSource;uniform vec2 uDirection;
void main(){
 vec3 color=texture2D(uSource,vUv).rgb*.227027027;
 color+=(texture2D(uSource,vUv+uDirection*1.3846153846).rgb+texture2D(uSource,vUv-uDirection*1.3846153846).rgb)*.3162162162;
 color+=(texture2D(uSource,vUv+uDirection*3.2307692308).rgb+texture2D(uSource,vUv-uDirection*3.2307692308).rgb)*.0702702703;
 gl_FragColor=vec4(color,1.);
}`;
const compositeFragment=`
precision highp float;varying vec2 vUv;
uniform sampler2D uSource,uBloomSmall,uBloomWide;
uniform float uBloomStrength,uSaturation,uContrast,uGrain,uSeconds;
uniform vec3 uTint;
${colorFunctions}
void main(){
 vec3 linear=decodeSrgb(texture2D(uSource,vUv).rgb);
 linear+=(texture2D(uBloomSmall,vUv).rgb*.78+texture2D(uBloomWide,vUv).rgb*.22)*uBloomStrength;
 vec3 color=encodeSrgb(linear);
 float luma=dot(color,vec3(.2126,.7152,.0722));color=mix(vec3(luma),color,uSaturation)*uTint;
 color=(color-.45)*uContrast+.45;
 // Zero-mean grain avoids adding the old grey veil to the night palette.
 float seed=fract(sin(dot(gl_FragCoord.xy+floor(uSeconds*15.),vec2(12.9898,78.233)))*43758.5453);
 color+=(seed-.5)*uGrain;
 gl_FragColor=vec4(max(color,vec3(0.)),1.);
}`;

/** Post-processes scene color only. Packed albedo/normal/material data is never blurred. */
export class BloomPipeline {
 private config:SceneAtmosphere;
 private scene=new THREE.Scene();private camera=new THREE.Camera();private quad:THREE.Mesh;
 private sceneColor:THREE.WebGLRenderTarget;
 private bright:THREE.WebGLRenderTarget;private smallTemp:THREE.WebGLRenderTarget;private small:THREE.WebGLRenderTarget;
 private wideTemp:THREE.WebGLRenderTarget;private wide:THREE.WebGLRenderTarget;
 private extract:THREE.ShaderMaterial;private blur:THREE.ShaderMaterial;private composite:THREE.ShaderMaterial;
 private size=new THREE.Vector2();private width=0;private height=0;private enabled=false;
 readonly hdr:boolean;
 constructor(renderer:THREE.WebGLRenderer,config:SceneAtmosphere,atlas:THREE.Texture,origin:Pair,characterSize:Pair){
  this.config=config;this.hdr=renderer.extensions.has('EXT_color_buffer_float');
  const target=()=>new THREE.WebGLRenderTarget(1,1,{type:this.hdr?THREE.HalfFloatType:THREE.UnsignedByteType,colorSpace:THREE.NoColorSpace,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  this.sceneColor=target();this.bright=target();this.smallTemp=target();this.small=target();this.wideTemp=target();this.wide=target();
  const material=(fragmentShader:string,uniforms:Record<string,THREE.IUniform>)=>new THREE.ShaderMaterial({vertexShader:screenVertex,fragmentShader,uniforms,depthTest:false,depthWrite:false,blending:THREE.NoBlending});
  this.extract=material(extractFragment,{uSource:{value:this.sceneColor.texture},uCharacter:{value:atlas},uSourceTexel:{value:new THREE.Vector2()},uCharacterOrigin:{value:new THREE.Vector2(...origin)},uCharacterSize:{value:new THREE.Vector2(...characterSize)},uViewport:{value:new THREE.Vector4()},uThreshold:{value:config.bloom.threshold},uKnee:{value:config.bloom.softKnee},uCharacterGain:{value:config.bloom.characterGain}});
  this.blur=material(blurFragment,{uSource:{value:this.bright.texture},uDirection:{value:new THREE.Vector2()}});
  this.composite=material(compositeFragment,{uSource:{value:this.sceneColor.texture},uBloomSmall:{value:this.small.texture},uBloomWide:{value:this.wide.texture},uBloomStrength:{value:0},uTint:{value:new THREE.Vector3(1,1,1)},uSaturation:{value:1},uContrast:{value:1},uGrain:{value:0},uSeconds:{value:0}});
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.composite);this.quad.frustumCulled=false;this.scene.add(this.quad);
 }
 private resize(width:number,height:number){
  if(this.width===width&&this.height===height)return;this.width=width;this.height=height;
  const w=Math.max(1,Math.ceil(width/this.config.bloom.downsample)),h=Math.max(1,Math.ceil(height/this.config.bloom.downsample));
  this.sceneColor.setSize(width,height);[this.bright,this.smallTemp,this.small].forEach(t=>t.setSize(w,h));[this.wideTemp,this.wide].forEach(t=>t.setSize(Math.max(1,Math.ceil(w/2)),Math.max(1,Math.ceil(h/2))));
  this.extract.uniforms.uSourceTexel.value.set(1/width,1/height);
 }
 private pass(renderer:THREE.WebGLRenderer,material:THREE.ShaderMaterial,target:THREE.WebGLRenderTarget|null){this.quad.material=material;renderer.setRenderTarget(target);renderer.render(this.scene,this.camera)}
 private gaussian(renderer:THREE.WebGLRenderer,source:THREE.WebGLRenderTarget,temp:THREE.WebGLRenderTarget,target:THREE.WebGLRenderTarget){
  this.blur.uniforms.uSource.value=source.texture;this.blur.uniforms.uDirection.value.set(this.config.bloom.radius/source.width,0);this.pass(renderer,this.blur,temp);
  this.blur.uniforms.uSource.value=temp.texture;this.blur.uniforms.uDirection.value.set(0,this.config.bloom.radius/temp.height);this.pass(renderer,this.blur,target);
 }
 render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,viewport:readonly number[],weights:TimeWeights,seconds:number,bloom:boolean,grade:boolean){
  this.enabled=bloom||grade;
  if(!this.enabled){renderer.setRenderTarget(null);renderer.render(scene,camera);return}
  renderer.getDrawingBufferSize(this.size);this.resize(this.size.x,this.size.y);this.extract.uniforms.uViewport.value.set(...viewport);
  renderer.setRenderTarget(this.sceneColor);renderer.render(scene,camera);
  if(bloom){this.pass(renderer,this.extract,this.bright);this.gaussian(renderer,this.bright,this.smallTemp,this.small);this.gaussian(renderer,this.small,this.wideTemp,this.wide)}
  const u=this.composite.uniforms,c=this.config;
  u.uBloomStrength.value=bloom?weighted(c.bloom.strength,weights):0;
  u.uTint.value.set(...(grade?weightedColor(c.grade.tint,weights):[1,1,1]));u.uSaturation.value=grade?weighted(c.grade.saturation,weights):1;u.uContrast.value=grade?weighted(c.grade.contrast,weights):1;
  u.uGrain.value=grade?c.grade.nightGrain*weights[3]:0;u.uSeconds.value=seconds;
  this.pass(renderer,this.composite,null);
 }
 snapshot(){return {enabled:this.enabled,hdr:this.hdr,sceneSize:[this.width,this.height],bloomSizes:[[this.small.width,this.small.height],[this.wide.width,this.wide.height]],renderTargets:6,additionalBytesEstimate:(this.width*this.height+3*this.small.width*this.small.height+2*this.wide.width*this.wide.height)*(this.hdr?8:4)}}
 destroy(){for(const target of [this.sceneColor,this.bright,this.smallTemp,this.small,this.wideTemp,this.wide])target.dispose();for(const material of [this.extract,this.blur,this.composite])material.dispose();this.quad.geometry.dispose();this.quad.removeFromParent()}
}
