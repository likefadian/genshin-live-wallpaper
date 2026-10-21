const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,cpSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve,dirname}=require('node:path');
const hash=data=>createHash('sha256').update(data).digest('hex');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'wallpaper-source-')),source=join(dir,'source'),root=join(dir,'desktop');mkdirSync(source);mkdirSync(root);
 const put=(path,data)=>{const file=join(source,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,typeof data==='object'?JSON.stringify(data):data);};
 const git=args=>execFileSync('git',['-C',source,...args],{windowsHide:true});
 cpSync(resolve(__dirname,'../vendor/v3/web/src/content'),join(source,'web/src/content'),{recursive:true});
 const assetRoot='assets/extra/sky/sunflower-afternoon/warm-sun-v001/',config='extra/sky/sunflower-afternoon/config/publication-warm-sun-v001.json';
 const character={schemaVersion:1,id:'sky-motion',canvas:[2,2],crop:[0,0,2,2],fps:30,frameCount:2,atlasSize:[4,4],requiredChannels:['albedo','normal','material','shadow'],assetRoot,framePatches:{assetRoot:assetRoot+'tiles-v001/'},pattern:'frame-{frame:04}.png',materials:[{id:1,name:'午后',diffuseFloor:1,diffuseStrength:0,specular:0,shininess:1,shadowStrength:0}],shadow:{maxOffsetPixels:0,softnessPixels:0,ambientOcclusionStrength:0}};
 const key=minutes=>({minutes,name:'午后',direction:[0,0,1],lampDirection:[0,0,1],keyColor:[1,1,1],ambient:[1,1,1],lampColor:[0,0,0],exposure:1,backgroundTint:[1,1,1],backgroundExposure:1});
 const scene={schemaVersion:1,id:'sky-scene',canvas:[2,2],background:{path:assetRoot+'background.png',rect:[0,0,2,2]},controls:{timeMode:'fixed',initialMinutes:720,previewMinutesPerSecond:45,presets:[{name:'午后',minutes:720}]},keyframes:[key(0),key(1440)]};
 const wallpaper={schemaVersion:1,id:'sky',characterId:character.id,sceneId:scene.id,canvas:[2,2],preview:[0,0,2,2],characterOrigin:[0,0],drawOrder:['scene','character'],presentation:{selectable:true,characterKey:'sky',sceneName:'向日葵午后',focus:[.5,.5],thumbnail:assetRoot+'thumbnail.png'}};
 put(config,character);
 put('web/src/wallpapers/registry.ts',`import character from '../../../${config}';export const defaultWallpaperId='sky';export const registry=new Map([['sky',{character,scene:${JSON.stringify(scene)},wallpaper:${JSON.stringify(wallpaper)}}]]);`);
 const frames=[],patches=[];
 for(let i=0;i<2;i++){
  const original='full-'+i,packed='tile-'+i,file='frame-'+String(i).padStart(4,'0')+'.png';
  put('web/public/'+assetRoot+file,original);put('web/public/'+assetRoot+'tiles-v001/'+file,packed);
  frames.push({frame:i,sha256:hash(original)});patches.push({frame:i,sha256:hash(packed),sourceSha256:hash(original)});
 }
 const manifest={schemaVersion:1,fps:30,frameCount:2,crop:character.crop,atlasSize:character.atlasSize,requiredChannels:character.requiredChannels,frames};
 put('web/public/'+assetRoot+'manifest.json',manifest);
 put('web/public/'+assetRoot+'tiles-v001/manifest.json',{...manifest,encoding:'rgba8-independent-tiles',baseFrame:0,packedSize:[2,2],tiles:[[0,0,2,2,0,0]],frames:patches});
 put('web/public/'+assetRoot+'background.png','background');put('web/public/'+assetRoot+'thumbnail.png','thumbnail');
 put('web/public/assets/extra/sky/sunflower-afternoon/rejected-v001/candidate.mp4','private candidate');
 git(['init','-q']);git(['config','core.autocrlf','false']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','accepted source']);
 const commit=git(['rev-parse','HEAD']).toString().trim();
 return {source,root,commit,config,assetRoot,put,git,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
test('同步已确认的网页配置、完整序列和分块，排除未引用候选',async()=>{
 const {syncV3Engine}=await import('../scripts/sync-v3-engine.mjs'),f=fixture();
 try{
  const result=await syncV3Engine({...f,requestedRef:f.commit});assert.equal(result.sourceCommit,f.commit);assert.equal(result.assetFiles,8);
  assert.ok(existsSync(join(f.root,'vendor/v3',f.config)));assert.ok(existsSync(join(f.root,'content',f.assetRoot,'tiles-v001/frame-0001.png')));
  assert.ok(!existsSync(join(f.root,'content/assets/extra/sky/sunflower-afternoon/rejected-v001')));
  const record=JSON.parse(readFileSync(join(f.root,'content/engine-update.json')));assert.equal(record.sourceCommit,f.commit);assert.deepEqual(record.wallpapers,['sky']);
 }finally{f.cleanup();}
});
test('来源文件有提交外修改时，同步拒绝且不写入目标',async()=>{
 const {syncV3Engine}=await import('../scripts/sync-v3-engine.mjs'),f=fixture();
 try{
  f.put('web/public/'+f.assetRoot+'tiles-v001/frame-0001.png','changed');
  await assert.rejects(syncV3Engine({...f,requestedRef:f.commit}),/提交|资源/);assert.equal(existsSync(join(f.root,'vendor')),false);assert.equal(existsSync(join(f.root,'content')),false);
 }finally{f.cleanup();}
});
test('即使 Git 已提交，不匹配原序列的分块也不能进入桌面包',async()=>{
 const {syncV3Engine}=await import('../scripts/sync-v3-engine.mjs'),f=fixture();
 try{
  const path='web/public/'+f.assetRoot+'tiles-v001/manifest.json',manifest=JSON.parse(readFileSync(join(f.source,path)));
  manifest.frames[1].sourceSha256='0'.repeat(64);f.put(path,manifest);f.git(['add','.']);f.git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','broken patch']);f.commit=f.git(['rev-parse','HEAD']).toString().trim();
  await assert.rejects(syncV3Engine({...f,requestedRef:f.commit}),/source sequence mismatch/);assert.equal(existsSync(join(f.root,'content')),false);
 }finally{f.cleanup();}
});
