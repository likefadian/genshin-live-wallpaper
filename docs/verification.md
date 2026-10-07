# 本地必要验证 · 2026-10-07

仅验证桌面软件与本次网页优化接入。未重跑 V3 角色视觉矩阵、原生导出或长期性能。

## 0.1.2 优化接入 · 已完成

网页来源为已接受的 `f407ea7`（包含 `aba5612`），对应V3的 `web-performance-v001.md` 与 `web-frame-patches-v001.md`。网页阶段已记录全部240帧重建像素一致及选定帧GPU一致，本轮沿用该已接受结果，不重复制作或导出。

- `npm.cmd test`：现有4/4通过；`npm.cmd run prepare:web` 与NSIS构建 exit0。安装器输出独立本地目录，构建命令显式 `--publish never`，未上传。
- 来源同步只接受固定Git提交，文本允许Windows CRLF转换，PNG要求Git blob和SHA-256均一致。同步清单中的37个源码/JSON，以及安装目录内的241个分块文件全部SHA-256通过；240个原完整帧也与原manifest一致。
- 真实打包版在独立验证配置运行，`version=0.1.2`、`packaged=true`、`desktopStatus=attached`、`frameTransport=tiles`。动画持续推进，加载/渲染错误为空；设置canvas=0、壁纸canvas=1。已查看实际动态窗口截图及Windows设置窗口。
- NSIS实际升级 `.local-install`：exit0，EXE产品版本0.1.2.0。升级前备份用户设置，升级后原文件SHA-256为 `df3f21938feaf19156876936abafec4eb051ebf70ae427f6e092ac7aa91c1e20`，完全一致，原设置被新进程读取。
- 最终安装版从 `C:/Windows/Temp` 正常启动，未传调试参数、未使用临时profile；实际资源根为 `.local-install/resources/wallpaper`。原生挂载返回 `classic-workerw / attached=true`，动画秒159.2047→163.1255、等待帧0、`documentHidden=false`、错误为空。
- 实际渲染器为 `NVIDIA GeForce RTX 4060 Laptop GPU`；分块像素1572864/帧、缓存容量8，像素缓存估算50331648字节（48 MiB），全部原光影/粒子/Bloom启用，画质1672×941。数值来自本地运行状态；没有据此宣称实际功耗或风扇降幅。
- 独立验证实例已退出、9239调试端口已关闭；最终只有一个安装版主进程及其正常Electron子进程。安装版设置窗口已在前台显示，壁纸保持运行。更新状态仍为 `unconfigured`。

本轮现场摘要：`work/web-engine-v001/verification-summary.json`。旧安装包、原来源记录和核显试验候选分支均保留；V3源项目未修改。

## 0.1.0 首次交付 · 已完成

- 正式资源来自 V3 的 full-v016；从新项目快照构建，运行加载同帧图集并保留 V3 原 SHA-256 校验。没有修改 V3 源项目。
- `npm.cmd test`：4/4。覆盖用户设置跨启动保存、无效修改不覆盖已保存值、损坏字段/JSON、昼夜锚点不被无关控制重置、真实文件及明确 HTTP 错误/路径边界。
- 开发版原生挂载返回 classic-workerw / attached=true；主显示器 physical bounds 来自 Electron/Windows 映射；壁纸 snapshot.documentHidden=false，frame/animationSeconds 持续前进，无 loadError。
- 开发版修改曝光 +0.12、关闭时钟、暂停并退出；重启实际读取这些设置，frame=0 保持暂停。通过真实 Windows 设置窗口的“恢复动画”按钮恢复，随后记录 frame47 → 168，关闭设置后壁纸仍运行。
- 设置页真实 Windows 窗口已查看，版式完整；实际本地页 portraitLoaded=true、canvasCount=0，渲染页 canvasCount=1。画面 `work/wallpaper-live.png` 是实际壁纸窗口的截图，仅作为现场记录，不替代动态检查。
- 使用当前 Electron 44.6.0 和 electron-builder 26.15.3，`npm.cmd run dist:installer` exit 0；全离线 NSIS 安装包与 blockmap 已生成，`publish=null` / `--publish never`，未上传。
- NSIS 安装到本机项目下 `.local-install`，installer exit 0；软件 EXE、内置资源、第三方许可证实际存在。此路径只用于本机观看，发给其他人可自由选安装目录。

安装后从 C:/Windows/Temp 启动，实际 packaged=true / desktopStatus=attached / loadError=''；日志资源根为安装目录内 resources/wallpaper，设置页无第二个 canvas。曝光 +0.16 与时钟关闭后退出，旧本地服务连接被拒绝；重启实际读取 +0.16 / showClock=false。恢复默认曝光及时间显示，关闭设置后 Chromium 只剩一个壁纸页面，animationSeconds 从68.65增至71.08，资源无错误。

原生检查发现旧宿主边框问题：frame=false 的 Electron 仍默认 thickFrame=true，SetParent 后保留窗口非客户区域。仅移除 Win32 caption/thickframe 位仍有内缩；同时在构造时指定 thickFrame=false，实测 physical client 与 outer 同为2561×1602，visible/child/mouseTransparent 均为true，父窗口类为WorkerW。验证从失败（1449×908 /1463×915）到通过，重新构建4项检查通过，随后重打包并复验安装版。屏幕映射取整造成1/2像素 overscan，由主显示器桌面父层裁切，不存在边框留白。

现场摘要在 work/local-verification-summary.json；最终安装版状态见 status.md。未主动重启用户的 Explorer。

## 未验收范围

多显示器、不同机器、开机重登、主动重启 Explorer 恢复、1.5/2倍长期性能；独立内容包安装和真实远程更新。本地签名状态 NotSigned，尚无发布源。
