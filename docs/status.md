# GenshinEXE 状态 · 2026-10-07

当前本地版本 **0.1.2 / Windows x64 / 主显示器**，已接入用户确认的网页优化并覆盖安装。当前正常实例使用 RTX 4060，保留原用户设置；没有配置或发布远程更新。

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

**软件远程更新：未配置来源、未实现/验收远程升级。** 当前界面明确“未配置更新源”，没有假报最新版。后续接入 electron-updater：版本/说明、用户确认下载、进度、校验、失败保留旧版与重启安装；用户选定真实源和发布权限后再配置构建/发布清单，并完成真实旧版→真实远端新版的升级及设置保留验证。

待集中确认：GitHub Releases 仓库或 HTTPS 更新目录、发布权限、源码公开/私有偏好；壁纸包可独立托管。**未创建远程仓库，未上传，未发布。**

本地 EXE 未签名；多显示器、其他机器、开机重登、主动重启 Explorer 和高采样长期性能未验收。此阶段不是整个远程更新项目的最终完成。
