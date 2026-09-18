from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# Minimal valid PNG writer (no extra deps): solid rounded-ish square + letter W.
import struct
import zlib


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(width: int, height: int, rgba_rows: list[bytes]) -> bytes:
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw = b"".join(b"\x00" + row for row in rgba_rows)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def draw(size: int) -> bytes:
    bg = (14, 18, 24, 255)
    accent = (125, 255, 166, 255)
    ink = (232, 238, 247, 255)
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            nx, ny = x / (size - 1), y / (size - 1)
            color = bg
            # siege frame
            if 0.12 < nx < 0.88 and 0.18 < ny < 0.82:
                color = (26, 34, 48, 255)
            # key caps
            if 0.22 < nx < 0.78 and 0.58 < ny < 0.74:
                color = accent if 0.28 < nx < 0.72 else (44, 54, 72, 255)
            # letter strokes approximating W
            in_w = (
                (abs((nx - 0.32) / 0.08 - (ny - 0.28) / 0.28) < 0.35 and 0.28 < ny < 0.56)
                or (abs((nx - 0.50) / 0.08 - (0.56 - ny) / 0.28) < 0.35 and 0.28 < ny < 0.56)
                or (abs((nx - 0.50) / 0.08 - (ny - 0.28) / 0.28) < 0.35 and 0.28 < ny < 0.56)
                or (abs((nx - 0.68) / 0.08 - (0.56 - ny) / 0.28) < 0.35 and 0.28 < ny < 0.56)
            )
            if in_w:
                color = ink
            row.extend(color)
        rows.append(bytes(row))
    return png(size, size, rows)


for size in (180, 192, 512):
    (OUT / f"icon-{size}.png").write_bytes(draw(size))
print("wrote", list(OUT.glob("icon-*.png")))
