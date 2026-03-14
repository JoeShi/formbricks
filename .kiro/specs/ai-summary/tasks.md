# 实现计划：AI Summary

## 概述

基于需求文档和设计文档，将 AI Summary 功能拆分为增量式编码任务。每个任务构建在前一个任务之上，最终将所有组件串联起来。技术栈为 TypeScript + Next.js App Router，AI 调用使用 Vercel AI SDK + Amazon Bedrock。

## 任务

- [x] 1. 定义数据类型与 Zod Schema
  - [x] 1.1 创建 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/lib/types.ts`
    - 定义 `TKeyTheme`、`TSentimentAnalysis`、`TKeyFinding`、`TRecommendation`、`TStructuredSummary` TypeScript 接口
    - 定义对应的 Zod schema：`ZKeyTheme`、`ZSentimentAnalysis`、`ZKeyFinding`、`ZRecommendation`、`ZStructuredSummary`
    - _需求: 3.5_

  - [x] 1.2 编写属性测试：结构化摘要 Schema 验证
    - **Property 3: 结构化摘要 Schema 验证**
    - 使用 fast-check 生成随机 `TStructuredSummary` 对象，验证 `ZStructuredSummary` 解析通过
    - 验证 `sentiment.positivePercentage + negativePercentage + neutralPercentage` 约等于 100
    - 验证 `recommendations` 中每项的 `priority` 为 `"high" | "medium" | "low"` 之一
    - **验证: 需求 3.5**

- [x] 2. 实现 AI 摘要核心服务
  - [x] 2.1 添加环境变量到 `.env.example`
    - 在文件中添加 `AWS_BEDROCK_REGION`、`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY` 及描述性注释
    - _需求: 5.2_

  - [x] 2.2 创建 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/lib/ai-summary-service.ts`
    - 实现 `generateAiSummary(surveyId: string, skipCache?: boolean): Promise<TStructuredSummary>` 函数
    - 从环境变量读取 AWS 凭证，缺失时返回明确错误（指出缺失变量名）
    - 使用 `@ai-sdk/amazon-bedrock` 初始化 provider，调用 `anthropic.claude-sonnet-4-6` 模型
    - 使用 Vercel AI SDK 的 `generateObject()` 配合 `ZStructuredSummary` schema 获取结构化输出
    - 从数据库获取调研回复数据（使用 Prisma），无回复时返回适当消息
    - 构造包含调研问题和回复数据的 prompt
    - 实现回复采样逻辑：超过阈值时按时间均匀采样，优先保留已完成回复
    - 使用 `cache.withCache()` 缓存结果，缓存键为 `createCacheKey.custom("analytics", surveyId, "ai-summary")`，TTL 1 小时
    - `skipCache` 为 true 时绕过缓存读取，但仍写入新结果
    - 捕获 Bedrock API 错误，按 `{ error }` 模式返回描述性错误
    - 设置 30 秒超时
    - _需求: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.1, 5.3_

  - [x] 2.3 编写属性测试：缓存键唯一性与格式
    - **Property 4: 缓存键唯一性与格式**
    - 使用 fast-check 生成随机 surveyId，验证缓存键匹配 `fb:analytics:{surveyId}:ai-summary` 模式
    - 验证不同 surveyId 产生不同缓存键
    - **验证: 需求 3.7**

  - [x] 2.4 编写属性测试：回复采样保持代表性
    - **Property 5: 回复采样保持代表性**
    - 使用 fast-check 生成超过阈值的随机回复列表，验证采样子集小于原始集合
    - 验证采样结果仅包含原始集合中的项
    - 验证采样结果包含最早和最晚时间四分位的回复
    - **验证: 需求 3.8**

  - [x] 2.5 编写属性测试：缺失环境变量检测
    - **Property 7: 缺失环境变量检测**
    - 使用 fast-check 生成随机缺失变量组合，验证错误消息包含缺失变量名
    - **验证: 需求 5.3**

  - [x] 2.6 编写单元测试：AI 摘要服务
    - 测试无回复时返回空状态消息（需求 3.10）
    - 测试环境变量缺失时返回正确错误（需求 5.3 具体示例）
    - 测试 Bedrock API 调用失败时返回 `{ error }` 格式（需求 3.9）
    - 测试文件：`ai-summary/lib/ai-summary-service.test.ts`
    - _需求: 3.9, 3.10, 5.3_

