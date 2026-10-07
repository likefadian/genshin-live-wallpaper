import {registry,defaultWallpaperId} from '../vendor/v3/web/src/wallpapers/registry.ts';
import {WallpaperRuntime} from '../vendor/v3/web/src/render/wallpaper-runtime.ts';
import {createWallpaperClock} from '../vendor/v3/web/src/ui/wallpaper-clock.ts';

const bridge=window.genshinDesktop,host=document.getElementById('stage'),status=document.getElementById('status');
const selected=registry.get(defaultWallpaperId);
const clock=createWallpaperClock(document.getElementById('wallpaper-clock'),document.getElementById('clock-time'),document.getElementById('clock-date'),document.getElementById('clock-year'));
let runtime,timer,telemetryTimer,unsubscribe,lastTimeKey='',currentRevision=-1,disposed=false;
function diagnostic(error){status.hidden=false;status.textContent='壁纸加载失败：'+String(error);bridge?.reportError(String(error));}
function apply(snapshot){
 if(!runtime||disposed)return;
 const s=snapshot.settings;currentRevision=snapshot.revision;
 runtime.setPaused(!s.motion);runtime.setPlaybackRate(s.speed);runtime.setParticles(s.particles);
 runtime.setExposureEV(s.exposure);runtime.setLightStrength(s.light);runtime.setShadowStrength(s.shadow);
 for(const key of ['lamps','rim','wind','bloom','grade'])runtime.setEnhancement(key,s[key]);
 clock.setVisible(s.showClock);host.dataset.fit=s.fit;
 if(runtime.snapshot().renderSize[0]!==runtime.wallpaper.preview[2]*s.quality)runtime.setQuality(s.quality);
 const timeKey=s.timeMode+':'+s.minutes+':'+snapshot.timeAnchor;
 if(timeKey!==lastTimeKey){
  lastTimeKey=timeKey;clearInterval(timer);runtime.lightingAutomatic=s.timeMode==='cycle';
  if(s.timeMode==='local'){
   const follow=()=>{const now=new Date();runtime.setTime(now.getHours()*60+now.getMinutes()+now.getSeconds()/60);};
   follow();timer=setInterval(follow,1000);
  }else{
   const elapsed=s.timeMode==='cycle'?Math.max(0,Date.now()-snapshot.timeAnchor)/1000*runtime.scenePackage.controls.previewMinutesPerSecond:0;
   runtime.setTime((s.minutes+elapsed)%1440);
  }
 }
 status.hidden=true;
 bridge.reportApplied({revision:currentRevision,...runtime.snapshot()});
}
try{
 if(!bridge)throw Error('桌面宿主接口不可用');
 if(!selected)throw Error('默认壁纸组合未注册');
 // A single rendering runtime. The settings page never imports this module.
 runtime=await WallpaperRuntime.create(host,selected.character,selected.scene,selected.wallpaper);
 host.style.setProperty('--focus',(selected.wallpaper.presentation?.focus??[.5,.5]).map(v=>v*100+'%').join(' '));
 unsubscribe=bridge.onState(apply);
 apply(await bridge.getState());
 runtime.onFrame=(_now,snapshot)=>{if(snapshot.loadError)diagnostic(snapshot.loadError);};
 telemetryTimer=setInterval(()=>{if(!disposed)bridge.reportApplied({revision:currentRevision,...runtime.snapshot()});},2000);
}catch(error){diagnostic(error);}
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);clearInterval(telemetryTimer);unsubscribe?.();clock.destroy();runtime?.destroy();});
