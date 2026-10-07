function validateTiming(fps:number,frameCount:number) {
  if(!Number.isFinite(fps)||fps<=0)throw new Error('fps must be finite and positive');
  if(!Number.isSafeInteger(frameCount)||frameCount<=0)throw new Error('frameCount must be a positive integer');
}

export function animationFrame(time:number,fps:number,frameCount:number):number {
  validateTiming(fps,frameCount);
  if(!Number.isFinite(time)||time<0)throw new Error('time must be finite and nonnegative');
  const position=time*fps;
  if(!Number.isFinite(position)||position>Number.MAX_SAFE_INTEGER)throw new Error('time exceeds precise frame indexing');
  // A timestamp mathematically on a frame boundary may be a few ulps below it.
  return Math.floor(position+Number.EPSILON*Math.max(1,position)*8)%frameCount;
}

export class PlaybackClock {
  readonly fps:number;readonly frameCount:number;
  private elapsedSeconds=0;
  private lastTimestamp:number|null=null;
  private paused=false;
  private playbackRate=1;
  lightingMinutes=0;
  constructor(fps:number,frameCount:number) {
    validateTiming(fps,frameCount);this.fps=fps;this.frameCount=frameCount;
  }
  get frame() {return animationFrame(this.elapsedSeconds,this.fps,this.frameCount);}
  get seconds() {return this.elapsedSeconds;}
  tick(timestampMs:number) {
    if(!Number.isFinite(timestampMs)||timestampMs<0)throw new Error('timestamp must be finite and nonnegative');
    if(this.paused)return this.frame;
    if(this.lastTimestamp!==null) {
      if(timestampMs<this.lastTimestamp)throw new Error('timestamp must be monotonic');
      this.elapsedSeconds+=(timestampMs-this.lastTimestamp)/1000*this.playbackRate;
    }
    this.lastTimestamp=timestampMs;return this.frame;
  }
  setLightingMinutes(minutes:number) {
    if(!Number.isFinite(minutes))throw new Error('lighting minutes must be finite');
    this.lightingMinutes=((minutes%1440)+1440)%1440;
  }
  setPlaybackRate(rate:number) {
    if(!Number.isFinite(rate)||rate<.25||rate>2)throw new Error('playback rate outside supported range');
    this.playbackRate=rate;
  }
  setPaused(paused:boolean) {
    if(this.paused!==paused){this.paused=paused;this.lastTimestamp=null;}
  }
}

/** Presentation cadence is independent of the sampled animation's playback speed. */
export class RenderCadence {
 private intervalMs:number;private next:number|null=null;
 constructor(fps:number){validateTiming(fps,1);this.intervalMs=1000/fps}
 due(timestampMs:number,force=false){
  if(!Number.isFinite(timestampMs)||timestampMs<0)throw Error('render timestamp invalid');
  if(this.next===null||force||timestampMs-this.next>this.intervalMs*2){this.next=timestampMs+this.intervalMs;return true}
  if(timestampMs+1.e-5<this.next)return false;
  this.next+=this.intervalMs;return true;
 }
}

export interface SequenceSpec {
  width:number;height:number;cropOrigin:readonly [number,number];fps:number;frameCount:number;
  requiredChannels:readonly string[];
}
export interface ChannelFrame<Resource=unknown> {
  frameIndex:number;width:number;height:number;cropOrigin:readonly [number,number];
  fps:number;frameCount:number;resource:Resource;
}
export interface CompleteFrame<Resource=unknown> {
  frameIndex:number;channels:Record<string,ChannelFrame<Resource>>;
}

/** Holds a complete prior frame while any channel of the desired frame is missing.
 * Resources remain owned by the bounded loader; this class never uploads or disposes them.
 */
export class FrameLatch<Resource=unknown> {
  readonly spec:SequenceSpec;
  private pending=new Map<number,Map<string,ChannelFrame<Resource>>>();
  private current:CompleteFrame<Resource>|null=null;
  private maxPendingFrames:number;
  constructor(spec:SequenceSpec,maxPendingFrames=8) {
    validateTiming(spec.fps,spec.frameCount);
    for(const key of ['width','height'] as const)if(!Number.isSafeInteger(spec[key])||spec[key]<=0)throw new Error(key+' must be positive');
    if(spec.cropOrigin.length!==2||!spec.cropOrigin.every(Number.isFinite))throw new Error('cropOrigin must contain two finite coordinates');
    if(!spec.requiredChannels.length||new Set(spec.requiredChannels).size!==spec.requiredChannels.length)throw new Error('requiredChannels must be unique and nonempty');
    if(!Number.isSafeInteger(maxPendingFrames)||maxPendingFrames<1)throw new Error('maxPendingFrames must be positive');
    this.spec={...spec,cropOrigin:[...spec.cropOrigin],requiredChannels:[...spec.requiredChannels]};
    this.maxPendingFrames=maxPendingFrames;
  }
  private validateIndex(index:number) {
    if(!Number.isSafeInteger(index)||index<0||index>=this.spec.frameCount)throw new Error('frameIndex out of range: '+index);
  }
  ready(channel:string,descriptor:ChannelFrame<Resource>) {
    if(!this.spec.requiredChannels.includes(channel))throw new Error('Unknown channel '+channel);
    this.validateIndex(descriptor.frameIndex);
    for(const key of ['width','height','fps','frameCount'] as const) {
      if(descriptor[key]!==this.spec[key])throw new Error(channel+': '+key+' mismatch');
    }
    if(descriptor.cropOrigin.length!==2||descriptor.cropOrigin.some((v,i)=>v!==this.spec.cropOrigin[i]))throw new Error(channel+': cropOrigin mismatch');
    let frame=this.pending.get(descriptor.frameIndex);
    if(!frame){frame=new Map();this.pending.set(descriptor.frameIndex,frame);}
    frame.set(channel,descriptor);
    while(this.pending.size>this.maxPendingFrames)this.pending.delete(this.pending.keys().next().value!);
  }
  commit(frameIndex:number):CompleteFrame<Resource>|null {
    this.validateIndex(frameIndex);
    const frame=this.pending.get(frameIndex);
    if(frame&&this.spec.requiredChannels.every(channel=>frame.has(channel))) {
      const channels=Object.fromEntries(this.spec.requiredChannels.map(channel=>[channel,frame.get(channel)!]));
      this.current={frameIndex,channels};this.pending.delete(frameIndex);
    }
    return this.current;
  }
  clear() {this.pending.clear();this.current=null;}
}
