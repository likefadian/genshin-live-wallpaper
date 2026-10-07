# GenshinEXE

Windows x64 动态壁纸软件，当前本地版本 `0.1.2`。已接入 V3 用户确认的共用引擎优化和无损动态分块传输，使用原魈 / 璃月灯火（full-v016），保留原动态头发、自然闭眼、身体接触、四时段背景、实时受光、粒子、灯光、Bloom 和时间日期。

## 安装与观看

打开 `release/web-engine-v001/GenshinEXE-Setup-0.1.2-x64.exe`，选择安装目录并完成安装。支持当前用户安装，无需管理员权限；旧版升级继续沿用用户设置。首次启动打开设置，壁纸位于主显示器的桌面图标后；切换到桌面即可观看。运行无需 Node.js、AE、Vite、.NET 或 WebView2，首次安装后可离线使用。

默认使用无损分块：每帧解码/上传的原始RGBA像素从约14.82 MiB降到6 MiB，8帧缓存的像素估算为48 MiB（另有在途解码及GPU资源）。这些是资源尺寸计算，不是进程总内存、功耗或风扇降幅。原完整图集继续保留，因此安装包比0.1.0更大。显卡选择沿用原逻辑；0.1.1强制核显试验保留在独立Git候选分支。

关闭设置窗口不会退出壁纸。单击/双击任务栏托盘图标打开设置；右键托盘可暂停/恢复、重新连接、打开日志、设置开机启动或退出。软件设置页也提供退出按钮。完整退出后 Windows 原有桌面背景恢复。

光影页支持晨/昼/昏/夜、固定时刻/跟随系统时间/连续昼夜、亮度/主光/阴影及增强开关。动效页支持暂停、速度、风、粒子、时钟、等比铺满/完整与三档采样画质。设置由主进程保存，软件更新沿用同一个目录：`%APPDATA%/GenshinEXE/settings.json`。日志在同级 `logs/`。

## 编辑与重建

使用 Node.js 24 或更新的受支持版本。源码包自带所需渲染源码、内容配置与正式图集，不需要访问原 V3 项目。双击 `Start-Development.cmd` 启动开发版；双击 `Build-Installer.cmd` 生成安装包。也可在项目根目录运行：

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run setup
npm.cmd start
npm.cmd run dist:installer
```

`setup` 显式安装 Electron（兼容 npm 的安装脚本策略），下载缓存留在本项目 `.cache/electron`。官方连接失败时使用镜像，但仍使用 Electron 包中的 SHA-256 校验。`prepare:web` 将已有正式资源复制到本地网页并构建桌面适配；不重新制作角色或导出 AE。打包从已安装并校验的 Electron 目录复制运行时，NSIS / 构建缓存位于 `.cache/electron-builder`，输出在 `release/`。构建命令强制 `--publish never`。

必要核心检查为 `npm.cmd test`（设置持久化/损坏字段/时间锚点/资源错误），实际桌面检查记录在 [docs/status.md](docs/status.md)。可选开发诊断脚本 `scripts/inspect-local.mjs` 只连接显式通过启动参数启用的本地 Chromium 调试端口，正常安装版启动不开放该端口。

## 源码结构

- `electron/`：主进程、设置状态、本地资源服务、Windows 桌面宿主、受限 preload 与独立设置窗口。
- `vendor/v3/`：V3 渲染器、内容协议、注册及 JSON 的原样快照。`content/source.json` 记录首次来源；`content/engine-update.json` 记录本轮已接受提交及逐文件SHA-256。
- `content/assets/`：正式 full-v016 的同帧多通道图集、无损 tiles-v001、场景资源与人物缩略图；运行帧哈希由 V3 加载器验证。
- `scripts/`：导入、网页构建、安装包构建、源码包与可选本地诊断。
- `web/`：可重建的内置网页产物，随安装包进入 `resources/wallpaper`。
- `docs/`：设计、实施计划、环境与阶段状态。

首次导入使用 `node scripts/import-v3.mjs <V3项目路径>`，当前已导入，无需重复执行。导入脚本拒绝覆盖现有来源记录。扩展角色仍需制作并注册兼容组合；当前只能加载内置魈，不支持外部包热安装或任意原画混搭。

本轮开发同步使用 `node scripts/sync-v3-engine.mjs <V3项目路径> f407ea7`，要求来源与已确认提交一致，保留首次导入记录。软件源码ZIP已包含同步结果；独立重建和安装运行均不需要V3目录或Git。

## 后续阶段与当前限制

本次交付完成本地阶段，远程更新最终目标仍待推进。独立内容包的协议/兼容与安装尚未实现。更新源未配置，软件如实显示“未配置更新源”，当前不检查或下载在线新版本，也不会假报“已是最新版”。后续按交接实现 NSIS + electron-updater 的检查、更新说明、用户确认下载、进度、校验及重启安装。

发布阶段需要一次集中确定：GitHub Releases 发布仓库或 HTTPS 更新目录、发布权限、源码公开/私有偏好；壁纸包可独立托管。用户未授权前不上传、不创建公开仓库、不发布。远程验收必须通过真实安装旧版 → 真实远端新版，检查用户设置保留。

当前范围为 Windows x64 与主显示器，实测本机 Windows 11；多显示器和其他设备未验收。未购买/配置代码签名证书，本地 EXE 的签名状态以文件属性为准。1.5/2 倍画质会增加显卡负担，未执行持续性能/多设备测试。桌面宿主为 Explorer 的 Progman/WorkerW 挂载，提供30秒一次的丢失检查与重连；未在本轮主动重启用户的 Explorer。

官方资料：[Electron 分发](https://www.electronjs.org/docs/latest/tutorial/distribution-overview)、[NSIS](https://www.electron.build/v26/docs/nsis/)、[后续自动更新](https://www.electron.build/v26/docs/features/auto-update/)。
