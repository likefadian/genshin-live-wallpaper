import type {SceneAtmosphere,TimeWeights,WindProfile} from '../content/atmosphere.ts';
export function smoothstep(a:number,b:number,value:number){const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t)}
export function atmosphereAt(config:SceneAtmosphere,minutes:number):TimeWeights{
 if(!Number.isFinite(minutes))throw Error('atmosphere minutes invalid');const m=((minutes%1440)+1440)%1440,keys=config.profiles;
 let i=0;while(i<keys.length-2&&m>=keys[i+1].minutes)i++;
 const a=keys[i],b=keys[i+1],t=smoothstep(a.minutes,b.minutes,m);
 return a.weights.map((v,j)=>v+(b.weights[j]-v)*t) as unknown as TimeWeights;
}
export function fireflyPopulation(config:SceneAtmosphere,w:TimeWeights){return Math.min(config.fireflies.nightCount,w[2]*config.fireflies.sunsetCount+w[3]*config.fireflies.nightCount)}
export function particlePopulation(config:SceneAtmosphere,w:TimeWeights):Record<string,number>{
 const result:Record<string,number>={};for(const e of config.emitters)result[e.kind]=(result[e.kind]??0)+e.count;
 for(const kind of Object.keys(result)){const visible=kind==='mist'||kind==='ray'?w[0]:kind==='dust'?Math.max(w[0],w[2]):kind==='butterfly'||kind==='kite'?w[1]:kind==='ember'?Math.max(w[2],w[3]):w[3];result[kind]=visible>.01?result[kind]:0}
 result.firefly=Math.round(fireflyPopulation(config,w));return result;
}
export function weighted(values:readonly number[],weights:TimeWeights){const sum=weights.reduce((a,b)=>a+b,0);return values.reduce((v,x,i)=>v+x*weights[i],0)/Math.max(sum,.001)}
export function weightedColor(values:readonly (readonly number[])[],weights:TimeWeights):[number,number,number]{return [0,1,2].map(i=>weighted(values.map(v=>v[i]),weights)) as [number,number,number]}
export function windAt(config:SceneAtmosphere,seconds:number,frame:number,fps:number,frameCount:number,profile:WindProfile){
 if(!Number.isFinite(seconds)||seconds<0||!Number.isFinite(frame)||fps<=0||frameCount<=0)throw Error('wind time invalid');
 const w=config.wind,slow=Math.sin(seconds*w.slowRadiansPerSecond)*w.slowAmplitude;
 const gust=smoothstep(w.gustThreshold,Math.min(1,w.gustThreshold+w.gustSoftness),Math.sin(seconds*w.gustRadiansPerSecond))*w.gustStrength;
 const strength=1+slow+gust,phase=((frame%frameCount)+frameCount)%frameCount/frameCount*Math.PI*2;
 return {strength,playbackRate:1+(strength-1)*w.playbackInfluence,signal:(Math.sin(phase*profile.primaryCycles)+profile.secondaryStrength*Math.sin(phase*profile.secondaryCycles+profile.secondaryPhase))*strength};
}
