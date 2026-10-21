const {app,BrowserWindow,Menu,Tray,nativeImage,screen,ipcMain,shell,dialog}=require('electron');
const {existsSync,mkdirSync,readFileSync,writeFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {SettingsStore,DEFAULT_SETTINGS}=require('./settings.cjs');
const {startAssetServer}=require('./asset-server.cjs');
const {attachDesktop,checkDesktop,nativeHandle}=require('./desktop-host.cjs');
const {createLog}=require('./runtime-log.cjs');
const {createUpdateController}=require('./update-controller.cjs');
const {resolveUpdateSource}=require('./update-source.cjs');
const {WallpaperLibrary,validateOfficialVideoCatalog}=require('./library.cjs');
const {probeVideo}=require('./video-probe.cjs');

app.setName('GenshinWallpaper');app.setAppUserModelId('com.genshinexe.wallpaper');
const userData=process.env.GENSHINEXE_PROFILE?resolve(process.env.GENSHINEXE_PROFILE):join(app.getPath('appData'),'GenshinEXE');
mkdirSync(userData,{recursive:true});app.setPath('userData',userData);
for(const flag of ['disable-renderer-backgrounding','disable-background-timer-throttling','disable-backgrounding-occluded-windows'])app.commandLine.appendSwitch(flag);
const log=createLog(userData);
const web=app.isPackaged?join(process.resourcesPath,'wallpaper'):resolve(__dirname,'..','web');
const hostScript=app.isPackaged?join(process.resourcesPath,'wallpaper-host.ps1'):join(__dirname,'wallpaper-host.ps1');
const icon=join(__dirname,'assets','genshinexe.ico');
let store,catalog,library,server,wallpaperWindow,settingsWindow,tray,updateController,installConfirmation=false,quitting=false,attachment,attaching,attachTarget,monitor,boundsTimer;
let desktopStatus='connecting',wallpaperStatus='loading',desktopError='',renderError='',telemetry=null,appliedRevision=-1,recoveries=0;
let importStatus={status:'idle',message:''},libraryOperation=false,selectionWarning='';
const officialWarnings=[],appliedWaiters=new Set();
function loginEnabled(){return app.isPackaged&&app.getLoginItemSettings({path:process.execPath,args:['--background']}).openAtLogin;}
function snapshot(){const update=updateController?.snapshot(),contents=library?.snapshot();return {...store.snapshot(),version:app.getVersion(),packaged:app.isPackaged,catalog:{...catalog,wallpapers:contents?.wallpapers||catalog.wallpapers},libraryWarnings:[...officialWarnings,...(contents?.warnings||[]),...(selectionWarning?[selectionWarning]:[])],importStatus,libraryBusy:libraryOperation,serverUrl:server?.url,desktopStatus,wallpaperStatus,desktopError,renderError,appliedRevision,telemetry,openAtLogin:loginEnabled(),updateStatus:update?.status||'idle',update};}
function broadcast(includeWallpaper=true){
 if(!store)return;
 const current=snapshot();
 for(const window of [includeWallpaper&&wallpaperWindow,settingsWindow])if(window&&!window.isDestroyed())window.webContents.send('state:changed',current);
 log.state({...current,wallpaperHandle:wallpaperWindow&&!wallpaperWindow.isDestroyed()?nativeHandle(wallpaperWindow):null,attachment});return current;
}
function updateSettings(patch){
 const previous=store.settings.wallpaperId;store.update(patch);
 if(previous!==store.settings.wallpaperId){telemetry=null;appliedRevision=-1;wallpaperStatus='loading';renderError='';}
 tray?.setContextMenu(trayMenu());tray?.setToolTip(('GenshinWallpaper · '+(library.get(store.settings.wallpaperId)?.name||'动态壁纸')).slice(0,128));return broadcast();
}
function waitForApplied(id){
 if(store.settings.wallpaperId===id&&appliedRevision===store.revision)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const check=()=>{if(store.settings.wallpaperId===id&&appliedRevision===store.revision){clearTimeout(timer);appliedWaiters.delete(check);resolve();}};
  const timer=setTimeout(()=>{appliedWaiters.delete(check);reject(Error('壁纸切换尚未完成，请稍后重试移除'));},15000);appliedWaiters.add(check);
 });
}
function secureWindow(window,kind){
 window.setMenuBarVisibility(false);
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',event=>event.preventDefault());
 window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 window.webContents.on('console-message',details=>{if(details.level==='error'||details.level==='warning')log.write('renderer-console',{kind,message:details.message});});
 window.webContents.on('did-fail-load',(_event,code,message,_url,main)=>{if(main&&code!==-3){log.write('load-error',{kind,code,message});if(kind==='wallpaper'){renderError=message;wallpaperStatus='error';broadcast(false);}}});
 window.webContents.on('render-process-gone',(_event,details)=>{
  log.write('renderer-gone',{kind,...details});
  if(quitting)return;
  if(kind==='wallpaper'){
   wallpaperStatus='error';renderError='壁纸渲染进程已停止，可在设置中重新连接。';broadcast(false);
   if(recoveries++===0)setTimeout(()=>{if(!quitting)replaceWallpaper();},1000);
  }else if(!window.isDestroyed())window.reload();
 });
}
async function connectDesktop(){
 if(quitting||!wallpaperWindow||wallpaperWindow.isDestroyed())return;
 if(attaching)return attachTarget===wallpaperWindow?attaching:attaching.then(()=>connectDesktop());
 const window=wallpaperWindow;attachTarget=window;desktopStatus='connecting';desktopError='';broadcast(false);
 attaching=attachDesktop(window,screen,hostScript).then(result=>{
  if(quitting||window.isDestroyed()||window!==wallpaperWindow)return;
  if(!result.attached)throw Error('Windows 未确认壁纸挂载');
  attachment=result;desktopStatus='attached';log.write('desktop-attached',result);
  if(window.webContents.getURL())window.showInactive();
 }).catch(error=>{
  desktopStatus='error';desktopError=error.message;log.write('desktop-error',{message:error.message});
  if(!window.isDestroyed())window.hide();
 }).finally(()=>{attaching=null;attachTarget=null;broadcast(false);});
 return attaching;
}
function createWallpaper(){
 const bounds=screen.getPrimaryDisplay().bounds;
 const window=new BrowserWindow({...bounds,title:'GenshinWallpaper 动态壁纸',frame:false,thickFrame:false,transparent:false,show:false,focusable:false,resizable:false,movable:false,skipTaskbar:true,backgroundColor:'#102027',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
 wallpaperWindow=window;telemetry=null;appliedRevision=-1;wallpaperStatus='loading';renderError='';attachment=null;
 window.setIgnoreMouseEvents(true);secureWindow(window,'wallpaper');
 window.webContents.once('did-finish-load',()=>{if(desktopStatus==='attached')window.showInactive();broadcast();});
 window.on('closed',()=>{if(window===wallpaperWindow){wallpaperWindow=null;if(!quitting)app.quit();}});
 connectDesktop().then(()=>{if(!quitting&&!window.isDestroyed())window.loadURL(server.url+'/').catch(error=>log.write('wallpaper-load-error',{message:error.message}));});
}
function replaceWallpaper(){
 const previous=wallpaperWindow;createWallpaper();if(previous&&!previous.isDestroyed())previous.destroy();
}
function openSettings(){
 if(settingsWindow&&!settingsWindow.isDestroyed()){settingsWindow.show();settingsWindow.focus();return;}
 const window=new BrowserWindow({width:800,height:820,minWidth:740,minHeight:650,title:'GenshinWallpaper · 壁纸设置',icon,show:false,autoHideMenuBar:true,backgroundColor:'#10262c',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 settingsWindow=window;secureWindow(window,'settings');window.once('ready-to-show',()=>{window.show();window.focus();});window.loadFile(join(__dirname,'settings','index.html'));
 window.on('closed',()=>{if(settingsWindow===window)settingsWindow=null;});
}
function quit(){app.quit();}
function trayMenu(){return Menu.buildFromTemplate([
 {label:'打开壁纸设置',click:openSettings},
 {label:store.settings.motion?'暂停动画':'恢复动画',click:()=>{try{updateSettings({motion:!store.settings.motion});}catch(error){log.write('settings-error',{message:error.message});}}},
 {label:'重新连接桌面',click:()=>{recoveries=0;replaceWallpaper();}},
 {type:'separator'},
 {label:'开机启动',type:'checkbox',checked:loginEnabled(),enabled:app.isPackaged,click:item=>{app.setLoginItemSettings({openAtLogin:item.checked,path:process.execPath,args:['--background']});broadcast(false);}},
 {label:'打开日志文件夹',click:()=>shell.openPath(log.directory)},
 {type:'separator'},{label:'退出 GenshinWallpaper',click:quit},
]);}
function createTray(){tray=new Tray(nativeImage.createFromPath(join(__dirname,'assets','tray.png')).resize({width:20,height:20}));tray.setToolTip(('GenshinWallpaper · '+library.get(store.settings.wallpaperId).name).slice(0,128));tray.setContextMenu(trayMenu());tray.on('double-click',openSettings);tray.on('click',openSettings);}
async function boot(){
 if(process.platform!=='win32')throw Error('目前支持 Windows x64');
 if(!existsSync(join(web,'index.html')))throw Error('缺少本地壁纸资源，请先构建网页');
 store=new SettingsStore(join(userData,'settings.json'));catalog=JSON.parse(readFileSync(join(web,'catalog.json'),'utf8'));
 const videos=validateOfficialVideoCatalog({schemaVersion:catalog.schemaVersion,wallpapers:catalog.wallpapers.filter(item=>item.kind==='video')},web,{strict:false});officialWarnings.push(...videos.warnings);
 catalog.wallpapers=catalog.wallpapers.filter(item=>item.kind==='scene').map(item=>({...item,source:'official'})).concat(videos.wallpapers);
 if(!catalog.wallpapers.some(item=>item.id===catalog.defaultWallpaperId&&item.kind==='scene'))throw Error('缺少默认内置场景');
 library=new WallpaperLibrary({directory:join(userData,'wallpapers'),officialWallpapers:catalog.wallpapers,probeVideo});
 if(!library.get(store.settings.wallpaperId)){selectionWarning='上次使用的壁纸已不可用，已切回内置场景。';store.update({wallpaperId:catalog.defaultWallpaperId});}
 server=await startAssetServer(web,{resolveMedia:(id,kind)=>library.resolveMedia(id,kind)});log.write('startup',{version:app.getVersion(),electron:process.versions.electron,packaged:app.isPackaged,web,displays:screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds,scaleFactor:d.scaleFactor}))});
 const source=resolveUpdateSource(),{autoUpdater,NsisUpdater}=require('electron-updater');
 const updater=source.kind==='local-verification'?new NsisUpdater(source.feed):autoUpdater;
 if(source.kind==='local-verification'){
  const verificationConfig=join(userData,'verification-update.yml');
  writeFileSync(verificationConfig,JSON.stringify(source.feed,null,2)+'\n');
  // electron-updater's test-only config setter also scopes its download cache.
  updater.updateConfigPath=verificationConfig;
 }
 updater.logger={info:message=>log.write('updater-info',{message:String(message)}),warn:message=>log.write('updater-warning',{message:String(message)}),error:message=>log.write('updater-error',{message:String(message)})};
 updateController=createUpdateController({updater,currentVersion:app.getVersion(),packaged:app.isPackaged,source,onChange:()=>broadcast(false),log:log.write});
 log.write('update-source',{kind:source.kind,url:source.url});
 createWallpaper();createTray();if(!process.argv.includes('--background'))openSettings();
 const changeBounds=()=>{clearTimeout(boundsTimer);boundsTimer=setTimeout(()=>{if(!quitting){log.write('display-change');replaceWallpaper();}},500);};
 for(const event of ['display-metrics-changed','display-added','display-removed'])screen.on(event,changeBounds);
 monitor=setInterval(async()=>{
  if(quitting||attaching||!wallpaperWindow||wallpaperWindow.isDestroyed())return;
  try{
   if(!attachment){await connectDesktop();return;}
   const result=await checkDesktop(wallpaperWindow,hostScript,attachment);
   if(!result.attached&&!quitting){log.write('desktop-lost',result);replaceWallpaper();}
  }catch(error){log.write('desktop-check-error',{message:error.message});}
 },30000);
}
function assertSender(event,settingsOnly=false){
 const windows=settingsOnly?[settingsWindow]:[settingsWindow,wallpaperWindow];
 if(event.senderFrame!==event.sender.mainFrame||!windows.some(w=>w&&!w.isDestroyed()&&w.webContents===event.sender))throw Error('此窗口无法使用桌面控制接口');
}
ipcMain.handle('state:get',event=>{assertSender(event);return snapshot();});
ipcMain.handle('settings:update',(event,patch)=>{assertSender(event,true);if(patch&&Object.hasOwn(patch,'wallpaperId'))throw Error('请从壁纸库选择壁纸');return updateSettings(patch);});
ipcMain.handle('settings:reset',event=>{assertSender(event,true);const {wallpaperId,...defaults}=DEFAULT_SETTINGS;return updateSettings(defaults);});
ipcMain.handle('library:import',async event=>{
 assertSender(event,true);if(libraryOperation)throw Error('正在处理壁纸，请稍候');
 libraryOperation=true;importStatus={status:'choosing',message:'请选择 MP4 视频'};broadcast(false);
 try{
  const result=await dialog.showOpenDialog(settingsWindow,{title:'导入 MP4 壁纸',filters:[{name:'MP4 视频',extensions:['mp4']}],properties:['openFile']});
  if(result.canceled||!result.filePaths.length)importStatus={status:'idle',message:''};
  else{
   importStatus={status:'importing',message:'正在复制视频并生成缩略图…'};broadcast(false);
   await library.importLocal(result.filePaths[0]);importStatus={status:'done',message:'导入成功，点击“使用壁纸”应用到桌面。'};
  }
 }catch(error){importStatus={status:'error',message:'导入失败：'+error.message};log.write('wallpaper-import-error',{message:error.message});}
 finally{libraryOperation=false;broadcast(false);}
 return snapshot();
});
ipcMain.handle('library:select',(event,id)=>{
 assertSender(event,true);if(libraryOperation)throw Error('正在处理壁纸，请稍候');
 if(typeof id!=='string'||!library.get(id))throw Error('壁纸不可用，请重新导入');
 selectionWarning='';return updateSettings({wallpaperId:id});
});
ipcMain.handle('library:remove',async(event,id)=>{
 assertSender(event,true);if(libraryOperation)throw Error('正在处理壁纸，请稍候');
 const entry=library.snapshot().wallpapers.find(item=>item.id===id&&item.source==='local');if(!entry)throw Error('只能移除本地导入的壁纸');
 libraryOperation=true;broadcast(false);
 try{
  const result=await dialog.showMessageBox(settingsWindow,{type:'question',title:'移除本地壁纸',message:'移除“'+entry.name+'”？',detail:'只删除软件保存的副本，你下载的原始视频会保留。',buttons:['移除壁纸','取消'],defaultId:1,cancelId:1,noLink:true});
  if(result.response===0&&!quitting){
   if(store.settings.wallpaperId===id){updateSettings({wallpaperId:catalog.defaultWallpaperId});await waitForApplied(catalog.defaultWallpaperId);}
   await library.removeLocal(id);
  }
 }finally{libraryOperation=false;broadcast(false);}
 return snapshot();
});
ipcMain.handle('app:login',(event,enabled)=>{assertSender(event,true);if(!app.isPackaged||typeof enabled!=='boolean')throw Error('请在安装版中设置开机启动');app.setLoginItemSettings({openAtLogin:enabled,path:process.execPath,args:['--background']});tray.setContextMenu(trayMenu());return broadcast(false);});
ipcMain.handle('app:logs',event=>{assertSender(event,true);return shell.openPath(log.directory);});
ipcMain.handle('wallpaper:reconnect',event=>{assertSender(event,true);recoveries=0;replaceWallpaper();});
ipcMain.handle('app:quit',event=>{assertSender(event,true);setImmediate(quit);});
ipcMain.handle('update:check',async event=>{assertSender(event,true);await updateController.check();return broadcast(false);});
ipcMain.handle('update:download',async event=>{assertSender(event,true);await updateController.download();return broadcast(false);});
ipcMain.handle('update:install',async event=>{
 assertSender(event,true);
 if(installConfirmation)return snapshot();
 if(updateController.snapshot().status!=='downloaded')throw Error('请先下载并校验新版本');
 installConfirmation=true;
 try{
  const result=await dialog.showMessageBox(settingsWindow,{type:'question',title:'安装软件更新',message:`重启并安装 v${updateController.snapshot().availableVersion}？`,detail:'安装期间壁纸会暂时关闭，完成后重新启动。你的壁纸设置会保留。',buttons:['重启并安装','稍后'],defaultId:1,cancelId:1,noLink:true});
  if(result.response===0&&!quitting){
   if(updateController.snapshot().source.kind==='local-verification')delete process.env.GENSHINEXE_VERIFY_UPDATE_URL;
   updateController.install();
  }
  return snapshot();
 }finally{installConfirmation=false;}
});
ipcMain.on('wallpaper:applied',(event,payload)=>{
 if(event.sender!==wallpaperWindow?.webContents||event.senderFrame!==event.sender.mainFrame||payload?.revision!==store.revision||payload?.wallpaperId!==store.settings.wallpaperId)return;
 telemetry=payload;appliedRevision=payload.revision;wallpaperStatus=payload.loadError?'error':store.settings.motion?'running':'paused';renderError=String(payload.loadError||'');broadcast(false);
 if(!payload.loadError)for(const check of appliedWaiters)check();
});
ipcMain.on('wallpaper:error',(event,payload)=>{
 if(event.sender!==wallpaperWindow?.webContents||event.senderFrame!==event.sender.mainFrame||payload?.wallpaperId!==store.settings.wallpaperId||payload?.revision!==store.revision)return;
 renderError=String(payload.message).slice(0,3000);wallpaperStatus='error';log.write('wallpaper-error',{message:renderError});
 if(library.snapshot().wallpapers.some(item=>item.id===store.settings.wallpaperId&&item.kind==='video')){selectionWarning='视频播放失败，已切回内置场景：'+renderError;updateSettings({wallpaperId:catalog.defaultWallpaperId});}else broadcast(false);
});
process.on('uncaughtExceptionMonitor',error=>log.write('main-exception',{message:error.message,stack:error.stack}));
process.on('unhandledRejection',error=>log.write('unhandled-rejection',{message:String(error)}));
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',(_event,argv)=>{if(argv.includes('--quit')){quit();return;}if(server&&!argv.includes('--background'))openSettings();});
 app.whenReady().then(()=>process.argv.includes('--quit')?app.quit():boot()).catch(error=>{log.write('startup-error',{message:error.message,stack:error.stack});dialog.showErrorBox('GenshinWallpaper 启动失败',error.message+'\n日志：'+log.directory);app.quit();});
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{
  if(quitting)return;quitting=true;clearInterval(monitor);clearTimeout(boundsTimer);
  updateController?.dispose();
  const current=catalog?.wallpapers.find(item=>item.id===store?.settings.wallpaperId);
  if(store?.settings.timeMode==='cycle'&&current?.kind==='scene'&&current.controls?.timeMode!=='fixed'&&telemetry?.wallpaperId===current.id&&Number.isFinite(telemetry.lightingMinutes)){
   try{store.update({minutes:Math.min(1439,telemetry.lightingMinutes)});}catch(error){log.write('settings-save-error',{message:error.message});}
  }
  log.write('shutdown');server?.close().catch(error=>log.write('server-close-error',{message:error.message}));tray?.destroy();
  for(const window of [settingsWindow,wallpaperWindow])if(window&&!window.isDestroyed())window.destroy();
 });
}
