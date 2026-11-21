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

## diff-summary.sh

`plugins/codex-forge/scripts/diff-summary.sh` は、`$forge-work` と `$forge-finish` が使う差分の要約スクリプトです。現在のディレクトリのGitリポジトリについて、HEADとbaseのmerge-baseからの差分と作業ツリーの状態を出力します。調べたいリポジトリの作業ツリー内で、スクリプトのパスを指定して実行します。

```bash
bash /path/to/codex-forge/plugins/codex-forge/scripts/diff-summary.sh [-h|--help] [base]
```

- `base`: 比較の基準。ブランチ、タグ、SHA、`HEAD~N`、`:/<コミットメッセージ>` など、コミットを指すGitのリビジョンを指定できます。
- `base` を省略すると、`origin/HEAD`、`origin/main`、`origin/master`、`origin/develop` の順に最初に存在するものを使います。
- `-h` / `--help`: 使い方、引数、出力の節、終了コードを標準出力に表示します。Gitリポジトリの外でも表示できます。

標準出力は、差分も作業ツリーの変更（未追跡ファイルを含む）もなければ `NO_CHANGES` の1行です。それ以外は次の節をこの順に出力します。

| 節 | 内容 |
|---|---|
| `## base` | 使用したbase |
| `## merge-base` | HEADとbaseのmerge-base |
| `## changed files` | merge-baseからの `git diff --name-status` |
| `## working tree` | `git status --short` |
| `## diffstat` | merge-baseからの `git diff --stat` |

| 終了コード | 条件 |
|---|---|
| `0` | 要約または `NO_CHANGES` を出力した。ヘルプを表示した |
| `1` | Gitリポジトリの外、baseが存在しない、baseを自動判定できない。標準エラーに `error: ...` を1行出力し、標準出力は空。HEADとbaseに共通の祖先がない場合も `1` で、何も出力しない |
| `128` | Git自身のエラー。作業ツリーがない（bareリポジトリ、`.git` 内）、所有者の確認で拒否された（dubious ownership）、`GIT_DIR` がリポジトリでないなど。Gitのメッセージをそのまま標準エラーに出力する |

このリポジトリのルートで実行する例です。

```bash
bash plugins/codex-forge/scripts/diff-summary.sh --help   # 終了コード 0。1行目は Usage: diff-summary.sh [-h|--help] [base]
bash plugins/codex-forge/scripts/diff-summary.sh no-such-branch
# 標準エラー: error: base 'no-such-branch' not found
# 標準出力は空、終了コード 1
bash plugins/codex-forge/scripts/diff-summary.sh origin/main   # 変更がなければ NO_CHANGES、あれば ## base から始まる5節
```

## Development

```bash
node plugins/codex-forge/scripts/validate.mjs
node --test plugins/codex-forge/scripts/diff-summary.test.mjs
```

License: MIT
