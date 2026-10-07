export type BackgroundWeights=readonly [number,number,number,number];
// Ordered full-frame plates: dawn, day, dusk, night. All share the scene rect.
export interface TimeBackground {plates:readonly [string,string,string,string];keyframes:readonly {minutes:number;weights:BackgroundWeights}[]}
export function validateTimeBackground(value:unknown):TimeBackground{
 const c=value as TimeBackground;
 if(!c||!Array.isArray(c.plates)||c.plates.length!==4||c.plates.some(p=>typeof p!=='string'||!p.trim()||/^(?:\/|\\|[a-z]+:)|(?:^|[\/\\])\.\.(?:[\/\\]|$)/i.test(p)))throw Error('time background plate path invalid');
 const keys=c.keyframes;
 if(!Array.isArray(keys)||keys.length<2||keys[0].minutes!==0||keys.at(-1)?.minutes!==1440||keys.some((k,i)=>!Number.isFinite(k.minutes)||(i>0&&k.minutes<=keys[i-1].minutes)))throw Error('time background keyframes must span one ordered day');
 for(const k of keys)if(!Array.isArray(k.weights)||k.weights.length!==4||k.weights.some((v:number)=>!Number.isFinite(v)||v<0||v>1)||Math.abs(k.weights.reduce((a:number,b:number)=>a+b,0)-1)>1e-6)throw Error('time background weights must be normalized');
 if(keys[0].weights.some((v:number,i:number)=>Math.abs(v-keys.at(-1)!.weights[i])>1e-6))throw Error('time background midnight weights must match');
 return c;
}
export function timeBackgroundAt(config:TimeBackground,minutes:number):BackgroundWeights{
 const m=((minutes%1440)+1440)%1440;const keys=config.keyframes;let i=0;
 while(i<keys.length-2&&m>=keys[i+1].minutes)i++;
 const a=keys[i],b=keys[i+1];const t=(m-a.minutes)/(b.minutes-a.minutes),s=t*t*(3-2*t);
 return a.weights.map((v,j)=>v+(b.weights[j]-v)*s) as unknown as BackgroundWeights;
}
