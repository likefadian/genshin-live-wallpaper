# MP4 壁纸导入与官方发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户能导入并播放本地 MP4，我们能添加官方 MP4 随软件版本交付，升级后保留用户壁纸与选择。

**Architecture:** 官方和本地作品合并为同一个目录，主进程负责导入、验证和持久化。媒体检查复用 Electron，桌面渲染适配层在实时场景和视频播放器之间切换；官方资源沿用现有安装包和更新链路。这是共用目录、检查器和播放器的一项完整功能。

**Tech Stack:** 现有 Node.js 24、Electron 44.6.0、CommonJS 主进程、ESM 渲染模块、HTML/CSS、node:test、esbuild、electron-builder / NSIS。运行功能不新增视频转码依赖。

**Spec:** [已确认设计](../specs/2026-10-15-mp4-wallpapers-design.md)。执行前同时阅读本计划与设计。

## Global Constraints

- 本阶段只导入 MP4，沿用 Windows x64 和主显示器支持范围。
- 正常升级沿用稳定 appId 与原用户数据目录。
- MP4 循环播放、默认静音；关闭设置窗口后桌面壁纸继续播放。
- 恢复壁纸默认设置重置播放和画面控制，保留当前作品选择。
- 原始下载文件不受影响；清理只针对经过验证、位于预期作品目录内的软件副本。
- 首次实现若没有用户提供的正式 MP4，官方视频清单允许为空；验收视频单独放在 work/，不作为正式作者作品发布。
- 构建继续使用 --publish never，正式发布沿用已有 GitHub 发布流程。

## Review Focus

1. 同名文件、中文与空格路径：独立作品 ID 不冲突，两个原文件都保留。任务 1。
2. 磁盘写入失败或探测超时：无半成品登记，旧目录和当前选择有效，探测窗口关闭。任务 1、3。
3. 视频切换中马上改设置 / 再切作品：只有最后选择生效，旧实例及迟到错误被释放或忽略。任务 5、6。
4. 视频尾部需要读取、无效 Range 或请求已移除条目：按 HTTP 规则响应，不能读未登记媒体。任务 2。
5. 升级增删官方作品、当前本地文件被外部移走：本地库不丢失，失效选择回退魈，提示原因。任务 4、6、7。

## 文件与接口约定

| 文件 | 职责 |
|---|---|
| electron/library.cjs | 本地目录存取、受限媒体映射、视频导入事务与官方清单校验 |
| electron/video-probe.cjs、video-probe.html | 隐藏 Electron 窗口实际解码和生成缩略图 |
| electron/probe-video-cli.cjs | 维护端 / 验收用独立探测进程，不启动桌面宿主 |
| electron/asset-server.cjs | MP4 MIME、单段 Range、已登记本地媒体访问 |
| electron/video-runtime.mjs、wallpaper-controller.mjs | 视频控制与异步运行对象切换 |
| electron/main.cjs、preload.cjs、settings.cjs | 受限 IPC、选择与音量保存、状态同步 |
| electron/settings/ | 壁纸库静态卡片与按作品类型显示控制 |
| scripts/import-official-video.mjs、prepare-web.mjs | 作者资源登记与官方目录构建 |
| tests/library.test.cjs、media.test.cjs、playback.test.cjs | 数据事务、媒体边界与切换竞争检查 |
| scripts/verify-mp4.mjs | 专用 profile 下的实际播放和集成验收 |

WallpaperEntry 的共用字段为 id、kind（scene / video）、source（official / local）、name、author、thumbnail。视频项另含 media、duration、width、height、size；media 和 thumbnail 是服务器相对 URL，不是绝对磁盘路径。场景项保留原 controls、presentation、sceneName 等字段。

官方视频 ID 为 official-video- 加作者提供的 ASCII slug，本地 ID 为 local-video- 加软件生成的 UUID。slug 仅允许小写字母、数字、连字符，1–80 字符；内置魈 ID 保持 xiao-liyue-full。VideoMetadata 为 {duration:number,width:number,height:number,thumbnailDataURL:string}，所有数值有限且大于 0，缩略图为 PNG。

## Task 1: 本地壁纸库与设置持久化

**Files:** 创建 electron/library.cjs、tests/library.test.cjs；修改 electron/settings.cjs、tests/core.test.cjs。

**Interfaces:** WallpaperLibrary({directory,officialWallpapers,probeVideo})；snapshot() 返回 {wallpapers,warnings}；get(id) 返回可用公共条目或 null；importLocal(filePath) 返回 Promise<WallpaperEntry>；removeLocal(id) 返回 Promise<void>；resolveMedia(id,kind) 返回已登记本地文件的绝对路径或 null，kind 仅为 video / thumbnail。导出 validateOfficialVideoCatalog(value,root,{strict=true}={}) 返回 {wallpapers,warnings}，用于任务 4；strict=true 时错误抛出，strict=false 时隔离错误项并返回提示。root 为清单内相对媒体路径的实际资源根。probeVideo(filePath) 的返回类型见共用约定。

