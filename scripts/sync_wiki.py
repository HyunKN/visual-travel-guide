"""Validate repository documents and render explicitly managed GitHub Wiki pages."""

import argparse
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, unquote, urlsplit


MARKER = "<!-- visual-travel-guide:generated-doc -->"
HOME_START = "<!-- visual-travel-guide:development-link:start -->"
HOME_END = "<!-- visual-travel-guide:development-link:end -->"
MANIFEST = ".codex-docs-sync.json"
LINK = re.compile(r"\[([^\]]*)\]\(([^\s)]+)\)")
PAGE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*")


def local_target(root, source, target):
    """Return a checked local path and fragment, or None for an external link."""
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return None
    path = (source.parent / unquote(parsed.path)).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f"Link leaves repository: {source.relative_to(root)} -> {target}")
    if not path.exists():
        raise ValueError(f"Missing link: {source.relative_to(root)} -> {target}")
    return path, parsed.fragment


def load_pages(root):
    mapping = json.loads((root / ".github/wiki-pages.json").read_text(encoding="utf-8"))
    if not isinstance(mapping, dict) or not mapping:
        raise ValueError("Publication map must contain source paths and page names")
    names = set()
    for source, page in mapping.items():
        if not isinstance(page, str) or not PAGE.fullmatch(page):
            raise ValueError(f"Invalid Wiki page name: {page!r}")
        if page.casefold() == "home" or page.casefold() in names:
            raise ValueError(f"Reserved or duplicate Wiki page name: {page}")
        names.add(page.casefold())
        path = (root / source).resolve()
        if not path.is_relative_to(root / "docs") or path.suffix != ".md" or not path.is_file():
            raise ValueError(f"Invalid publication source: {source}")
    return mapping


def check_documents(root):
    files = [root / "README.md", root / "AGENTS.md", root / ".github/pull_request_template.md"]
    files += sorted((root / "docs").rglob("*.md"))
    count = 0
    for path in files:
        if not path.is_file():
            raise ValueError(f"Missing document: {path.relative_to(root)}")
        content = path.read_text(encoding="utf-8-sig")
        for match in LINK.finditer(content):
            if local_target(root, path, match.group(2)):
                count += 1
    return len(files), count


def render_pages(root, mapping, repository, sha):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Repository must be owner/name")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Publication requires the full source commit SHA")
    base = f"https://github.com/{repository}"
    pages_by_path = {(root / source).resolve(): name for source, name in mapping.items()}
    rendered = {}
    for source, name in mapping.items():
        path = (root / source).resolve()

        def rewrite(match):
            local = local_target(root, path, match.group(2))
            if local is None:
                return match.group(0)
            target, fragment = local
            if target in pages_by_path:
                url = f"{base}/wiki/{quote(pages_by_path[target])}"
            else:
                kind = "tree" if target.is_dir() else "blob"
                url = f"{base}/{kind}/{sha}/{quote(target.relative_to(root).as_posix())}"
            if fragment:
                url += f"#{fragment}"
            return f"[{match.group(1)}]({url})"

        original = f"{base}/blob/{sha}/{quote(source)}"
        header = f"{MARKER}\n\n> 원본: [{source}]({original}) · 게시 기준 커밋: [{sha[:12]}]({base}/commit/{sha})\n\n"
        rendered[f"{name}.md"] = header + LINK.sub(rewrite, path.read_text(encoding="utf-8-sig"))
    links = [f"- [{name}]({base}/wiki/{quote(name)})" for name in mapping.values()]
    rendered["_Sidebar.md"] = MARKER + "\n\n## 개발 문서\n\n" + "\n".join(links)
    rendered["_Sidebar.md"] += f"\n\n- [작업 Issue]({base}/issues)\n- [변경 PR]({base}/pulls)\n"
    return rendered


def sync_pages(wiki, rendered, repository, sha):
    """Preflight every collision before writing; preserve pages outside our manifest."""
    wiki = wiki.resolve()
    if not (wiki / ".git").exists():
        raise ValueError("Wiki directory must be an existing Git checkout")
    manifest_path = wiki / MANIFEST
    if manifest_path.is_symlink():
        raise ValueError("Wiki manifest must be a regular file")
    previous = {"version": 1, "pages": []}
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        if previous.get("version") != 1 or not isinstance(previous.get("pages"), list):
            raise ValueError("Unrecognized Wiki publication manifest")
    old_pages = set(previous["pages"])
    for name in old_pages | set(rendered):
        if not isinstance(name, str) or Path(name).name != name or not name.endswith(".md"):
            raise ValueError(f"Unsafe managed filename: {name!r}")
        target = wiki / name
        if target.is_symlink():
            raise ValueError(f"Managed page is a symlink: {name}")
        if target.exists() and not target.read_text(encoding="utf-8-sig").startswith(MARKER):
            raise ValueError(f"Preserving unmanaged Wiki page; name conflict: {name}")

    home_path = wiki / "Home.md"
    if home_path.is_symlink() or manifest_path.is_symlink():
        raise ValueError("Wiki Home and manifest must be regular files")
    home = home_path.read_text(encoding="utf-8-sig") if home_path.exists() else "# Visual Travel Guide Wiki\n"
    if home.count(HOME_START) != home.count(HOME_END) or home.count(HOME_START) > 1:
        raise ValueError("Invalid managed link markers in Wiki Home")
    block = f"{HOME_START}\n\n## 개발 문서\n\n[개발 문서 안내서](https://github.com/{repository}/wiki/Development-Home)\n\n{HOME_END}"
    if HOME_START in home:
        start, end_start = home.index(HOME_START), home.index(HOME_END)
        if end_start <= start:
            raise ValueError("Invalid managed link marker order in Wiki Home")
        end = end_start + len(HOME_END)
        home = home[:start] + block + home[end:]
    else:
        home = home.rstrip() + "\n\n" + block + "\n"

    for name, content in rendered.items():
        (wiki / name).write_text(content, encoding="utf-8", newline="\n")
    for name in old_pages - set(rendered):
        (wiki / name).unlink(missing_ok=True)
    home_path.write_text(home, encoding="utf-8", newline="\n")
    manifest = {"version": 1, "source_commit": sha, "pages": sorted(rendered)}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--repository", default="HyunKN/visual-travel-guide")
    parser.add_argument("--sha")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--wiki-dir", type=Path)
    args = parser.parse_args()
    root = args.repo_root.resolve()
    try:
        mapping = load_pages(root)
        files, links = check_documents(root)
        sha = args.sha or subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
        rendered = render_pages(root, mapping, args.repository, sha)
        if not args.check:
            if args.wiki_dir is None:
                parser.error("Provide --check or --wiki-dir")
            wiki = args.wiki_dir.resolve()
            if wiki == root or root.is_relative_to(wiki):
                raise ValueError("Wiki checkout must be separate from the source repository")
            sync_pages(wiki, rendered, args.repository, sha)
        print(f"PASS: {files} documents, {links} local links, {len(mapping)} published documents")
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"ERROR: {error}\n")


if __name__ == "__main__":
    main()
