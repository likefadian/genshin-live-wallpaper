/** CPU resources only. Uploading a frame never allocates an atlas per sequence frame. */
export class FrameCache<T>{
  private entries=new Map<number,{resource:T;used:number}>();private pending=new Map<number,Promise<T>>();private failures=new Map<number,string>();private displayed:number|null=null;private serial=0;private disposed=false;
  readonly capacity:number;private loader:(index:number)=>Promise<T>;private release:(resource:T)=>void;
  constructor(capacity:number,loader:(index:number)=>Promise<T>,release:(resource:T)=>void){if(!Number.isSafeInteger(capacity)||capacity<2)throw Error('cache capacity must be at least two');this.capacity=capacity;this.loader=loader;this.release=release}
  get size(){return this.entries.size}get pendingCount(){return this.pending.size}get lastError(){return Array.from(this.failures.values()).at(-1)??''}
  get(index:number){const entry=this.entries.get(index);if(entry){entry.used=++this.serial;return entry.resource}return undefined}
  pin(index:number){this.displayed=index}
  load(index:number):Promise<T>{
    if(this.disposed)return Promise.reject(Error('cache disposed'));
    const ready=this.get(index);if(ready!==undefined)return Promise.resolve(ready);
    const existing=this.pending.get(index);if(existing)return existing;
    const promise=Promise.resolve().then(()=>this.loader(index)).then(resource=>{
      if(this.disposed){this.release(resource);throw Error('cache disposed during decode')}
      this.entries.set(index,{resource,used:++this.serial});this.evict();this.failures.delete(index);return resource;
    }).catch(error=>{if(!this.disposed)this.failures.set(index,String(error));throw error}).finally(()=>this.pending.delete(index));this.pending.set(index,promise);return promise;
  }
  private evict(){while(this.entries.size>this.capacity){let oldest:number|null=null,serial=Infinity;for(const [id,entry] of this.entries)if(id!==this.displayed&&entry.used<serial){serial=entry.used;oldest=id}if(oldest===null)throw Error('cache cannot evict pinned resources');const entry=this.entries.get(oldest)!;this.entries.delete(oldest);this.release(entry.resource)}}
  dispose(){if(this.disposed)return;this.disposed=true;for(const entry of this.entries.values())this.release(entry.resource);this.entries.clear();this.failures.clear();this.displayed=null}
}