- [ ] **1. 写失败检查。** 使用临时目录和注入的探测器，验证跨启动恢复、同名文件不同 ID、探测 / 保存失败不登记或损坏旧清单、移除不删除原文件、非法 ID 不能逃逸目录。SettingsStore 添加检查：旧设置默认 wallpaperId=xiao-liyue-full、videoVolume=0；拒绝无效 ID / 音量范围；合法选择与音量跨启动保存。

  检查名称“同名中文 MP4 导入、重启与移除保持原文件”；关键断言为 assert.notEqual(first.id,second.id)、assert.equal(reopened.get(first.id).id,first.id)，移除后 assert.equal(reopened.get(first.id),null) 且原文件字节与导入前一致。检查名称“探测或清单保存失败保留旧库”；断言失败前后 library.json 字节一致且失败作品未出现在 snapshot。
- [ ] **2. 运行失败检查。** node --test tests/library.test.cjs tests/core.test.cjs；预期新能力缺失导致失败，原有检查保持通过。
- [ ] **3. 实现接口。** directory 指向 userData/wallpapers，清单为 library.json，副本为 local/<id>/video.mp4 与 thumbnail.png。异步复制后探测，再原子登记；失败回滚本次目录。损坏清单产生 warnings，保留媒体。公共条目只输出 /user-wallpapers/<id>/video.mp4 等 URL。设置保存 wallpaperId、videoVolume∈[0,1]，其他原字段不变。
- [ ] **4. 运行成功检查。** 同一命令全部通过，并验证临时目录以外原文件内容不变。
- [ ] **5. 提交。** 仅提交上述文件，消息 feat(wallpapers): persist imported MP4 library and selection。

## Task 2: 受限媒体读取与 HTTP Range

**Files:** 修改 electron/asset-server.cjs；创建 tests/media.test.cjs。

**Interfaces:** startAssetServer(root,{resolveMedia}={}) 保留返回 {url,close}；resolveMedia 使用任务 1 的签名。只处理 /user-wallpapers/<id>/video.mp4 或 thumbnail.png，其他路径继续使用原静态资源根。官方 MP4 位于普通静态资源根内。

- [ ] **1. 写失败检查。** 创建内容为 0123456789 的文件：完整 GET / HEAD 为 200、video/mp4 和长度 10；bytes=2-5 为 206、Content-Range=bytes 2-5/10、正文 2345；bytes=6- 和 bytes=-4 正文均为 6789；bytes=10- 和多段请求为 416、Content-Range=bytes */10；未登记 ID、编码路径穿越和已移除条目不泄露文件。检查名称“MP4 Range 按真实文件字节响应”和“未登记及越界媒体请求不能读取文件”。
- [ ] **2. 运行失败检查。** node --test tests/media.test.cjs tests/core.test.cjs；预期 Range / 媒体映射检查失败。
- [ ] **3. 实现接口。** 流式传输，不整段载入内存；Range 端点不超过文件实际长度，支持 GET / HEAD，使用 Content-Range、Accept-Ranges 和正确 Content-Length。CSP 允许本源媒体。解析路径后只交给受限映射，连接关闭时销毁流。
- [ ] **4. 运行成功检查。** 同一命令全部通过，原有资源错误 / 路径检查继续通过。
- [ ] **5. 提交。** 消息 feat(media): stream registered MP4 resources with range support。

## Task 3: 实际视频解码与缩略图

**Files:** 创建 electron/video-probe.cjs、electron/video-probe.html、electron/probe-video-cli.cjs；在 work/mp4-wallpapers/ 保存验收输入和结果。

**Interfaces:** probeVideo(filePath,{timeoutMs=15000}={}) 返回 Promise<VideoMetadata>。独立入口接受 --file、--output、可选 --timeout-ms，通过输出 JSON 文件交付结果；成功 exit 0，失败非 0。维护命令用 spawn 参数数组调用，windowsHide=true；不打印缩略图的 base64 内容。

