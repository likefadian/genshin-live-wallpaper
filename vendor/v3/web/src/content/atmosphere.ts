import type {Pair,Rect,Triple} from './package-contract';

export type TimeWeights=readonly [number,number,number,number];
export type ParticleKind='mist'|'ray'|'dust'|'butterfly'|'kite'|'firefly'|'star'|'ember';
export interface ParticleEmitter {kind:ParticleKind;layer:'behind'|'front';count:number;rect:Rect;size:Pair;stretch:Pair;opacity:number;color:Triple;speed:number}
export interface WindProfile {primaryCycles:number;secondaryCycles:number;secondaryPhase:number;secondaryStrength:number}
export interface SceneAtmosphere {
 schemaVersion:1;seed:number;profiles:{minutes:number;weights:TimeWeights}[];
 fireflies:{sunsetCount:number;nightCount:number};emitters:ParticleEmitter[];
 wind:{slowRadiansPerSecond:number;slowAmplitude:number;gustRadiansPerSecond:number;gustStrength:number;gustThreshold:number;gustSoftness:number;playbackInfluence:number};
 rim:{strength:TimeWeights;colors:readonly [Triple,Triple,Triple,Triple];edgeWidthPixels:number};
 bloom:{threshold:number;softKnee:number;strength:TimeWeights;radius:number;downsample:number;characterGain:number};
 grade:{tint:readonly [Triple,Triple,Triple,Triple];saturation:TimeWeights;contrast:TimeWeights;nightGrain:number};
}

function scalar(v:unknown,label:string,min:number,max:number){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('atmosphere '+label+' invalid')}
function vector(v:unknown,length:number,label:string,min=0,max=Infinity):number[]{if(!Array.isArray(v)||v.length!==length)throw Error('atmosphere '+label+' invalid');v.forEach(n=>scalar(n,label,min,max));return v}
export function validateAtmosphere(input:unknown,canvas:Pair):SceneAtmosphere{
 if(!input||typeof input!=='object')throw Error('atmosphere missing');const c=input as SceneAtmosphere;
 if(c.schemaVersion!==1)throw Error('atmosphere schemaVersion unsupported');scalar(c.seed,'seed',0,0xffffffff);
 if(!Array.isArray(c.profiles)||c.profiles.length<2||c.profiles[0].minutes!==0||c.profiles.at(-1)!.minutes!==1440)throw Error('atmosphere profiles must span one day');
 c.profiles.forEach((p,i)=>{scalar(p.minutes,'minutes',0,1440);if(i&&p.minutes<=c.profiles[i-1].minutes)throw Error('atmosphere profiles out of order');if(vector(p.weights,4,'weights',0,1).reduce((a,b)=>a+b,0)===0)throw Error('atmosphere weights empty')});
 if(JSON.stringify(c.profiles[0].weights)!==JSON.stringify(c.profiles.at(-1)!.weights))throw Error('atmosphere midnight endpoints differ');
 if(!Array.isArray(c.emitters)||c.emitters.length>32)throw Error('atmosphere emitters invalid');let total=0,fireflies=0;
 for(const e of c.emitters){if(!['mist','ray','dust','butterfly','kite','firefly','star','ember'].includes(e.kind)||!['behind','front'].includes(e.layer))throw Error('atmosphere emitter kind/layer invalid');scalar(e.count,'count',1,256);if(!Number.isInteger(e.count))throw Error('atmosphere count must be integer');total+=e.count;if(e.kind==='firefly')fireflies+=e.count;
  const r=vector(e.rect,4,'rect');if(r[2]<=0||r[3]<=0||r[0]+r[2]>canvas[0]||r[1]+r[3]>canvas[1])throw Error('atmosphere rect outside canvas');const size=vector(e.size,2,'size',.01,canvas[0]);if(size[0]>size[1])throw Error('atmosphere size must increase');vector(e.stretch,2,'stretch',.01,20);vector(e.color,3,'color',0,4);scalar(e.opacity,'opacity',0,1);scalar(e.speed,'speed',0,100);
 }
 if(total>512)throw Error('atmosphere total count exceeds 512');if(!c.fireflies)throw Error('atmosphere fireflies missing');scalar(c.fireflies.sunsetCount,'sunsetCount',0,fireflies);scalar(c.fireflies.nightCount,'nightCount',0,fireflies);
 if(!c.wind||!c.rim||!c.bloom||!c.grade)throw Error('atmosphere effects missing');const w=c.wind;
 scalar(w.slowRadiansPerSecond,'wind slow rate',.001,2);scalar(w.slowAmplitude,'wind slow amplitude',0,.5);scalar(w.gustRadiansPerSecond,'gust rate',.001,2);scalar(w.gustStrength,'gust strength',0,1);scalar(w.gustThreshold,'gust threshold',0,.95);scalar(w.gustSoftness,'gust softness',.01,1);scalar(w.playbackInfluence,'playback influence',0,.3);
 vector(c.rim.strength,4,'rim strength',0,1);scalar(c.rim.edgeWidthPixels,'rim edge width',.25,8);vector(c.bloom.strength,4,'bloom strength',0,1);scalar(c.bloom.threshold,'bloom threshold',.1,4);scalar(c.bloom.softKnee,'bloom knee',.001,1);scalar(c.bloom.radius,'bloom radius',.1,4);scalar(c.bloom.downsample,'bloom downsample',2,8);scalar(c.bloom.characterGain,'bloom characterGain',0,1);
 for(const [key,values] of [['rim colors',c.rim.colors],['grade tint',c.grade.tint]] as const){if(!Array.isArray(values)||values.length!==4)throw Error('atmosphere '+key+' invalid');values.forEach(v=>vector(v,3,key,0,2))}
 vector(c.grade.saturation,4,'grade saturation',0,2);vector(c.grade.contrast,4,'grade contrast',.5,1.5);scalar(c.grade.nightGrain,'grain',0,.02);
 return c;
}
