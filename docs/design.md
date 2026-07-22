# Codex port design

## コンポーネント対応

| Claude Code版 | Codex版 |
|---|---|
| `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` |
| `.claude-plugin/plugin.json` | `plugins/codex-forge/.codex-plugin/plugin.json` |
| `/forge:plan` 等 | `$forge-plan` 等のSkill |
| Dynamic WorkflowsのJS | SKILL.mdに記述した親エージェントの手順 |
| `agent()` / `parallel()` | Codexのサブエージェント委譲とバッチ並列実行 |
| `agentType: forge:*` | 共通 `roles.md` を埋め込んだ担当別タスク |
| `${CLAUDE_PLUGIN_ROOT}` | SKILL.mdからの相対参照 |

## MarketplaceとPluginの分離

CodexのGit Marketplaceは、リポジトリルートの `.agents/plugins/marketplace.json` をカタログとして読みます。カタログ内の `source.path` が実体 `./plugins/codex-forge` を指します。その実体に `.codex-plugin/plugin.json` とSkillsを配置します。

そのためGitHub公開後は次の2段階で利用できます。

```bash
codex plugin marketplace add k02miu/codex-forge
codex plugin add codex-forge@codex-forge
```

第1引数の `k02miu/codex-forge` はGitリポジトリ、第2コマンドの後半 `@codex-forge` はMarketplaceの `name` です。

## 実行モデル

CodexにはClaude Code Dynamic Workflowsの埋め込みJSランタイムと同じAPIがないため、制御構造をSkillの実行規約へ移しました。親エージェントがユーザー対話、統合、Verify、外部書き込みを所有します。独立観点だけをサブエージェントへ委譲します。

サブエージェント機能が利用できない場合も、同じ観点を親が順次処理します。このfallbackによりSkill自体は使えますが、速度と文脈分離は低下します。

## 保持した品質機構

- `.forge.json` によるstack非依存プロファイル
- knowledge packsによる言語・framework・cloud固有観点
- architecture/security/tests/ui/infra/reuseのポジションロール
- 中立のVerifyによる `defect | judgment | spurious` 裁定
- critical decisionsの4キー契約
- finding安定キーによる `all-clear | converged | max-iterations` 判定
- commit/pushと不可逆操作の封じ込め

## 意図的な差分

- 観点数はdepthで維持するが、実際の同時実行数はCodexセッションの利用可能枠に合わせてバッチ化する
- Claude CodeのWorkflowフェーズUIではなく、Codexのcommentaryとtask planで進捗を見せる
- `/config` や `CLAUDE_CODE_DISABLE_WORKFLOWS` への依存はない
- Skill frontmatterはCodexが認識する `name` と `description` だけに限定する
