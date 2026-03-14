# 预览实时同步缺陷修复设计

## 概述

在项目设置 > 外观与风格（Look & Feel）页面中，`EditLogo` 和 `EditBranding` 组件在成功保存更改后未调用 `router.refresh()`，导致服务端组件 `ProjectLookSettingsPage` 不会重新渲染，`ThemeStylingPreviewSurvey` 预览组件继续显示过期的 `project` 数据。修复方案是在这两个组件的成功回调中添加 `router.refresh()` 调用，与同页面 `ThemeStyling` 组件的 `onReset` 方法保持一致的刷新模式。

## 术语表

- **Bug_Condition (C)**：触发缺陷的条件——用户在 `EditLogo` 或 `EditBranding` 组件中成功保存更改后，预览组件未更新
- **Property (P)**：期望行为——成功保存后，`router.refresh()` 被调用，服务端组件重新渲染，预览组件显示最新数据
- **Preservation**：不应被修改影响的现有行为——`ThemeStyling` 的 `form.watch()` 实时预览、`onReset` 的 `router.refresh()`、`EditPlacementForm` 的保存逻辑
- **`EditLogo`**：位于 `apps/web/modules/projects/settings/look/components/edit-logo.tsx` 的组件，负责项目 Logo 的上传、替换和删除
- **`EditBranding`**：位于 `apps/web/modules/ee/whitelabel/remove-branding/components/edit-branding.tsx` 的组件，负责切换 Formbricks 品牌标识的显示/隐藏
- **`ThemeStylingPreviewSurvey`**：位于 `apps/web/modules/ui/components/theme-styling-preview-survey/index.tsx` 的预览组件，接收 `project` prop 渲染调查问卷预览
- **`ProjectLookSettingsPage`**：位于 `apps/web/modules/projects/settings/look/page.tsx` 的服务端组件，从数据库获取 `project` 数据并传递给子组件

## 缺陷详情

### 缺陷条件

当用户在 `EditLogo` 组件中成功保存/删除 Logo，或在 `EditBranding` 组件中成功切换品牌标识开关后，服务端 action 返回成功结果，但客户端未触发 `router.refresh()`，导致服务端组件 `ProjectLookSettingsPage` 不重新渲染，`ThemeStylingPreviewSurvey` 继续使用过期的 `project` prop。

**形式化规约：**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { component: "EditLogo" | "EditBranding", actionResult: ActionResult }
  OUTPUT: boolean

  RETURN (input.component == "EditLogo" AND input.actionResult.data != null)
         OR (input.component == "EditBranding" AND input.actionResult.data != null)
         // 即：action 成功返回但未调用 router.refresh()
