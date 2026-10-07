const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const REPOSITORY='https://github.com/likefadian/genshin-live-wallpaper';
function resolveUpdateSource({argv=process.argv,env=process.env}={}){
 const localUrl=env.GENSHINEXE_VERIFY_UPDATE_URL;
 if(!localUrl)return {kind:'github',name:'GitHub Releases',url:REPOSITORY};
 if(!argv.includes('--verify-update'))throw Error('本地更新验收必须显式启用 --verify-update');
 if(!env.GENSHINEXE_PROFILE||resolve(env.GENSHINEXE_PROFILE).toLowerCase()===resolve(env.APPDATA||'.','GenshinEXE').toLowerCase())throw Error('本地更新验收必须使用专用用户配置目录');
 const url=new URL(localUrl);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.search||url.hash)throw Error('更新验收地址仅允许无凭据的本机127.0.0.1 HTTP服务');
 const profileHash=createHash('sha256').update(resolve(env.GENSHINEXE_PROFILE).toLowerCase()).digest('hex').slice(0,16);
 return {kind:'local-verification',name:'本地更新验收',url:url.href,feed:{provider:'generic',url:url.href,updaterCacheDirName:'genshinexe-verify-'+profileHash}};
}
module.exports={resolveUpdateSource,REPOSITORY};
