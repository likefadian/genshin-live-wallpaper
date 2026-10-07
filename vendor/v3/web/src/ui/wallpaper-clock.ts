/** A local calendar clock, independent of scene time and animation playback. */
export function createWallpaperClock(host:HTMLElement,time:HTMLTimeElement,date:HTMLElement,year:HTMLElement){
 const dateFormat=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'});
 function update(){
  const now=new Date(),text=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  if(time.textContent!==text)time.textContent=text;
  time.dateTime=text;
  const dateText=dateFormat.format(now),yearText=String(now.getFullYear());
  if(date.textContent!==dateText)date.textContent=dateText;
  if(year.textContent!==yearText)year.textContent=yearText;
  host.setAttribute('aria-label',dateText+' '+yearText+'年 '+text);
 }
 update();
 const timer=setInterval(update,1000),onVisibility=()=>{if(!document.hidden)update()};
 document.addEventListener('visibilitychange',onVisibility);
 return {
  setVisible(visible:boolean){host.hidden=!visible;if(visible)update()},
  destroy(){clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility)}
 };
}
