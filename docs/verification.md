# 本地必要验证 · 2026-10-07

仅验证此次桌面软件阶段。未重跑 V3 角色视觉矩阵、原生导出或长期性能。

## 已完成

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
