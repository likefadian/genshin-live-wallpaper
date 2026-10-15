const {contextBridge,ipcRenderer}=require('electron');
const isWallpaper=location.protocol==='http:'&&location.hostname==='127.0.0.1';
const subscribe=(channel,callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
const api={getState:()=>ipcRenderer.invoke('state:get'),onState:callback=>subscribe('state:changed',callback)};
if(isWallpaper){
 api.reportApplied=payload=>ipcRenderer.send('wallpaper:applied',payload);
 api.reportError=message=>ipcRenderer.send('wallpaper:error',message);
}else{
 api.updateSettings=patch=>ipcRenderer.invoke('settings:update',patch);
 api.resetSettings=()=>ipcRenderer.invoke('settings:reset');
 api.importWallpaper=()=>ipcRenderer.invoke('library:import');
 api.selectWallpaper=id=>ipcRenderer.invoke('library:select',id);
 api.removeWallpaper=id=>ipcRenderer.invoke('library:remove',id);
 api.setOpenAtLogin=enabled=>ipcRenderer.invoke('app:login',enabled);
 api.reconnect=()=>ipcRenderer.invoke('wallpaper:reconnect');
 api.openLogs=()=>ipcRenderer.invoke('app:logs');
 api.quit=()=>ipcRenderer.invoke('app:quit');
 api.checkUpdate=()=>ipcRenderer.invoke('update:check');
 api.downloadUpdate=()=>ipcRenderer.invoke('update:download');
 api.installUpdate=()=>ipcRenderer.invoke('update:install');
}
contextBridge.exposeInMainWorld('genshinDesktop',api);