- [x] 3. 实现 Server Action
  - [x] 3.1 创建 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/lib/actions.ts`
    - 定义 `ZGenerateAiSummaryAction` 输入 schema（`surveyId: ZId`，`skipCache: z.boolean().optional()`）
    - 使用 `authenticatedActionClient` 实现 `generateAiSummaryAction`
    - 使用 `checkAuthorizationUpdated` 进行授权检查（参考现有 `getResponsesAction` 模式）
    - 调用 `generateAiSummary` 服务函数
    - 返回 `{ data: TStructuredSummary }` 或 `{ error: string }`
    - _需求: 3.2, 3.5, 3.9_

  - [ ]* 3.2 编写属性测试：AI 错误返回结构化错误
    - **Property 6: AI 错误返回结构化错误**
    - 使用 fast-check 生成随机错误类型（网络错误、API 错误、超时），验证服务返回 `{ error: string }` 格式
    - 验证 error 字符串非空且具有描述性
    - **验证: 需求 3.9**

- [x] 4. 检查点 — 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 5. 修改导航组件，添加 AI Summary 标签
  - [x] 5.1 修改 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation.tsx`
    - 导入 `SparklesIcon` from `lucide-react`
    - 在 `navigation` 数组的 `responses` 项之后添加 AI Summary 导航项
    - 设置 `id: "ai-summary"`、`label: t("common.ai_summary")`、`icon: <SparklesIcon />`
    - 设置 `href: \`${url}/ai-summary?referer=true\``
    - 设置 `current: pathname?.includes("/ai-summary")`
    - 设置 `onClick` 调用 `revalidateSurveyIdPath`
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 5.2 编写属性测试：导航链接格式正确性
    - **Property 1: 导航链接格式正确性**
    - 使用 fast-check 生成随机 environmentId 和 surveyId，验证 href 等于 `/environments/${environmentId}/surveys/${surveyId}/ai-summary?referer=true`
    - **验证: 需求 1.3**

- [x] 6. 创建 AI Summary 页面与加载骨架屏
  - [x] 6.1 创建 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/page.tsx`
    - 实现服务端组件，遵循 Summary/Responses 页面相同模式
    - 使用 `getEnvironmentAuth` 验证用户身份和环境授权
    - 获取 survey 数据，渲染 `PageContentWrapper` > `PageHeader` > `SurveyAnalysisNavigation`（`activeId="ai-summary"`）
    - 渲染 `AiSummaryPage` 客户端组件，传递 `surveyId` 和 `environmentId`
    - _需求: 2.1, 2.2, 2.3, 2.5_

  - [x] 6.2 创建 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/loading.tsx`
    - 实现加载骨架屏，包含 `PageContentWrapper`、`PageHeader` 占位和骨架元素
    - _需求: 2.4_

- [x] 7. 实现 AI Summary 客户端 UI 组件
  - [x] 7.1 创建 `apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/ai-summary/components/AiSummaryPage.tsx`
    - 实现 `"use client"` 客户端组件，接收 `surveyId` 和 `environmentId` props
    - 实现数据隐私通知（DataPrivacyNotice），在首次触发 AI 摘要生成之前可见，告知用户数据将发送到 AWS Bedrock
    - 组件挂载后调用 `generateAiSummaryAction` 获取摘要数据
    - 实现加载状态：AI 处理中显示带有视觉指示器的加载动画
    - 实现错误状态：显示用户友好的错误消息和重试按钮
    - 实现空状态：无回复时显示空状态消息
    - 实现摘要内容展示：
      - AI 生成免责声明（AiDisclaimer）
      - 重新生成按钮（调用 `generateAiSummaryAction({ surveyId, skipCache: true })`）
      - 关键主题卡片（KeyThemesCard）：列表展示每个主题的标题、描述和回复数量
      - 情感分析卡片（SentimentCard）：展示整体倾向和百分比进度条
      - 关键发现卡片（KeyFindingsCard）：编号列表展示发现和证据引用
      - 建议卡片（RecommendationsCard）：按优先级（高/中/低）展示建议
      - 元数据区域：分析回复数、生成时间、模型 ID
    - 所有面向用户的文本使用 `t()` 国际化函数
    - 卡片样式使用 `rounded-lg border bg-white p-6 shadow-sm`
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.1, 6.2_

  - [ ]* 7.2 编写属性测试：Prompt 包含完整调研上下文
    - **Property 2: Prompt 包含完整调研上下文**
    - 使用 fast-check 生成随机问题和回复数据，验证构造的 prompt 包含每个问题的 headline 和每条回复的数据值
    - **验证: 需求 3.4**

- [ ] 8. 串联与集成
  - [x] 8.1 添加 i18n 翻译键
    - 在 `apps/web/locales/en-US.json` 中添加所有 AI Summary 相关的翻译键
    - 包括：`common.ai_summary`、隐私通知文本、免责声明、加载/错误/空状态文本、卡片标题、按钮文本等
    - _需求: 1.5, 4.6_

  - [x] 8.2 验证端到端集成
    - 确保导航标签正确链接到 AI Summary 页面
    - 确保 `activeId="ai-summary"` 在 AI Summary 页面时导航高亮正确
    - 确保页面布局与 Summary/Responses 页面一致
    - _需求: 1.3, 1.4, 2.2, 2.3_

- [x] 9. 最终检查点 — 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 不为 `.tsx` 文件编写单元测试，组件由 Playwright E2E 覆盖
