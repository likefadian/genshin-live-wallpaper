import type {SceneControls} from '../content/package-contract.ts';
export interface RequestedTime {minutes:number;local:boolean;automatic:boolean}
export function resolveTimePolicy(controls:Pick<SceneControls,'initialMinutes'|'timeMode'>,requested:RequestedTime){
 if(controls.timeMode==='fixed')return {minutes:controls.initialMinutes,local:false,automatic:false,canChangeTime:false};
 return {...requested,canChangeTime:true};
}
export function resolveClockVisible(packageDefault:boolean|undefined,saved:unknown):boolean{
 return typeof saved==='boolean'?saved:packageDefault??true;
}
