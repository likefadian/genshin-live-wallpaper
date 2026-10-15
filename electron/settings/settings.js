const api=window.genshinDesktop,$=id=>document.getElementById(id);
let state,pending={},timer,chain=Promise.resolve(),presetsReady=false,libraryKey='',actionError='',libraryActionPending=false;
const titles={library:['壁纸库','挑选一处风景，或导入你收藏的 MP4 动态壁纸。'],light:['光影与时间','从晨光到夜色，让璃月与你的时间相遇。'],motion:['动效与画面','留住一阵风，也可以安静地看一会儿。'],app:['软件设置','设置随你保存，风景随 Windows 启动。']};
const formatTime=minutes=>String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(Math.floor(minutes%60)).padStart(2,'0');
function fail(error){actionError=String(error.message||error).replace(/^Error invoking remote method '[^']+': Error: /,'');$('error').hidden=false;$('error').textContent=actionError;$('save-status').textContent='操作未完成，请重试';}
function display(snapshot){
 if(state&&snapshot.revision<state.revision)return;
 state=snapshot;const s=state.settings,scene=state.catalog.wallpapers.find(item=>item.id===state.catalog.defaultWallpaperId),content=state.catalog.wallpapers.find(item=>item.id===s.wallpaperId)||scene,video=content.kind==='video';
 $('version').textContent='v'+state.version+' · 本地版';$('character-name').textContent=content.name;$('scene-name').textContent=video?content.author:content.sceneName;
 $('character-tagline').textContent=video?'此刻的桌面':'守护璃月的风';$('character-card').classList.toggle('video-character',video);
 const portraitUrl=new URL(content.thumbnail,state.serverUrl+'/').href;if($('portrait').src!==portraitUrl)$('portrait').src=portraitUrl;
 $('portrait').alt=content.name;
 $('content-version').textContent=content.name+' · '+state.catalog.contentVersion;
 document.querySelector('[data-tab=light]').hidden=video;
 for(const item of document.querySelectorAll('.scene-only'))item.hidden=video;
 for(const item of document.querySelectorAll('.video-only'))item.hidden=!video;
 if(video&&document.querySelector('[data-tab=light]').classList.contains('active'))activateTab(document.querySelector('[data-tab=library]'));
 displayLibrary();
 displayUpdate(state.update);
 if(!presetsReady){
  for(const preset of scene.controls.presets){const button=document.createElement('button');button.textContent=preset.name;button.dataset.minutes=preset.minutes;button.onclick=()=>queue({timeMode:'manual',minutes:preset.minutes},true);$('presets').append(button);}
  presetsReady=true;
 }
 for(const key of ['minutes','exposure','light','shadow','speed','videoVolume','timeMode','fit','quality']){
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
 const error=state.desktopError||state.renderError||actionError;$('error').hidden=!error;if(error)$('error').textContent=error;
 if(Object.keys(pending).length===0)$('save-status').textContent=state.appliedRevision===state.revision?'设置已保存 · 已应用到桌面':'设置已保存 · 等待壁纸同步';
}
function labels(s){$('exposure-label').textContent=(s.exposure>0?'+':'')+s.exposure.toFixed(2)+' EV';$('light-label').textContent=Math.round(s.light*100)+'%';$('shadow-label').textContent=Math.round(s.shadow*100)+'%';$('speed-label').textContent=s.speed.toFixed(1)+'×';$('videoVolume-label').textContent=s.videoVolume?Math.round(s.videoVolume*100)+'%':'静音';}
function libraryAction(method,id){
 if(libraryActionPending||state.libraryBusy)return;
 libraryActionPending=true;actionError='';displayLibrary();flush();
 chain=chain.then(()=>api[method](...(id?[id]:[]))).then(display).catch(fail).finally(()=>{libraryActionPending=false;displayLibrary();});
}
function displayLibrary(){
 const key=JSON.stringify([state.serverUrl,state.settings.wallpaperId,state.catalog.wallpapers]);
 if(libraryKey!==key){
  libraryKey=key;$('official-wallpapers').replaceChildren();$('local-wallpapers').replaceChildren();
  for(const entry of state.catalog.wallpapers){
   const current=entry.id===state.settings.wallpaperId,card=document.createElement('article');card.className='wallpaper-card'+(current?' current':'');card.setAttribute('aria-current',String(current));
   const picture=document.createElement('div');picture.className='wallpaper-picture';const image=document.createElement('img');image.src=new URL(entry.thumbnail,state.serverUrl+'/').href;image.alt='';image.loading='lazy';picture.append(image);
   const badge=document.createElement('span');badge.className='wallpaper-kind';badge.textContent=entry.kind==='video'?'MP4 视频':'实时场景';picture.append(badge);
   const body=document.createElement('div');body.className='wallpaper-body';const name=document.createElement('h3');name.textContent=entry.name;name.title=entry.name;body.append(name);
   const author=document.createElement('p');author.className='wallpaper-author';author.textContent=entry.author;body.append(author);
   const metadata=document.createElement('p');metadata.className='wallpaper-meta';metadata.textContent=entry.available===false?'视频文件缺失，请重新导入':entry.kind==='video'?entry.width+' × '+entry.height+' · '+Math.round(entry.duration)+' 秒 · '+(entry.size/1048576).toFixed(1)+' MB':entry.sceneName;body.append(metadata);
   const actions=document.createElement('div');actions.className='wallpaper-actions';const select=document.createElement('button');select.className='small-button';select.textContent=current?'✓ 正在使用':'使用壁纸';select.dataset.libraryAction='select';select.dataset.unavailable=String(current||entry.available===false);select.onclick=()=>libraryAction('selectWallpaper',entry.id);actions.append(select);
   if(entry.source==='local'){const remove=document.createElement('button');remove.className='text-button remove-wallpaper';remove.textContent='移除';remove.setAttribute('aria-label','移除 '+entry.name);remove.dataset.libraryAction='remove';remove.onclick=()=>libraryAction('removeWallpaper',entry.id);actions.append(remove);}
   body.append(actions);card.append(picture,body);$(entry.source==='local'?'local-wallpapers':'official-wallpapers').append(card);
  }
 }
 $('local-empty').hidden=state.catalog.wallpapers.some(entry=>entry.source==='local');$('official-count').textContent=state.catalog.wallpapers.filter(entry=>entry.source==='official').length+' 款';
 const importing=['choosing','importing'].includes(state.importStatus.status),busy=state.libraryBusy||libraryActionPending;$('import-wallpaper').disabled=busy;$('import-wallpaper').textContent=importing?'正在导入…':'＋ 导入 MP4';
 for(const button of document.querySelectorAll('[data-library-action]'))button.disabled=busy||button.dataset.unavailable==='true';
 $('import-status').hidden=!state.importStatus.message;$('import-status').textContent=state.importStatus.message;$('import-status').classList.toggle('import-error',state.importStatus.status==='error');
 $('library-warning').hidden=!state.libraryWarnings.length;$('library-warning').textContent=state.libraryWarnings.join('\n');
}
function displayUpdate(update){
 if(!update)return;
 const status=update.status,busy=['checking','downloading','installing'].includes(status);
 const messages={idle:'尚未检查更新',disabled:'请在安装版中检查更新',checking:'正在检查更新…','no-release':'更新源尚无正式发布版本',current:'当前已是最新版本',available:'发现新版本 v'+update.availableVersion,downloading:'正在下载新版本…',downloaded:'下载完成，已通过校验',installing:'正在重启并安装…',error:'更新未完成，可重试'};
 $('update-state').textContent=messages[status]||'尚未检查更新';
 $('update-hint').textContent=status==='no-release'?'正式版本发布后，可在这里检查并下载安装。':status==='downloaded'?'安装期间壁纸会暂时关闭，设置会保留。':status==='error'?'壁纸继续运行，请检查网络后重试。':'当前 v'+update.currentVersion+' · 由你确认下载和安装';
 $('update-source').textContent=update.source.name+' · '+update.source.url;
 $('update-notes').hidden=!update.availableVersion;
 $('update-version').textContent='v'+update.availableVersion+' 更新说明';
 $('update-release-notes').textContent=update.releaseNotes||'此版本未提供更新说明。';
 $('update-check').disabled=busy||status==='disabled'||status==='downloaded';
 $('update-download').hidden=!(status==='available'||status==='downloading'||(status==='error'&&update.retry==='download'));
 $('update-download').disabled=busy;$('update-download').textContent=status==='error'?'重新下载':'下载新版本';
 $('update-install').hidden=!['downloaded','installing'].includes(status);$('update-install').disabled=busy;
 $('update-progress-area').hidden=!update.progress;
 if(update.progress){$('update-progress').value=update.progress.percent;$('update-progress-label').textContent=update.progress.percent.toFixed(1)+'% · '+(update.progress.transferred/1048576).toFixed(1)+' / '+(update.progress.total/1048576).toFixed(1)+' MiB';}
 $('update-error').hidden=!update.error;if(update.error)$('update-error').textContent=update.error;
}
function updateAction(method){$('update-error').hidden=true;api[method]().then(display).catch(error=>{$('update-error').textContent=String(error.message||error);$('update-error').hidden=false;});}
function queue(patch,immediate=false){
 actionError='';Object.assign(pending,patch);labels({...state.settings,...pending});$('save-status').textContent='正在保存…';clearTimeout(timer);
 if(immediate)flush();else timer=setTimeout(flush,100);
}
function flush(){
 if(!Object.keys(pending).length)return;
 const patch=pending;pending={};chain=chain.then(()=>api.updateSettings(patch)).then(display).catch(fail);
}
for(const key of ['minutes','exposure','light','shadow','speed','videoVolume']){
 $(key).oninput=()=>queue(key==='minutes'?{minutes:Number($(key).value),timeMode:'manual'}:{[key]:Number($(key).value)});
 $(key).onchange=flush;
}
for(const key of ['lamps','rim','bloom','grade','particles','wind','showClock'])$(key).onchange=()=>queue({[key]:$(key).checked},true);
for(const key of ['timeMode','fit','quality'])$(key).onchange=()=>queue({[key]:key==='quality'?Number($(key).value):$(key).value},true);
$('toggle-motion').onclick=()=>queue({motion:!state.settings.motion},true);
$('import-wallpaper').onclick=()=>libraryAction('importWallpaper');
$('openAtLogin').onchange=()=>api.setOpenAtLogin($('openAtLogin').checked).then(display).catch(fail);
$('reset').onclick=()=>{clearTimeout(timer);pending={};chain=chain.then(()=>api.resetSettings()).then(display).catch(fail);};
$('reconnect').onclick=()=>api.reconnect().catch(fail);$('logs').onclick=()=>api.openLogs().catch(fail);
$('quit').onclick=()=>{flush();chain.then(()=>api.quit()).catch(fail);};
$('update-check').onclick=()=>updateAction('checkUpdate');$('update-download').onclick=()=>updateAction('downloadUpdate');$('update-install').onclick=()=>{flush();chain.then(()=>updateAction('installUpdate'));};
function activateTab(tab){
 for(const item of document.querySelectorAll('[data-tab]')){const active=item===tab;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));$('panel-'+item.dataset.tab).hidden=!active;}
 [$('section-title').textContent,$('section-intro').textContent]=titles[tab.dataset.tab];
 window.scrollTo(0,0);
}
for(const tab of document.querySelectorAll('[data-tab]'))tab.onclick=()=>activateTab(tab);
window.addEventListener('beforeunload',flush);
api.onState(display);api.getState().then(display).catch(fail);
