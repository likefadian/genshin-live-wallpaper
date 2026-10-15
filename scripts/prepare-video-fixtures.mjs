import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const work=resolve(import.meta.dirname,'../work/mp4-wallpapers');mkdirSync(work,{recursive:true});
function ffmpeg(args){const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});if(result.error)throw Error('验收 fixture 需要 PATH 中的 ffmpeg：'+result.error.message);if(result.status!==0)throw Error(result.stderr);}
ffmpeg(['-f','lavfi','-i','testsrc2=size=640x360:rate=24','-f','lavfi','-i','sine=frequency=180:sample_rate=44100','-t','3','-c:v','libx264','-preset','ultrafast','-crf','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','64k','-shortest',join(work,'fixture.mp4')]);
ffmpeg(['-f','lavfi','-i','sine=frequency=180:sample_rate=44100','-t','1','-c:a','aac','-vn',join(work,'audio-only.mp4')]);
writeFileSync(join(work,'broken.mp4'),'not an MP4 video\n');console.log('验收视频已生成：'+work);
