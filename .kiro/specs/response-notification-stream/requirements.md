# 需求文档

## 简介

本功能为 Formbricks 仪表盘构建基于 Server-Sent Events (SSE) 的实时响应通知系统。当用户提交调查问卷（`responseFinished`）时，系统自动将通知推送到已订阅该环境的仪表盘用户，无需刷新页面。核心采用内存级 pub/sub（EventEmitter）作为 MVP 方案，通过可替换的 `IResponseEventBus` 接口抽象事件总线，便于后续切换到 Redis pub/sub。

客户端采用浏览器原生 `EventSource` 自动重连机制，无需自定义指数退避或手动重连逻辑。

## 术语表

- **ResponseEventBus**: 事件总线抽象，负责按 `environmentId` 隔离的事件发布与订阅，MVP 阶段使用 Node.js EventEmitter 实现
- **SSE_Endpoint**: 基于 Next.js Route Handler 实现的 Server-Sent Events 端点，路径为 `/api/v1/client/[environmentId]/responses/stream`
- **useResponseStream_Hook**: 客户端 React Hook，管理 EventSource 连接生命周期和事件数据消费，依赖浏览器原生自动重连
- **ResponseNotificationProvider**: 仪表盘布局中的通知 Provider 组件，监听 SSE 事件并以 toast 形式展示新响应通知
- **TResponseEvent**: 服务端事件数据结构，包含 environmentId、surveyId、surveyName、event 类型和响应数据
- **TStreamEvent**: 客户端事件数据结构，由 SSE 端点序列化后推送给浏览器
- **Pipeline_Route**: 现有的 Pipeline Route Handler（`/api/(internal)/pipeline/route.ts`），处理调查问卷响应提交的入口
- **Environment**: Formbricks 多租户架构中的部署上下文（如开发、生产），所有数据按 Environment 隔离
- **formatResponsePreview**: 辅助函数，将响应数据格式化为截断的预览字符串

## 需求

### 需求 1：事件总线发布与订阅

**用户故事：** 作为系统开发者，我希望有一个按环境隔离的事件总线，以便将新响应事件从 Pipeline 分发到所有已订阅的 SSE 连接。

#### 验收标准

1. 当 ResponseEventBus 收到 `publish(event)` 调用时，ResponseEventBus 应同步调用所有订阅了 `event.environmentId` 的回调函数
2. 当 ResponseEventBus 收到 `publish(event)` 调用时，ResponseEventBus 不应调用订阅了其他 `environmentId` 的回调函数
3. 当 ResponseEventBus 对某个 `environmentId` 没有订阅者时，`publish(event)` 调用不应抛出异常
4. 当调用 `subscribe(environmentId, callback)` 时，ResponseEventBus 应返回一个取消订阅函数
5. 当调用取消订阅函数后，该回调不应再接收对应 `environmentId` 的事件
6. 当执行 subscribe 操作时，`getSubscriberCount(environmentId)` 应增加 1；当执行 unsubscribe 操作时，应减少 1
7. 如果取消订阅函数被多次调用，ResponseEventBus 不应抛出异常，且不应影响其他订阅

### 需求 2：SSE 端点认证与授权

**用户故事：** 作为平台管理员，我希望 SSE 端点强制执行身份验证和环境访问权限检查，以确保只有授权用户才能接收实时通知。

#### 验收标准

1. 当请求到达 SSE_Endpoint 且没有有效的 next-auth session 时，SSE_Endpoint 应返回 HTTP 401 状态码
2. 当请求到达 SSE_Endpoint 且用户没有对应 `environmentId` 的访问权限时，SSE_Endpoint 应返回 HTTP 403 状态码
3. 当请求通过认证和授权后，SSE_Endpoint 应返回 HTTP 200 状态码，Content-Type 为 `text/event-stream`
4. SSE_Endpoint 应使用 `getServerSession(authOptions)` 验证用户会话
5. SSE_Endpoint 应使用 `hasUserEnvironmentAccess` 检查用户对环境的访问权限

### 需求 3：SSE 连接生命周期管理

