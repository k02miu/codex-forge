---
name: forge-ship
description: Create a pull request or enter an existing PR, then analyze review feedback, verify findings, apply fixes, and repeat until clear or bounded convergence. Use when the user invokes $forge-ship, asks to create or finish a PR, or wants Codex to address GitHub PR review comments. Accept a PR/Issue number or URL, --auto for commit and push, --max-rounds, and --depth.
---

# Forge Ship

PRを作成するか既存PRへ入り、レビュー指摘を検証・修正して収束させる。

## 必須参照

開始時に次をすべて読む。

- [workflow-core.md](../../references/workflow-core.md)
- [profile.md](../../references/profile.md)
- [contracts.md](../../references/contracts.md)
- [knowledge-packs.md](../../references/knowledge-packs.md)
- [roles.md](../../references/roles.md)

## 1. Preflightする

1. `$forge-ship` を使うこと、`--auto` の有無、対象をユーザーへ知らせる。
2. `gh auth status`、remote、現在branch、dirty state、upstream、baseを確認する。
3. profileとdepthを解決する。`--max-rounds` があればshipの反復上限を上書きするが、正の妥当な整数に制限する。
4. 引数がPR番号/URLなら既存PRモードとし、`gh pr view` でhead branchが現在のcheckoutと一致するか確認する。不一致なら勝手にcheckoutせずユーザーへ案内する。
5. 引数がIssue番号/URLならIssueを読み、PR本文のclosing referenceと受け入れ条件に使う。
6. protected branch上で直接作業しない。未コミット変更がある場合、`--auto` でなければcommit/pushしない。

## 2. PRを用意する

既存PRモードではこの段階を省く。

新規PRでは、baseとの差分、commit、検証結果、Issue、PR templateを読み、タイトルと本文を作る。本文にはsummary、変更点、test plan、リスク/rollback、Issue参照を含める。

- `--auto` なし: 必要なcommit/pushをユーザーへ依頼する。既にremote branchがありPR作成だけが依頼範囲なら `gh pr create` を実行する
- `--auto` あり: diffを再確認し、関連変更だけをcommitして通常pushする。force pushは禁止。続けて `gh pr create` を実行する

外部書き込みが呼び出しから明確でない場合は、作成前にタイトルと本文を見せて確認する。

## 3. レビューループを行う

各roundで `gh pr view`、review、review thread、issue comment、check statusを取得する。GraphQL/APIが必要ならread-only queryを使い、未解決threadと最新head SHAを識別する。

### Analyze

指摘を重複排除し、独立観点へ分ける。サブエージェントがあればarchitecture、security、tests、reuseなどに並列委譲する。各担当はread-onlyで、指摘の主張、現在コード、Issue要件を突合し、[contracts.md](../../references/contracts.md) のFindingsを返す。CI failureはログから根本原因を抽出する。

### Verify

親が各findingを `defect | judgment | spurious` に裁定する。古いheadへの指摘、既に修正済み、重複、再現しないものをspuriousとして記録する。曖昧なレビュー指摘は勝手に意図を拡張せず、必要ならPR上ではなく先にユーザーへ確認する。

### Fix

defectをseverity順に最小修正し、関連テストを実行する。変更後にdiffをレビューする。

- `--auto` あり: round単位で関連変更をcommitし通常pushする
- `--auto` なし: ローカル修正と検証まで行い、commit/pushが必要な地点でユーザーへ引き継ぐ

レビュー返信やthread resolveは、修正がremoteへ反映され、内容を正確に説明できる場合だけ行う。反対意見やスコープ判断を勝手に承認しない。

### Exit

- 検証済みdefectがなく、required checkが成功: `all-clear`
- defectキー集合が前roundと同じ: `converged`
- 最大round到達: `max-rounds`
- 新しいpushが必要だが `--auto` なし: `awaiting-user-push`

新しいheadへpushした後はレビュー/check状態を再取得してから次roundへ進む。待機は有界にし、外部CIが長時間継続する場合は現在状態とURLを報告して終了する。

## 4. 完了する

`.forge/reports/ship-<timestamp>.md` にPR URL、round、commit、checks、修正済み/残存defect、judgment、spurious、終了理由を保存する。

最終回答はPR URLと現在状態を先頭に置き、pushしたcommit、検証、未解決thread、失敗中/待機中check、次に必要な操作を報告する。
