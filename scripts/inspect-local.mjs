import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
// Optional local developer inspection. No debug endpoint is enabled in normal launches.
const port=Number(process.argv[2]||9237),action=process.argv[3]||'state';
const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const page=pages.find(p=>action==='wallpaper'?p.url.startsWith('http://127.0.0.1:'):p.url.startsWith('file:')&&p.url.endsWith('/settings/index.html'));
if(!page)throw Error('没有找到本地目标窗口');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((done,reject)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const waiting=new Map();
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(waiting.has(message.id)){const callback=waiting.get(message.id);waiting.delete(message.id);message.error?callback.reject(Error(message.error.message)):callback.done(message.result);}});
socket.addEventListener('close',()=>{for(const callback of waiting.values()){if(['quit','close'].includes(action))callback.done({result:{value:'目标窗口已关闭'}});else callback.reject(Error('调试窗口连接已关闭'));}waiting.clear();});
const call=(method,params={})=>new Promise((done,reject)=>{const current=++id;waiting.set(current,{done,reject});socket.send(JSON.stringify({id:current,method,params}));});
try{
 const expression=action==='quit'?'window.genshinDesktop.quit()':action==='apply'?'window.genshinDesktop.updateSettings('+process.argv[4]+')':action==='close'?'window.close()':action==='wallpaper'?`(async()=>({state:await window.genshinDesktop.getState(),ui:{visible:document.visibilityState,canvasCount:document.querySelectorAll('canvas').length,clockHidden:document.getElementById('wallpaper-clock').hidden,statusHidden:document.getElementById('status').hidden}}))()`:`(async()=>{const state=await window.genshinDesktop.getState();return {state,ui:{visible:document.visibilityState,title:document.title,status:document.getElementById('live-status').textContent,error:document.getElementById('error').textContent,portraitLoaded:document.getElementById('portrait').naturalWidth>0,bodyWidth:document.body.scrollWidth,viewport:innerWidth,canvasCount:document.querySelectorAll('canvas').length}};})()`;
 const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
 console.log(JSON.stringify(result.result.value,null,2));
 if(['state','wallpaper'].includes(action)){
  const screenshot=await call('Page.captureScreenshot',{format:'png'});mkdirSync('work',{recursive:true});writeFileSync(join('work',action==='wallpaper'?'wallpaper-live.png':'settings-live.png'),Buffer.from(screenshot.data,'base64'));
 }
}finally{socket.close();}
