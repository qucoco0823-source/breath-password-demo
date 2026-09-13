# 呼吸即密码 → 呼吸守护（无声呼吸健康哨兵）

这个仓库现在包含**两个独立模式**，共用同一套音频采集与分段：

- **健康模式（主方向，默认）** — 面向老年用户的呼吸状态趋势提示。用麦克风采集自然呼吸，建立个人基线，发现持续变化，用视觉、颜色、动画和照护提醒回应。首次创建本机用户时填写昵称，之后测量不需要打字。定位是「趋势提示」，不是医疗诊断。
- **呼吸即密码（技术对照，保留）** — 用吹气节奏做行为认证。保留作旧模式，逻辑一行未动。

两种模式的算法层是**隔离**的：密码模式用 `src/algo/`（速度归一化 + DTW），健康模式用 `src/health/`（绝对毫秒，不归一化）。为什么不能共用，见 `src/health/schema.js` 顶部。

**健康模式当前版本没有任何临床验证，不能诊断任何疾病。** 它能回答的只有一个问题：「这次呼吸和你自己平时相比，变了没有。」

---

## 快速开始

```bash
cd C:\Users\13640\Desktop\breath-password\breath-merged
npm install
npm run dev -- --port 5175  # → http://localhost:5175/（默认进健康模式）
npm test         # 350 项
npm run build    # → dist/
```

- 健康模式默认打开。首次输入昵称创建本机用户；下次打开或刷新时，在「以往用户」选择并继续追踪。注册时不强制连续录满三次；每次合格测量自动累积，三次后形成初步个人基线。可在研究模式导出、清空或删除当前用户记录。昵称不是登录凭证，本机其他使用者可能看到记录。要进密码模式：点底部「研究模式 → 打开呼吸即密码」，或访问 `/?mode=password`。
- **不用麦克风的演示**：健康模式首页点「看演示（不用麦克风）」——合成信号走完整管线，展示 基线 → 稳定 → 复测 → 关注 → 恢复 全流程，以及「呼吸声太轻 → 测不准」的兜底。
- **CAREUP 参考数据演示**：首页点「参考数据演示」，选择稳定趋势、持续偏离或数据中断，再点「播放趋势」。展示的呼吸率来自三个不同匿名参与者的真实短片段；活动、体位和疾病状态未知，不能视作诊断或老人的静息基线验证。
- 浏览器用 Chrome / Edge。麦克风需要安全上下文，`localhost` 可直接用；手机测试需要 HTTPS。

### 重新生成 CAREUP 演示数据

原始文件只放在 `datasets/careup-ic/meas_respiration_rate.csv`，不会被 Vite 打包，且已被 `.gitignore` 排除。运行 `npm run data:careup` 后，脚本会从真实记录中选出三个场景，输出 `src/demo-data/careup-demo.json`。它只保留匿名代号、替换后的演示时间和每分钟呼吸率。中断点来自真实时间缺口，没有编造呼吸率；若源 CSV 不存在或找不到三个场景，命令会清楚报错。

### AI 解释（可选，不接也能跑）

健康模式的**状态判定完全在本地**，不依赖网络。AI 只负责把结果翻译成一句人话，可选接入：

```bash
# 服务端设置 API Key（Node 侧，绝不进浏览器）
# Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..." 后 npm run dev
# 或 Linux/macOS:      ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

- 没配 Key 时，本地文案照常工作，界面如实标注「AI 未参与」。
- Key 只存在于服务端 `process.env`，前端只请求 `/api/analyze-state`。构建产物里没有 Key（有静态检查锁住）。
- AI 无权决定状态、无权输出诊断，服务端与客户端各有一道疾病词拦截。

---

## 运行

```bash
cd C:\Users\39759\breath-merged   # 所有命令都必须在项目目录里跑
npm install
npm run dev      # → http://localhost:5173
npm test         # 256 项
npm run build    # → dist/
```

浏览器用 Chrome / Edge，允许麦克风。麦克风需要安全上下文，`localhost` 可直接用；手机测试需要 HTTPS。

演示顺序：**注册节奏 → 换一个不同节奏（应被拒绝）→ 回到原节奏（应通过）**。

---

## 三方分工

```
麦克风 ──→ 人1 src/audio/ ──→ 人2 src/algo/ ──→ 人3 src/App.jsx
           声音 → 片段时长      片段时长 → 匹配     界面与流程
                        └── src/breath.js 翻译 ──┘
