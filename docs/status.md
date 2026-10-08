# GenshinWallpaper 状态 · 2026-10-08

## GenshinWallpaper 0.1.3 · 正式命名与发布准备

用户已授权向 `likefadian/genshin-live-wallpaper` 公开发布稳定版 `v0.1.3`，名称为 `GenshinWallpaper v0.1.3`。公开附件仅为安装器、blockmap 与 latest.yml；源码不上传或推送。

- 软件窗口、侧栏、托盘、快捷方式、Windows 产品名及安装器均改为 GenshinWallpaper；保留稳定 appId、包名、更新缓存和旧版设置目录，实际覆盖安装后旧 EXE 已移除。
- 改名后的 NSIS 构建与实际安装 exit0；8/8 核心检查通过。原用户设置 SHA-256 完全一致。实际窗口已查看，品牌文字完整，壁纸运行且桌面挂载成功，tiles、RTX4060，渲染错误为空。
- 本轮产物在 `release/genshinwallpaper-v001/`，安装器名为 `GenshinWallpaper-Setup-0.1.3-x64.exe`；本地源码交付为 `release/GenshinWallpaper-Source-0.1.3.zip`。正式清单随改名后的安装器重新生成。
- GitHub 账号授权已完成，正在上传和核对正式附件；尚未记录公开发布成功。现场材料保存在 `work/genshinwallpaper-v001/`。

下列内容保留改名前各轮验收记录。

当前本地版本 **0.1.3 / Windows x64 / 主显示器**，已接入用户选择的 GitHub 更新源，通过软件内下载、校验和NSIS重启升级，最终正常实例恢复原用户设置并继续运行。尚未上传、创建 Release 或发布；0.1.2的原始交付继续保留。

## 0.1.3 GitHub 更新接入

- 正式来源为 `likefadian/genshin-live-wallpaper` 的公开稳定 GitHub Releases。`electron-updater=6.8.9` 固定版本，稳定 appId 和用户设置目录保持。
- 设置页新增手动检查、版本说明、下载进度和原生确认重启安装。SHA-512 下载校验失败不能安装；普通退出不自动安装，失败不关闭壁纸。不接受降级或预发布版本。
- 核心检查8/8；生产候选与专用旧候选NSIS构建 exit0。正式安装器、`latest.yml` 与 blockmap 已在 `release/github-updates-v001/` 生成，版本/大小/SHA-512 匹配；内置 `app-update.yml` 指向真实仓库，无凭据。所有构建显式 `--publish never`。
- 独立代码审查发现本地验收共用正式缓存，已修复：专用profile具有独立缓存名，通过验收专用配置加载；补充断言先失败后通过，审查复核无新增问题。
- 真实本地链路为已安装 `0.1.3-verify.0` → 正式 `0.1.3`。实际Windows按钮检查到新版本；损坏下载报 `ERR_CHECKSUM_MISMATCH`，界面没有安装入口、壁纸继续运行；重试完整安装器后SHA-512匹配，原生确认触发 `quitAndInstall(true,true)`，旧进程退出，NSIS自动重启新版。该现场验收走完整下载，不宣称差分下载已验收。
- 升级前后原用户设置SHA-256相同；验收profile中的非默认设置文件也完全相同，并由安装内新版SettingsStore实际读取核对。NSIS自动重启回到正常profile，读取原用户设置；新版本继续RTX4060 / tiles，桌面挂载成功、动画推进、加载错误为空。
- 启动命令被自动批准机制拒绝（只返回 `blocked by policy`），用户手动启动专用候选。Windows控制工具不能前置被全屏游戏遮住的窗口，用户手动前置后完成实际软件按钮及原生安装确认；没有绕过工具限制，也没有用模拟更新状态替代实际下载/安装。
- 交付为 `release/github-updates-v001/GenshinEXE-Setup-0.1.3-x64.exe` 和 `release/GenshinEXE-Source-0.1.3.zip`。源码包含579个文件、含正式资源，排除依赖、缓存、运行日志和验收profile。中文说明见 `docs/releases/0.1.3.md`；待发布附件仅为匹配的EXE、blockmap和latest.yml，源码继续单独交付。
- 最终真实GitHub源检查返回 `no-release`：仓库尚无正式Release，界面明确显示“更新源尚无正式发布版本”，未误报最新版。最终正常实例无验收源或调试参数，软件设置页已显示0.1.3与真实仓库；本地下载服务在验收后关闭。

以下保留此前版本的验收记录。

## 0.1.2 网页优化接入

- 来源：V3 已接受提交 `f407ea7a02dfe998ef563fcb820258c472506e9f`，包含 `aba5612` 的共用渲染优化。新增来源清单 `content/engine-update.json`，首次导入记录 `content/source.json` 保留。
- 内容：原魈 full-v016 的240帧、四通道图集及参数保留；追加240个无损独立分块PNG及manifest，默认采用 `tiles` 传输。没有重做角色，没有改变桌面宿主、显卡选择或设置接口。核显候选仍在 `candidate/gpu-low-power-v001`，没有混入本轮。
- 像素预算：单帧解码/上传原始RGBA由2064×1882（约14.82 MiB）降为1024×1536（6 MiB）；实际8帧缓存的像素估算为48 MiB，不代表进程总内存或功耗。原完整图集继续保留，安装包因追加分块资源变大。
- 安装版：`release/web-engine-v001/GenshinEXE-Setup-0.1.2-x64.exe`；源码包：`release/GenshinEXE-Source-0.1.2.zip`。本轮大小、SHA-256和签名状态见 `release/web-engine-v001/delivery-checksums.json`。0.1.0与核显候选交付保留。
- 验证：现有核心4/4、网页构建、NSIS构建及实际安装均通过。37个来源文件、241个安装内分块文件与240个安装内原始帧哈希通过。从 `C:/Windows/Temp` 启动，资源只取安装目录，`packaged=true`、`attached=true`、`frameTransport=tiles`。
- 运行：ANGLE实际报告 NVIDIA GeForce RTX 4060 Laptop GPU，采样画质仍为1672×941；动画秒159.20→163.13，等待帧0、加载/渲染错误为空。原 `%APPDATA%/GenshinEXE/settings.json` 升级前后SHA-256相同。已查看实际壁纸和Windows设置窗口；最终只有一个软件实例，不开放调试端口。
- 本轮现场记录：`work/web-engine-v001/verification-summary.json`、`installed-runtime.json` 和实际截图。仅做接入必要检查，未测长期功耗、风扇、其他机器或重新跑全帧视觉矩阵。