- [ ] **1. 准备实际输入。** 用本机 ffmpeg 生成 3 秒 H.264 / yuv420p 的小尺寸变化画面 MP4，并创建损坏 .mp4 与仅音频 MP4。先记录新探测入口尚不存在，作为实际验收的失败基线。
- [ ] **2. 实现 probeVideo。** 隐藏、sandbox、无 Node 集成且无桌面 preload 的窗口加载受限页面；用 file URL 读取主进程明确指定的文件，解码首帧，以最大 360×203 的画布生成 PNG。拒绝无视频轨道 / 非有限元数据，超时和任何错误都销毁窗口。
- [ ] **3. 运行独立入口。** node_modules/electron/dist/electron.exe electron/probe-video-cli.cjs --file work/mp4-wallpapers/fixture.mp4 --output work/mp4-wallpapers/probe.json；预期 exit 0、宽高与时长匹配、PNG 可查看。
- [ ] **4. 运行失败路径。** 损坏 / 仅音频输入失败；注入短 timeoutMs 验证超时清理。确认未残留探测 BrowserWindow，原壁纸实例不受影响。
- [ ] **5. 提交。** 消息 feat(media): validate MP4 decoding and create static thumbnails；work/ 结果不提交。

## Task 4: 作者添加与官方目录构建

**Files:** 创建 content/official-videos/catalog.json、scripts/import-official-video.mjs、docs/author-wallpapers.md；修改 scripts/prepare-web.mjs、package.json；扩展 tests/library.test.cjs。

**Interfaces:** 作者命令 npm.cmd run wallpaper:author -- --file <mp4> --id <slug> --name <名称> --author <作者>，默认写入 content/official-videos。支持 --catalog-root <目录> 供专用验收使用。调用任务 3 的独立入口，利用任务 1 的清单校验；记录 {schemaVersion:1,wallpapers:[...]}。导入成功输出 ID 和资源位置，不自动运行发布命令。

- [ ] **1. 写失败检查。** 官方目录增加一项后与旧本地库合并，两者和当前本地选择保留；拒绝重复 / 非法 ID、绝对路径、缺失媒体 / 缩略图和损坏元数据。单条运行期失效项隔离并产生 warning。
- [ ] **2. 运行失败检查。** node --test tests/library.test.cjs；预期官方目录能力缺失导致失败。
- [ ] **3. 实现导入与构建。** 作者命令异步复制到作品目录、探测、保存缩略图、原子登记；重复 ID 拒绝覆盖。prepare:web 校验后把资源复制到 web/official-videos，合并原场景目录并标记 source / kind。更新受控输出目录时只清理已验证位于 web 内的官方视频目录；保留原魈资源和来源记录。
- [ ] **4. 验证。** 同一检查通过。以 --catalog-root work/mp4-wallpapers/official 登记 fixture，复核资源和元数据；重复导入失败且清单不变。npm.cmd run prepare:web 成功，正式清单为空时现有魈目录正常。
- [ ] **5. 提交。** 消息 feat(authors): register official MP4 wallpapers for version delivery。

## Task 5: 唯一播放器与异步切换

**Files:** 创建 electron/video-runtime.mjs、electron/wallpaper-controller.mjs、tests/playback.test.cjs；修改 electron/wallpaper-renderer.mjs、electron/wallpaper.css。

**Interfaces:** createVideoRuntime(host,entry,{onError}) 返回 Promise<runtime>；runtime.apply(settings)、runtime.snapshot()、runtime.destroy()。createWallpaperController({createScene,createVideo,onReady,onError}) 返回 {select(entry),destroy(),current}；select(entry) 返回 Promise<runtime|null>，过期结果为 null，current 为 {entry,runtime} 或 null。两种 create 工厂均消费 entry 并返回 Promise<runtime>；onReady(entry,runtime)、onError(entry,error)。现有场景通过适配器实现同一 apply / snapshot / destroy 接口。snapshot 至少包含 wallpaperId、kind、currentTime、duration、paused、loadError；上报继续附 settings revision。

- [ ] **1. 写失败检查。** 用可延迟完成的工厂测试 A 开始加载后选择 B，A 迟到时被 destroy、不会替换 B；切换时旧实例只释放一次；已销毁控制器不接受迟到结果；旧实例错误不能影响新选择。检查名称“迟到播放器不能覆盖最新选择”：先完成 B 再完成 A，assert.equal(controller.current.entry.id,'B')，A 的 destroy 调用次数为 1，onReady 只收到 B。
- [ ] **2. 运行失败检查。** node --test tests/playback.test.cjs；预期控制器尚不存在。
- [ ] **3. 实现接口。** 视频 loop、playsInline，videoVolume=0 时静音；应用 motion、speed、videoVolume 与 object-fit，destroy 时暂停、清除 src 并调用 load。控制器使用单调切换序号管理异步创建。适配层先取得快照再按 kind 创建，不提前启动魈；最新快照在加载结束后应用，复用原时钟并按类型设置光影。
- [ ] **4. 验证。** 同一检查通过，npm.cmd run prepare:web 成功。实际观察视频播放 currentTime 前进，切到视频时 canvas 数为 0，切回魈后 video 数为 0、原动态与光照正常。
- [ ] **5. 提交。** 消息 feat(playback): switch between scene and MP4 wallpaper runtimes。

