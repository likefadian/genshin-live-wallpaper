const {app,BrowserWindow,Menu,Tray,nativeImage,screen,ipcMain,shell,dialog}=require('electron');
const {existsSync,mkdirSync,readFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {SettingsStore,DEFAULT_SETTINGS}=require('./settings.cjs');
const {startAssetServer}=require('./asset-server.cjs');
const {attachDesktop,checkDesktop,nativeHandle}=require('./desktop-host.cjs');
const {createLog}=require('./runtime-log.cjs');

app.setName('GenshinEXE');app.setAppUserModelId('com.genshinexe.wallpaper');
const userData=process.env.GENSHINEXE_PROFILE?resolve(process.env.GENSHINEXE_PROFILE):join(app.getPath('appData'),'GenshinEXE');
mkdirSync(userData,{recursive:true});app.setPath('userData',userData);
for(const flag of ['disable-renderer-backgrounding','disable-background-timer-throttling','disable-backgrounding-occluded-windows'])app.commandLine.appendSwitch(flag);
const log=createLog(userData);
const web=app.isPackaged?join(process.resourcesPath,'wallpaper'):resolve(__dirname,'..','web');
const hostScript=app.isPackaged?join(process.resourcesPath,'wallpaper-host.ps1'):join(__dirname,'wallpaper-host.ps1');
const icon=join(__dirname,'assets','genshinexe.ico');
let store,catalog,server,wallpaperWindow,settingsWindow,tray,quitting=false,attachment,attaching,attachTarget,monitor,boundsTimer;
let desktopStatus='connecting',wallpaperStatus='loading',desktopError='',renderError='',telemetry=null,appliedRevision=-1,recoveries=0;
function loginEnabled(){return app.isPackaged&&app.getLoginItemSettings({path:process.execPath,args:['--background']}).openAtLogin;}
function snapshot(){return {...store.snapshot(),version:app.getVersion(),packaged:app.isPackaged,catalog,serverUrl:server?.url,desktopStatus,wallpaperStatus,desktopError,renderError,appliedRevision,telemetry,openAtLogin:loginEnabled(),updateStatus:'unconfigured'};}
function broadcast(includeWallpaper=true){
 if(!store)return;
 const current=snapshot();
 for(const window of [includeWallpaper&&wallpaperWindow,settingsWindow])if(window&&!window.isDestroyed())window.webContents.send('state:changed',current);
 log.state({...current,wallpaperHandle:wallpaperWindow&&!wallpaperWindow.isDestroyed()?nativeHandle(wallpaperWindow):null,attachment});return current;
}
function updateSettings(patch){store.update(patch);tray?.setContextMenu(trayMenu());return broadcast();}
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
 const window=new BrowserWindow({...bounds,title:'GenshinEXE 动态壁纸',frame:false,thickFrame:false,transparent:false,show:false,focusable:false,resizable:false,movable:false,skipTaskbar:true,backgroundColor:'#102027',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
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
 const window=new BrowserWindow({width:800,height:820,minWidth:740,minHeight:650,title:'GenshinEXE · 壁纸设置',icon,show:false,autoHideMenuBar:true,backgroundColor:'#10262c',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
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
 {type:'separator'},{label:'退出 GenshinEXE',click:quit},
]);}
function createTray(){tray=new Tray(nativeImage.createFromPath(join(__dirname,'assets','tray.png')).resize({width:20,height:20}));tray.setToolTip('GenshinEXE · 璃月灯火');tray.setContextMenu(trayMenu());tray.on('double-click',openSettings);tray.on('click',openSettings);}
async function boot(){
 if(process.platform!=='win32')throw Error('目前支持 Windows x64');
 if(!existsSync(join(web,'index.html')))throw Error('缺少本地壁纸资源，请先构建网页');
 store=new SettingsStore(join(userData,'settings.json'));catalog=JSON.parse(readFileSync(join(web,'catalog.json'),'utf8'));
 server=await startAssetServer(web);log.write('startup',{version:app.getVersion(),electron:process.versions.electron,packaged:app.isPackaged,web,displays:screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds,scaleFactor:d.scaleFactor}))});
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
ipcMain.handle('settings:update',(event,patch)=>{assertSender(event,true);return updateSettings(patch);});
ipcMain.handle('settings:reset',event=>{assertSender(event,true);return updateSettings(DEFAULT_SETTINGS);});
ipcMain.handle('app:login',(event,enabled)=>{assertSender(event,true);if(!app.isPackaged||typeof enabled!=='boolean')throw Error('请在安装版中设置开机启动');app.setLoginItemSettings({openAtLogin:enabled,path:process.execPath,args:['--background']});tray.setContextMenu(trayMenu());return broadcast(false);});
ipcMain.handle('app:logs',event=>{assertSender(event,true);return shell.openPath(log.directory);});
ipcMain.handle('wallpaper:reconnect',event=>{assertSender(event,true);recoveries=0;replaceWallpaper();});
ipcMain.handle('app:quit',event=>{assertSender(event,true);setImmediate(quit);});
ipcMain.on('wallpaper:applied',(event,payload)=>{
 if(event.sender!==wallpaperWindow?.webContents||event.senderFrame!==event.sender.mainFrame||payload?.revision!==store.revision)return;
 telemetry=payload;appliedRevision=payload.revision;wallpaperStatus=payload.loadError?'error':store.settings.motion?'running':'paused';renderError=String(payload.loadError||'');broadcast(false);
});
ipcMain.on('wallpaper:error',(event,message)=>{if(event.sender!==wallpaperWindow?.webContents||event.senderFrame!==event.sender.mainFrame)return;renderError=String(message).slice(0,3000);wallpaperStatus='error';log.write('wallpaper-error',{message:renderError});broadcast(false);});
process.on('uncaughtExceptionMonitor',error=>log.write('main-exception',{message:error.message,stack:error.stack}));
process.on('unhandledRejection',error=>log.write('unhandled-rejection',{message:String(error)}));
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',(_event,argv)=>{if(argv.includes('--quit')){quit();return;}if(server&&!argv.includes('--background'))openSettings();});
 app.whenReady().then(()=>process.argv.includes('--quit')?app.quit():boot()).catch(error=>{log.write('startup-error',{message:error.message,stack:error.stack});dialog.showErrorBox('GenshinEXE 启动失败',error.message+'\n日志：'+log.directory);app.quit();});
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{
  if(quitting)return;quitting=true;clearInterval(monitor);clearTimeout(boundsTimer);
  if(store&&store.settings.timeMode==='cycle'&&telemetry&&Number.isFinite(telemetry.lightingMinutes)){
   try{store.update({minutes:Math.min(1439,telemetry.lightingMinutes)});}catch(error){log.write('settings-save-error',{message:error.message});}
  }
  log.write('shutdown');server?.close().catch(error=>log.write('server-close-error',{message:error.message}));tray?.destroy();
  for(const window of [settingsWindow,wallpaperWindow])if(window&&!window.isDestroyed())window.destroy();
 });
}
