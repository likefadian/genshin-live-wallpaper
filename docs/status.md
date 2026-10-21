# GenshinWallpaper 状态 · 2026-10-21

## 2026-10-21 · 0.1.4 已合并 main 并正式发布

用户明确授权合并 codex/mp4-wallpapers、推送 GitHub 并发布新版本。main 从 1f23325 快进到 08c4ff525cc6c6ae8a849dc9627b137f776f425d，源码和 v0.1.4 注释标签通过现有 SSH 一起推送；标签指向完整功能源码，后续提交仅补充发布记录。

- [GenshinWallpaper v0.1.4](https://github.com/likefadian/genshin-live-wallpaper/releases/tag/v0.1.4) 于 2026-10-21 09:06:47（北京时间）正式发布，并设为 Latest，Release ID 419034066。
- 公开附件为 GenshinWallpaper-Setup-0.1.4-x64.exe（739240083 字节）、对应 blockmap（769251 字节）和 latest.yml（1629 字节）。发布前，三个附件的服务端 SHA-256、大小和上传状态与本地完全一致；中文说明与源码文件一致。安装器 SHA-256：241421955de088aaf0611afa31a8084c2af44c9454208969ca01d91de5664ead。
- 发布前重新执行合并后的核心检查 27/27、实际用户 MP4 桌面流程 21 项、作者并发录入检查，并重新构建 NSIS。实际打包 EXE 在专用用户目录播放视频、退出和重启恢复正常，packaged=true / attached，无渲染错误。
- 发布后直接下载公开 latest/download/latest.yml 和 blockmap，哈希与本地一致；安装器公开 HEAD 返回 200，长度正确。实际已安装 0.1.3 使用内置 GitHub 正式源检查到 availableVersion=0.1.4，中文说明正确，专用验收实例已退出。
- 没有触发旧版下载或覆盖安装；本次未重新验收完整远端下载、差分节省量或 0.1.3→0.1.4 实际安装升级。用户提供的下载视频未加入官方资源。

证据保存在 work/publish-0.1.4-2026-10-21；桌面流程为 work/mp4-wallpapers/e2e-1792544480103，作者并发检查为 author-concurrency-1792544480100。下文保留各阶段原始记录。

## 2026-10-16 · 官方壁纸取消作者署名

按软件维护方统一录入和发布的模式，壁纸卡片不再展示作者署名，官方录入命令无需 --author；视频侧栏按“官方壁纸 / 我的导入”显示来源。新记录不保存署名，带署名的旧清单仍可读取，旧脚本的 --author 参数继续接受但不使用。

27 项核心检查及实际无署名作者录入、并发互斥、官方增量交付全部通过；设置窗口截图已查看。现场材料位于 work/mp4-wallpapers/author-concurrency-1792144019882 和 delivery-1792144060491。本地 0.1.4 候选重新构建，不涉及公开发布。

## 2026-10-15 · MP4 壁纸本地候选 0.1.4

在 codex/mp4-wallpapers 完成本地 MP4 导入、实际解码检查、静态缩略图、壁纸库、视频 / 实时场景切换、控制与重启恢复。维护方可用作者命令录入官方 MP4，随版本交付；当前正式官方视频清单为空，用户提供的下载视频仅用于本地验收。

- 核心 27/27，通过实际 Electron 解码检查与 21 项桌面流程；专用构建副本额外通过官方新增、官方播放 / 禁止本地移除、移除当前官方作品的三项验证。本地作品和选择在目录变化后保留。作者并发命令明确拒绝竞争写入，重试及失败清理通过。
- 用户提供的 MP4 为 2560×1440 / H.264 / 60 fps / 15.65 秒，实际导入副本、播放、循环、控制、快速切换、关闭设置、重启及移除均通过；原文件 SHA-256 保持不变。
- NSIS 构建 exit0：release/GenshinWallpaper-Setup-0.1.4-x64.exe，匹配的 latest.yml 与 blockmap 已生成。构建 --publish never，尚未推送此功能或创建公开 0.1.4 Release。
- 实际运行 release/win-unpacked/GenshinWallpaper.exe，版本 0.1.4 / packaged=true / attached，使用专用 profile 从 C:/Windows/Temp 启动。原生入口已导入用户视频并播放，退出重启后仍为原作品、无渲染错误；验收实例已退出。
- 本轮验证打包目录中的真实 EXE 与资源，没有运行 NSIS 覆盖现有安装，因此未验收 0.1.3 → 0.1.4 实际覆盖升级。Windows 11 x64、主显示器、175% 缩放；多设备和长期性能未覆盖。
- 一次独立全分支审查提出 4 项重要问题，均先复现再修复：旧版本错误被丢弃后可重新上报、初始化中场景立即取消并释放、运行中文件丢失的错误触发回退、作者并发登记互斥。实测检查取消了底层读取并使 WebGL 上下文丢失，未仅依据 DOM 画布数量判断。

操作见 [作者说明](author-wallpapers.md)，证据和复现命令见 [验收记录](verification.md)。下文保留原有阶段记录。

## 2026-10-15 · main 同步与源码公开提交

用户在本会话明确授权将 codex/github-updates 合并到 main，并推送到项目的 GitHub 仓库。本次授权允许公开提交完整软件源码，取代下方历史发布阶段仅上传安装附件的范围。

- main 从 0.1.0 快进到已发布的 0.1.3 / a2d588d，随后合并远程原有的 README 初始化历史。合并提交为 0c3601b8060d83573fe5c986e48cf5c95775993a，两个父提交分别为 a2d588d 与 ee188bb；合并后的文件树与 codex/github-updates 完全一致。
- 使用本机现有 SSH 密钥，以 likefadian 账号成功认证。origin 为 git@github.com:likefadian/genshin-live-wallpaper.git；首次源码推送成功，上传 700 个对象、593.81 MiB，main 已跟踪 origin/main。远程查询确认 main 指向上述合并提交。
- 合并后的现有 8 项测试全部通过。软件功能与版本仍为 0.1.3；本节只是记录此次 Git 同步。
- codex/mp4-wallpapers 保留独立的 MP4 设计与实施计划提交，尚未进入功能实现；本次 main 合并来自 codex/github-updates。
- 完整源码现已位于 [GitHub main](https://github.com/likefadian/genshin-live-wallpaper/tree/main)。下文保留此前各阶段的原始发布记录。

## 2026-10-08 · GenshinWallpaper 0.1.3 已公开发布

用户已授权向 `likefadian/genshin-live-wallpaper` 公开发布稳定版 `v0.1.3`，名称为 `GenshinWallpaper v0.1.3`。公开附件仅为安装器、blockmap 与 latest.yml；源码不上传或推送。

- 软件窗口、侧栏、托盘、快捷方式、Windows 产品名及安装器均改为 GenshinWallpaper；保留稳定 appId、包名、更新缓存和旧版设置目录，实际覆盖安装后旧 EXE 已移除。
- 改名后的 NSIS 构建与实际安装 exit0；8/8 核心检查通过。原用户设置 SHA-256 完全一致。实际窗口已查看，品牌文字完整，壁纸运行且桌面挂载成功，tiles、RTX4060，渲染错误为空。
- 本轮产物在 `release/genshinwallpaper-v001/`，安装器名为 `GenshinWallpaper-Setup-0.1.3-x64.exe`；本地源码交付为 `release/GenshinWallpaper-Source-0.1.3.zip`。正式清单随改名后的安装器重新生成。
- GitHub 稳定版已于 2026-10-08 08:53:38（北京时间）正式发布并设为 Latest：[GenshinWallpaper v0.1.3](https://github.com/likefadian/genshin-live-wallpaper/releases/tag/v0.1.3)。发布前核对三个附件的服务端 SHA-256、大小、上传状态和中文说明，全部与本地一致；公开 latest/download/latest.yml 下载后也完全匹配。
- 实际软件通过内置 GitHub 源检查后状态为 `current`。旧测试版 `0.1.3-verify.0` 使用正常用户目录和内置 GitHub 源，真实检查到 v0.1.3，完整下载 739230542 字节安装器，SHA-256 / SHA-512 与公开附件完全相同。通过真实 Windows 按钮和原生确认执行 NSIS 后，自动重启到 `GenshinWallpaper.exe --updated` / v0.1.3，原用户设置 SHA-256 不变，壁纸正常播放。
- 本次旧测试版没有公开 blockmap，差分请求 HTTP 404 后正确退回完整下载；未据此宣称远端差分节省量。现场材料保存在 `work/genshinwallpaper-v001/`。
- 本地源码 ZIP 的 579 个条目与工作目录逐一 SHA-256 匹配，未包含依赖、缓存或用户数据。公开仓库继续只有原 README 提交和版本附件，没有上传软件源码。

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

**软件远程更新：已接入并公开首个稳定版。** 源为 GitHub Releases；具体远端验收结果见本页顶部。0.1.2及更早版本没有更新器，需要先手动安装0.1.3。

用户已批准 v0.1.3 的三个安装与更新附件公开发布。源码 ZIP 单独交付，不上传或推送；壁纸包为后续阶段。

EXE 未签名；多显示器、其他机器、开机重登、主动重启 Explorer 和高采样长期性能未验收。GitHub 软件更新的首个正式发布与真实远端升级已完成，独立壁纸包仍为后续阶段。
