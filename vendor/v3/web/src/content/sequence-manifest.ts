export interface SequenceIdentity {fps:number;frameCount:number;crop:readonly number[];atlasSize:readonly number[];requiredChannels:readonly string[]}
export function validateSequenceManifest(manifest:unknown,spec:SequenceIdentity):string[]{
 if(!manifest||typeof manifest!=='object')throw Error('sequence manifest must be an object');const data=manifest as Record<string,any>;
 if(data.schemaVersion!==1)throw Error('sequence schemaVersion unsupported');
 for(const key of ['fps','frameCount'] as const)if(data[key]!==spec[key])throw Error('sequence '+key+' mismatch');
 for(const key of ['crop','atlasSize','requiredChannels'] as const)if(!Array.isArray(data[key])||data[key].length!==spec[key].length||data[key].some((v:unknown,i:number)=>v!==spec[key][i]))throw Error('sequence '+key+' mismatch');
 if(!Array.isArray(data.frames)||data.frames.length!==spec.frameCount)throw Error('sequence frame records incomplete');
 return data.frames.map((record:any,i:number)=>{if(record.frame!==i)throw Error('sequence frame index mismatch at '+i);if(typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error('sequence sha256 missing at '+i);return record.sha256 as string});
}
