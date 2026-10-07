import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(process.argv[2]||join(root,'..','GENSHIN-FRONT-V3'));
const official=join(source,'release','xiao-full-v002','web');
if(!existsSync(join(official,'index.html')))throw Error('缺少 V3 正式网页交付');
const vendor=join(root,'vendor','v3');
if(existsSync(join(root,'content','source.json')))throw Error('已导入 V3。更新内容请先审阅来源，不覆盖当前版本。');
mkdirSync(join(vendor,'web'),{recursive:true});
cpSync(join(source,'web','src'),join(vendor,'web','src'),{recursive:true});
const imported=[];
function record(path,from){imported.push({path:relative(root,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(from)).digest('hex')});}
function scan(folder){for(const entry of readdirSync(folder,{withFileTypes:true})){
 const path=join(folder,entry.name);
 if(entry.isDirectory()){scan(path);continue;}
 record(join(vendor,relative(source,path)),path);
 if(!entry.name.endsWith('.ts'))continue;
 for(const match of readFileSync(path,'utf8').matchAll(/from\s*['"]([^'"]+\.json)['"]/g)){
  const original=resolve(dirname(path),match[1]);
  if(!original.startsWith(source+'\\'))throw Error('JSON 引用超出 V3');
  const destination=join(vendor,relative(source,original));
  mkdirSync(dirname(destination),{recursive:true});cpSync(original,destination);record(destination,original);
 }
}}
scan(join(source,'web','src'));
const calibration=JSON.parse(readFileSync(join(source,'assets','xiao','materials','body-lighting-v016.json'),'utf8'));
const atlasRelative=calibration.publication.replace('web/public/','');
const assets=join(root,'content','assets');
const atlasTarget=join(root,'content',atlasRelative);mkdirSync(dirname(atlasTarget),{recursive:true});
cpSync(join(official,atlasRelative),atlasTarget,{recursive:true});
mkdirSync(join(assets,'characters','xiao'),{recursive:true});
cpSync(join(official,'assets','characters','xiao','portrait.png'),join(assets,'characters','xiao','portrait.png'));
cpSync(join(official,'assets','scenes'),join(assets,'scenes'),{recursive:true});
const css=readdirSync(join(official,'assets')).find(name=>name.endsWith('.css'));
cpSync(join(official,'assets',css),join(root,'content','v3-original.css'));
record(join(root,'content','v3-original.css'),join(official,'assets',css));
writeFileSync(join(root,'content','source.json'),JSON.stringify({schemaVersion:1,importedOn:'2026-10-07',sourceProject:'GENSHIN-FRONT-V3',officialWeb:'release/xiao-full-v002/web',wallpaperId:'xiao-liyue-full',atlas:atlasRelative,referenceHost:'varesaEXE/electron/wallpaper-host.ps1',files:imported},null,2)+'\n');
console.log('已导入 V3 实际源码与正式资源：'+atlasRelative+'（未改 V3）');
