# 需求文档

## 简介

AI Summary 功能为 Formbricks 调研分析模块新增一个"AI Summary"标签页，利用 Amazon Bedrock Claude Sonnet 4.6 模型对调研回复进行自然语言摘要分析。用户可在调研分析界面中快速获取关键主题、情感倾向、关键发现和建议，无需逐条阅读回复。

## 术语表

- **AI_Summary_Tab**: 调研分析导航中的第三个标签页，用于展示 AI 生成的调研回复摘要
- **AI_Summary_Page**: AI Summary 标签页对应的服务端页面组件，遵循现有 Summary/Responses 页面模式
- **AiSummaryPage_Component**: AI Summary 的客户端核心 UI 组件，负责展示摘要内容和交互
- **AI_Service**: 服务端 Server Action，负责获取回复数据、构造 prompt、调用 Amazon Bedrock Claude Sonnet 4.6 并返回结构化摘要
- **Structured_Summary**: AI 返回的结构化摘要对象，包含关键主题（key themes）、情感分析（sentiment）、关键发现（key findings）和建议（recommendations）四个部分
- **Survey_Analysis_Navigation**: 调研分析模块的二级导航组件（`SurveyAnalysisNavigation`），当前包含 Summary 和 Responses 两个标签
- **Response_Data**: 调研回复的 `data` 字段（Json 类型），包含用户对各问题的回答
- **Bedrock_Provider**: Vercel AI SDK 的 `@ai-sdk/amazon-bedrock` provider，用于连接 Amazon Bedrock 服务
- **Cache_Service**: Formbricks 的缓存服务（`cache.withCache()`），基于 Redis 实现，用于缓存昂贵的计算结果

## 需求

### 需求 1：导航标签

**用户故事：** 作为调研分析师，我希望在调研分析导航中看到一个"AI Summary"标签，以便访问 AI 生成的调研回复摘要。

#### 验收标准

1. Survey_Analysis_Navigation 应在"Responses"标签之后显示一个"AI Summary"标签
2. AI_Summary_Tab 应使用 lucide-react 的 `SparklesIcon` 作为标签图标
3. 当点击 AI_Summary_Tab 时，Survey_Analysis_Navigation 应导航到当前调研分析路径下的 `ai-summary` 路由
4. 当用户位于 AI Summary 页面时，AI_Summary_Tab 应在导航中显示为激活状态
5. AI_Summary_Tab 的标签文本应使用 `t()` 国际化函数

### 需求 2：路由与页面结构

**用户故事：** 作为调研分析师，我希望 AI Summary 页面与其他分析页面具有相同的布局和导航，以保持体验一致性。

#### 验收标准

1. AI_Summary_Page 应为服务端组件，位于 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/page.tsx`
2. AI_Summary_Page 应按照 Summary 和 Responses 页面的相同模式渲染 `PageContentWrapper`、`PageHeader` 和 `SurveyAnalysisNavigation`
3. AI_Summary_Page 应向 `SurveyAnalysisNavigation` 组件传递 `activeId="ai-summary"`
4. 当 AI Summary 页面加载时，加载骨架屏（`loading.tsx`）应显示包含 `PageContentWrapper`、`PageHeader` 和占位骨架元素的布局
5. AI_Summary_Page 应使用 `getEnvironmentAuth` 验证用户身份和环境授权

### 需求 3：AI 摘要生成服务

**用户故事：** 作为调研分析师，我希望系统能生成调研回复的结构化 AI 摘要，以便快速了解关键洞察。

#### 验收标准

1. AI_Service 应使用 Vercel AI SDK（`ai`）配合 `@ai-sdk/amazon-bedrock` provider 调用 `anthropic.claude-sonnet-4-6` 模型
2. AI_Service 应作为 Server Action 实现，使用 `authenticatedActionClient` 进行适当的授权检查
3. 当 AI_Service 被调用时，应从数据库获取指定调研的回复数据
4. AI_Service 应构造包含调研问题和回复数据的 prompt，然后发送给 Claude Sonnet 4.6
5. AI_Service 应返回包含四个部分的 Structured_Summary：关键主题、情感分析、关键发现和建议
6. AI_Service 应使用 `cache.withCache()` 缓存 AI 结果，设置可配置的 TTL 以避免重复 API 调用
7. AI_Service 应使用 `createCacheKey.custom()` 生成 AI 摘要结果的缓存键
8. 如果回复数据总量超过模型 token 限制，AI_Service 应在构造 prompt 前对回复进行代表性采样
9. 如果 Amazon Bedrock API 调用失败，AI_Service 应按照 `{ error }` 模式返回描述性错误
10. 如果调研没有回复，AI_Service 应返回适当的消息，表明数据不足以生成摘要

### 需求 4：AI 摘要 UI

**用户故事：** 作为调研分析师，我希望以清晰、有组织的布局查看 AI 生成的摘要，以便快速消化洞察内容。

#### 验收标准

1. AiSummaryPage_Component 应以卡片/面板布局显示 Structured_Summary，包含关键主题、情感分析、关键发现和建议的独立区域
2. AiSummaryPage_Component 应显示一个"重新生成"按钮，触发新的 AI 摘要生成并绕过缓存
3. 当 AI_Service 正在处理时，AiSummaryPage_Component 应显示带有适当视觉指示器的加载状态
4. AiSummaryPage_Component 应显示"AI 生成"免责声明，告知用户摘要由 AI 生成
5. 如果 AI_Service 返回错误，AiSummaryPage_Component 应显示用户友好的错误消息并提供重试选项
6. AiSummaryPage_Component 应使用 `t()` 国际化函数处理所有面向用户的文本
7. 如果调研没有回复，AiSummaryPage_Component 应显示空状态消息，表明没有可用于 AI 分析的回复

### 需求 5：环境变量

**用户故事：** 作为平台管理员，我希望通过环境变量配置 AWS Bedrock 凭证，以便 AI Summary 功能能连接到 AI 服务。

#### 验收标准

1. AI_Service 应从环境变量读取 `AWS_BEDROCK_REGION`、`AWS_ACCESS_KEY_ID` 和 `AWS_SECRET_ACCESS_KEY` 用于 Bedrock 认证
2. `.env.example` 文件应包含三个 AWS Bedrock 环境变量及描述性注释
3. 如果任何必需的 AWS Bedrock 环境变量缺失，AI_Service 应返回明确的错误，指出缺失的配置

### 需求 6：隐私与数据通知

**用户故事：** 作为调研分析师，我希望被告知回复数据将被发送到 AWS Bedrock 进行 AI 处理，以便对数据隐私做出知情决策。

#### 验收标准

1. AiSummaryPage_Component 应显示数据隐私通知，告知用户调研回复数据将被发送到 AWS Bedrock 进行 AI 处理
2. 数据隐私通知应在用户首次触发 AI 摘要生成之前可见


