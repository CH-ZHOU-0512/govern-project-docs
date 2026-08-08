# [开源] govern-project-docs：让 AI 高频迭代仓库的文档不再互相打架

![govern-project-docs 分享封面](https://raw.githubusercontent.com/CH-ZHOU-0512/govern-project-docs/main/assets/media/share-cover.png)

大家好，我是 [CH-ZHOU-0512](https://github.com/CH-ZHOU-0512)。最近在用 AI 持续迭代项目时，我越来越明显地感觉到：很多仓库缺的不是文档，而是“文档秩序”。

同一个状态同时写在 README、STATUS、计划和交接记录里；已经完成的方案继续和当前设计放在一起；API、数据库、事件字段从代码复制到 Markdown 后逐渐过期。人已经很难判断该信谁，AI Agent 更容易把互相冲突的内容一起读进上下文。

所以我把这套处理方法整理成了一个开源项目：

**govern-project-docs**

GitHub：<https://github.com/CH-ZHOU-0512/govern-project-docs>

它既是一个 Codex Skill，也是一套零第三方依赖的 Node.js 文档治理工具。MIT License，可直接使用或按项目改造。

## 它想解决什么问题

核心不是“再写更多文档”，而是建立几条可以长期执行的规则：

1. 每个会变化的事实，只保留一个当前权威来源。
2. 先读紧凑入口，再按任务展开细节，最后才读取历史和来源证据。
3. 已完成或被替代的内容归档，不直接删除，也不继续冒充当前事实。
4. API、事件、数据库和依赖关系尽量由 OpenAPI、Schema、Migration、Manifest 等机器契约负责。
5. 索引必须可重复生成，并由 CI 检查是否过期。

![从文档混乱到可治理知识](https://raw.githubusercontent.com/CH-ZHOU-0512/govern-project-docs/main/assets/media/readme-demo.png)

## 项目里有什么

### 1. Codex Skill

Skill 会先只读审计仓库，梳理文档分类、权威来源、重复内容、归档候选和自动化机会，再根据明确授权执行迁移。

它不会因为“整理文档”就默认删除历史记录，也不会在没有允许的情况下提交或发布代码。

### 2. 只读审计工具

不需要克隆仓库，也没有第三方运行时依赖：

```bash
npx github:CH-ZHOU-0512/govern-project-docs audit --repo /path/to/your-repository
npx github:CH-ZHOU-0512/govern-project-docs audit --repo /path/to/your-repository --json
```

它会报告：

- Markdown 数量和分类；
- 当前文档缺失的元数据；
- 重复标题和超长文档；
- 失效的本地链接；
- 陈旧路径引用；
- 放错位置的归档或 superseded 文档。

审计过程不会修改目标仓库。

### 3. 可复制到项目里的运行时工具

仓库提供四个 Node.js 脚本，应作为一个整体复制：

```text
docs-toolkit.mjs
document-index.mjs
check-doc-governance.mjs
check-markdown-links.mjs
```

接入后可以运行：

```bash
node scripts/document-index.mjs generate
node scripts/document-index.mjs check
node scripts/document-index.mjs query ADR-042
node scripts/document-index.mjs watch
node scripts/check-doc-governance.mjs
node scripts/check-markdown-links.mjs
```

其中 `query` 返回有上限的 JSON 结果，可按路径、标题、正文关键词或稳定 ID 查找；`check` 用来阻止过期索引进入主分支；`watch` 负责本地快速反馈，但最终正确性仍由提交检查和 CI 保证。

### 4. 可配置的治理规则

可以配置：

- 文档根目录和生成目录；
- 哪些目录属于当前权威，哪些属于 archive/source/reference/generated；
- 必填 front matter；
- 允许的生命周期状态；
- 不同文档的行数上限；
- 路由入口；
- `ADR`、`TASK`、`DOC` 等稳定 ID 前缀。

配置有对应 JSON Schema，运行时也会拒绝未知字段、越界路径、无效日期、重复数组项和错误正则表达式。

## 快速体验

只想先看看自己的仓库有什么问题，可以直接运行只读审计：

```bash
npx github:CH-ZHOU-0512/govern-project-docs audit --repo /path/to/your-repository
```

确认要接入后，再用 `init --dry-run` 预览将要安装的脚本、Schema 和策略模板；默认遇到已有不同内容会整次停止，不会静默覆盖。

作为 Codex Skill 安装后，可以这样调用：

```text
使用 $govern-project-docs 审计当前仓库的文档。
先报告权威来源、重复内容、归档候选和自动化建议，不修改文件。
```

完整上手说明：<https://github.com/CH-ZHOU-0512/govern-project-docs/wiki/Getting-Started>

## 当前状态

- 零第三方运行时依赖；
- 支持 Node.js 22 和 24；
- GitHub Actions 覆盖 Ubuntu 和 Windows；
- 当前 19 个 CLI、运行时和 Pages 测试全部通过；
- 索引生成、稳定 ID 查询、过期检查、watch 刷新、元数据规则、归档边界和复杂 Markdown 链接均有测试覆盖。

## 它暂时不做什么

这个项目没有尝试提供“适用于所有语言的万能代码图”。代码图依赖具体技术栈和可信的机器契约，遇到反射、依赖注入、动态导入或运行时插件时，静态工具不应该假装知道真实关系。

它也不会声称整理完文档就解决了产品、合规、供应商或发布决策。治理工具能做的是让事实边界、责任人、证据和未决项更清楚。

## 想听听大家的反馈

我现在比较想知道：

- 你们的仓库里最常见的文档冲突是什么？
- 更希望它优先适配哪类现有目录结构或 CI？
- 是否需要针对某个具体技术栈增加“只基于可信契约”的代码图示例？

项目地址：<https://github.com/CH-ZHOU-0512/govern-project-docs>

Wiki：<https://github.com/CH-ZHOU-0512/govern-project-docs/wiki>

Issues：<https://github.com/CH-ZHOU-0512/govern-project-docs/issues>

如果它正好解决了你的问题，欢迎试用、提 Issue 或 PR。
