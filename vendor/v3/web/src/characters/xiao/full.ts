import calibration from '../../../../assets/xiao/materials/body-lighting-v016.json';
import headCalibration from '../../../../assets/xiao/materials/head-lighting-v016.json';
import layout from '../../../../assets/xiao/layers/body-layout-v015.json';
import headLayout from '../../../../assets/xiao/layers/head-layout-v022.json';
import wind from '../../../../assets/xiao/materials/wind-profile-v001.json';
import type {CharacterPackage,Pair,Rect,PaintedShading} from '../../content/package-contract';
export const character:CharacterPackage={schemaVersion:1,id:'xiao-full',displayName:'魈',canvas:layout.sourceSize as unknown as Pair,crop:layout.characterCrop as unknown as Rect,fps:headLayout.animation.fps,frameCount:headLayout.animation.frameCount,atlasSize:[layout.characterCrop[2]*2,layout.characterCrop[3]*2],requiredChannels:['albedo','normal','material','shadow'],assetRoot:calibration.publication.replace('web/public/','')+'/',pattern:'frame-{frame:04}.png',materials:[...headCalibration.materials,...calibration.materialAdditions].map(m=>({...m,...calibration.materialOverrides.find(o=>o.id===m.id)})),wind,shading:calibration.shading as unknown as PaintedShading,shadow:headCalibration.shadow,aeProject:layout.aeProject};