## Task 6: 桌面操作、壁纸库界面与恢复

**Files:** 修改 electron/main.cjs、electron/preload.cjs、electron/settings/index.html、settings.js、style.css；创建 scripts/verify-mp4.mjs。

**Interfaces:** 设置窗口新增 importWallpaper()、selectWallpaper(id)、removeWallpaper(id)，分别映射 library:import、library:select、library:remove。只接受设置窗口主 frame；选择写入 settings.wallpaperId。snapshot 的 catalog.wallpapers 为合并目录，另含 libraryWarnings 和 importStatus。桌面端 reportApplied({wallpaperId,revision,...snapshot})、reportError({wallpaperId,revision,message})，主进程校验 ID 与 revision；渲染器没有导入与删除能力。

- [ ] **1. 建立实际验收断言。** 脚本连接显式启用的 loopback 调试端口，仅使用专用 GENSHINEXE_PROFILE；检查目录、选择与作品 ID、播放进度、画布 / video 数、界面布局、错误信息和重启保存。添加“加载中改音量 / 再切作品”和“启动前移走当前文件”两个检查。
- [ ] **2. 实现主进程操作。** 原生文件对话框仅 MP4；导入串行、返回取消状态、错误不改变选择。选择验证当前可用条目；删除需要确认，当前作品先切魈并等待释放再移除副本。普通 settings:update 拒绝直接写 wallpaperId；reset 保留当前 ID。失效选择回退并记录提示，旧作品上报被忽略。
- [ ] **3. 实现界面。** 默认壁纸库页，官方 / 我的导入分区、静态卡片、当前标识、导入状态与明确错误。名称 / 作者用 textContent。侧栏缩略图和名称随选择更新；视频显示音量等通用控制，隐藏实时场景专用项；官方卡片不提供移除按钮。
- [ ] **4. 运行验收。** 生成网页，启动专用 profile，按真实入口验证导入 fixture、缩略图、主动应用、取消对话框、损坏 MP4、重复点击、暂停 / 恢复、音量、显示比例、时钟、快速切换、关闭设置继续播放、重启恢复、移除当前视频与缺失视频回退。查看窗口截图，确认 800×820 和最小 740×650 均无水平溢出；正常运行不开放调试端口。
- [ ] **5. 提交。** 消息 feat(desktop): add MP4 library controls and persistent wallpaper selection。

## Task 7: 官方增量交付与安装版验收

**Files:** 修改 README.md、docs/status.md、docs/verification.md、package.json、package-lock.json；创建 docs/releases/0.1.4.md；按发现的问题修改对应实现文件和检查。

- [ ] **1. 核对设计覆盖。** 将本地导入、作者命令、升级合并、选择保存、错误恢复、播放器释放逐项对应到检查结果，保存对照和证据至 work/mp4-wallpapers；存在未通过项时暂不进入安装包验收。
- [ ] **2. 验证作者资源构建。** 在专用构建副本中使用任务 4 的官方 fixture 和清单，运行 prepare:web，验证生成目录、MP4 和缩略图；新增第二官方项后复用原 profile，确认本地导入与选择保留；删除当前官方项后确认回退。正式源码官方目录继续只包含准备发布的作品。
- [ ] **3. 完成候选配置。** 本地候选版本为 0.1.4，版本说明指向 docs/releases/0.1.4.md；npm.cmd test、npm.cmd run prepare:web 全部成功。保留 updater 现有检查与正式源，不修改公开 Release。
- [ ] **4. 验证安装版。** npm.cmd run dist:installer 成功；使用专用安装目录 / profile 启动候选，确认 packaged=true、attached=true，实际 MP4 导入与重启恢复正常，资源来自安装目录和用户目录。记录版本、路径、结果与设备范围，关闭专用测试实例。
- [ ] **5. 提交与交付。** git diff --check 通过并完成全分支审查，提交源码与验收文档；给出本地候选安装包、作者使用说明及测试结果，公开发布按已有发布流程另行执行。

## 执行前评审

设计已确认，本计划待用户评审并选择执行方式。建议由当前会话直接实施：目录、资源服务、播放器和 IPC 的接口彼此依赖，连续实施便于统一验证。另可选择子代理逐任务实施与独立评审。

当前开发分支为 codex/mp4-wallpapers。工作区使用方式由用户选择；如选择当前分支原地实施，沿用现有依赖和资源；如需要隔离工作区，使用 Codex 原生 worktree 工具，以本分支为起点。
