# claude-plugins-zh · Claude Code 官方插件中文市场

自动同步 [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)（**315 个插件**，Apache-2.0）的**中文版市场**：
全部插件介绍与分类已汉化，插件源码逐字不动（机器可证），每日自动跟进上游。

本仓库与 [codex-plugins-zh](https://github.com/kael-odin/codex-plugins-zh)（Codex 官方插件中文市场，1,694 项目）是姊妹项目，共用同一套「同步 → 汉化 → 无损校验」管线。

## 两步用上

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

> 官方英文原味市场：`/plugin marketplace add anthropics/claude-plugins-official`。两个市场可并存，中文版只是门面。

## 目录里有什么

| 项 | 数量 | 说明 |
| --- | --- | --- |
| 插件清单 | **315** | 全部条目：中文介绍 + 中文分类 |
| 仓内插件 | 40（`plugins/` 26 + `external_plugins/` 14） | 逐字转载，仅 plugin.json 的 description 一字汉化 |
| 远程引用 | 275（git-subdir 98 · url 164 · 其余） | 原样保留，指向官方/原仓库 |

上游以 **Apache-2.0** 发布——转载、汉化、再分发完全合规（保留许可证与署名，见 [NOTICE.md](NOTICE.md)）。

## 「无损」是怎么保证的

`tools/verify.mjs` 每次发布前对账：539 个文件中，除白名单（市场清单的 `name`/`description`、各条目的 `description`/`category`、各 plugin.json 的 `description`）外，**全部与上游逐字节一致**，CI 全绿才推送。译文以「源文本哈希」为键存放在 [i18n/zh/](i18n/zh)——上游改词自动失效重翻，绝不张冠李戴。

## 本地开发

零依赖，Node ≥ 20：

```bash
node tools/sync.mjs        # 拉上游 + diff
GLM_API_KEY=… GLM_BASE_URL=… GLM_MODEL=… node tools/translate.mjs --execute  # 补翻（可断点续跑）
node tools/compose.mjs     # 合成 zh 市场清单 + plugin.json 汉化
node tools/verify.mjs      # 无损对账（必须 PASS）
```

## 姊妹项目

- [codex-plugins-zh](https://github.com/kael-odin/codex-plugins-zh) — Codex 官方插件中文市场（189 插件 + 1,505 应用导航，附可视化站点）

## 合规

上游 `anthropics/claude-plugins-official` 以 Apache-2.0 发布；本仓库保留其 LICENSE（见 [LICENSE](LICENSE)），汉化部分同样以 Apache-2.0 提供，商标与插件内容权利归 Anthropic 及各自权利人所有——详见 [NOTICE.md](NOTICE.md)。
