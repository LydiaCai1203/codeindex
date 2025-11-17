# CodeIndex JavaScript/TypeScript SDK

该目录封装了一个可独立发布的 JS/TS SDK，方便直接在 Node.js/浏览器环境（通过打包）中使用 CodeIndex 的索引与查询能力。

## 安装与构建

```bash
cd sdk/javascript
npm install
npm run build
```

> 默认复用仓库根目录的 TypeScript 配置，如需自定义编译目标，可修改 `tsconfig.json`。

## 使用示例

```ts
import { CodeIndex } from '@codeindex/sdk-js';

const index = await CodeIndex.create({
  rootDir: '/path/to/project',
  dbPath: '.codeindex/project.db',
  languages: ['go', 'ts'],
});

const symbols = await index.findSymbols({
  name: 'BindRepoReq',
  language: 'go',
});

console.log(symbols);
index.close();
```

## 发布/引用方式

1. **本地开发**：可以通过 `npm link` 或 `pnpm/yarn link` 将该目录作为包引入到其他项目。
2. **内部 npm Registry**：将 `sdk/javascript` 打包发布到内部 registry，AutoSpecMan 等消费者即可 `npm install @codeindex/sdk-js`。

## 注意事项

- SDK 直接复用根目录 `src/index.ts` 暴露的能力，升级时需保持 `CodeIndex` API 的兼容性。
- 使用前需确保已经执行过 `CodeIndex` 的索引构建（例如通过 CLI `index`/`rebuild` 命令生成 `.db`），否则查询将得到空结果。

