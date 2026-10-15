# 添加官方 MP4 壁纸

用户在软件的“壁纸库”里导入的视频保存在个人电脑。官方壁纸由我们作为维护方添加到本项目，随下一版软件安装包和更新一起交付。

准备 MP4 后，在项目目录执行：

```powershell
npm.cmd run wallpaper:author -- --file "D:\壁纸\夜景.mp4" --id night --name "夜景" --author "GenshinWallpaper"
```

命令实际检查视频能否解码，生成静态封面，将副本保存到 content/official-videos/official-video-night，并登记 catalog.json。原文件保留。ID 使用 1–80 个小写英文字母、数字或连字符；已有 ID 不覆盖。导入失败时清理本次副本，保留此前清单。

之后运行 npm.cmd run prepare:web 检查并构建目录，运行 npm.cmd run dist:installer 生成下一版安装器。随正常软件更新交付后，新作品自动出现在用户的“官方壁纸”区，用户此前导入的视频和当前选择继续保留。文件缺失、ID 重复或清单错误会阻止构建。

作者录入命令只修改本地项目资源。发布安装包继续沿用项目现有 GitHub Release 流程。使用 --catalog-root work/某目录 可以验收作者流程，该目录不会加入正式资源。
