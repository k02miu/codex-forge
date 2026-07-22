---
name: forge-finish
description: Finish the current branch by detecting documentation drift and test gaps, applying follow-up fixes, and running a convergent multi-perspective Review → Verify → Fix loop. Use when the user invokes $forge-finish, asks to finish or harden a branch, or requests a thorough pre-PR review of current changes. Accept --base and --depth quick|standard|thorough.
---

# Forge Finish

現在ブランチの差分にdocs・テストを追随させ、検証済みdefectが収束するまでレビューと修正を反復する。

## 必須参照

開始時に次をすべて読む。

- [workflow-core.md](../../references/workflow-core.md)
- [profile.md](../../references/profile.md)
- [contracts.md](../../references/contracts.md)
- [knowledge-packs.md](../../references/knowledge-packs.md)
- [roles.md](../../references/roles.md)

## 1. 差分と観点を確定する

1. `$forge-finish` を使うことをユーザーへ知らせる。
2. profileとdepthを解決する。
3. pluginの `scripts/diff-summary.sh [base]`、または同等のGitコマンドでmerge-baseからの差分とdirty stateを取得する。`NO_CHANGES` なら終了する。
4. ブランチ名とcommit messageからIssue参照を解決できれば `gh issue view` で受け入れ条件を取得し、spec観点を追加する。解決できなければ最終報告に記す。
5. 実行予定のtypecheck / lint / test / buildをユーザーへ短く提示する。

基本観点はarchitectureとtests。残りをspec、security、review checklist、infra、knowledge pack、ui、reuseの順で差分に応じて選ぶ。profileの `review.dimensions` が配列なら優先する。depth上限で切る。

## 2. Groundworkを行う

親が差分を、変更ファイル、公開挙動、関連docs、関連tests、危険な境界に構造化する。

サブエージェントが利用可能なら、docs drift調査とtest gap調査を並列に行う。利用できなければ順番に行う。出力は次に揃える。

```json
{
  "gaps": [
    {
      "kind": "docs-drift | test-gap",
      "file": "対象ファイル",
      "relatedFile": "対応する実装ファイル",
      "description": "不足または乖離",
      "evidence": "一次情報",
      "suggestion": "最小修正"
    }
  ]
}
```

親が各gapを検証し、妥当なものだけbuilderまたは親が修正する。関連検証を実行する。docsやtestsを変更不要と判断した場合も根拠を記録する。

## 3. Review → Verify → Fixを反復する

反復ごとに次を行う。

### Review

選定観点を独立したread-only担当へ並列委譲する。各担当へ差分、profile、Issue/spec、過去finding、1つのrole、knowledge blockを渡す。出力は [contracts.md](../../references/contracts.md) のFindingsに厳密に従わせる。過去に解消済みのfindingを証拠なく再掲しない。

### Verify

親が全findingをバッチで検証する。該当コードを読み、必要なら再現コマンドを実行し、各findingを `defect | judgment | spurious` に裁定する。ポジション担当自身の `selfKind` をそのまま採用しない。

spuriousはfile、claim、reasonを監査ログへ必ず残す。judgmentは修正必須にしない。defectだけを今回の修正集合にする。

### ExitまたはFix

[workflow-core.md](../../references/workflow-core.md) の安定キーで次を判定する。

- defectが0件: `all-clear` で終了
- 前回とキー集合が同じ: `converged` で終了し、残存defectを報告
- depthの最大反復に到達: `max-iterations` で終了
- それ以外: critical → high → medium → lowの順でbuilderが最小修正し、関連検証後に次のReviewへ進む

Fix担当には検証済みdefectだけを渡す。IaC apply、破壊的migration、commit、pushは行わせない。

## 4. レポートする

`.forge/reports/finish-<timestamp>.md` に次を保存する。

- base、差分、選定観点、Issue/specの有無
- Groundworkのdocs/test修正
- 各反復のfinding数とverdict
- 修正済みdefect、残存defect、judgment
- spurious監査リスト（0件でも明記）
- 検証コマンドと結果
- `all-clear | converged | max-iterations`

最終回答では重要な結果と残存リスクを先に示す。commit/pushはユーザーが別途明示しない限り行わない。
