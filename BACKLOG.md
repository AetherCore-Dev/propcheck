# propcheck — Next Features Backlog (Priority Ordered)

> Generated: 2026-03-27 | Last Updated: 2026-03-31
> Principle: 按 **重要性 × 传播效果 × 用户体验** 排序，不考虑开发工作量
> 参考: 5 篇顶级论文 + 7 个成功 dev tool 的病毒传播模式 + 业内最新进展

---

## Tier S: 战略级定位升级 — 从检测工具到上线决策平台

### TS-1. Spec/Plan 驱动属性推断（解决"代码错了属性也错"的核心问题）
**优先级: ★★★★★ | 重要性: ★★★★★ | 差异化: ★★★★★**

> 当前 propcheck 从代码推断属性 — 如果代码有 bug，推断出的属性也会"配合"错误代码。
> Spec/Plan 代表用户意图，不被实现 bug 污染。这是解决 PGS 论文"自我欺骗循环"的关键。

- `propcheck infer --spec requirements.md src/cart.ts`
- 多源属性推断优先级:
  1. **Spec/PRD/Plan** (最高权威 — 用户说了要什么)
  2. **Type System + API Contract** (编译器保证)
  3. **Documentation / JSDoc** (开发者写的契约)
  4. **Code Implementation** (最低优先级 — 可能有 bug)
  5. **Domain Common Sense** (兜底检查)
- **冲突检测**: Spec 说 "非负" 但代码允许负数 → ⚠️ SPEC VIOLATION
- AI Coding 流程天然产出 Spec: Cursor/Claude Code 的 plan → 直接作为属性来源
- 参考: PGS 论文 "属性比代码更容易正确"

### TS-2. 意图确认机制（解决“用户意图违反常规”的问题）
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★**

> 用户故意要负价格（退款场景）但 LLM 推断 "result >= 0" → 假阳性。
> 需要一个确认环节让人类做最终判断。
> ✅ **部分完成**: `propcheck property --status` 已支持人工审核状态更新，`humanVerified` 标记区分人工决策与 LLM 推断。交互式确认模式待开发。

- `propcheck infer --confirm src/cart.ts` 交互式确认模式
- 每个属性展示来源 + 置信度 + 是否有冲突
- 冲突时提问: "Spec says non-negative, but code allows negative. Is this intentional?"
- 用户确认后标记 `human-verified` vs `llm-inferred`
- 反常意图检测: 金融函数返回负数、密码用 === 比较、排序不稳定 → 自动警告

### TS-3. Ship Confidence Score（从"找 bug"升级为"能不能上线"）
**优先级: ★★★★★ | 传播: ★★★★★ | 差异化: ★★★★★**

> 开发者真正要的不是"抓了几个 bug"，而是"这个代码能不能上线"。

- `propcheck run --confidence src/`
- 分 Tier 评估:
  - **Tier 1 (开源/side project)**: 80% 覆盖率 + 基本属性 = Ship ✅
  - **Tier 2 (SaaS/商业产品)**: 90% 覆盖率 + PBT 1000x + 变异 > 70% = Ship ✅
  - **Tier 3 (金融/支付)**: 上述 + fuzzing 10000x + 跨函数验证 = Ship ✅
  - **Tier 4 (医疗/航空)**: 上述 + 形式化验证 (SMT) = Ship ✅
- 输出: "Ship Confidence: 87% — Ready for SaaS deployment"
- 参考: DO-178C (航空), IEC 61508 (工业), ISO 26262 (汽车)

### TS-4. "Ship Confidence" 权威文章（零代码成本，立刻可做）
**优先级: ★★★★★ | 传播: ★★★★★ | 成本: 零**

> 写一篇深度文章建立 propcheck 在"上线决策"领域的权威性。

- 标题: "Ship Confidence: How Many Tests Do You Actually Need?"
- 内容: Tier 框架 + 行业标准引用 + propcheck 如何覆盖每个 Tier
- 发布: HN / Dev.to / Medium / Twitter thread
- 效果: 定义品类 = 拥有品类

---

## Tier 0: 传播引爆点 — 让每个看到的人都想试

### T0-1. PR Comment Bot（CodeRabbit 模式）
**优先级: ★★★★★ | 传播: ★★★★★ | 体验: ★★★★★**

> CodeRabbit 的核心增长策略：每条 PR 评论 = 品牌曝光。propcheck 必须复制这个模式。

- GitHub Action 在每个 PR 上自动评论 propcheck 结果
- 格式：
  ```
  ## 🔍 propcheck found 2 property violations

  | Property | Status | Details |
  |----------|--------|---------|
  | applyDiscount: result >= 0 | ❌ FAIL | Counterexample: discount=150 |
  | calculateTotal: total >= 0 | ✅ PASS | 1000/1000 |

  > Powered by [propcheck](https://github.com/AetherCore-Dev/propcheck) — AI property-based testing
  ```
