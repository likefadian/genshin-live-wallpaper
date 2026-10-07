const {spawn}=require('node:child_process');
const {join}=require('node:path');
function nativeHandle(window){const buffer=window.getNativeWindowHandle();return buffer.length>=8?buffer.readBigUInt64LE().toString():String(buffer.readUInt32LE());}
function hostCommand(script,args){
 return new Promise((done,reject)=>{
  const executable=join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const child=spawn(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='',err='';const timer=setTimeout(()=>{child.kill();reject(Error('连接桌面超时'));},12000);
  child.stdout.on('data',data=>{out=(out+data).slice(-16000);});child.stderr.on('data',data=>{err=(err+data).slice(-16000);});
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('close',code=>{clearTimeout(timer);if(code!==0){reject(Error(err.trim()||'桌面宿主失败：'+code));return;}try{done(JSON.parse(out.trim()));}catch(error){reject(error);}});
 });
}
function attachDesktop(window,screen,script){
 const bounds=screen.dipToScreenRect(window,screen.getPrimaryDisplay().bounds);
 return hostCommand(script,['-WindowHandle',nativeHandle(window),'-X',String(bounds.x),'-Y',String(bounds.y),'-Width',String(bounds.width),'-Height',String(bounds.height)]);
}
function checkDesktop(window,script,attachment){return hostCommand(script,['-CheckOnly','-WindowHandle',nativeHandle(window),'-ExpectedParent',String(attachment.parent),'-ExpectedIcons',String(attachment.icons)]);}
module.exports={attachDesktop,checkDesktop,nativeHandle};
