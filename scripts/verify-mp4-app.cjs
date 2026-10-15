// Integration fixture: only this separate development entry replaces native dialogs.
// The shipped application never reads this queue or loads this module.
const {app,dialog,BrowserWindow}=require('electron');
const fs=require('node:fs');
const queueFile=process.env.GENSHINEXE_TEST_DIALOG_QUEUE;
if(!queueFile)throw Error('验收入口需要专用对话框队列');
function read(){return JSON.parse(fs.readFileSync(queueFile,'utf8'));}
function take(key,fallback){const queue=read(),result=queue[key]?.shift()??fallback;queue.calls??={};queue.calls[key]=(queue.calls[key]||0)+1;fs.writeFileSync(queueFile,JSON.stringify(queue));return result;}
dialog.showOpenDialog=async()=>{await new Promise(done=>setTimeout(done,100));return take('open',{canceled:true,filePaths:[]});};
dialog.showMessageBox=async()=>take('confirm',{response:1});
let size='';fs.watchFile(queueFile,{interval:100},()=>{
 const queue=read(),key=JSON.stringify(queue.bounds);
 if(queue.bounds&&key!==size){for(const window of BrowserWindow.getAllWindows())if(window.webContents.getURL().endsWith('/settings/index.html'))window.setSize(queue.bounds.width,queue.bounds.height);size=key;}
});
app.on('will-quit',()=>fs.unwatchFile(queueFile));
require('../electron/main.cjs');
