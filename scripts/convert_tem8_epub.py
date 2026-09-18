from __future__ import annotations

import json
import re
import unicodedata
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EPUB = ROOT / "vendor" / "openetymology" / "TEM8.epub"
TXT = ROOT / "vendor" / "openetymology" / "TEM8.txt"
OUT_DIR = ROOT / "src" / "data"
REPORT = ROOT / "vendor" / "openetymology" / "epub-inspect"
CHAPTER_SIZE = 50
LICENSE = "CC BY-SA 4.0"
SOURCE = "OpenEtymology TEM8.epub"

IPA_RE = re.compile(r"/[^/\n]+/")
POS_RE = re.compile(
    r"^(n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|interj|aux|modal|phr(?:\.v)?|pl)\.\s*",
    re.I,
)


def key_exact(word: str) -> str:
    text = unicodedata.normalize("NFC", word).strip().casefold()
    return text


class StrictEntryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.entries: list[dict] = []
        self.current: dict | None = None
        self.depth = 0
        self.entry_depth = 0
        self.field: str | None = None
        self.buf: list[str] = []
        self.skip = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        cls = (dict(attrs).get("class") or "").strip()
        self.depth += 1
        if tag in {"script", "style"}:
            self.skip = True
            return
        if "word-entry" in cls.split():
            if self.current:
                self.close_entry()
            self.current = {
                "word": "",
                "pronunciationRaw": "",
                "etymology": "",
                "roots": "",
                "examples": [],
                "definitions": [],
            }
            self.entry_depth = self.depth
            self.field = "inside"
            self.buf = []
            return
        if self.current is None:
            return
        mapping = {
            "entry-number": "number",
            "pronunciation": "pronunciationRaw",
            "definitions": "definitionsBlock",
            "morphemes": "morphemes",
            "examples": "examplesBlock",
            "example-en": "exampleEn",
            "example-zh": "exampleZh",
            "note": "etymology",
        }
        if cls in mapping:
            self.flush()
            self.field = mapping[cls]
            self.buf = []
        elif tag in {"h1", "h2", "h3"}:
            self.flush()
            self.field = "word"
            self.buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.skip = False
        if self.current is not None:
            self.flush()
            if self.depth == self.entry_depth:
                self.close_entry()
        self.depth = max(0, self.depth - 1)

    def handle_data(self, data: str) -> None:
        if self.skip or self.current is None:
            return
        text = re.sub(r"\s+", " ", data)
        if text.strip():
            self.buf.append(text)

    def flush(self) -> None:
        if self.current is None or not self.buf:
            self.buf = []
            return
        text = re.sub(r"\s+", " ", "".join(self.buf)).strip()
        self.buf = []
        if not text:
            return
        cur = self.current
        f = self.field
        if f == "word" and not cur["word"]:
            cur["word"] = text
        elif f == "pronunciationRaw":
            cur["pronunciationRaw"] = (cur["pronunciationRaw"] + " " + text).strip()
        elif f == "definitionsBlock":
            if text not in {"Definitions", "Definition"}:
                cur["definitions"].append(text)
        elif f == "morphemes":
            if text not in {"Morphemes", "Morpheme"}:
                cur["roots"] = (cur["roots"] + "; " + text).strip("; ").strip()
        elif f == "etymology":
            if text not in {"Etymology", "Note"}:
                cur["etymology"] = (cur["etymology"] + " " + text).strip()
        elif f == "exampleEn":
            cur["examples"].append({"en": text, "zh": ""})
        elif f == "exampleZh":
            if cur["examples"] and not cur["examples"][-1]["zh"]:
                cur["examples"][-1]["zh"] = text
            else:
                cur["examples"].append({"en": "", "zh": text})
        elif f == "inside" and not cur["word"] and re.fullmatch(r"[A-Za-z][A-Za-z' -]*", text):
            cur["word"] = text

    def close_entry(self) -> None:
        self.flush()
        if self.current:
            self.entries.append(self.current)
        self.current = None
        self.field = None


def parse_pronunciation(raw: str) -> tuple[str, str]:
    regions = []
    if re.search(r"\bUK\b", raw, re.I):
        regions.append("UK")
    if re.search(r"\bUS\b", raw, re.I):
        regions.append("US")
    ipas = IPA_RE.findall(raw)
    us = re.search(r"US\s*(/[^\n/]+/)", raw, re.I)
    uk = re.search(r"UK\s*(/[^\n/]+/)", raw, re.I)
    if us:
        ipa = us.group(1)
    elif uk:
        ipa = uk.group(1)
    elif ipas:
        ipa = ipas[0]
    else:
        ipa = ""
    extra = [p for p in ipas if p != ipa]
    if extra:
        ipa = ipa + " · " + " · ".join(extra)
    return ipa, "/".join(regions)


