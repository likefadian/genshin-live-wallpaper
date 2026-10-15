export function createWallpaperController({createScene,createVideo,onReady=()=>{},onError=()=>{}}){
 let current=null,desired=null,pending=null,generation=0,disposed=false,cancel;
 return {
  get current(){return current;},
  select(entry){
   if(disposed)return Promise.resolve(null);
   if(desired===entry.id)return pending||Promise.resolve(current?.runtime||null);
   const token=++generation;desired=entry.id;current?.runtime.destroy();current=null;cancel?.abort();cancel=new AbortController();
   const signal=cancel.signal,report=error=>{if(!disposed&&token===generation)onError(entry,error);};
   pending=Promise.resolve().then(()=>{
    if(disposed||token!==generation)return null;
    const create=entry.kind==='video'?createVideo:createScene;if(!create)throw Error('不支持的壁纸类型');
    return create(entry,{onError:report,signal});
   }).then(runtime=>{
    if(!runtime)return null;
    if(disposed||token!==generation){runtime.destroy();return null;}
    current={entry,runtime};onReady(entry,runtime);return runtime;
   }).catch(error=>{if(!disposed&&token===generation)desired=null;report(error);return null;}).finally(()=>{if(token===generation)pending=null;});
   return pending;
  },
  destroy(){if(disposed)return;disposed=true;generation++;current?.runtime.destroy();current=null;cancel?.abort();},
 };
}
