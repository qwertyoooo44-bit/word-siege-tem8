import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
words = json.loads((root / "public" / "packs" / "tem8.json").read_text(encoding="utf-8"))
(root / "src" / "data" / "sample40.json").write_text(
    json.dumps(words[:40], ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
index = [{"id": w["id"], "word": w["word"], "chapter": w["chapter"]} for w in words]
(root / "public" / "packs" / "tem8.index.json").write_text(
    json.dumps(index, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
print("words", len(words))
print("sample_bytes", (root / "src" / "data" / "sample40.json").stat().st_size)
print("index_bytes", (root / "public" / "packs" / "tem8.index.json").stat().st_size)
print("pack_bytes", (root / "public" / "packs" / "tem8.json").stat().st_size)
