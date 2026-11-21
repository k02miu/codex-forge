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

プラグインマニフェスト、Marketplace定義、4つのSkillを検証します。リポジトリのルートで実行します。

```bash
node plugins/codex-forge/scripts/validate.mjs          # 既定（人が読む出力）
node plugins/codex-forge/scripts/validate.mjs --json   # 結果をJSONで出力
node plugins/codex-forge/scripts/validate.mjs --help   # 使い方（-h も同じ）
```

| 実行内容 | 標準出力 | 標準エラー | 終了コード |
|---|---|---|---|
| 既定・検証成功 | `OK: 4 skills, plugin manifest, marketplace, and references validated` の1行 | 空 | 0 |
| 既定・検証失敗 | 空 | 通常はエラー1件につき `<ファイル>: <内容>` の1行（※） | 1 |
| `--json`・検証成功 | JSON 1件 | 空 | 0 |
| `--json`・検証失敗 | JSON 1件（`ok` が `false`） | 空 | 1 |
| `--help` / `-h` | オプション、出力、終了コードの説明 | 空 | 0 |
| 未知の引数（例 `--foo`） | 空 | `error: unknown option '--foo'` の1行 | 2 |

※ JSONの構文エラーでは、Nodeのエラーメッセージに元から含まれる改行がそのまま表示され、1件が複数行になる場合があります。

既定モードの検証失敗の例です。

```text
plugins/codex-forge/.codex-plugin/plugin.json: version must be semver
plugins/codex-forge/skills/forge-ship/SKILL.md: missing
```

`--json` の出力は1行のJSONです（下は見やすく改行しています）。

```json
{
  "ok": false,
  "errors": [
    { "file": "plugins/codex-forge/.codex-plugin/plugin.json", "message": "version must be semver" },
    { "file": "plugins/codex-forge/skills/forge-ship/SKILL.md", "message": "missing" }
  ],
  "checked": { "skills": 3 }
}
```

- `ok`: 検証エラーが無ければ `true`。成功時は `{"ok":true,"errors":[],"checked":{"skills":4}}` です
- `errors[].file`: リポジトリのルートからの相対パス。実行するディレクトリには左右されません
- `errors[].message`: 既定モードの標準エラーと同じ内容
- `checked.skills`: `SKILL.md` が存在し、読み取れたSkillの数。内容に指摘があっても数えます

引数は検証の前に確認します。未知の引数が1つでもあれば検証せずに終了コード2で終わり、`--help` / `-h` と併用しても未知の引数が優先されます。`--help` と `--json` を併用した場合はヘルプを表示して0で終わります。

License: MIT
