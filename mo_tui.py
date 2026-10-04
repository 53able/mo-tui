#!/usr/bin/env python3
"""A small terminal launcher for Mole; Python standard library only."""
import argparse
import curses
from dataclasses import dataclass
import os
import shlex
import shutil
import signal
import subprocess
import sys
import unicodedata


@dataclass(frozen=True)
class Action:
    label: str
    args: tuple[str, ...]
    description: str
    changes: bool = False
    preview: bool = False


ACTIONS = (
    Action("システム状態", ("status",), "CPU・メモリなどを監視。Ctrl+C で終了。"),
    Action("ディスク使用量", ("analyze",), "ディスク使用量を表示。Mole の操作で終了。"),
    Action("クリーンアップ", ("clean",), "キャッシュなどを整理。", True, True),
    Action("最適化", ("optimize",), "キャッシュとサービスをリフレッシュ。", True, True),
    Action("プロジェクト整理", ("purge",), "古いプロジェクト成果物を削除。", True, True),
    Action("インストーラー整理", ("installer",), "不要なインストーラーを削除。", True, True),
    Action("アプリ削除", ("uninstall",), "Mole の画面で削除対象アプリを選択。", True, True),
    Action("クリーンアップ履歴", ("history",), "過去のクリーンアップ履歴を確認。"),
    Action("保護対象：クリーン", ("clean", "--whitelist"), "削除から保護するキャッシュを管理。", True),
    Action("保護対象：最適化", ("optimize", "--whitelist"), "最適化から保護する項目を管理。", True),
    Action("プロジェクト検索先", ("purge", "--paths"), "プロジェクトの検索ディレクトリを設定。", True),
    Action("Touch ID 設定", ("touchid", "enable"), "sudo 用の Touch ID を設定。", True, True),
    Action("シェル補完", ("completion",), "シェルのタブ補完を設定。", True, True),
    Action("Mole 更新：正式版", ("update",), "最新の正式版へ更新。", True),
    Action("Mole 更新：Nightly", ("update", "--nightly"), "未リリースの開発版へ更新。", True),
    Action("Mole を削除", ("remove",), "Mole 自体をアンインストール。", True, True),
    Action("Mole ヘルプ", ("--help",), "利用可能なコマンドを表示。"),
    Action("Mole バージョン", ("--version",), "インストール済みバージョンを表示。"),
)


def command_for(binary, action, preview):
    command = [binary, *action.args]
    if preview and action.preview:
        command.append("--dry-run")
    return command


def needs_confirmation(action, preview):
    return action.changes and not (preview and action.preview)


def clipped(text, width):
    result, used = [], 0
    for character in text:
        size = 0 if unicodedata.combining(character) else (
            2 if unicodedata.east_asian_width(character) in "WF" else 1
        )
        if used + size > width:
            break
        result.append(character)
        used += size
    return "".join(result)


def write(screen, y, x, text, style=0):
    height, width = screen.getmaxyx()
    if 0 <= y < height and 0 <= x < width - 1:
        try:
            screen.addstr(y, x, clipped(text, width - x - 1), style)
        except curses.error:
            pass


def run_command(screen, command):
    """Give Mole the real terminal, including input, colors and sudo prompts."""
    curses.def_prog_mode()
    curses.endwin()
    status = ""
    try:
        print("\n$ " + shlex.join(command), flush=True)
        process = subprocess.Popen(command)
        previous = signal.signal(signal.SIGINT, signal.SIG_IGN)
        try:
            code = process.wait()
        finally:
            signal.signal(signal.SIGINT, previous)
        status = "完了" if code == 0 else f"終了コード: {code}"
        print(f"\n{status} — Enter でメニューへ戻ります", flush=True)
        try:
            input()
        except (KeyboardInterrupt, EOFError):
            pass
    except OSError as error:
        status = f"実行エラー: {error}"
    finally:
        curses.reset_prog_mode()
        screen.clear()
        screen.refresh()
    return status


def menu(screen, binary):
    try:
        curses.curs_set(0)
    except curses.error:
        pass
    screen.keypad(True)
    selected, top, preview = 0, 0, True
    confirmation, status = False, ""
    while True:
        height, width = screen.getmaxyx()
        screen.erase()
        if height < 12 or width < 48:
            write(screen, 0, 0, "端末を48列・12行以上に広げてください。q: 終了")
            screen.refresh()
            if screen.getch() in (ord("q"), ord("Q"), 27):
                return
            continue
        action = ACTIONS[selected]
        command = command_for(binary, action, preview)
        rows = height - 9
        top = max(0, min(top, selected))
        if selected >= top + rows:
            top = selected - rows + 1
        write(screen, 0, 2, "MOLE  /  Terminal Launcher", curses.A_BOLD)
        mode = "プレビュー優先（対応項目は dry-run）" if preview else "実行モード（変更前に確認）"
        write(screen, 1, 2, mode)
        write(screen, 2, 2, "↑↓ / j k: 選択   Enter: 開く   d: モード切替   q: 終了")
        for index in range(top, min(len(ACTIONS), top + rows)):
            item = ACTIONS[index]
            badge = "preview" if preview and item.preview else ("変更あり" if item.changes else "閲覧")
            style = curses.A_REVERSE if index == selected else 0
            write(screen, 4 + index - top, 2, f"{'›' if index == selected else ' '} {item.label}  [{badge}]", style)
        write(screen, height - 5, 2, f"{selected + 1}/{len(ACTIONS)}  {action.description}")
        write(screen, height - 4, 2, "$ " + shlex.join(command))
        message = "このコマンドを実行しますか？ y: 実行 / n・Esc: キャンセル" if confirmation else status
        write(screen, height - 2, 2, message, curses.A_BOLD if confirmation else 0)
        screen.refresh()
        key = screen.getch()
        if key == curses.KEY_RESIZE:
            continue
        if confirmation:
            if key in (ord("y"), ord("Y")):
                status = run_command(screen, command)
                confirmation = False
            elif key in (ord("n"), ord("N"), 27, ord("q")):
                confirmation = False
                status = "キャンセルしました"
            continue
        if key in (ord("q"), ord("Q"), 27):
            return
        if key in (curses.KEY_DOWN, ord("j")):
            selected = (selected + 1) % len(ACTIONS)
        elif key in (curses.KEY_UP, ord("k")):
            selected = (selected - 1) % len(ACTIONS)
        elif key in (ord("d"), ord("D")):
            preview = not preview
        elif key in (10, 13, curses.KEY_ENTER):
            if needs_confirmation(action, preview):
                confirmation = True
            else:
                status = run_command(screen, command)


def main():
    parser = argparse.ArgumentParser(description="Mole を操作する簡易 TUI（追加依存なし）")
    parser.add_argument("--list", action="store_true", help="初期モードのコマンド一覧を表示")
    parser.add_argument("--mo-bin", default="mo", help="Mole 実行ファイル（既定: PATH の mo）")
    args = parser.parse_args()
    binary = shutil.which(args.mo_bin)
    if not binary:
        parser.exit(1, "Mole が見つかりません。mo --version を確認してください。\n")
    if args.list:
        for action in ACTIONS:
            print(f"{action.label}: {shlex.join(command_for(binary, action, True))}")
        return
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        parser.exit(1, "対話端末で mo-tui を実行してください。一覧は --list で表示できます。\n")
    os.environ.setdefault("ESCDELAY", "25")
    try:
        curses.wrapper(menu, binary)
    except KeyboardInterrupt:
        pass
    except curses.error as error:
        parser.exit(1, f"端末の初期化に失敗しました: {error}\n")


if __name__ == "__main__":
    main()
