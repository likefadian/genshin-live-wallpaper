const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,readFileSync,writeFileSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {SettingsStore}=require('../electron/settings.cjs');
const {startAssetServer}=require('../electron/asset-server.cjs');

test('用户设置跨启动保存，无效修改不覆盖已保存状态',()=>{
 const dir=mkdtempSync(join(tmpdir(),'genshinexe-settings-'));
 try{
  const file=join(dir,'settings.json'),store=new SettingsStore(file);
  store.update({exposure:.35,showClock:false,timeMode:'manual',minutes:390,motion:false});
  assert.equal(new SettingsStore(file).snapshot().settings.exposure,.35);
  assert.equal(new SettingsStore(file).snapshot().settings.showClock,false);
  const before=readFileSync(file,'utf8');
  assert.throws(()=>store.update({exposure:NaN}),/exposure/);
  assert.throws(()=>store.update({unknown:true}),/unknown/);
  assert.equal(readFileSync(file,'utf8'),before);
 }finally{rmSync(dir,{recursive:true});}
});
test('损坏设置字段保留其他有效设置，破损 JSON 可正常启动',()=>{
 const dir=mkdtempSync(join(tmpdir(),'genshinexe-corrupt-'));
 try{
  const file=join(dir,'settings.json');
  writeFileSync(file,JSON.stringify({schemaVersion:1,settings:{speed:'bad',exposure:.2,showClock:false}}));
  const snapshot=new SettingsStore(file).snapshot();
  assert.equal(snapshot.settings.speed,1);assert.equal(snapshot.settings.exposure,.2);assert.equal(snapshot.settings.showClock,false);
  writeFileSync(file,'{broken');assert.equal(new SettingsStore(file).snapshot().settings.motion,true);
 }finally{rmSync(dir,{recursive:true});}
});
test('昼夜预览模式使用持久化的锚点，不随无关控制修改重置',()=>{
 const dir=mkdtempSync(join(tmpdir(),'genshinexe-cycle-'));
 try{
  let now=1000;const store=new SettingsStore(join(dir,'settings.json'),()=>now);
  store.update({timeMode:'cycle',minutes:720});const anchor=store.snapshot().timeAnchor;
  now=5000;store.update({bloom:false});assert.equal(store.snapshot().timeAnchor,anchor);
  store.update({timeMode:'manual',minutes:390});assert.equal(store.snapshot().timeAnchor,5000);
 }finally{rmSync(dir,{recursive:true});}
});
test('本地服务返回真实文件，缺失和无效资源有明确错误且不暴露根目录之外文件',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'genshinexe-http-'));
 let server;
 try{
  writeFileSync(join(dir,'index.html'),'wallpaper');writeFileSync(join(dir,'manifest.json'),'{}');
  server=await startAssetServer(dir);
  const home=await fetch(server.url+'/');assert.equal(home.status,200);assert.equal(await home.text(),'wallpaper');
  assert.match((await fetch(server.url+'/manifest.json')).headers.get('content-type'),/application\/json/);
  assert.equal((await fetch(server.url+'/missing.png')).status,404);
  assert.equal((await fetch(server.url+'/%ZZ')).status,400);
  assert.equal((await fetch(server.url+'/%2e%2e%5csecret.txt')).status,403);
 }finally{if(server)await server.close();rmSync(dir,{recursive:true});}
});
