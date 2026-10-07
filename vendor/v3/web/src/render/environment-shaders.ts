import {timeBackgroundSampling} from './time-background-shader';
// All positions, paths and art calibration arrive through SceneEnvironment.
// Coordinates are canvas pixels, x right / y down; normal +z faces the viewer.
export const sceneLightUniforms=`
uniform int uPointCount;uniform vec4 uPoints[8];uniform vec4 uPointColors[8];uniform float uPointFalloff[8],uLampFlicker[8];
uniform float uEmission;uniform vec2 uCanvas;
vec3 pointIllumination(vec2 world,vec3 normal){
 vec3 result=vec3(0.);
 if(uEmission<=0.)return result;
 for(int i=0;i<8;i++){if(i<uPointCount){
  vec3 delta=vec3(uPoints[i].xy-world,uPoints[i].z);float distance=length(delta),radius=uPoints[i].w;
  float attenuation=uPointFalloff[i]>0.?1./(1.+distance*uPointFalloff[i]):radius*radius/(radius*radius+2.5*distance*distance);
  float influence=1.-smoothstep(radius*.7,radius*1.7,distance);
  float diffuse=max(0.,dot(normal,normalize(delta)));
  result+=uPointColors[i].rgb*uPointColors[i].a*attenuation*diffuse*influence*uEmission;
 }}
 return result;
}`;
export const environmentBackgroundFragment=`
precision highp float;varying vec2 vUv;
uniform sampler2D uSceneData,uSceneNormal,uClouds,uLantern;
uniform vec3 uTint,uSceneLight,uSkyTop,uSkyHorizon,uCloudColor;
uniform float uExposure,uDynamics,uSeconds,uSkyHeight,uCloudOpacity,uCloudDrift,uCloudBob,uCloudPeriod;
uniform vec4 uCloudRect;uniform vec2 uWaveAmplitude,uWaveFrequency,uWaveSpeed;
uniform float uReflection,uStars,uStarDensity,uStarBrightness,uStarSeed,uFog;
uniform vec4 uSun,uMoon;uniform vec4 uLanterns[8];
uniform float uContactOffset,uContactSoftness,uContactStrength;
${sceneLightUniforms}
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
${timeBackgroundSampling}
vec3 screenColor(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec2 atPixel(vec2 p){return vec2(p.x/uCanvas.x,1.-p.y/uCanvas.y);}
vec4 field(vec2 p){return texture2D(uSceneData,atPixel(p));}
float random(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uStarSeed)*43758.5453);}
void main(){
 vec3 base=sampleBackground(vUv);vec3 color=base*uTint*uExposure;
 if(uDynamics>.5){
  vec2 world=vec2(vUv.x,1.-vUv.y)*uCanvas;vec4 data=field(world);
  if(data.g>0.){
   vec2 wave=vec2(sin(world.y*uWaveFrequency.x+world.x*.013+uSeconds*uWaveSpeed.x),sin(world.x*uWaveFrequency.y+uSeconds*uWaveSpeed.y))*uWaveAmplitude*data.g;
   float targetWater=field(world+wave).g;float waterWeight=data.g*targetWater;
   vec3 waterBase=sampleBackground(atPixel(world+wave))*uTint*uExposure;
   color=mix(color,waterBase,waterWeight);
  }
  if(uRegisteredBackground<.5){
   vec3 n=normalize((texture2D(uSceneNormal,vUv).rgb*255.-128.)/127.);
   float normalShade=.88+.12*max(0.,dot(n,normalize(uSceneLight)));color*=normalShade;
   color+=base*pointIllumination(world,n)*(1.-data.r);
  }
  vec2 castP=world+normalize(uSceneLight).xy*uContactOffset;vec2 soft=vec2(uContactSoftness,0.);
  float contact=(field(castP).a+field(castP+soft).a+field(castP-soft).a+field(castP+soft.yx).a+field(castP-soft.yx).a)/5.;
  color*=1.-contact*uContactStrength;
  if(uRegisteredBackground<.5){float fogBand=exp(-pow((world.y/uCanvas.y-.38)/.14,2.))*uFog*(1.-data.r);color=mix(color,linearColor(uSkyHorizon)*.24,fogBand*.25);}
  vec3 glowColor=linearColor(vec3(1.,.533333,.266667));float paper=dot(base,vec3(.2126,.7152,.0722));
  float windowFlicker=1.;
  if(data.b>0.&&uEmission>0.){
   float nearest=1.e10;
   for(int i=0;i<8;i++){if(i<uPointCount){vec2 delta=world-uPoints[i].xy;float d=dot(delta,delta);if(d<nearest){nearest=d;windowFlicker=uLampFlicker[i];}}}
  }
  // An emissive window replaces cold reflected illumination, retaining its painted texture.
  // Simply adding red light over the blue night plate turned these windows pink.
  vec3 windowSurface=base*.12+glowColor*(1.05+paper*1.35)*windowFlicker;
  if(uRegisteredBackground<.5)color=mix(color,windowSurface,data.b*uEmission*.92);
  else color*=1.+data.b*uEmission*(windowFlicker-1.)*.3;
  if(data.g>0.){
   float shimmer=.65+.35*sin(world.y*.2+uSeconds*1.2+sin(world.x*.07-uSeconds*.5));
   float reflection=texture2D(uSceneNormal,vUv).a;
   color+=glowColor*reflection*data.g*uEmission*uReflection*shimmer*mix(1.,.25,uRegisteredBackground);
   color+=linearColor(uSkyHorizon)*data.g*.03*(.6+.4*sin(world.y*.11+uSeconds*.8));
  }
  if(data.r>.001){
   vec3 sky=color;
   if(uRegisteredBackground<.5){
   float horizon=clamp(world.y/uSkyHeight,0.,1.);sky=mix(linearColor(uSkyTop),linearColor(uSkyHorizon),pow(horizon,.85));
   // Keep painted fine cloud detail from the new underplate without a fixed blue sky.
   vec3 source=texture2D(uBackground,vUv).rgb;float painted=smoothstep(.1,.42,min(source.r,source.g)-source.b*.32);sky=mix(sky,linearColor(uCloudColor),painted*.36);
   vec2 cp=(world-uCloudRect.xy-vec2(uSeconds*uCloudDrift,sin(uSeconds*6.2831853/uCloudPeriod)*uCloudBob))/uCloudRect.zw;cp.x=fract(cp.x);
   if(cp.y>=0.&&cp.y<=1.){vec4 cloud=texture2D(uClouds,vec2(cp.x,1.-cp.y));vec3 cloudLit=linearColor(cloud.rgb)*linearColor(uCloudColor);sky=mix(sky,cloudLit,cloud.a*uCloudOpacity);}
   float sunDistance=length(world-uSun.xy);float sunDisc=1.-smoothstep(uSun.z-.8,uSun.z+.8,sunDistance);float sunHalo=exp(-sunDistance*sunDistance/(uSun.z*uSun.z*28.));sky+=vec3(1.,.72,.4)*(sunDisc*.7+sunHalo*.09)*uSun.w;
   float moonDistance=length(world-uMoon.xy);float moonDisc=1.-smoothstep(uMoon.z-.8,uMoon.z+.8,moonDistance);vec2 moonUv=(world-uMoon.xy)/uMoon.z;vec2 craterA=moonUv-vec2(.24,.18),craterB=moonUv-vec2(-.28,.32),craterC=moonUv-vec2(-.08,-.37);float moonDetail=.88-.12*exp(-dot(craterA,craterA)*14.)-.07*exp(-dot(craterB,craterB)*23.)-.05*exp(-dot(craterC,craterC)*20.);sky=mix(sky,vec3(.6,.72,.92)*moonDetail,moonDisc*uMoon.w);sky+=vec3(.25,.36,.55)*exp(-moonDistance*moonDistance/(uMoon.z*uMoon.z*16.))*.16*uMoon.w;
   }
   vec2 starGrid=world/uCanvas.x*uStarDensity;vec2 cell=floor(starGrid);float seed=random(cell);vec2 center=vec2(random(cell+vec2(3.,7.)),random(cell+vec2(8.,1.)))*.7+.15;float star=exp(-dot(fract(starGrid)-center,fract(starGrid)-center)*600.)*step(.988,seed);sky+=vec3(.75,.86,1.)*star*uStars*uStarBrightness*(.85+.15*sin(uSeconds*.6+seed*60.));
   for(int i=0;i<8;i++){if(i<uPointCount&&uLanterns[i].z>0.){
    vec2 delta=world-uPoints[i].xy;float angle=uLanterns[i].x;float co=cos(angle),si=sin(angle);vec2 lp=mat2(co,-si,si,co)*delta/uLanterns[i].zw+.5;
    if(lp.x>=0.&&lp.y>=0.&&lp.x<=1.&&lp.y<=1.){vec4 lamp=texture2D(uLantern,vec2(lp.x,1.-lp.y));float paperMask=smoothstep(.44,.83,dot(lamp.rgb,vec3(.2126,.7152,.0722)));vec3 lampColor=linearColor(lamp.rgb)*(.45+.55*uEmission)+glowColor*paperMask*uEmission*.85*uLampFlicker[i];sky=mix(sky,lampColor,lamp.a);}
    float radius=uLanterns[i].z*.45;float halo=exp(-dot(delta,delta)/(radius*radius*2.));sky+=glowColor*halo*uEmission*.055*uLampFlicker[i];
   }}
   color=mix(color,sky,data.r);
  }
 }
 gl_FragColor=vec4(screenColor(color),1.);
}`;
