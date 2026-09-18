# 维护说明

- 词库更新：替换 `vendor/openetymology/TEM8.txt` 后运行 `python scripts/convert_tem8.py`。
- 不得用模型逐条生成释义、音标或例句。
- 数据层版本在 `src/db/database.ts`。结构变化必须写迁移，不能清空用户进度。
- Service Worker 版本号在 `public/sw.js` 的 `VERSION`。发版时改这个值，用户才能收到更新提示。
- 测试：`pnpm test`；构建：`pnpm build`。
- 不登录外部账号，不添加付费服务。