**用户故事：** 作为仪表盘用户，我希望 SSE 连接在建立后保持稳定，并在断开时自动清理资源，以确保系统资源不泄漏。

#### 验收标准

1. 当 SSE 连接成功建立时，SSE_Endpoint 应发送一个 `connected` 事件，包含 `environmentId` 和 `timestamp`
2. 当新响应事件到达时，SSE_Endpoint 应发送一个 `response` 事件，包含序列化的 TStreamEvent 数据和 UUIDv7 格式的事件 ID
3. 当 SSE 连接关闭时（客户端中断或服务器关闭），SSE_Endpoint 应取消事件总线订阅
4. 当 SSE 连接关闭后，对应环境的 `getSubscriberCount` 应减少 1
5. SSE_Endpoint 应设置 `Cache-Control: no-cache, no-transform` 和 `X-Accel-Buffering: no` 响应头以防止代理缓冲

### 需求 4：客户端 SSE 连接

**用户故事：** 作为仪表盘用户，我希望浏览器自动管理 SSE 连接，以确保我不会错过新响应通知。

#### 验收标准

1. 当 useResponseStream_Hook 初始化时，应创建 EventSource 连接
2. 当 SSE 连接成功建立并收到 `connected` 事件时，连接已就绪
3. 当组件卸载时，useResponseStream_Hook 应关闭 EventSource 连接
4. 当收到 `response` 事件时，useResponseStream_Hook 应更新 `lastEvent` 状态
5. 当 SSE 连接断开时，依赖浏览器原生 EventSource 自动重连机制恢复连接

### 需求 5：Toast 通知展示

**用户故事：** 作为仪表盘用户，我希望在收到新调查响应时看到 toast 通知，以便及时了解新数据的到达。

#### 验收标准

1. 当 ResponseNotificationProvider 收到新的 `lastEvent` 时，应使用 `react-hot-toast` 显示成功类型的 toast 通知
2. toast 通知应包含调查名称和响应数据预览
3. toast 通知应持续显示 5 秒
4. ResponseNotificationProvider 应使用 `t()` 国际化函数处理所有面向用户的文本
5. ResponseNotificationProvider 应作为纯副作用组件，不渲染任何可见 DOM 元素

### 需求 6：响应预览格式化

**用户故事：** 作为仪表盘用户，我希望 toast 通知中的响应预览简洁明了，以便快速了解新响应的内容。

#### 验收标准

1. 当响应数据为空时，formatResponsePreview 应返回空字符串
2. 当响应数据非空时，formatResponsePreview 应返回第一个字段值的字符串表示
3. 当字段值为数组时，formatResponsePreview 应使用逗号加空格连接数组元素
4. formatResponsePreview 返回的字符串长度不应超过 83 个字符（80 个内容字符 + 3 个省略号字符）

### 需求 7：Pipeline 集成

**用户故事：** 作为系统开发者，我希望 Pipeline 在用户提交调查问卷时自动发布事件到事件总线，以触发实时通知流。

#### 验收标准

1. 当 Pipeline_Route 处理 `responseFinished` 事件时，应调用 `responseEventBus.publish()` 发布包含完整 TResponseEvent 数据的事件
2. 当 Pipeline_Route 处理 `responseCreated` 事件时，不应发布事件到事件总线
3. Pipeline_Route 发布事件时应使用 UUIDv7 作为事件 ID 以保证有序性
4. 如果 `responseEventBus.publish()` 抛出异常，Pipeline_Route 应捕获并记录错误日志，不应影响 Pipeline 的其他处理流程（webhook、邮件等）
5. 事件发布应为 fire-and-forget 模式，不应阻塞 Pipeline 的主处理流程

### 需求 8：仪表盘布局集成

**用户故事：** 作为仪表盘用户，我希望实时通知在进入环境仪表盘后自动启用，无需额外操作。

#### 验收标准

1. ResponseNotificationProvider 应集成在环境级布局组件 `environments/[environmentId]/layout.tsx` 中
2. ResponseNotificationProvider 应接收当前 `environmentId` 作为属性
3. 当用户导航到不同环境时，ResponseNotificationProvider 应自动切换到新环境的事件流
