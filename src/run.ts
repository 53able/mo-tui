import type { CliRenderer } from "@opentui/core"
import { createInterface } from "node:readline"
import { shellJoin } from "./actions.ts"

/** Wait for Enter; Ctrl+C also returns to the menu. */
async function waitForEnter() {
  const reader = createInterface({ input: process.stdin })
  let done = () => {}
  try {
    await new Promise<void>((resolve) => {
      done = resolve
      reader.once("line", done)
      reader.once("close", done)
      process.once("SIGINT", done)
    })
  } finally {
    process.off("SIGINT", done)
    reader.close()
    process.stdin.pause()
  }
}

/** Give Mole the real terminal, including input, colors and sudo prompts. */
export async function runCommand(renderer: CliRenderer, command: string[]): Promise<string> {
  renderer.suspend()
  // The renderer drops its signal handlers while suspended; keep Ctrl+C for the child only.
  const ignore = () => {}
  process.on("SIGINT", ignore)
  let status: string
  try {
    process.stdout.write("\n$ " + shellJoin(command) + "\n")
    try {
      const child = Bun.spawn(command, { stdio: ["inherit", "inherit", "inherit"] })
      const code = await child.exited
      status = code === 0 ? "完了" : `終了コード: ${code}`
    } catch (error) {
      status = `実行エラー: ${error instanceof Error ? error.message : String(error)}`
    } finally {
      process.off("SIGINT", ignore)
    }
    process.stdout.write(`\n${status} — Enter でメニューへ戻ります\n`)
    await waitForEnter()
  } finally {
    process.off("SIGINT", ignore)
    renderer.resume()
    renderer.requestRender()
  }
  return status
}
