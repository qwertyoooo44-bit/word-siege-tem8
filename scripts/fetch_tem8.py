import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "vendor" / "openetymology"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "word-siege-tem8-phase4"}


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def save_github_file(path: str, dest: Path) -> dict:
    obj = get_json(f"https://api.github.com/repos/openetymology/OpenEtymology/contents/{path}")
    import base64

    data = base64.b64decode(obj["content"])
    dest.write_bytes(data)
    return {"path": path, "dest": str(dest), "size": len(data), "sha": obj["sha"]}


meta = {
    "txt": save_github_file("TEM8/TEM8.txt", OUT / "TEM8.txt"),
    "data_license": save_github_file("DATA_LICENSE.md", OUT / "DATA_LICENSE.md"),
    "tem8_readme": save_github_file("TEM8/README.md", OUT / "TEM8-README.md"),
    "code_license": save_github_file("LICENSE", OUT / "CODE_LICENSE"),
}
text = (OUT / "TEM8.txt").read_text(encoding="utf-8")
lines = text.splitlines()
print(json.dumps(meta, ensure_ascii=False, indent=2))
print("chars", len(text), "lines", len(lines))
print("---- first 60 ----")
print("\n".join(lines[:60]))
