// Decode each complete painting before blending, rather than recoloring regions.
export const timeBackgroundSampling=`
uniform sampler2D uBackground,uDawnBackground,uDuskBackground,uNightBackground;
uniform vec4 uBackgroundWeights;uniform float uRegisteredBackground;
vec3 sampleBackground(vec2 uv){
 if(uRegisteredBackground<.5)return linearColor(texture2D(uBackground,uv).rgb);
 return linearColor(texture2D(uDawnBackground,uv).rgb)*uBackgroundWeights.x
       +linearColor(texture2D(uBackground,uv).rgb)*uBackgroundWeights.y
       +linearColor(texture2D(uDuskBackground,uv).rgb)*uBackgroundWeights.z
       +linearColor(texture2D(uNightBackground,uv).rgb)*uBackgroundWeights.w;
}`;
