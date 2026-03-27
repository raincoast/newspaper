# Progress

## Stage 1: Project Skeleton + Prisma (MVP 基础可运行)
- [x] Next.js App Router + TypeScript + Tailwind 基础结构
- [x] 登录页 / 地图页 / 管理页路由壳
- [x] Prisma 配置 + 核心数据模型
- [x] `npm run dev` / `npm run build` 在本地可正常启动（需用户设置 `.env`）

## Stage 2: 用户登录与权限系统
- [x] NextAuth Credentials（邮箱密码登录）
- [x] Prisma User 持久化（email + passwordHash + role）
- [x] 会话读取与服务端权限守卫
- [x] middleware 路由保护（未登录/越权拦截）
- [x] demo admin / courier seed

## Stage 3: 区域切换与区域管理
- [x] `Region` CRUD（admin：新增/编辑/删除）
- [x] `UserRegionAssignment`（seed：courier 仅分配可访问区域）
- [x] 手机端区域切换 dropdown（地图页左上）

## Stage 4: 街道规则与门牌数据模型
- [x] Prisma schema：StreetRule / HouseMarker 字段落地
- [x] StreetRule CRUD API（admin：增/改/删；auth：查询）
- [x] 可复用规则引擎函数（odd/even/from/to/include/exclude）
- [x] apply 入口：把规则结果写回 `is_selected_by_rule`

## Stage 5: 地图页面与门牌图层
- [x] 接入 MapLibre GL JS + OSM 瓦片底图
- [x] HouseMarker 独立业务图层（不依赖底图标签）
- [x] 地图自动切到当前区域门牌范围
- [x] 点击门牌弹出底部操作菜单（每行一个按钮）
- [x] 门牌状态颜色（pending/delivered/blocked）

## Stage 6: 门牌状态切换与号码修改
- [x] 底部菜单动作：未投递/已投递/不让投递/移除计划/修改号码
- [x] 修改号码输入框（街道名 + 旧号码 -> 新号码）
- [x] 保存后更新 `current_housenumber`，保留 `osm_default_housenumber`
- [x] 数据更新后地图图层立即刷新

## Stage 7: 门牌号冲突检测与可视化
- [x] 冲突检测逻辑（同区域+同街道+同 current_housenumber）
- [x] 冲突门牌样式（白底红字+放大，优先级最高）
- [x] 冲突标签显示 OSM 原始号码（例：`2 (OSM:1)`）
- [x] 点击冲突门牌时红色虚线连接冲突对象

## Stage 8: 公寓 / 多门牌建筑聚合显示
- [x] 识别同 `apartment_group_id` / `building_id` 的 2+ 门牌
- [x] 蓝色虚线框辅助层（不替代门牌点）
- [x] 白底蓝字数量标签（显示该公寓门牌总数）
- [x] 单门牌保持独立点击，冲突样式仍优先显示

## Stage 9: 实时定位与附近门牌强化显示
- [x] 浏览器 `watchPosition` 实时定位
- [x] 显示当前位置：蓝色圆点 + 白色边框
- [x] 可选精度圈（accuracy circle）
- [x] “回到我的位置”按钮
- [x] 依据距离高亮当前位置附近门牌（更大更醒目），与冲突样式兼容

## Stage 10: 统计卡片与后台管理收尾
- [x] 区域统计：已投递 / 总标记 / 剩余待投递 / 不让投递
- [x] 投递开始/停止按钮（移动端底部，play/pause 图标）
- [x] 今日维度投递逻辑（`last_delivered_at` 驱动今日已投递）
- [x] 下一个最近待投递门牌推荐（基于定位距离）
- [x] 左下角今日信息卡片（已投递、应投递）
- [x] admin 用户管理：列表、创建、角色修改、区域分配、禁用

