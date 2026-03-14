# 实施计划

- [x] 1. 编写缺陷条件探索测试
  - **Property 1: Bug Condition** - 成功保存后缺少 router.refresh() 调用
  - **重要**：在实施修复之前编写此 property-based 测试
  - **关键**：此测试必须在未修复代码上失败——失败确认缺陷存在
  - **不要**在测试失败时尝试修复测试或代码
  - **注意**：此测试编码了期望行为——修复后测试通过即验证修复正确
  - **目标**：展示缺陷存在的反例
  - **Scoped PBT 方法**：由于此缺陷是确定性的，将属性范围限定到具体失败场景
  - 验证 `EditLogo` 组件的 `saveChanges` 函数在 `updateProjectAction` 返回成功结果（`response.data != null`）后是否调用了 `router.refresh()`（来自设计文档缺陷条件）
  - 验证 `EditLogo` 组件的 `removeLogo` 函数在 `updateProjectAction` 返回成功结果后是否调用了 `router.refresh()`
  - 验证 `EditBranding` 组件的 `toggleBranding` 函数在 `updateProjectBrandingAction` 返回成功结果后是否调用了 `router.refresh()`
  - 注意：根据项目规则，`.tsx` 文件不编写单元测试，组件由 Playwright E2E 覆盖
  - 通过代码审查确认：当前 `edit-logo.tsx` 的 `saveChanges` 和 `removeLogo` 成功分支中无 `router.refresh()` 调用
  - 通过代码审查确认：当前 `edit-branding.tsx` 的 `toggleBranding` 成功分支中无 `router.refresh()` 调用
  - 对比 `theme-styling.tsx` 的 `onReset` 方法，该方法在成功后正确调用了 `router.refresh()`
  - 在未修复代码上运行测试
  - **预期结果**：测试失败（这是正确的——证明缺陷存在）
  - 记录发现的反例（例如："saveChanges 成功后未调用 router.refresh()，预览组件不更新"）
  - 当测试编写完成、运行并记录失败后，标记任务完成
  - _Requirements: 1.1, 1.2_

- [x] 2. 编写保持性属性测试（在实施修复之前）
  - **Property 2: Preservation** - 现有刷新行为和错误处理路径保持不变
  - **重要**：遵循观察优先方法论
  - 观察：`ThemeStyling.onReset` 在 `updateProjectAction` 成功后调用 `router.refresh()`（未修复代码上已存在）
  - 观察：`ThemeStyling.onSubmit` 在成功后调用 `form.reset()` 和 `setPreviewBrandColor()` 实现实时预览（未修复代码上已存在）
  - 观察：`EditLogo.saveChanges` 在失败时仅调用 `toast.error()`，不调用 `router.refresh()`（未修复代码上已存在）
  - 观察：`EditBranding.toggleBranding` 在失败时仅调用 `toast.error()`，不调用 `router.refresh()`（未修复代码上已存在）
  - 注意：根据项目规则，`.tsx` 文件不编写单元测试，通过代码审查和 E2E 测试验证保持性
  - 通过代码审查验证：`theme-styling.tsx` 中 `onReset` 的 `router.refresh()` 调用存在且未被修改
  - 通过代码审查验证：`theme-styling.tsx` 中 `form.watch()` 实时预览机制存在且未被修改
  - 通过代码审查验证：错误处理路径（`response.data == null`）仅显示 toast 错误提示
  - 在未修复代码上验证以上观察
  - **预期结果**：所有观察到的行为在未修复代码上确认存在（基线行为已建立）
  - 当观察完成并记录基线行为后，标记任务完成
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 修复预览实时同步缺陷

  - [x] 3.1 在 `edit-logo.tsx` 中添加 `router.refresh()` 调用
    - 从 `next/navigation` 导入 `useRouter`
    - 在 `EditLogo` 组件中添加 `const router = useRouter()`
    - 在 `saveChanges` 函数的 `updateProjectResponse?.data` 为真的分支中，`toast.success()` 之后添加 `router.refresh()`
    - 在 `removeLogo` 函数的 `updateProjectResponse?.data` 为真的分支中，`toast.success()` 之后添加 `router.refresh()`
    - _Bug_Condition: isBugCondition(input) where input.component == "EditLogo" AND input.actionResult.data != null_
    - _Expected_Behavior: 成功保存后调用 router.refresh()，触发服务端组件重新渲染，预览显示最新数据_
    - _Preservation: 错误处理路径不变，ThemeStyling 的 form.watch() 和 onReset 行为不变_
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.4_

  - [x] 3.2 在 `edit-branding.tsx` 中添加 `router.refresh()` 调用
    - 从 `next/navigation` 导入 `useRouter`
    - 在 `EditBranding` 组件中添加 `const router = useRouter()`
    - 在 `toggleBranding` 函数的 `updateBrandingResponse?.data` 为真的分支中，`toast.success()` 之后添加 `router.refresh()`
    - _Bug_Condition: isBugCondition(input) where input.component == "EditBranding" AND input.actionResult.data != null_
    - _Expected_Behavior: 成功切换后调用 router.refresh()，触发服务端组件重新渲染，预览显示最新品牌标识状态_
    - _Preservation: 错误处理路径不变，切换失败时仅显示 toast 错误提示_
    - _Requirements: 1.2, 2.2, 3.4_

  - [x] 3.3 验证缺陷条件探索测试现在通过
    - **Property 1: Expected Behavior** - 成功保存后触发页面刷新
    - **重要**：重新运行任务 1 中的相同测试——不要编写新测试
    - 任务 1 中的测试编码了期望行为
    - 当此测试通过时，确认期望行为已满足
    - 通过代码审查验证：`edit-logo.tsx` 的 `saveChanges` 和 `removeLogo` 成功分支中现在包含 `router.refresh()` 调用
    - 通过代码审查验证：`edit-branding.tsx` 的 `toggleBranding` 成功分支中现在包含 `router.refresh()` 调用
    - **预期结果**：测试通过（确认缺陷已修复）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 验证保持性测试仍然通过
    - **Property 2: Preservation** - 现有刷新行为和错误处理路径保持不变
    - **重要**：重新运行任务 2 中的相同验证——不要编写新测试
    - 通过代码审查验证：`theme-styling.tsx` 未被修改，`onReset` 的 `router.refresh()` 和 `form.watch()` 实时预览行为不变
    - 通过代码审查验证：`edit-logo.tsx` 和 `edit-branding.tsx` 的错误处理路径未被修改
    - **预期结果**：所有保持性验证通过（确认无回归）
    - 确认所有测试在修复后仍然通过（无回归）

- [x] 4. 检查点 - 确保所有验证通过
  - 确保所有代码审查验证通过
  - 运行 `pnpm build` 确认构建无错误
  - 如有疑问，询问用户
