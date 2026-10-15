window.inspectVideo=source=>new Promise((resolve,reject)=>{
 const video=document.createElement('video');video.muted=true;video.preload='auto';video.playsInline=true;
 const clear=()=>{video.onloadedmetadata=video.onloadeddata=video.onerror=null;video.pause();video.removeAttribute('src');video.load();video.remove();};
 const fail=message=>{clear();reject(Error(message));};
 video.onloadedmetadata=()=>{if(!video.videoWidth||!video.videoHeight||!Number.isFinite(video.duration)||video.duration<=0)fail('MP4 没有有效的视频画面或时长');};
 video.onerror=()=>fail('无法解码 MP4 视频，文件可能损坏或编码不受支持');
 video.onloadeddata=()=>{
  try{
   const width=video.videoWidth,height=video.videoHeight,duration=video.duration;
   if(!width||!height||!Number.isFinite(duration)||duration<=0)throw Error('视频元数据无效');
   const scale=Math.min(360/width,203/height,1),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
   canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   const thumbnailDataURL=canvas.toDataURL('image/png');clear();resolve({width,height,duration,thumbnailDataURL});
  }catch(error){fail(error.message);}
 };
 document.body.append(video);video.src=source;video.load();
});
