import type {ScenePackage,LightKey} from '../../content/package-contract';
import atmosphere from '../../../../assets/scene/liyue/full-v001/atmosphere-v001.json';
import type {SceneAtmosphere} from '../../content/atmosphere';
import environment from '../../../../assets/scene/liyue/full-v001/environment-runtime-v002.json';
import type {SceneEnvironment} from '../../content/scene-environment';
import timeBackground from '../../../../assets/scene/liyue/time-plates-v001/background.json';
import type {TimeBackground} from '../../content/time-background';
const night:Omit<LightKey,'minutes'|'name'>={direction:[-.48,-.48,.72],keyColor:[.2,.32,.55],ambient:[.23,.3,.42],lampDirection:[.72,.1,.66],lampColor:[.32,.2,.08],exposure:.95,backgroundTint:[.23,.36,.68],backgroundExposure:.52};
export const scene:ScenePackage={schemaVersion:1,id:'liyue-full',canvas:[1672,941],background:{path:timeBackground.plates[1],rect:[0,0,1672,941],timeOfDay:timeBackground as unknown as TimeBackground},environment:environment as unknown as SceneEnvironment,atmosphere:atmosphere as unknown as SceneAtmosphere,controls:{initialMinutes:720,previewMinutesPerSecond:45,presets:[{name:'晨光',minutes:390},{name:'白昼',minutes:720},{name:'黄昏',minutes:1080},{name:'夜景',minutes:1320}]},keyframes:[
{minutes:0,name:'夜景',...night},
{minutes:300,name:'黎明',direction:[-.78,-.16,.61],keyColor:[.72,.43,.29],ambient:[.32,.4,.48],lampDirection:[.72,.1,.66],lampColor:[.12,.07,.025],exposure:1,backgroundTint:[.82,.66,.74],backgroundExposure:.72},
{minutes:390,name:'晨光',direction:[-.68,-.28,.68],keyColor:[.85,.63,.4],ambient:[.48,.54,.58],lampDirection:[.72,.1,.66],lampColor:[0,0,0],exposure:1.02,backgroundTint:[1.12,.9,.76],backgroundExposure:.94},
{minutes:720,name:'白昼',direction:[-.18,-.72,.67],keyColor:[.9,.91,.88],ambient:[.56,.6,.64],lampDirection:[.72,.1,.66],lampColor:[0,0,0],exposure:1.03,backgroundTint:[1,1,1],backgroundExposure:1},
{minutes:1080,name:'黄昏',direction:[.78,-.2,.59],keyColor:[1,.49,.22],ambient:[.46,.41,.45],lampDirection:[.72,.1,.66],lampColor:[.06,.035,.012],exposure:1.03,backgroundTint:[1.12,.66,.57],backgroundExposure:.85},
{minutes:1320,name:'夜景',...night},{minutes:1440,name:'夜景',...night}]};
