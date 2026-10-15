const {test}=require('node:test');
const assert=require('node:assert/strict');
const {existsSync}=require('node:fs');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const file=resolve(__dirname,'../electron/wallpaper-controller.mjs');
const deferred=()=>{let finish,fail;const promise=new Promise((yes,no)=>{finish=yes;fail=no;});return {promise,finish,fail};};
async function factory(){const mod=existsSync(file)?await import(pathToFileURL(file).href):{};assert.equal(typeof mod.createWallpaperController,'function');return mod.createWallpaperController;}
const tick=()=>new Promise(done=>setImmediate(done));
test('迟到播放器不能覆盖最新选择，旧实例只释放一次',async()=>{
 const create=await factory(),a=deferred(),b=deferred(),ready=[],released=[];
 const controller=create({createScene:()=>a.promise,createVideo:()=>b.promise,onReady:entry=>ready.push(entry.id),onError:()=>{}});
 const first=controller.select({id:'A',kind:'scene'});await tick();
 const second=controller.select({id:'B',kind:'video'});b.finish({destroy:()=>released.push('B')});await second;
 a.finish({destroy:()=>released.push('A')});await first;
 assert.equal(controller.current.entry.id,'B');assert.deepEqual(ready,['B']);assert.deepEqual(released,['A']);
 controller.destroy();controller.destroy();assert.deepEqual(released,['A','B']);
});
test('同一作品加载中更新设置不重复创建，销毁后不接受迟到结果',async()=>{
 const create=await factory(),pending=deferred();let created=0,released=0;
 const controller=create({createVideo:()=>{created++;return pending.promise;},onReady:()=>assert.fail('销毁后不应应用作品'),onError:()=>{}});
 const a=controller.select({id:'A',kind:'video'}),b=controller.select({id:'A',kind:'video'});await tick();assert.equal(created,1);
 controller.destroy();pending.finish({destroy:()=>released++});assert.equal(await a,null);assert.equal(await b,null);assert.equal(released,1);
});
test('旧作品加载错误或运行错误不能污染当前作品',async()=>{
 const create=await factory(),pending=deferred(),errors=[];let oldError;
 const controller=create({createScene:(_entry,{onError})=>{oldError=onError;return pending.promise;},createVideo:async()=>({destroy(){}}),onReady(){},onError:(entry,error)=>errors.push([entry.id,error.message])});
 const first=controller.select({id:'A',kind:'scene'});await tick();await controller.select({id:'B',kind:'video'});
 oldError(Error('旧错误'));pending.fail(Error('旧加载错误'));await first;assert.deepEqual(errors,[]);assert.equal(controller.current.entry.id,'B');controller.destroy();
});
