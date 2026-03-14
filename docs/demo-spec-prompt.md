# Spec-Driven Development 演示：实时调查响应通知系统

## 工作流

**Design-First**（在 Kiro 中创建 Feature Spec 时选择此工作流）

## 设计层级

**High Level Design** — 本功能涉及多个组件交互（服务端推送、客户端订阅、pipeline 集成），适合使用高层架构文档。

## 提示词

在 Kiro 中创建 Feature Spec → Design-First → High Level Design 时，粘贴以下内容：

---

```
为 Formbricks 构建一个实时通知系统，当调查问卷收到新的响应时，自动推送通知到仪表盘，
用户无需刷新页面即可看到新响应。

技术约束与上下文：
- 框架：Next.js 16 App Router（不使用 pages router）
- 使用 Server-Sent Events (SSE)，通过 Next.js Route Handler 实现。
  不引入 WebSocket 服务器，不使用第三方实时服务（如 Pusher、Ably）
- 现有的响应接收 pipeline 位于 apps/web/app/api/(internal)/pipeline/route.ts，
  所有新响应都经过此端点处理
- 所有数据按 environmentId 隔离（多租户架构），通知必须只推送给订阅了同一环境的用户
- MVP 阶段使用内存级 pub/sub（EventEmitter 或类似方案），
  但需设计可替换的接口，以便后续切换到 Redis pub/sub
- SSE 端点路径：/api/v1/client/[environmentId]/responses/stream
- 客户端：提供 React Hook useResponseStream(environmentId)，
  返回最新的响应事件和连接状态
- 必须处理：客户端断线重连（使用 Last-Event-ID）、组件卸载时优雅关闭连接、
  每 30 秒发送心跳保持连接存活
- 当新响应到达时，在仪表盘中显示 toast 通知（使用 modules/ui 中现有的 Toaster 组件），
  展示调查名称和截断的响应预览
- 性能要求：每个环境至少支持 50 个并发 SSE 连接，不影响 API 响应时间
- 不涉及数据库 schema 变更 — 这是纯推送通知，不做持久化
- 安全性：SSE 端点必须验证用户会话（next-auth），
  并确认用户对该环境所属项目至少拥有 "read" 权限
```

---

## 为什么这个提示词适合 Design-First

1. **以技术约束开头** — SSE、App Router、内存 pub/sub、无 DB 变更。给 Kiro 明确的架构边界来做设计。
2. **指定了集成点** — 引用了现有的 pipeline 路由和 UI 组件，设计阶段可以准确映射组件交互。
3. **包含非功能性需求** — 50 并发连接、心跳间隔、重连策略。这些会驱动架构决策，先于需求推导。
4. **用户行为留白** — 没有预设具体的 UX 用户故事，让 Design-First 工作流从已验证的架构中推导出可行的需求。
5. **定义了可替换的抽象** — 内存方案到 Redis 的演进路径，促使设计阶段产出清晰的接口边界。

## 预期的 Spec 产出

完成 Design-First 工作流后，Kiro 应生成：

- **design.md** — SSE 架构、pub/sub 接口定义、时序图（pipeline → pub/sub → SSE 端点 → 客户端 Hook → toast）、连接生命周期、安全模型
- **requirements.md** — 从架构推导出的用户故事和验收标准（例如："作为仪表盘用户，当新响应到达时我能看到 toast 通知，无需刷新页面"）
- **tasks.md** — 实现任务，例如：
  1. 创建内存级 pub/sub 模块
  2. 构建带认证和心跳的 SSE Route Handler
  3. 在 pipeline 中集成事件发布逻辑
  4. 实现 `useResponseStream` React Hook
  5. 在仪表盘布局中添加 toast 通知
  6. 为 pub/sub 和 SSE handler 编写单元测试
