# Studio 主题与接口说明

本次改造沿用第三套「鸢尾晴光」设计：状态 / 管家 / 宠物。无提交。

## 修改主题

唯一主题源为 `theme/tokens.json`。调整颜色、字号、间距、圆角后运行 `npm run theme`，生成 `styles/tokens.less`、`config/theme.js` 和 `static/theme/` 图标。页面样式引用语义变量；图表从 JS 主题读取颜色。

`styles/shared.less` 管理表单、按钮、底部面板等通用样式。`components/page-header` 处理微信胶囊与状态栏避让，`components/post-feed` 统一帖子卡片，`custom-tab-bar` 管理三项导航。

## 已接入后端

接口地址在 `config.js`，当前使用已验证、已登记合法域名的 `https://chongxi.cloud`。本地开发可更换为开发服务地址；真机不能通过 127.0.0.1 访问电脑服务。

- 微信登录：`POST /api/miniprogram/auth/wechat-login`。独立存储真实令牌，不使用原模板 mock token。
- 家长资料：经微信登录接口更新昵称、头像；头像先上传。
- 猫咪档案：`GET/POST /api/miniprogram/cat-profiles`，编辑使用 `PATCH /cat-profiles/:id`。当前后端仅支持猫咪，页面编辑默认猫咪档案。
- 社区：`GET /api/miniprogram/moments`；我的帖子使用 `include_private=true`。服务端目前只返回 active 帖子，因此不展示虚构的审核队列。
- 发布：`POST /moment-images` 上传真实图片，再 `POST /moments`，遵循后端内容安全审核结果；失败保留编辑内容，支持保存草稿。
- 管家：保留 `/food-change/intent`、`/products`、`/products/ingredients` 和 `/api/cat-food-compare/compare`，增加消息列表、加载、停止、重试和本地历史。当前能力是换粮咨询，不冒充通用兽医问诊接口。

## 暂无后端接口

收藏、玩具、食物清单、日常饮水/进食/排便、草稿、对话历史保存在本机，并按账号隔离；不调用点赞接口替代收藏。清除小程序数据会丢失这些本地数据。硬件入口仅展示待接入，不生成虚假连接和测量数据。

当前社区接口上限 100 条且无分页/服务端搜索参数，搜索筛选作用于已加载内容。收藏保存帖子快照供本机回看。

## 验证边界

使用微信开发者工具检查实际页面，原生 WXML 编译器验证模板，LESS 编译器验证主题样式，离线接口契约测试验证请求与数据处理。只读取线上帖子/分类，没有通过测试发布帖子或修改用户资料。微信登录、真实图片审核与资料写入需在实际账号下完成联调。

## 二级页与表单调整

- `pages/pet-space/library?mode=favorites|posts`：收藏与帖子共用二级页面，已发布和草稿分开查看。
- `pages/pet-space/supplies?kind=toys|food`：左右滑动头图、卡片目录、本地清单。玩具使用 `/ideas` 的周边创意，食品通过 `/products?brand=...&q=...` 查询。头图为展示内容，不表示营养推荐。
- `pages/pet-space/pet-edit`：独立档案页。类型/品种、年龄/体重分别双列排列，品种同步到后端 `breed`。
- AI 拍照识别明确标记 Mock，不调用识别接口，不上传照片；延迟模拟后填写固定示例信息，用户修改、点击保存后才写入真实档案。年龄和体重不由照片推断。
- 社区按图片实际比例分配到较短列；共享瀑布流也用于收藏和帖子列表。
- `node scripts/check-pet-space.cjs` 验证模拟识别、人工修改、数值范围和档案保存字段；测试不会修改真实后端数据。

## 图片与管家欢迎区

内容图片统一使用 `components/p-image`，默认 `lazyLoad: true`。`src` 切换会重置加载状态，加载中显示主题底色及扫光；成功后淡入，失败显示静态占位。支持 `mode`、`image-class`、`alt`，转发 `load`（包含原图宽高）与 `error`；瀑布流继续使用原图比例。组件按页面注册，避免微信工具全局组件依赖循环。SVG UI 图标不延迟加载。

管家欢迎区将工具栏、图标、主标题与二级标题合并为浅紫卡片。底部导航的 `ai-search` 图标从统一主题脚本生成，线宽保持一致。发送按钮视觉缩为 56rpx，扩展周围点击区域。

## 字体与状态层级

字号和字重由 `theme/tokens.json` 的 `type`、`weight` 统一控制：页面/内容标题 34–36rpx 半粗，卡片标题与正文 28rpx，状态标签 24rpx 半粗，辅助文字 20–22rpx，关键数据 52rpx 加粗。正文使用常规字重，菜单使用中等字重，避免全部加粗。

状态指标采用三列等宽网格，`metricSurface` 控制指标底色；`primaryMedium` 控制“记一笔”的二级按钮底色。AI 回复使用黄色圆形猫咪头像，玩具采用球形线性图标。

帖子详情在标题与完整正文去除首尾空白、合并连续空白后完全相同时，仅显示标题；保留原始正文数据及不同内容。

## 宠物管家聊天接口（2026-09-21）

管家文字聊天使用 `/chat/conversations` 和 `/chat/conversations/:id/messages`，沿用配置中的 HTTPS 域名与微信登录 token。使用前必须绑定服务端宠物档案；取消绑定弹窗不发消息也不清空草稿，进入档案页并返回时保留输入。新会话按服务端存储，历史抽屉兼容此前本机保存的换粮记录。

`utils/assistant-chat.js` 负责聊天与档案检查，保留单选/多选选项值的字符串、数字、布尔类型，显示高危提醒和信息有限提示。主输入框可补充粮名或配料文本。相机照片尚不能直接作为聊天附件：此次接口文档只约定了 `food_submission` 引用，没有给出生成投稿 ID 的上传接口，因此照片保留在输入区并提示暂不可发送，不伪造识别结果。

验证：`node scripts/check-assistant-chat.cjs` 检查绑定拦截、草稿保留、会话创建、选项回传及图片边界；线上仅进行了未认证只读接口探测（返回预期 401），未创建真实会话或宠物数据。服务端完整回答需使用已绑定账号联调。
