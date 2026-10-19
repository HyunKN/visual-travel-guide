"""Rebuild the three P01 display derivatives without altering archived originals."""
import hashlib
import json
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[2]
prepared = root / "docs/prototype/content-preparation"
runtime = root / "docs/prototype/content"
packet = json.loads((prepared / "packet.json").read_text(encoding="utf-8"))
content_path = runtime / "content.json"
data = json.loads(content_path.read_text(encoding="utf-8"))
totals = [0, 0]
for source in packet["assets"]:
    original = prepared / source["localPath"]
    raw = original.read_bytes()
    if hashlib.sha256(raw).hexdigest() != source["sha256"]:
        raise ValueError(f"Original hash mismatch: {source['id']}")
    relative = f"assets/{original.stem}.webp"
    destination = runtime / relative
    with Image.open(original) as image:
        image = image.convert("RGB")
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        image.save(destination, format="WEBP", quality=90, method=6)
        width, height = image.size
    output = destination.read_bytes()
    asset = next(a for a in data["assets"] if a["id"] == source["id"])
    asset.update(localPath=relative, width=width, height=height,
                 byteSize=len(output), sha256=hashlib.sha256(output).hexdigest(),
                 modificationNote="P01 원본에서 긴 변 최대1600px 비율 유지 축소·WebP quality90 변환. 크롭·색보정·생성형 처리·표식 합성 없음.",
                 original={"localPath": f"../content-preparation/{source['localPath']}",
                           "sha256": source["sha256"], "width": source["width"],
                           "height": source["height"], "byteSize": len(raw)})
    totals[0] += len(raw)
    totals[1] += len(output)
    print(f"{source['id']}: {len(raw)} -> {len(output)} bytes, {width}x{height}")
data["contentVersion"] = "2026-10-16-scenes.3"
for preset in data["testPresets"]:
    preset["contentVersion"] = data["contentVersion"]
content_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"P01 originals {totals[0]} bytes; runtime derivatives {totals[1]} bytes")
