from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEARN = json.loads((ROOT / "src" / "data" / "tem8.json").read_text(encoding="utf-8"))
INCOMPLETE = json.loads((ROOT / "src" / "data" / "tem8.incomplete.json").read_text(encoding="utf-8"))
REPORT = ROOT / "vendor" / "openetymology" / "epub-inspect" / "audit50.json"


def contains_word(word: str, sentence: str) -> bool:
    token = re.escape(word)
    return re.search(rf"(?i)(^|[^a-z]){token}([^a-z]|$)", sentence) is not None


def main() -> None:
    missing_pos = [w for w in LEARN + INCOMPLETE if w.get("ipa") and w.get("gloss") and w.get("context") and not w.get("pos")]
    print("matched_missing_pos", json.dumps(missing_pos, ensure_ascii=False, indent=2)[:2000])
    print("incomplete_total", len(INCOMPLETE))
    print("incomplete_sample", [w["word"] for w in INCOMPLETE[:30]])
    hyphen = [w for w in LEARN if "-" in w["word"]]
    apostrophe = [w for w in LEARN if "'" in w["word"] or "’" in w["word"]]
    longw = sorted(LEARN, key=lambda w: len(w["word"]), reverse=True)[:5]
    shortw = sorted(LEARN, key=lambda w: len(w["word"]))[:5]
    multi = [w for w in LEARN if " " in (w.get("pos") or "") and w["pos"].count(".") >= 2][:5]
    picks = []
    for group in (shortw, longw, hyphen[:5], apostrophe[:5], multi):
        picks.extend(group)
    # deterministic 50: every Nth plus specials
    step = max(1, len(LEARN) // 50)
    sampled = LEARN[::step][:50]
    ids = {w["id"] for w in sampled}
    for extra in picks:
        if extra["id"] not in ids:
            sampled.append(extra)
            ids.add(extra["id"])
    issues = []
    for w in sampled:
        if not contains_word(w["word"], w.get("context") or ""):
            issues.append({"id": w["id"], "word": w["word"], "issue": "example_missing_word", "example": w.get("context")})
        if not w.get("ipa", "").startswith("/"):
            issues.append({"id": w["id"], "word": w["word"], "issue": "ipa_format", "ipa": w.get("ipa")})
        if not w.get("pos"):
            issues.append({"id": w["id"], "word": w["word"], "issue": "missing_pos"})
        if not w.get("gloss"):
            issues.append({"id": w["id"], "word": w["word"], "issue": "missing_gloss"})
    REPORT.write_text(
        json.dumps(
            {
                "sampled": [
                    {
                        "id": w["id"],
                        "word": w["word"],
                        "ipa": w["ipa"],
                        "pos": w["pos"],
                        "gloss": w["gloss"][:40],
                        "exampleHasWord": contains_word(w["word"], w.get("context") or ""),
                    }
                    for w in sampled[:50]
                ],
                "issues": issues,
                "hyphenCount": len(hyphen),
                "apostropheCount": len(apostrophe),
                "missingPos": missing_pos,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("sampled", len(sampled[:50]), "issues", len(issues), "hyphen", len(hyphen), "apostrophe", len(apostrophe))
    print(json.dumps(issues[:20], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
