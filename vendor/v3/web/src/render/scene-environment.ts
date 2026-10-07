import type {SceneEnvironment,EnvironmentKey,SceneLight} from '../content/scene-environment';
import type {Triple} from '../content/package-contract';
export function environmentAt(env:SceneEnvironment,minutes:number):EnvironmentKey {
 const m=((minutes%1440)+1440)%1440,k=env.keyframes;let i=0;while(i<k.length-2&&m>=k[i+1].minutes)i++;
 const a=k[i],b=k[i+1];const phase=(m-a.minutes)/(b.minutes-a.minutes),t=phase*phase*(3-2*phase);
 const mix=(x:number,y:number)=>x+(y-x)*t;
 const triple=(x:Triple,y:Triple):Triple=>[mix(x[0],y[0]),mix(x[1],y[1]),mix(x[2],y[2])];
 return {minutes:m,skyTop:triple(a.skyTop,b.skyTop),skyHorizon:triple(a.skyHorizon,b.skyHorizon),cloudColor:triple(a.cloudColor,b.cloudColor),cloudOpacity:mix(a.cloudOpacity,b.cloudOpacity),emission:mix(a.emission,b.emission),sun:mix(a.sun,b.sun),moon:mix(a.moon,b.moon),stars:mix(a.stars,b.stars),fog:mix(a.fog,b.fog)};
}
export interface MovingLight extends SceneLight {flickerRatio:number}
export function environmentLights(env:SceneEnvironment,seconds:number):MovingLight[]{
 return env.lights.map(l=>{
  const f=l.flicker,ratio=f?1+f.amount*(.65*Math.sin(seconds*f.frequencies[0]+l.phase)+.35*Math.sin(seconds*f.frequencies[1]+l.phase*1.7)):1;
  const a=seconds/l.periodSeconds*Math.PI*2+l.phase;
  const position:SceneLight['position']=l.floating?[l.position[0]+Math.sin(a)*l.swayPixels[0],l.position[1]+Math.sin(a*.5+l.phase)*l.swayPixels[1],l.position[2]]:[...l.position];
  return {...l,position,strength:l.strength*ratio,flickerRatio:ratio};
 });
}
