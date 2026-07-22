# Codex Forge

`codex-forge` は [k02miu/forge](https://github.com/k02miu/forge) の設計を Codex に移植した開発パイプラインです。`plan → work → finish → ship` の4つのSkillで、Issue設計から実装、差分の仕上げ、PRレビュー対応までを扱います。

Claude Code版の Dynamic Workflows は使いません。CodexのSkills、サブエージェント協調、通常のシェル/GitHub CLIを使って同じ品質契約を実行します。

## Requirements

- Codex CLI（pluginコマンドを利用できるバージョン）
- Git
- GitHub操作を行う場合は認証済みの `gh` CLI
- 多観点処理にはCodexのサブエージェント機能を推奨。利用できない環境では同じ観点を順次処理します

## Install from GitHub

```bash
codex plugin marketplace add k02miu/codex-forge
codex plugin add codex-forge@codex-forge
```

ローカル開発中はリポジトリのルートを指定できます。

```bash
codex plugin marketplace add /path/to/codex-forge
codex plugin add codex-forge@codex-forge
```

更新後はMarketplaceを更新し、プラグインを再インストールして新しいスレッドを開始します。

```bash
codex plugin marketplace upgrade codex-forge
codex plugin add codex-forge@codex-forge
```

## Skills

| Skill | 役割 |
|---|---|
| `$forge-plan <要求>` / `$forge-plan #N` | 新規Issueの設計、または既存Issueの改訂案作成 |
| `$forge-work #N` / `$forge-work <作業内容>` | Issueまたは小規模タスクの実装 |
| `$forge-finish [--base branch]` | docs・テスト追随と収束型レビュー |
| `$forge-ship <PR/Issue> [--auto]` | PR作成とレビュー指摘対応 |

全Skillは `--depth quick|standard|thorough` を受け付け、既定は `standard` です。典型フローは `$forge-plan` → `$forge-work` → `$forge-finish` → `$forge-ship` ですが、途中から使うこともできます。

初回実行時は対象プロジェクトに `.forge.json` を生成します。これはチームで共有する設定です。一方、実行レポートは `.forge/reports/` に保存するため、`.forge/` は通常 `.gitignore` に追加します。

## Codex版での主な変更

- Claude固有の `${CLAUDE_PLUGIN_ROOT}`、`Workflow` JS、`agentType` を廃止
- 独立した観点はCodexサブエージェントへ割り当て、統合・裁定は親エージェントが担当
- ツールの同時実行数に合わせて観点をバッチ並列化
- `/forge:*` コマンドをCodexの `$forge-*` Skill呼び出しへ変更
- Codex Marketplace用の `.agents/plugins/marketplace.json` と `.codex-plugin/plugin.json` を採用

移植方針とコンポーネント対応の詳細は [docs/design.md](docs/design.md) を参照してください。

## Development

```bash
node plugins/codex-forge/scripts/validate.mjs
```

License: MIT
