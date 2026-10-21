import {registry} from '../vendor/v3/web/src/wallpapers/registry.ts';
import {WallpaperRuntime} from '../vendor/v3/web/src/render/wallpaper-runtime.ts';
import {createWallpaperClock} from '../vendor/v3/web/src/ui/wallpaper-clock.ts';
import {createVideoRuntime} from './video-runtime.mjs';
import {createWallpaperController} from './wallpaper-controller.mjs';
import {createAbortableScene} from './scene-runtime.mjs';
import {resolveTimePolicy} from '../vendor/v3/web/src/ui/time-policy.ts';

const bridge=window.genshinDesktop,host=document.getElementById('stage'),status=document.getElementById('status');
const clock=createWallpaperClock(document.getElementById('wallpaper-clock'),document.getElementById('clock-time'),document.getElementById('clock-date'),document.getElementById('clock-year'));
let latest,disposed=false,unsubscribe,telemetryTimer;
function layer(){const element=document.createElement('div');element.className='wallpaper-layer';host.append(element);return element;}
async function createScene(entry,{onError,signal}){
 const selected=registry.get(entry.id);if(!selected)throw Error('壁纸场景未注册');
 const supports=key=>entry.capabilities?.[key]!==false;
 const container=layer();let runtime,timer,lastTimeKey='',closed=false;
 const destroy=()=>{if(closed)return;closed=true;clearInterval(timer);runtime?.destroy();container.remove();signal.removeEventListener('abort',destroy);};
 signal.addEventListener('abort',destroy,{once:true});
 try{
  runtime=await createAbortableScene(WallpaperRuntime,container,selected.character,selected.scene,selected.wallpaper,{signal});
  if(signal.aborted){runtime.destroy();throw new DOMException('已取消场景加载','AbortError');}
  host.style.setProperty('--focus',(selected.wallpaper.presentation?.focus??[.5,.5]).map(v=>v*100+'%').join(' '));
  runtime.onFrame=(_now,snapshot)=>{if(snapshot.loadError)onError(Error(snapshot.loadError));};
  return {
   apply(s){
    if(closed)return;
    runtime.setPaused(!s.motion);runtime.setPlaybackRate(s.speed);runtime.setParticles(supports('particles')&&s.particles);
    runtime.setExposureEV(s.exposure);runtime.setLightStrength(supports('light')?s.light:1);runtime.setShadowStrength(supports('shadow')?s.shadow:1);
    for(const key of ['lamps','rim','wind','bloom','grade'])runtime.setEnhancement(key,supports(key)&&s[key]);
    if(runtime.snapshot().renderSize[0]!==runtime.wallpaper.preview[2]*s.quality)runtime.setQuality(s.quality);
    const policy=resolveTimePolicy(runtime.scenePackage.controls,{minutes:s.minutes,local:s.timeMode==='local',automatic:s.timeMode==='cycle'});
    const timeKey=policy.canChangeTime?s.timeMode+':'+s.minutes+':'+s.timeAnchor:'fixed';
    if(timeKey!==lastTimeKey){
     lastTimeKey=timeKey;clearInterval(timer);runtime.lightingAutomatic=policy.automatic;
     if(policy.local){const follow=()=>{const now=new Date();runtime.setTime(now.getHours()*60+now.getMinutes()+now.getSeconds()/60);};follow();timer=setInterval(follow,1000);}
     else{const elapsed=policy.automatic?Math.max(0,Date.now()-s.timeAnchor)/1000*runtime.scenePackage.controls.previewMinutesPerSecond:0;runtime.setTime((policy.minutes+elapsed)%1440);}
    }
   },
   snapshot:()=>({wallpaperId:entry.id,kind:'scene',...runtime.snapshot()}),destroy,
  };
 }catch(error){destroy();throw error;}
}
function diagnostic(entry,error){
 if(disposed||entry.id!==latest?.settings.wallpaperId)return;
 status.hidden=false;status.textContent='壁纸加载失败：'+error.message;
 bridge.reportError({wallpaperId:entry.id,revision:latest.revision,message:error.message});
}
function report(){
 const current=controller.current;if(disposed||!current||current.entry.id!==latest?.settings.wallpaperId)return;
 bridge.reportApplied({...current.runtime.snapshot(),wallpaperId:current.entry.id,revision:latest.revision});
}
function applyCurrent(){
 const current=controller.current;if(disposed||!current||current.entry.id!==latest?.settings.wallpaperId)return;
 current.runtime.apply({...latest.settings,timeAnchor:latest.timeAnchor});status.hidden=true;report();
}
const controller=createWallpaperController({createScene,createVideo:async(entry,options)=>{
 const container=layer();const cleanup=()=>container.remove();options.signal.addEventListener('abort',cleanup,{once:true});
 try{const runtime=await createVideoRuntime(container,entry,options);const destroy=runtime.destroy;runtime.destroy=()=>{destroy();cleanup();options.signal.removeEventListener('abort',cleanup);};return runtime;}
 catch(error){cleanup();throw error;}
},onReady:applyCurrent,onError:diagnostic});
async function apply(snapshot){
 if(disposed)return;latest=snapshot;clock.setVisible(snapshot.settings.showClock);host.dataset.fit=snapshot.settings.fit;
 const entry=snapshot.catalog.wallpapers.find(item=>item.id===snapshot.settings.wallpaperId);
 if(!entry){diagnostic({id:snapshot.settings.wallpaperId},Error('找不到所选壁纸'));return;}
 if(controller.current?.entry.id!==entry.id){status.hidden=false;status.textContent='正在加载'+entry.name+'…';}
 await controller.select(entry);applyCurrent();
}
try{
 if(!bridge)throw Error('桌面宿主接口不可用');
 unsubscribe=bridge.onState(snapshot=>{apply(snapshot).catch(error=>diagnostic({id:snapshot.settings.wallpaperId},error));});
 await apply(await bridge.getState());telemetryTimer=setInterval(report,2000);
}catch(error){status.hidden=false;status.textContent='壁纸加载失败：'+error.message;}
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(telemetryTimer);unsubscribe?.();clock.destroy();controller.destroy();});
