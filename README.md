# claude-plugins-zh · Claude Code 官方插件中文市场

自动同步 [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)（**315 个插件**，Apache-2.0）的**中文版市场**：
全部插件介绍与分类已汉化，插件源码逐字不动（机器可证），每日自动跟进上游。

**Claude Code 与 Codex 两个客户端都能装**，插件面板里显示的都是中文介绍与中文分类——两边读的是不同的字段（Claude 读市场清单的 `description`，Codex 读插件的 `interface`），本仓库同时产出两份，见 [为什么 Codex 里也有中文](#为什么-codex-里也有中文)。

在线目录：**[kael-odin.github.io/claude-plugins-zh](https://kael-odin.github.io/claude-plugins-zh/)** —— 可搜索的中文导航站，分类侧栏、真实图标、中英双语详情。

本仓库与 [codex-plugins-zh](https://github.com/kael-odin/codex-plugins-zh)（Codex 官方插件中文市场）是姊妹项目，共用同一套「同步 → 汉化 → 无损校验」管线。

> 本文里的每个数字（插件数、文件数、对账结果）都由 `tools/check-docs.mjs` 对着 `data/catalog.json`、`data/quality-report.json` 与两份清单校验，CI 里对不上就红——手写数字漂了会被当场抓住。

## 两步用上

### Claude Code

在 Claude Code 会话里执行：

```text
/plugin marketplace add kael-odin/claude-plugins-zh
```

或者终端里：

```bash
claude plugin marketplace add kael-odin/claude-plugins-zh
```

之后 `/plugin` 面板里出现「kael-odin-plugins-zh」，315 个插件的介绍、分类均为中文；更新快照：

```bash
claude plugin marketplace update kael-odin-plugins-zh   # 或在 /plugin 面板里点更新
```

### Codex

Codex 的 **设置 → 插件 → 添加市场**，粘贴仓库地址：

```text
https://github.com/kael-odin/claude-plugins-zh.git
```

或命令行：

```bash
codex plugin marketplace add https://github.com/kael-odin/claude-plugins-zh.git
```

插件列表里出现「**Claude Code 官方插件 · 中文版**」，315 个条目的副标题与详情页都是中文。

> 官方英文原味市场：`/plugin marketplace add anthropics/claude-plugins-official`。两个市场可并存，中文版只是门面。

> **仓库名 `claude-plugins-zh`，面板里为什么显示 `kael-odin-plugins-zh`？** Claude Code 会拒绝「名称与官方市场雷同」的市场（视为冒充官方），因此市场清单里的 `name` 必须换成自有名称；**仓库地址不变**，已添加过的人也不需要重新配置。

## 目录里有什么

| 项 | 数量 | 说明 |
| --- | --- | --- |
| 插件清单 | **315** | 全部条目：中文介绍 + 中文分类；同时产出 Codex 原生清单 `.agents/plugins/marketplace.json` |
| 仓内插件 | 53（`plugins/` 39 + `external_plugins/` 14） | 逐字转载；plugin.json 只汉化 `description`，另补 Codex 展示用的 `interface` 字段（Claude Code 明确忽略该键） |
| 远程引用 | 262（git-subdir 98 · url 164） | 插件体原样保留、指向官方/原仓库；Codex 里的中文介绍随清单条目下发 |

（上游 `plugins/example-plugin` 是示例目录，不在清单内，同样原样转载。）

上游以 **Apache-2.0** 发布——转载、汉化、再分发完全合规（保留许可证与署名，见 [NOTICE.md](NOTICE.md)）。

## 「无损」是怎么保证的

`tools/verify.mjs` 每次发布前对账：574 个文件中，除白名单（市场清单的 `name`/`description`/`owner`、各条目的 `description`/`category`、各 plugin.json 的 `description` 与 Codex 展示字段 `interface.shortDescription`/`longDescription`/`category`）外，**533 个文件与上游逐字节一致**（余下 41 个即白名单字段所在文件），CI 全绿才推送。生成的 `.agents/plugins/marketplace.json` 没有上游对应物，单独按「1 个自有文件」核对：条目集合、来源、分类、中文长描述必须与 Claude 清单完全一致，短描述必须是长描述的首个小句——两份清单不许漂移。译文以「源文本哈希」为键存放在 [i18n/zh/](i18n/zh)——上游改词自动失效重翻，绝不张冠李戴。

## 为什么 Codex 里也有中文

两个客户端读的不是同一个字段，所以本仓库同时产出两份清单和两处描述：

| | Claude Code | Codex |
| --- | --- | --- |
| 清单文件 | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json`（原生格式） |
| 描述取自 | **清单条目**的 `description` | **插件 manifest** 的 `interface.shortDescription`/`longDescription`；条目面板读不到 manifest 时回落到清单条目的 `interface` |
| 汉化落点 | 条目 `description`、`category` | 条目的 `interface`（262 条远程引用）+ 仓内 plugin.json 的 `interface`（53 条仓内插件） |

Codex 只把 `.claude-plugin/marketplace.json` 当兼容兜底读取，而它的清单条目结构里**没有 `description` 字段**（它认的是 `name`/`source`/`policy`/`category` 加一个 `interface` 块）。所以只汉化 `description` 的仓库在 Codex 里会显示不出介绍——这正是本仓库补出第二份清单与 `interface` 字段的原因。两边的中文同源：都来自 [i18n/zh/](i18n/zh) 同一份译文账本。

## 常见问题

- **为什么 Codex 里以前没有中文描述？** 因为 Codex 的市场条目结构里没有 `description` 字段可读，它只认插件 manifest 的 `interface`。本仓库现在同时产出 Codex 原生清单与 `interface` 字段，两边都是中文——见 [为什么 Codex 里也有中文](#为什么-codex-里也有中文)。
- **仓库名和面板里的市场名不一样？** Claude Code 会拒绝与官方市场雷同的名称（视为冒充官方），所以清单里的 `name` 用自有名 `kael-odin-plugins-zh`；**仓库地址不变**，已添加过的人无需重新配置。
- **中文版和官方市场能同时装吗？** 能，两个市场并存互不影响；插件内容与官方逐字节一致（`tools/verify.mjs` 对账），中文版只是门面。
- **装完面板没变化？** Claude Code 里执行 `claude plugin marketplace update kael-odin-plugins-zh` 刷新快照；Codex 里重开会话即可。

## 本地开发

零依赖，Node ≥ 20：

```bash
node tools/sync.mjs        # 拉上游 + diff
GLM_API_KEY=… GLM_BASE_URL=… GLM_MODEL=… node tools/translate.mjs --execute  # 补翻（可断点续跑）
node tools/compose.mjs     # 合成 zh 市场清单（Claude + Codex 两份）+ plugin.json 汉化与 interface
node tools/verify.mjs      # 无损对账（必须 PASS）
node tools/check-docs.mjs  # README 里的数字对账（CI 门禁）
node tools/build-site.mjs  # 本地预览站点：dist/ 里的 index.html
```

## 姊妹项目

- [codex-plugins-zh](https://github.com/kael-odin/codex-plugins-zh) — Codex 官方插件中文市场（189 插件 + 1,505 应用导航，附可视化站点）

## 合规

上游 `anthropics/claude-plugins-official` 以 Apache-2.0 发布；本仓库保留其 LICENSE（见 [LICENSE](LICENSE)），汉化部分同样以 Apache-2.0 提供，商标与插件内容权利归 Anthropic 及各自权利人所有——详见 [NOTICE.md](NOTICE.md)。
