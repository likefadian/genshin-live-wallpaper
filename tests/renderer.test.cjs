const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,existsSync}=require('node:fs');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const tick=()=>new Promise(done=>setImmediate(done));
const deferred=()=>{let finish,fail;const promise=new Promise((yes,no)=>{finish=yes;fail=no;});return {promise,finish,fail};};
const video={id:'A',kind:'video',name:'视频'},scene={id:'S',kind:'scene',name:'场景'};
const snapshot=(id,revision)=>({settings:{wallpaperId:id,motion:true,showClock:false},revision,catalog:{wallpapers:[video,scene]}});
function element(){return {style:{setProperty(){}},dataset:{},append(){},remove(){},hidden:false,textContent:''};}
async function renderer(initial,createVideoRuntime,WallpaperRuntime,registry={get:()=>({character:{},scene:{},wallpaper:{}})}){
 const {createWallpaperController}=await import('../electron/wallpaper-controller.mjs');
 const factoryFile=resolve(__dirname,'../electron/scene-runtime.mjs');
 const createAbortableScene=existsSync(factoryFile)?(await import(pathToFileURL(factoryFile).href)).createAbortableScene:undefined;
 const {resolveTimePolicy}=await import('../vendor/v3/web/src/ui/time-policy.ts');
 const errors=[],applied=[],nodes=new Map();let receive,close;
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element};
 const window={genshinDesktop:{getState:async()=>initial,onState(callback){receive=callback;return()=>{};},reportError:payload=>errors.push(payload),reportApplied:payload=>applied.push(payload)},addEventListener(_name,callback){close=callback;}};
 // Exercise the production entry point; replace only browser, engine and media boundaries.
 const source=readFileSync(resolve(__dirname,'../electron/wallpaper-renderer.mjs'),'utf8').replace(/^import[^\r\n]+;\r?\n/gm,'');
 const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
 const intervals=new Set();
 const run=new AsyncFunction('window','document','registry','WallpaperRuntime','createWallpaperClock','createVideoRuntime','createWallpaperController','createAbortableScene','resolveTimePolicy','setInterval','clearInterval',source);
 const started=run(window,document,registry,WallpaperRuntime,()=>({setVisible(){},destroy(){}}),createVideoRuntime,createWallpaperController,createAbortableScene,resolveTimePolicy,callback=>{intervals.add(callback);return callback;},callback=>intervals.delete(callback));
 return {errors,applied,started,intervals,async deliver(value){receive(value);await tick();},close:()=>close?.()};
}
function videoRuntime(){return {apply(){},snapshot:()=>({kind:'video'}),destroy(){}};}

test('加载失败报告过期后，新设置快照能再次得到当前错误',async()=>{
 const loading=deferred();let created=0;
 const app=await renderer(snapshot('A',1),()=>++created===1?loading.promise:Promise.reject(Error('不可解码')));
 try{
  await tick();const mainRevision=2;loading.fail(Error('不可解码'));await app.started;
  assert.equal(app.errors.length,1);assert.equal(app.errors[0].revision,1);assert.ok(!app.errors.some(error=>error.revision===mainRevision));
  await app.deliver(snapshot('A',mainRevision));
  assert.ok(app.errors.some(error=>error.wallpaperId==='A'&&error.revision===mainRevision),'主进程丢弃旧错误后仍需收到当前错误，避免永久空白');
 }finally{app.close();}
});

test('切走仍在初始化的场景时，立即释放底层实例',async()=>{
 const loading=deferred(),instances=[];
 class Scene{
  constructor(){this.destroyed=0;instances.push(this);}
  initialize(){return loading.promise;}
  destroy(){this.destroyed++;}
  static async create(...args){const runtime=new Scene(...args);await runtime.initialize();return runtime;}
 }
 const app=await renderer(snapshot('A',1),async()=>videoRuntime(),Scene);await app.started;
 try{
  await app.deliver(snapshot('S',2));assert.equal(instances.length,1);
  await app.deliver(snapshot('A',3));assert.equal(instances[0].destroyed,1,'初始化尚未结束时已取消读取并释放 WebGL 所有者');
 }finally{loading.finish();await tick();app.close();}
 assert.equal(instances[0].destroyed,1,'迟到初始化完成后不能重复释放');
});

