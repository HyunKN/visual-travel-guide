"""Acquire a bounded, attributable development probe set; no private inputs."""
import hashlib
import html
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CACHE = ROOT / '.codex-build/sprint0-recognition'
REVISION = 'd15189d7028b43f1d3e65039190477f6af591c2a'
MODEL_REPO = 'Xenova/clip-vit-base-patch32'
MODEL_FILE = 'onnx/vision_model_quantized.onnx'
BASE = 'https://royal.khs.go.kr'
# Source captions are checked again at acquisition time, not inferred from page titles.
SOURCES = [
    ('geunjeongjeon', '근정전', '20231123030313006700', 5680, [5678,5677,5680,5676,5679], [(5673,'근정문')]),
    ('gyeonghoeru', '경회루', '20231123030313005682', 5718, [5716,5717,5718,5719,5720], []),
    ('sajeongjeon', '사정전', '20231123030313000072', 5693, [5693,5694], [(5691,'만춘전')]),
    ('sujeongjeon', '수정전', '20231123030313005428', 5705, [5704,5705,5706], []),
    ('gangnyeongjeon', '강녕전', '20231123030313002633', 5734, [5733,5734,5735,5736], []),
    ('gyotaejeon', '교태전', '20231123030313003299', 5740, [5739,5740,5741,5742], [(5744,'아미산굴뚝')]),
]


def fetch(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'VisualTravelGuide-Sprint0-Research/0.1'})
        temporary = dest.with_suffix(dest.suffix + '.part')
        try:
            with urllib.request.urlopen(request, timeout=90) as response, temporary.open('wb') as out:
                while chunk := response.read(1024 * 1024):
                    out.write(chunk)
            temporary.replace(dest)
        finally:
            temporary.unlink(missing_ok=True)
    return dest


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def code_fingerprints(*names):
    return {name: digest(HERE / name) for name in names}


def main():
    entries = []
    for label, name, page_id, reference, ids, outsiders in SOURCES:
        url = f'{BASE}/user/board/E101020000_view_storyBoard.ajax?id={page_id}&siteCode=ENG'
        page = fetch(url, CACHE / 'sources' / f'{label}.html')
        source = page.read_text(encoding='utf-8')
        if 'nuri_eng.gif' not in source or 'koglEngInfo.html' not in source:
            raise ValueError(f'Expected source license marker missing: {label}')
        captions = {}
        for image_id, caption in re.findall(r'<img src="/afile/preview/(\d+)" alt="([^"]*)"', source):
            captions[int(image_id)] = html.unescape(caption)
        for image_id, actual_name in [(i,name) for i in ids] + outsiders:
            caption = captions[image_id]
            if actual_name not in caption:
                raise ValueError(f'Caption mismatch: {image_id} {caption}')
            download_url = f'{BASE}/afile/preview/{image_id}'
            path = fetch(download_url, CACHE / 'images' / f'{image_id}.jpg')
            with Image.open(path) as image:
                width, height = image.size
                image.verify()
            entries.append({
                'id': str(image_id), 'label': label if image_id in ids else None,
                'name': actual_name, 'caption': caption,
                'role': 'reference' if image_id == reference else ('probe' if image_id in ids else 'out_of_scope'),
                'lighting': 'ambiguous' if image_id == 5720 else ('night' if '야경' in caption else 'day'),
                'visual_review': '2026-10-23 contact sheet reviewed; 5720 caption says night but appearance ambiguous' if image_id == 5720 else '2026-10-23 source caption and contact sheet reviewed',
                'viewpoint': 'elevated' if image_id in [5673,5677,5678,5716,5717,5718,5693,5704,5733,5739] else 'ground',
                'file': path.relative_to(ROOT).as_posix(), 'sha256': digest(path),
                'bytes': path.stat().st_size, 'width': width, 'height': height,
                'source_url': url, 'download_url': download_url,
                'credit': f'{caption} · 국가유산청 궁능유적본부',
                'license': 'KOGL Type 1 (source-linked mark; checked 2026-10-23)',
                'license_url': 'https://www.kogl.or.kr/info/licenseType1.do',
                'license_mark_url': f'{BASE}/resource/templete/royal/img/common/nuri_eng.gif',
                'source_snapshot_sha256': digest(page),
                'capture_date': None, 'capture_group': 'unknown; same institution collection',
            })
            print(f'{image_id} {actual_name} {width}x{height}', flush=True)
    if len({e['sha256'] for e in entries}) != len(entries):
        raise ValueError('Exact duplicate image detected; resolve before experiment')
    files = {}
    for filename in [MODEL_FILE, 'preprocessor_config.json', 'config.json']:
        url = f'https://huggingface.co/{MODEL_REPO}/resolve/{REVISION}/{filename}'
        path = fetch(url, CACHE / 'model' / Path(filename).name)
        files[filename] = {'url': url, 'file': path.relative_to(ROOT).as_posix(), 'sha256': digest(path), 'bytes': path.stat().st_size}
    manifest = {
        'version': 1, 'acquired_at_utc': datetime.now(timezone.utc).isoformat(),
        'purpose': 'development probes only; not an independent final evaluation set',
        'images': entries,
        'model': {'repository': MODEL_REPO, 'revision': REVISION, 'files': files,
                  'upstream': 'https://huggingface.co/openai/clip-vit-base-patch32',
                  'upstream_license': 'https://github.com/openai/CLIP/blob/main/LICENSE',
                  'conversion_notice': 'third-party ONNX conversion, not an OpenAI mobile release'},
    }
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Prepared {len(entries)} images; model {files[MODEL_FILE]["bytes"]} bytes', flush=True)


if __name__ == '__main__':
    main()
