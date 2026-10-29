# 万圣节活动前端

入口：`pages/home/index` 浮动按钮 → `pages/halloween/index`。同一活动页通过 `view=rules|guide` 展示规则和使用方法。领取后在活动主页直接展示兑换码，不设置领取记录入口或页面；旧的 `view=records` 链接回落到主页。沿用自定义 page-header、安全区与原生剪贴板。

Figma：首页任务未完成 `16:97`、已达标 `12:92`、已领取 `12:127`、浮动入口 `18:94`（文件 dXX4qmudMEu1hgqaFkCsox）。摄影资源仅导出独立图片层，文字与按钮由原生 WXML 绘制。

## 验收

开发版或体验版有“体验演示”标识，点击“切换状态”选择未完成、已达标、已领取、名额领完或查询异常。示例码 `DEMO-XXXX-XXXX` 无法兑换；演示记录按活动、账号保存在当前设备。重置未完成会清除此账号演示记录。

刷新只查询，不会使任务自动达标。从活动页进入真实发帖页，成功发布且状态为 published 才通过 eventChannel 更新演示资格；取消、失败、保存草稿、待审核均不达标。开发验收可直接切换状态，无需发布真实帖子。

正式版环境禁用本地领取、状态切换和模拟记录，显示“即将开放”。当前不发放真实权益、不请求尚未定义的接口。

## 后端接入边界

替换 `utils/halloween-activity.js` 的 `getActivityStatus`、`claimActivityCode` 为正式接口；页面消费统一模型：`status`（incomplete / eligible / claimed / soldOut / unavailable）、`record`（code、claimedAt、preview）、`preview`。查询失败抛出错误。领取接口必须原子校验资格与库存、按用户和活动幂等；已领取记录优先于库存状态。同一用户不同设备的记录必须由服务端返回。

接入后移除本地发帖达标推断及演示开关，返回页面时查询服务端。每码额度、活动时间、发帖要求、审核规则、有效期和正式开放配置仍待运营与后端确认。页面不会推断网站端是否已兑换。

主题颜色新增在 `theme/tokens.json` 的 halloween 分组；运行 `npm run theme` 生成 LESS 和 JS。浮动入口固定在发布按钮上方，打开首页记录弹层时隐藏。

运行 `node scripts/check-halloween.cjs` 验证任务门槛、账号隔离、重复领取、保存失败、库存优先级与页面交互；WXML/LESS 另需编译。微信开发者工具的服务端口未开启时无法自动运行模拟器验收。
