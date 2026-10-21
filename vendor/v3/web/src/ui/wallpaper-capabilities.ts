interface CharacterEffects {materials:readonly {diffuseStrength:number;specular:number;shadowStrength:number}[];shadow:{ambientOcclusionStrength:number};wind?:unknown}
interface SceneEffects {controls:{timeMode?:'cycle'|'fixed'};keyframes:readonly {lampColor:readonly number[]}[];environment?:{lights:readonly unknown[];shadow?:{strength:number}};atmosphere?:{rim:{strength:readonly number[]};bloom:{strength:readonly number[]};grade:unknown;emitters:readonly unknown[]}}
/** Only expose controls that operate on the configured scene/character data. */
export function wallpaperCapabilities(character:CharacterEffects,scene:SceneEffects){
 const a=scene.atmosphere,e=scene.environment;
 return {time:scene.controls.timeMode!=='fixed',light:character.materials.some(m=>m.diffuseStrength>0||m.specular>0),shadow:character.shadow.ambientOcclusionStrength>0||character.materials.some(m=>m.shadowStrength>0)||(e?.shadow?.strength??0)>0,lamps:!!e?.lights.length||scene.keyframes.some(k=>k.lampColor.some(v=>v>0)),rim:!!a?.rim.strength.some(v=>v>0),bloom:!!a?.bloom.strength.some(v=>v>0),grade:!!a?.grade,wind:!!(a&&character.wind),particles:!!a?.emitters.length};
}
