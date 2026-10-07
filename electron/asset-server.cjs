const {createServer}=require('node:http');
const {createReadStream}=require('node:fs');
const {stat}=require('node:fs/promises');
const {extname,isAbsolute,relative,resolve}=require('node:path');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
async function startAssetServer(root){
 const absolute=resolve(root);
 const server=createServer(async(request,response)=>{
  const fail=(code,message)=>{response.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});response.end(message);};
  if(!['GET','HEAD'].includes(request.method)){fail(405,'Method not allowed');return;}
  let pathname;
  try{pathname=decodeURIComponent((request.url||'/').split('?')[0]);}catch{fail(400,'Malformed resource path');return;}
  if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').includes('..')){fail(403,'Forbidden');return;}
  const target=resolve(absolute,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
  const rel=relative(absolute,target);
  if(rel.startsWith('..')||isAbsolute(rel)){fail(403,'Forbidden');return;}
  try{
   const info=await stat(target);
   if(!info.isFile()){fail(404,'Resource not found');return;}
   response.writeHead(200,{
    'Content-Type':types[extname(target).toLowerCase()]||'application/octet-stream',
    'Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'",
   });
   if(request.method==='HEAD'){response.end();return;}
   const stream=createReadStream(target);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);
  }catch(error){fail(error.code==='ENOENT'?404:500,error.code==='ENOENT'?'Resource not found':'Unable to read resource');}
 });
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise((done,reject)=>{server.close(error=>error?reject(error):done());server.closeAllConnections();})};
}
module.exports={startAssetServer};
