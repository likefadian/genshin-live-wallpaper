import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(import.meta.dirname,'..'),work=join(root,'work/web-scenes-'+Date.now());mkdirSync(work,{recursive:true});
const packaged=process.env.GENSHINEXE_VERIFY_EXE,profile=process.env.GENSHINEXE_VERIFY_PROFILE||join(work,'profile'),queue=join(work,'dialogs.json'),port=9258;
const output=packaged?join(dirname(packaged),'resources/wallpaper'):join(root,'web'),sky='extra-sky-sunflower-afternoon',xiao='xiao-liyue-full';
const checks=[],pause=ms=>new Promise(done=>setTimeout(done,ms));let child,settings,wallpaper;
writeFileSync(queue,JSON.stringify({open:[],confirm:[]}));
const record=name=>{checks.push(name);console.log('PASS '+name);};
async function until(check,label,timeout=45000){const end=Date.now()+timeout;while(Date.now()<end){const value=await check();if(value)return value;await pause(100);}throw Error('等待超时：'+label);}
async function cdp(page){
 const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((done,fail)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',fail,{once:true});});
 let id=0;const pending=new Map(),events=[];
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method){events.push(message);return;}const request=pending.get(message.id);if(request){pending.delete(message.id);clearTimeout(request.timer);message.error?request.fail(Error(message.error.message)):request.done(message.result);}});
 socket.addEventListener('close',()=>{for(const request of pending.values()){clearTimeout(request.timer);request.fail(Error('调试窗口已关闭'));}pending.clear();});
 const call=(method,params={})=>new Promise((done,fail)=>{const current=++id,timer=setTimeout(()=>{pending.delete(current);fail(Error('调试调用超时：'+method));},25000);pending.set(current,{done,fail,timer});socket.send(JSON.stringify({id:current,method,params}));});
 return {call,events,close:()=>socket.close(),async eval(expression){const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}};
}
async function target(kind){return until(async()=>{try{const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),page=pages.find(p=>kind==='settings'?p.url.endsWith('/settings/index.html'):p.url.startsWith('http://127.0.0.1:'));return page?cdp(page):false;}catch{return false;}},kind+'窗口');}
async function launch(){
 const exe=packaged||join(root,'node_modules/electron/dist/electron.exe'),args=[...packaged?[]:[join(root,'scripts/verify-mp4-app.cjs')],'--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1'];
 child=spawn(exe,args,{cwd:packaged?'C:/Windows/Temp':root,windowsHide:true,env:{...process.env,GENSHINEXE_PROFILE:profile,GENSHINEXE_TEST_DIALOG_QUEUE:queue},stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',data=>writeFileSync(join(work,'electron-last.log'),data,{flag:'a'}));settings=await target('settings');await until(()=>settings.eval('Boolean(window.genshinDesktop)'),'桥接接口');wallpaper=await target('wallpaper');
}
const api=(method,...args)=>settings.eval('window.genshinDesktop.'+method+'('+args.map(value=>JSON.stringify(value)).join(',')+')');
const state=()=>api('getState');
async function applied(id){return until(async()=>{const s=await state();if(s.renderError)throw Error(s.renderError);return s.settings.wallpaperId===id&&s.appliedRevision===s.revision&&s.telemetry?.wallpaperId===id?s:false;},'应用 '+id);}
async function capture(client,name){const shot=await client.call('Page.captureScreenshot',{format:'png'});writeFileSync(join(work,name+'.png'),Buffer.from(shot.data,'base64'));}
async function stop(){
 try{if(settings)await api('quit');}catch{}settings?.close();wallpaper?.close();settings=wallpaper=null;
 if(child&&child.exitCode===null){await Promise.race([new Promise(done=>child.once('exit',done)),pause(5000)]);if(child.exitCode===null)child.kill();}
}
try{
 // Check the actual delivery tree, including every independently decoded PNG.
 const {registry}=await import(pathToFileURL(join(root,'.cache/catalog.mjs')).href),omitted=new Set();
 for(const {character,wallpaper} of registry.values())if(wallpaper.presentation?.selectable&&character.framePatches)for(let i=1;i<character.frameCount;i++)omitted.add(character.assetRoot+character.pattern.replace('{frame:04}',String(i).padStart(4,'0')));
 const source=JSON.parse(readFileSync(join(root,'content/engine-update.json')));let verified=0;
 for(const asset of source.assets){const path=asset.path.replace(/^content\//,''),file=join(output,path);if(omitted.has(path)){assert.equal(existsSync(file),false);continue;}assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),asset.sha256,path);verified++;}
 assert.equal(source.sourceCommit,'ada791d53a07e02e5d53c0dd3e022eace5534505');record(verified+' 个交付资源哈希与已确认来源一致，完整序列仅保留基础帧');
 assert.equal(existsSync(join(output,'assets/extra/sky/sunflower-afternoon/full-v001')),false);record('未携带旧候选场景');
 await launch();let s=await state();if(packaged)assert.equal(s.version,'0.1.5');assert.equal(s.packaged,Boolean(packaged));
 await api('selectWallpaper',xiao);s=await applied(xiao);assert.equal(s.catalog.wallpapers.filter(entry=>entry.source==='official').length,2);assert.equal(s.catalog.contentVersion,'v3-ada791d');assert.equal(s.desktopStatus,'attached');record('两个官方网页场景进入桌面壁纸库并成功挂载');
 const presets=await settings.eval('Array.from(document.getElementById("presets").children,button=>button.textContent)');assert.ok(presets.length>1);
 let local=s.catalog.wallpapers.find(entry=>entry.source==='local');
 if(!local){
  assert.ok(!packaged,'安装版检查复用开发验收中已保存的 MP4');const dialogs=JSON.parse(readFileSync(queue));dialogs.open.push({canceled:false,filePaths:[join(root,'work/mp4-wallpapers/fixture.mp4')]});writeFileSync(queue,JSON.stringify(dialogs));
  await api('importWallpaper');local=(await state()).catalog.wallpapers.find(entry=>entry.source==='local');assert.ok(local);
 }
 await api('selectWallpaper',local.id);await applied(local.id);assert.equal(await wallpaper.eval('document.querySelectorAll("video").length'),1);record('本地 MP4 仍可播放');
 await api('updateSettings',{timeMode:'cycle',minutes:1320,exposure:0,light:1.3,shadow:.8,motion:true,speed:1,showClock:false,quality:1});
 await wallpaper.call('Network.enable');await api('selectWallpaper',sky);s=await applied(sky);
 assert.equal(s.telemetry.lightingMinutes,720);assert.equal(s.settings.minutes,1320);assert.equal(s.settings.timeMode,'cycle');assert.equal(s.telemetry.cacheCapacity,18);assert.equal(s.telemetry.prefetchFrames,14);assert.equal(s.telemetry.frameTransport,'tiles');assert.equal(await wallpaper.eval('document.querySelectorAll("canvas").length'),1);assert.equal(await wallpaper.eval('document.querySelectorAll("video").length'),0);record('光遇固定午后、18 帧分块缓存及互斥播放器');
 await settings.eval('document.querySelector("[data-tab=light]").click()');
 assert.equal(await settings.eval('Array.from(document.querySelectorAll("[data-capability]")).every(node=>node.hidden)'),true);assert.equal(await settings.eval('document.getElementById("exposure").checkVisibility()'),true);assert.equal(await settings.eval('document.getElementById("character-name").textContent'),'光遇');assert.equal(await settings.eval('document.getElementById("character-tagline").textContent.includes("璃月")'),false);
 await capture(settings,'sky-brightness');await settings.eval('document.querySelector("[data-tab=motion]").click()');await capture(settings,'sky-motion');await settings.eval('document.querySelector("[data-tab=library]").click()');await until(()=>settings.eval('Array.from(document.querySelectorAll("#official-wallpapers img")).every(image=>image.complete&&image.naturalWidth>0)'),'官方缩略图');await capture(settings,'official-library');record('固定场景仅显示有效控制，侧栏及官方缩略图正常');
 await pause(2000);const samples=[],start=(await state()).telemetry,started=Date.now();
 while(Date.now()-started<14500){await pause(500);s=await state();assert.equal(s.renderError,'');assert.equal(s.telemetry.lightingMinutes,720);samples.push({at:Date.now(),...s.telemetry});}
 const first=samples[0],end=samples.at(-1),fps=(end.renderCount-first.renderCount)/(end.animationSeconds-first.animationSeconds),wrapped=samples.some((item,i)=>i&&item.frame<samples[i-1].frame);
 assert.ok(wrapped,'观察到实际循环回起点');assert.ok(fps>20,'当前设备持续播放帧率过低：'+fps);assert.ok(end.frame!==start.frame);
 const requested=new Set(wallpaper.events.filter(event=>event.method==='Network.requestWillBeSent').map(event=>event.params.request.url).filter(url=>url.includes('/warm-sun-v001/tiles-v001/frame-')));
 assert.equal(requested.size,360,'循环覆盖全部 360 个独立分块');assert.ok(!wallpaper.events.some(event=>event.method==='Network.responseReceived'&&event.params.response.status>=400));
 writeFileSync(join(work,'playback-samples.json'),JSON.stringify({fps,heldFramesDelta:end.heldFrames-first.heldFrames,samples},null,2));record('360 帧实际读取、12 秒循环及持续播放（'+fps.toFixed(2)+' fps）');
 await api('updateSettings',{motion:false});s=await applied(sky);const seconds=s.telemetry.animationSeconds;
 // Applying pause can precede the last queued paint. The clock must stop at once;
 // compare displayed frames after that paint and across a fresh telemetry interval.
 await pause(2200);s=await state();assert.equal(s.telemetry.animationSeconds,seconds);const frame=s.telemetry.frame;
 await pause(2200);s=await state();assert.equal(s.telemetry.frame,frame);assert.equal(s.telemetry.animationSeconds,seconds);await capture(wallpaper,'sky-wallpaper');record('固定场景暂停');
 for(const timeMode of ['manual','local','cycle']){await api('updateSettings',{timeMode,minutes:1320,exposure:.2});s=await applied(sky);assert.equal(s.telemetry.lightingMinutes,720);assert.equal(s.settings.timeMode,timeMode);}
 record('三种全局时间模式均保留固定午后和用户设置');
 await stop();await launch();s=await applied(sky);assert.equal(s.settings.minutes,1320);assert.equal(s.settings.timeMode,'cycle');assert.ok(s.catalog.wallpapers.some(entry=>entry.id===local.id));assert.equal(s.telemetry.lightingMinutes,720);record('退出重启保留光遇、本地 MP4 和原昼夜锚点');
 await api('selectWallpaper',xiao);s=await applied(xiao);assert.ok(s.telemetry.lightingMinutes>1300);assert.equal(await settings.eval('Array.from(document.querySelectorAll("[data-capability]")).every(node=>!node.hidden)'),true);assert.deepEqual(await settings.eval('Array.from(document.getElementById("presets").children,button=>button.textContent)'),presets);record('切回魈恢复实时昼夜控制和对应预设');
 await api('selectWallpaper',sky);await api('selectWallpaper',local.id);await applied(local.id);assert.equal(await wallpaper.eval('document.querySelectorAll("canvas").length'),0);assert.equal(await settings.eval('document.querySelector("[data-tab=light]").hidden'),true);record('快速跨场景及视频切换保持最后选择');
 await api('selectWallpaper',sky);await api('updateSettings',{motion:true,speed:1,exposure:0});await applied(sky);await capture(settings,'final-library');
 writeFileSync(join(work,'results.json'),JSON.stringify({profile,packaged:packaged||false,sourceCommit:source.sourceCommit,checks,final:await state()},null,2));console.log('验收结果：'+work);
}catch(error){console.error(error.stack);writeFileSync(join(work,'failure.txt'),String(error.stack));process.exitCode=1;}finally{await stop();}
