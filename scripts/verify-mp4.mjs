import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
const root=resolve(process.env.GENSHINEXE_VERIFY_PROJECT||join(import.meta.dirname,'..')),work=join(root,'work/mp4-wallpapers/e2e-'+Date.now()),profile=join(work,'profile'),queue=join(work,'dialogs.json'),port=9257;
const source=resolve(process.argv[2]||join(root,'work/mp4-wallpapers/fixture.mp4')),sourceHash=createHash('sha256').update(readFileSync(source)).digest('hex');
mkdirSync(work,{recursive:true});writeFileSync(queue,JSON.stringify({open:[],confirm:[]}));
const pause=ms=>new Promise(done=>setTimeout(done,ms)),checks=[];
let child,settings,wallpaper;
const record=name=>{checks.push(name);console.log('PASS '+name);};
function enqueue(key,value){const data=JSON.parse(readFileSync(queue,'utf8'));if(key==='bounds')data.bounds=value;else(data[key]??=[]).push(value);writeFileSync(queue,JSON.stringify(data));}
async function until(check,label,timeout=30000){const end=Date.now()+timeout;let value;while(Date.now()<end){value=await check();if(value)return value;await pause(100);}throw Error('等待超时：'+label);}
async function cdp(page){
 const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((done,fail)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',fail,{once:true});});
 let id=0;const requests=new Map();
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data),pending=requests.get(message.id);if(pending){requests.delete(message.id);clearTimeout(pending.timer);message.error?pending.fail(Error(message.error.message)):pending.done(message.result);}});
 socket.addEventListener('close',()=>{for(const item of requests.values()){clearTimeout(item.timer);item.fail(Error('目标窗口已关闭'));}requests.clear();});
 const call=(method,params={})=>new Promise((done,fail)=>{const current=++id,timer=setTimeout(()=>{requests.delete(current);fail(Error('调试调用超时：'+method));},20000);requests.set(current,{done,fail,timer});socket.send(JSON.stringify({id:current,method,params}));});
 return {call,close:()=>socket.close(),async eval(expression){const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);return response.result.value;}};
}
async function target(kind){return until(async()=>{try{const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();const page=pages.find(p=>kind==='settings'?p.url.endsWith('/settings/index.html'):p.url.startsWith('http://127.0.0.1:'));return page?cdp(page):false;}catch{return false;}},kind+'窗口');}
async function launch(){
 child=spawn(join(root,'node_modules/electron/dist/electron.exe'),[join(root,'scripts/verify-mp4-app.cjs'),'--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1'],{cwd:root,windowsHide:true,env:{...process.env,GENSHINEXE_PROFILE:profile,GENSHINEXE_TEST_DIALOG_QUEUE:queue},stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',data=>writeFileSync(join(work,'electron-last.log'),data));settings=await target('settings');
 await until(()=>settings.eval('Boolean(window.genshinDesktop)'), '桌面桥接');
}
const state=()=>settings.eval('window.genshinDesktop.getState()');
async function applied(id){return until(async()=>{const s=await state();if(s.renderError)throw Error(s.renderError);return s.settings.wallpaperId===id&&s.appliedRevision===s.revision&&s.telemetry?.wallpaperId===id?s:false;},'壁纸应用 '+id);}
const api=(method,...args)=>settings.eval('window.genshinDesktop.'+method+'('+args.map(value=>JSON.stringify(value)).join(',')+')');
async function capture(client,name){const shot=await client.call('Page.captureScreenshot',{format:'png'});writeFileSync(join(work,name+'.png'),Buffer.from(shot.data,'base64'));}
async function stop(){
 try{if(settings)await api('quit');}catch{}settings?.close();wallpaper?.close();settings=wallpaper=null;
 if(child&&child.exitCode===null){await Promise.race([new Promise(done=>child.once('exit',done)),pause(5000)]);if(child.exitCode===null)child.kill();}
}
async function runScript(name,args=[]){
 const command=spawn(process.execPath,[join(root,'scripts',name),...args],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const pipe of [command.stdout,command.stderr])pipe.on('data',data=>output+=data);
 await new Promise((done,fail)=>{command.once('error',fail);command.once('exit',code=>code===0?done():fail(Error(name+' 失败：'+output)));});
}
try{
 await launch();assert.equal(await settings.eval('typeof window.genshinDesktop.importWallpaper'),'function','设置窗口需要 MP4 导入接口');
 await applied('xiao-liyue-full');record('内置场景启动');
 let before=await state();assert.equal((await api('importWallpaper')).libraryBusy,false);assert.equal((await state()).catalog.wallpapers.length,before.catalog.wallpapers.length);record('取消导入不改变壁纸库');
 let calls=JSON.parse(readFileSync(queue,'utf8')).calls.open;
 await settings.eval('document.getElementById("import-wallpaper").click();document.getElementById("import-wallpaper").click()');
 await until(()=>JSON.parse(readFileSync(queue,'utf8')).calls.open>calls,'导入按钮');await pause(350);
 assert.equal(JSON.parse(readFileSync(queue,'utf8')).calls.open,calls+1);record('重复点击只打开一次导入对话框');
 const concurrent=await settings.eval('Promise.allSettled([window.genshinDesktop.importWallpaper(),window.genshinDesktop.importWallpaper()]).then(results=>results.map(result=>result.status))');assert.deepEqual(concurrent.sort(),['fulfilled','rejected']);record('主进程拒绝并发导入');
 await assert.rejects(()=>api('updateSettings',{wallpaperId:'xiao-liyue-full'}),/壁纸库/);record('普通设置接口不能绕过壁纸选择验证');
 enqueue('open',{canceled:false,filePaths:[join(root,'work/mp4-wallpapers/broken.mp4')]});await api('importWallpaper');assert.equal((await state()).importStatus.status,'error');assert.equal((await state()).settings.wallpaperId,'xiao-liyue-full');record('损坏 MP4 拒绝且当前壁纸保留');
 enqueue('open',{canceled:false,filePaths:[source]});await api('importWallpaper');
 let s=await state(),local=s.catalog.wallpapers.find(item=>item.source==='local');assert.ok(local);assert.equal(s.settings.wallpaperId,'xiao-liyue-full');assert.ok(local.duration>0);record('实际导入与缩略图登记');
 await api('selectWallpaper',local.id);await applied(local.id);wallpaper=await target('wallpaper');
 let video=await wallpaper.eval('({count:document.querySelectorAll("video").length,canvas:document.querySelectorAll("canvas").length,muted:document.querySelector("video").muted,time:document.querySelector("video").currentTime})');
 assert.equal(video.count,1);assert.equal(video.canvas,0);assert.equal(video.muted,true);await pause(700);assert.ok(await wallpaper.eval('document.querySelector("video").currentTime')>video.time+.2);record('桌面视频前进且未保留场景画布');
 await api('updateSettings',{motion:false,fit:'contain',videoVolume:.35,speed:1.2,showClock:false});await applied(local.id);
 video=await wallpaper.eval('({paused:document.querySelector("video").paused,volume:document.querySelector("video").volume,fit:document.querySelector("video").style.objectFit,speed:document.querySelector("video").playbackRate,clock:document.getElementById("wallpaper-clock").hidden,time:document.querySelector("video").currentTime})');
 assert.equal(video.paused,true);assert.equal(video.volume,.35);assert.equal(video.fit,'contain');assert.equal(video.speed,1.2);assert.equal(video.clock,true);await pause(250);assert.ok(Math.abs(await wallpaper.eval('document.querySelector("video").currentTime')-video.time)<.04);record('暂停、音量、比例、速度和时钟同步');
 await api('resetSettings');s=await applied(local.id);assert.equal(s.settings.videoVolume,0);assert.equal(s.settings.wallpaperId,local.id);record('恢复控制默认值保留所选视频');
 await api('selectWallpaper','xiao-liyue-full');await api('selectWallpaper',local.id);await api('updateSettings',{videoVolume:.35});await applied(local.id);await pause(500);assert.equal(await wallpaper.eval('document.querySelectorAll("canvas").length'),0);record('快速切换和加载中改设置保留最后选择');
 await wallpaper.eval(`(()=>{
  const probe=window.__mp4SceneProbe={started:false,aborted:false,contexts:[]},originalFetch=window.fetch,originalContext=HTMLCanvasElement.prototype.getContext;
  window.fetch=(input,options)=>{
   if(!probe.started&&String(input).endsWith('/manifest.json')){
    probe.started=true;
    return new Promise((resolve,reject)=>{
     const abort=()=>{probe.aborted=true;reject(new DOMException('验收中取消','AbortError'));};options.signal.addEventListener('abort',abort,{once:true});
     probe.release=()=>{options.signal.removeEventListener('abort',abort);originalFetch(input,options).then(resolve,reject);};
    });
   }
   return originalFetch(input,options);
  };
  HTMLCanvasElement.prototype.getContext=function(type,...args){const result=originalContext.call(this,type,...args);if(type==='webgl2'&&result&&!probe.contexts.includes(result))probe.contexts.push(result);return result;};
  probe.restore=()=>{window.fetch=originalFetch;HTMLCanvasElement.prototype.getContext=originalContext;if(!probe.aborted)probe.release?.();};
 })()`);
 try{
  await api('selectWallpaper','xiao-liyue-full');await until(()=>wallpaper.eval('window.__mp4SceneProbe.started'),'场景初始化读取');
  await api('selectWallpaper',local.id);await applied(local.id);
  const released=await wallpaper.eval('({aborted:window.__mp4SceneProbe.aborted,count:window.__mp4SceneProbe.contexts.length,lost:window.__mp4SceneProbe.contexts.every(context=>context.isContextLost())})');
  assert.equal(released.aborted,true);assert.ok(released.count>0);assert.equal(released.lost,true);record('初始化中切换立即取消实际读取并释放 WebGL 上下文');
 }finally{await wallpaper.eval('window.__mp4SceneProbe.restore()');}
 await wallpaper.eval('document.querySelector("video").currentTime=document.querySelector("video").duration-.2');await pause(1200);assert.ok(await wallpaper.eval('document.querySelector("video").currentTime')<4);record('视频尾部循环播放');
 assert.equal(await settings.eval('document.querySelectorAll("canvas,video").length'),0);assert.equal(await settings.eval('document.querySelector("[data-tab=light]").hidden'),true);
 assert.ok(await settings.eval('document.getElementById("portrait").naturalWidth>0'));await capture(settings,'library-800');await capture(wallpaper,'wallpaper-video');
 enqueue('bounds',{width:740,height:650});await pause(300);assert.ok(await settings.eval('document.body.scrollWidth<=innerWidth'));await capture(settings,'library-740');record('静态壁纸库与最小窗口布局');
 await stop();await launch();s=await applied(local.id);assert.equal(s.settings.videoVolume,.35);wallpaper=await target('wallpaper');assert.equal(await wallpaper.eval('document.querySelectorAll("canvas").length'),0);record('重启保存选择和视频控制');
 const runningTime=await wallpaper.eval('document.querySelector("video").currentTime');await settings.eval('setTimeout(()=>window.close(),0)');settings.close();settings=null;await pause(600);
 assert.ok(await wallpaper.eval('document.querySelector("video").currentTime')>runningTime+.2);
 const second=spawn(join(root,'node_modules/electron/dist/electron.exe'),[join(root,'scripts/verify-mp4-app.cjs')],{cwd:root,windowsHide:true,env:{...process.env,GENSHINEXE_PROFILE:profile,GENSHINEXE_TEST_DIALOG_QUEUE:queue},stdio:'ignore'});await new Promise(done=>second.once('exit',done));settings=await target('settings');await applied(local.id);record('关闭设置继续播放，再次打开保持选择');
 if(process.env.GENSHINEXE_VERIFY_OFFICIAL==='1'){
  const manifest=join(root,'content/official-videos/catalog.json'),first=JSON.parse(readFileSync(manifest,'utf8')).wallpapers[0];assert.ok(first);
  await stop();await runScript('import-official-video.mjs',['--file',source,'--id','delivery-two','--name','构建验收二']);await runScript('prepare-web.mjs');await launch();s=await applied(local.id);
  assert.equal(s.catalog.wallpapers.filter(item=>item.kind==='video'&&item.source==='official').length,2);assert.ok(s.catalog.wallpapers.some(item=>item.id===local.id));record('新版新增官方视频同时保留本地视频和选择');
  await api('selectWallpaper',first.id);s=await applied(first.id);assert.equal(s.telemetry.kind,'video');await assert.rejects(()=>api('removeWallpaper',first.id),/本地/);record('官方视频可播放且不可通过本地移除入口删除');
  await stop();const catalog=JSON.parse(readFileSync(manifest,'utf8'));catalog.wallpapers=catalog.wallpapers.filter(item=>item.id!==first.id);writeFileSync(manifest,JSON.stringify(catalog));await runScript('prepare-web.mjs');
  await launch();s=await applied('xiao-liyue-full');assert.ok(s.libraryWarnings.length);assert.ok(s.catalog.wallpapers.some(item=>item.id===local.id));record('新版移除当前官方视频时回退并保留本地作品');
 }
 const media=join(profile,'wallpapers/local',local.id,'video.mp4');assert.ok(relative(work,media)&&!relative(work,media).startsWith('..'));
 await api('selectWallpaper',local.id);await applied(local.id);wallpaper??=await target('wallpaper');renameSync(media,media+'.missing');
 try{
  await wallpaper.eval('document.querySelector("video").dispatchEvent(new Event("error"))');
  s=await until(async()=>{const value=await state();return value.wallpaperStatus==='error'||value.settings.wallpaperId==='xiao-liyue-full'?value:false;},'运行中缺失文件错误');
  assert.equal(s.settings.wallpaperId,'xiao-liyue-full');await applied('xiao-liyue-full');assert.ok(s.libraryWarnings.length);record('运行中文件丢失的有效播放错误触发回退');
 }finally{renameSync(media+'.missing',media);}
 await api('selectWallpaper',local.id);await applied(local.id);await stop();renameSync(media,media+'.missing');
 await launch();s=await applied('xiao-liyue-full');assert.ok(s.libraryWarnings.length);record('缺失文件回退内置场景');renameSync(media+'.missing',media);
 await api('selectWallpaper',local.id);await applied(local.id);enqueue('confirm',{response:1});assert.equal((await api('removeWallpaper',local.id)).libraryBusy,false);assert.equal((await state()).settings.wallpaperId,local.id);record('取消移除保留所选视频');
 enqueue('confirm',{response:0});await api('removeWallpaper',local.id);s=await applied('xiao-liyue-full');assert.ok(!s.catalog.wallpapers.some(item=>item.id===local.id));assert.ok(!existsSync(media));record('移除当前视频后切回内置场景');
 assert.equal(createHash('sha256').update(readFileSync(source)).digest('hex'),sourceHash);record('原始 MP4 哈希保持不变');
 writeFileSync(join(work,'results.json'),JSON.stringify({source,profile,checks},null,2));console.log('验收结果：'+work);
}catch(error){console.error(error.stack);writeFileSync(join(work,'failure.txt'),String(error.stack));process.exitCode=1;}finally{await stop();}
