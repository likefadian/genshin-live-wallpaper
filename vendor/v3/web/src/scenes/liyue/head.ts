import type {ScenePackage,LightKey} from '../../content/package-contract';
const night:Omit<LightKey,'minutes'|'name'>={direction:[-.48,-.48,.72],keyColor:[.2,.32,.55],ambient:[.23,.3,.42],lampDirection:[.72,.1,.66],lampColor:[.32,.2,.08],exposure:.95,backgroundTint:[.55,.68,.85],backgroundExposure:.9};
export const scene:ScenePackage={schemaVersion:1,id:'liyue-head',canvas:[1672,941],background:{path:'assets/scenes/liyue/head-v001/sky.png',rect:[912,0,432,400]},controls:{initialMinutes:390,previewMinutesPerSecond:45,presets:[{name:'晨光',minutes:390},{name:'白昼',minutes:720},{name:'黄昏',minutes:1080},{name:'夜景',minutes:1320}]},keyframes:[
{minutes:0,name:'夜景',...night},
{minutes:300,name:'黎明',direction:[-.78,-.16,.61],keyColor:[.72,.43,.29],ambient:[.32,.4,.48],lampDirection:[.72,.1,.66],lampColor:[.12,.07,.025],exposure:1,backgroundTint:[1.12,.82,.76],backgroundExposure:1.9},
{minutes:390,name:'晨光',direction:[-.68,-.28,.68],keyColor:[.85,.63,.4],ambient:[.48,.54,.58],lampDirection:[.72,.1,.66],lampColor:[0,0,0],exposure:1.02,backgroundTint:[1.05,.94,.86],backgroundExposure:2.9},
{minutes:720,name:'白昼',direction:[-.18,-.72,.67],keyColor:[.9,.91,.88],ambient:[.56,.6,.64],lampDirection:[.72,.1,.66],lampColor:[0,0,0],exposure:1.03,backgroundTint:[.9,1.04,1.12],backgroundExposure:3.6},
{minutes:1080,name:'黄昏',direction:[.78,-.2,.59],keyColor:[1,.49,.22],ambient:[.46,.41,.45],lampDirection:[.72,.1,.66],lampColor:[.06,.035,.012],exposure:1.03,backgroundTint:[1.24,.84,.72],backgroundExposure:2.35},
{minutes:1320,name:'夜景',...night},{minutes:1440,name:'夜景',...night}]};
