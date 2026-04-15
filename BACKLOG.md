# propcheck — Next Features Backlog (Priority Ordered)

> Generated: 2026-03-27 | Last Updated: 2026-04-11
> Principle: 按 **重要性 × 传播效果 × 用户体验** 排序，不考虑开发工作量
> 参考: 5 篇顶级论文 + 7 个成功 dev tool 的病毒传播模式 + 业内最新进展

---

## Now: 已完成的基础能力（2026-04-11）

> ✅ 第一阶段地基能力已经补齐：**可信度、首次成功率、问题定位效率、spec 驱动推断、fix hardening、Ship Confidence v1** 已落地。
> 接下来不再重复投入同类基础修补，优先转向 **意图确认、跨函数属性、传播分发、模板生态**。

### P0. 可信度基础设施（质量门禁先行） ✅ 已完成
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★★**

> ✅ 已完成 (2026-04-11): 统一测试入口、lint gate、coverage threshold、CI 收敛与全量验证流程已上线。

> 如果结果不稳定、门禁不完整，用户不会信 propcheck，团队也不敢把它接进 PR / CI。

- 当前痛点:
  - CI 里的测试文件清单是手写维护，容易漏测、改名即坏
  - coverage job 维护了第二份测试清单，重复构建、重复安装
  - 根脚本定义了 `lint`，但 CI 没有真正执行
  - coverage 已采集，但没有 threshold gate，无法把“可信度”转成硬约束
- 代码证据:
  - `.github/workflows/ci.yml`
  - `package.json`
- 拆解:
  - **P0-1. 统一测试入口 / 自动发现测试**
    - 目标：不再在 CI 手写每个测试文件路径
    - 产出：单一 test 入口，可同时用于本地、CI、coverage
  - **P0-2. 把 lint 纳入 CI 质量门禁**
    - 目标：类型正确之外，风格/明显问题也能阻断
    - 产出：CI 增加 lint job 或 lint step，失败即阻断
  - **P0-3. 增加 coverage threshold**
    - 目标：把“有 coverage 报告”升级为“coverage 不达标即失败”
    - 产出：设定最小阈值，并给出清晰失败提示
  - **P0-4. 收敛重复构建与重复测试清单**
    - 目标：减少 CI 维护面和重复成本
    - 产出：build/test/coverage 共用同一套入口与配置
- 完成标准:
  - 新增测试无需修改 CI 文件中的路径列表
  - lint/coverage 成为明确 gate
  - CI 失败原因对贡献者可读

### P1. 首次运行体验（让用户第一次就跑出价值） ✅ 已完成
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★★**

> ✅ 已完成 (2026-04-11): CLI help、`check` 定位、首次成功后的 next step、安装/缺依赖提示已显著增强。

> propcheck 的增长前提不是“功能很多”，而是用户第一次执行就理解它、信任它、看到价值。

- 当前痛点:
  - `propcheck --help` 缺少 Quick Start 和推荐工作流示例
  - `check` 是最佳一键入口，但用户容易误解它与真实 AI 推断的边界
  - peer dependency / setup 错误信息可用，但还不够像“上手引导”
- 代码证据:
  - `packages/cli/src/index.ts`
  - `packages/cli/src/commands/check.ts`
- 拆解:
  - **P1-1. 重写 CLI help 的首次引导层**
    - 目标：用户只看 `--help` 就知道先跑什么、再跑什么
    - 产出：Quick Start、常见命令流、mock vs real AI 的说明
  - **P1-2. 明确 `check` 与 `infer/run` 的产品分层**
    - 目标：零配置体验与真实能力演示不再混淆
    - 产出：命令描述、输出文案、成功后 next step 指引
  - **P1-3. 提升安装/缺依赖/版本错误提示**
    - 目标：把报错从“失败信息”变成“修复指南”
    - 产出：更清晰的依赖说明、Node/TypeScript/fast-check 场景提示
  - **P1-4. 优化首次成功后的反馈**
    - 目标：让用户在第一次成功后知道下一步怎么把 propcheck 用起来
    - 产出：从 `check` 过渡到 `infer` / `run` / `props` / `fix` 的行动建议
- 完成标准:
  - 用户只看 CLI 帮助即可完成首次体验
  - `check` 的定位不会再被误解为“真实推断全流程”
  - 常见 setup 错误能直接指导下一步修复动作

### P2. 配置可观测性与诊断（让问题能被快速解释） ✅ 已完成
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★**

> ✅ 已完成 (2026-04-11): `propcheck config show`、`propcheck doctor`、配置来源可见性与诊断输出已落地。

