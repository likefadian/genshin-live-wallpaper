// Decode each complete painting before blending, rather than recoloring regions.
export const timeBackgroundSampling=`
uniform sampler2D uBackground,uDawnBackground,uDuskBackground,uNightBackground;
uniform vec4 uBackgroundWeights;uniform float uRegisteredBackground;
vec3 sampleBackground(vec2 uv){
 // Uniform branches: zero-weight plates cannot affect the result. Preserve every
 // positive blend weight, including the start and end of a continuous transition.
 vec3 color=vec3(0.);
 if(uRegisteredBackground<.5){color=linearColor(texture2D(uBackground,uv).rgb);}
 else{
 if(uBackgroundWeights.x>0.)color+=linearColor(texture2D(uDawnBackground,uv).rgb)*uBackgroundWeights.x;
 if(uBackgroundWeights.y>0.)color+=linearColor(texture2D(uBackground,uv).rgb)*uBackgroundWeights.y;
 if(uBackgroundWeights.z>0.)color+=linearColor(texture2D(uDuskBackground,uv).rgb)*uBackgroundWeights.z;
 if(uBackgroundWeights.w>0.)color+=linearColor(texture2D(uNightBackground,uv).rgb)*uBackgroundWeights.w;
 }
 return color;
}`;
