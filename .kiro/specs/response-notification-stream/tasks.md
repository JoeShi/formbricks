# 实现计划：实时响应通知流 (Response Notification Stream)

## 概述

基于设计文档，按增量方式实现 SSE 实时响应通知系统。从核心事件总线开始，逐步构建 SSE 端点、客户端 Hook、通知组件，最后集成到 Pipeline 和仪表盘布局中。

## 任务

- [x] 1. 创建类型定义和事件总线核心模块
  - [x] 1.1 创建 `modules/response-notification/lib/types.ts`，定义 `TResponseEvent`、`TResponseEventCallback`、`IResponseEventBus` 接口
    - 包含 `id`（UUIDv7）、`environmentId`、`surveyId`、`surveyName`、`event`、`response`、`timestamp` 字段
    - 从 `@formbricks/types/responses` 导入 `TResponse` 类型
    - _需求: 1.1, 1.2, 1.4_

  - [x] 1.2 创建 `modules/response-notification/lib/response-event-bus.ts`，实现 `EventEmitterBus`
    - 使用 Node.js `EventEmitter` 实现 `IResponseEventBus` 接口
    - `publish()` 按 `response:${environmentId}` 通道分发事件
    - `subscribe()` 返回取消订阅函数
    - `getSubscriberCount()` 返回指定环境的订阅者数量
    - `setMaxListeners(0)` 移除监听器上限警告
    - 导出单例 `responseEventBus`
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 1.3 创建 `modules/response-notification/lib/response-event-bus.test.ts`，编写事件总线单元测试
    - 测试 publish 到无订阅者的环境不抛异常
    - 测试 subscribe 后 publish 触发回调
    - 测试 unsubscribe 后不再收到事件
    - 测试多环境隔离
    - 测试 getSubscriberCount 正确反映订阅数
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 1.4 编写属性测试：环境隔离性
    - **Property 1: 环境隔离性**
    - 使用 fast-check 生成随机 environmentId 对，验证事件不跨环境泄漏
    - **验证: 需求 1.1, 1.2**

  - [ ]* 1.5 编写属性测试：订阅生命周期一致性
    - **Property 2: 订阅生命周期一致性**
    - 使用 fast-check 生成随机 subscribe/unsubscribe 序列，验证计数和回调行为
    - **验证: 需求 1.5, 1.6**

  - [ ]* 1.6 编写属性测试：取消订阅幂等性
    - **Property 3: 取消订阅幂等性**
    - 使用 fast-check 多次调用 unsubscribe，验证无异常且不影响其他订阅
    - **验证: 需求 1.7**

- [x] 2. 检查点 — 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 3. 实现 SSE Route Handler
  - [x] 3.1 创建 `apps/web/app/api/v1/client/[environmentId]/responses/stream/route.ts`
    - 使用 `getServerSession(authOptions)` 验证会话，无效返回 HTTP 401
    - 使用 `hasUserEnvironmentAccess` 检查环境权限，无权限返回 HTTP 403
    - 认证通过后创建 `ReadableStream`，返回 `text/event-stream` 响应
    - 设置 `Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no` 响应头
    - 连接建立时发送 `connected` 事件（含 `environmentId` 和 `timestamp`）
    - 订阅 `responseEventBus`，收到事件时发送 `response` 事件（含 UUIDv7 事件 ID）
    - 每 30 秒发送 `heartbeat` 事件保持连接存活
    - 监听 `request.signal` 的 `abort` 事件，清理订阅和心跳定时器
    - 设置 `export const dynamic = "force-dynamic"`
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. 实现响应预览格式化函数和客户端 Hook
  - [x] 4.1 在 `modules/response-notification/lib/types.ts` 中添加 `TStreamEvent`、`TConnectionStatus` 类型定义，并创建 `formatResponsePreview` 函数
    - `TStreamEvent` 包含 `id`、`surveyId`、`surveyName`、`event`、`responseId`、`responseData`、`finished`、`createdAt`
    - `formatResponsePreview` 处理空数据返回空字符串
    - 非空数据返回第一个字段值的字符串表示
    - 数组值使用 `", "` 连接
    - 截断至 80 字符，超出部分添加 `"..."`
    - _需求: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.2 编写 `formatResponsePreview` 单元测试
    - 测试空数据返回空字符串
    - 测试字符串值正确返回
    - 测试数组值正确 join
    - 测试截断逻辑（80 字符 + "..."）
    - _需求: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.3 编写属性测试：响应预览截断
    - **Property 5: 响应预览截断**
    - 使用 fast-check 生成随机字符串，验证返回值长度 ≤ 83
    - **验证: 需求 6.1, 6.4**

  - [ ]* 4.4 编写属性测试：响应预览格式化正确性
    - **Property 6: 响应预览格式化正确性**
    - 使用 fast-check 生成随机响应数据，验证非空数据返回第一个字段值，数组使用 `", "` 连接
    - **验证: 需求 6.2, 6.3**

  - [x] 4.5 创建 `modules/response-notification/hooks/useResponseStream.ts`
    - 管理 `EventSource` 连接生命周期
    - 初始状态为 `"connecting"`，收到 `connected` 事件后变为 `"connected"`
    - 断线后使用指数退避重连：`min(1000 * 2^retryCount, 30000)`
    - 重连成功后重置重试计数为 0
    - 组件卸载时关闭 EventSource 并清除重连定时器
    - 收到 `response` 事件时更新 `lastEvent` 状态
    - 暴露 `reconnect` 函数允许手动重连
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 4.6 编写属性测试：重连退避上界
    - **Property 4: 重连退避上界**
    - 使用 fast-check 生成随机 retryCount，验证延迟不超过 30000ms 且符合公式
    - **验证: 需求 4.3**

- [x] 5. 检查点 — 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 6. 实现通知组件并集成到仪表盘
  - [x] 6.1 创建 `modules/response-notification/components/ResponseNotificationProvider.tsx`
    - 使用 `useResponseStream` Hook 监听事件
    - 收到新 `lastEvent` 时使用 `react-hot-toast` 显示成功 toast
    - toast 包含调查名称和 `formatResponsePreview` 生成的响应预览
    - toast 持续 5 秒
    - 所有面向用户的文本使用 `t()` 国际化函数
    - 组件返回 `null`，不渲染可见 DOM 元素
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 在 `apps/web/app/(app)/environments/[environmentId]/layout.tsx` 中集成 `ResponseNotificationProvider`
    - 导入并添加 `ResponseNotificationProvider` 组件
    - 传递当前 `environmentId` 作为属性
    - 确保环境切换时组件自动切换到新环境的事件流
    - _需求: 8.1, 8.2, 8.3_

- [x] 7. Pipeline 集成
  - [x] 7.1 修改 `apps/web/app/api/(internal)/pipeline/route.ts`，在获取 survey 后发布事件到事件总线
    - 导入 `responseEventBus` 和 `uuidv7`
    - 在现有处理逻辑中（获取 survey 之后）调用 `responseEventBus.publish()`
    - 事件包含 `id`（UUIDv7）、`environmentId`、`surveyId`、`surveyName`（`survey.name`）、`event`、`response` 数据、`timestamp`
    - 使用 try-catch 包裹，异常时记录错误日志，不影响 Pipeline 主流程
    - 事件发布为 fire-and-forget 模式，不阻塞后续处理
    - _需求: 7.1, 7.2, 7.3, 7.4_

- [x] 8. 最终检查点 — 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了对应的需求编号，确保可追溯性
- 检查点任务确保增量验证
- 属性测试使用 `fast-check` 验证通用正确性属性
- 不为 `.tsx` 文件编写单元测试，遵循项目规范
