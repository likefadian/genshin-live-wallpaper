import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {randomUUID} from 'node:crypto';
import {copyFile} from 'node:fs/promises';
import {existsSync,mkdirSync,readFileSync,writeFileSync,statSync,lstatSync,realpathSync,rmSync,unlinkSync,openSync,closeSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,extname} from 'node:path';
import library from '../electron/library.cjs';
const {atomicJson,decodeThumbnail,validateOfficialVideoCatalog}=library,project=resolve(import.meta.dirname,'..');
async function main(){
 // Keep accepting the old --author option for existing scripts; entries no longer use it.
 const {values}=parseArgs({options:{file:{type:'string'},id:{type:'string'},name:{type:'string'},author:{type:'string'},'catalog-root':{type:'string'}}});
 if(!values.file||!values.id||!values.name?.trim()||!/^[a-z\d-]{1,80}$/.test(values.id))throw Error('请填写 --file MP4、--id 小写英文标识、--name 名称');
 const source=resolve(values.file);if(extname(source).toLowerCase()!=='.mp4'||!statSync(source).isFile()||statSync(source).size===0)throw Error('请选择有效的 MP4 文件');
 const root=resolve(values['catalog-root']||join(project,'content/official-videos')),file=join(root,'catalog.json'),id='official-video-'+values.id,target=join(root,id);
 mkdirSync(root,{recursive:true});const lockFile=file+'.lock';let lock;
 try{lock=openSync(lockFile,'wx');}catch(error){if(error.code==='EEXIST')throw Error('正在录入官方壁纸，请稍后重试。若录入进程已退出，请删除 '+lockFile+' 后重试。');throw error;}
 try{
 const catalog=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{schemaVersion:1,wallpapers:[]};validateOfficialVideoCatalog(catalog,root);
 if(catalog.wallpapers.some(row=>row.id===id)||existsSync(target))throw Error('作品 ID 已存在，请使用新的 --id');
 const resultFile=join(project,'.cache','official-probe-'+randomUUID()+'.json');mkdirSync(join(project,'.cache'),{recursive:true});let created=false;
 try{
  mkdirSync(target);created=true;await copyFile(source,join(target,'video.mp4'));
  await new Promise((done,reject)=>{
   const child=spawn(join(project,'node_modules/electron/dist/electron.exe'),[join(project,'electron/probe-video-cli.cjs'),'--file',join(target,'video.mp4'),'--output',resultFile],{cwd:project,windowsHide:true,stdio:['ignore','ignore','pipe'],timeout:25000});
   let error='';child.stderr.on('data',chunk=>{error=(error+chunk).slice(-4000);});child.once('error',reject);child.once('close',code=>code===0?done():reject(Error(error.trim()||'视频检查失败')));
  });
  const metadata=JSON.parse(readFileSync(resultFile,'utf8'));writeFileSync(join(target,'thumbnail.png'),decodeThumbnail(metadata.thumbnailDataURL));
  const row={id,name:values.name.trim(),duration:metadata.duration,width:metadata.width,height:metadata.height,size:statSync(join(target,'video.mp4')).size,media:id+'/video.mp4',thumbnail:id+'/thumbnail.png'};
  const next={schemaVersion:1,wallpapers:[...catalog.wallpapers,row]};validateOfficialVideoCatalog(next,root);atomicJson(file,next);
  console.log('已添加官方壁纸：'+row.name+' / '+id+'\n资源目录：'+target);
 }catch(error){
  if(created){const rel=relative(realpathSync(root),realpathSync(target));if(!rel||rel.startsWith('..')||isAbsolute(rel)||lstatSync(target).isSymbolicLink())throw Error('作品暂存目录无法安全清理：'+error.message);rmSync(target,{recursive:true,force:true});}
  throw error;
 }finally{if(existsSync(resultFile))unlinkSync(resultFile);}
 }finally{closeSync(lock);unlinkSync(lockFile);}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
