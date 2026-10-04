import { describe, expect, test } from "bun:test"
import { ACTIONS, commandFor, needsConfirmation, shellJoin } from "../src/actions.ts"

describe("commands", () => {
  test("preview is used only for supported commands", () => {
    const supported = new Set(["clean", "optimize", "purge", "installer", "uninstall", "touchid", "completion", "remove"])
    for (const action of ACTIONS) {
      const command = commandFor("/path with spaces/mo", action, true)
      expect(command[0]).toBe("/path with spaces/mo")
      expect(command.includes("--dry-run")).toBe(action.preview)
      if (action.preview) expect(supported.has(action.args[0]!)).toBe(true)
    }
  })

  test("real mutations always require confirmation", () => {
    for (const action of ACTIONS) {
      expect(needsConfirmation(action, false)).toBe(action.changes)
      expect(needsConfirmation(action, true)).toBe(action.changes && !action.preview)
      expect(commandFor("mo", action, false)).not.toContain("--dry-run")
    }
  })

  test("read-only and updates are not mislabelled as preview", () => {
    for (const action of ACTIONS) {
      if (["status", "analyze", "history", "update", "--help", "--version"].includes(action.args[0]!)) {
        expect(action.preview).toBe(false)
      }
      if (action.args[0] === "update") expect(needsConfirmation(action, true)).toBe(true)
    }
  })

  test("shellJoin quotes like shlex.join", () => {
    expect(shellJoin(["/path with spaces/mo", "clean", "--dry-run"])).toBe("'/path with spaces/mo' clean --dry-run")
    expect(shellJoin(["it's"])).toBe(`'it'"'"'s'`)
    expect(shellJoin([""])).toBe("''")
    expect(shellJoin(["a@b%c+d=e:f,g./h-i_j"])).toBe("a@b%c+d=e:f,g./h-i_j")
  })
})
