import publication from '../../../../../extra/sky/sunflower-afternoon/config/publication-warm-sun-v001.json' with {type:'json'};
import type {CharacterPackage,Pair,Rect} from '../../../content/package-contract.ts';
export const character:CharacterPackage={
 schemaVersion:1,id:publication.id,displayName:'光遇',canvas:publication.canvas as unknown as Pair,crop:publication.crop as unknown as Rect,
 fps:publication.fps,frameCount:publication.frameCount,atlasSize:publication.atlasSize as unknown as Pair,requiredChannels:publication.requiredChannels,
 assetRoot:publication.assetRoot,pattern:publication.pattern,framePatches:publication.framePatches,
 materials:[{id:1,name:'固定午后原光色',diffuseFloor:1,diffuseStrength:0,specular:0,shininess:1,shadowStrength:0}],
 shadow:{maxOffsetPixels:0,softnessPixels:0,ambientOcclusionStrength:0},aeProject:publication.aeProject
};

