# Workflow core

全Skillで共有する実行規約。

## 1. Codexでの実行モデル

親エージェントをリーダー兼中立裁定者とする。独立した調査・レビュー観点は、サブエージェント機能が利用可能なら並列委譲する。利用できない場合は、親が同じ役割を順番に実行する。ツールの同時実行枠を超える場合はバッチに分ける。

サブエージェントに渡すタスクは具体的かつ境界を明示し、対象リポジトリと必要な生データだけを共有する。各エージェントには1つの立場だけを割り当てる。実装担当以外にはファイルを変更させない。親は調査結果を統合し、指摘を裁定し、ユーザーとの対話と外部書き込みを担当する。

## 2. depth

| depth | 観点上限 | finish反復上限 | ship反復上限 |
|---|---:|---:|---:|
| quick | 2 | 2 | 2 |
| standard | 4 | 3 | 3 |
| thorough | 6 | 5 | 5 |

depthは観点数と反復数だけを変える。契約、検証、終了判定の厳しさは変えない。引数、`.forge.json.depthDefault`、`standard` の順に解決する。

## 3. ロール配置

- 中立: 親エージェント。Context、Draft、Integrate、Verify、Reportを担当する
- 実装: builder。許可された作業ツリーの変更と検証だけを担当する
- 観点: architecture、security、tests、ui、infra、reuse。各自の立場だけを主張する

役割の詳細は [roles.md](roles.md) を読む。プロジェクト固有の知識は [knowledge-packs.md](knowledge-packs.md) から注入する。

## 4. コミュニケーション

- Skillを使うことと目的を開始時に commentary でユーザーへ知らせる
- 60秒を超える作業では短い進捗を返す
- リポジトリから確認できる事実は質問しない。設計上の意思決定だけを質問する
- 最終回答は結果、検証、残課題、作成した外部リソースのURLをまとめる

## 5. 安全境界

- commit / push はユーザーの明示指示、または `forge-ship --auto` のときだけ行う
- Issue編集、コメント投稿、PR作成など外部書き込みは、Skill呼び出しで明確に依頼されていない限り実行前に確認する
- force push、履歴書換え、破壊的migration、`terraform apply/destroy`、本番変更、秘密情報の出力を行わない
- ユーザーの既存変更を保持し、無関係なdirty fileを編集しない
- サブエージェントはcommit/pushや外部書き込みを行わない

## 6. 検証と失敗

検証コマンドはプロファイルから選び、実行前にユーザーへ短く提示する。失敗時は原因を直して再実行する。権限・依存・環境の理由で実行できないコマンドは `skipped` として理由を残し、成功扱いにしない。

## 7. 収束判定

findingの安定キーを次で定義する。

```text
file | category | normalize(evidence or symbol)
```

`normalize` は連続空白を1つへ畳み、前後空白を除く。終了理由は次のいずれかにする。

- `all-clear`: defectが0件
- `converged`: 前回と今回のdefectキー集合が同じ
- `max-iterations`: depthの上限に到達

severityは修正順にのみ使い、終了条件には使わない。
