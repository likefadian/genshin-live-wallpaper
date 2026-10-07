# GitHub Updates Implementation Plan

> 在当前会话按 executing-plans 直接完成已授权的本地接入，不重复询问已有范围；公开发布保留到产物就绪。必要核心测试按test-driven-development推进。

**Goal:** 配置用户的GitHub仓库并完成可安装的更新器，以及真实本地下载/安装升级验证。

**Architecture:** electron-updater读取内置GitHub配置；独立控制器管理手动更新状态，主进程校验IPC并确认安装；设置页只展示纯文本状态。专用验收实例使用受限loopback源。

**Tech Stack:** Electron44.6.0、NSIS/electron-builder26.15.3、electron-updater6.8.9。

**Spec:** ../specs/2026-10-07-github-updates-design.md

## Global Constraints

- 正式源为likefadian/genshin-live-wallpaper公开稳定Release；不将凭据写入软件。
- 稳定appId与userData，保留V3优化和原角色；autoDownload/autoInstallOnAppQuit/allowDowngrade/allowPrerelease均false。
- 手动检查/下载/原生确认安装；普通退出不安装；构建--publish never，实际上传和发布待后续授权。
- 本地测试旧版0.1.3-verify.0 → 交付0.1.3；不将测试包当正式版本发出。

## Review Focus

- 未发布Release与网络错误不能显示“最新版”。
- 下载或校验失败必须清除安装资格，保留壁纸与设置。
- 重复点击/异步事件不得并发检查下载或让旧状态覆盖正在安装。
- 发行说明不得按HTML执行；普通退出不得触发安装。
- 验收源覆盖必须显式、限loopback、专用profile；正常配置始终为真实仓库。

## Task 1: 更新控制器与来源

**Files:** electron/update-controller.cjs、electron/update-source.cjs、tests/update.test.cjs、package*.json。

**Interfaces:** `resolveUpdateSource({argv,env}) -> {kind,name,url,feed?}`；`createUpdateController({updater,currentVersion,packaged,source,onChange,log}) -> {snapshot(),check(),download(),install(),dispose()}`。

- [x] 先写核心行为断言：手动生命周期/安装资格、未发布与网络失败、失败后重试与并发限制、专用本地源限制；空模块运行确认失败，再实现。
- [x] 固定依赖6.8.9，配置真实GitHub发布源与0.1.3；运行npm.cmd test，所有检查通过后保存提交。

## Task 2: 主进程和设置页

**Files:** electron/main.cjs、preload.cjs、settings/index.html、settings/settings.js、settings/style.css。

**Interfaces:** settings-only `update:check`、`update:download`、`update:install`；snapshot保留updateStatus并新增update对象。安装只在downloaded时允许，原生确认后调用控制器install。

- [x] 接入默认生产autoUpdater，专用验收用NsisUpdater；日志及状态发送仅更新设置窗口。
- [x] 补全更新卡片、版本说明/进度/操作；纯文本展示；现有设置保存链继续工作。
- [x] 构建自包含网页与NSIS；核对生成更新配置/元数据无凭据，设置页不增加canvas；保存提交。

## Task 3: 真实本地升级与交付

**Files:** scripts/verify-local-update.mjs、docs/status.md、docs/verification.md、README.md、release/github-updates-v001/、work/github-updates-v001/。

- [x] 打包专用旧候选0.1.3-verify.0；提供loopback元数据、Range支持和实际正式安装器；检查损坏SHA-512拒绝下载完成，再重试正确版本。
- [x] 用户同意的本地验收中通过安装版更新接口下载安装并确认NSIS退出/重启到0.1.3，非默认设置文件完整保留并由安装内新版读取器核对；独立测试实例退出，NSIS自动启动正常profile并留下0.1.3运行效果。
- [x] 只读真实GitHub源，明确报告尚无发布版本；正常启动无调试口/验收源；核对动画和tiles。
- [x] 一次独立代码审查，修复影响更新正确性的发现；必要检查通过。生成源码ZIP、本地Release附件清单/哈希和中文发布说明，更新记录并保存本地提交。

## Progress

2026-10-07：已完整重读原交接，确认当前0.1.2、已接受网页优化、仓库只读可用。用户明确授权本地接入；线上发布仍未授权。本轮不需要先登录GitHub，发布产物完成后再集中处理。

更新控制器、IPC及界面已实现，核心8/8通过，正式0.1.3和旧候选0.1.3-verify.0已本地构建。独立审查发现验收缓存与正式缓存共用；现已按专用profile生成独立缓存名，并在验收分支通过6.8.9的test-only updateConfigPath加载专用配置，补充断言先失败后通过。审查复核确认隔离生效，无新增发现。

自动批准机制拒绝了含专用环境覆盖的验收实例启动（包括取消调试端口后的方式），只返回“blocked by policy”，无具体理由。已准备不开放调试端口的专用启动文件，待用户手动启动后继续实际Windows界面与NSIS升级验证；不绕过该启动限制。

用户已手动启动，并协助前置被全屏游戏遮住的软件。实际检查、损坏下载拒绝、正确完整下载、校验、原生确认及NSIS重启到0.1.3均完成；专用profile非默认设置文件保留，新版设置读取器逐项匹配。NSIS自动启动正常profile并读取原用户设置，真实GitHub检查返回no-release。最终只保留一个0.1.3正常主进程，无验收源/调试参数，本地下载服务关闭。源码包含579个文件，Release附件和源码继续保留本地；独立包与GitHub远端升级仍属后续阶段。
