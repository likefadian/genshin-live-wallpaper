import calibration from '../../../../assets/xiao/materials/head-lighting-v016.json';
import layout from '../../../../assets/xiao/layers/head-layout-v022.json';
import type {CharacterPackage,Pair,Rect} from '../../content/package-contract';
export const character:CharacterPackage={schemaVersion:1,id:'xiao',displayName:'魈',canvas:layout.sourceSize as unknown as Pair,crop:layout.headCrop as unknown as Rect,fps:layout.animation.fps,frameCount:layout.animation.frameCount,atlasSize:[layout.headCrop[2]*2,layout.headCrop[3]*2],requiredChannels:['albedo','normal','material','shadow'],assetRoot:calibration.publication.replace('web/public/','')+'/',pattern:'frame-{frame:04}.png',materials:calibration.materials,shadow:calibration.shadow,aeProject:layout.aeProject};