> 当用户不知道当前到底使用了哪个 provider、哪个 key、哪个配置来源时，任何“AI 不稳定”都会被放大成产品不可信。

- 当前痛点:
  - 配置来源有优先级链，但对用户不可见
  - `.propcheckrc` 配置错误只给 warning，默认回退容易被忽略
  - 缺少统一的 `config show` / `doctor` 诊断入口
- 代码证据:
  - `packages/config/src/loader.ts`
- 拆解:
  - **P2-1. 新增 `propcheck config show`**
    - 目标：展示最终生效配置，以及来源（CLI / env / rc / default）
    - 产出：可机器读、也可人类快速阅读的配置视图
  - **P2-2. 新增 `propcheck doctor`**
    - 目标：快速检查 API key、provider、baseURL、storeDir、mock mode 等是否就绪
    - 产出：一条命令给出诊断、警告和修复建议
  - **P2-3. 强化配置错误可见性**
    - 目标：避免 silent fallback 造成“我明明配了为什么没生效”
    - 产出：更醒目的 warning / error 分级，以及具体来源说明
  - **P2-4. 展示 provider/key 解析路径**
    - 目标：当同时存在多个环境变量时，用户知道系统最终选择了什么
    - 产出：明确的解析顺序与最终选中结果
- 完成标准:
  - 用户可自助回答“当前用了什么配置、为什么这样解析”
  - 配置问题能在 CLI 内快速定位，无需翻源码

---

## Next: 后基础阶段代码优先级（2026-04-12 refresh）

1. **TS-2 意图确认机制** — 在 v1 人工确认基础上继续降低 spec / domain / human intent 冲突带来的假阳性。
2. **T0-2 GIF / Demo / Show HN** — 补齐最强分发素材与传播资产。
3. **T1-4 Community Property Templates** — 在 v1 live template seeding 基础上继续扩展模板目录、导入体验与注册表能力。
4. **T2-2 Coverage-guided fuzzing** — 继续拉高覆盖深度与 bug 发现率。
5. **T3-4 Rust/Go 引擎适配** — 在多语言方向继续扩大 propcheck 的差异化护城河。

---

## Tier S: 战略级定位升级 — 从检测工具到上线决策平台

### TS-1. Spec/Plan 驱动属性推断（解决"代码错了属性也错"的核心问题） ✅ 已完成
**优先级: ★★★★★ | 重要性: ★★★★★ | 差异化: ★★★★★**

> ✅ 已完成 (2026-04-11): `propcheck infer --spec <file>`、spec parser、evidence source、spec conflict 检测与相关测试已落地。
> 当前 propcheck 已支持把外部 spec / plan 作为高优先级意图来源，不再只盯着实现代码本身。

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
> ✅ **v1 已完成** (2026-04-11): `propcheck property --status` 和 `propcheck infer --confirm` 均支持人工审核并写入 `humanVerified`；`--confirm` 流程会显示 `evidenceSource`、友好的冲突标签和 Review note 提示，让用户在确认前看到冲突。
> ✅ **v2 第一阶段已完成** (2026-04-12): 冲突属性现在必须显式输入 `(i)ntentional` 才能接受，`accept-all` 只会自动接受安全属性，遇到 spec/doc conflict 仍会停下来要求人工确认。

- `propcheck infer --confirm src/cart.ts` 交互式确认模式
- 每个属性展示来源 + 置信度 + 是否有冲突
- 冲突时提问: "Spec says non-negative, but code allows negative. Is this intentional?"
- 用户确认后标记 `human-verified` vs `llm-inferred`
- 反常意图检测: 金融函数返回负数、密码用 === 比较、排序不稳定 → 自动警告

#### TS-2 方案选择（2026-04-13 设计结论）

**方案2：规范一致性门禁（Forward Canonical Intent Gate）**
- 先由 AI 从人类的高层目标 / 约束 / 粗验收标准中提炼最小权威意图，再检查 spec / plan / code / tests / properties 是否覆盖并遵守它。
- 适用：规则明确、运行态复杂度不高、主要风险是“漏做需求”而不是“运行后语义跑偏”的系统。
- 优点：逻辑清晰、成本低、容易做 release gate。
- 局限：如果 AI 一开始提炼权威意图就偏了，后续产物可能在错误理解上保持高度一致，方案2本身不容易发现这种“前向自洽偏差”。

