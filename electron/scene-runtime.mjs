// The frozen V3 factory hides its instance until initialize() resolves. This desktop
// adapter follows that factory's lifecycle using its compiled constructor/initialize
// methods, so cancellation can destroy the owner and abort its fetches immediately.
// Recheck this boundary whenever the vendored V3 runtime is updated.
export async function createAbortableScene(Runtime,host,character,scene,wallpaper,{signal}={}){
 const canceled=()=>new DOMException('已取消场景加载','AbortError');
 if(signal?.aborted)throw canceled();
 const runtime=new Runtime(host,character,scene,wallpaper,{}),release=runtime.destroy.bind(runtime);let disposed=false;
 const destroy=()=>{if(disposed)return;disposed=true;signal?.removeEventListener('abort',destroy);release();};
 runtime.destroy=destroy;signal?.addEventListener('abort',destroy,{once:true});
 try{
  if(signal?.aborted)throw canceled();
  await runtime.initialize();
  if(signal?.aborted)throw canceled();
  return runtime;
 }catch(error){destroy();throw error;}
}
