const {BrowserWindow}=require('electron');
const {statSync}=require('node:fs');
const {extname,join,resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const {decodeThumbnail}=require('./library.cjs');
async function probeVideo(filePath,{timeoutMs=15000}={}){
 if(typeof filePath!=='string'||extname(filePath).toLowerCase()!=='.mp4')throw Error('请选择 MP4 视频');
 const info=statSync(filePath);if(!info.isFile()||info.size===0)throw Error('MP4 文件为空或不可读取');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('视频检查超时参数无效');
 const window=new BrowserWindow({show:false,width:360,height:203,skipTaskbar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',event=>event.preventDefault());
 window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 let timer;
 try{
  const result=await new Promise((done,reject)=>{
   timer=setTimeout(()=>reject(Error('MP4 检查超时，请确认文件能正常播放')),timeoutMs);
   window.webContents.once('render-process-gone',()=>reject(Error('视频检查进程已停止')));
   window.loadFile(join(__dirname,'video-probe.html')).then(()=>window.webContents.executeJavaScript('window.inspectVideo('+JSON.stringify(pathToFileURL(resolve(filePath)).href)+')')).then(done,reject);
  });
  if(!Number.isInteger(result?.width)||result.width<=0||!Number.isInteger(result.height)||result.height<=0||!Number.isFinite(result.duration)||result.duration<=0)throw Error('MP4 视频元数据无效');
  decodeThumbnail(result.thumbnailDataURL);return result;
 }finally{clearTimeout(timer);if(!window.isDestroyed())window.destroy();}
}
module.exports={probeVideo};