**方案3：规范门禁 + 独立行为验证层（Dual-Loop Intent Alignment）**
- 保留方案2的权威意图门禁，但额外加入独立行为证据：property/fuzzing、mutation、e2e 场景演练、fault injection、replay、security simulation 等。
- 核心不是“再让 AI 反向读一遍代码”，而是“让系统真实跑起来、被折腾后，再判断最终行为语义是否仍然对齐权威意图”。
- 适用：支付、权限、安全、并发/重试/回退链路、AI agent workflow 等高运行态风险系统。
- 优点：能发现方案2较难稳定发现的问题——例如运行时语义偏移、入口绕路、silent fallback、幂等失败、AI 自证正确等。
- 代价：成本更高；如果没有独立行为验证层，方案3会退化成“方案2 + 更花哨解释层”，价值明显下降。

**reverse intent extraction 的定位**
- 不是方案3成立的根基，而是增强件。
- 主要价值：把 fuzzing / mutation / e2e / security 演练发现的原始异常，压缩解释成更高层的语义偏差，例如“退款金额语义偏移”“权限旁路模型已形成”“失败契约不一致”。
- 结论：没有独立行为证据时，reverse extraction 价值有限；有独立行为证据时，它非常适合作为解释器、归因器、告警压缩器。

**当前推荐路线**
1. 先把方案2做扎实：权威意图提炼、覆盖检查、冲突检查。
2. 在已有 `propcheck verify` + property/fuzzing/mutation 基础上，渐进式接入方案3。
3. 方案3第一优先级不是“全量反向意图系统”，而是“基于运行结果的语义归因和高价值 delta 压缩”。

### TS-3. Ship Confidence Score（从"找 bug"升级为"能不能上线"） ✅ v1 已完成
**优先级: ★★★★★ | 传播: ★★★★★ | 差异化: ★★★★★**

> ✅ 已完成 v1 (2026-04-11): `propcheck confidence [target]` 已支持基于 readiness / staleness / validation / human verification / risk / spec-backed evidence 输出文本与 JSON 评分。
> 下一步可继续接入 mutation / formal verification，把 Tier 3→4 的信号做得更强。

- `propcheck confidence src/`
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

### T0-1. PR Comment Bot（CodeRabbit 模式） ✅ v1 已完成
**优先级: ★★★★★ | 传播: ★★★★★ | 体验: ★★★★★**

> ✅ 已完成 v1 (2026-04-12): `propcheck run --github-comment <target>` 已可输出 GitHub PR comment Markdown，包含 summary、属性状态表、失败反例与 seed，能够直接作为 PR 评论基础内容。
> 下一步可继续补齐 GitHub Action 自动发布与多文件聚合评论。

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

### T1-1. 真实 Claude API 端到端验证 ✅ 已完成
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★**

> ✅ 已完成 (2026-03-31~04-01): price-utils.ts 15/15 属性全部 PASS。ag402 真实项目 3/3 属性 PASS (1000/1000)。
> 核心验证通过：LLM 推断精度 > 60% — GO。
> 对象 generator 映射、ESM .cjs 兼容、missing_precondition 自动弱化均已实现并验证。

### T1-2. `propcheck fix` — 双 Agent 自动修复（PGS 论文） ✅ 基础闭环已完成
**优先级: ★★★★★ | 重要性: ★★★★★ | 体验: ★★★★★**

> ✅ 已完成 fix hardening v1 (2026-04-11): verification retry、更干净的 JSON 输出、`--apply` 备份路径、更强测试覆盖已落地。
> 下一阶段再继续深化双-agent 修复质量与更激进的 live/provider 路径验证。

- 流程：propcheck run → 发现属性违反 → propcheck fix
  - Tester Agent: 验证属性违反 + 最小反例
  - Generator Agent: 基于反例 + 属性生成修复 diff
  - 验证: 修复后所有现有属性仍然通过
- 核心洞察 (PGS 论文): **属性比代码更容易正确** → 用属性验证修复
- 最小反例最有效: shrinking 后的 counterexample 产生最好的修复（+2.4%）
- 参考: 12-top5-papers §论文2 PGS 双 Agent 架构

### T1-3. 跨函数属性推断 ✅ v1 已完成
**优先级: ★★★★ | 重要性: ★★★★★ | 体验: ★★★★**

> ✅ 已完成 v1 (2026-04-11): live infer/refine 流程现在会把 sibling function 上下文传给 prompt；属性模型、parser、mock/adaptive inference 与 fast-check codegen 已支持 `relatedFunctions`，可以表达 `decode(encode(x))` 这类跨函数关系；相关回归测试与全量验证已通过。
> 当前 propcheck 不再只局限于单函数属性，已经具备跨函数 roundtrip / inverse 关系的基础闭环。

