import {sceneLightUniforms} from './environment-shaders';
import {timeBackgroundSampling} from './time-background-shader';
export const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const fragment=`
precision highp float;varying vec2 vUv;
uniform sampler2D uAtlas;uniform vec2 uSize;uniform vec3 uLight,uKey,uAmbient,uLampDirection,uLampColor;uniform float uExposure,uShadowOffset,uShadowSoftness,uAoStrength;uniform vec4 uMaterials[16];uniform float uMaterialShadow[16];uniform int uMode;
uniform vec2 uOrigin;uniform float uLocalLampGain,uRimStrength,uRimWidth;uniform vec3 uRimColor;
uniform vec4 uPainted;uniform vec2 uBandWeights;uniform vec3 uHighlights[16];
${sceneLightUniforms}
vec4 sampleTile(vec2 tile,vec2 p){p=clamp(p,.5/uSize,1.-.5/uSize);return texture2D(uAtlas,vec2((tile.x+p.x)*.5,1.-(tile.y+p.y)*.5));}
vec3 decodeSrgb(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 encodeSrgb(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){
 vec2 p=vec2(vUv.x,1.-vUv.y);vec4 albedo=sampleTile(vec2(0.),p);
 // Skip only fully transparent texels; retain every antialiased edge and hair tip.
 if(albedo.a==0.)discard;
 vec3 n=normalize((sampleTile(vec2(1.,0.),p).rgb*255.-128.)/127.);
 vec3 data=sampleTile(vec2(0.,1.),p).rgb;int materialId=int(floor(data.r*255.+.5));vec4 mat=uMaterials[0];float shadowStrength=0.;vec3 highlight=vec3(.88,.1,0.);
 for(int i=0;i<16;i++){if(i==materialId){mat=uMaterials[i];shadowStrength=uMaterialShadow[i];highlight=uHighlights[i];}}
 vec3 L=normalize(uLight),P=normalize(uLampDirection);float facing=dot(n,L);
 float bands=uBandWeights.x*smoothstep(uPainted.z-uPainted.y,uPainted.z+uPainted.y,facing)+uBandWeights.y*smoothstep(uPainted.w-uPainted.y,uPainted.w+uPainted.y,facing);
 float diffuse=mat.x+mat.y*mix(smoothstep(-.08,.82,facing),bands,uPainted.x);
 vec2 shadowP=p+L.xy*uShadowOffset/(max(L.z,.35)*uSize);vec2 s=uShadowSoftness/uSize;
 float caster=0.;
 if(data.b>0.&&shadowStrength>0.)caster=(sampleTile(vec2(1.),shadowP).r+sampleTile(vec2(1.),shadowP+vec2(s.x,0.)).r+sampleTile(vec2(1.),shadowP-vec2(s.x,0.)).r+sampleTile(vec2(1.),shadowP+vec2(0.,s.y)).r+sampleTile(vec2(1.),shadowP-vec2(0.,s.y)).r)/5.;
 float shadow=1.-caster*data.b*shadowStrength;float ao=mix(1.,data.g,uAoStrength);
 vec3 light=uAmbient*ao+uKey*diffuse*shadow+uLocalLampGain*(uLampColor*(mat.x+mat.y*max(0.,dot(n,P)))+pointIllumination(uOrigin+p*uSize,n));
 vec3 halfVector=normalize(L+vec3(0.,0.,1.));float spec=pow(max(0.,dot(n,halfVector)),max(mat.w,1.))*mat.z;
 // Material-space normal bands move with the native deformation; no canvas-fixed artwork coordinates.
 float ribbon=1.-smoothstep(highlight.y*.35,highlight.y,abs(dot(n,halfVector)-highlight.x));
 float sheen=ribbon*highlight.z*smoothstep(-.15,.65,facing)*shadow;
 // Both the view-normal rim and the moving alpha silhouette follow this frame's atlas.
 float rim=pow(1.-max(0.,dot(n,vec3(0.,0.,1.))),3.);
 vec2 edgeStep=uRimWidth/uSize;
 float neighbor=min(min(sampleTile(vec2(0.),p+vec2(edgeStep.x,0.)).a,sampleTile(vec2(0.),p-vec2(edgeStep.x,0.)).a),min(sampleTile(vec2(0.),p+vec2(0.,edgeStep.y)).a,sampleTile(vec2(0.),p-vec2(0.,edgeStep.y)).a));
 float silhouette=max(0.,albedo.a-neighbor);
 rim=max(rim,silhouette*.48)*(.3+.7*max(0.,dot(n,normalize(vec3(L.xy,L.z*.25)))));
 vec3 reflectance=decodeSrgb(albedo.rgb);
 float rimResponse=.25+.75*sqrt(max(0.,dot(reflectance,vec3(.2126,.7152,.0722))));
 vec3 rimLight=decodeSrgb(uRimColor)*rim*uRimStrength*rimResponse;
 vec3 color=encodeSrgb((reflectance*light+uKey*(spec*.12+sheen)+rimLight)*uExposure);
 if(uMode==1)color=albedo.rgb;if(uMode==2)color=n*.5+.5;if(uMode==3)color=vec3(float(materialId)/8.,data.g,data.b);if(uMode==4)color=vec3(sampleTile(vec2(1.),p).r);
 gl_FragColor=vec4(color,albedo.a);
}`;
export const backgroundFragment=`precision highp float;varying vec2 vUv;uniform vec3 uTint;uniform float uExposure;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
${timeBackgroundSampling}
void main(){vec3 c=sampleBackground(vUv)*uTint*uExposure;c=max(c,vec3(0.));gl_FragColor=vec4(mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c)),1.);}`;
