# Third-party notices

未使用 Qwerty Learner 代码或数据。未使用 OpenEtymology 完整生产 SQLite 词典。

应用代码许可证见根目录 `LICENSE`（MIT）。词库数据许可证为 CC BY-SA 4.0，与代码许可证分开。

## 运行时

- react, react-dom: MIT
- dexie: Apache-2.0

## 开发

- vite: MIT
- @vitejs/plugin-react: MIT
- typescript: Apache-2.0
- vitest: MIT
- oxlint: MIT
- fake-indexeddb: Apache-2.0 / MIT
- @types/react, @types/react-dom, @types/node: MIT

## 音频

本应用键盘音效与结果音效由 `src/audio.ts` 使用 Web Audio API 程序化生成，无第三方采样。声音包：清脆、机械、词库、晶体。许可证：原创程序化音频。未使用 kbsim 采样，未复制 Thock WAV，未复制 Monkeytype 音频。

## 开源参考

见 `docs/OPEN_SOURCE_REVIEW.md`。未引入 simple-keyboard、Monkeytype、kbsim、Thock 依赖。

## 数据

正式专八学习内容派生自 OpenEtymology 公开词书：

- 仓库: https://github.com/openetymology/OpenEtymology
- 文件: `TEM8/TEM8.txt`, `TEM8/TEM8.epub`
- 代码许可证: Apache-2.0
- 数据许可证: CC BY-SA 4.0
- 本应用派生词包同样按 CC BY-SA 4.0 保留署名
- 处理方式: EPUB/XHTML 确定性解析、精确词形匹配、固定章节、可学习资格筛选
- 完整生产词典数据库未包含、未授权
