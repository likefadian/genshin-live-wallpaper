export function createVideoRuntime(host,entry,{onError=()=>{},signal}={}){
 const video=document.createElement('video');video.className='wallpaper-video';video.loop=true;video.muted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
 let disposed=false,ready=false,loadError='',timer,rejectLoading;
 const destroy=()=>{
  if(disposed)return;disposed=true;clearTimeout(timer);signal?.removeEventListener('abort',destroy);
  video.onloadeddata=video.onerror=null;video.pause();video.removeAttribute('src');video.load();video.remove();
  if(!ready)rejectLoading?.(new DOMException('已取消视频加载','AbortError'));
 };
 const fail=error=>{if(disposed)return;loadError=error.message;if(ready)onError(error);else{rejectLoading(error);destroy();}};
 const runtime={
  apply(settings){
   if(disposed)return;video.volume=settings.videoVolume;video.muted=settings.videoVolume===0;video.playbackRate=settings.speed;video.style.objectFit=settings.fit;
   if(settings.motion){if(video.paused)video.play().catch(error=>{if(error.name!=='AbortError')fail(error);});}else video.pause();
  },
  snapshot(){return {wallpaperId:entry.id,kind:'video',currentTime:video.currentTime,duration:video.duration||entry.duration,paused:video.paused,renderSize:[video.videoWidth,video.videoHeight],loadError};},destroy,
 };
 return new Promise((done,reject)=>{
  rejectLoading=reject;
  if(signal?.aborted){destroy();return;}
  signal?.addEventListener('abort',destroy,{once:true});
  timer=setTimeout(()=>fail(Error('视频加载超时，请重新导入或更换视频')),15000);
  video.onloadeddata=()=>{if(!video.videoWidth||!video.videoHeight){fail(Error('MP4 没有视频画面'));return;}ready=true;clearTimeout(timer);done(runtime);};
  video.onerror=()=>fail(Error('MP4 无法播放，文件可能损坏或编码不受支持'));
  host.append(video);video.src=new URL(entry.media,location.href).href;video.load();
 });
}
