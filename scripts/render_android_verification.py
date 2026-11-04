"""Render the existing Markdown evidence as a server-free reader page.

Requires markdown-it-py (already available in the development Python runtime).
The Markdown remains the evidence source; this script does not rerun Android QA.
"""
from hashlib import sha256
from pathlib import Path

from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'mobile/VERIFICATION.md'
target = ROOT / 'docs/operations/ANDROID_VERIFICATION.html'
markdown = source.read_text(encoding='utf-8')
parser = MarkdownIt('commonmark', {'html': False}).enable('table')
tokens = parser.parse(markdown.split('\n', 1)[1])
# Local source-code/Markdown references are text, not misleading browser links.
# Only the explicit reader navigation and public web references are clickable.
for token in tokens:
    stack = []
    for child in token.children or []:
        if child.type == 'link_open':
            href = child.attrGet('href') or ''
            local = not href.startswith(('https://', 'http://'))
            stack.append(local)
            if local:
                child.tag = 'span'
                child.attrs = {'title': f'개발용 원본: {href}'}
        elif child.type == 'link_close' and stack.pop():
            child.tag = 'span'
content = parser.renderer.render(tokens, parser.options, {})
digest = sha256(source.read_bytes()).hexdigest()
page = '''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Android 개발 검증 기록 · Visual Travel Guide</title><link rel="icon" href="data:,">
<style>
*{box-sizing:border-box}body{margin:0;color:#172a43;background:#fff;font:15px/1.75 system-ui,"Malgun Gothic",sans-serif}header,main,footer{max-width:1100px;margin:auto;padding:26px 28px}header{border-bottom:1px solid #dfe5ec}header p{color:#536275;margin:5px 0}h1{font-size:28px;line-height:1.4;margin:8px 0}h2{font-size:21px;margin:32px 0 12px}h3{font-size:17px;margin:24px 0 8px}a{color:#284f8b;text-underline-offset:3px}a:focus-visible,summary:focus-visible{outline:3px solid #284f8b;outline-offset:4px}.verdict{background:#fff1e8;padding:17px 20px;border-radius:7px;margin-top:18px;color:#803514}.verdict strong{display:block;font-size:18px}.verdict p{color:inherit}p{margin:9px 0 14px}li{margin:6px 0}code{background:#f1f4f8;border-radius:3px;padding:1px 4px;font-size:.88em;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #dfe5ec;padding:11px 12px}th{background:#f5f7fa;white-space:nowrap}td{overflow-wrap:anywhere}td:first-child{min-width:145px}footer{border-top:1px solid #dfe5ec;color:#536275;font-size:12px;overflow-wrap:anywhere}.reader-note{font-size:13px;color:#536275}@media(max-width:650px){header,main,footer{padding:20px 16px}h1{font-size:23px}table{display:block;overflow-x:auto}th,td{min-width:110px}td:first-child{min-width:140px}}
</style></head><body>
<header><a href="SPRINT_PROGRESS.html#android-verification">← Sprint 현황판으로</a><h1>Android 개발 검증 기록</h1>
<p>원본에 기록된 검사 결과입니다. 현재 기기 상태를 실시간으로 조회하지 않습니다.</p>
<div class="verdict"><strong>빌드 결과와 기기 실행 결과를 구분해 기록합니다.</strong><p>아래에서 통과·실패·미실행 항목과 남은 확인을 함께 볼 수 있습니다.</p></div>
<p class="reader-note">이 문서는 파일 자체로 열립니다. 임시 서버나 인터넷 연결 없이 검사 결과를 읽을 수 있습니다.</p></header>
<main>__CONTENT__</main><footer>원본: mobile/VERIFICATION.md · 이 페이지는 원본의 읽기용 변환본이며 새 검사 결과가 아닙니다.<br>원본 SHA-256: __HASH__</footer>
</body></html>
'''
target.write_text(page.replace('__CONTENT__', content).replace('__HASH__', digest), encoding='utf-8')
print(f'Rendered {target.relative_to(ROOT)} from {source.relative_to(ROOT)}')
