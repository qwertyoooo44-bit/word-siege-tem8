# 专八单词攻坚

一次只攻坚一个专八单词的打字学习网页应用。当前词没过完七关，不会进入下一个词。

## 许可证

- 应用代码：MIT，见 `LICENSE`
- 词库数据：CC BY-SA 4.0，派生自 OpenEtymology 公开 TEM8 词书
- 署名、来源提交、EPUB 哈希与处理说明见 `docs/DATA_SOURCE.md` 与 `THIRD_PARTY_NOTICES.md`

正式词表共 3984 个词目，其中 3826 个可完整七关学习，158 个资料待完善（不得进入攻坚队列）。公开 TXT 不含音标、中文释义和例句，应用不会伪造这些内容。

词书音标为 UK IPA。浏览器系统发音优先使用美国英语，与 IPA 不一定属于同一口音。

## 电脑上预览

```
pnpm install
pnpm test
pnpm build
pnpm preview
```

## 在线地址

发布后使用 GitHub Pages：

`https://qwertyoooo44-bit.github.io/word-siege-tem8/`

## iPhone 使用

见 `docs/IPHONE_INSTALL.md`。这是免费 PWA，不进 App Store。

## 数据

学习记录保存在本机。请定期导出 JSON。清理 Safari 网站数据会丢失进度。

当前公开 Pages 仍是稳定版 `493591b`。v2 升级在 `feature/v2-game-learning`，验收通过前不覆盖线上。

## 不包含

没有账号、广告、支付、云同步和后端。未使用未授权的完整 SQLite 词典。
