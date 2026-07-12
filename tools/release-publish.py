#!/usr/bin/env python3
"""
release-publish.py — fix CJK encoding on GitHub Release assets & body

Problem this solves:
  On Windows, `gh release edit` and `curl --data-binary` corrupt UTF-8
  Chinese (and other multi-byte) characters in:
    - Asset display labels (the CJK product name shows as mojibake)
    - Release body markdown (the changelog shows as mojibake)

  This script uses Python's urllib directly with explicit UTF-8 encoding
  to PATCH the assets and body, preserving CJK correctly.

Usage:
  python tools/release-publish.py <tag> <notes.md>
  # e.g.
  python tools/release-publish.py v1.0.13 .git/release-notes-v1.0.13.md
  # --labels-only / --body-only to do one at a time
"""
import json
import subprocess
import sys
import urllib.request
import urllib.error

REPO = "liuhua1202/markdoc"


def gh_token() -> str:
    return subprocess.check_output(["gh", "auth", "token"], text=True, encoding="utf-8").strip()


def api(method: str, path: str, payload: dict | None = None) -> dict:
    token = gh_token()
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload else None
    req = urllib.request.Request(
        f"https://api.github.com/{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json; charset=utf-8",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "markdoc-release-tool",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[HTTP {e.code}] {e.reason}: {body[:300]}")
        raise


def get_release_id(tag: str) -> int:
    d = api("GET", f"repos/{REPO}/releases/tags/{tag}")
    return d["id"]


def fix_labels(release_id: int, asset_overrides: dict[int, str] | None = None) -> None:
    """Fix display labels for assets where the CJK name got mangled.

    asset_overrides: {asset_id: new_label}; if None, prompts for each mangled asset.
    """
    d = api("GET", f"repos/{REPO}/releases/{release_id}")
    fixed = 0
    for a in d["assets"]:
        label = a.get("label") or ""
        name = a["name"]
        # Mojibake markers: 鈥, 甯, 屼, etc. (corrupted CJK bytes)
        is_mojibake = any(c in label for c in ("鈥", "甯", "屼", "椹", "鐧", "鏂"))
        if not is_mojibake:
            continue
        new_label = (asset_overrides or {}).get(a["id"])
        if not new_label:
            # Heuristic: reattach CJK product name to ASCII filename
            # e.g. "-Setup-1.0.13.exe" -> "马克档-Setup-1.0.13.exe"
            new_label = "马克档" + name if not name.startswith("马克档") else name
        api("PATCH", f"repos/{REPO}/releases/assets/{a['id']}", {"label": new_label})
        print(f"  [label] {name} -> {new_label}")
        fixed += 1
    print(f"[done] {fixed} label(s) fixed")


def fix_body(release_id: int, body: str) -> None:
    d = api("PATCH", f"repos/{REPO}/releases/{release_id}", {"body": body})
    if d.get("body", "")[:60] == body[:60]:
        print(f"[done] body updated ({len(body)} chars)")
    else:
        print(f"[WARN] body roundtrip differs")
        print(f"  sent    : {body[:60]!r}")
        print(f"  received: {d.get('body','')[:60]!r}")


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 0

    tag = args[0]
    notes_path = args[1] if len(args) > 1 else None
    labels_only = "--labels-only" in args
    body_only = "--body-only" in args

    rid = get_release_id(tag)
    print(f"[info] {tag} -> release id {rid}")

    if not body_only:
        print("[step] fixing asset labels ...")
        fix_labels(rid)

    if labels_only or not notes_path:
        return 0

    if not body_only:
        print("[step] updating body ...")
        with open(notes_path, "r", encoding="utf-8") as f:
            body = f.read()
        fix_body(rid, body)

    return 0


if __name__ == "__main__":
    sys.exit(main())
