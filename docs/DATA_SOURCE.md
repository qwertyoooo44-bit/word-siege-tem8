# TEM8 数据来源

派生词包来自 OpenEtymology 公开词书，不是完整生产 SQLite 词典。

- 仓库：https://github.com/openetymology/OpenEtymology
- 提交：7d89f3697abf26e305fe2627f181b692c2c10b28
- TXT：`TEM8/TEM8.txt`，词目 3984
- EPUB：`TEM8/TEM8.epub`，SHA-256 `0db749f72a59853712dcbd7b5120c3ae8ee465658fe0262e3ce569793c387c3e`
- 数据许可：CC BY-SA 4.0
- 处理：格式转换、固定 50 词分章、字段筛选
- 机器可读派生包：`vendor/openetymology/derived/tem8-cc-by-sa.json`（CC BY-SA 4.0）
- 可完整学习：需同时具备 word、IPA、词性、中文释义、合法例句
- 英文释义字段在公开 EPUB 中基本缺失，未用其他词典补中文或音标
- EPUB 音标为英式（UK IPA）；部分词条同时附 US 对照。界面展示标为 UK IPA，不当作 US IPA
- 浏览器系统发音优先使用美国英语，与 UK IPA 不一定是同一口音
