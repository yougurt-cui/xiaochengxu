# 万圣节活动前端

首页浮动入口 → `pages/halloween/index`；`view=rules|guide` 展示规则与使用方法。领取后活动主页直接展示并复制兑换码，不设置领取记录页。

## 正式接口

依据后端 `docs/activity-code-claim.md`，当前 `utils/halloween-activity.js` 中 `ACTIVITY_ID=1001`。文档当前将 1001 标为测试活动；更换正式活动时需同步此常量。UI 中 50 名是投放海报的总名额文案，不代表实时剩余库存。

- 发帖沿用 `POST /moments`，不传 activity_id，避免发布成功自动消耗库存。
- 发帖响应 `item.id`（服务端 32 位帖子 ID）通过 `saveActivityPost` 保存到 `activity-post:1001:<账号>`，字段为 post_id、status、saved_at。审核中帖子也保存 ID，但不显示可领取。保存不依赖一次性弹窗是否已经展示。
- 进入活动页调用 `GET /activity/1001/my-code`。SUCCESS / ALREADY_CLAIMED 恢复原码，即使设备没有本地帖子 ID；NOT_CLAIMED 根据当前设备暂存的发帖凭据显示任务进度。
- 点击领取调用 `POST /activity/claim`，传 activity_id 和暂存的 post_id；成功与已领取均直接展示服务端原码。不再生成、缓存或展示 DEMO 码，旧模拟数据不会迁移。
- BUSY 可重试；OUT_OF_STOCK 展示领完；403 清理当前失效的帖子凭据并允许重新发帖；401 提示登录；其他错误展示后端信息或网络重试提示。重复点击在前端锁定，最终幂等由后端保证。

后端没有独立的资格或用户可读库存查询接口，不能靠本地凭据保证已达标；UI 标记“已发帖”，领取时由服务端检查所属用户、帖子状态、话题、活动起止时间与库存。后端当前限制每活动每用户一码。换设备未领过码且无本地凭据时需发帖，已领用户可正常恢复。API 复用既有认证请求层，不调用运营接口。

## 一次性任务提示

发帖成功且返回 published 后，在 `activity-task-prompt:halloween-2026:<账号>` 保存待提示状态。首页 onShow 显示“已完成发帖任务”，左“取消”、右“领取奖励”；确认进入活动页，不自动领取。取消、确认、再次发帖、重启均不重复。草稿、待审核、失败不触发；原生弹窗失败才恢复待提示。清除本地存储会重置。

## 验证

`npm run test:halloween` 验证服务返回、发帖凭据隔离、恢复兑换码、请求参数、BUSY/OUT_OF_STOCK/403、重复点击、复制、过期响应和一次性提示。`npm run test:contracts` 验证共用认证请求层。测试使用替身接口，不发布真实帖子或消耗活动码。

Figma 文件 dXX4qmudMEu1hgqaFkCsox。活动主题使用 theme/tokens.json 的 halloween 分组。WXML 与 LESS 需编译检查；微信开发者工具服务端口关闭时无法自动运行模拟器。
