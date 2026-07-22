# Contracts

## Critical decisions

Issue設計と実装設計には必ず次の4キーを含める。該当しない場合も `status: notApplicable` と根拠を書く。

```json
{
  "backwardCompatibility": { "status": "required | accepted | notApplicable", "rationale": "..." },
  "securityTradeoff": { "status": "required | accepted | notApplicable", "rationale": "..." },
  "irreversibleAction": { "status": "required | accepted | notApplicable", "rationale": "..." },
  "dataModelChange": { "status": "required | accepted | notApplicable", "rationale": "..." }
}
```

`accepted` はユーザーが明示的に受容した場合だけ使う。未解決の重大判断があれば実装へ進めない。

## Findings

レビュー担当は次の構造で返す。

```json
{
  "findings": [
    {
      "file": "repo/relative/path",
      "line": 42,
      "category": "architecture | security | tests | ui | infra | reuse | spec | docs",
      "severity": "critical | high | medium | low",
      "claim": "問題の主張",
      "evidence": "具体的なコード・挙動・コマンド結果",
      "impact": "利用者またはシステムへの影響",
      "suggestion": "最小の修正案",
      "selfKind": "defect | judgment"
    }
  ]
}
```

証拠がない推測はfindingにしない。好み、将来の一般論、Issue外の改善提案は `judgment` として分離する。

## Verdicts

中立のVerify担当は各findingをコードと実行結果で再確認し、次で裁定する。

```json
{
  "verdicts": [
    { "index": 0, "kind": "defect | judgment | spurious", "reason": "一次情報による理由" }
  ]
}
```

- defect: 現在の変更で再現する具体的な不具合・要件未達
- judgment: 妥当な設計上の提案だが必須修正ではない
- spurious: 誤読、既に満たされている、再現しない、対象外

## Reports

`.forge/reports/<skill>-<timestamp>.md` は最低限、対象、実行コマンド、変更、修正済みdefect、残存defect、judgment、spurious監査、終了理由を含める。レポート書き込み失敗で作業全体を失敗させず、チャットに同内容を残す。