END FUNCTION
```

### 示例

- **Logo 上传后**：用户上传新 Logo 并点击保存，toast 提示"Logo 更新成功"，但预览中仍显示"Add logo"占位符，直到手动刷新页面
- **Logo 删除后**：用户删除现有 Logo 并确认，toast 提示"Logo 已删除"，但预览中仍显示旧 Logo 图片，直到手动刷新页面
- **Link Survey 品牌标识切换**：用户关闭 Link Survey 的 Formbricks 品牌标识，toast 提示"品牌标识已隐藏"，但预览底部仍显示 "Powered by Formbricks"，直到手动刷新页面
- **App Survey 品牌标识切换**：用户关闭 App Survey 的 Formbricks 品牌标识，toast 提示成功，但预览中 App Survey 模式仍显示品牌标识，直到手动刷新页面

## 期望行为

### 保持性要求

**不变行为：**
- `ThemeStyling` 组件通过 `form.watch()` 实现的品牌颜色、卡片样式、背景样式实时预览必须继续正常工作
- `ThemeStyling` 组件 `onReset` 方法中已有的 `router.refresh()` 调用必须保持不变
- `EditPlacementForm` 组件的保存和预览行为必须保持不变
- 当 Logo 或品牌标识保存失败（action 返回错误）时，不应调用 `router.refresh()`，仅显示错误提示

**范围：**
所有不涉及 `EditLogo` 和 `EditBranding` 成功保存路径的输入应完全不受此修复影响，包括：
- `ThemeStyling` 的所有交互（颜色选择、样式调整、保存、重置）
- `EditPlacementForm` 的所有交互
- 保存失败的错误处理路径
- 文件上传过程中的中间状态

## 假设的根本原因

基于代码分析，根本原因已明确确认：

1. **`EditLogo.saveChanges` 缺少 `router.refresh()`**：在 `saveChanges` 函数中，`updateProjectAction` 成功返回后仅调用了 `toast.success()`，未调用 `router.refresh()`。对比同页面的 `ThemeStyling.onReset`，后者在 `updateProjectAction` 成功后明确调用了 `router.refresh()`。

2. **`EditLogo.removeLogo` 缺少 `router.refresh()`**：在 `removeLogo` 函数中，`updateProjectAction` 成功返回后仅调用了 `toast.success()`，同样未调用 `router.refresh()`。

3. **`EditBranding.toggleBranding` 缺少 `router.refresh()`**：在 `toggleBranding` 函数中，`updateProjectBrandingAction` 成功返回后仅调用了 `toast.success()`，未调用 `router.refresh()`。

4. **数据流依赖服务端渲染**：`ProjectLookSettingsPage` 是一个 async 服务端组件，通过 `getProjectByEnvironmentId` 从数据库获取 `project` 数据，然后作为 prop 传递给 `ThemeStylingPreviewSurvey`。没有 `router.refresh()`，服务端组件不会重新执行，预览组件无法获取最新数据。

## 正确性属性

Property 1: Bug Condition - 成功保存后触发页面刷新

_For any_ 在 `EditLogo` 或 `EditBranding` 组件中执行保存操作且 server action 返回成功结果（`response.data != null`）的情况下，修复后的代码 SHALL 调用 `router.refresh()` 以触发服务端组件重新渲染，使 `ThemeStylingPreviewSurvey` 预览组件显示最新的项目数据。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 保存失败时不触发刷新

_For any_ 在 `EditLogo` 或 `EditBranding` 组件中执行保存操作且 server action 返回失败结果（`response.data == null`）的情况下，修复后的代码 SHALL 与原始代码行为一致，仅显示错误提示，不调用 `router.refresh()`，保持预览组件状态不变。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## 修复实现

### 所需变更

假设根本原因分析正确：

**文件**: `apps/web/modules/projects/settings/look/components/edit-logo.tsx`

**函数**: `saveChanges`, `removeLogo`

**具体变更**:
1. **引入 `useRouter`**：从 `next/navigation` 导入 `useRouter`，在组件中初始化 `const router = useRouter()`
2. **`saveChanges` 成功后刷新**：在 `updateProjectResponse?.data` 为真的分支中，`toast.success()` 之后添加 `router.refresh()`
3. **`removeLogo` 成功后刷新**：在 `updateProjectResponse?.data` 为真的分支中，`toast.success()` 之后添加 `router.refresh()`

**文件**: `apps/web/modules/ee/whitelabel/remove-branding/components/edit-branding.tsx`

**函数**: `toggleBranding`

**具体变更**:
4. **引入 `useRouter`**：从 `next/navigation` 导入 `useRouter`，在组件中初始化 `const router = useRouter()`
5. **`toggleBranding` 成功后刷新**：在 `updateBrandingResponse?.data` 为真的分支中，`toast.success()` 之后添加 `router.refresh()`

## 测试策略

### 验证方法

测试策略遵循两阶段方法：首先在未修复代码上验证缺陷存在，然后验证修复后行为正确且现有功能不受影响。

注意：根据项目规则，`.tsx` 组件文件不编写单元测试，组件行为通过 Playwright E2E 测试覆盖。

### 探索性缺陷条件检查

**目标**：在实施修复之前，验证缺陷确实存在。确认或否定根本原因分析。

**测试计划**：通过代码审查和手动测试验证以下场景在未修复代码上的表现。

**测试用例**：
1. **Logo 上传测试**：上传新 Logo 并保存，观察预览是否更新（未修复代码上将失败）
2. **Logo 删除测试**：删除现有 Logo，观察预览是否更新（未修复代码上将失败）
3. **Link Survey 品牌标识切换测试**：切换 Link Survey 品牌标识开关，观察预览是否更新（未修复代码上将失败）
4. **App Survey 品牌标识切换测试**：切换 App Survey 品牌标识开关，观察预览是否更新（未修复代码上将失败）

**预期反例**：
- 所有保存操作成功后，预览组件不更新，仍显示旧数据
- 原因：`EditLogo` 和 `EditBranding` 的成功回调中缺少 `router.refresh()` 调用

### 修复检查

**目标**：验证对于所有触发缺陷条件的输入，修复后的函数产生期望行为。

**伪代码：**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := performAction_fixed(input)
  ASSERT router.refresh() was called
  ASSERT ThemeStylingPreviewSurvey receives updated project data
END FOR
```

### 保持性检查

**目标**：验证对于所有不触发缺陷条件的输入，修复后的函数与原始函数产生相同结果。

**伪代码：**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT performAction_original(input) = performAction_fixed(input)
END FOR
```

**测试方法**：由于修改范围极小（仅在两个文件的成功分支中各添加一行 `router.refresh()`），保持性风险较低。建议通过 E2E 测试验证：
- 修改不影响 `ThemeStyling` 的实时预览功能
- 修改不影响错误处理路径

**测试用例**：
1. **主题样式实时预览保持**：修改品牌颜色后，验证预览通过 `form.watch()` 实时更新，行为与修复前一致
2. **主题样式重置保持**：点击"重置为默认"后，验证预览正确更新，行为与修复前一致
3. **保存失败处理保持**：模拟网络错误导致保存失败，验证仅显示错误提示，预览不变

### 单元测试

- 根据项目规则（`.tsx` 文件不编写单元测试），此修复不需要新增单元测试
- Server action 函数（`updateProjectAction`、`updateProjectBrandingAction`）未被修改，无需额外测试

### Property-Based 测试

- 由于修改范围极小且仅涉及 UI 组件的客户端行为（`router.refresh()` 调用），property-based 测试的适用性有限
- 可考虑对 `router.refresh()` 的调用条件进行参数化测试：生成随机的 action 返回结果，验证仅在 `data != null` 时调用 `router.refresh()`

### 集成测试

- **E2E: Logo 上传后预览更新**：Playwright 测试上传 Logo → 保存 → 验证预览组件中 Logo 可见
- **E2E: Logo 删除后预览更新**：Playwright 测试删除 Logo → 确认 → 验证预览组件中 Logo 消失
- **E2E: 品牌标识切换后预览更新**：Playwright 测试切换品牌标识开关 → 验证预览组件中品牌标识状态变化
- **E2E: 主题样式功能回归**：Playwright 测试修改品牌颜色 → 验证预览实时更新 → 保存 → 验证持久化
