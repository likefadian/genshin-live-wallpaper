import {createServer} from 'node:http';
import {createReadStream,readFileSync,statSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),yaml=require('js-yaml');
const installer=resolve(process.argv[2]||'release/github-updates-v001/GenshinEXE-Setup-0.1.3-x64.exe');
const baseline=process.argv[3]?resolve(process.argv[3]):null;
const metadata=readFileSync(join(dirname(installer),'latest.yml'));
const document=yaml.load(metadata);
if(document.files?.[0]?.url!==basename(installer))throw Error('更新清单与目标安装器不一致');
const files=new Map([[basename(installer),installer],[basename(installer)+'.blockmap',installer+'.blockmap']]);
if(baseline){files.set(basename(baseline),baseline);files.set(basename(baseline)+'.blockmap',baseline+'.blockmap');}
let mode='corrupt',bytesSent=0;
const requests=[];
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 res.setHeader('Cache-Control','no-store');
 if(path==='/__verify'&&req.method==='GET'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode,version:document.version,bytesSent,requests}));return;
 }
 if(path==='/__verify/mode'&&req.method==='POST'){
  const chunks=[];let length=0;
  for await(const chunk of req){length+=chunk.length;if(length>64){res.writeHead(413).end();return;}chunks.push(chunk);}
  const next=Buffer.concat(chunks).toString().trim();
  if(!['corrupt','valid'].includes(next)){res.writeHead(400).end();return;}
  mode=next;res.end(mode);return;
 }
 requests.push({path,range:req.headers.range||null,mode,at:new Date().toISOString()});if(requests.length>200)requests.shift();
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
 if(path==='/latest.yml'){res.setHeader('Content-Type','application/yaml');res.setHeader('Content-Length',metadata.length);res.end(req.method==='HEAD'?undefined:metadata);return;}
 const filename=path.slice(1),file=files.get(filename);
 if(!file){res.writeHead(404).end('Missing update asset');return;}
 if(mode==='corrupt'&&file===installer){
  const payload=Buffer.from('deliberately-corrupt-update');res.setHeader('Content-Length',payload.length);bytesSent+=payload.length;res.end(payload);return;
 }
 const size=statSync(file).size;let start=0,end=size-1,status=200;
 if(req.headers.range){
  const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!range){res.writeHead(416,{'Content-Range':'bytes */'+size}).end();return;}
  start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));end=range[1]&&range[2]?Math.min(size-1,Number(range[2])):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size}).end();return;}
  status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
 }
 res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Length',end-start+1);res.writeHead(status);
 if(req.method==='HEAD'){res.end();return;}
 const stream=createReadStream(file,{start,end});stream.on('data',chunk=>bytesSent+=chunk.length);
 stream.on('error',error=>res.destroy(error));res.on('close',()=>stream.destroy());stream.pipe(res);
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+server.address().port+'/',mode,version:document.version,installer,localOnly:true})));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>server.close(()=>process.exit()));
