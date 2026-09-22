# 小程序界面规范

本规范适用于状态、管家、宠物及其二级页。新增和修改界面优先复用现有组件与主题变量，避免在页面中引入新的字号、颜色或间距档位。

## 主题来源

`theme/tokens.json` 是唯一主题配置。修改后执行 `npm run theme`，生成 `styles/tokens.less`、`config/theme.js` 与图标资源，不直接修改生成文件。页面引入 tokens，公共控件样式放在 `styles/shared.less`。

## 文字层级

- 页面标题：36rpx，600；主要欢迎语：46rpx，600～700，仅用于首页欢迎区域。
- 分区标题：34rpx，600；卡片标题、宠物名称：28rpx，600。
- 正文、常规输入：28rpx，400；字段名与常规小按钮：24rpx，500～600。
- 时间、状态提示、说明：22rpx，400；单位、紧凑角标：20rpx，400。
- 指标数字：52rpx，700，使用等宽数字；不要将数字字号用于普通文案。
- 标题行高 1.3，正文 1.6，紧凑控件与元信息 1.4，分别使用 leading 变量。

文字使用 type 与 weight 变量。没有内容、加载中、正常内容沿用相同区域的文字层级，不因空态意外继承大号正文。状态卡更新时间与“尚未记录”统一使用 caption、regular、primaryText。

## 颜色职责

- text：主要正文与标题；secondary：次要内容；muted：时间与辅助说明。
- primary：主要操作、链接与选中状态；primaryText：浅紫色区域内的文字；primaryMedium：次级按钮底色。
- accent：宠物选择、步骤指示等温暖强调背景，搭配 accentText，避免黄色底上使用白色小字。
- page：页面底色；surface：白色卡片；surfaceMuted：常规输入底色；primarySoft：主题浅色容器。
- success、danger 只表达业务状态。颜色均引用 colors 变量，不新增独立十六进制色值。

## 间距与布局

- 页面左右边距：layout.gutter（36rpx），上下默认 space.md（24rpx）。
- 常用间距：4、8、12、16、20、24、32、48rpx，对应 xxs、xs、compact、sm、roomy、md、lg、xl。
- 图标与短文字间距 8～12rpx；卡片网格间距 16rpx；卡片内边距 16～24rpx；分区之间 32rpx。
- 同一层级保持相同内边距和对齐线；避免为撑高卡片加入无意义留白。
- 宠物卡片一行两列，列宽使用 minmax(0, 1fr)。奇数宠物在末格追加添加卡，偶数宠物在网格外追加整行按钮；无宠物保留引导卡。
- 所有长名称、元信息须限制宽度并截断或换行，不挤压按钮。
- 固底按钮和弹层为安全区预留空间；正文必须留出对应底部占位。

## 按钮与输入

- 主要保存/提交：control.primaryHeight 88rpx，正文 28rpx，主题色底、白字。
- 步骤下一项、紧凑次级操作：control.compactHeight 56rpx，文字 24rpx；不继承原生按钮的大尺寸默认样式。
- 常规输入：control.inputHeight 88rpx；步骤卡输入：control.compactInputHeight 64rpx，文字 28rpx。
- 图标按钮可见尺寸以 control.iconSize 56rpx 为基准；空间允许时通过外层容器扩展点击区域。
- 原生紧凑按钮使用 size="mini"，明确设置 padding、margin、line-height，避免不同页面宽高不一致。
- 不同业务保留必要差异：大号浮动发布按钮、指标数字、宠物头像不是常规按钮，不能套用同一高度。

## 修改验证

样式调整执行 LESS 与 WXML 编译；涉及请求、选择、保存等行为时运行对应 scripts/check-*.cjs。新增布局检查空态、长名称、单数/双数数量及底部安全区。参考页面中的变量使用方式，只有明确的业务需要才增加新 token，并同步更新本规范。
