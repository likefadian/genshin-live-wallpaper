const {app,BrowserWindow}=require('electron');
const {mkdirSync,writeFileSync}=require('node:fs');
const {resolve,join,dirname}=require('node:path');
const {randomUUID}=require('node:crypto');
const {probeVideo}=require('./video-probe.cjs');
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
const profile=resolve(__dirname,'../.cache/video-probe',randomUUID());mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 try{
  if(!args.includes('--file')||!args.includes('--output'))throw Error('请提供 --file MP4 和 --output 结果路径');
  const metadata=await probeVideo(resolve(option('--file')),{timeoutMs:args.includes('--timeout-ms')?Number(option('--timeout-ms')):15000});
  if(BrowserWindow.getAllWindows().length)throw Error('视频检查窗口未释放');
  const output=resolve(option('--output'));mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(metadata)+'\n');app.exit(0);
 }catch(error){console.error(error.message);app.exit(1);}
});
