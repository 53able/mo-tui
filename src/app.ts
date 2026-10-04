import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextAttributes,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core"
import { ACTIONS, commandFor, needsConfirmation, shellJoin, type Action } from "./actions.ts"

export const MIN_WIDTH = 48
export const MIN_HEIGHT = 12

export interface AppOptions {
  binary: string
  /** Runs the command with the real terminal and resolves to a status message. */
  run: (command: string[]) => Promise<string>
  exit: () => void
}

function badge(action: Action, preview: boolean): string {
  if (preview && action.preview) return "preview"
  return action.changes ? "変更あり" : "閲覧"
}

export function createApp(renderer: CliRenderer, { binary, run, exit }: AppOptions) {
  let preview = true
  let confirmation = false
  let running = false
  let status = ""

  const tooSmall = new TextRenderable(renderer, {
    id: "too-small",
    content: `端末を${MIN_WIDTH}列・${MIN_HEIGHT}行以上に広げてください。q: 終了`,
  })
  const main = new BoxRenderable(renderer, {
    id: "main",
    flexDirection: "column",
    flexGrow: 1,
    paddingLeft: 2,
    paddingRight: 1,
  })
  const title = new TextRenderable(renderer, {
    id: "title",
    content: "MOLE  /  Terminal Launcher",
    attributes: TextAttributes.BOLD,
  })
  const mode = new TextRenderable(renderer, { id: "mode", content: "" })
  const help = new TextRenderable(renderer, {
    id: "help",
    content: "↑↓ / j k: 選択   Enter: 開く   d: モード切替   q: 終了",
    marginBottom: 1,
  })
  const list = new SelectRenderable(renderer, {
    id: "actions",
    flexGrow: 1,
    options: [],
    wrapSelection: true,
    showDescription: false,
  })
  const detail = new TextRenderable(renderer, { id: "detail", content: "", marginTop: 1 })
  const command = new TextRenderable(renderer, { id: "command", content: "" })
  const message = new TextRenderable(renderer, { id: "message", content: "", marginTop: 1 })

  main.add(title)
  main.add(mode)
  main.add(help)
  main.add(list)
  main.add(detail)
  main.add(command)
  main.add(message)
  renderer.root.add(tooSmall)
  renderer.root.add(main)

  const selected = () => ACTIONS[list.getSelectedIndex()] ?? ACTIONS[0]!
  const currentCommand = () => commandFor(binary, selected(), preview)

  function refreshOptions() {
    const index = list.getSelectedIndex()
    list.options = ACTIONS.map((item) => ({
      name: `${item.label}  [${badge(item, preview)}]`,
      description: item.description,
    }))
    list.setSelectedIndex(index)
  }

  function refresh() {
    const small = renderer.width < MIN_WIDTH || renderer.height < MIN_HEIGHT
    tooSmall.visible = small
    main.visible = !small
    mode.content = preview ? "プレビュー優先（対応項目は dry-run）" : "実行モード（変更前に確認）"
    detail.content = `${list.getSelectedIndex() + 1}/${ACTIONS.length}  ${selected().description}`
    command.content = "$ " + shellJoin(currentCommand())
    message.content = confirmation ? "このコマンドを実行しますか？ y: 実行 / n・Esc: キャンセル" : status
    message.attributes = confirmation ? TextAttributes.BOLD : TextAttributes.NONE
    renderer.requestRender()
  }

  async function execute() {
    running = true
    try {
      status = await run(currentCommand())
    } finally {
      running = false
      refresh()
    }
  }

  function open() {
    if (needsConfirmation(selected(), preview)) {
      confirmation = true
      refresh()
    } else {
      void execute()
    }
  }

  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    const name = key.name.toLowerCase()
    if (running) {
      key.stopPropagation()
      return
    }
    if (!main.visible) {
      key.stopPropagation()
      if (name === "q" || name === "escape") exit()
      return
    }
    if (confirmation) {
      key.stopPropagation()
      if (name === "y") {
        confirmation = false
        void execute()
      } else if (name === "n" || name === "escape" || name === "q") {
        confirmation = false
        status = "キャンセルしました"
        refresh()
      }
      return
    }
    if (name === "q" || name === "escape") {
      key.stopPropagation()
      exit()
    } else if (name === "d") {
      key.stopPropagation()
      preview = !preview
      refreshOptions()
      refresh()
    }
  })

  list.on(SelectRenderableEvents.SELECTION_CHANGED, refresh)
  list.on(SelectRenderableEvents.ITEM_SELECTED, open)
  renderer.on("resize", refresh)

  refreshOptions()
  list.focus()
  refresh()
}
