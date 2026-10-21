import publication from '../../../../../extra/sky/sunflower-afternoon/config/publication-warm-sun-v001.json' with {type:'json'};
import {character} from './character.ts';import {scene} from './scene.ts';
import type {WallpaperPackage} from '../../../content/package-contract.ts';
export const wallpaper:WallpaperPackage={
 schemaVersion:1,id:'extra-sky-sunflower-afternoon',displayName:'光遇 · 向日葵午后',characterId:character.id,sceneId:scene.id,
 canvas:character.canvas,preview:[0,0,...character.canvas],characterOrigin:[0,0],drawOrder:['scene','character'],
 scope:'已接受暖阳完整场景；29株阵风、白蝶、流云与光鳐，固定受光兼容数据，未制作真实动态法线',
 presentation:{selectable:true,characterKey:'extra-sky',sceneName:'向日葵午后',focus:[.5,.5],clockDefaultVisible:false,thumbnail:publication.thumbnail}
};