- **每个 PR reviewer 都看到 propcheck 的名字** → 指数级传播
- 参考: 04-viral-launch-playbook.md §5 CodeRabbit 模式

### T0-2. 30 秒 GIF/视频 Demo
**优先级: ★★★★★ | 传播: ★★★★★ | 体验: ★★★★★**

> "Demo > 文档" 是 7 个成功工具的共识（Devin, bolt.new, v0.dev）

- 录制终端 GIF：`npx propcheck infer --mock src/cart.ts && npx propcheck run`
- 展示完整流程：推断属性 → 发现 bug → 最小反例 → 彩色输出
- 核心截图时刻：**"Coverage 100% but propcheck found 3 bugs"**
- 发布渠道：Twitter/X GIF + HN Show HN + README 嵌入
- 参考: 04-viral-launch-playbook.md — "输出即广告" 模式

### T0-3. Show HN Launch Post
**优先级: ★★★★★ | 传播: ★★★★★ | 体验: N/A**

> 标题："Show HN: I built a tool that finds bugs your 100% test coverage missed"

- 准备 HN 帖子：标题 + 描述 + `npx propcheck` 一行体验
- 准备回复 FAQ（"为什么不直接用 Hypothesis？" "LLM 会不会替代这个？"）
- 最佳发布时间：美国西海岸周二/周三上午 9-10 点
- 参考: 04-viral-launch-playbook.md §首批1000用户公式

---

## Tier 1: 核心体验 — 用过一次就离不开

### T1-1. 真实 Claude API 端到端验证
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★**

> 全部 mock 数据是手写的。核心假设 "LLM 推断精度 > 60%" 未验证。

- 用真实 Anthropic API 测 3 个 fixtures（cart-buggy, sort-utils, string-utils）
- 记录每个属性的质量：有意义/废话/假阳性/编译失败
- 目标精度: > 60% 有意义 = GO, < 40% = 回头优化 prompt
- 这决定了产品的生死 — 所有后续功能建立在这个地基上
- 参考: Agentic PBT 56% 整体精度, 86% Top-21

### T1-2. `propcheck fix` — 双 Agent 自动修复（PGS 论文）
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★★**

> 发现 bug + 自动修复 = 完整闭环。这是 propcheck 最强的 "wow moment"。

- 流程：propcheck run → 发现属性违反 → propcheck fix
  - Tester Agent: 验证属性违反 + 最小反例
  - Generator Agent: 基于反例 + 属性生成修复 diff
  - 验证: 修复后所有现有属性仍然通过
- 核心洞察 (PGS 论文): **属性比代码更容易正确** → 用属性验证修复
- 最小反例最有效: shrinking 后的 counterexample 产生最好的修复（+2.4%）
- 参考: 12-top5-papers §论文2 PGS 双 Agent 架构

### T1-3. 跨函数属性推断
**优先级: ★★★★ | 重要性: ★★★★★ | 体验: ★★★★**

> 当前只推断单函数属性，但真正有价值的是跨函数关系。

- 新属性类型：
  - `addToCart() 后 getTotal() 应该增加`
  - `withdraw(amount) + deposit(amount) 的总额守恒`
  - `serialize(x) 后 deserialize() 还原`
- 在 prompt 中添加 cross-function 上下文（同模块的其他函数签名）
- 参考: ClassInvGen 的类不变量 = 跨方法属性
- 参考: 08-propcheck-technical-deepdive §1.2 属性模式

### T1-4. Community Property Templates（护城河核心）
**优先级: ★★★★ | 传播: ★★★★★ | 重要性: ★★★★★**

> 护城河在生态不在技术。eslint-config-airbnb 几千万下载 = 社区规则 > 技术壁垒。

- `@propcheck/express-api` — Express 路由属性（status codes, CORS, 中间件顺序）
- `@propcheck/react-hooks` — React hooks 属性（返回稳定引用, 清理副作用）
- `@propcheck/financial` — 金融计算属性（精度, 四舍五入, 非负, 守恒）
- `@propcheck/auth` — 认证属性（token 格式, 过期检查, 密码强度）
- 用户可以用 `propcheck init --template express` 一键导入
- 模板注册表（类似 Semgrep 的社区规则市场）
- 参考: 04-viral-launch-playbook §6 Semgrep 社区规则飞轮
- 参考: 05-direction-comparison — L3 数据飞轮 → L4 生态锁定

---

## Tier 2: 精度跃升 — 从 "能用" 到 "好用"

### T2-1. 符号执行快速路径（Concolic Hybrid）
**优先级: ★★★★ | 重要性: ★★★★★ | 体验: ★★★★**

