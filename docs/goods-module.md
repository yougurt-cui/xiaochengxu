# 商品模块接入

设计：Figma `pPCjkbwO4knAZCp3FnwRA5`，列表 `165:68`、详情 `165:172`、商家弹层 `165:220`。首页顶部搜索固定在系统状态栏下方，使用微信胶囊真实尺寸预留空间。Tab 为 44px 点击区域，20×3px 指示器。

## 当前后端契约

依据相邻服务端仓库 `docs/merchant-publish-api.md`、`api/merchant_publish_api.py` 和 `services/merchant_product_service.py`。

- 列表暂取 `/api/miniprogram/moments?limit=100&sort=latest|popular` 返回的 `items[].products`，按 `product_id` 去重，保持接口顺序。界面明确提示“展示近期社区分享中的商品”。仅搜索这批商品名称、商家类型，不冒充全量搜索或分页。
- 详情调用 `/api/miniprogram/merchant/products/{product_id}`，读取 `data`，动态展示名称、价格、介绍、图片、merchant_type、jump_type 和 shop_link。
- `/merchant/products/mine` 不是公开商城列表，不能用于逛逛好物。
- 404 按不可见/下架处理，不显示旧商品及操作栏。加载错误可重试，请求版本防止旧响应覆盖新筛选。
- 原价、助力折扣、来源分类、商品分类、店名、营业时间、微信号与电话尚未在公开契约中提供，不生成假数据。全部实际商品显示“商家好物”。
- 商家弹层目前提供复制店铺地址。现有 `wechat_id` 是身份绑定 OpenID，不能当作微信号展示；不从后台认证接口读取联系方式。`mini_program` 只有自由文本链接，不能假定存在 appId 或直接调用跳转。
- 收藏按现有账号隔离的本机存储保存；不声称云同步。
- 问问管家把商品上下文加入当前账号的输入草稿，保留原输入，不自动发送，不把商家商品 ID 当成营养配方 ID。

## 待确认的服务端补齐范围

公开商品分页、全量搜索/分类/来源筛选和可公开的商家联系信息需要后端新增契约。当前前端可按已提供接口运行，尚未修改服务端。若补齐，应替换 `listCommunityGoods`，增加相应筛选和分页，并用明确的公开联系字段替换店铺地址弹层。

## 验证

`node scripts/check-goods.cjs` 覆盖字段映射、0元及小数价格、SKU编码、关联去重、账号隔离、管家草稿、搜索、请求竞态、失败恢复和404。

`node scripts/check-contracts.cjs`、`node scripts/check-home-overview.cjs`、`node scripts/check-diet-hot-feed.cjs`、`node scripts/check-assistant-chat.cjs` 为相关回归检查。修改的 WXML 使用微信官方 wcc 编译，LESS 使用 less 编译。

原生模拟器验证使用临时内存商品数据，不上传真实帖子或商品，结束后重新进入首页恢复真实接口数据。
