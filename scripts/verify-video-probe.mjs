import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),cli=join(root,'electron/probe-video-cli.cjs'),work=join(root,'work/mp4-wallpapers');
assert.ok(existsSync(cli),'需要实现实际 MP4 探测入口');mkdirSync(work,{recursive:true});
function run(name,file,extra=[]){
 const output=join(work,name+'.json'),result=spawnSync(join(root,'node_modules/electron/dist/electron.exe'),[cli,'--file',resolve(file),'--output',output,...extra],{cwd:root,windowsHide:true,encoding:'utf8',timeout:25000});
 return {...result,output};
}
const good=run('probe',join(work,'fixture.mp4'));assert.equal(good.status,0,good.stderr||good.error?.message);
const info=JSON.parse(readFileSync(good.output,'utf8'));assert.equal(info.width,640);assert.equal(info.height,360);assert.ok(Math.abs(info.duration-3)<.1);
const png=Buffer.from(info.thumbnailDataURL.split(',')[1],'base64');assert.equal(png.readUInt32BE(16),360);assert.equal(png.readUInt32BE(20),203);writeFileSync(join(work,'probe-thumbnail.png'),png);
for(const name of ['broken','audio-only']){const result=run('probe-'+name,join(work,name+'.mp4'));assert.notEqual(result.status,0);assert.match(result.stderr,/视频|MP4|解码/);}
const timeout=run('probe-timeout',join(work,'fixture.mp4'),['--timeout-ms','1']);assert.notEqual(timeout.status,0);assert.match(timeout.stderr,/超时/);
if(process.argv[2]){const actual=run('probe-user',process.argv[2]);assert.equal(actual.status,0,actual.stderr);const data=JSON.parse(readFileSync(actual.output,'utf8'));assert.ok(data.width>0&&data.height>0&&Number.isFinite(data.duration)&&data.duration>0);writeFileSync(join(work,'user-thumbnail.png'),Buffer.from(data.thumbnailDataURL.split(',')[1],'base64'));}
console.log('MP4 探测通过：首帧缩略图、损坏文件、仅音频、超时清理'+(process.argv[2]?'、用户视频':''));
