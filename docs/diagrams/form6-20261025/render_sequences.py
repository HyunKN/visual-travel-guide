"""Render this folder's Mermaid sequence subset as editable SVG and high-res PNG.

No browser/network required. Mermaid files remain the semantic source.
"""
from pathlib import Path
from html import escape
import re
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
FONT = 'C:/Windows/Fonts/malgun.ttf'
BOLD = 'C:/Windows/Fonts/malgunbd.ttf'
INK = '#20384b'
MUTED = '#667b8b'
W = 1600


def render(name, title, subtitle):
    source = (BASE / f'{name}.mmd').read_text(encoding='utf-8')
    actors, events = [], []
    for line in source.splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        m = re.match(r'(?:actor|participant) (\w+) as (.+)', line)
        if m:
            actors.append(m.groups())
        else:
            events.append(line)
    xs = {key: 150 + i * 1300 / (len(actors)-1) for i, (key, _) in enumerate(actors)}
    measure = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    def ft(size, bold=False):
        return ImageFont.truetype(BOLD if bold else FONT, size)
    def wrap(text, width, size=30):
        lines, current = [], ''
        for word in text.split(' '):
            trial=(current+' '+word).strip()
            if measure.textlength(trial,font=ft(size))<=width:
                current=trial
                continue
            if current:lines.append(current);current=''
            for ch in word:
                if current and measure.textlength(current+ch,font=ft(size))>width:
                    lines.append(current);current=ch
                else:current+=ch
        if current:lines.append(current)
        return lines
    # Each event gets its own row. Branch headers and notes have separate rows.
    rows, y = [], 235
    for event in events:
        if event.startswith(('alt ', 'opt ', 'else ')):
            h = 52
        elif event == 'end':
            h = 25
        elif event.startswith('Note over '):
            h = 30 * len(wrap(event.split(':', 1)[1].strip(), 1370, 23)) + 36
        else:
            m = re.match(r'(\w+)(-->>|->>)(\w+):\s*(.+)', event)
            if not m:
                raise ValueError(event)
            a, _, b, label = m.groups()
            width = max(250, abs(xs[b]-xs[a])-20) if a != b else 580
            h = max(78, 35 * len(wrap(label, width)) + 40)
        rows.append((event, y, h)); y += h
    H = y + 105
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
           '<rect width="100%" height="100%" fill="white"/>']
    def rect(x1, y1, x2, y2, fill='none', stroke='#b4c1cb', sw=2):
        d.rectangle((x1,y1,x2,y2), fill=None if fill=='none' else fill, outline=stroke, width=sw)
        svg.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
    def line(x1,y1,x2,y2,color=INK,dashed=False,sw=2):
        if dashed:
            import math
            length=math.hypot(x2-x1,y2-y1)
            for start in range(0,int(length),14):
                end=min(start+8,length)
                d.line((x1+(x2-x1)*start/length,y1+(y2-y1)*start/length,x1+(x2-x1)*end/length,y1+(y2-y1)*end/length),fill=color,width=sw)
        else:
            d.line((x1,y1,x2,y2),fill=color,width=sw)
        dash=' stroke-dasharray="8 6"' if dashed else ''
        svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"{dash}/>')
    def text(x,y,value,size=30,bold=False,center=True,color=INK):
        anchor='mt' if center else 'lt'
        d.text((x,y),value,font=ft(size,bold),fill=color,anchor=anchor)
        align='middle' if center else 'start'
        svg.append(f'<text x="{x}" y="{y}" text-anchor="{align}" dominant-baseline="text-before-edge" font-family="Malgun Gothic, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(value)}</text>')
    def arrow(x1,y1,x2,y2,dashed=False):
        line(x1,y1,x2,y2,dashed=dashed)
        sign=1 if x2>x1 else -1
        points=[(x2,y2),(x2-sign*12,y2-6),(x2-sign*12,y2+6)]
        d.polygon(points,fill=INK)
        svg.append('<polygon points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="{INK}"/>')
    text(55,30,title,36,True,False)
    text(55,88,subtitle,23,False,False,MUTED)
    for key,label in actors:
        x=xs[key]
        rect(x-120,145,x+120,203,'#edf3f6',INK)
        text(x,159,label,27,True)
        line(x,203,x,H-90,'#acbbc6',True)
    stack=[]
    for event,yy,h in rows:
        if event.startswith(('alt ','opt ')):
            depth=len(stack); left=35+depth*12; right=W-35-depth*12
            stack.append((left,yy,right))
            text(left+13,yy+7,('분기 · ' if event.startswith('alt ') else '선택 · ')+event[4:],23,True,False)
        elif event.startswith('else '):
            left,_,right=stack[-1]
            line(left,yy,right,yy,'#9eafba',True)
            text(left+13,yy+9,'또는 · '+event[5:],23,True,False)
        elif event=='end':
            left,top,right=stack.pop()
            rect(left,top,right,yy+h-7)
        elif event.startswith('Note over '):
            lines=wrap(event.split(':',1)[1].strip(),1370,23)
            rect(65,yy+4,W-65,yy+h-5,'#f1f5f7','#d7e0e6',1)
            for j,label in enumerate(lines):text(88,yy+15+j*30,label,23,False,False)
        else:
            a,kind,b,label=re.match(r'(\w+)(-->>|->>)(\w+):\s*(.+)',event).groups()
            x1,x2=xs[a],xs[b]
            width=max(250,abs(x2-x1)-20) if a!=b else 580
            labels=wrap(label,width)
            if a==b:
                for j,t in enumerate(labels):text(x1+16,yy+j*35,t,30,False,False)
                ay=yy+len(labels)*35+4
                line(x1,ay,x1+70,ay)
                line(x1+70,ay,x1+70,ay+17)
                arrow(x1+70,ay+17,x1,ay+17,kind=='-->>')
            else:
                for j,t in enumerate(labels):text((x1+x2)/2,yy+j*35,t)
                ay=yy+len(labels)*35+9
                arrow(x1,ay,x2,ay,kind=='-->>')
    assert not stack
    text(55,H-48,'구현 전 설계 · 실선: 요청/행동 · 점선: 결과/안내',21,False,False,MUTED)
    svg.append('</svg>')
    (BASE/f'{name}.svg').write_text('\n'.join(svg),encoding='utf-8')
    im.save(BASE/f'{name}.png',dpi=(240,240))
    # Word already has the title/caption; preserve participant/message text size.
    im.crop((0,125,W,H-70)).save(BASE/f'{name}-word.png',dpi=(240,240))
    return {'name':name,'width':W,'height':H,'messages':sum(bool(re.match(r'\w+(?:-->>|->>)',e)) for e in events)}


if __name__=='__main__':
    import json
    results=[render('flow1','핵심 흐름 1 · 앱 실행에서 첫 설명까지','사진 인식과 준비된 예시를 구분하고, 같은 대상의 설명·출처로 연결합니다.'),
             render('flow2','핵심 흐름 2 · 불확실한 결과에서 다시 탐색하기','후보 비교는 조건에 따라 선택하며, 선택·보류·재입력의 경로를 나눕니다.')]
    print(json.dumps(results,ensure_ascii=False))
