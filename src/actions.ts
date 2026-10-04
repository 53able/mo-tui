export interface Action {
  readonly label: string
  readonly args: readonly string[]
  readonly description: string
  readonly changes: boolean
  readonly preview: boolean
}

const action = (
  label: string,
  args: readonly string[],
  description: string,
  changes = false,
  preview = false,
): Action => ({ label, args, description, changes, preview })

export const ACTIONS: readonly Action[] = [
  action("システム状態", ["status"], "CPU・メモリなどを監視。Ctrl+C で終了。"),
  action("ディスク使用量", ["analyze"], "ディスク使用量を表示。Mole の操作で終了。"),
  action("クリーンアップ", ["clean"], "キャッシュなどを整理。", true, true),
  action("最適化", ["optimize"], "キャッシュとサービスをリフレッシュ。", true, true),
  action("プロジェクト整理", ["purge"], "古いプロジェクト成果物を削除。", true, true),
  action("インストーラー整理", ["installer"], "不要なインストーラーを削除。", true, true),
  action("アプリ削除", ["uninstall"], "Mole の画面で削除対象アプリを選択。", true, true),
  action("クリーンアップ履歴", ["history"], "過去のクリーンアップ履歴を確認。"),
  action("保護対象：クリーン", ["clean", "--whitelist"], "削除から保護するキャッシュを管理。", true),
  action("保護対象：最適化", ["optimize", "--whitelist"], "最適化から保護する項目を管理。", true),
  action("プロジェクト検索先", ["purge", "--paths"], "プロジェクトの検索ディレクトリを設定。", true),
  action("Touch ID 設定", ["touchid", "enable"], "sudo 用の Touch ID を設定。", true, true),
  action("シェル補完", ["completion"], "シェルのタブ補完を設定。", true, true),
  action("Mole 更新：正式版", ["update"], "最新の正式版へ更新。", true),
  action("Mole 更新：Nightly", ["update", "--nightly"], "未リリースの開発版へ更新。", true),
  action("Mole を削除", ["remove"], "Mole 自体をアンインストール。", true, true),
  action("Mole ヘルプ", ["--help"], "利用可能なコマンドを表示。"),
  action("Mole バージョン", ["--version"], "インストール済みバージョンを表示。"),
]

export function commandFor(binary: string, action: Action, preview: boolean): string[] {
  const command = [binary, ...action.args]
  if (preview && action.preview) command.push("--dry-run")
  return command
}

export function needsConfirmation(action: Action, preview: boolean): boolean {
  return action.changes && !(preview && action.preview)
}

/** Display-only equivalent of Python's shlex.join; commands are never run through a shell. */
export function shellJoin(args: readonly string[]): string {
  return args
    .map((arg) => {
      if (arg === "") return "''"
      if (/^[\w@%+=:,./-]+$/.test(arg)) return arg
      return "'" + arg.replaceAll("'", `'"'"'`) + "'"
    })
    .join(" ")
}
