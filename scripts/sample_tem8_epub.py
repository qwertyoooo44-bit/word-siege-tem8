from __future__ import annotations

import json
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EPUB = ROOT / "vendor" / "openetymology" / "TEM8.epub"
OUT = ROOT / "vendor" / "openetymology" / "epub-inspect"


class TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip = False
        self.classes: list[str] = []
        self.events: list[tuple[str, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        ad = dict(attrs)
        cls = ad.get("class") or ""
        self.classes.append(cls)
        if tag in {"script", "style"}:
            self.skip = True
        self.events.append(("start", tag, cls))

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.skip = False
        cls = self.classes.pop() if self.classes else ""
        self.events.append(("end", tag, cls))
        if tag in {"p", "div", "h1", "h2", "h3", "li", "article", "section"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.skip:
            return
        text = re.sub(r"\s+", " ", data)
        if text.strip():
            self.parts.append(text)
            cls = self.classes[-1] if self.classes else ""
            self.events.append(("text", text.strip(), cls))


def main() -> None:
    with zipfile.ZipFile(EPUB) as zf:
        raw = zf.read("OEBPS/text/chapter-01.xhtml").decode("utf-8")
    (OUT / "chapter-01.xhtml").write_text(raw, encoding="utf-8")
    parser = TextCollector()
    parser.feed(raw)
    text = "".join(parser.parts)
    (OUT / "chapter-01.txt").write_text(text, encoding="utf-8")
    class_counts: dict[str, int] = {}
    for kind, tag, cls in parser.events:
        if kind == "start" and cls:
            class_counts[cls] = class_counts.get(cls, 0) + 1
    print("class counts", json.dumps(class_counts, ensure_ascii=False, indent=2)[:2000])
    print("---- first 80 events ----")
    shown = 0
    for ev in parser.events:
        if ev[0] == "text" or (ev[0] == "start" and ev[2]):
            print(ev)
            shown += 1
            if shown >= 80:
                break
    print("---- first 2500 chars of text ----")
    print(text[:2500])


if __name__ == "__main__":
    main()
