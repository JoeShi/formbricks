# AI Summary 功能 — 规格驱动开发提示词

## 背景

你正在帮助 Formbricks（一个开源调研平台，号称"开源版 Qualtrics"）开发一个"AI Summary"功能。该功能使用 AI 来概括调研回复，为用户提供快速洞察。

## 技术栈

- **框架**: Next.js 16（App Router，开发时使用 Turbopack），React 19
- **语言**: TypeScript（严格模式）
- **样式**: Tailwind CSS v3
- **数据库**: PostgreSQL，通过 Prisma ORM 访问
- **Monorepo**: pnpm workspaces + Turborepo
- **AI 模型**: Amazon Bedrock Claude Sonnet 4.6（`anthropic.claude-sonnet-4-6`），通过 Vercel AI SDK（`ai` + `@ai-sdk/amazon-bedrock`）访问
- **国际化**: react-i18next（所有面向用户的文本必须使用 `t()` 函数）

## 项目架构

调研分析模块位于：
```
apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/
```

当前分析导航中的标签页：
1. **Summary** — 回复的统计摘要（完成率、流失率、按问题聚合）
2. **Responses** — 单条回复的表格视图

目标是添加第三个标签页：
3. **AI Summary** — AI 驱动的自然语言回复摘要

### 关键文件

- **导航组件**: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation.tsx`
  - 包含一个 `navigation` 数组，有 `summary` 和 `responses` 两个项
  - 使用 `SecondaryNavigation` UI 组件
  - 每个项包含：`id`、`label`、`icon`（lucide-react）、`href`、`current`、`onClick`

- **分析布局**: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/layout.tsx`
  - 用 `ResponseFilterProvider` 包裹子组件

- **Summary 页面**（参考）: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/page.tsx`
  - 服务端组件，获取数据并渲染 `PageContentWrapper` > `PageHeader` > `SurveyAnalysisNavigation` + `SummaryPage`

- **Responses 页面**（参考）: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/page.tsx`
  - 同样的模式：服务端组件，`PageContentWrapper` > `PageHeader` > `SurveyAnalysisNavigation` + `ResponsePage`

- **调研摘要服务**: `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary.ts`
  - 从数据库聚合回复数据

- **Response 数据模型**（Prisma）:
  ```prisma
  model Response {
    id                String
    createdAt         DateTime
    updatedAt         DateTime
    finished          Boolean
    survey            Survey
    surveyId          String
    data              Json      // 回复数据
    variables         Json
    ttc               Json
    meta              Json      // 浏览器、操作系统、设备信息
    tags              TagsOnResponses[]
    contactAttributes Json?
    language          String?
  }
  ```

### 编码规范

- Server Action 统一返回 `{ data }` 或 `{ error }`
- 对昂贵的数据操作使用 `cache.withCache()` 或 Redis（不要使用 `unstable_cache`）
- 使用 `createCacheKey.*` 工具函数生成缓存键
- 所有面向用户的文本必须使用 react-i18next 的 `t()` 函数
- 组件和模块文件夹使用 PascalCase，函数和变量使用 camelCase
- 两空格缩进，双引号，分号
- Mock 文件放在 `__mocks__` 目录中
- 不要为 `.tsx` 文件编写单元测试

## 功能需求

### 1. 导航标签
在 `SurveyAnalysisNavigation` 中添加一个"AI Summary"标签，位于"Responses"之后。使用 lucide-react 的 `SparklesIcon` 图标。

### 2. 路由与页面
创建 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/` 目录，包含：
- `page.tsx` — 服务端组件，遵循与 summary/responses 页面相同的模式
- `loading.tsx` — 加载骨架屏
- `components/AiSummaryPage.tsx` — 客户端组件，AI 摘要的核心 UI

### 3. AI 服务
- 使用 Vercel AI SDK（`ai`）配合 `@ai-sdk/amazon-bedrock` provider
- 模型：通过 Amazon Bedrock inference profile 调用 Claude Sonnet 4.6
- 区域：`us-east-1`
- 创建一个 Server Action，流程如下：
  1. 从数据库获取该调研的所有回复
  2. 用调研问题 + 回复数据构造 prompt
  3. 通过 Bedrock 调用 Claude Sonnet 4.6
  4. 返回结构化摘要（关键主题、情感倾向、关键发现、建议）
- 使用 `cache.withCache()` 缓存 AI 结果，设置合适的 TTL
- 处理 token 限制：回复量过大时进行采样

### 4. 环境变量
在 `.env.example` 中添加：
```
# AI Summary (Amazon Bedrock)
AWS_BEDROCK_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### 5. UI 设计
AI Summary 页面应展示：
- 一个卡片/面板，显示 AI 生成的摘要
- 分区：关键主题、情感分析、关键发现、建议
- 一个"重新生成"按钮，用于重新运行 AI 分析
- AI 处理中的加载状态
- "AI 生成"标识/免责声明
- 错误状态处理

### 6. 隐私与成本考量
- 显示提示，告知用户回复数据将被发送到 AWS Bedrock 进行 AI 处理
- 考虑对 AI 摘要生成进行速率限制
- 缓存结果以避免重复的 API 调用

## 任务

请按照规格驱动开发（spec-driven development）的方法，为实现该功能生成一份完整、详细的技术规格文档。规格文档应包含：

1. **需求** — 功能性需求和非功能性需求
2. **设计** — 组件层级、数据流、API 设计
3. **实现计划** — 分步骤的任务清单，包含文件路径
4. **验收标准** — 如何验证每个需求已被满足

请以 Markdown 格式输出规格文档，使其可以直接作为开发指南使用。
