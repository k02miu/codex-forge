---
name: forge-plan
description: Design a new GitHub Issue or revise an existing Issue through repository-backed, multi-perspective investigation and critique. Use when the user invokes $forge-plan, asks to turn a feature/fix/refactor/infra request into an implementation-ready Issue, or asks to revise an Issue number or URL. Accept --depth quick|standard|thorough.
---

# Forge Plan

設計要求を、実装可能で検証可能なGitHub Issueへ変換する。既存Issue番号またはURLなら改訂モードにする。

## 必須参照

開始時に次をすべて読む。

- [workflow-core.md](../../references/workflow-core.md)
- [profile.md](../../references/profile.md)
- [contracts.md](../../references/contracts.md)
- [knowledge-packs.md](../../references/knowledge-packs.md)
- [roles.md](../../references/roles.md)

## 1. 入力と前提を解決する

1. `$forge-plan` を使うことと、Issueを新規設計するか改訂するかをユーザーへ知らせる。
2. `gh auth status` とGitリポジトリを読み取り確認する。`gh` が使えなければIssue本文のドラフト作成まで続行し、外部書き込みだけを省く。
3. `#N` またはIssue URLなら改訂モードとし、`gh issue view <N> --comments` でタイトル、本文、ラベル、議論を取得する。それ以外は新規モードとする。
4. [profile.md](../../references/profile.md) に従って `.forge.json` を解決する。
5. `--depth`、profile、既定 `standard` の順にdepthを決める。
6. リポジトリから分かる事実を先に調べる。不足するプロダクト判断だけを簡潔に質問する。質問する場合は推奨案と理由を添える。

改訂モードでは、ユーザーが直したい点が入力から明白でなければ目的を確認する。既存Issue本文を消さず、議論で確定した内容を取り込む。

## 2. 調査観点を選ぶ

要求を `feature | fix | refactor | infra` に分類する。

| 種別 | 基本観点 | 条件付き追加 |
|---|---|---|
| feature | architecture, reuse, tests | UIならui、境界/認証ならsecurity、運用変更ならinfra |
| fix | architecture（根本原因）, reuse, tests（再現手順） | 同上 |
| refactor | architecture, reuse, tests | 互換性リスクに応じsecurityまたはinfra |
| infra | infra, security, reuse | 検証可能性のためtests |

profileの `review.dimensions` が配列なら優先する。depthの観点上限で切る。knowledge packsから各観点に必要な重点だけを追加する。

## 3. Surveyを実行する

サブエージェント機能があれば、観点ごとに独立タスクとして並列委譲する。利用できなければ同じ観点を親が順番に調査する。各タスクへ対象要求、既存Issue内容、profile、担当role、knowledge block、次の出力契約を渡す。

```json
{
  "perspective": "architecture | reuse | tests | security | ui | infra",
  "findings": ["一次情報に基づく所見"],
  "relatedFiles": ["repository/relative/path"],
  "risks": ["具体的なリスク"],
  "openQuestions": ["調べても解消できなかった事項"]
}
```

調査担当にはファイル変更と外部書き込みを禁止する。返却後、親が参照ファイルと主張を抜き取り確認し、矛盾を解消する。

## 4. DraftとCritiqueを行う

親が全Surveyを統合して次を作る。

- 簡潔なタイトル
- Why / What / How
- スコープ内 / スコープ外
- チェック可能な受け入れ条件
- 実装計画
- テスト・ロールバック・運用上の考慮
- [contracts.md](../../references/contracts.md) の4つのcritical decisions
- 未解決事項

Issue templateがあれば構造を尊重する。既存Issueの改訂では差分ではなく更新後本文全体を作る。

Critique回数は quick=0、standard=1、thorough=2。各巡回では中立の批評担当に、曖昧な受け入れ条件、根拠のない前提、過剰/不足スコープ、critical decision漏れ、検証不能な計画を探させる。blockingを親が確認し、妥当ならDraftを直す。open questionや未承認の重大判断が残る場合はIssueを書き込まずユーザーへ返す。

## 5. GitHubへ反映する

まずタイトルと本文の完成稿をユーザーへ提示する。外部書き込みが明示的に依頼済みでなければ、実行前に確認する。

- 新規: `gh issue create --title ... --body-file ...`
- 改訂: ユーザーに本文更新と補記コメントのどちらかを確認し、`gh issue edit` または `gh issue comment` を使う

一時ファイルを使う場合は安全な一時ディレクトリに置く。成功後はIssue URL、分類、主要判断、残ったopen questionを報告する。書き込みを省いた場合は、そのまま貼れる完成稿を返す。
