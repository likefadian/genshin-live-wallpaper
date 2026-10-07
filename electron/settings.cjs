const {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync}=require('node:fs');
const {dirname}=require('node:path');

const DEFAULT_SETTINGS=Object.freeze({
 timeMode:'local',minutes:720,exposure:0,light:1,shadow:1,
 motion:true,speed:1,particles:true,lamps:true,rim:true,wind:true,bloom:true,grade:true,
 showClock:true,fit:'cover',quality:1,
});
const ranges={minutes:[0,1439],exposure:[-.8,.8],light:[.5,1.5],shadow:[0,1.3],speed:[.5,1.5]};
const choices={timeMode:['local','manual','cycle'],fit:['cover','contain'],quality:[1,1.5,2]};
function validatePatch(patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw TypeError('设置必须是对象');
 const checked={};
 for(const [key,value] of Object.entries(patch)){
  if(!Object.hasOwn(DEFAULT_SETTINGS,key))throw TypeError('未知设置项：'+key);
  if(ranges[key]){
   const [min,max]=ranges[key];
   if(!Number.isFinite(value)||value<min||value>max)throw TypeError('设置超出范围：'+key);
  }else if(choices[key]){
   if(!choices[key].includes(value))throw TypeError('设置值无效：'+key);
  }else if(typeof value!=='boolean')throw TypeError('设置开关无效：'+key);
  checked[key]=value;
 }
 return checked;
}
class SettingsStore{
 constructor(file,now=Date.now){
  this.file=file;this.now=now;this.settings={...DEFAULT_SETTINGS};this.revision=0;this.timeAnchor=now();
  if(existsSync(file)){
   try{
    const saved=JSON.parse(readFileSync(file,'utf8'));const settings=saved.settings??saved;
    for(const key of Object.keys(DEFAULT_SETTINGS)){
     if(!Object.hasOwn(settings,key))continue;
     try{Object.assign(this.settings,validatePatch({[key]:settings[key]}));}catch{/* Retain valid fields. */}
    }
   }catch{/* A damaged preferences file must not prevent startup. */}
  }
 }
 snapshot(){return {settings:{...this.settings},revision:this.revision,timeAnchor:this.timeAnchor};}
 update(patch){
  const checked=validatePatch(patch),next={...this.settings,...checked};
  const anchor=Object.hasOwn(checked,'minutes')||Object.hasOwn(checked,'timeMode')?this.now():this.timeAnchor;
  mkdirSync(dirname(this.file),{recursive:true});
  const temporary=this.file+'.tmp';writeFileSync(temporary,JSON.stringify({schemaVersion:1,settings:next},null,2)+'\n','utf8');
  renameSync(temporary,this.file);
  this.settings=next;this.timeAnchor=anchor;this.revision++;
  return this.snapshot();
 }
}
module.exports={DEFAULT_SETTINGS,SettingsStore,validatePatch};
