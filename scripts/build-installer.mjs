import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cache=join(root,'.cache');mkdirSync(cache,{recursive:true});
const env={...process.env,ELECTRON_CACHE:join(cache,'electron'),ELECTRON_BUILDER_CACHE:join(cache,'electron-builder'),CSC_IDENTITY_AUTO_DISCOVERY:'false'};
function run(file,args){const result=spawnSync(process.execPath,[file,...args],{cwd:root,env,stdio:'inherit',windowsHide:true});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
run(join(root,'scripts','prepare-web.mjs'),[]);
run(join(root,'node_modules','electron-builder','cli.js'),['--win','nsis','--x64','--publish','never']);
