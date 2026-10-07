const api=window.genshinDesktop,$=id=>document.getElementById(id);
let state,pending={},timer,chain=Promise.resolve(),presetsReady=false;
const titles={light:['光影与时间','从晨光到夜色，让璃月与你的时间相遇。'],motion:['动效与画面','留住一阵风，也可以安静地看一会儿。'],app:['软件设置','设置随你保存，风景随 Windows 启动。']};
const formatTime=minutes=>String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(Math.floor(minutes%60)).padStart(2,'0');
function fail(error){$('error').hidden=false;$('error').textContent=String(error.message||error);$('save-status').textContent='设置未保存，请重试';}
function display(snapshot){
 state=snapshot;const s=state.settings,content=state.catalog.wallpapers.find(item=>item.id===state.catalog.defaultWallpaperId);
 $('version').textContent='v'+state.version+' · 本地版';$('character-name').textContent=content.name;$('scene-name').textContent=content.sceneName;
 const portraitUrl=state.serverUrl+'/'+content.thumbnail;if($('portrait').src!==portraitUrl)$('portrait').src=portraitUrl;
 $('content-version').textContent=content.name+' / '+content.sceneName+' · '+state.catalog.contentVersion;
 if(!presetsReady){
  for(const preset of content.controls.presets){const button=document.createElement('button');button.textContent=preset.name;button.dataset.minutes=preset.minutes;button.onclick=()=>queue({timeMode:'manual',minutes:preset.minutes},true);$('presets').append(button);}
  presetsReady=true;
 }
 for(const key of ['minutes','exposure','light','shadow','speed','timeMode','fit','quality']){
  if(document.activeElement!==$(key)&&!Object.hasOwn(pending,key))$(key).value=String(s[key]);
 }
 for(const key of ['lamps','rim','bloom','grade','particles','wind','showClock'])$(key).checked=s[key];
 labels({...s,...pending});$('toggle-motion').textContent=s.motion?'暂停动画':'恢复动画';
 const minutes=state.telemetry?.lightingMinutes??s.minutes;
 $('time-label').textContent=formatTime(minutes);
 for(const button of $('presets').children)button.setAttribute('aria-pressed',String(s.timeMode==='manual'&&Math.abs(Number(button.dataset.minutes)-s.minutes)<1));
 $('openAtLogin').checked=state.openAtLogin;$('openAtLogin').disabled=!state.packaged;
 $('login-hint').textContent=state.packaged?'自动启动时只显示壁纸和托盘。':'安装版支持开机启动。';
 const text=state.desktopStatus==='error'?'桌面连接失败':state.desktopStatus==='connecting'?'正在连接':state.wallpaperStatus==='loading'?'正在加载':state.wallpaperStatus==='error'?'加载失败':state.wallpaperStatus==='paused'?'动画已暂停':'壁纸运行中';
 $('live-status').textContent=text;
 const error=state.desktopError||state.renderError;$('error').hidden=!error;if(error)$('error').textContent=error;
 if(Object.keys(pending).length===0)$('save-status').textContent=state.appliedRevision===state.revision?'设置已保存 · 已应用到桌面':'设置已保存 · 等待壁纸同步';
}
function labels(s){$('exposure-label').textContent=(s.exposure>0?'+':'')+s.exposure.toFixed(2)+' EV';$('light-label').textContent=Math.round(s.light*100)+'%';$('shadow-label').textContent=Math.round(s.shadow*100)+'%';$('speed-label').textContent=s.speed.toFixed(1)+'×';}
function queue(patch,immediate=false){
 Object.assign(pending,patch);labels({...state.settings,...pending});$('save-status').textContent='正在保存…';clearTimeout(timer);
 if(immediate)flush();else timer=setTimeout(flush,100);
}
function flush(){
 if(!Object.keys(pending).length)return;
 const patch=pending;pending={};chain=chain.then(()=>api.updateSettings(patch)).then(display).catch(fail);
}
for(const key of ['minutes','exposure','light','shadow','speed']){
 $(key).oninput=()=>queue(key==='minutes'?{minutes:Number($(key).value),timeMode:'manual'}:{[key]:Number($(key).value)});
 $(key).onchange=flush;
}
for(const key of ['lamps','rim','bloom','grade','particles','wind','showClock'])$(key).onchange=()=>queue({[key]:$(key).checked},true);
for(const key of ['timeMode','fit','quality'])$(key).onchange=()=>queue({[key]:key==='quality'?Number($(key).value):$(key).value},true);
$('toggle-motion').onclick=()=>queue({motion:!state.settings.motion},true);
$('openAtLogin').onchange=()=>api.setOpenAtLogin($('openAtLogin').checked).then(display).catch(fail);
$('reset').onclick=()=>{clearTimeout(timer);pending={};chain=chain.then(()=>api.resetSettings()).then(display).catch(fail);};
$('reconnect').onclick=()=>api.reconnect().catch(fail);$('logs').onclick=()=>api.openLogs().catch(fail);
$('quit').onclick=()=>{flush();chain.then(()=>api.quit()).catch(fail);};
for(const tab of document.querySelectorAll('[data-tab]'))tab.onclick=()=>{
 for(const item of document.querySelectorAll('[data-tab]')){const active=item===tab;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));$('panel-'+item.dataset.tab).hidden=!active;}
 [$('section-title').textContent,$('section-intro').textContent]=titles[tab.dataset.tab];
 window.scrollTo(0,0);
};
window.addEventListener('beforeunload',flush);
api.onState(display);api.getState().then(display).catch(fail);
