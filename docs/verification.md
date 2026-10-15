# 必要验证 · 2026-10-15

## 0.1.4 MP4 壁纸候选

| 需求 | 实际检查与结果 |
|---|---|
| 本地导入与保存 | 单元检查覆盖同名中文文件、重启清单、原文件保留、写入 / 探测失败回滚；真实 Electron 导入用户 2K60 MP4 成功 |
| 解码与缩略图 | 有画面、尺寸、时长和首帧；拒绝损坏、仅音频文件，1ms 超时会关闭检查窗口 |
| 资源边界 | GET / HEAD / Range 的完整、尾部、开放区间与 416 错误；未登记、删除条目和越界路径不可读取 |
| 运行对象释放 | 异步旧实例与迟到错误不覆盖新选择；桌面切到 MP4 后 video=1、canvas=0，设置页 video=0、canvas=0 |
| 桌面操作 | 19 项流程通过：取消 / 重复导入、损坏拒绝、主动应用、暂停 / 音量 / 速度 / 比例 / 时钟、尾部循环、快速切换、关闭设置、重启、文件缺失回退、取消与确认移除 |
| 官方随版本交付 | 在专用构建副本中使用作者命令，构建 MP4 和 PNG；新增第二官方作品保留本地选择；官方播放正常且不能从本地移除；移除当前官方条目回退 |
| 设置界面 | 检查 800×820 与最小 740×650 截图，无水平溢出；静态缩略图，视频时隐藏场景专用项 |
| 本地安装候选 | 0.1.4 NSIS 构建成功；实际打包 EXE 原生入口导入、桌面挂载、播放及重启恢复通过，未执行 NSIS 覆盖安装 |

核心 `npm.cmd test`：24/24。用户视频：H.264、2560×1440、60 fps、15.65 秒、39405825 字节，SHA-256 为 `e6a1dd4f6a973a5b3c72a021fea16fe7311decde60c871ce5c0569a7596ced82`。原文件与软件副本哈希一致，自动移除测试后原文件不变。该文件没有加入官方资源。

实际打包版来自 `release/win-unpacked/GenshinWallpaper.exe`，从 `C:/Windows/Temp` 启动，无调试参数、无验收更新源。`version=0.1.4 / packaged=true / desktopStatus=attached / wallpaperStatus=running / renderError=''`，资源根为打包目录的 `resources/wallpaper`，视频来自专用用户目录。重启继续同一视频并推进，专用实例已退出。

本轮设备范围为 Windows 11 x64、主显示器、175% 缩放；没有执行 0.1.3 → 0.1.4 的 NSIS 覆盖升级，没有覆盖多设备或长期性能。

现场记录：`work/mp4-wallpapers/e2e-1792055922746/results.json` 及截图、`delivery-1792055995816/results.json`、`packaged-results.json`、`packaged-playing.json`、`packaged-restarted.json`。安装器及校验结果以 `packaged-results.json` 为准，后续修复重建会更新该文件。

复现先安装开发依赖、运行 prepare:web；只有生成测试视频需要 PATH 中的 ffmpeg，软件运行无需 ffmpeg：

```powershell
node scripts/prepare-video-fixtures.mjs
node scripts/verify-video-probe.mjs "D:\你的壁纸.mp4"
node scripts/verify-mp4.mjs "D:\你的壁纸.mp4"
node scripts/verify-official-delivery.mjs
npm.cmd test
npm.cmd run dist:installer
```

自动桌面脚本使用专用 profile 和显式 loopback 调试端口 9257，独立开发入口仅替换原生对话框；安装包不包含该测试入口。实际打包版采用正常原生入口验证，正常启动不开放调试端口。

## 2026-10-15 · main 合并与 SSH 源码推送

- codex/github-updates 的正式 0.1.3 已快进合并到 main。远程此前为独立 README 初始化提交，保留该历史并采用正式版本的完整 README，生成合并提交 0c3601b8060d83573fe5c986e48cf5c95775993a。
- git diff --exit-code codex/github-updates 0c3601b 返回 0，确认整棵文件树一致；npm.cmd test 的 8 项检查全部通过。
- ssh -T 以 likefadian 成功认证；该命令正常提示 GitHub 不提供 shell，退出码 1 不代表认证失败。实际 git push -u origin main 使用同一 Windows OpenSSH 和现有密钥，返回 exit 0，远程 main 从 ee188bb 更新到 0c3601b。
- git ls-remote 独立核对远程 main 的完整 SHA 与本地合并提交一致，工作区干净。公开 v0.1.3 标签仍指向此前的 ee188bb；原 Release 附件与更新清单沿用已有发布内容。
- 上述推送由用户本轮明确授权，完整软件源码已公开。下方“源码未上传”的描述属于 2026-10-08 发布时的历史状态；MP4 功能仍只在独立分支中保存设计与计划。

