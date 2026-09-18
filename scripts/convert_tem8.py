from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "vendor" / "openetymology" / "TEM8.txt"
OUT_JSON = ROOT / "src" / "data" / "tem8.json"
OUT_META = ROOT / "src" / "data" / "tem8.meta.ts"
CHAPTER_SIZE = 50
LICENSE = "CC BY-SA 4.0"
SOURCE = "OpenEtymology TEM8.txt"


def valid_word(word: str) -> bool:
    word = word.strip().replace("\ufeff", "")
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z'-]*", word))


def main() -> None:
    lines = SRC.read_text(encoding="utf-8").splitlines()
    seen: set[str] = set()
    entries = []
    skipped_invalid = 0
    skipped_dup = 0
    for line in lines:
        word = line.strip().replace("\ufeff", "")
        if not valid_word(word):
            skipped_invalid += 1
            continue
        key = word.lower()
        if key in seen:
            skipped_dup += 1
            continue
        seen.add(key)
        idx = len(entries) + 1
        entries.append(
            {
                "id": f"tem8-{idx:04d}",
                "word": key,
                "ipa": "",
                "pos": "",
                "gloss": "",
                "context": "",
                "syllable": "",
                "root": "",
                "chapter": (idx - 1) // CHAPTER_SIZE + 1,
                "source": SOURCE,
                "license": LICENSE,
                "missing": ["ipa", "pos", "gloss", "context", "syllable", "root"],
            }
        )

    OUT_JSON.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    chapters = Counter(e["chapter"] for e in entries)
    meta = {
        "packId": "tem8-openetymology",
        "title": "TEM8",
        "count": len(entries),
        "rawLines": len(lines),
        "skippedInvalid": skipped_invalid,
        "skippedDuplicate": skipped_dup,
        "chapterSize": CHAPTER_SIZE,
        "chapterCount": len(chapters),
        "sourceRepo": "https://github.com/openetymology/OpenEtymology",
        "sourceFile": "TEM8/TEM8.txt",
        "codeLicense": "Apache-2.0",
        "dataLicense": LICENSE,
        "attribution": "Word list from OpenEtymology TEM8 wordbook (CC BY-SA 4.0).",
        "presentFields": ["id", "word", "chapter", "source", "license"],
        "missingFields": ["ipa", "pos", "gloss", "context", "syllable", "root", "exampleTranslation"],
        "notice": "正式专八词表仅含合法词目。公开 TXT 未授权音标、词性、中文释义和例句，应用不得伪造这些字段。",
    }
    OUT_META.write_text(
        "export const TEM8_META = " + json.dumps(meta, ensure_ascii=False, indent=2) + " as const\n",
        encoding="utf-8",
    )
    print(json.dumps({"count": len(entries), "jsonBytes": OUT_JSON.stat().st_size, "first": entries[0]["word"], "last": entries[-1]["word"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
