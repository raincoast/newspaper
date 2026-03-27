# Newspaper 投递辅助系统（MVP 骨架）

手机端优先的投递辅助地图工具：管理多个投递区域、按街道规则生成要投递的门牌号、在地图上高亮门牌、实时定位、点击门牌修改投递状态，并支持手动修正 OSM 默认门牌号。

## 技术栈（当前阶段）
- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Auth.js / NextAuth（Credentials: 邮箱密码）
- 地图：MapLibre GL JS（下一阶段接入）
- OSM 底图（下一阶段接入）

## 开发环境准备

1. 安装依赖
```bash
npm install
```

2. 配置数据库
```bash
cp .env.example .env
```
然后配置：
- `DATABASE_URL`：PostgreSQL 连接串
- `NEXTAUTH_URL`：本地开发用 `http://localhost:3000`
- `NEXTAUTH_SECRET`：随机长字符串（Vercel 生产也要配置）

3. 执行数据库迁移
```bash
npx prisma migrate dev --name auth_init
```

4. Prisma 生成客户端
```bash
npx prisma generate
```

5. 写入 demo 用户
```bash
npm run prisma:seed
```

## 启动
```bash
npm run dev
```

首次访问：
- `/login`
- `/map`
- `/admin`

## Demo 账号
- Admin: `demo.admin@example.com` / `Admin1234!`
- Courier: `demo.courier@example.com` / `Courier1234!`

## 目录概览
- `app/(auth)/login`：邮箱密码登录页（手机端）
- `app/api/auth/[...nextauth]`：认证 API 路由
- `middleware.ts`：路由权限拦截
- `lib/auth/options.ts`：NextAuth 配置与登录校验
- `lib/auth/guards.ts`：服务端会话/角色守卫
- `prisma/schema.prisma`：包含 `User.role` 与 `passwordHash`
- `prisma/seed.mjs`：demo admin/courier 种子

## StreetRule / HouseMarker（Stage 4）
- `prisma/schema.prisma`：新增 `StreetRuleType` 与 StreetRule / HouseMarker 字段
- `lib/rules-engine/streetRuleEngine.ts`：可复用规则引擎（odd/even/from/to/include/exclude）
- `app/api/street-rules/*`：规则 CRUD + apply（写回 `is_selected_by_rule`）

## 地图与门牌图层（Stage 5）
- `components/map/MapView.tsx`：MapLibre 地图主组件（手机端全屏优先）
- `components/map/HouseMarkerLayer.ts`：HouseMarker 独立图层（circle + number label）
- `components/map/RegionSwitcher.tsx`：左上区域切换（轻量不遮挡）
- `components/map/MarkerActionSheet.tsx`：底部菜单（按钮每行一个）
- `components/map/StatsCard.tsx`：当前区域统计浮层
- `app/api/house-markers/*`：门牌查询与状态更新 API

门牌状态颜色：
- `pending`：黑底白字
- `delivered`：绿底白字
- `blocked`：红底白字

## 冲突检测与可视化（Stage 7）
- 冲突规则：同区域、同街道、`current_housenumber` 相同即冲突
- 冲突门牌显示：白底红字、尺寸更大（优先级高于普通状态）
- 冲突标签格式：`2 (OSM:1)`（保留并展示原始 OSM 号码）
- 点击冲突门牌：地图绘制红色虚线连接冲突门牌

## 公寓聚合显示（Stage 8）
- 聚合键：优先 `apartment_group_id`，否则 `building_id`
- 仅对 2 个及以上门牌绘制聚合框（辅助层）
- 蓝色虚线框 + 白底蓝字数量标签（显示该聚合门牌数量）
- 门牌点图层保持可点击，冲突门牌仍按最高优先级渲染

## 实时定位与附近强化（Stage 9）
- 浏览器实时定位（`navigator.geolocation.watchPosition`）
- 地图展示：蓝色圆点 + 白色边框（可显示精度圈）
- 提供“回到我的位置”按钮
- 根据当前位置距离高亮附近门牌（更大更醒目，不影响冲突样式/点击）

## 统计与管理收尾（Stage 10）
- 区域实时统计：已投递、总标记、剩余待投递、不让投递
- 投递开始/停止按钮（底部，Material Symbols 图标）
- 今日投递逻辑：`last_delivered_at` 在今天才视为“已投递”；禁止投递为持久状态
- 自动推荐“下一个最近待投递门牌”
- admin 管理页：用户列表、创建用户、修改角色、区域分配、禁用用户

### StreetRule 对字母门牌支持
- `31a`、`31A` 会按 `31` 参与 odd/even/from/to 规则计算（保留字母作为户信息）

## 部署到 Vercel
1. 推送代码到 GitHub（或 GitLab/Bitbucket）
2. 在 [Vercel](https://vercel.com/) 导入仓库
3. 在 Vercel 项目环境变量中配置：
   - `DATABASE_URL`
   - `NEXTAUTH_URL`（生产域名，如 `https://your-app.vercel.app`）
   - `NEXTAUTH_SECRET`
4. 在数据库执行 Prisma 迁移（建议在本地或 CI）：
   - `npx prisma migrate deploy`
5. （可选）初始化演示数据：
   - `npm run prisma:seed`
6. 重新部署并验证：
   - 登录
   - 区域切换
   - 地图门牌状态更新
   - admin 管理功能

## 区域切换（Stage 3）
- 地图页：`/map` 顶部左侧有区域 `dropdown`（通过 `?regionId=` 切换）
- 权限规则：
  - `admin`：可见所有区域
  - `courier`：仅可见 seed 分配的区域（`UserRegionAssignment`）

## Demo 区域
- seed 会创建 `投递区 A`、`投递区 B`
- `courier`：先分配到 `投递区 A`（MVP 演示“只能切换已分配区域”）