> 对简单数值函数，数学推导比跑 1000 次随机值快且精确。

- Layer 1 (当前): 纯随机 PBT → 1000 次, 0.3 秒
- **Layer 2 (新): 符号执行快速路径**
  - 对 `price * (1 - discount / 100)` 类函数
  - 直接求解: `P > 0 且 D > 100 → 负价格` → 一步找到边界
  - 不需要跑 1000 次, 精确算出反例
- Layer 3 (新): Concolic 混合执行
  - 具体执行 + 符号追踪分支条件
  - 翻转分支 → 求解器找到触发新路径的输入
  - 覆盖率 100% 路径保证
- 参考: 08-propcheck-technical-deepdive §5.4-5.5
- 参考: JetBrains TestSpark (LLM + 符号执行 + SBST 混合)

### T2-2. Coverage-Guided Fuzzing（覆盖率引导）
**优先级: ★★★★ | 重要性: ★★★★ | 体验: ★★★**

> 纯随机 vs 覆盖率引导 = 14.7% 行覆盖率提升（FUEL 论文）

- 用 c8/istanbul 收集代码覆盖率
- 保留触达新代码路径的输入 → 基于这些输入变异 → 探索更深分支
- 语料库持久化到 `.propcheck/corpus/`（已有框架，需激活）
- 参考: 08-propcheck-technical-deepdive §5.3
- 参考: FUEL 论文 +14.7% 覆盖率

### T2-3. Best-of-N 采样（Quokka 论文）
**优先级: ★★★ | 重要性: ★★★★ | 体验: ★★★**

> 生成 N 个候选属性，选最好的。简单但有效。

- 对每个函数调 LLM 3 次（temperature 略不同）
- 合并去重 → 评分排序 → 取 top-K
- Quokka 数据: 多样性显著提升验证成功率
- 成本: 3x token 但精度提升 15-20%
- 参考: 12-top5-papers §论文5 Quokka Best-of-N

### T2-4. 多源信号融合增强
**优先级: ★★★ | 重要性: ★★★★ | 体验: ★★★**

> 单一 LLM 读代码 → 56% 精度。多源融合 → 75%+。

- 信号源 1: AST 结构（已有 ✅）
- 信号源 2: 类型系统（已有 ✅）
- 信号源 3: Docstring（已有 ✅）
- **信号源 4: 命名启发（新）** — "price" → >= 0, "sort" → 有序, "count" → 整数
- **信号源 5: 运行时采样（新）** — 对函数执行 5-10 个简单输入，观察输出模式
- 参考: 08-propcheck-technical-deepdive §10.3 多源信号融合
- 参考: ClassInvGen 多源信号 → 100% 精度

---

## Tier 3: 产品完整度 — 从工具到平台

### T3-1. VS Code Extension
**优先级: ★★★ | 传播: ★★★★ | 体验: ★★★★★**

> IDE 内联 > CLI 输出。VS Code Marketplace = 分发渠道。

- CodeLens: 函数上方显示 `3 properties | 2 passed | 1 failed`
- Gutter icons: 绿色 ✓ / 红色 ✗
- 点击跳转到 counterexample
- Quick Fix: `propcheck fix` 一键修复
- 诊断面板集成（Problems tab）
- 参考: 04-viral-launch-playbook §寄生已有平台 (VS Code Marketplace)

### T3-2. HTML 报告（Stryker 模式）
**优先级: ★★★ | 传播: ★★★ | 体验: ★★★★**

> CLI 输出无法分享，HTML 报告可嵌入 CI artifact。

- `propcheck run --report` → 生成 `.propcheck/reports/2026-03-27.html`
- 内容: 属性列表 + 通过率 + counterexample + 变异测试得分
- 可作为 GitHub Actions artifact 下载查看
- 参考: Stryker 的 HTML mutation report

### T3-3. SMT 形式化验证（Quokka 进化路径）
**优先级: ★★★ | 重要性: ★★★★★ | 体验: ★★★**

> PBT = "很可能正确", SMT = "数学证明正确, 零误报"

- 简单属性（纯算术） → 尝试 Z3 SMT solver 证明
  - 检查: Init ∧ Inv, Inv ∧ Body → Inv', Inv ∧ ¬Cond → Post
- 成功 → 标记 `✓ Formally Verified` (零误报保证)
- 失败 → fall back to PBT (经验测试)
- `propcheck verify src/cart.ts` 新命令
- 参考: Quokka 论文 100% 正确性 (SMT 保证)
- 参考: 08-propcheck-technical-deepdive §10.7 形式化验证升级路径

### T3-4. Rust/Go 引擎适配
**优先级: ★★★ | 传播: ★★★ | 重要性: ★★★**

> "多语言是市场空白" — 07-propcheck-landscape 确认

