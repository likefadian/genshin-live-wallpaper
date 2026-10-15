const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {join,resolve,relative}=require('node:path');
const {tmpdir}=require('node:os');
const {startAssetServer}=require('../electron/asset-server.cjs');
async function fixture(t){
 const dir=fs.mkdtempSync(join(tmpdir(),'genshinexe-media-')),root=join(dir,'web'),video=join(dir,'private.mp4');
 fs.mkdirSync(root);fs.writeFileSync(join(root,'movie.mp4'),'0123456789');fs.writeFileSync(video,'0123456789');
 const entries=new Map([['local-video-test',video]]);
 const server=await startAssetServer(root,{resolveMedia:(id,kind)=>kind==='video'?entries.get(id)||null:null});
 t.after(async()=>{await server.close();const rel=relative(resolve(tmpdir()),dir);assert.ok(rel&&!rel.startsWith('..'));fs.rmSync(dir,{recursive:true,force:true});});
 return {server,entries};
}
test('MP4 完整读取和 HEAD 使用正确类型及长度',async t=>{
 const {server}=await fixture(t),get=await fetch(server.url+'/movie.mp4');
 assert.equal(get.status,200);assert.equal(get.headers.get('content-type'),'video/mp4');assert.equal(await get.text(),'0123456789');
 const head=await fetch(server.url+'/movie.mp4',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
});
test('MP4 Range 按真实文件字节响应，支持尾部和开放区间',async t=>{
 const {server}=await fixture(t);
 for(const [range,body,contentRange] of [['bytes=2-5','2345','bytes 2-5/10'],['bytes=6-','6789','bytes 6-9/10'],['bytes=-4','6789','bytes 6-9/10'],['bytes=8-99','89','bytes 8-9/10']]){
  const response=await fetch(server.url+'/movie.mp4',{headers:{Range:range}});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),contentRange);assert.equal(response.headers.get('content-length'),String(body.length));assert.equal(await response.text(),body);
 }
});
test('越界、倒序及多段 Range 有明确错误',async t=>{
 const {server}=await fixture(t);
 for(const Range of ['bytes=10-','bytes=5-2','bytes=0-1,5-6','bytes=-0','bytes=999999999999999999999-']){
  const response=await fetch(server.url+'/movie.mp4',{headers:{Range}});assert.equal(response.status,416);assert.equal(response.headers.get('content-range'),'bytes */10');await response.text();
 }
});
test('只有已登记媒体可读取，移除后的链接立即失效',async t=>{
 const {server,entries}=await fixture(t),url=server.url+'/user-wallpapers/local-video-test/video.mp4';
 const response=await fetch(url,{headers:{Range:'bytes=2-5'}});assert.equal(response.status,206);assert.equal(await response.text(),'2345');
 entries.clear();assert.equal((await fetch(url)).status,404);
 for(const path of ['/user-wallpapers/unknown/video.mp4','/user-wallpapers/local-video-test/library.json','/user-wallpapers/%2e%2e%5cprivate.mp4'])assert.ok([403,404].includes((await fetch(server.url+path)).status));
});
