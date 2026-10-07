/** Bound decoded memory instead of retaining the same number of large and small atlases.
 * At least two frames are needed to keep the displayed bitmap pinned during replacement.
 * A sequence whose individual frames exceed the budget uses that minimum, not a lower resolution.
 */
export function frameBufferPlan(atlasSize:readonly number[],frameCount:number){
 if(atlasSize.length!==2||atlasSize.some(v=>!Number.isSafeInteger(v)||v<=0))throw Error('atlas dimensions invalid');
 if(!Number.isSafeInteger(frameCount)||frameCount<1)throw Error('frame count invalid');
 const bytesPerFrame=atlasSize[0]*atlasSize[1]*4,decodedBudgetBytes=128*1024*1024;
 if(!Number.isSafeInteger(bytesPerFrame))throw Error('atlas dimensions exceed precise byte accounting');
 const capacity=Math.max(2,Math.min(24,frameCount,Math.floor(decodedBudgetBytes/bytesPerFrame)));
 return {bytesPerFrame,decodedBudgetBytes,capacity,prefetchFrames:Math.min(frameCount,14,Math.max(2,capacity-2)),maxConcurrent:Math.min(4,frameCount)};
}