- Rust: proptest 引擎适配（EngineAdapter 接口已有）
- Go: rapid 库适配
- 复用已有: parser 加 Rust/Go 提取器, codegen 加新模板
- 参考: 07-propcheck-landscape Gap 2 — 几乎所有 LLM+PBT 仅限 Python

### T3-5. `propcheck scan` — 扫描知名 npm 包找 bug
**优先级: ★★ | 传播: ★★★★★ | 重要性: ★★**

> "I found 47 bugs in popular npm packages using AI property testing" → HN 爆款

- 对 top 100 npm 包运行 propcheck
- 汇总发现的 bug → 博客文章 / HN 帖子
- 提交 PR 到开源项目（如 Agentic PBT 对 NumPy 提交了 patch）
- 最强 marketing: 真实 bug 发现 > 任何宣传
- 参考: Agentic PBT 合入 NumPy patch, FUEL 14 CVE

---

## Tier 4: 长期护城河 — 从产品到生态

### T4-1. 属性市场（Semgrep 模式）
**优先级: ★★ | 传播: ★★★★ | 重要性: ★★★★★（长期）**

- `propcheck.dev/registry` — 社区属性注册表
- 用户分享/下载属性模板
- 按框架/领域/语言分类
- 评分/下载排名
- 参考: Semgrep 社区规则注册表

### T4-2. 小模型微调（降成本）
**优先级: ★★ | 重要性: ★★★ | 体验: ★★★**

- 在成功的 (代码, 属性) 对上微调小模型
- 从 Claude Sonnet ($3/1M input) → 微调 Haiku ($0.25/1M)
- Quokka 数据: 微调后所有模型家族均有提升
- 参考: 12-top5-papers §论文5 Quokka SFT

### T4-3. Agent 代码验证模式
**优先级: ★★ | 传播: ★★★ | 重要性: ★★★**

- agent-verify 作为 propcheck 的衍生功能
- `propcheck verify-agent --diff HEAD~1` — 验证 AI agent 生成的代码是否满足已有属性
- 参考: 05-direction-comparison — agent-verify 保留为衍生功能

---

## 执行路线图

```
本周 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TS-4 "Ship Confidence" 文章    ← 零代码成本，立刻建立权威
  T0-1 PR Comment Bot            ← 传播引爆
  T0-2 30秒 GIF Demo             ← 传播素材

下周 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TS-1 Spec/Plan 驱动属性推断    ← 解决核心可靠性问题
  T0-3 Show HN Launch            ← 首批 1000 用户
  T1-1 真实 API 测试             ← 核心验证

第 2-3 周 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TS-2 意图确认机制              ← 消除假阳性
  TS-3 Ship Confidence Score     ← 定位升级
  T1-2 propcheck fix             ← 完整闭环
  T1-3 跨函数属性                ← 深层价值

第 4-6 周 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  T3-1 VS Code Extension       ← 产品完整
  T3-3 SMT 形式化验证          ← 零误报
  T3-5 扫描 npm 包找 bug       ← 爆款内容
```

---

## 论文 → 功能映射表

| 论文 | 核心技术 | 对应功能 | 状态 |
|------|---------|---------|------|
| Agentic PBT (Anthropic) | 6步 Cycle + 15点评分 | T1-1 真实 API 测试 | 待验证 |
| PGS (北航) | 双 Agent + 最小反例 | T1-2 propcheck fix | 待开发 |
| ClassInvGen (Stanford) | Co-gen + 变异测试 + 跨方法 | T1-3 跨函数属性 + P2 变异测试 ✅ | 部分完成 |
| FUEL (南京大学) | 反馈闭环 + 覆盖率引导 | T2-2 Coverage-Guided + P1 Refinement ✅ | 部分完成 |
| Quokka (Stanford/SRI) | SMT 验证 + Best-of-N + 微调 | T2-3 + T3-3 + T4-2 | 待开发 |

## 病毒传播 → 功能映射表

| 成功工具模式 | 对应功能 | 状态 |
|-------------|---------|------|
| CodeRabbit: PR 评论即分发 | T0-1 PR Comment Bot | 待开发 |
| Devin/bolt.new: Demo 即广告 | T0-2 GIF Demo | 待制作 |
| Socket.dev: 创始人文章爆 HN | T0-3 Show HN Launch | 待发布 |
| Semgrep: 社区规则飞轮 | T1-4 Templates + T4-1 市场 | 待开发 |
| Cursor: 零迁移成本 | ✅ `npx propcheck run` 已实现 | 完成 |
| Codecov: Badge 传播 | ✅ `propcheck badge` 已实现 | 完成 |
| Human-in-the-loop: 人工审核 | ✅ `propcheck props` + `propcheck property --status` | 完成 |
| v0.dev: 寄生平台分发 | T3-1 VS Code Marketplace | 待开发 |