以下保留0.1.0首次交付记录，便于追溯。

## 0.1.0 交付与运行

- 软件源码：本项目 electron/、scripts/、vendor/v3/、content/ 及根目录配置，可独立重建；附 release/GenshinEXE-Source-0.1.0.zip，包含正式资源，不含 node_modules、缓存、用户数据或 AE。
- 安装 EXE：release/GenshinEXE-Setup-0.1.0-x64.exe；配套本地 blockmap，没有生成或上传线上更新清单。
- 本机已实际安装：.local-install/GenshinEXE.exe，并留下正常运行实例，最终启动未启用调试端口。其他人安装目录可自由选择。
- 说明：根目录 README.md，双击 Start-Development.cmd / Build-Installer.cmd 或按 npm 命令编辑、启动、打包。依赖及下载/构建缓存留在本项目 .cache。
- 交付大小与 SHA-256：release/delivery-checksums.json。

## 内容与实现

完整阅读交接、V3 运行契约/实际接口/注册/最新状态、varesaEXE 桌面宿主。正式资源为 **V3 已验收 full-v016 / xiao-liyue-full**；原图集和美术参数保持，运行继续同帧 SHA-256 校验。V3 的现有未提交维护内容原样保留。本项目渲染源/JSON 快照与必要正式资源可脱离 V3 目录，导入摘要在 content/source.json。

Electron44.6.0、electron-builder26.15.3，稳定 appId=com.genshinexe.wallpaper，userData=%APPDATA%/GenshinEXE。仅绑定127.0.0.1的 HTTP 服务从安装目录 resources/wallpaper 加载；不依赖 Vite、Node、AE、.NET 或 WebView2。独立设置窗口通过受限 IPC 控制唯一渲染器，主进程校验/原子保存设置。托盘支持设置、暂停/恢复、重新连接、开机启动开关与退出；30秒只读检查桌面层存活，丢失时重新连接。

原生 host 保留旧软件的经典 WorkerW / 新版 Progman 布局适配。最后检查发现并修复无框窗口的非客户区内缩：构造时 thickFrame=false，挂载时清除 caption/thickframe 标志。最终安装版 physical client=outer=2561×1602，窗口可见、WS_CHILD、原生鼠标穿透均为true，父类WorkerW；主屏显示2560×1600，映射取整的少量 overscan 由父层裁切，没有边框留白。

## 实际必要验证

Windows11家庭中文版22631 x64，RTX4060 / AMD780M，2560×1600 / 缩放175%；Node24.21.0、npm11.19.0；.NET8和WebView2 154已安装，本软件使用自带 Electron。

- 核心4/4检查与网页构建通过；原生边框回归从失败到通过；最终 NSIS 构建 exit0、实际安装 exit0。
- 安装版从 C:/Windows/Temp 启动，packaged=true，实际资源根只在安装目录。原生挂载成功，帧/动画秒持续前进，documentHidden=false、loadError为空。
- 开发版暂停、曝光+0.12、时钟关闭后重启保存；实际 Windows 设置按钮恢复动画。安装版曝光+0.16/时钟关闭后退出、重启仍保留；随后恢复曝光0、时钟开启。
- 设置页面 canvas=0，壁纸页面 canvas=1；静态缩略图正常，无水平溢出。关闭设置后仅剩壁纸页，动画秒68.65→71.08；退出关闭进程和本地服务。
- 已查看真实 Windows 设置窗口和实际壁纸窗口；原生层级/穿透与动态状态另行核验，没有用静态截图代替运行。
- 完整说明见 verification.md；原始本地证据保留在 work/，源码 ZIP 不含用户日志或验证配置。

## 后续阶段

**独立壁纸包：未开始。** 下一阶段实现可读包配置、引擎/版本兼容、资源根目录、损坏包拒绝、原子安装和本地注册；当前注册仍编译进引擎，不能热安装外部角色包或任意原画混搭。

**软件远程更新：已选定来源并接入，本地真实升级通过。** 源为 GitHub Releases；真正从GitHub附件下载并升级仍待用户批准发布后验证。当前尚无已公开的安装器或更新清单。0.1.2及更早版本没有更新器，需要先手动安装0.1.3。

仓库已由用户创建，上传和发布权限仍待具体文件就绪后集中确认。源码 ZIP 单独交付，不自动上传或推送；壁纸包为后续阶段。**本轮未上传、未发布。**

本地 EXE 未签名；多显示器、其他机器、开机重登、主动重启 Explorer 和高采样长期性能未验收。此阶段不是整个远程更新项目的最终完成。
