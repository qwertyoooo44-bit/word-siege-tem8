# Open-source review (v2 keyboard / audio)

审查日期：2026-09-18。只读取 README、LICENSE、package 元数据和仓库 API，未全文复制大型仓库，未安装候选依赖。

本项目代码许可证：MIT。词库数据：CC BY-SA 4.0。不得把 GPL 代码或来源不明音频并入本仓库。

## 1. simple-keyboard

- 仓库：https://github.com/hodgef/simple-keyboard
- 许可证：MIT（`LICENSE`，Copyright 2019 Francisco Hodge and project contributors）
- 维护：2026-09-17 仍有推送；npm `simple-keyboard@3.8.190`
- 测试：上游 `package.json` 含 Jest
- iPhone 网页：虚拟键盘库，可用于移动网页，但默认是通用 OSK，不是本应用的 30 键英语攻坚键盘
- 预计新增体积：压缩后仍明显高于自写 30 键组件（还带主题 CSS）
- 是否引入依赖：**否**
- 借鉴：三行 QWERTY、独立功能键、触控按键按下态、实体键与屏幕键应对同一输入动作
- 未复制：任何源码、样式、构建产物或示例
- 素材：无音频。代码 MIT 与本项目兼容，但当前需求不值得增加依赖

结论：自己写薄组件更小、更稳，行为完全受控。

## 2. Monkeytype

- 仓库：https://github.com/monkeytypegame/monkeytype
- 许可证：**GPL-3.0**（`LICENSE`）
- 维护：2026-09-17 仍活跃
- 测试：上游有完整测试体系（未安装、未拉取源码树）
- iPhone 网页：桌面优先的打字产品，不是本应用的一词攻坚键盘
- 预计新增体积：不适用（禁止合入）
- 是否引入依赖：**否，禁止**
- 借鉴的产品思路：主题与声音开关分层、错误后保留前缀、输入性能、减少无意义动画
- 未复制：代码、样式、主题、音频、截图、字体
- 素材许可证：与 GPL 代码绑定，不得进入 MIT 主项目

结论：只作交互参考。

## 3. kbsim

- 仓库：https://github.com/tplai/kbsim
- 代码许可证：MIT（GitHub SPDX、`package.json` `"license": "MIT"`、树中 `LICENSE.md`）
- 维护：最后推送 2023-03-05，长期无更新
- 测试：未见专项测试说明
- iPhone 网页：桌面机械键盘视觉模拟，按键图与音效面向展示，不适合 iPhone 学习键盘
- 预计新增体积：开关采样音频会显著增大首包
- 是否引入依赖：**否**
- 借鉴：不同按键可有不同声音；快速输入时不要切断音频线程（思路）
- 未复制：代码、图片、任何 switch 采样
- 素材许可证：**与代码许可证分离且不清楚**。README 列出 Cherry / Holy Panda / Topre 等商业轴体采样，未见到可再分发的音频许可证。即使代码是 MIT，也不得使用这些 WAV/MP3

结论：音频不可用。布局思路可看，不引入。

## 4. Thock

- 仓库：https://github.com/ArahKarya/thock
- 代码许可证：MIT（`LICENSE`）
- 音频：README 声明捆绑包为 **CC0、程序化生成**（`tools/gen_sounds.py`），代码许可证与音频许可证分离
- 维护：2026-08-01 仍有推送
- 测试：未核完整测试树
- iPhone 网页：**不适合直接用**。这是 Tauri/Rust 桌面托盘应用，含全局按键钩子
- 预计新增体积：若拷贝 WAV 会增加静态资源；本项目改为 Web Audio 程序化生成，运行时约 0 额外文件
- 是否引入依赖：**否**
- 借鉴：声音包 manifest 思路；字母 / Backspace / Enter 分音；音量与音高轻微抖动；抑制长按自动重复造成的音频堆叠；用户手势后再开音频
- 未复制：Rust/Tauri 架构、全局钩子、UI、Python 生成器、任何 WAV
- 素材：即使上游音频标 CC0，本轮仍自行用 Web Audio 生成，避免搬运桌面资源

结论：只借鉴声音包治理思路，用原创程序化音效。

## 决策

| 候选 | 依赖 | 原因 |
| --- | --- | --- |
| simple-keyboard | 不引入 | 30 键需求用自写组件更小 |
| Monkeytype | 禁止合入 | GPL-3.0 |
| kbsim | 不引入 | 音频来源不清、项目停更 |
| Thock | 不引入 | 桌面全局钩子，非网页键盘 |

本轮实现：`src/input/` 自写英语 QWERTY，`src/audio.ts` 程序化按键音。
