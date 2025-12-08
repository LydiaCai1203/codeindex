# 发布指南

本文档说明如何将 CodeIndex 及其 SDK 发布到公共包管理器（npm 和 PyPI）。

## 📦 发布清单

### 发布前检查

- [ ] 更新版本号（遵循 [语义化版本](https://semver.org/)）
- [ ] 更新 CHANGELOG.md（如果存在）
- [ ] 确保所有测试通过
- [ ] 确保代码已构建（`npm run build`）
- [ ] 检查 `.gitignore` 和 `.npmignore` 配置
- [ ] 更新作者信息和许可证

## 🚀 发布 npm 包

### 1. 主包：`@codeindex/ast-demo`

#### 准备工作

1. **注册 npm 账号**（如果还没有）
   ```bash
   npm adduser
   # 或登录现有账号
   npm login
   ```

2. **创建 npm 组织**（如果使用 `@codeindex` 作用域）
   - 访问 https://www.npmjs.com/org/create
   - 创建 `codeindex` 组织
   - 或者将包名改为不带作用域的格式（如 `codeindex`）

3. **更新 package.json**
   - 检查 `name`、`version`、`author`、`repository` 等字段
   - 确保 `main`、`types`、`bin` 字段正确指向构建产物

4. **创建 .npmignore**（如果需要排除某些文件）
   ```bash
   # 示例 .npmignore
   src/
   examples/
   docs/
   *.md
   !README.md
   .git/
   .codeindex/
   *.db
   tsconfig.json
   ```

#### 发布步骤

```bash
# 1. 确保代码已构建
npm run build

# 2. 检查将要发布的文件
npm pack --dry-run

# 3. 发布到 npm（测试时使用 --dry-run）
npm publish --dry-run

# 4. 正式发布（如果是作用域包，需要公开）
npm publish --access public

# 或发布到特定 registry
npm publish --registry https://registry.npmjs.org/
```

### 2. JavaScript SDK：`@codeindex/sdk-js`

```bash
cd sdk/javascript

# 1. 构建 SDK
npm run build

# 2. 检查发布内容
npm pack --dry-run

# 3. 发布
npm publish --access public
```

**注意**：JavaScript SDK 依赖主包的构建产物，确保主包已发布或使用相对路径引用。

## 🐍 发布 Python 包：`codeindex-sdk`

### 准备工作

1. **注册 PyPI 账号**
   - 访问 https://pypi.org/account/register/
   - 创建账号并验证邮箱

2. **安装发布工具**
   ```bash
   pip install build twine
   ```

3. **更新 pyproject.toml**
   - 检查 `name`、`version`、`authors`、`description` 等字段
   - 更新作者邮箱（当前为 `opensource@example.com`）

4. **创建 MANIFEST.in**（确保包含必要文件）
   ```python
   # MANIFEST.in
   include README.md
   include LICENSE
   include worker_server.js
   recursive-include codeindex_sdk *.py
   ```

### 发布步骤

```bash
cd sdk/python

# 1. 清理旧的构建产物
rm -rf dist/ build/ *.egg-info/

# 2. 构建分发包
python -m build

# 3. 检查构建产物
twine check dist/*

# 4. 测试上传到 TestPyPI（可选）
twine upload --repository testpypi dist/*

# 5. 正式发布到 PyPI
twine upload dist/*
```

### 发布后安装

发布成功后，用户可以通过以下方式安装：

```bash
# 使用官方 PyPI 源
pip install lydiacai-codeindex-sdk

# 使用阿里云镜像源（推荐，速度更快）
pip install -i https://mirrors.aliyun.com/pypi/simple/ lydiacai-codeindex-sdk

# 安装特定版本
pip install lydiacai-codeindex-sdk==0.1.0
```

**注意**：PyPI 包名不支持斜杠（`/`），所以使用连字符（`-`）作为分隔符。包名格式为 `lydiacai-codeindex-sdk`。

**注意**：Python SDK 的 `worker_server.js` 依赖主项目的 `dist/index.js`。发布前需要：
- 方案 A：将主包的构建产物打包到 Python 包中
- 方案 B：要求用户先安装主 npm 包，Python SDK 从全局 node_modules 加载
- 方案 C：将 worker_server.js 改为从已安装的 npm 包加载（推荐）

## 📝 版本管理

### 语义化版本规则

- **主版本号（MAJOR）**：不兼容的 API 变更
- **次版本号（MINOR）**：向后兼容的功能新增
- **修订号（PATCH）**：向后兼容的问题修复

### 更新版本号

**npm 包**：
```bash
# 自动更新版本号（推荐）
npm version patch   # 0.1.0 -> 0.1.1
npm version minor   # 0.1.0 -> 0.2.0
npm version major   # 0.1.0 -> 1.0.0

# 手动编辑 package.json 中的 version 字段
```

**Python 包**：
```bash
# 手动编辑 pyproject.toml 中的 version 字段
# 或使用工具如 bumpversion
```

## 🔄 发布后验证

### npm 包验证

```bash
# 创建临时目录测试安装
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install @codeindex/ast-demo
# 测试 CLI
npx codeindex --help
```

### Python 包验证

```bash
# 创建虚拟环境测试
python -m venv /tmp/test-venv
source /tmp/test-venv/bin/activate  # Linux/Mac
# 或: /tmp/test-venv\Scripts\activate  # Windows

# 使用阿里云镜像源安装（推荐）
pip install -i https://mirrors.aliyun.com/pypi/simple/ lydiacai-codeindex-sdk

# 或使用官方源
pip install lydiacai-codeindex-sdk

# 验证安装
python -c "from codeindex_sdk import CodeIndexClient; print('OK')"
```

## ⚠️ 常见问题

### npm 发布问题

1. **作用域包需要公开访问**
   ```bash
   npm publish --access public
   ```

2. **包名已存在**
   - 更换包名或联系包所有者

3. **权限不足**
   - 确认已登录：`npm whoami`
   - 确认是组织成员（如果是组织包）

### PyPI 发布问题

1. **用户名/密码认证失败**
   - 使用 API Token（推荐）：在 PyPI 账户设置中创建
   - 配置 `~/.pypirc`：
     ```ini
     [pypi]
     username = __token__
     password = pypi-xxxxxxxxxxxxx
     ```

2. **文件大小限制**
   - PyPI 单个文件限制 100MB
   - 如果 `worker_server.js` 依赖的构建产物太大，考虑方案 C

3. **版本已存在**
   - 更新版本号后重新发布

## 📚 相关资源

- [npm 发布文档](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [PyPI 发布指南](https://packaging.python.org/en/latest/guides/distributing-packages-using-setuptools/)
- [语义化版本规范](https://semver.org/)

## 🔐 安全建议

1. **使用 2FA**：为 npm 和 PyPI 账号启用双因素认证
2. **使用 API Token**：PyPI 推荐使用 API Token 而非密码
3. **检查依赖**：发布前检查依赖包的安全性
4. **不要提交敏感信息**：确保 `.npmignore` 和 `.gitignore` 配置正确