test('场景工厂对预先取消和初始化失败执行幂等清理',async()=>{
 const file=resolve(__dirname,'../electron/scene-runtime.mjs'),create=existsSync(file)?(await import(pathToFileURL(file).href)).createAbortableScene:undefined;
 assert.equal(typeof create,'function');let created=0,destroyed=0;
 class Scene{constructor(){created++;}async initialize(){throw Error('场景加载失败');}destroy(){destroyed++;}}
 const cancel=new AbortController();cancel.abort();
 await assert.rejects(create(Scene,{}, {},{}, {},{signal:cancel.signal}),/取消/);assert.equal(created,0);
 await assert.rejects(create(Scene,{}, {},{}, {},{}),/场景加载失败/);assert.equal(created,1);assert.equal(destroyed,1);
 Scene.prototype.initialize=async()=>{};const live=new AbortController(),runtime=await create(Scene,{}, {},{}, {},{signal:live.signal});live.abort();runtime.destroy();runtime.destroy();assert.equal(created,2);assert.equal(destroyed,2);
});

test('固定午后忽略全局时间模式，切回动态场景恢复昼夜且保留用户参数',async()=>{
 const fixed={...scene,id:'F',capabilities:{time:false,light:false,shadow:false,particles:false,lamps:false,rim:false,wind:false,bloom:false,grade:false}},instances=[];
 const registry={get:id=>({character:{},scene:{controls:{timeMode:id==='F'?'fixed':'cycle',initialMinutes:720,previewMinutesPerSecond:45}},wallpaper:{preview:[0,0,1920,1080]}})};
 class Scene{
  constructor(_host,_character,scene,wallpaper){this.scenePackage=scene;this.wallpaper=wallpaper;this.enhancements={};instances.push(this);}
  async initialize(){}destroy(){}setPaused(){}setPlaybackRate(){}setQuality(){}setExposureEV(value){this.exposure=value;}
  setParticles(value){this.particles=value;}setLightStrength(value){this.light=value;}setShadowStrength(value){this.shadow=value;}setEnhancement(key,value){this.enhancements[key]=value;}
  setTime(value){this.minutes=value;}snapshot(){return {renderSize:[1920,1080],lightingMinutes:this.minutes};}
 }
 const saved={motion:true,speed:1,exposure:.25,light:1.4,shadow:.7,particles:true,lamps:true,rim:true,wind:true,bloom:true,grade:true,quality:1,minutes:1320,timeMode:'cycle'};
 const state=(id,revision,timeMode=saved.timeMode)=>({settings:{...saved,wallpaperId:id,timeMode},timeAnchor:Date.now()-5000,revision,catalog:{wallpapers:[fixed,scene]}});
 const app=await renderer(state('F',1),async()=>videoRuntime(),Scene,registry);await app.started;
 try{
  assert.equal(app.errors.length,0);const sky=instances[0];
  for(const [i,mode] of ['cycle','manual','local'].entries()){
   await app.deliver(state('F',i+2,mode));assert.equal(sky.minutes,720);assert.equal(sky.lightingAutomatic,false);
  }
  assert.equal(app.intervals.size,1,'固定场景只保留遥测计时器');assert.equal(sky.exposure,.25);assert.equal(sky.light,1);assert.equal(sky.shadow,1);assert.equal(sky.particles,false);assert.ok(Object.values(sky.enhancements).every(value=>value===false));
  await app.deliver(state('S',5,'manual'));assert.equal(instances[1].minutes,1320);assert.equal(instances[1].lightingAutomatic,false);assert.equal(instances[1].light,1.4);
  await app.deliver(state('S',6,'local'));assert.equal(app.intervals.size,2,'动态场景恢复本地时间跟随');
  await app.deliver(state('S',7,'cycle'));assert.equal(instances[1].lightingAutomatic,true);assert.equal(app.intervals.size,1);
  assert.equal(saved.minutes,1320);
 }finally{app.close();}
 assert.equal(app.intervals.size,0);
});
