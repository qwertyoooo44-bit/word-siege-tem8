from __future__ import annotations

import json
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EPUB = ROOT / "vendor" / "openetymology" / "TEM8.epub"
OUT = ROOT / "vendor" / "openetymology" / "epub-inspect" / "sample10.json"


class EntryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.entries: list[dict] = []
        self.current: dict | None = None
        self.stack: list[tuple[str, str]] = []
        self.buf: list[str] = []
        self.field: str | None = None
        self.skip = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        cls = (dict(attrs).get("class") or "").strip()
        self.stack.append((tag, cls))
        if tag in {"script", "style"}:
            self.skip = True
            return
        if "word-entry" in cls.split():
            self.current = {
                "word": "",
                "ipa": "",
                "pronunciationRaw": "",
                "pronunciationRegion": "",
                "pos": "",
                "chineseGloss": "",
                "englishDefinition": "",
                "etymology": "",
                "roots": "",
                "affixes": "",
                "example": "",
                "exampleTranslation": "",
                "examples": [],
                "definitions": [],
            }
            self.field = "head"
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
        if tag in {"h1", "h2", "h3"} and self.current and not self.current["word"]:
            self.flush()
            self.field = "word"
            self.buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.skip = False
        if self.stack:
            self.stack.pop()
        if self.current is None:
            return
        if tag in {"p", "div", "h1", "h2", "h3", "li", "article", "section", "span"}:
            self.flush()
        if tag in {"article", "section", "div"} and self.field == "head":
            pass
        # close entry when leaving word-entry: approximate by empty stack class after word-entry end
        if tag in {"article", "section", "div"} and self.current and self.field and tag:
            classes = [c for _, c in self.stack]
            if self.current and "word-entry" not in " ".join(classes) and any(self.current.values()):
                # may close too early; handled below via explicit class tracking
                pass

    def handle_data(self, data: str) -> None:
        if self.skip or self.current is None or self.field is None:
            return
        text = re.sub(r"\s+", " ", data)
        if text.strip():
            self.buf.append(text)

    def flush(self) -> None:
        if self.current is None or self.field is None:
            self.buf = []
            return
        text = re.sub(r"\s+", " ", "".join(self.buf)).strip()
        self.buf = []
        if not text:
            return
        cur = self.current
        if self.field == "word" and not cur["word"]:
            cur["word"] = text
        elif self.field == "head" and not cur["word"] and re.fullmatch(r"[A-Za-z][A-Za-z' -]*", text):
            cur["word"] = text
        elif self.field == "pronunciationRaw":
            cur["pronunciationRaw"] = (cur["pronunciationRaw"] + " " + text).strip()
        elif self.field == "definitionsBlock":
            cur["definitions"].append(text)
        elif self.field == "morphemes":
            cur["roots"] = (cur["roots"] + " " + text).strip()
        elif self.field == "etymology":
            cur["etymology"] = (cur["etymology"] + " " + text).strip()
        elif self.field == "exampleEn":
            cur["examples"].append({"en": text, "zh": ""})
        elif self.field == "exampleZh":
            if cur["examples"]:
                if not cur["examples"][-1]["zh"]:
                    cur["examples"][-1]["zh"] = text
                else:
                    cur["examples"].append({"en": "", "zh": text})
            else:
                cur["examples"].append({"en": "", "zh": text})
        elif self.field == "number":
            pass

    def close_entry(self) -> None:
        self.flush()
        if self.current:
            self.entries.append(self.current)
            self.current = None
            self.field = None


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
                "ipa": "",
                "pronunciationRaw": "",
                "pronunciationRegion": "",
                "pos": "",
                "chineseGloss": "",
                "englishDefinition": "",
                "etymology": "",
                "roots": "",
                "affixes": "",
                "example": "",
                "exampleTranslation": "",
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


IPA_RE = re.compile(r"/[^/\n]+/")
POS_RE = re.compile(r"^(n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|aux|modal|phr|pl)\.\s*", re.I)


def normalize_entry(raw: dict) -> dict:
    pron = raw.get("pronunciationRaw", "")
    regions = []
    if re.search(r"\bUK\b", pron, re.I):
        regions.append("UK")
    if re.search(r"\bUS\b", pron, re.I):
        regions.append("US")
    ipas = IPA_RE.findall(pron)
    defs = raw.get("definitions") or []
    pos_parts = []
    gloss_parts = []
    for item in defs:
        m = POS_RE.match(item)
        if m:
            pos_parts.append(m.group(1).lower() + ".")
            gloss_parts.append(item[m.end() :].strip())
        else:
            gloss_parts.append(item)
    examples = [ex for ex in raw.get("examples") or [] if ex.get("en")]
    first = examples[0] if examples else {"en": "", "zh": ""}
    return {
        "word": raw.get("word", "").strip(),
        "ipa": " · ".join(ipas),
        "pronunciationRegion": "/".join(regions),
        "pos": " ".join(dict.fromkeys(pos_parts)),
        "chineseGloss": "；".join(g for g in gloss_parts if g),
        "englishDefinition": "",
        "etymology": raw.get("etymology", ""),
        "roots": raw.get("roots", ""),
        "affixes": "",
        "example": first.get("en", ""),
        "exampleTranslation": first.get("zh", ""),
        "exampleCount": len(examples),
        "definitionCount": len(defs),
        "pronunciationRaw": pron,
    }


def main() -> None:
    with zipfile.ZipFile(EPUB) as zf:
        raw = zf.read("OEBPS/text/chapter-01.xhtml").decode("utf-8")
    parser = StrictEntryParser()
    parser.feed(raw)
    parser.close_entry()
    sample = [normalize_entry(e) for e in parser.entries[:10]]
    OUT.write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8")
    print("entries_in_chapter1", len(parser.entries))
    print(json.dumps(sample, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
