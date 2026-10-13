import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("sync_wiki", Path(__file__).parents[1] / "sync_wiki.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
SHA = "a" * 40
REPO = "HyunKN/visual-travel-guide"


class WikiPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "source"
        self.wiki = Path(self.temp.name) / "wiki"
        (self.root / "docs").mkdir(parents=True)
        (self.root / ".github").mkdir()
        (self.wiki / ".git").mkdir(parents=True)
        (self.root / "AGENTS.md").write_text("# Agent rules\n", encoding="utf-8")
        (self.root / "docs/README.md").write_text("# Guide\n[Rules](../AGENTS.md)\n", encoding="utf-8")
        (self.wiki / "Home.md").write_text("Original Wiki welcome\n", encoding="utf-8")
        (self.wiki / "Report.md").write_text("Original report\n", encoding="utf-8")
        self.mapping = {"docs/README.md": "Development-Home"}

    def render(self):
        return sync.render_pages(self.root, self.mapping, REPO, SHA)

    def snapshot(self):
        return {p.name: p.read_bytes() for p in self.wiki.iterdir() if p.is_file()}

    def test_rewrites_published_and_source_links_and_keeps_fragments(self):
        (self.root / "docs/DESIGN.md").write_text("# Design\n", encoding="utf-8")
        self.mapping["docs/DESIGN.md"] = "DESIGN"
        (self.root / "docs/README.md").write_text(
            "[Design](DESIGN.md#states)\n[Rules](../AGENTS.md)\n[External](https://example.com)\n[Local](#guide)\n",
            encoding="utf-8",
        )
        page = self.render()["Development-Home.md"]
        self.assertIn(f"https://github.com/{REPO}/wiki/DESIGN#states", page)
        self.assertIn(f"https://github.com/{REPO}/blob/{SHA}/AGENTS.md", page)
        self.assertIn("[External](https://example.com)", page)
        self.assertIn("[Local](#guide)", page)
        self.assertIn(SHA[:12], page)

    def test_existing_report_and_home_are_preserved_and_repeat_is_identical(self):
        report = (self.wiki / "Report.md").read_bytes()
        sync.sync_pages(self.wiki, self.render(), REPO, SHA)
        before = self.snapshot()
        sync.sync_pages(self.wiki, self.render(), REPO, SHA)
        self.assertEqual(before, self.snapshot())
        self.assertEqual(report, (self.wiki / "Report.md").read_bytes())
        self.assertTrue((self.wiki / "Home.md").read_text(encoding="utf-8").startswith("Original Wiki welcome\n"))

    def test_conflict_fails_before_any_page_changes(self):
        (self.wiki / "Development-Home.md").write_text("User maintained page\n", encoding="utf-8")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "name conflict"):
            sync.sync_pages(self.wiki, self.render(), REPO, SHA)
        self.assertEqual(before, self.snapshot())

    def test_existing_unmanaged_sidebar_is_not_replaced(self):
        (self.wiki / "_Sidebar.md").write_text("Manual links\n", encoding="utf-8")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "name conflict"):
            sync.sync_pages(self.wiki, self.render(), REPO, SHA)
        self.assertEqual(before, self.snapshot())

    def test_rename_removes_only_previously_managed_page(self):
        (self.root / "docs/OLD.md").write_text("# Older design\n", encoding="utf-8")
        self.mapping["docs/OLD.md"] = "OLD"
        sync.sync_pages(self.wiki, self.render(), REPO, SHA)
        (self.root / "docs/OLD.md").rename(self.root / "docs/NEW.md")
        del self.mapping["docs/OLD.md"]
        self.mapping["docs/NEW.md"] = "NEW"
        sync.sync_pages(self.wiki, self.render(), REPO, SHA)
        self.assertFalse((self.wiki / "OLD.md").exists())
        self.assertTrue((self.wiki / "NEW.md").exists())
        self.assertEqual("Original report\n", (self.wiki / "Report.md").read_text(encoding="utf-8"))

    def test_stale_page_with_removed_marker_is_preserved(self):
        rendered = self.render()
        rendered["OLD.md"] = sync.MARKER + "\nOld document\n"
        sync.sync_pages(self.wiki, rendered, REPO, SHA)
        (self.wiki / "OLD.md").write_text("Human adopted this page\n", encoding="utf-8")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "name conflict"):
            sync.sync_pages(self.wiki, self.render(), REPO, SHA)
        self.assertEqual(before, self.snapshot())

    def test_missing_link_prevents_render_and_leaves_wiki_intact(self):
        (self.root / "docs/README.md").write_text("[Missing](MISSING.md)\n", encoding="utf-8")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "Missing link"):
            self.render()
        self.assertEqual(before, self.snapshot())

    def test_source_paths_cannot_escape_repository(self):
        (self.root / "docs/README.md").write_text("[Outside](../../outside.md)\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "leaves repository"):
            self.render()

    def test_publication_map_rejects_duplicate_page_names(self):
        self.mapping["docs/SECOND.md"] = "development-home"
        (self.root / ".github/wiki-pages.json").write_text(json.dumps(self.mapping), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "duplicate"):
            sync.load_pages(self.root)


if __name__ == "__main__":
    unittest.main()
