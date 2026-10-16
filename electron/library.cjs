const fs=require('node:fs');
const {copyFile}=require('node:fs/promises');
const {basename,extname,isAbsolute,join,relative,resolve}=require('node:path');
const {randomUUID}=require('node:crypto');

const LOCAL_ID=/^local-video-[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
function within(root,target){const rel=relative(resolve(root),resolve(target));return !!rel&&!rel.startsWith('..')&&!isAbsolute(rel);}
function regularInside(root,target){
 try{return fs.lstatSync(target).isFile()&&within(fs.realpathSync(root),fs.realpathSync(target));}catch{return false;}
}
function dimensions(value){return Number.isFinite(value?.duration)&&value.duration>0&&Number.isInteger(value.width)&&value.width>0&&Number.isInteger(value.height)&&value.height>0&&Number.isSafeInteger(value.size)&&value.size>0;}
function decodeThumbnail(data){
 if(typeof data!=='string'||!/^data:image\/png;base64,[A-Za-z\d+/=]+$/.test(data))throw Error('无法生成视频缩略图');
 const image=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
 if(image.length>1024*1024||image.length<24||image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('视频缩略图无效');
 return image;
}
function atomicJson(file,value){
 const temporary=file+'.tmp';
 try{fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n','utf8');fs.renameSync(temporary,file);}
 catch(error){try{if(fs.lstatSync(temporary).isFile())fs.unlinkSync(temporary);}catch{}throw error;}
}
function validateOfficialVideoCatalog(value,root,{strict=true}={}){
 const wallpapers=[],warnings=[],seen=new Set();
 const fail=message=>{if(strict)throw Error(message);warnings.push(message);};
 if(value?.schemaVersion!==1||!Array.isArray(value.wallpapers)){fail('官方视频清单格式无效');return {wallpapers,warnings};}
 for(const row of value.wallpapers){
  try{
   if(!/^official-video-[a-z\d-]{1,80}$/.test(row?.id)||seen.has(row.id))throw Error('官方壁纸 ID 无效或重复');
   if(typeof row.name!=='string'||!row.name.trim()||!dimensions(row))throw Error('官方壁纸名称或视频信息无效');
   for(const [key,extension] of [['media','.mp4'],['thumbnail','.png']]){
    const path=row[key];
    if(typeof path!=='string'||isAbsolute(path)||path.includes('\\')||path.includes(':')||path.split('/').includes('..')||extname(path).toLowerCase()!==extension||!regularInside(root,resolve(root,path)))throw Error('官方壁纸资源缺失或路径无效：'+row.id);
   }
   if(fs.statSync(resolve(root,row.media)).size!==row.size)throw Error('官方视频大小与清单不一致：'+row.id);
   const thumbnail=fs.readFileSync(resolve(root,row.thumbnail));if(thumbnail.length>1024*1024||thumbnail.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('官方视频缩略图无效');
   seen.add(row.id);wallpapers.push({id:row.id,kind:'video',source:'official',name:row.name.trim().slice(0,160),media:row.media,thumbnail:row.thumbnail,duration:row.duration,width:row.width,height:row.height,size:row.size});
  }catch(error){fail(error.message);}
 }
 return {wallpapers,warnings};
}
class WallpaperLibrary{
 constructor({directory,officialWallpapers=[],probeVideo}){
  this.directory=resolve(directory);this.localRoot=join(this.directory,'local');this.file=join(this.directory,'library.json');
  this.probeVideo=probeVideo;this.official=new Map(officialWallpapers.map(item=>[item.id,{...item,source:'official',available:true}]));
  this.entries=new Map();this.warnings=[];this.busy=false;fs.mkdirSync(this.localRoot,{recursive:true});
  if(fs.existsSync(this.file)){
   try{
    const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(saved.schemaVersion!==1||!Array.isArray(saved.wallpapers))throw Error('壁纸库格式无效');
    for(const item of saved.wallpapers){
     if(!LOCAL_ID.test(item?.id)||!dimensions(item)||typeof item.name!=='string'||!item.name.trim()||this.entries.has(item.id)){
      this.warnings.push('已跳过一条无效的本地壁纸记录');continue;
     }
     this.entries.set(item.id,{id:item.id,name:item.name.slice(0,160),kind:'video',source:'local',duration:item.duration,width:item.width,height:item.height,size:item.size,addedAt:typeof item.addedAt==='string'?item.addedAt:''});
    }
   }catch{this.warnings.push('本地壁纸清单损坏，已保留媒体文件，可重新导入。');}
  }
 }
 resolveMedia(id,kind){
  if(!LOCAL_ID.test(id)||!this.entries.has(id)||!['video','thumbnail'].includes(kind))return null;
  const target=join(this.localRoot,id,kind==='video'?'video.mp4':'thumbnail.png');
  return regularInside(this.localRoot,target)?target:null;
 }
 publicEntry(item){return {...item,media:'/user-wallpapers/'+item.id+'/video.mp4',thumbnail:'/user-wallpapers/'+item.id+'/thumbnail.png',available:!!this.resolveMedia(item.id,'video')};}
 get(id){
  if(this.official.has(id))return {...this.official.get(id)};
  const item=this.entries.get(id);if(!item)return null;
  const entry=this.publicEntry(item);return entry.available?entry:null;
 }
 snapshot(){
  const local=[...this.entries.values()].map(item=>this.publicEntry(item));
  return {wallpapers:[...this.official.values()].map(x=>({...x})).concat(local),warnings:[...this.warnings,...local.filter(x=>!x.available).map(x=>'找不到本地视频：'+x.name)]};
 }
 save(next){atomicJson(this.file,{schemaVersion:1,wallpapers:[...next.values()]});this.entries=next;}
 removeDirectory(directory){
  if(!within(this.localRoot,directory)||!LOCAL_ID.test(basename(directory)))throw Error('无法清理作品目录');
  if(!fs.existsSync(directory))return;
  if(fs.lstatSync(directory).isSymbolicLink()||!within(fs.realpathSync(this.localRoot),fs.realpathSync(directory)))throw Error('作品目录位置无效');
  fs.rmSync(directory,{recursive:true,force:true});
 }
 async importLocal(filePath){
  if(this.busy)throw Error('正在导入视频，请稍候');
  if(typeof filePath!=='string'||extname(filePath).toLowerCase()!=='.mp4')throw Error('请选择 MP4 视频文件');
  const info=fs.statSync(filePath);if(!info.isFile()||info.size===0)throw Error('MP4 文件为空或不是普通文件');
  this.busy=true;const id='local-video-'+randomUUID(),directory=join(this.localRoot,id);
  try{
   fs.mkdirSync(directory);const target=join(directory,'video.mp4');await copyFile(filePath,target);
   const metadata=await this.probeVideo(target),size=fs.statSync(target).size;
   if(!dimensions({...metadata,size}))throw Error('视频画面或时长无效');
   fs.writeFileSync(join(directory,'thumbnail.png'),decodeThumbnail(metadata.thumbnailDataURL));
   const entry={id,kind:'video',source:'local',name:basename(filePath,extname(filePath)).slice(0,160)||'未命名壁纸',duration:metadata.duration,width:metadata.width,height:metadata.height,size,addedAt:new Date().toISOString()};
   const next=new Map(this.entries);next.set(id,entry);this.save(next);return this.get(id);
  }catch(error){try{this.removeDirectory(directory);}catch{this.warnings.push('暂存视频清理失败，可在日志中检查。');}throw error;}
  finally{this.busy=false;}
 }
 async removeLocal(id){
  if(this.busy)throw Error('正在导入视频，请稍候');
  if(!LOCAL_ID.test(id)||!this.entries.has(id))throw Error('只能移除已导入的本地壁纸');
  const previous=this.entries,next=new Map(previous);next.delete(id);
  this.save(next);
  try{this.removeDirectory(join(this.localRoot,id));}
  catch(error){this.save(previous);throw error;}
 }
}
module.exports={WallpaperLibrary,atomicJson,decodeThumbnail,dimensions,regularInside,validateOfficialVideoCatalog};
