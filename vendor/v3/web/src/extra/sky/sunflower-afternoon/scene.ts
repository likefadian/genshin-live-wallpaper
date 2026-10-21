import publication from '../../../../../extra/sky/sunflower-afternoon/config/publication-warm-sun-v001.json' with {type:'json'};
import {character} from './character.ts';
import type {ScenePackage,LightKey} from '../../../content/package-contract.ts';
const afternoon:Omit<LightKey,'minutes'>={name:'午后',direction:[0,0,1],keyColor:[1,1,1],ambient:[0,0,0],lampDirection:[0,0,1],lampColor:[0,0,0],exposure:1,backgroundTint:[1,1,1],backgroundExposure:1};
export const scene:ScenePackage={
 schemaVersion:1,id:'extra-sky-sunflower-afternoon-scene',canvas:character.canvas,
 background:{path:publication.background,rect:[0,0,...character.canvas]},
 controls:{timeMode:'fixed',initialMinutes:720,previewMinutesPerSecond:45,presets:[{name:'午后',minutes:720}]},
 keyframes:[{minutes:0,...afternoon},{minutes:1440,...afternoon}]
};

