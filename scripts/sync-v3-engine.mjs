import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Developer import only. Installed applications use the embedded snapshot.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(process.argv[2]||join(root,'..','GENSHIN-FRONT-V3'));
const requestedRef=process.argv[3];
if(!requestedRef)throw Error('请指定已确认的 V3 Git 提交：node scripts/sync-v3-engine.mjs <V3路径> <提交>');
const git=args=>execFileSync('git',['-C',source,...args],{maxBuffer:4*1024*1024,windowsHide:true});
const commit=git(['rev-parse','--verify','--end-of-options',requestedRef+'^{commit}']).toString().trim();
const sha=data=>createHash('sha256').update(data).digest('hex');
const normalize=data=>data.toString('utf8').replaceAll('\r\n','\n');
const inputs=new Map(),files=[],assets=[];
function tree(prefix){
 return git(['ls-tree','-r','-z',commit,'--',prefix]).toString().split('\0').filter(Boolean).map(entry=>{
  const [meta,path]=entry.split('\t'),[mode,type,blob]=meta.split(' ');
  if(mode!=='100644'||type!=='blob')throw Error('不导入链接或特殊文件：'+path);
  return {path,blob};
 });
}
function committedText(path){
 const committed=git(['show',commit+':'+path]),working=readFileSync(join(source,path));
 if(!working.equals(committed)&&normalize(working)!==normalize(committed))throw Error('来源包含该提交以外的修改：'+path);
 return {data:working,committedSha256:sha(committed)};
}
for(const item of tree('web/src')){
 const input=committedText(item.path);inputs.set(item.path,input);
 if(!item.path.endsWith('.ts'))continue;
 for(const match of input.data.toString('utf8').matchAll(/from\s*['"]([^'"]+\.json)['"]/g)){
  const path=relative(source,resolve(source,dirname(item.path),match[1])).replaceAll('\\','/');
  if(path.startsWith('../')||!path.startsWith('assets/'))throw Error('JSON 引用超出来源资源目录：'+path);
  if(!inputs.has(path))inputs.set(path,committedText(path));
 }
}
const transportPath='assets/xiao/materials/frame-transport-v001.json';
const transport=JSON.parse(inputs.get(transportPath)?.data.toString('utf8')||'null');
if(!transport?.assetRoot?.startsWith('assets/')||transport.assetRoot.includes('..'))throw Error('缺少有效的分块资源配置');
const assetInputs=tree('web/public/'+transport.assetRoot);
const packedManifestPath='web/public/'+transport.assetRoot+'manifest.json';
const packedManifest=JSON.parse(readFileSync(join(source,packedManifestPath),'utf8'));
const baseRoot=transport.assetRoot.replace(/tiles-v001\/$/,'');
const originalManifest=JSON.parse(readFileSync(join(root,'content',baseRoot,'manifest.json'),'utf8'));
if(packedManifest.frameCount!==originalManifest.frameCount||packedManifest.fps!==originalManifest.fps||assetInputs.length!==originalManifest.frameCount+1)throw Error('分块资源数量或时序不匹配');
const expectedFrames=new Map(packedManifest.frames.map(frame=>{
 if(frame.sourceSha256!==originalManifest.frames[frame.frame]?.sha256)throw Error('分块关联了不同的原图集');
 return ['frame-'+String(frame.frame).padStart(4,'0')+'.png',frame.sha256];
}));
const pending=[];
for(const item of assetInputs){
 const data=readFileSync(join(source,item.path));
 const blob=createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex');
 if(item.path.endsWith('.json'))committedText(item.path);
 else if(blob!==item.blob)throw Error('资源与已确认提交不同：'+item.path);
 const path=item.path.replace('web/public/','content/'),hash=sha(data);
 if(item.path.endsWith('.png')&&expectedFrames.get(item.path.split('/').at(-1))!==hash)throw Error('分块PNG校验失败：'+item.path);
 pending.push({path,data});assets.push({path,bytes:data.length,sha256:hash});
}
for(const [sourcePath,input] of inputs){
 const path='vendor/v3/'+sourcePath;
 pending.push({path,data:input.data});files.push({path,sourcePath,sha256:sha(input.data),committedSha256:input.committedSha256});
}
// Validate every source first, then update only the reviewed import locations.
let changed=0;
for(const {path,data} of pending){
 const target=join(root,path);
 if(existsSync(target)&&readFileSync(target).equals(data))continue;
 mkdirSync(dirname(target),{recursive:true});writeFileSync(target,data);changed++;
}
const manifest={schemaVersion:1,recordedOn:'2026-10-07',sourceProject:'GENSHIN-FRONT-V3',sourceCommit:commit,baselineRecord:'content/source.json',purpose:'Accepted shared rendering optimizations and lossless independent frame tiles',gpuSelectionChanged:false,originalAtlasRetained:true,files,assets};
writeFileSync(join(root,'content/engine-update.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sourceCommit:commit,sourceFiles:files.length,assetFiles:assets.length,assetBytes:assets.reduce((n,a)=>n+a.bytes,0),changedFiles:changed,frameCount:packedManifest.frameCount,packedSize:packedManifest.packedSize},null,2));
