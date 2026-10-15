const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {join,resolve,relative}=require('node:path');
const {tmpdir}=require('node:os');
const modulePath=resolve(__dirname,'../electron/library.cjs');
const libraryModule=fs.existsSync(modulePath)?require(modulePath):{};
const thumbnailDataURL='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=';
const metadata={width:640,height:360,duration:3,thumbnailDataURL};
const scene={id:'xiao-liyue-full',kind:'scene',source:'official',name:'魈',thumbnail:'portrait.png'};
function fixture(t,probeVideo=async()=>({...metadata})){
 const root=fs.mkdtempSync(join(tmpdir(),'genshinexe-library-'));
 t.after(()=>{const rel=relative(resolve(tmpdir()),resolve(root));assert.ok(rel&&!rel.startsWith('..'));fs.rmSync(root,{recursive:true,force:true});});
 assert.equal(typeof libraryModule.WallpaperLibrary,'function','需要实现本地壁纸库');
 const directory=join(root,'wallpapers');
 const open=()=>new libraryModule.WallpaperLibrary({directory,officialWallpapers:[scene],probeVideo});
 const source=(folder,content='video-bytes',name='夜景 壁纸.MP4')=>{fs.mkdirSync(join(root,folder),{recursive:true});const file=join(root,folder,name);fs.writeFileSync(file,content);return file;};
 return {root,directory,open,source,library:open()};
}
test('同名中文 MP4 分别保存，重启后保留且移除不删除原文件',async t=>{
 const f=fixture(t),sourceA=f.source('甲','video-a'),sourceB=f.source('乙','video-b');
 const a=await f.library.importLocal(sourceA),b=await f.library.importLocal(sourceB);
 assert.notEqual(a.id,b.id);assert.equal(a.name,'夜景 壁纸');
 assert.equal(fs.readFileSync(f.library.resolveMedia(a.id,'video'),'utf8'),'video-a');
 assert.match(a.media,/^\/user-wallpapers\/local-video-/);assert.ok(!JSON.stringify(a).includes(f.root));
 const reopened=f.open();assert.equal(reopened.get(a.id).width,640);assert.equal(reopened.get(b.id).duration,3);
 await reopened.removeLocal(a.id);
 assert.equal(reopened.get(a.id),null);assert.equal(f.open().get(a.id),null);
 assert.equal(fs.readFileSync(sourceA,'utf8'),'video-a');assert.equal(fs.readFileSync(sourceB,'utf8'),'video-b');
 assert.equal(reopened.get(b.id).id,b.id);
});
test('探测失败不登记半成品并保留有效清单',async t=>{
 let broken=false;const f=fixture(t,async()=>{if(broken)throw Error('无法解码');return metadata;});
 await f.library.importLocal(f.source('正常'));const before=fs.readFileSync(join(f.directory,'library.json'),'utf8');
 broken=true;await assert.rejects(f.library.importLocal(f.source('损坏')),/解码/);
 assert.equal(fs.readFileSync(join(f.directory,'library.json'),'utf8'),before);
 assert.equal(fs.readdirSync(join(f.directory,'local')).length,1);
});
test('清单写入失败回滚新作品，已有条目和原文件保留',async t=>{
 const f=fixture(t);const a=await f.library.importLocal(f.source('正常'));
 const file=join(f.directory,'library.json'),before=fs.readFileSync(file,'utf8');
 fs.mkdirSync(file+'.tmp');const original=f.source('新文件','original');
 await assert.rejects(f.library.importLocal(original));
 assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(f.library.get(a.id).id,a.id);
 assert.equal(fs.readdirSync(join(f.directory,'local')).length,1);assert.equal(fs.readFileSync(original,'utf8'),'original');
});
test('非 MP4、空文件和无效视频元数据不会导入',async t=>{
 const f=fixture(t);
 await assert.rejects(f.library.importLocal(f.source('格式','abc','image.txt')),/MP4/i);
 await assert.rejects(f.library.importLocal(f.source('空','','empty.mp4')));
 const invalid=fixture(t,async()=>({...metadata,duration:Infinity}));
 await assert.rejects(invalid.library.importLocal(invalid.source('时长无效')));
 assert.equal(f.library.snapshot().wallpapers.length,1);assert.equal(invalid.library.snapshot().wallpapers.length,1);
});
test('损坏清单保留磁盘媒体，缺失文件不可选且有提示',async t=>{
 const f=fixture(t),a=await f.library.importLocal(f.source('视频'));
 const path=f.library.resolveMedia(a.id,'video');fs.unlinkSync(path);
 const reopened=f.open();assert.equal(reopened.get(a.id),null);assert.ok(reopened.snapshot().warnings.length>0);
 fs.writeFileSync(join(f.directory,'library.json'),'{broken');
 const damaged=f.open();assert.equal(damaged.get(scene.id).id,scene.id);assert.ok(damaged.snapshot().warnings.length>0);
 assert.ok(fs.existsSync(join(f.directory,'local',a.id,'thumbnail.png')));
});
test('非法媒体 ID 和删除操作不能越过作品目录或移除官方作品',async t=>{
 const f=fixture(t),source=f.source('原始');await f.library.importLocal(source);
 for(const id of ['../原始','local-video-../../secret',scene.id,'missing']){
  assert.equal(f.library.resolveMedia(id,'video'),null);
  await assert.rejects(f.library.removeLocal(id));
 }
 assert.equal(f.library.resolveMedia(f.library.snapshot().wallpapers.find(x=>x.source==='local').id,'../library.json'),null);
 assert.equal(fs.readFileSync(source,'utf8'),'video-bytes');
});

