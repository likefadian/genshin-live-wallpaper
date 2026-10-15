const {createServer}=require('node:http');
const {createReadStream}=require('node:fs');
const {stat,realpath}=require('node:fs/promises');
const {extname,isAbsolute,relative,resolve}=require('node:path');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4'};
function byteRange(header,size){
 const match=/^bytes=(\d*)-(\d*)$/i.exec(header.trim());if(!match||(!match[1]&&!match[2])||size===0)return null;
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return null;end=Math.min(end,size-1);}
 return {start,end};
}
async function startAssetServer(root,{resolveMedia}={}){
 const absolute=resolve(root);
 const server=createServer(async(request,response)=>{
  const fail=(code,message)=>{response.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});response.end(message);};
  if(!['GET','HEAD'].includes(request.method)){fail(405,'Method not allowed');return;}
  let pathname;
  try{pathname=decodeURIComponent((request.url||'/').split('?')[0]);}catch{fail(400,'Malformed resource path');return;}
  if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').includes('..')){fail(403,'Forbidden');return;}
  let target,registered=false;
  if(pathname.startsWith('/user-wallpapers/')){
   const match=/^\/user-wallpapers\/([a-z\d-]+)\/(video\.mp4|thumbnail\.png)$/.exec(pathname);
   target=match&&resolveMedia?.(match[1],match[2]==='video.mp4'?'video':'thumbnail');
   if(!target){fail(404,'Wallpaper media not found');return;}registered=true;
  }else{
   target=resolve(absolute,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
   const rel=relative(absolute,target);if(rel.startsWith('..')||isAbsolute(rel)){fail(403,'Forbidden');return;}
  }
  try{
   const info=await stat(target);
   if(!info.isFile()){fail(404,'Resource not found');return;}
   if(!registered){const rel=relative(await realpath(absolute),await realpath(target));if(rel.startsWith('..')||isAbsolute(rel)){fail(403,'Forbidden');return;}}
   const range=request.method==='GET'&&request.headers.range?byteRange(request.headers.range,info.size):undefined;
   if(range===null){response.writeHead(416,{'Content-Range':'bytes */'+info.size,'Content-Length':0});response.end();return;}
   response.writeHead(range?206:200,{
    'Content-Type':types[extname(target).toLowerCase()]||'application/octet-stream',
    'Content-Length':range?range.end-range.start+1:info.size,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${info.size}`} : {}),'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'",
   });
   if(request.method==='HEAD'){response.end();return;}
   const stream=createReadStream(target,range||undefined);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);
  }catch(error){fail(error.code==='ENOENT'?404:500,error.code==='ENOENT'?'Resource not found':'Unable to read resource');}
 });
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise((done,reject)=>{server.close(error=>error?reject(error):done());server.closeAllConnections();})};
}
module.exports={startAssetServer};