def parse_definitions(defs: list[str]) -> tuple[str, str]:
    pos_parts: list[str] = []
    gloss_parts: list[str] = []
    for item in defs:
        m = POS_RE.match(item)
        if m:
            pos_parts.append(m.group(1).lower() + ".")
            gloss_parts.append(item[m.end() :].strip())
        elif item:
            gloss_parts.append(item)
    pos = " ".join(dict.fromkeys(pos_parts))
    gloss = "；".join(g for g in gloss_parts if g)
    return pos, gloss


def example_has_word(word: str, sentence: str) -> bool:
    lemma = re.escape(key_exact(word))
    if not lemma:
        return False
    text = key_exact(sentence)
    return re.search(rf"(^|[^a-z]){lemma}[a-z]*([^a-z]|$)", text) is not None


def pick_example(word: str, examples: list[dict]) -> tuple[str, str]:
    ranked = []
    for ex in examples:
        en = ex.get("en") or ""
        if not en:
            continue
        if example_has_word(word, en):
            ranked.append((0 if key_exact(word) in key_exact(en).split() else 1, en, ex.get("zh") or ""))
    if ranked:
        ranked.sort(key=lambda x: x[0])
        return ranked[0][1], ranked[0][2]
    for ex in examples:
        if ex.get("en"):
            return ex.get("en") or "", ex.get("zh") or ""
    return "", ""


def normalize_entry(raw: dict) -> dict:
    word = (raw.get("word") or "").strip()
    ipa, region = parse_pronunciation(raw.get("pronunciationRaw") or "")
    pos, gloss = parse_definitions(raw.get("definitions") or [])
    example, zh = pick_example(word, raw.get("examples") or [])
    return {
        "word": word,
        "ipa": ipa,
        "pronunciationRegion": region,
        "pos": pos,
        "chineseGloss": gloss,
        "englishDefinition": "",
        "etymology": raw.get("etymology") or "",
        "roots": raw.get("roots") or "",
        "affixes": "",
        "example": example,
        "exampleTranslation": zh,
        "source": SOURCE,
        "license": LICENSE,
    }


def extract_epub() -> list[dict]:
    entries: list[dict] = []
    with zipfile.ZipFile(EPUB) as zf:
        names = sorted(n for n in zf.namelist() if n.startswith("OEBPS/text/chapter-") and n.endswith(".xhtml"))
        for name in names:
            parser = StrictEntryParser()
            parser.feed(zf.read(name).decode("utf-8"))
            parser.close_entry()
            for raw in parser.entries:
                item = normalize_entry(raw)
                if item["word"]:
                    entries.append(item)
    return entries


def learnable(item: dict) -> bool:
    return bool(item.get("word") and item.get("ipa") and item.get("pos") and item.get("chineseGloss") and item.get("example"))


def missing_of(item: dict) -> list[str]:
    flags = []
    for key in ("ipa", "pos", "chineseGloss", "englishDefinition", "example", "exampleTranslation", "roots", "etymology"):
        if not item.get(key):
            flags.append(key)
    return flags