## GenshinWallpaper 正式命名

- 8/8 核心检查通过，改名后的网页与 NSIS 构建 exit0；安装器 Windows ProductName 为 GenshinWallpaper。
- 实际覆盖安装到同一 `.local-install` 目录 exit0，旧 GenshinEXE.exe 已移除，新 GenshinWallpaper.exe 正常运行。实际 Windows 窗口及侧栏名称完整，品牌文字没有溢出。
- 原 `%APPDATA%/GenshinEXE/settings.json` 与安装前备份 SHA-256 相同，为 `df3f21938feaf19156876936abafec4eb051ebf70ae427f6e092ac7aa91c1e20`。实际打包版读取该设置，桌面挂载成功，tiles / RTX4060，加载和渲染错误为空。
- 正式名称安装器、blockmap 与 latest.yml 全部重新生成，清单中的 URL、字节数与 SHA-512 按新文件核对；没有把旧安装器改文件名后上传。

## GitHub 正式发布与实际远端升级

- 稳定版 `v0.1.3` 于 `2026-10-08T00:53:38Z` 正式发布并设为 Latest，Release ID `406289761`。发布前核对三个附件的服务端 SHA-256、字节数、上传状态及中文说明，全部匹配本地文件。公开 latest/download/latest.yml 实际下载后的 SHA-256 也相同。
- 正式附件为 `GenshinWallpaper-Setup-0.1.3-x64.exe`（739230542 字节）、对应 blockmap（769295 字节）及 latest.yml（1021 字节）。安装器 SHA-256 为 `e7c0bde7eaeab7558ecd25b2d6ebbb1419a2684595174cb8f93dd4a291babf3c`。
- 实际旧测试版 `0.1.3-verify.0` 使用正常用户目录和内置 GitHub 源；没有 loopback 地址、验收覆盖源或调试端口。通过真实软件按钮检查到 `availableVersion=0.1.3`，中文说明与发布正文相同。
- 实际 GitHub 下载从0推进到739230542字节，完成状态为 downloaded / 100%。缓存安装器的 SHA-256 和 SHA-512 与本地已发布安装器完全相同，未复用本地验收服务的下载结果。旧测试版未发布，旧 blockmap 返回 HTTP 404 后正确退回完整下载；未验收远端差分节省量。
- 真实“重启并安装”按钮与原生确认触发 `quitAndInstall`，`2026-10-08T01:01:25.084Z` 日志记录运行 GitHub 下载缓存中的安装器，参数 `--updated,/S,--force-run`；旧版退出，`01:01:44.881Z` 自动启动新版。实际主进程为 `.local-install/GenshinWallpaper.exe --updated`，ASAR版本0.1.3，旧 GenshinEXE.exe 已移除。
- 原用户设置文件与升级前备份 SHA-256 一致，仍为 `df3f21938feaf19156876936abafec4eb051ebf70ae427f6e092ac7aa91c1e20`。新版读取同一设置目录，壁纸 running / attached、tiles、RTX4060，加载与渲染错误为空；已查看自动重启后的实际 Windows 窗口和正式名称。
- 软件源码未上传或推送；公共 tag 只指向原公开仓库 README 的 `ee188bb2c22b9577e6d11b72e22f81c4df5e4b6b`。本地软件改名提交为 `e4591611746404afcf9351f6ce56cd2c93369aab`，源码 ZIP 继续单独交付。新源码 ZIP 579 个条目逐一核对匹配，随后仅更新发布记录文档并再次核对更新条目。

下列保留改名前的必要验证记录。

仅验证桌面软件、已接受的网页优化接入，以及本轮手动更新链路。未重跑 V3 角色视觉矩阵、原生导出或长期性能。

## 0.1.3 更新接入 · 真实本地升级通过