- 新属性类型：
  - `addToCart() 后 getTotal() 应该增加`
  - `withdraw(amount) + deposit(amount) 的总额守恒`
  - `serialize(x) 后 deserialize() 还原`
- 在 prompt 中添加 cross-function 上下文（同模块的其他函数签名）
- 参考: ClassInvGen 的类不变量 = 跨方法属性
- 参考: 08-propcheck-technical-deepdive §1.2 属性模式

### T1-4. Community Property Templates（护城河核心） ✅ v1 已完成
**优先级: ★★★★ | 传播: ★★★★★ | 重要性: ★★★★★**

> ✅ 已完成 v1 (2026-04-12): community templates 现在会自动 seed live inference（spec 模式除外），不再只在 `--mock` fallback 中生效；新增 `discounting` / `surcharge` 金融模板域，并使用 qualified targetFunction 持久化；相关回归测试与全量验证已通过。
> 下一步可继续扩展 `@propcheck/express-api` / `react-hooks` / `auth` 风格模板，以及 `init --template` / 注册表分发能力。

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

### T3-3. SMT 形式化验证（Quokka 进化路径） ✅ v1 已完成
**优先级: ★★★ | 重要性: ★★★★★ | 体验: ★★★**

> v1 先交付 `propcheck verify` 的分层验证入口：执行属性、跑 mutation score、汇总 confidence，为后续 SMT / Tier 4 证明路径打底。

- ✅ `propcheck verify <target>` 新命令
- ✅ 默认走 thorough verification，并支持 `--quick` / `--seed` / `--json`
- ✅ 聚合 run + mutation testing + confidence 三类信号，统一输出验证状态与 next steps
- ✅ 明确暴露 `formalVerification.status = not_attempted`，避免把经验验证误报成数学证明
- 后续 v2:
  - 简单属性（纯算术） → 尝试 Z3 SMT solver 证明
    - 检查: Init ∧ Inv, Inv ∧ Body → Inv', Inv ∧ ¬Cond → Post
  - 成功 → 标记 `✓ Formally Verified` (零误报保证)
  - 失败 → fall back to PBT (经验测试)
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

## 执行路线图（刷新后）

```
已完成 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  P0 / P1 / P2 基础优化         ← 质量门禁、首次体验、config/doctor
  TS-1 Spec/Plan 驱动推断       ← infer --spec + spec conflict
  TS-2 意图确认机制 v1          ← humanVerified + confirm review flow
  T0-1 PR Comment Bot v1        ← GitHub-ready Markdown comment output
  T1-2 fix hardening v1         ← safer fix loop + JSON/apply/test coverage
  T1-3 跨函数属性 v1            ← sibling context + relatedFunctions + codegen
  T1-4 Community Templates v1   ← live template seeding + financial domains
  TS-3 Ship Confidence v1       ← confidence command + report
  T3-3 propcheck verify v1      ← layered verification command + unified verify report

下一阶段 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TS-2 意图确认机制 v2          ← 冲突问答与异常意图检测深化
  T0-2 GIF / Demo / Show HN     ← 内容传播资产
  T1-4 Templates v2             ← init/template import + registry 扩展
  T2-2 Coverage-guided fuzzing  ← 精度和深度覆盖继续提升

后续阶段 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  T3-4 Rust/Go 引擎适配         ← 多语言方向扩展
  T2-3 Best-of-N sampling       ← 多候选筛选提升命中率
  T3-1 VS Code Extension        ← IDE 内联体验
  T3-2 HTML report              ← 可分享的可视化验证结果
```

---

## 论文 → 功能映射表

| 论文 | 核心技术 | 对应功能 | 状态 |
|------|---------|---------|------|
| Agentic PBT (Anthropic) | 6步 Cycle + 15点评分 | T1-1 真实 API 测试 | 完成 |
| PGS (北航) | 双 Agent + 最小反例 | T1-2 propcheck fix | 部分完成 |
| ClassInvGen (Stanford) | Co-gen + 变异测试 + 跨方法 | T1-3 跨函数属性 + P2 变异测试 ✅ | 部分完成 |
| FUEL (南京大学) | 反馈闭环 + 覆盖率引导 | T2-2 Coverage-Guided + P1 Refinement ✅ | 部分完成 |
| Quokka (Stanford/SRI) | SMT 验证 + Best-of-N + 微调 | TS-3 v1 + T2-3 + T3-3 + T4-2 | 部分完成 |

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
