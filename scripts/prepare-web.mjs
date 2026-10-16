import {build} from 'esbuild';
import sharp from 'sharp';
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import library from '../electron/library.cjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const officialRoot=join(root,'content','official-videos');
const official=library.validateOfficialVideoCatalog(JSON.parse(readFileSync(join(officialRoot,'catalog.json'),'utf8')),officialRoot).wallpapers;
if(!existsSync(join(root,'content','source.json')))throw Error('请先运行 node scripts/import-v3.mjs');
const web=join(root,'web');mkdirSync(join(web,'assets'),{recursive:true});
cpSync(join(root,'content','assets'),join(web,'assets'),{recursive:true});
cpSync(join(root,'content','v3-original.css'),join(web,'assets','v3-original.css'));
cpSync(join(root,'electron','wallpaper.html'),join(web,'index.html'));
cpSync(join(root,'electron','wallpaper.css'),join(web,'assets','desktop.css'));
await build({entryPoints:[join(root,'electron','wallpaper-renderer.mjs')],outfile:join(web,'assets','desktop.js'),bundle:true,format:'esm',platform:'browser',target:'chrome150',minify:true,define:{'import.meta.env.BASE_URL':'"/"'},legalComments:'eof'});
// Import content metadata without instantiating the renderer in the settings window.
const meta=join(root,'.cache','catalog.mjs');mkdirSync(dirname(meta),{recursive:true});
await build({stdin:{contents:"export {registry,defaultWallpaperId} from './vendor/v3/web/src/wallpapers/registry.ts';",resolveDir:root,sourcefile:'catalog-entry.mjs'},outfile:meta,bundle:true,format:'esm',platform:'node'});
const {registry,defaultWallpaperId}=await import(pathToFileURL(meta).href+'?build='+Date.now());
const selected=registry.get(defaultWallpaperId);
const catalog={schemaVersion:1,contentVersion:'xiao-full-v016',defaultWallpaperId,wallpapers:[...registry.values()].filter(item=>item.wallpaper.presentation?.selectable).map(item=>({id:item.wallpaper.id,kind:'scene',source:'official',name:item.character.displayName,sceneName:item.wallpaper.presentation.sceneName,thumbnail:item.wallpaper.presentation.thumbnail,canvas:item.wallpaper.canvas,fps:item.character.fps,frameCount:item.character.frameCount,controls:item.scene.controls,presentation:item.wallpaper.presentation}))};
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
console.log(`桌面网页已构建：${selected.wallpaper.id} / ${selected.character.fps} FPS / ${selected.character.frameCount} 帧，资源来自本项目。`);
