# Knowledge packs

`.forge.json.stack` と変更内容から必要な観点だけを選び、調査・レビュー担当のプロンプトに「知識ソース」として追加する。外部ドキュメントが必要なら、利用可能な公式ドキュメント用Skill/MCPを優先し、一次情報を引用する。

| pack | 重点 |
|---|---|
| typescript | strictness、型の抜け道、floating promise、ESM/CJS境界 |
| react | hooks依存、render副作用、状態所有、a11y |
| nextjs | server/client境界、cache、route handler、metadata |
| python | 型、例外境界、resource管理、async混在 |
| go | context伝播、goroutine leak、error wrapping、race |
| rust | ownership回避、unsafe境界、panic、Send/Sync |
| sql | transaction、index、lock、migration互換性 |
| api | schema互換性、認証認可、rate limit、idempotency |
| aws | IAM最小権限、region、暗号化、rollback |
| gcp | IAM最小権限、service account、project境界、rollback |
| terraform | state、drift、provider pin、replace計画。applyはしない |

明示された `knowledge.packs` を優先し、スタックから明白なpackを補う。`knowledge.extra` のファイルが存在すれば必要なものだけ読む。該当しないpackを大量注入しない。
