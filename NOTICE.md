# NOTICE — 权利归属

## 上游内容（anthropics/claude-plugins-official，Apache-2.0）

本仓库的 `.claude-plugin/marketplace.json`（**条目结构与 source 指向**）、`plugins/`、
`external_plugins/`、`LICENSE` 逐字转载自
[anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)，
该仓库以 **Apache-2.0** 授权。唯一的修改是与「中文门面」相关的白名单字段：

- 市场清单的 `name`：改为 `kael-odin-plugins-zh`（原有名称与官方市场雷同，会被
  Claude Code 以「冒充官方市场」为由拒绝导入）与 `description`（中文市场自述）；
- 各市场条目的 `description`（介绍）与 `category`（分类）的中文表述；
- 各插件清单 `plugin.json` 中的 `description`。

除此之外，`tools/verify.mjs` 会逐文件机器对账，证明其余内容与上游逐字节一致。

- 各插件名称、商标、第三方内容归其各自权利人所有；
- 远程引用条目（git-subdir / url）未做任何修改，仍指向原仓库/原地址；
- 若你是权利人并要求下架，请提 issue，我们会在 72 小时内处理。

## 本仓库原创内容

`tools/`、`config/`、`i18n/zh/`（译文账本）、`site/`（导航站源码）、`assets/`、
`data/`（生成物）、`README.md`。与上游部分一并按 **Apache-2.0** 提供。

## 译文

中文介绍与分类为机器辅助翻译（GLM/deepseek 系列，个别条目人工校订），仅供参考；
与英文原文冲突时以英文原文为准。欢迎 PR 改进译文。
