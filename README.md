# GenshinWallpaper

Windows x64 动态壁纸软件，当前公开稳定版本 `0.1.4`，本地开发候选为 `0.1.5`。支持本地 MP4 动态壁纸与维护方随版本提供的官方壁纸。0.1.5 新增《光遇 · 向日葵午后》暖阳网页场景，原魈 / 璃月灯火（full-v016）继续支持实时受光、昼夜、粒子、灯光、Bloom 和时间日期。软件内可手动检查 GitHub Releases 更新。

## 安装与观看

从 [GitHub Releases](https://github.com/likefadian/genshin-live-wallpaper/releases/tag/v0.1.4) 下载 `GenshinWallpaper-Setup-0.1.4-x64.exe`。使用 0.1.3 的用户也可在软件设置中检查、下载并安装新版本。完整源码位于本仓库 main 和对应的版本标签。

本地新候选安装器为 `release/GenshinWallpaper-Setup-0.1.5-x64.exe`，公开版本安装器仍为 0.1.4。选择安装目录并完成安装，支持当前用户安装，无需管理员权限；旧版升级继续沿用用户设置。首次启动打开壁纸库，壁纸位于主显示器的桌面图标后；切换到桌面即可观看。运行无需 Node.js、AE、Vite、.NET 或 WebView2，首次安装后可离线使用。

默认使用无损独立分块。0.1.5 同步上游预读缓存修复，以实际分块尺寸安排 128 MiB 解码缓存预算：魈为 21 帧 / 126 MiB，光遇为 18 帧 / 123.75 MiB，另有在途解码及 GPU 资源。这些是像素尺寸计算，不是进程总内存或功耗。安装包保留基础完整帧、所有分块与校验清单，完整原图集继续保存在 `content/` 源码中。显卡选择沿用原逻辑。

关闭设置窗口不会退出壁纸。单击/双击任务栏托盘图标打开设置；右键托盘可暂停/恢复、重新连接、打开日志、设置开机启动或退出。软件设置页也提供退出按钮。完整退出后 Windows 原有桌面背景恢复。

设置页按壁纸能力显示控制。魈支持晨/昼/昏/夜、固定时刻/跟随系统时间/连续昼夜和实时光影；光遇保留固定午后光色，支持整体亮度、暂停、速度、时钟、显示比例和三档采样画质。切换壁纸保留用户的全局控制偏好。设置由主进程保存，软件更新沿用同一个目录：`%APPDATA%/GenshinEXE/settings.json`。日志在同级 `logs/`。

## MP4 壁纸

在“壁纸库 → 我的导入”点击“导入 MP4”，选择电脑上的视频。软件会检查能否解码，保存副本并生成静态封面。导入完成后点击“使用壁纸”应用。默认静音循环，在“动效与画面”中调整暂停、速度、音量、显示比例和时钟；选择视频时隐藏实时场景专用控制。切换到视频后释放原场景，设置窗口只显示静态封面。

本地副本与清单位于 `%APPDATA%/GenshinEXE/wallpapers/`，重启和软件升级继续使用原选择。移除时只删除软件副本，保留下载的原视频；移除当前视频会先切回内置场景。文件丢失或解码失败也会回退并提示。MP4 内部编码各异，导入以实际解码结果为准，当前不自动转码。

我们作为维护方使用录入命令添加“官方壁纸”，无需填写作者署名；新作品随下一版软件交付，卡片按官方 / 本地来源展示。新增作品不会覆盖用户导入或当前选择。操作见 [官方壁纸录入说明](docs/author-wallpapers.md)。当前没有正式录入的官方 MP4，验收视频保留在本地测试目录。

## 编辑与重建

使用 Node.js 24 或更新的受支持版本。源码包自带所需渲染源码、内容配置与正式图集，不需要访问原 V3 项目。双击 `Start-Development.cmd` 启动开发版；双击 `Build-Installer.cmd` 生成安装包。也可在项目根目录运行：

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run setup
npm.cmd start
npm.cmd run dist:installer
```

`setup` 显式安装 Electron（兼容 npm 的安装脚本策略），下载缓存留在本项目 `.cache/electron`。官方连接失败时使用镜像，但仍使用 Electron 包中的 SHA-256 校验。`prepare:web` 将已有正式资源复制到本地网页并构建桌面适配；不重新制作角色或导出 AE。打包从已安装并校验的 Electron 目录复制运行时，NSIS / 构建缓存位于 `.cache/electron-builder`，输出在 `release/`。构建命令强制 `--publish never`。

必要核心检查为 `npm.cmd test`（设置、壁纸库、媒体 Range、播放器生命周期、来源完整性及软件更新）。网页场景实际检查为 `node scripts/verify-web-scenes.mjs`；MP4 检查为 `node scripts/verify-video-probe.mjs <MP4路径>` 和 `node scripts/verify-mp4.mjs <MP4路径>`。需先准备测试 fixture，见 [验收记录](docs/verification.md)。实际桌面检查记录在 [docs/status.md](docs/status.md)。诊断脚本只连接显式启用的本地 Chromium 调试端口，正常安装版不开放该端口。

## 源码结构

- `electron/`：主进程、设置状态、本地资源服务、Windows 桌面宿主、受限 preload 与独立设置窗口。
- `vendor/v3/`：V3 渲染器、内容协议、注册及 JSON 的原样快照。`content/source.json` 记录首次来源；`content/engine-update.json` 记录本轮已接受提交及逐文件SHA-256。
- `content/assets/`：魈 full-v016 和光遇 warm-sun-v001 的同帧多通道图集、无损 tiles-v001、场景资源与缩略图；运行帧哈希由 V3 加载器验证。
- `content/official-videos/`：维护方录入的 MP4、静态封面与官方清单，随版本构建交付。
- `scripts/`：导入、网页构建、安装包构建、源码包与可选本地诊断。
- `web/`：可重建的内置网页产物，随安装包进入 `resources/wallpaper`。
- `docs/`：设计、实施计划、环境与阶段状态。

首次导入使用 `node scripts/import-v3.mjs <V3项目路径>`，当前已导入，无需重复执行。导入脚本拒绝覆盖现有来源记录。扩展实时角色仍需制作并注册兼容组合；支持导入 MP4，不支持其他引擎场景包热安装或任意原画混搭。

本轮开发同步使用 `node scripts/sync-v3-engine.mjs <V3项目路径> ada791d53a07e02e5d53c0dd3e022eace5534505`，从已确认 registry 收集可选场景的资源，验证 Git 内容、完整序列和分块的关联哈希。保留首次导入记录，不携带未引用候选或 AE 工程。同步结果已嵌入本项目；独立重建和安装运行均不需要 V3 目录或 Git。

## 软件更新

正式更新源为 [likefadian/genshin-live-wallpaper](https://github.com/likefadian/genshin-live-wallpaper) 的公开、稳定 GitHub Releases。设置的“软件”页提供检查更新、版本说明、下载进度和重启安装。下载完成并通过 SHA-512 校验后，仍需确认才退出壁纸并运行 NSIS。检查、下载失败可重试；普通退出不会自动安装。尚无正式发布时显示“尚无发布版本”，网络错误单独显示，不假报最新版。

0.1.2 及更早版本没有更新器，需要手动安装新版。0.1.3 及后续版本可从软件内更新。每次 Release 需要匹配的安装 EXE、`latest.yml` 和 `.exe.blockmap`；新候选说明在 `docs/releases/0.1.5.md`。构建只在本地生成这些文件，始终 `--publish never`；发布在核对产物后另行执行。

本地验收使用专用旧候选 `0.1.3-verify.0` 和受限 loopback 更新源；需要显式 `--verify-update`、专用配置目录及 `GENSHINEXE_VERIFY_UPDATE_URL`，独立下载缓存不会覆盖正式缓存。该候选只用于本地测试，不是发布版本。实际结果见 [docs/verification.md](docs/verification.md)。正常用户运行始终读取内置 GitHub 配置。

公开发布以 GenshinWallpaper 命名，完整源码同步至 main，版本附件包含安装器、blockmap 与更新清单。发布记录及实际远端验收结果见 [docs/status.md](docs/status.md)。软件继续沿用稳定安装标识和 `%APPDATA%/GenshinEXE` 设置目录。

## 后续阶段与当前限制

独立壁纸包的协议、兼容检查与安装尚未实现，按原交接分阶段推进。

当前范围为 Windows x64 与主显示器，实测本机 Windows 11；多显示器和其他设备未验收。未购买/配置代码签名证书，本地 EXE 的签名状态以文件属性为准。1.5/2 倍画质会增加显卡负担，未执行持续性能/多设备测试。桌面宿主为 Explorer 的 Progman/WorkerW 挂载，提供30秒一次的丢失检查与重连；未在本轮主动重启用户的 Explorer。

官方资料：[Electron 分发](https://www.electronjs.org/docs/latest/tutorial/distribution-overview)、[NSIS](https://www.electron.build/v26/docs/nsis/)、[后续自动更新](https://www.electron.build/v26/docs/features/auto-update/)。
