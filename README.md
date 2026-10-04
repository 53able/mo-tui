# mo-tui

Mole のコマンドを選んで実行する、[OpenTUI](https://opentui.com/) 製の簡易 TUI。

```sh
mo-tui
```

矢印キーまたは `j` / `k` で選択、Enter で実行、`d` でプレビュー優先と実行モードを切り替え、`q` で終了します。

初期状態はプレビュー優先です。Mole が対応する項目には `--dry-run` が付きます。プレビュー非対応の更新・設定変更などと、実行モードの変更操作は `y` での確認が必要です。確認画面には実際のコマンドが表示されます。

コマンド実行中は通常の端末へ切り替わり、Mole 本来の TUI、確認画面、sudo 入力を利用できます。Mole の操作で終了すると、Enter でランチャーへ戻ります。`mo status` は Ctrl+C で終了します。コマンドは引数配列で直接起動し、シェルには渡しません。

```sh
mo-tui --list
mo-tui --help
```

コマンド一覧は Mole 1.56.1 のヘルプに合わせています。

## 開発

[Bun](https://bun.sh/) 1.3 以上が必要です（macOS arm64 で動作確認）。OpenTUI はネイティブライブラリを FFI で読み込むため、Node.js では動かしません。

```sh
bun install
bun test
bun run typecheck
bun src/main.ts
```

- `src/actions.ts`: コマンド一覧、`--dry-run` の付与、確認要否の判定
- `src/app.ts`: 画面とキー操作（`@opentui/core` の命令的 API）
- `src/run.ts`: レンダラーを一時停止し、Mole へ端末を渡して実行
- `src/main.ts`: 引数解析と起動

## 起動リンクの設定

Mole の `mo` コマンドと Bun が PATH 上に必要です。リポジトリのルートで `bun install` の後に以下を実行すると、このコピーを起動できます。既存のリンクを置き換えるため、切り替える場合だけ実行してください。

```sh
mkdir -p ~/.local/bin
ln -sfn "$PWD/src/main.ts" ~/.local/bin/mo-tui
```

`~/.local/bin` を PATH に含めてください。このプロジェクトの作成時には既存の起動リンクは変更していません。

## 謝辞

このツールは、[Tw93](https://github.com/tw93) 氏と[コントリビューターの皆さん](https://github.com/tw93/Mole/graphs/contributors)が開発する [Mole](https://github.com/tw93/Mole) を呼び出すランチャーです。Mac のメンテナンス機能を実装し、オープンソースとして公開・保守してくださっている皆さんに感謝します。

クリーンアップや最適化などの機能は Mole が提供するもので、mo-tui 自体が実装しているものではありません。mo-tui は Mole の公式プロジェクトではありません。

画面描画には [OpenTUI](https://github.com/anomalyco/opentui)（MIT License）を使用しています。