```

| 目录 | 负责人 | 职责 |
|---|---|---|
| `src/audio/` | 人1 | 麦克风采集、带通滤波、包络、双门限分段、质量诊断。不做匹配。 |
| `src/algo/core.js` | 人2 | DTW 匹配、阈值、模板。纯函数，不碰麦克风。 |
| `src/algo/bridge.js` | 人2 | 人1 输出 → 人2 输入 的唯一转换点。 |
| `src/breath.js` | — | 接口适配层，让 App.jsx 不用改一行。 |
| `src/App.jsx` | 人3 | 界面、动画、流程。 |

`src/breath.legacy.js` 是人3原来自带的一套实现，保留作对照，不参与构建。

---

## 两处关键对接

**1. 用 `robustDurationsMs`，不用 `durationsMs`。**

人1 输出两组序列。`durationsMs` 含吸气时长，但吸气声很轻，能否检出取决于坐姿与嘴到麦克风的距离，两次录音之间不可重复。`robustDurationsMs` 只含呼气与间隙，完全不经过吸气检测。匹配必须用后者。

fixture 数据直接证明了这一点：`alice-login` 的吸气是 `[258, 213, 264]`，`alice-faint-inhale` 是 `[0, 0, 0]`（全部漏检），而两者只用呼气与间隙时距离仅 **0.0481**，远低于阈值 0.25。

**2. 两边的配对语义天然一致。**

人1 的 `robustDurationsMs = [呼气, 间隙, 呼气, 间隙…]`，人2 的 `shapeOf` 需要 `[{duration, gapAfter}…]`。都是「有声时长 + 其后静音」，转换不需要任何假设。

---

## 整合时改的两处算法

**`MIN_SEGMENTS` 4 → 3。** 人1 的音频管线输出里，用户吹 4 次气、尾部那次往往不完整而被丢弃（`meta.flags` 会带 `DROPPED_INCOMPLETE_TAIL`），10 个 fixture 全部只剩 3 个配对。保持 4 会把它们一个不剩地拒绝。代价：3 段的可区分信息比 4 段少。想更严应该在文案里要求吹 5 次，而不是抬高这个下限——抬高只会让本人也录不进去。

`MIN_SEGMENTS` 计的是**有声片段数**，也等于**配对数**（不是 n−1）。尾段由人1 丢弃，桥接层不再丢第二次。语义由 `test/segments.test.mjs` 锁定。

**Sakoe-Chiba 半径下限 2 → 1。** `n=3` 时半径 2 覆盖 3×3 的全部格子，带约束形同不存在。修正后长短反转仍有明显代价（0.3819）。对 `n≥4` 无影响。

---

## 算法

```
麦克风 → 带通 300–6kHz → 10ms 帧 RMS → 双门限分段 → 边界精修(-10dB)
      → [呼气, 间隙] 配对 ÷ 片段时长中位数
      → DTW（带约束，按路径步数归一化）
      → 距离 = 形状距离 + 0.6 × |log(节拍比)|
      → 距离 ≤ 0.25 → 通过
