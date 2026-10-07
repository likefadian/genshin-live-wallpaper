import * as THREE from 'three';
import {PlaybackClock,FrameLatch,RenderCadence} from '../content/frame-clock';import {FrameCache} from '../content/frame-cache';
import {validateCombination,type CharacterPackage,type ScenePackage,type WallpaperPackage,type Triple} from '../content/package-contract';
import {daylight} from './daylight';import {vertex,fragment,backgroundFragment} from './shaders';
import {environmentBackgroundFragment} from './environment-shaders';import {environmentAt,environmentLights} from './scene-environment';
import {validateSequenceManifest} from '../content/sequence-manifest';
import {EnvironmentParticles} from './environment-particles';
import {atmosphereAt,weighted,weightedColor,windAt} from './atmosphere-state';
import {BloomPipeline} from './bloom-pipeline';
import {timeBackgroundAt} from '../content/time-background';
import {frameBufferPlan} from '../content/frame-buffer-plan';
import {validateFramePatches,type FramePatches} from '../content/frame-patches';
import {TiledAtlas} from './tiled-atlas';
export type Enhancement='lamps'|'rim'|'wind'|'bloom'|'grade';
export interface RuntimeOptions {frameTransport?:'auto'|'full'}
export interface RuntimeSnapshot {frameTransport:string;framePixelsDecoded:number;atlasUploadCount:number;atlasUploadBytesTotal:number;lastAtlasUpdateMs:number;frame:number;desiredFrame:number;animationSeconds:number;lightingMinutes:number;cacheFrames:number;cacheCapacity:number;prefetchFrames:number;pending:number;decodedBytesEstimate:number;gpuTextures:number;drawCalls:number;renderSize:readonly number[];viewport:readonly number[];canvas:readonly number[];documentHidden:boolean;heldFrames:number;loadError:string;decodeCount:number;decodeMeanMs:number;renderer:string;lastRafGapMs:number;lastRenderMs:number;lastFetchMs:number;lastBitmapMs:number;rafCount:number;renderCount:number;particles:ReturnType<EnvironmentParticles['snapshot']>|null;bloom:ReturnType<BloomPipeline['snapshot']>|null;enhancements:Record<Enhancement,boolean>;wind:{strength:number;rate:number;userRate:number;seconds:number}}
export class WallpaperRuntime {
 readonly character:CharacterPackage;readonly scenePackage:ScenePackage;readonly wallpaper:WallpaperPackage;readonly clock:PlaybackClock;readonly canvas:HTMLCanvasElement;
 private renderer:THREE.WebGLRenderer;private scene=new THREE.Scene();private camera=new THREE.OrthographicCamera();private atlas:THREE.Texture;private backgroundTexture:THREE.Texture;private material:THREE.ShaderMaterial;private backgroundMaterial:THREE.ShaderMaterial;private head:THREE.Mesh;private background:THREE.Mesh;
 private cache:FrameCache<ImageBitmap>;private latch:FrameLatch<ImageBitmap>;private abort=new AbortController();private inflight=new Set<number>();private desired=-1;private displayed=-1;private raf=0;private disposed=false;private paused=false;private backgroundMode='scene';private lastBucket=-1;private lastLightWall:number|null=null;private directionOverride:Triple|null=null;private currentViewport:readonly number[];private deviceRenderer='unavailable';
 lightingAutomatic=false;lightingSpeed:number;heldFrames=0;decodeCount=0;decodeTotalMs=0;onFrame:((now:number,snapshot:RuntimeSnapshot)=>void)|null=null;
 get loadError(){return this.shaderError||this.cache.lastError}
 private visibility=()=>{this.clock.setPaused(this.paused||document.hidden);this.lastLightWall=null;this.effectWall=null};private expectedHashes:string[]=[];
 private environmentTextures:THREE.Texture[]=[];
 private particles?:EnvironmentParticles;private bloom?:BloomPipeline;private cadence:RenderCadence;private particlesEnabled=true;private shaderError='';
 private enhancements:Record<Enhancement,boolean>={lamps:true,rim:true,wind:true,bloom:true,grade:true};
 private effectSeconds=0;private effectWall:number|null=null;private playbackRate=1;private windStrength=1;private windRate=1;private lampColor=new THREE.Color();
 private renderCount=0;private lastRafTime:number|null=null;private lastRafGapMs=0;private lastRenderMs=0;private lastFetchMs=0;private lastBitmapMs=0;private rafCount=0;
 private exposureEV=0;private lightStrength=1;private shadowScale=1;private lastLightDrawMs=0;
 private frameBuffers:ReturnType<typeof frameBufferPlan>;
 private patchAtlas?:TiledAtlas;private patchPlan?:FramePatches;private atlasUploadCount=0;private atlasUploadBytesTotal=0;private lastAtlasUpdateMs=0;
 private constructor(host:HTMLElement,character:unknown,scene:unknown,wallpaper:unknown,options:RuntimeOptions){
  const content=validateCombination(character,scene,wallpaper);this.character=content.character;this.scenePackage=content.scene;this.wallpaper=content.wallpaper;
  const c=this.character;this.frameBuffers=frameBufferPlan(c.atlasSize,c.frameCount);this.clock=new PlaybackClock(c.fps,c.frameCount);this.cadence=new RenderCadence(c.fps);this.clock.setLightingMinutes(this.scenePackage.controls.initialMinutes);this.lightingSpeed=this.scenePackage.controls.previewMinutesPerSecond;this.currentViewport=this.wallpaper.preview;
  this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(1);this.renderer.toneMapping=THREE.NoToneMapping;
  this.canvas=this.renderer.domElement;this.canvas.setAttribute('aria-label','动态受光壁纸画布');host.appendChild(this.canvas);
  const gl=this.renderer.getContext();const info=gl.getExtension('WEBGL_debug_renderer_info');if(info)this.deviceRenderer=gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
  if(c.framePatches&&options.frameTransport!=='full')this.patchAtlas=new TiledAtlas(this.renderer,c.atlasSize);
  this.atlas=this.patchAtlas?.texture??new THREE.Texture();this.atlas.minFilter=this.atlas.magFilter=THREE.NearestFilter;this.atlas.generateMipmaps=false;this.atlas.colorSpace=THREE.NoColorSpace;this.atlas.premultiplyAlpha=false;this.atlas.flipY=false;
  const parameters=Array.from({length:16},()=>new THREE.Vector4(.5,.5,0,16));const shadows=new Array<number>(16).fill(0);const highlights=Array.from({length:16},()=>new THREE.Vector3(.88,.1,0));const style=c.shading;
  for(const m of c.materials){parameters[m.id].set(m.diffuseFloor,m.diffuseStrength,m.specular,m.shininess);shadows[m.id]=m.shadowStrength;if(m.highlightBand)highlights[m.id].set(m.highlightBand.center,m.highlightBand.width,m.highlightBand.strength)}
  const pointUniforms={uPointCount:{value:0},uPoints:{value:Array.from({length:8},()=>new THREE.Vector4(0,0,1,1))},uPointColors:{value:Array.from({length:8},()=>new THREE.Vector4())},uPointFalloff:{value:new Float32Array(8)},uLampFlicker:{value:new Float32Array(8).fill(1)},uEmission:{value:0},uCanvas:{value:new THREE.Vector2(...this.wallpaper.canvas)}};
  this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:false,depthWrite:false,premultipliedAlpha:false,uniforms:{...pointUniforms,uLocalLampGain:{value:1},uRimStrength:{value:0},uRimWidth:{value:1},uRimColor:{value:new THREE.Vector3()},uOrigin:{value:new THREE.Vector2(...this.wallpaper.characterOrigin)},uAtlas:{value:this.atlas},uSize:{value:new THREE.Vector2(c.crop[2],c.crop[3])},uLight:{value:new THREE.Vector3()},uKey:{value:new THREE.Vector3()},uAmbient:{value:new THREE.Vector3()},uLampDirection:{value:new THREE.Vector3()},uLampColor:{value:new THREE.Vector3()},uExposure:{value:1},uShadowOffset:{value:c.shadow.maxOffsetPixels},uShadowSoftness:{value:c.shadow.softnessPixels},uAoStrength:{value:c.shadow.ambientOcclusionStrength},uMaterials:{value:parameters},uMaterialShadow:{value:shadows},uHighlights:{value:highlights},uPainted:{value:new THREE.Vector4(style?.strength??0,style?.softness??.07,style?.thresholds[0]??.28,style?.thresholds[1]??.66)},uBandWeights:{value:new THREE.Vector2(...(style?.weights??[.6,.4]))},uMode:{value:0}}});
  this.head=new THREE.Mesh(new THREE.PlaneGeometry(c.crop[2],c.crop[3]),this.material);this.head.position.set(this.wallpaper.characterOrigin[0]+c.crop[2]/2,-this.wallpaper.characterOrigin[1]-c.crop[3]/2,0);this.head.renderOrder=this.wallpaper.drawOrder.indexOf('character');this.scene.add(this.head);
  this.backgroundTexture=new THREE.Texture();this.backgroundTexture.minFilter=this.backgroundTexture.magFilter=THREE.LinearFilter;this.backgroundTexture.generateMipmaps=false;this.backgroundTexture.colorSpace=THREE.NoColorSpace;this.backgroundTexture.flipY=false;
  const env=this.scenePackage.environment;
  this.backgroundMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:env?environmentBackgroundFragment:backgroundFragment,depthTest:false,depthWrite:false,uniforms:{...pointUniforms,uBackground:{value:this.backgroundTexture},uTint:{value:new THREE.Vector3(1,1,1)},uExposure:{value:1},uSceneData:{value:this.backgroundTexture},uSceneNormal:{value:this.backgroundTexture},uClouds:{value:this.backgroundTexture},uLantern:{value:this.backgroundTexture},uDynamics:{value:env?1:0},uSeconds:{value:0},uSceneLight:{value:new THREE.Vector3()},uSkyTop:{value:new THREE.Vector3()},uSkyHorizon:{value:new THREE.Vector3()},uCloudColor:{value:new THREE.Vector3()},uSkyHeight:{value:env?.sky.heightPixels??1},uCloudRect:{value:new THREE.Vector4(...(env?.sky.clouds.rect??[0,0,1,1]))},uCloudOpacity:{value:0},uCloudDrift:{value:env?.sky.clouds.driftPixelsPerSecond??0},uCloudBob:{value:env?.sky.clouds.verticalOscillationPixels??0},uCloudPeriod:{value:env?.sky.clouds.periodSeconds??1},uWaveAmplitude:{value:new THREE.Vector2(...(env?.water.amplitudePixels??[0,0]))},uWaveFrequency:{value:new THREE.Vector2(...(env?.water.frequency??[0,0]))},uWaveSpeed:{value:new THREE.Vector2(...(env?.water.speed??[0,0]))},uReflection:{value:env?.water.reflectionStrength??0},uStars:{value:0},uStarDensity:{value:env?.sky.stars.density??1},uStarBrightness:{value:env?.sky.stars.brightness??0},uStarSeed:{value:env?.sky.stars.seed??0},uFog:{value:0},uSun:{value:new THREE.Vector4(0,0,1,0)},uMoon:{value:new THREE.Vector4(0,0,1,0)},uLanterns:{value:Array.from({length:8},()=>new THREE.Vector4())},uContactOffset:{value:env?.shadow.offsetPixels??0},uContactSoftness:{value:env?.shadow.softnessPixels??0},uContactStrength:{value:env?.shadow.strength??0}}});
  Object.assign(this.backgroundMaterial.uniforms,{uDawnBackground:{value:this.backgroundTexture},uDuskBackground:{value:this.backgroundTexture},uNightBackground:{value:this.backgroundTexture},uRegisteredBackground:{value:this.scenePackage.background.timeOfDay?1:0},uBackgroundWeights:{value:new THREE.Vector4(0,1,0,0)}});
  const b=this.scenePackage.background.rect;this.background=new THREE.Mesh(new THREE.PlaneGeometry(b[2],b[3]),this.backgroundMaterial);this.background.position.set(b[0]+b[2]/2,-b[1]-b[3]/2,-1);this.background.renderOrder=this.wallpaper.drawOrder.indexOf('scene');this.scene.add(this.background);
  this.latch=new FrameLatch({width:c.crop[2],height:c.crop[3],cropOrigin:[c.crop[0],c.crop[1]],fps:c.fps,frameCount:c.frameCount,requiredChannels:c.requiredChannels});
  this.cache=new FrameCache(this.frameBuffers.capacity,index=>{
   const file=c.pattern.replace('{frame:04}',String(index).padStart(4,'0'));
   return this.decodeBitmap((this.patchPlan?c.framePatches!.assetRoot:c.assetRoot)+file,(this.patchPlan?.hashes??this.expectedHashes)[index],this.patchPlan?.packedSize??c.atlasSize);
  },bitmap=>bitmap.close());
  if(this.scenePackage.atmosphere){this.particles=new EnvironmentParticles(this.scene,this.scenePackage.atmosphere,this.wallpaper.canvas,this.scenePackage.environment!.lights,this.background.renderOrder,this.head.renderOrder);this.particles.setCharacter(this.atlas,this.wallpaper.characterOrigin,[c.crop[2],c.crop[3]]);this.bloom=new BloomPipeline(this.renderer,this.scenePackage.atmosphere,this.atlas,this.wallpaper.characterOrigin,[c.crop[2],c.crop[3]])}this.renderer.info.autoReset=false;this.renderer.debug.onShaderError=(gl,program,vs,fs)=>{this.shaderError=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].filter(Boolean).join(' | ');console.error(this.shaderError)};document.addEventListener('visibilitychange',this.visibility);this.setViewport(false);
 }
 static async create(host:HTMLElement,character:unknown,scene:unknown,wallpaper:unknown,options:RuntimeOptions={}){const runtime=new WallpaperRuntime(host,character,scene,wallpaper,options);try{await runtime.initialize();return runtime}catch(error){runtime.destroy();throw error}}
 private async decodeBitmap(path:string,hash:string,size:readonly number[]){
  const start=performance.now(),response=await fetch(new URL(import.meta.env.BASE_URL+path,document.baseURI),{signal:this.abort.signal});if(!response.ok)throw Error(path+': HTTP '+response.status);
  const blob=await response.blob(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==hash)throw Error(path+': SHA-256 mismatch');
  const fetched=performance.now();this.lastFetchMs=fetched-start;const bitmap=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none',imageOrientation:'flipY'});this.lastBitmapMs=performance.now()-fetched;
  if(this.disposed||bitmap.width!==size[0]||bitmap.height!==size[1]){bitmap.close();throw Error(path+': disposed or atlas dimensions mismatch')}
  this.decodeCount++;this.decodeTotalMs+=performance.now()-start;return bitmap;
 }
 private async initializePatches(){
  if(!this.patchAtlas)return;const c=this.character,path=c.framePatches!.assetRoot+'manifest.json',response=await fetch(new URL(import.meta.env.BASE_URL+path,document.baseURI),{signal:this.abort.signal});if(!response.ok)throw Error('frame patches manifest HTTP '+response.status);
  this.patchPlan=validateFramePatches(await response.json(),c,this.expectedHashes);this.frameBuffers.bytesPerFrame=this.patchPlan.packedSize[0]*this.patchPlan.packedSize[1]*4;
  const base=await this.decodeBitmap(c.assetRoot+c.pattern.replace('{frame:04}','0000'),this.expectedHashes[0],c.atlasSize);
  try{this.patchAtlas.initialize(this.patchPlan,base);this.atlasUploadCount++;this.atlasUploadBytesTotal+=c.atlasSize[0]*c.atlasSize[1]*4}finally{base.close()}
 }
 private async loadStatic(texture:THREE.Texture,path:string,size?:readonly number[]){const response=await fetch(new URL(import.meta.env.BASE_URL+path,document.baseURI),{signal:this.abort.signal});if(!response.ok)throw Error(path+': HTTP '+response.status);const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none',imageOrientation:'flipY'});if(this.disposed){bitmap.close();throw Error(path+': runtime disposed during texture decode')}if(size&&(bitmap.width!==size[0]||bitmap.height!==size[1])){bitmap.close();throw Error(path+': scene dimensions mismatch')}texture.image=bitmap;texture.needsUpdate=true}
 private async initialize(){const metadata=await fetch(new URL(import.meta.env.BASE_URL+this.character.assetRoot+'manifest.json',document.baseURI),{signal:this.abort.signal});if(!metadata.ok)throw Error('sequence manifest HTTP '+metadata.status);this.expectedHashes=validateSequenceManifest(await metadata.json(),this.character);await this.initializePatches();const rect=this.scenePackage.background.rect;await this.loadStatic(this.backgroundTexture,this.scenePackage.background.path,[rect[2],rect[3]]);const e=this.scenePackage.environment;if(e){for(const [uniform,path,size] of [['uSceneData',e.dataPath,this.wallpaper.canvas],['uSceneNormal',e.normalPath,this.wallpaper.canvas],['uClouds',e.sky.clouds.path,undefined],['uLantern',e.lanternPath,undefined]] as const){const texture=new THREE.Texture();texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.NoColorSpace;texture.premultiplyAlpha=false;texture.flipY=false;this.environmentTextures.push(texture);await this.loadStatic(texture,path,size);this.backgroundMaterial.uniforms[uniform].value=texture}}
  const paintings=this.scenePackage.background.timeOfDay;
  if(paintings){
   for(const [i,uniform] of ['uDawnBackground','uBackground','uDuskBackground','uNightBackground'].entries()){
    const path=paintings.plates[i];if(path===this.scenePackage.background.path){this.backgroundMaterial.uniforms[uniform].value=this.backgroundTexture;continue;}
    const texture=new THREE.Texture();texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.NoColorSpace;texture.flipY=false;texture.premultiplyAlpha=false;
    this.environmentTextures.push(texture);await this.loadStatic(texture,path,[rect[2],rect[3]]);this.backgroundMaterial.uniforms[uniform].value=texture;
   }
  }
  if(this.particles)this.particles.setMask(this.backgroundMaterial.uniforms.uSceneData.value);await this.cache.load(0);this.commit(0);this.updateLight();this.renderFrame();this.visibility();this.raf=requestAnimationFrame(this.tick)}
 private commit(index:number){const resource=this.cache.get(index);if(!resource)return false;const c=this.character;for(const channel of c.requiredChannels)this.latch.ready(channel,{frameIndex:index,width:c.crop[2],height:c.crop[3],cropOrigin:[c.crop[0],c.crop[1]],fps:c.fps,frameCount:c.frameCount,resource});const complete=this.latch.commit(index);if(complete?.frameIndex!==index)return false;this.cache.pin(index);const start=performance.now();if(this.patchAtlas)this.patchAtlas.update(resource);else{this.atlas.image=resource;this.atlas.needsUpdate=true}this.lastAtlasUpdateMs=performance.now()-start;this.atlasUploadCount++;this.atlasUploadBytesTotal+=this.frameBuffers.bytesPerFrame;this.displayed=index;return true}
 private pump(index:number){const c=this.character;for(let ahead=0;ahead<this.frameBuffers.prefetchFrames&&this.inflight.size<this.frameBuffers.maxConcurrent;ahead++){const next=(index+ahead)%c.frameCount;if(this.cache.get(next)||this.inflight.has(next))continue;this.inflight.add(next);void this.cache.load(next).catch(()=>{}).finally(()=>this.inflight.delete(next))}}
 private updateLight(){
  const light=daylight(this.scenePackage,this.clock.lightingMinutes),u=this.material.uniforms,b=this.backgroundMaterial.uniforms,e=this.scenePackage.environment,cfg=this.scenePackage.atmosphere;
  const clean=this.backgroundMode==='scene'&&u.uMode.value===0&&!this.directionOverride;
  u.uLight.value.set(...(this.directionOverride??light.direction));
  u.uKey.value.set(...(this.directionOverride?[1,1,1]:light.keyColor)).multiplyScalar(this.lightStrength);
  u.uAmbient.value.set(...(this.directionOverride?[.22,.22,.22]:light.ambient));
  u.uLampDirection.value.set(...light.lampDirection);u.uLampColor.value.set(...(this.directionOverride?[0,0,0]:light.lampColor));
  if(e)u.uLampColor.value.multiplyScalar(e.globalLampScale);
  u.uLocalLampGain.value=this.enhancements.lamps&&clean?1:0;
  u.uExposure.value=light.exposure*2**this.exposureEV;
  u.uAoStrength.value=this.character.shadow.ambientOcclusionStrength*this.shadowScale;
  for(const material of this.character.materials)u.uMaterialShadow.value[material.id]=material.shadowStrength*this.shadowScale;
  b.uTint.value.set(...light.backgroundTint);b.uExposure.value=light.backgroundExposure*2**this.exposureEV*(this.backgroundMode==='bright'?1.65:1);
  const paintings=this.scenePackage.background.timeOfDay;
  if(paintings){b.uBackgroundWeights.value.set(...timeBackgroundAt(paintings,this.clock.lightingMinutes));b.uTint.value.set(1,1,1);b.uExposure.value=2**this.exposureEV*(this.backgroundMode==='bright'?1.65:1);}
  this.background.visible=this.backgroundMode!=='white';this.renderer.setClearColor(this.backgroundMode==='white'?0xffffff:0x172536,1);
  const weights=cfg?atmosphereAt(cfg,this.clock.lightingMinutes):null;
  u.uRimStrength.value=cfg&&weights&&clean&&this.enhancements.rim?weighted(cfg.rim.strength,weights):0;
  if(cfg&&weights){u.uRimColor.value.set(...weightedColor(cfg.rim.colors,weights));u.uRimWidth.value=cfg.rim.edgeWidthPixels;}
  if(e){
   const key=environmentAt(e,this.clock.lightingMinutes);b.uSeconds.value=this.clock.seconds;
   b.uSceneLight.value.set(...(this.directionOverride??light.direction));b.uSkyTop.value.set(...key.skyTop);b.uSkyHorizon.value.set(...key.skyHorizon);
   b.uCloudColor.value.set(...key.cloudColor);b.uCloudOpacity.value=key.cloudOpacity*e.sky.clouds.opacity;b.uStars.value=key.stars;b.uFog.value=key.fog;
   u.uEmission.value=this.directionOverride?0:key.emission;
   const phase=Math.max(0,Math.min(1,(this.clock.lightingMinutes-e.sky.sun.riseMinutes)/(e.sky.sun.setMinutes-e.sky.sun.riseMinutes))),segment=phase<.5?0:1,localPhase=phase<.5?phase*2:phase*2-1,t=localPhase*localPhase*(3-2*localPhase),points=e.sky.sun.path;
   const sun=points[segment].map((v,i)=>v+(points[segment+1][i]-v)*t);b.uSun.value.set(...sun,e.sky.sun.radiusPixels,key.sun);b.uMoon.value.set(...e.sky.moon.position,e.sky.moon.radiusPixels,key.moon);
   const moving=environmentLights(e,this.clock.seconds);u.uPointCount.value=moving.length;
   for(let i=0;i<8;i++){
    const l=moving[i];
    if(l){
     u.uPoints.value[i].set(...l.position,l.radiusPixels);
     this.lampColor.setRGB(l.color[0],l.color[1],l.color[2],THREE.SRGBColorSpace);
     u.uPointColors.value[i].set(this.lampColor.r,this.lampColor.g,this.lampColor.b,l.strength);
     u.uPointFalloff.value[i]=l.falloff??0;u.uLampFlicker.value[i]=l.flickerRatio;
     b.uLanterns.value[i].set(Math.sin(this.clock.seconds/l.periodSeconds*Math.PI*2+l.phase)*.065,l.flickerRatio,...(l.floating?l.size:[0,0]));
    }else{u.uPointColors.value[i].set(0,0,0,0);u.uLampFlicker.value[i]=1;b.uLanterns.value[i].set(0,0,0,0)}
   }
   if(this.particles&&cfg&&weights){
    const wind=windAt(cfg,this.enhancements.wind?this.effectSeconds:0,this.displayed,this.character.fps,this.character.frameCount,this.character.wind!);
    this.particles.update(this.clock.seconds,weights,wind.signal,moving,this.particlesEnabled&&clean);
   }
  }
 }
 private renderFrame(){
  this.renderCount++;this.renderer.info.reset();
  const config=this.scenePackage.atmosphere,clean=this.backgroundMode==='scene'&&this.material.uniforms.uMode.value===0&&!this.directionOverride;
  if(this.bloom&&config)this.bloom.render(this.renderer,this.scene,this.camera,this.currentViewport,atmosphereAt(config,this.clock.lightingMinutes),this.clock.seconds,this.enhancements.bloom&&clean,this.enhancements.grade&&clean);
  else{this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera)}
 }
 private tick=(now:number)=>{
  if(this.disposed)return;this.raf=requestAnimationFrame(this.tick);this.rafCount++;
  this.lastRafGapMs=this.lastRafTime===null?0:now-this.lastRafTime;this.lastRafTime=now;
  if(document.hidden){this.lastLightWall=null;this.effectWall=null;return}
  if(!this.paused&&this.effectWall!==null)this.effectSeconds+=(now-this.effectWall)/1000;
  this.effectWall=now;
  const cfg=this.scenePackage.atmosphere,profile=this.character.wind;
  const wind=cfg&&profile&&this.enhancements.wind?windAt(cfg,this.effectSeconds,Math.max(0,this.displayed),this.character.fps,this.character.frameCount,profile):{strength:1,playbackRate:1};
  this.windStrength=wind.strength;this.windRate=wind.playbackRate;
  this.clock.setPlaybackRate(Math.max(.25,Math.min(2,this.playbackRate*this.windRate)));this.clock.tick(now);
  if(this.lightingAutomatic&&this.lastLightWall!==null)this.clock.setLightingMinutes(this.clock.lightingMinutes+(now-this.lastLightWall)/1000*this.lightingSpeed);
  this.lastLightWall=now;
  const bucket=Math.floor(this.clock.seconds*this.character.fps);
  if(this.paused&&bucket===this.lastBucket&&!this.lightingAutomatic)return;
  if(!this.cadence.due(now,this.lastBucket<0))return;
  this.lastBucket=bucket;this.lastLightDrawMs=now;this.desired=this.clock.frame;this.pump(this.desired);
  if(this.desired!==this.displayed&&!this.commit(this.desired))this.heldFrames++;
  this.updateLight();const renderStart=performance.now();this.renderFrame();this.lastRenderMs=performance.now()-renderStart;
  this.onFrame?.(now,this.snapshot());
 };
 setParticles(enabled:boolean){this.particlesEnabled=enabled;this.lastBucket=-1}
 setEnhancement(key:Enhancement,enabled:boolean){this.enhancements[key]=enabled;this.lastBucket=-1}
 setPaused(value:boolean){this.effectWall=null;this.paused=value;this.clock.setPaused(value||document.hidden);this.lastLightWall=null;this.lastBucket=-1}
 setTime(minutes:number){this.clock.setLightingMinutes(minutes);this.lastBucket=-1}
 setPlaybackRate(rate:number){this.clock.setPlaybackRate(rate);this.playbackRate=rate}
 setExposureEV(value:number){if(!Number.isFinite(value)||Math.abs(value)>2)throw Error('exposure adjustment invalid');this.exposureEV=value;this.lastBucket=-1}
 setLightStrength(value:number){if(!Number.isFinite(value)||value<0||value>2)throw Error('light strength invalid');this.lightStrength=value;this.lastBucket=-1}
 setShadowStrength(value:number){if(!Number.isFinite(value)||value<0||value>1.5)throw Error('shadow strength invalid');this.shadowScale=value;this.lastBucket=-1}
 setTestDirection(direction:Triple|null){this.directionOverride=direction;this.lastBucket=-1}
 setBackground(mode:string){if(!['scene','white','bright'].includes(mode))throw Error('unknown background mode');this.backgroundMode=mode;this.lastBucket=-1}
 setDiagnostic(mode:number){this.material.uniforms.uMode.value=mode;this.lastBucket=-1}
 setViewport(fullCanvas:boolean){const p=fullCanvas?[0,0,...this.wallpaper.canvas]:this.wallpaper.preview;this.currentViewport=p;this.camera.left=p[0];this.camera.right=p[0]+p[2];this.camera.top=-p[1];this.camera.bottom=-p[1]-p[3];this.camera.near=.1;this.camera.far=10;this.camera.position.z=5;this.camera.updateProjectionMatrix();this.renderer.setSize(p[2],p[3],false);this.canvas.style.width='100%';this.canvas.style.height='auto';this.canvas.style.aspectRatio=p[2]+'/'+p[3];this.lastBucket=-1}
 setQuality(scale:number){if(![1,1.5,2].includes(scale))throw Error('unsupported quality scale');this.renderer.setPixelRatio(scale);this.renderer.setSize(this.currentViewport[2],this.currentViewport[3],false);this.lastBucket=-1}
 snapshot():RuntimeSnapshot{return {frameTransport:this.patchAtlas?'tiles':'full',framePixelsDecoded:this.frameBuffers.bytesPerFrame/4,atlasUploadCount:this.atlasUploadCount,atlasUploadBytesTotal:this.atlasUploadBytesTotal,lastAtlasUpdateMs:this.lastAtlasUpdateMs,frame:this.displayed,desiredFrame:this.desired,animationSeconds:this.clock.seconds,lightingMinutes:this.clock.lightingMinutes,cacheFrames:this.cache.size,cacheCapacity:this.cache.capacity,prefetchFrames:this.frameBuffers.prefetchFrames,pending:this.cache.pendingCount,decodedBytesEstimate:(this.cache.size+this.cache.pendingCount)*this.frameBuffers.bytesPerFrame,gpuTextures:this.renderer.info.memory.textures,drawCalls:this.renderer.info.render.calls,renderSize:[this.canvas.width,this.canvas.height],viewport:this.currentViewport,canvas:this.wallpaper.canvas,documentHidden:document.hidden,heldFrames:this.heldFrames,loadError:this.loadError,decodeCount:this.decodeCount,decodeMeanMs:this.decodeCount?this.decodeTotalMs/this.decodeCount:0,renderer:this.deviceRenderer,lastRafGapMs:this.lastRafGapMs,lastRenderMs:this.lastRenderMs,lastFetchMs:this.lastFetchMs,lastBitmapMs:this.lastBitmapMs,rafCount:this.rafCount,renderCount:this.renderCount,particles:this.particles?.snapshot()??null,bloom:this.bloom?.snapshot()??null,enhancements:{...this.enhancements},wind:{strength:this.windStrength,rate:this.windRate,userRate:this.playbackRate,seconds:this.effectSeconds}}}
 destroy(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);document.removeEventListener('visibilitychange',this.visibility);this.abort.abort();this.cache.dispose();this.latch.clear();this.head.geometry.dispose();this.background.geometry.dispose();this.material.dispose();this.backgroundMaterial.dispose();if(this.patchAtlas)this.patchAtlas.destroy();else this.atlas.dispose();(this.backgroundTexture.image as ImageBitmap|undefined)?.close();this.backgroundTexture.dispose();for(const texture of this.environmentTextures){(texture.image as ImageBitmap|undefined)?.close();texture.dispose()}this.environmentTextures=[];this.particles?.destroy();this.bloom?.destroy();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove();this.onFrame=null}
}
