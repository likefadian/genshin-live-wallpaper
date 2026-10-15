import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {cpSync,mkdirSync,symlinkSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),work=join(root,'work/mp4-wallpapers/delivery-'+Date.now()),project=join(work,'project'),fixture=join(root,'work/mp4-wallpapers/fixture.mp4');
mkdirSync(project,{recursive:true});
// All mutations and build output belong to this disposable copy. Dependencies are read only.
for(const directory of ['electron','scripts','content','vendor'])cpSync(join(root,directory),join(project,directory),{recursive:true});
cpSync(join(root,'package.json'),join(project,'package.json'));symlinkSync(join(root,'node_modules'),join(project,'node_modules'),'junction');
mkdirSync(join(project,'work/mp4-wallpapers'),{recursive:true});cpSync(join(root,'work/mp4-wallpapers/broken.mp4'),join(project,'work/mp4-wallpapers/broken.mp4'));
async function run(name,args=[],env={}){
 const child=spawn(process.execPath,[join(project,'scripts',name),...args],{cwd:project,windowsHide:true,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let output='';
 for(const pipe of [child.stdout,child.stderr])pipe.on('data',data=>{output+=data;if(name==='verify-mp4.mjs')process.stdout.write(data);});
 await new Promise((done,fail)=>{child.once('error',fail);child.once('exit',code=>code===0?done():fail(Error(output)));});return output;
}
await run('import-official-video.mjs',['--file',fixture,'--id','delivery-one','--name','构建验收一','--author','验收作者']);await run('prepare-web.mjs');
const catalog=JSON.parse(readFileSync(join(project,'web/catalog.json'),'utf8')),official=catalog.wallpapers.find(entry=>entry.id==='official-video-delivery-one');assert.ok(official);
for(const key of ['media','thumbnail'])assert.ok(existsSync(join(project,'web',official[key])));
await run('verify-mp4.mjs',[fixture],{GENSHINEXE_VERIFY_PROJECT:project,GENSHINEXE_VERIFY_OFFICIAL:'1'});
writeFileSync(join(work,'results.json'),JSON.stringify({project,checks:['author-import','generated-media','incremental-catalog','persistent-local-selection','removed-official-fallback']},null,2));
console.log('官方交付验收：'+work);
