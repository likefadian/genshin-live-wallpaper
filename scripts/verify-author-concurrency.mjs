import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const project=resolve(import.meta.dirname,'..'),work=join(project,'work/mp4-wallpapers/author-concurrency-'+Date.now()),catalogRoot=join(work,'catalog'),source=join(project,'work/mp4-wallpapers/fixture.mp4');mkdirSync(work,{recursive:true});
async function run(id,file=source){
 const child=spawn(process.execPath,[join(project,'scripts/import-official-video.mjs'),'--file',file,'--id',id,'--name',id,'--author','并发验收','--catalog-root',catalogRoot],{cwd:project,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',data=>output+=data);
 return new Promise((done,fail)=>{child.once('error',fail);child.once('close',code=>done({id,code,output}));});
}
const results=await Promise.all([run('one'),run('two')]);
assert.equal(results.filter(result=>result.code===0).length,1,'并发作者命令应明确拒绝其中一个，不能都成功却覆盖登记');
const rejected=results.find(result=>result.code!==0);assert.match(rejected.output,/正在|稍后/);
let catalog=JSON.parse(readFileSync(join(catalogRoot,'catalog.json'),'utf8'));assert.equal(catalog.wallpapers.length,1);assert.equal(readdirSync(catalogRoot).filter(name=>name.startsWith('official-video-')).length,1);
assert.ok(!existsSync(join(catalogRoot,'catalog.json.lock')));assert.equal((await run(rejected.id)).code,0);
catalog=JSON.parse(readFileSync(join(catalogRoot,'catalog.json'),'utf8'));assert.equal(catalog.wallpapers.length,2);assert.ok(!existsSync(join(catalogRoot,'catalog.json.lock')));
const beforeFailure=readFileSync(join(catalogRoot,'catalog.json'),'utf8');assert.notEqual((await run('broken',join(project,'work/mp4-wallpapers/broken.mp4'))).code,0);assert.ok(!existsSync(join(catalogRoot,'catalog.json.lock')));assert.ok(!existsSync(join(catalogRoot,'official-video-broken')));assert.equal(readFileSync(join(catalogRoot,'catalog.json'),'utf8'),beforeFailure);
writeFileSync(join(work,'results.json'),JSON.stringify({checks:['concurrent-rejected','successful-entry-preserved','retry-registers-second','lock-released','failed-probe-preserves-catalog-and-releases-lock'],results},null,2));console.log('作者并发登记验收：'+work);
