import {build} from 'esbuild';
import sharp from 'sharp';
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import library from '../electron/library.cjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const officialRoot=join(root,'content','official-videos');
const official=library.validateOfficialVideoCatalog(JSON.parse(readFileSync(join(officialRoot,'catalog.json'),'utf8')),officialRoot).wallpapers;
if(!existsSync(join(root,'content','source.json')))throw Error('请先运行 node scripts/import-v3.mjs');
const web=join(root,'web');mkdirSync(web,{recursive:true});
// Import content metadata without instantiating the renderer in the settings window.
const meta=join(root,'.cache','catalog.mjs');mkdirSync(dirname(meta),{recursive:true});
await build({stdin:{contents:"export {registry,defaultWallpaperId} from './vendor/v3/web/src/wallpapers/registry.ts';export {wallpaperCapabilities} from './vendor/v3/web/src/ui/wallpaper-capabilities.ts';",resolveDir:root,sourcefile:'catalog-entry.mjs'},outfile:meta,bundle:true,format:'esm',platform:'node'});
const {registry,defaultWallpaperId,wallpaperCapabilities}=await import(pathToFileURL(meta).href+'?build='+Date.now());
const selected=registry.get(defaultWallpaperId);
const engineUpdate=JSON.parse(readFileSync(join(root,'content/engine-update.json'),'utf8'));
const catalog={schemaVersion:1,contentVersion:'v3-'+engineUpdate.sourceCommit.slice(0,7),defaultWallpaperId,wallpapers:[...registry.values()].filter(item=>item.wallpaper.presentation?.selectable).map(item=>({id:item.wallpaper.id,kind:'scene',source:'official',name:item.character.displayName,sceneName:item.wallpaper.presentation.sceneName,thumbnail:item.wallpaper.presentation.thumbnail,canvas:item.wallpaper.canvas,fps:item.character.fps,frameCount:item.character.frameCount,controls:item.scene.controls,capabilities:wallpaperCapabilities(item.character,item.scene),presentation:item.wallpaper.presentation}))};
// Desktop playback always uses independent tiles when configured. Keep its full
// base frame and manifests; redundant full sequences remain in content/ for source delivery.
const omitted=new Set();
for(const {character,wallpaper} of registry.values())if(wallpaper.presentation?.selectable&&character.framePatches){
 for(let index=1;index<character.frameCount;index++)omitted.add(character.assetRoot+character.pattern.replace('{frame:04}',String(index).padStart(4,'0')));
}
const assetsOutput=resolve(web,'assets');if(dirname(assetsOutput)!==resolve(web))throw Error('场景资源输出位置无效');
rmSync(assetsOutput,{recursive:true,force:true});
cpSync(join(root,'content','assets'),assetsOutput,{recursive:true,filter:path=>!omitted.has(relative(join(root,'content'),path).replaceAll('\\','/'))});
cpSync(join(root,'content','v3-original.css'),join(assetsOutput,'v3-original.css'));
cpSync(join(root,'electron','wallpaper.html'),join(web,'index.html'));
cpSync(join(root,'electron','wallpaper.css'),join(assetsOutput,'desktop.css'));
await build({entryPoints:[join(root,'electron','wallpaper-renderer.mjs')],outfile:join(assetsOutput,'desktop.js'),bundle:true,format:'esm',platform:'browser',target:'chrome150',minify:true,define:{'import.meta.env.BASE_URL':'"/"'},legalComments:'eof'});
const officialOutput=resolve(web,'official-videos');if(dirname(officialOutput)!==resolve(web))throw Error('官方资源输出位置无效');
rmSync(officialOutput,{recursive:true,force:true});mkdirSync(officialOutput,{recursive:true});
for(const entry of official){
 for(const key of ['media','thumbnail']){const target=resolve(officialOutput,entry[key]);mkdirSync(dirname(target),{recursive:true});cpSync(resolve(officialRoot,entry[key]),target);}
 catalog.wallpapers.push({...entry,media:'official-videos/'+entry.media,thumbnail:'official-videos/'+entry.thumbnail});
}
writeFileSync(join(web,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
const sizes=[16,20,24,32,40,48,64,128,256],svg=readFileSync(join(root,'electron','assets','genshinexe.svg'));
const pngs=await Promise.all(sizes.map(size=>sharp(svg).resize(size,size).png().toBuffer()));
const directory=Buffer.alloc(6+16*sizes.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);let offset=directory.length;
pngs.forEach((data,i)=>{const entry=6+16*i;directory[entry]=directory[entry+1]=sizes[i]===256?0:sizes[i];directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);directory.writeUInt32LE(data.length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=data.length;});
writeFileSync(join(root,'electron','assets','genshinexe.ico'),Buffer.concat([directory,...pngs]));
writeFileSync(join(root,'electron','assets','tray.png'),pngs[4]);
console.log(`桌面网页已构建：${catalog.wallpapers.length} 款官方壁纸；默认 ${selected.wallpaper.id}，资源来自本项目。`);
