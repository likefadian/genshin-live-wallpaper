# 来源与第三方声明

本地软件复用用户提供的 GENSHIN-FRONT-V3 正式魈壁纸及网页渲染源码，内容包括 xiao-liyue-full / full-v016 和已接受的光遇 · 向日葵午后 / warm-sun-web-v001。原制作素材、AE 项目和角色生成流程不属于此软件源码包。来源摘要见 content/source.json，后续同步与逐文件哈希见 content/engine-update.json。此软件不自称相关游戏厂商的官方产品；相关角色与名称权利属于其权利人。

Windows 桌面挂载 P/Invoke 参考用户授权的 varesaEXE/electron/wallpaper-host.ps1；类名改为 GenshinWallpaperHost，增加只读存活检查，并清除重设父窗口时的边框标志；BrowserWindow 显式 thickFrame=false。不搬入旧角色或旧渲染接口。

运行时使用 Electron（MIT）、Chromium（BSD 与第三方许可）、Node.js（MIT 等），其 LICENSE 与 LICENSES.chromium.html 随 Electron 发行文件保留在安装目录。Three.js 0.186.1（MIT）许可证随源码在 vendor/licenses/THREE-LICENSE.txt 保存。

esbuild、sharp 与 electron-builder 仅参与本地构建，未作为壁纸运行依赖打入软件。其许可证可从 npm 安装后的各包目录读取，具体依赖锁定于 package-lock.json。