test('官方视频清单拒绝重复 ID、越界路径和缺失资源',t=>{
 const f=fixture(t);assert.equal(typeof libraryModule.validateOfficialVideoCatalog,'function');
 const root=join(f.root,'official'),id='official-video-night';fs.mkdirSync(join(root,id),{recursive:true});
 fs.writeFileSync(join(root,id,'video.mp4'),'abc');fs.writeFileSync(join(root,id,'thumbnail.png'),Buffer.from(thumbnailDataURL.split(',')[1],'base64'));
 const entry={id,name:'夜景',author:'作者',duration:3,width:640,height:360,size:3,media:id+'/video.mp4',thumbnail:id+'/thumbnail.png'};
 const validate=rows=>libraryModule.validateOfficialVideoCatalog({schemaVersion:1,wallpapers:rows},root);
 assert.equal(validate([entry]).wallpapers[0].kind,'video');
 for(const rows of [[entry,entry],[{...entry,id:'../bad'}],[{...entry,media:'../private.mp4'}],[{...entry,media:join(f.root,'private.mp4')}],[{...entry,duration:NaN}],[{...entry,media:id+'/missing.mp4'}]])assert.throws(()=>validate(rows));
 const isolated=libraryModule.validateOfficialVideoCatalog({schemaVersion:1,wallpapers:[entry,{...entry,id:'official-video-missing',media:'missing.mp4'}]},root,{strict:false});
 assert.equal(isolated.wallpapers.length,1);assert.ok(isolated.warnings.length>0);
});
test('官方目录更新保留本地条目和用户的作品选择',async t=>{
 const f=fixture(t),local=await f.library.importLocal(f.source('本地'));
 const {SettingsStore}=require('../electron/settings.cjs'),store=new SettingsStore(join(f.root,'settings.json'));store.update({wallpaperId:local.id});
 const next=new libraryModule.WallpaperLibrary({directory:f.directory,officialWallpapers:[scene,{id:'official-video-new',name:'新增',kind:'video',source:'official'}],probeVideo:async()=>metadata});
 assert.equal(next.get(local.id).name,'夜景 壁纸');assert.equal(next.get('official-video-new').name,'新增');assert.equal(new SettingsStore(join(f.root,'settings.json')).settings.wallpaperId,local.id);
});
