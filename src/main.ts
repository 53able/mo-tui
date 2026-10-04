#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { parseArgs } from "node:util"
import { ACTIONS, commandFor, shellJoin } from "./actions.ts"
import { createApp } from "./app.ts"
import { runCommand } from "./run.ts"

const USAGE = `usage: mo-tui [-h] [--list] [--mo-bin MO_BIN]

Mole を操作する簡易 TUI（OpenTUI 製）

options:
  -h, --help       このヘルプを表示して終了
  --list           初期モードのコマンド一覧を表示
  --mo-bin MO_BIN  Mole 実行ファイル（既定: PATH の mo）
`

function fail(message: string): never {
  process.stderr.write(message + "\n")
  process.exit(1)
}

let values
try {
  ;({ values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
      list: { type: "boolean" },
      "mo-bin": { type: "string", default: "mo" },
    },
  }))
} catch (error) {
  fail(`${USAGE}\nmo-tui: error: ${error instanceof Error ? error.message : String(error)}`)
}

if (values.help) {
  process.stdout.write(USAGE)
  process.exit(0)
}

const binary = Bun.which(values["mo-bin"])
if (!binary) fail("Mole が見つかりません。mo --version を確認してください。")

if (values.list) {
  for (const action of ACTIONS) {
    console.log(`${action.label}: ${shellJoin(commandFor(binary, action, true))}`)
  }
  process.exit(0)
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  fail("対話端末で mo-tui を実行してください。一覧は --list で表示できます。")
}

let renderer
try {
  renderer = await createCliRenderer({ exitOnCtrlC: true })
} catch (error) {
  fail(`端末の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
}

createApp(renderer, {
  binary,
  run: (command) => runCommand(renderer, command),
  exit: () => {
    renderer.destroy()
    process.exit(0)
  },
})
