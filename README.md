# Hover Racing browser port

PS1版Hover Racingの提供ソースとデータを参考にしたTypeScript / Three.js版です。

- `HOVER_SOURCE/`: 原作ソース
- `HOVER120/`: 原作データ
- `hover-browser/`: ブラウザ版と変換・検証ツール

実行方法・移植内容・残る差分は [ブラウザ版README](hover-browser/README.md) を参照してください。

```sh
cd hover-browser
python3 start-server.py
```

開発時は `hover-browser/src/` を編集し、`npm ci` → `npm run build` で配信用JavaScriptを生成します。`npm test` でビルドと既存テストを実行します。
