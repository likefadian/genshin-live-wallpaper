const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {resolveUpdateSource}=require('../electron/update-source.cjs');
const {createUpdateController}=require('../electron/update-controller.cjs');

// Electron's updater cannot run under plain Node; emit its documented events at the boundary.
class Updater extends EventEmitter {
 async checkForUpdates(){this.emit('update-available',{version:'0.1.4',releaseNotes:'新版本说明'});}
 async downloadUpdate(){this.emit('download-progress',{percent:47,bytesPerSecond:1024,transferred:47,total:100});this.emit('update-downloaded',{version:'0.1.4'});}
 quitAndInstall(){}
}
const options=updater=>({updater,currentVersion:'0.1.3',packaged:true,source:{kind:'github',name:'GitHub Releases',url:'https://github.com/likefadian/genshin-live-wallpaper'}});

test('更新只在用户下载且校验成功后允许安装，普通退出不自动安装',async()=>{
 assert.equal(typeof createUpdateController,'function');
 const updater=new Updater(),controller=createUpdateController(options(updater));
 assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,false);
 assert.equal(updater.allowDowngrade,false);assert.equal(updater.allowPrerelease,false);
 assert.throws(()=>controller.install(),/下载/);
 await controller.check();assert.equal(controller.snapshot().status,'available');
 assert.equal(controller.snapshot().releaseNotes,'新版本说明');
 await controller.download();assert.equal(controller.snapshot().status,'downloaded');
 assert.equal(controller.snapshot().availableVersion,'0.1.4');
 controller.install();assert.equal(controller.snapshot().status,'installing');
 controller.dispose();
});

test('尚无GitHub发布版本与网络错误分别显示，不误报最新版',async()=>{
 assert.equal(typeof createUpdateController,'function');
 const updater=new Updater(),controller=createUpdateController(options(updater));
 updater.checkForUpdates=async()=>{throw Object.assign(Error('No release'),{code:'ERR_UPDATER_NO_PUBLISHED_VERSIONS'});};
 await controller.check();assert.equal(controller.snapshot().status,'no-release');
 updater.checkForUpdates=async()=>{throw Object.assign(Error('No published versions on GitHub'),{code:'ERR_XML_MISSED_ELEMENT'});};
 await controller.check();assert.equal(controller.snapshot().status,'no-release');
 updater.checkForUpdates=async()=>{throw Object.assign(Error('Unable to find latest version: connection timed out'),{code:'ERR_UPDATER_LATEST_VERSION_NOT_FOUND'});};
 await controller.check();assert.equal(controller.snapshot().status,'error');
 updater.checkForUpdates=async()=>{throw Object.assign(Error('connection timed out'),{code:'ETIMEDOUT'});};
 await controller.check();assert.equal(controller.snapshot().status,'error');
 assert.match(controller.snapshot().error,/timed out/);
 updater.checkForUpdates=async()=>updater.emit('update-not-available',{version:'0.1.3'});
 await controller.check();assert.equal(controller.snapshot().status,'current');
 controller.dispose();
});

test('下载失败清除安装资格，可重试；并发操作不重复请求',async()=>{
 assert.equal(typeof createUpdateController,'function');
 const updater=new Updater(),controller=createUpdateController(options(updater));
 let finish;updater.checkForUpdates=()=>new Promise(resolve=>{finish=()=>{updater.emit('update-available',{version:'0.1.4'});resolve();};});
 const checking=controller.check();await controller.check();assert.equal(controller.snapshot().status,'checking');
 await assert.rejects(controller.download(),/检查/);finish();await checking;
 updater.downloadUpdate=async()=>{throw Error('sha512 checksum mismatch');};
 await controller.download();assert.equal(controller.snapshot().status,'error');
 assert.equal(controller.snapshot().retry,'download');assert.throws(()=>controller.install(),/下载/);
 updater.downloadUpdate=Updater.prototype.downloadUpdate;
 await controller.download();assert.equal(controller.snapshot().status,'downloaded');
 controller.dispose();
});

test('验收源必须显式启用、使用专用配置且限定本机地址',()=>{
 assert.equal(typeof resolveUpdateSource,'function');
 const prod=resolveUpdateSource({argv:[],env:{}});
 assert.equal(prod.kind,'github');assert.equal(prod.url,'https://github.com/likefadian/genshin-live-wallpaper');
 const local={GENSHINEXE_VERIFY_UPDATE_URL:'http://127.0.0.1:9238/',GENSHINEXE_PROFILE:'D:/verify/genshin-profile',APPDATA:'D:/user/AppData/Roaming'};
 assert.throws(()=>resolveUpdateSource({argv:[],env:local}),/验收/);
 assert.throws(()=>resolveUpdateSource({argv:['--verify-update'],env:{...local,GENSHINEXE_PROFILE:''}}),/配置/);
 assert.throws(()=>resolveUpdateSource({argv:['--verify-update'],env:{...local,GENSHINEXE_PROFILE:'D:/user/AppData/Roaming/GenshinEXE'}}),/配置/);
 for(const url of ['https://example.com/','http://192.168.1.4/','http://127.0.0.1.evil.example/','http://user:pass@127.0.0.1/']){
  assert.throws(()=>resolveUpdateSource({argv:['--verify-update'],env:{...local,GENSHINEXE_VERIFY_UPDATE_URL:url}}),/本机/);
 }
 const verification=resolveUpdateSource({argv:['--verify-update'],env:local});
 assert.equal(verification.kind,'local-verification');
 assert.match(verification.feed.updaterCacheDirName,/^genshinexe-verify-[a-f0-9]{16}$/);
 const other=resolveUpdateSource({argv:['--verify-update'],env:{...local,GENSHINEXE_PROFILE:'D:/verify/another-profile'}});
 assert.notEqual(verification.feed.updaterCacheDirName,other.feed.updaterCacheDirName);
 assert.notEqual(verification.feed.updaterCacheDirName,'genshinexe-updater');
});
