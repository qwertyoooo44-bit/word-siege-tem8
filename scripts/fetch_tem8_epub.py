from __future__ import annotations

import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "vendor" / "openetymology"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "word-siege-tem8-rich-data"}
API = "https://api.github.com/repos/openetymology/OpenEtymology"


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_blob(path: str, dest: Path) -> dict:
    obj = get_json(f"{API}/contents/{path}")
    sha = obj["sha"]
    size = obj["size"]
    download_url = obj["download_url"]
    req = urllib.request.Request(download_url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    dest.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    return {
        "path": path,
        "dest": str(dest),
        "apiSha": sha,
        "reportedSize": size,
        "bytes": len(data),
        "sha256": digest,
        "downloadUrl": download_url,
        "htmlUrl": obj.get("html_url"),
    }


def main() -> None:
    repo = get_json(API)
    commit = get_json(f"{API}/commits/{repo['default_branch']}")
    license_obj = get_json(f"{API}/contents/DATA_LICENSE.md")
    epub = download_blob("TEM8/TEM8.epub", OUT / "TEM8.epub")
    meta = {
        "repo": repo["html_url"],
        "defaultBranch": repo["default_branch"],
        "commitSha": commit["sha"],
        "commitHtml": commit["html_url"],
        "dataLicensePath": "DATA_LICENSE.md",
        "dataLicenseSha": license_obj["sha"],
        "epub": epub,
    }
    (OUT / "TEM8.epub.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
