from __future__ import annotations

import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EPUB = ROOT / "vendor" / "openetymology" / "TEM8.epub"
OUT = ROOT / "vendor" / "openetymology" / "epub-inspect"
OUT.mkdir(parents=True, exist_ok=True)

NS = {
    "c": "urn:oasis:names:tc:opendocument:xmlns:container",
    "o": "http://www.idpf.org/2007/opf",
    "h": "http://www.w3.org/1999/xhtml",
    "dc": "http://purl.org/dc/elements/1.1/",
}


def local(tag: str) -> str:
    return tag.split("}", 1)[-1]


def main() -> None:
    with zipfile.ZipFile(EPUB) as zf:
        names = zf.namelist()
        (OUT / "zip-names.txt").write_text("\n".join(names), encoding="utf-8")
        container = zf.read("META-INF/container.xml")
        (OUT / "container.xml").write_bytes(container)
        root = ET.fromstring(container)
        opf_path = root.find(".//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile").attrib["full-path"]
        opf = zf.read(opf_path)
        (OUT / "content.opf").write_bytes(opf)
        opf_root = ET.fromstring(opf)
        manifest = []
        for item in opf_root.findall(".//{http://www.idpf.org/2007/opf}item"):
            manifest.append({k: item.attrib.get(k) for k in ("id", "href", "media-type")})
        spine = [item.attrib.get("idref") for item in opf_root.findall(".//{http://www.idpf.org/2007/opf}itemref")]
        (OUT / "manifest.json").write_text(json.dumps({"opfPath": opf_path, "spine": spine, "manifest": manifest}, indent=2), encoding="utf-8")
        print("files", len(names))
        print("opf", opf_path)
        print("spine", spine[:20], "count", len(spine))
        print("manifest count", len(manifest))
        print("first names:")
        for n in names[:40]:
            print(" ", n)


if __name__ == "__main__":
    main()
