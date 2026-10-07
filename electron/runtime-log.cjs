const {existsSync,mkdirSync,appendFileSync,renameSync,statSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
function createLog(userData){
 const directory=join(userData,'logs');mkdirSync(directory,{recursive:true});const file=join(directory,'runtime.log');
 return {directory,write(event,details={}){try{if(existsSync(file)&&statSync(file).size>2*1024*1024)renameSync(file,join(directory,'runtime.previous.log'));appendFileSync(file,JSON.stringify({at:new Date().toISOString(),event,...details})+'\n');}catch(error){console.error('日志写入失败：'+error.message);}},state(value){try{writeFileSync(join(directory,'runtime-state.json'),JSON.stringify(value,null,2)+'\n');}catch{/* A logging error must not interrupt wallpaper rendering. */}}};
}
module.exports={createLog};
