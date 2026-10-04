import { afterEach, expect, test } from "bun:test"
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { createApp } from "../src/app.ts"

let setup: TestRendererSetup | undefined
let calls: string[][]
let exits: number

afterEach(() => {
  setup?.renderer.destroy()
  setup = undefined
})

async function start(width = 80, height = 30) {
  setup = await createTestRenderer({ width, height })
  calls = []
  exits = 0
  createApp(setup.renderer, {
    binary: "/bin/mo",
    run: async (command) => {
      calls.push(command)
      return "完了"
    },
    exit: () => {
      exits++
    },
  })
  return frame()
}

async function frame() {
  await setup!.renderOnce()
  return setup!.captureCharFrame()
}

async function press(...keys: string[]) {
  for (const key of keys) setup!.mockInput.pressKey(key)
  // A lone Escape is only recognised after the stdin parser's 20 ms timeout.
  await Bun.sleep(keys.includes("ESCAPE") ? 50 : 0)
  return frame()
}

async function select(label: string) {
  for (let i = 0; i < 18; i++) {
    const current = await frame()
    if (current.includes(`▶ ${label}`)) return current
    await press("j")
  }
  throw new Error(`${label} not found`)
}

test("initial frame shows title, mode and the first action", async () => {
  const text = await start()
  expect(text).toContain("MOLE  /  Terminal Launcher")
  expect(text).toContain("プレビュー優先")
  expect(text).toContain("▶ システム状態  [閲覧]")
  expect(text).toContain("1/18  CPU・メモリなどを監視。Ctrl+C で終了。")
  expect(text).toContain("$ /bin/mo status")
})

test("j and k wrap around the list", async () => {
  await start()
  let text = ""
  for (let i = 0; i < 18; i++) text = await press("j")
  expect(text).toContain("1/18")
  text = await press("k")
  expect(text).toContain("18/18")
  expect(text).toContain("$ /bin/mo --version")
})

test("d switches to run mode and drops --dry-run", async () => {
  await start()
  let text = await select("クリーンアップ  [preview]")
  expect(text).toContain("$ /bin/mo clean --dry-run")
  text = await press("d")
  expect(text).toContain("実行モード")
  expect(text).toContain("▶ クリーンアップ  [変更あり]")
  expect(text).toContain("$ /bin/mo clean")
  expect(text).not.toContain("--dry-run")
})

test("run mode asks before running and y runs the exact argv once", async () => {
  await start()
  await press("d")
  await select("クリーンアップ")
  let text = await press("RETURN")
  expect(text).toContain("このコマンドを実行しますか？")
  expect(calls).toEqual([])
  text = await press("j")
  expect(text).toContain("▶ クリーンアップ")
  text = await press("y")
  expect(calls).toEqual([["/bin/mo", "clean"]])
  expect(text).toContain("完了")
})

test("n cancels the confirmation without running", async () => {
  await start()
  await press("d")
  await select("クリーンアップ")
  await press("RETURN")
  const text = await press("n")
  expect(text).toContain("キャンセルしました")
  expect(calls).toEqual([])
})

test("preview mode runs dry-run commands without confirmation", async () => {
  await start()
  await select("クリーンアップ")
  await press("RETURN")
  expect(calls).toEqual([["/bin/mo", "clean", "--dry-run"]])
})

test("updates require confirmation even in preview mode", async () => {
  await start()
  await select("Mole 更新：正式版")
  const text = await press("RETURN")
  expect(text).toContain("このコマンドを実行しますか？")
  expect(calls).toEqual([])
})

test("small terminals only show the resize warning", async () => {
  const text = await start(40, 10)
  expect(text).toContain("端末を48列・12行以上に広げてください")
  expect(text).not.toContain("MOLE")
  await press("q")
  expect(exits).toBe(1)
})

test("resizing to a small terminal hides the menu", async () => {
  await start()
  setup!.resize(40, 10)
  const text = await frame()
  expect(text).toContain("端末を48列・12行以上に広げてください")
  expect(text).not.toContain("MOLE")
})

test("Japanese labels fit a 48 column terminal", async () => {
  const text = await start(48, 12)
  expect(text).toContain("▶ システム状態  [閲覧]")
  for (const line of text.split("\n")) expect(Bun.stringWidth(line)).toBeLessThanOrEqual(48)
})

test("q exits", async () => {
  await start()
  await press("q")
  expect(exits).toBe(1)
})

test("Escape cancels the confirmation, arrows move, Escape exits", async () => {
  await start()
  await press("d")
  await select("クリーンアップ")
  await press("RETURN")
  let text = await press("ESCAPE")
  expect(text).toContain("キャンセルしました")
  expect(exits).toBe(0)
  text = await press("ARROW_DOWN")
  expect(text).toContain("▶ 最適化")
  text = await press("ARROW_UP")
  expect(text).toContain("▶ クリーンアップ")
  await press("ESCAPE")
  expect(exits).toBe(1)
})