```

判定一律看**原始距离**。界面的"匹配分"只是距离的单调换算，**不是概率，也不是"是本人的可能性"**。

阈值 `0.25` 是固定全局值，标注为**待真人验证**。不按用户自标定：3 样本的 `intraMax` 变异系数 30–34%，自标定在每一档抖动上都更差。

程序只能分辨"有声 / 无声"，**不区分气流方向**。界面只报告"有声片段 / 间隔"。

---

## 已知边界

以下来自**合成实验**（`experiments/`），不是真人测量：

- 「跨人-同模式」与「本人」的距离分布大幅重叠（均值比 1.41x，EER 33%）。同一节奏下本人与他人几乎无法区分。**本方法主要识别"选了哪个节奏"，不识别"是谁"。**
- 旁观后模仿同一节奏有相当概率通过——就像别人看着你输密码。
- 预设模式集合 8 种 ≈ 3 bit，是**集合大小的估算，不是测得的系统容量**。
- 演示时**不要**承诺"换人必被拒绝"，也不要说"换个速度也进不来"（出厂阈值下变速攻击会通过）。

**真人数据一条都没有。** 所有 FRR / FAR 都待验证，方案见 `docs/field-study.md`。

---

## 测试

```bash
npm test                      # 347 项
npm run test:integration      # 密码模式端到端：fixture → 桥接 → 匹配
npm run test:roundtrip        # 密码模式在线/离线一致性
npm run fixture:health        # 生成健康模式合成夹具
npm run analyze:health -- 文件.json   # 健康模式离线分析
```

| 文件 | 项数 | 覆盖 |
|---|---|---|
| `contract` `detect` `dsp` `framer` `synth` `capture-fallback` `profiles` `rhythm-quality` | — | 密码模式：音频采集、分段、界面流程 |
| `health-features.test.mjs` | 16 | 健康特征提取、倍周期纠正、low-signal 路径 |
| `health-baseline.test.mjs` | 20 | 基线建立、状态优先级、连续偏离、疾病词拦截 |
| `health-ai.test.mjs` | 22 | AI 回退、载荷收窄、AI 无权改状态 |
| `health-consistency.test.mjs` | 8 | 在线/离线一致、演示序列可复现 |
| `health-store.test.mjs` | 9 | 记录存取闭环、失败样本留档 |
| `health-no-key-in-bundle.test.mjs` | 4 | 构建产物不含 API Key |

健康模式测试锁住的核心不变量：**测量问题（低信号/超区间/基线不足/无法比较）绝不报成健康异常**；单次偏离只提示复测，连续 3 次才升级「建议关注」；AI 无权决定状态。

\* 脚本式测试，`node --test` 计为 1 项，内部有 10 个断言块。

集成测试用 `fixtures/` 的 10 个样本走完整链路，验证桥接语义、注册、验证、弱吸气不影响判定、输入防御、`n=3` 时带约束仍有效。

### 数据来源分类（不可混称）

| 类别 | 本项目中的实例 | 能支持什么 |
|---|---|---|
| **合成信号** | `fixtures/*.json` — 由 `src/audio/synth.js` 的 `synthesizeBreath()` 生成波形，再过真实音频管线分析 | 链路通畅、相对排序、回归对比 |
| **合成实验** | `experiments/percapita.js`、`decompose.js` — 参数化抖动模型 | 趋势与敏感性分析 |
| **合成采集夹具** | `tests/fixture-field-schema2.json` — 由上面的 fixture 套一层实验分组，标 `synthetic: true` | 只验证分析脚本可用 |
| **真实录音** | **没有** | — |
| **正式实验记录** | **没有** | — |

`fixtures/` 里**没有真实录音，也没有 WAV**（`index.json` 提到 WAV，但未打包）。所有 fixture 都是合成波形的分析结果，**不能**用于任何性能结论。带 `synthetic: true` 的导出与分析结果一律在输出顶部标注"非真人实验数据"。

---

## 其他工具

```bash
node experiments/percapita.js   # 合成实验：个人执行风格对同模式可分性的影响
node experiments/decompose.js   # 攻击类别 EER + 抖动敏感性
npm run analyze -- 数据.json    # 真人采集数据分析
```

`demo.html` 是人1 的音频调试页（波形、门限线、诊断），dev server 下访问 `/demo.html`。它能把刚录的音频导出成 WAV，但**不能反向加载** fixture——页面里没有文件输入。所以麦克风坏了**无法**用 fixture 演界面流程；fixture 只能在 Node 侧跑测试与分析。

文档：`docs/HANDOFF-audio.md`（人1 交接）、`docs/field-study.md`（密码模式真人采集）、`docs/report-template.md`（报告模板）、`docs/health-mode.md`（健康模式技术说明）、`docs/product-direction.md`（赛道定位与复用结论）、`docs/demo-script.md`（比赛演示脚本）、`docs/health-field-guide.md`（健康模式真人采集操作说明）。
