import unittest

from mo_tui import ACTIONS, clipped, command_for, needs_confirmation


class CommandTests(unittest.TestCase):
    def test_preview_is_used_only_for_supported_commands(self):
        supported = {"clean", "optimize", "purge", "installer", "uninstall", "touchid", "completion", "remove"}
        for action in ACTIONS:
            command = command_for("/path with spaces/mo", action, True)
            self.assertEqual(command[0], "/path with spaces/mo")
            self.assertEqual("--dry-run" in command, action.preview)
            if action.preview:
                self.assertIn(action.args[0], supported)

    def test_real_mutations_always_require_confirmation(self):
        for action in ACTIONS:
            self.assertEqual(needs_confirmation(action, False), action.changes)
            self.assertEqual(needs_confirmation(action, True), action.changes and not action.preview)
            self.assertNotIn("--dry-run", command_for("mo", action, False))

    def test_read_only_and_updates_are_not_mislabelled_as_preview(self):
        for action in ACTIONS:
            if action.args[0] in {"status", "analyze", "history", "update", "--help", "--version"}:
                self.assertFalse(action.preview)
            if action.args[0] == "update":
                self.assertTrue(needs_confirmation(action, True))

    def test_japanese_and_combining_characters_fit_terminal_width(self):
        self.assertEqual(clipped("日本語", 5), "日本")
        self.assertEqual(clipped("e\u0301x", 1), "e\u0301")
        self.assertEqual(clipped("abc", 0), "")


if __name__ == "__main__":
    unittest.main()
