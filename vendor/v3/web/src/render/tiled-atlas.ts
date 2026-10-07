import * as THREE from 'three';
import {patchVertexData,type FramePatches} from '../content/frame-patches';

/** A full-size numerical atlas stays on the GPU. Independent, smaller RGBA PNGs
 * overwrite every region that varies anywhere in the sequence in one draw.
 * No blending, color conversion, interpolation or temporal delta accumulation.
 */
export class TiledAtlas {
 readonly texture:THREE.Texture;
 private target:THREE.WebGLRenderTarget;private source=new THREE.Texture();private scene=new THREE.Scene();private camera:THREE.OrthographicCamera;
 private material:THREE.ShaderMaterial;private mesh:THREE.Mesh;
 constructor(private renderer:THREE.WebGLRenderer,size:readonly number[]){
  this.target=new THREE.WebGLRenderTarget(size[0],size[1],{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  this.texture=this.target.texture;this.texture.colorSpace=THREE.NoColorSpace;
  this.source.minFilter=this.source.magFilter=THREE.NearestFilter;this.source.generateMipmaps=false;this.source.flipY=false;this.source.premultiplyAlpha=false;this.source.colorSpace=THREE.NoColorSpace;
  this.camera=new THREE.OrthographicCamera(0,size[0],size[1],0,.1,10);this.camera.position.z=1;
  this.material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,uniforms:{uSource:{value:this.source}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'precision highp float;varying vec2 vUv;uniform sampler2D uSource;void main(){gl_FragColor=texture2D(uSource,vUv);}'});
  this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.material);this.mesh.frustumCulled=false;this.scene.add(this.mesh);
 }
 initialize(plan:FramePatches,base:ImageBitmap){
  if(Math.max(...plan.atlasSize,...plan.packedSize)>this.renderer.capabilities.maxTextureSize)throw Error('frame patches exceed GPU maximum texture dimensions');
  const texture=new THREE.Texture(base);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.premultiplyAlpha=false;texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;
  const geometry=new THREE.PlaneGeometry(plan.atlasSize[0],plan.atlasSize[1]);this.mesh.geometry.dispose();this.mesh.geometry=geometry;this.mesh.position.set(plan.atlasSize[0]/2,plan.atlasSize[1]/2,0);this.material.uniforms.uSource.value=texture;
  try{this.draw()}finally{texture.dispose()}
  this.material.uniforms.uSource.value=this.source;geometry.dispose();const vertices=patchVertexData(plan);
  this.mesh.geometry=new THREE.BufferGeometry();this.mesh.geometry.setAttribute('position',new THREE.BufferAttribute(vertices.positions,3));this.mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(vertices.uvs,2));this.mesh.position.set(0,0,0);
 }
 update(bitmap:ImageBitmap){this.source.image=bitmap;this.source.needsUpdate=true;this.draw()}
 private draw(){
  const renderer=this.renderer,target=renderer.getRenderTarget(),autoClear=renderer.autoClear;renderer.autoClear=false;
  try{renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera)}finally{renderer.setRenderTarget(target);renderer.autoClear=autoClear}
 }
 destroy(){this.source.dispose();this.mesh.geometry.dispose();this.material.dispose();this.target.dispose()}
}
