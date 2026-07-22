---
name: forge-work
description: Investigate, design, implement, and verify a GitHub Issue or small free-text coding task with stack-aware perspectives and explicit decision contracts. Use when the user invokes $forge-work, asks to implement an Issue number or URL, or wants a bounded change implemented without first creating an Issue. Accept --depth quick|standard|thorough.
---

# Forge Work

Issueまたは自由文の小規模タスクを調査し、残作業を設計して実装・検証する。

## 必須参照

開始時に次をすべて読む。

- [workflow-core.md](../../references/workflow-core.md)
- [profile.md](../../references/profile.md)
- [contracts.md](../../references/contracts.md)
- [knowledge-packs.md](../../references/knowledge-packs.md)
- [roles.md](../../references/roles.md)

## 1. Contextを確定する

1. `$forge-work` を使うことと対象をユーザーへ知らせる。
2. Issue番号/URLなら `gh issue view <N> --comments` を読み、目的、受け入れ条件、議論を抽出する。自由文ならそのまま要求とし、完了時に事後Issue化を提案する。
3. [profile.md](../../references/profile.md) に従って `.forge.json` を解決し、depthを決める。
4. `git status --short`、現在ブランチ、base、最近のcommitを確認する。ユーザーの既存変更を識別して保持する。
5. `scripts/diff-summary.sh [base]` 相当の読み取りを行う。baseとの差分が既にあれば引き継ぎモードにし、要件に対する `done[] / remaining[] / concerns[]` を作る。

Issueが読めなくても自由文から安全に進められるなら続行する。要求の意味を変えるプロダクト判断、不可逆変更、重大な互換性判断だけを質問する。

## 2. 調査と設計を行う

要求を `feature | fix | refactor | infra` に分類し、forge-planと同じ基本観点からdepth上限まで選ぶ。fixではarchitectureに根本原因、testsに再現テストを明示する。

サブエージェントが利用可能なら、独立した調査観点を並列委譲する。全員をread-onlyにし、担当roleとknowledge blockを1つだけ与える。利用できなければ親が順番に行う。親は結果を一次情報で統合し、次を含む実装設計を作る。

- 変更対象と責務
- 手順と依存順
- 受け入れ条件への対応
- テスト計画と実行コマンド
- rollbackまたは失敗時の扱い
- [contracts.md](../../references/contracts.md) のcritical decisions
- 引き継ぎモードでは残作業だけ

fixでは、可能なら修正前に失敗する最小の再現テストを作り、失敗を確認してから実装修正へ進む。テストが不適切な場合は再現コマンドまたは明確な理由を残す。

critical decisionが `required` のまま、または設計が要求を超えて広がる場合は実装前にユーザーへ確認する。

## 3. 実装する

作業を依存関係のある小単位に分け、計画をユーザーに見える形で管理する。

- 互いに独立で編集範囲が重ならない作業だけを並列化する
- 同一ファイルや同じAPI境界を触る作業は直列化する
- builderには対象ファイル、設計、禁止事項、検証方法を明示する
- builderの変更後、親が必ずdiffを読む
- 親自身が実装する場合も同じ境界を守る

最小差分を優先し、既存の規約・依存・抽象化を再利用する。無関係な整形、依存更新、リファクタを混ぜない。commit/pushは行わない。

## 4. 検証する

次の順で、利用可能な最小スコープから広げる。

1. 変更箇所の直接テストまたは再現手順
2. typecheck / lint
3. 関連テスト
4. 必要な場合だけ全体test / build

失敗は修正して再実行する。既存障害と判断する場合も、変更前の状態、対象外である証拠、影響を記録する。受け入れ条件を1項目ずつ実装とテストへ対応付ける。

必要に応じてread-onlyの最終レビュー担当を1名起動し、要件漏れと回帰だけを確認させる。親がfindingを検証し、defectなら修正・再検証する。

## 5. 完了する

`.forge/reports/work-<timestamp>.md` に、要求、設計判断、変更、検証、残課題を書く。最終回答では次を簡潔に報告する。

- 実装結果と主なファイル
- 実行した検証と結果
- 未実行/失敗した検証と理由
- 残課題または判断事項
- Issueなしで開始した場合は事後Issue化の提案（勝手に作成しない）
