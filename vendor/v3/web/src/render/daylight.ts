import type {LightKey,ScenePackage,Triple} from '../content/package-contract';
function vector(a:Triple,b:Triple,t:number):Triple{return a.map((v,i)=>v+(b[i]-v)*t) as unknown as Triple}
export function daylight(scene:ScenePackage,minutes:number):LightKey{
  const m=((minutes%1440)+1440)%1440;const keys=scene.keyframes;let i=0;while(i<keys.length-2&&m>=keys[i+1].minutes)i++;
  const a=keys[i],b=keys[i+1];let t=(m-a.minutes)/(b.minutes-a.minutes);t=t*t*(3-2*t);
  return {minutes:m,name:t<.5?a.name:b.name,direction:vector(a.direction,b.direction,t),keyColor:vector(a.keyColor,b.keyColor,t),ambient:vector(a.ambient,b.ambient,t),lampDirection:vector(a.lampDirection,b.lampDirection,t),lampColor:vector(a.lampColor,b.lampColor,t),exposure:a.exposure+(b.exposure-a.exposure)*t,backgroundTint:vector(a.backgroundTint,b.backgroundTint,t),backgroundExposure:a.backgroundExposure+(b.backgroundExposure-a.backgroundExposure)*t};
}