def main() -> None:
    REPORT.mkdir(parents=True, exist_ok=True)
    txt_words = [unicodedata.normalize("NFC", line.strip()) for line in TXT.read_text(encoding="utf-8").splitlines() if line.strip()]
    extracted = extract_epub()
    by_key: dict[str, list[dict]] = {}
    for item in extracted:
        by_key.setdefault(key_exact(item["word"]), []).append(item)

    catalog = []
    unmatched_txt = []
    duplicates = []
    fuzzy = []
    used_keys: set[str] = set()
    for idx, word in enumerate(txt_words, start=1):
        k = key_exact(word)
        hits = by_key.get(k, [])
        if len(hits) > 1:
            duplicates.append({"word": word, "count": len(hits)})
        hit = hits[0] if hits else None
        if hit:
            used_keys.add(k)
            row = {
                "id": f"tem8-{idx:04d}",
                "word": k,
                "ipa": hit["ipa"],
                "pos": hit["pos"],
                "gloss": hit["chineseGloss"],
                "definition": hit["englishDefinition"],
                "context": hit["example"],
                "exampleTranslation": hit["exampleTranslation"],
                "syllable": "",
                "root": hit["roots"],
                "etymology": hit["etymology"],
                "pronunciationRegion": hit["pronunciationRegion"],
                "chapter": (idx - 1) // CHAPTER_SIZE + 1,
                "source": SOURCE,
                "license": LICENSE,
                "learnable": learnable(hit),
                "missing": missing_of(hit),
            }
        else:
            unmatched_txt.append(word)
            row = {
                "id": f"tem8-{idx:04d}",
                "word": k,
                "ipa": "",
                "pos": "",
                "gloss": "",
                "definition": "",
                "context": "",
                "exampleTranslation": "",
                "syllable": "",
                "root": "",
                "etymology": "",
                "pronunciationRegion": "",
                "chapter": (idx - 1) // CHAPTER_SIZE + 1,
                "source": "OpenEtymology TEM8.txt",
                "license": LICENSE,
                "learnable": False,
                "missing": ["ipa", "pos", "chineseGloss", "example"],
            }
        catalog.append(row)

    extra_epub = [item["word"] for k, items in by_key.items() if k not in used_keys for item in items]
    # hyphen/apostrophe near-miss report, not auto-merged
    txt_keys = {key_exact(w) for w in txt_words}
    for item in extracted:
        k = key_exact(item["word"])
        if k in txt_keys:
            continue
        compact = re.sub(r"[-'’ ]", "", k)
        near = [w for w in txt_words if re.sub(r"[-'’ ]", "", key_exact(w)) == compact]
        if near:
            fuzzy.append({"epub": item["word"], "txtCandidates": near})

    learnable_rows = [r for r in catalog if r["learnable"]]
    incomplete_rows = [r for r in catalog if not r["learnable"]]

    def count_field(field: str) -> int:
        return sum(1 for r in catalog if r.get(field))

    meta = {
        "packId": "tem8-openetymology-epub",
        "title": "TEM8",
        "lemmaCount": len(catalog),
        "epubExtracted": len(extracted),
        "exactMatched": len(catalog) - len(unmatched_txt),
        "unmatchedTxt": len(unmatched_txt),
        "unmatchedEpub": len(extra_epub),
        "duplicateKeys": len(duplicates),
        "fuzzyCandidates": len(fuzzy),
        "withIpa": count_field("ipa"),
        "withPos": count_field("pos"),
        "withGloss": count_field("gloss"),
        "withDefinition": count_field("definition"),
        "withExample": count_field("context"),
        "withRoot": count_field("root"),
        "learnableCount": len(learnable_rows),
        "incompleteCount": len(incomplete_rows),
        "chapterSize": CHAPTER_SIZE,
        "chapterCount": max(r["chapter"] for r in catalog),
        "sourceRepo": "https://github.com/openetymology/OpenEtymology",
        "sourceFile": "TEM8/TEM8.epub",
        "codeLicense": "MIT",
        "dataLicense": LICENSE,
        "attribution": "Derived from OpenEtymology TEM8 wordbook (CC BY-SA 4.0). Reformatted, chaptered and field-filtered for Word Siege TEM-8.",
        "notice": f"TEM8 词目 {len(catalog)} 个，其中 {len(learnable_rows)} 个可完整学习，{len(incomplete_rows)} 个资料待完善。",
    }

    runtime = [
        {
            "id": r["id"],
            "word": r["word"],
            "ipa": r["ipa"],
            "pos": r["pos"],
            "gloss": r["gloss"],
            "definition": r["definition"],
            "context": r["context"],
            "exampleTranslation": r["exampleTranslation"],
            "syllable": r["syllable"],
            "root": r["root"],
            "etymology": "",
            "pronunciationRegion": r["pronunciationRegion"],
            "chapter": r["chapter"],
            "source": r["source"],
            "license": r["license"],
            "learnable": True,
            "missing": r["missing"],
        }
        for r in learnable_rows
    ]
    derived_dir = ROOT / "vendor" / "openetymology" / "derived"
    derived_dir.mkdir(parents=True, exist_ok=True)
    (derived_dir / "tem8-cc-by-sa.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "tem8.json").write_text(json.dumps(runtime, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "tem8.meta.ts").write_text(
        "export const TEM8_META = " + json.dumps(meta, ensure_ascii=False, indent=2) + " as const\n",
        encoding="utf-8",
    )
    (REPORT / "merge-report.json").write_text(
        json.dumps(
            {
                "unmatchedTxtSample": unmatched_txt[:50],
                "unmatchedEpubSample": extra_epub[:50],
                "duplicatesSample": duplicates[:50],
                "fuzzySample": fuzzy[:50],
                "meta": meta,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
