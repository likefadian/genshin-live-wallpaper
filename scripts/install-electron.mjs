import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),cache=join(root,'.cache','electron');mkdirSync(cache,{recursive:true});
const env={...process.env,ELECTRON_CACHE:cache,electron_config_cache:cache};
function install(environment){return spawnSync(process.execPath,[join(root,'node_modules','electron','install.js')],{cwd:root,env:environment,stdio:'inherit',windowsHide:true});}
let result=install(env);
if(result.status!==0&&!env.ELECTRON_MIRROR){
 console.log('官方下载连接失败，使用镜像；仍通过 Electron 包内的 SHA-256 校验。');
 result=install({...env,ELECTRON_MIRROR:'https://registry.npmmirror.com/-/binary/electron/'});
}
if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
