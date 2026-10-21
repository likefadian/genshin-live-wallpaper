import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const projectRoot=resolve(import.meta.dirname,'..');
const sha=data=>createHash('sha256').update(data).digest('hex');
const normalize=data=>data.toString('utf8').replaceAll('\r\n','\n');
function assetPath(path){
 if(typeof path!=='string'||!path.startsWith('assets/')||path.includes('\\')||path.split('/').some(part=>part==='..'||part==='.')||/[?#:\0]/.test(path))throw Error('资源路径无效：'+path);
 return path;
}

// Developer import only. Installed applications use this project's embedded snapshot.
export async function syncV3Engine({root=projectRoot,source=resolve(root,'../GENSHIN-FRONT-V3'),requestedRef}={}){
 if(!requestedRef)throw Error('请指定已确认的 V3 Git 提交：node scripts/sync-v3-engine.mjs <V3路径> <提交>');
 root=resolve(root);source=resolve(source);
 const git=args=>execFileSync('git',['-C',source,...args],{maxBuffer:4*1024*1024,windowsHide:true});
 const commit=git(['rev-parse','--verify','--end-of-options',requestedRef+'^{commit}']).toString().trim();
 const inputs=new Map(),files=[],assets=[],pending=[];
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
   if(!path.startsWith('assets/')&&!/^extra\/[^/]+\/[^/]+\/config\/[^/]+\.json$/.test(path))throw Error('JSON 引用超出来源配置目录：'+path);
   if(path.split('/').includes('..'))throw Error('JSON 引用超出来源配置目录：'+path);
   if(!inputs.has(path))inputs.set(path,committedText(path));
  }
 }
 // Evaluate only the verified metadata graph, never the renderer or production tools.
 const bundled=await build({absWorkingDir:source,stdin:{contents:"export {registry,defaultWallpaperId} from './web/src/wallpapers/registry.ts';export {validateCombination} from './web/src/content/package-contract.ts';export {validateSequenceManifest} from './web/src/content/sequence-manifest.ts';export {validateFramePatches} from './web/src/content/frame-patches.ts';",resolveDir:source,sourcefile:'metadata-entry.mjs'},bundle:true,write:false,metafile:true,format:'esm',platform:'node'});
 for(const path of Object.keys(bundled.metafile.inputs))if(path!=='metadata-entry.mjs'&&!inputs.has(path.replaceAll('\\','/')))throw Error('元数据引用未确认文件：'+path);
 const {registry,defaultWallpaperId,validateCombination,validateSequenceManifest,validateFramePatches}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
 const selected=[...registry.values()].filter(item=>item.wallpaper.presentation?.selectable);
 if(!selected.some(item=>item.wallpaper.id===defaultWallpaperId))throw Error('默认壁纸不在官方可选列表');
 const assetInputs=new Map(),expectedFrames=new Map();
 function collect(value){
  if(typeof value==='string'&&value.startsWith('assets/')){
   const path='web/public/'+assetPath(value),items=tree(path);
   if(!items.length||(!path.endsWith('/')&&!items.some(item=>item.path===path)))throw Error('来源缺少资源：'+path);
   for(const item of items)assetInputs.set(item.path,item);
  }else if(Array.isArray(value))value.forEach(collect);
  else if(value&&typeof value==='object')Object.values(value).forEach(collect);
 }
 function manifest(path){return JSON.parse(committedText('web/public/'+assetPath(path)).data.toString('utf8'));}
 for(const item of selected){
  const {character,scene,wallpaper}=validateCombination(item.character,item.scene,item.wallpaper);
  collect({character,scene,wallpaper});
  const original=manifest(character.assetRoot+'manifest.json'),hashes=validateSequenceManifest(original,character);
  hashes.forEach((hash,index)=>expectedFrames.set('web/public/'+character.assetRoot+character.pattern.replace('{frame:04}',String(index).padStart(4,'0')),hash));
  if(character.framePatches){
   const packed=validateFramePatches(manifest(character.framePatches.assetRoot+'manifest.json'),character,hashes);
   packed.hashes.forEach((hash,index)=>expectedFrames.set('web/public/'+character.framePatches.assetRoot+character.pattern.replace('{frame:04}',String(index).padStart(4,'0')),hash));
  }
 }
 for(const path of expectedFrames.keys())if(!assetInputs.has(path))throw Error('来源序列缺少帧：'+path);
 for(const item of [...assetInputs.values()].sort((a,b)=>a.path.localeCompare(b.path))){
  const data=readFileSync(join(source,item.path)),hash=sha(data);
  const blob=createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex');
  if(item.path.endsWith('.json'))committedText(item.path);
  else if(blob!==item.blob)throw Error('资源与已确认提交不同：'+item.path);
  if(expectedFrames.has(item.path)&&expectedFrames.get(item.path)!==hash)throw Error('序列 PNG 校验失败：'+item.path);
  const path=item.path.replace('web/public/','content/');
  pending.push({path,sourcePath:item.path,hash});assets.push({path,bytes:data.length,sha256:hash});
 }
 for(const [sourcePath,input] of inputs){
  const path='vendor/v3/'+sourcePath;
  pending.push({path,data:input.data,hash:sha(input.data)});files.push({path,sourcePath,sha256:sha(input.data),committedSha256:input.committedSha256});
 }
 // Validate the whole import first. Large atlases are copied one at a time.
 let changed=0;
 for(const {path,data,sourcePath,hash} of pending){
  const target=join(root,path);
  if(existsSync(target)&&sha(readFileSync(target))===hash)continue;
  mkdirSync(dirname(target),{recursive:true});const temporary=target+'.import-'+process.pid;
  try{
   if(data)writeFileSync(temporary,data);else copyFileSync(join(source,sourcePath),temporary);
   if(sha(readFileSync(temporary))!==hash)throw Error('复制期间来源改变：'+sourcePath);
   renameSync(temporary,target);changed++;
  }finally{rmSync(temporary,{force:true});}
 }
 const record={schemaVersion:1,recordedOn:new Date().toISOString().slice(0,10),sourceProject:'GENSHIN-FRONT-V3',sourceCommit:commit,baselineRecord:'content/source.json',purpose:'Accepted official web scenes and shared rendering fixes',gpuSelectionChanged:false,originalAtlasRetained:true,wallpapers:selected.map(item=>item.wallpaper.id),files,assets};
 writeFileSync(join(root,'content/engine-update.json'),JSON.stringify(record,null,2)+'\n');
 return {sourceCommit:commit,sourceFiles:files.length,assetFiles:assets.length,assetBytes:assets.reduce((n,a)=>n+a.bytes,0),changedFiles:changed,wallpapers:record.wallpapers};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await syncV3Engine({source:process.argv[2],requestedRef:process.argv[3]}),null,2));
