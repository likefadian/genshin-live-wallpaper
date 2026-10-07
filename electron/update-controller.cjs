const text=(value,limit=12000)=>String(value??'').replaceAll('\0','').slice(0,limit);
function notes(info){
 const value=info?.releaseNotes;
 return text(Array.isArray(value)?value.map(item=>`${text(item.version,80)}\n${text(item.note)}`).join('\n\n'):value);
}
function createUpdateController({updater,currentVersion,packaged,source,onChange=()=>{},log=()=>{}}){
 let disposed=false,busy=null;
 let state={status:packaged?'idle':'disabled',currentVersion,availableVersion:'',releaseNotes:'',releaseDate:'',progress:null,error:'',errorCode:'',retry:'check',checkedAt:null,source:{kind:source.kind,name:source.name,url:source.url}};
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowDowngrade=false;updater.allowPrerelease=false;
 updater.disableWebInstaller=true;
 const snapshot=()=>({...state,source:{...state.source},progress:state.progress?{...state.progress}:null});
 function change(patch){if(disposed)return;state={...state,...patch};onChange(snapshot());}
 function infoPatch(info){return {availableVersion:text(info?.version,80),releaseNotes:notes(info)||state.releaseNotes,releaseDate:text(info?.releaseDate,80)};}
 function failure(error){
  if(disposed)return;
  const code=text(error?.code,128),missing=busy==='check'&&source.kind==='github'&&(code==='ERR_UPDATER_NO_PUBLISHED_VERSIONS'||(code==='ERR_XML_MISSED_ELEMENT'&&error?.message==='No published versions on GitHub'));
  change({status:missing?'no-release':'error',error:missing?'':text(error?.message||error,2000),errorCode:code,progress:null,retry:busy==='download'?'download':'check'});
  log('update-error',{code,message:text(error?.message||error,2000),operation:busy});
 }
 const listeners={
  'update-available':info=>{if(busy==='check')change({...infoPatch(info),status:'available',error:'',errorCode:'',retry:'download'});},
  'update-not-available':()=>{if(busy==='check')change({status:'current',availableVersion:'',releaseNotes:'',error:'',errorCode:''});},
  'download-progress':progress=>{if(busy==='download'){
   const number=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
   change({progress:{percent:number(progress.percent,100),transferred:number(progress.transferred),total:number(progress.total),bytesPerSecond:number(progress.bytesPerSecond)}});
  }},
  'update-downloaded':info=>{if(busy==='download')change({...infoPatch(info),status:'downloaded',error:'',errorCode:'',progress:{percent:100,transferred:state.progress?.total||0,total:state.progress?.total||0,bytesPerSecond:0}});},
  error:failure,
 };
 for(const [event,listener] of Object.entries(listeners))updater.on(event,listener);
 function live(){if(disposed)throw Error('更新器已停止');if(!packaged)throw Error('请在安装版中检查更新');}
 return {
  snapshot,
  async check(){
   live();if(busy||['downloaded','installing'].includes(state.status))return snapshot();
   busy='check';change({status:'checking',availableVersion:'',releaseNotes:'',progress:null,error:'',errorCode:'',retry:'check',checkedAt:new Date().toISOString()});
   try{await updater.checkForUpdates();}catch(error){failure(error);}finally{busy=null;}
   return snapshot();
  },
  async download(){
   live();if(busy==='download')return snapshot();
   if(busy==='check')throw Error('正在检查更新，请稍后下载');
   if(state.status!=='available'&&!(state.status==='error'&&state.retry==='download'&&state.availableVersion))throw Error('请先检查并选择可下载的新版本');
   busy='download';change({status:'downloading',progress:{percent:0,transferred:0,total:0,bytesPerSecond:0},error:'',errorCode:''});
   try{await updater.downloadUpdate();}catch(error){failure(error);}finally{busy=null;}
   return snapshot();
  },
  install(){
   live();if(busy||state.status!=='downloaded')throw Error('请先完成新版本下载和校验');
   change({status:'installing'});log('update-install',{version:state.availableVersion});
   try{updater.quitAndInstall(true,true);}catch(error){failure(error);throw error;}
   return snapshot();
  },
  dispose(){
   disposed=true;
   for(const [event,listener] of Object.entries(listeners))if(event!=='error')updater.off(event,listener);
   // Keep the error listener until process exit: a pending request can still reject while quitting.
  },
 };
}
module.exports={createUpdateController};