- `npm.cmd test`：8/8；覆盖原设置与资源行为，加上更新安装资格、真实空Release错误和网络错误的区分、SHA-512失败重试、并发限制以及专用来源/缓存隔离。新控制器与缓存隔离断言均先运行失败，再实现并验证通过。
- 正式0.1.3和旧候选0.1.3-verify.0本地NSIS构建 exit0。正式清单中的安装器大小739229982字节，与实际SHA-512一致；配套blockmap769357字节。内置GitHub配置、实际ASAR版本和验收配置加载分支已读取核对；electron-updater的MIT许可证保留在ASAR中。
- 专用旧候选已静默安装，安装器 exit0。原用户设置已备份，SHA-256为 `df3f21938feaf19156876936abafec4eb051ebf70ae427f6e092ac7aa91c1e20`。验收profile预置非默认曝光0.18、固定06:30和隐藏时钟，设置SHA-256为 `02eb877443cab047d5c42509ef7be947e00533d0a9fa9ff8c8ab19db2ba7caf6`。
- 实际软件启动被自动批准机制拒绝，只返回 `blocked by policy`，包含去除调试参数的尝试。未绕过限制；用户手动执行专用启动文件并前置软件后，使用computer-use完成实际Windows按钮和NSIS安装确认。验收与正常实例均无调试端口。
- 旧安装版实际为 `0.1.3-verify.0 / packaged=true / attached`，通过UI检查到0.1.3并展示更新说明。首个损坏文件被真正的electron-updater SHA-512拒绝：`ERR_CHECKSUM_MISMATCH`、状态error、retry=download；UI无安装按钮，动态桌面未停止。记录在 `work/github-updates-v001/download-rejected.json`。
- 切换本机服务到正确文件，实际点击“重新下载”到100%，739229982字节完整安装器校验成功。再次独立核对下载缓存中的文件SHA-512与正式清单一致。专用缓存目录为 `genshinexe-verify-9b5108c50e6ba756`，下载前后正式缓存中原installer.exe的SHA-256均为 `520401750a439c8cdd9e54bb9b781b0c55ddc159001f17256849f648618a275e`。该验收缺少专用缓存的旧installer.exe，更新器正常回退完整下载；没有验收远端差分或宣称其节省量。
- UI在downloaded后才展示“重启并安装”；点击打开原生确认，确认后真实日志为 `Install on explicit quitAndInstall`、`--updated,/S,--force-run`。旧主进程32808退出，实际NSIS覆盖安装到0.1.3并自动启动新主进程12680；实际ASAR version=0.1.3。7个安装内更新源码/设置文件与工作目录一致。
- 原用户设置SHA-256仍为 `df3f21938feaf19156876936abafec4eb051ebf70ae427f6e092ac7aa91c1e20`。专用验收profile的非默认设置SHA-256仍为 `02eb877443cab047d5c42509ef7be947e00533d0a9fa9ff8c8ab19db2ba7caf6`，由安装内新版SettingsStore读取后逐项匹配。NSIS的Shell启动回到正常profile，未继承验收源，实际读取原用户设置；没有把专用profile的新读取误报成自动重启实例。
- 自动重启实例源为真实GitHub仓库，启动参数仅 `--updated`，没有验收或调试参数。实际资源根为安装目录 `resources/wallpaper`，RTX4060、tiles、1672×941，桌面挂载成功，动画秒62.64→268.58、loadError为空、documentHidden=false。
- 一次独立代码审查及缓存修复复核已完成，无未解决发现。源码ZIP的579个条目逐一与工作目录SHA-256匹配，排除依赖、缓存、输出和用户数据。GitHub远端附件下载与升级尚未验收；正常退出不自动安装由显式false配置和核心检查验证，未额外重复真实安装。
- 最终正常实例通过UI点击真实GitHub源“检查更新”（被游戏遮挡的窗口由用户手动前置和点击），实际返回 `ERR_XML_MISSED_ELEMENT / No published versions on GitHub` 并显示 `no-release`，checkedAt=`2026-10-07T12:42:46.992Z`，错误文本为空；没有显示“已是最新版”。实际结果保存在 `work/github-updates-v001/github-real-source.json`。

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

多显示器、不同机器、开机重登、主动重启 Explorer 恢复、1.5/2倍长期性能、独立内容包安装，以及远端差分节省量。EXE未签名；GitHub正式发布与完整远端升级已实际完成。
