# Project profile

各Skillはプロジェクトルートの `.forge.json` を使用する。

## 解決順

1. Skill引数で明示された値
2. 既存の `.forge.json`
3. リポジトリからの自動検出

自動検出では、Git remote/branch、manifest、lockfile、CI、lint/test設定、IaC、Issue/PR template、レビュー規約を読み取る。推測できない値は `null` のままにする。初回だけ `.forge.json` を作成してユーザーに知らせ、以降は勝手に再検出しない。

```json
{
  "version": 1,
  "detectedAt": "2026-07-22",
  "language": { "docs": "ja" },
  "git": { "baseBranch": "main", "protectedBranches": ["main"] },
  "commands": { "typecheck": null, "lint": null, "test": null, "build": null },
  "stack": { "packageManager": null, "languages": [], "frameworks": [], "clouds": [] },
  "paths": { "issueTemplate": null, "prTemplate": null, "reviewChecklist": null },
  "knowledge": { "packs": [], "extra": [] },
  "review": { "dimensions": null, "externalReviewers": [] },
  "depthDefault": "standard"
}
```

コマンドはmanifestの実在するscriptやプロジェクト文書に基づいて設定する。シェル断片や秘密情報をプロファイルへ保存しない。スタック変更時は該当フィールドを `null` に戻すか削除し、次回実行時に再検出する。
