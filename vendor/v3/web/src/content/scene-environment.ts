import type {Pair,Rect,Triple} from './package-contract';
export interface EnvironmentKey {minutes:number;skyTop:Triple;skyHorizon:Triple;cloudColor:Triple;cloudOpacity:number;emission:number;sun:number;moon:number;stars:number;fog:number}
export interface SceneLight {id:string;position:Triple;color:Triple;radiusPixels:number;strength:number;size:Pair;floating:boolean;swayPixels:Pair;periodSeconds:number;phase:number;falloff?:number;flicker?:{amount:number;frequencies:Pair}}
export interface SceneEnvironment {
 schemaVersion:1;dataPath:string;normalPath:string;lanternPath:string;globalLampScale:number;
 sky:{heightPixels:number;clouds:{path:string;rect:Rect;driftPixelsPerSecond:number;verticalOscillationPixels:number;periodSeconds:number;opacity:number};sun:{path:readonly [Pair,Pair,Pair];radiusPixels:number;riseMinutes:number;setMinutes:number};moon:{position:Pair;radiusPixels:number};stars:{density:number;brightness:number;seed:number}};
 water:{amplitudePixels:Pair;frequency:Pair;speed:Pair;reflectionStrength:number};
 lights:SceneLight[];shadow:{offsetPixels:number;softnessPixels:number;strength:number};keyframes:EnvironmentKey[];
}
function vector(v:unknown,n:number,label:string,nonnegative=false):number[]{if(!Array.isArray(v)||v.length!==n||v.some(x=>!Number.isFinite(x)||(nonnegative&&x<0)))throw Error('environment '+label+' invalid');return v}
function scalar(v:unknown,label:string,min=0,max=Infinity){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('environment '+label+' invalid')}
function path(v:unknown,label:string){if(typeof v!=='string'||!v.trim()||/^(?:[a-z]+:|\/)|(?:^|\/)\.\.(?:\/|$)/i.test(v))throw Error('environment '+label+' must be a relative asset path')}
function position(v:unknown,canvas:Pair,label:string,n=2){const p=vector(v,n,label);if(p[0]<0||p[1]<0||p[0]>canvas[0]||p[1]>canvas[1]||(n===3&&p[2]<=0))throw Error('environment '+label+' outside canvas / invalid depth')}
export function validateEnvironment(input:unknown,canvas:Pair):SceneEnvironment {
 if(!input||typeof input!=='object')throw Error('environment must be an object');const e=input as SceneEnvironment;
 if(e.schemaVersion!==1)throw Error('environment schemaVersion unsupported');
 for(const key of ['dataPath','normalPath','lanternPath'] as const)path(e[key],key);
 scalar(e.globalLampScale,'globalLampScale',0,1);
 if(!e.sky||!e.sky.clouds||!e.sky.sun||!e.sky.moon||!e.sky.stars||!e.water||!e.shadow)throw Error('environment layers missing');
 const sky=e.sky;scalar(sky.heightPixels,'sky heightPixels',1,canvas[1]);path(sky.clouds.path,'cloud path');const r=vector(sky.clouds.rect,4,'cloud rect');if(r[2]<=0||r[3]<=0)throw Error('environment cloud rect size invalid');
 scalar(sky.clouds.driftPixelsPerSecond,'cloud driftPixelsPerSecond',-100,100);scalar(sky.clouds.verticalOscillationPixels,'cloud verticalOscillationPixels',0,canvas[1]);scalar(sky.clouds.periodSeconds,'cloud periodSeconds',.01);scalar(sky.clouds.opacity,'cloud opacity',0,1);
 if(!Array.isArray(sky.sun.path)||sky.sun.path.length!==3)throw Error('environment sun path invalid');for(const p of sky.sun.path)position(p,canvas,'sun position');scalar(sky.sun.radiusPixels,'sun radiusPixels',.01);scalar(sky.sun.riseMinutes,'sun riseMinutes',0,1439);scalar(sky.sun.setMinutes,'sun setMinutes',1,1440);if(sky.sun.setMinutes<=sky.sun.riseMinutes)throw Error('environment sun duration invalid');
 position(sky.moon.position,canvas,'moon position');scalar(sky.moon.radiusPixels,'moon radiusPixels',.01);scalar(sky.stars.density,'stars density',1,2000);scalar(sky.stars.brightness,'stars brightness',0,2);scalar(sky.stars.seed,'stars seed');
 for(const key of ['amplitudePixels','frequency','speed'] as const)vector(e.water[key],2,'water '+key,true);scalar(e.water.reflectionStrength,'water reflectionStrength',0,4);
 if(!Array.isArray(e.lights)||e.lights.length>8)throw Error('environment lights limit is eight');if(new Set(e.lights.map(l=>l.id)).size!==e.lights.length)throw Error('environment lights ids must be unique');
 for(const l of e.lights){path(l.id,'light id');position(l.position,canvas,'light position',3);vector(l.color,3,'light color',true);vector(l.size,2,'light size',true);vector(l.swayPixels,2,'light swayPixels',true);if(typeof l.floating!=='boolean')throw Error('environment light floating missing');scalar(l.radiusPixels,'light radiusPixels',.01);scalar(l.strength,'light strength');scalar(l.periodSeconds,'light periodSeconds',.01);scalar(l.phase,'light phase');}
 for(const l of e.lights){if(l.falloff!==undefined)scalar(l.falloff,'light falloff',.00001,1);if(l.flicker){scalar(l.flicker.amount,'flicker amount',0,.4);const frequencies=vector(l.flicker.frequencies,2,'flicker frequencies');frequencies.forEach(v=>scalar(v,'flicker frequency',.01,20))}}
 scalar(e.shadow.offsetPixels,'shadow offsetPixels');scalar(e.shadow.softnessPixels,'shadow softnessPixels');scalar(e.shadow.strength,'shadow strength',0,1);
 if(!Array.isArray(e.keyframes)||e.keyframes.length<2||e.keyframes[0].minutes!==0||e.keyframes.at(-1)!.minutes!==1440)throw Error('environment keyframes must span one day');
 for(let i=0;i<e.keyframes.length;i++){const k=e.keyframes[i];scalar(k.minutes,'key minutes',0,1440);if(i&&k.minutes<=e.keyframes[i-1].minutes)throw Error('environment keyframes order invalid');for(const f of ['skyTop','skyHorizon','cloudColor'] as const)vector(k[f],3,f,true);for(const f of ['cloudOpacity','emission','sun','moon','stars','fog'] as const)scalar(k[f],f,0,1)}
 const a=e.keyframes[0],b=e.keyframes.at(-1)!;for(const key of Object.keys(a).filter(k=>k!=='minutes') as (keyof EnvironmentKey)[])if(JSON.stringify(a[key])!==JSON.stringify(b[key]))throw Error('environment midnight endpoints must match');
 return e;
}
