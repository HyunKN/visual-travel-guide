"""Editable logical JSON ERD drawings. Requires Pillow and Windows Malgun Gothic."""
from pathlib import Path
from html import escape
import json, math
from PIL import Image, ImageDraw, ImageFont

BASE=Path(__file__).resolve().parent
INK='#20384b'; BORDER='#8296a6'; BLUE='#eaf0f5'
def font(n,b=False):return ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf' if b else 'C:/Windows/Fonts/malgun.ttf',n)

class Figure:
    def __init__(self,w,h):
        self.w=w;self.h=h;self.im=Image.new('RGB',(w,h),'white');self.d=ImageDraw.Draw(self.im)
        self.svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="white"/>']
    def text(self,x,y,t,size=30,b=False,fill=INK):
        self.d.text((x,y),t,font=font(size,b),fill=fill,anchor='lt')
        self.svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Malgun Gothic, sans-serif" font-size="{size}" font-weight="{700 if b else 400}" fill="{fill}">{escape(t)}</text>')
    def rect(self,x,y,w,h,fill='white'):
        self.d.rectangle((x,y,x+w,y+h),fill=fill,outline=BORDER,width=2)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{BORDER}" stroke-width="2"/>')
    def entity(self,x,y,w,title,fields):
        h=62+len(fields)*42+15;self.rect(x,y,w,h);self.rect(x,y,w,60,BLUE);self.text(x+17,y+12,title,32,True)
        for i,t in enumerate(fields):self.text(x+17,y+72+i*42,t,29)
        return (x,y,w,h)
    def path(self,pts,label,lx,ly):
        self.d.line(pts,fill=INK,width=3)
        points=' '.join(f'{x},{y}' for x,y in pts);self.svg.append(f'<polyline points="{points}" fill="none" stroke="{INK}" stroke-width="3"/>')
        a,b=pts[-2],pts[-1];ang=math.atan2(b[1]-a[1],b[0]-a[0]);p=[b,(b[0]-12*math.cos(ang-.45),b[1]-12*math.sin(ang-.45)),(b[0]-12*math.cos(ang+.45),b[1]-12*math.sin(ang+.45))]
        self.d.polygon(p,fill=INK);self.svg.append('<polygon points="'+' '.join(f'{x},{y}' for x,y in p)+f'" fill="{INK}"/>')
        tw=self.d.textlength(label,font=font(27));self.d.rectangle((lx-6,ly-3,lx+tw+6,ly+36),fill='white');self.svg.append(f'<rect x="{lx-6}" y="{ly-3}" width="{tw+12}" height="39" fill="white"/>');self.text(lx,ly,label,27)
    def save(self,name):
        self.svg.append('</svg>');(BASE/f'{name}.svg').write_text('\n'.join(self.svg),encoding='utf-8');self.im.save(BASE/f'{name}.png',dpi=(260,260))
        self.im.crop((0,125,self.w,self.h-25)).save(BASE/f'{name}-word.png',dpi=(260,260))

def main():
    f=Figure(1600,1720)
    f.text(40,20,'논리 ERD 1 · 건물과 설명 자료',38,True)
    f.text(40,78,'PK: 고유 ID   FK: 다른 자료 참조   []: 복수 참조   ?: null 허용',27)
    f.entity(50,160,620,'구역 Area',['PK id','name, aliases','FK parentAreaId? → Area.id','FK photoAssetId? → Asset.id','FK mapAssetId? → Asset.id'])
    f.entity(930,160,620,'대상 Target',['PK id','kind, name, aliases','FK areaId → Area.id','FK parentBuildingId* → Target.id','FK overviewEntryId? → Entry.id','FK heroAssetId? → Asset.id','position? (위·경도, sourceIds[])'])
    f.entity(50,700,620,'출처 Source',['PK id','title, publisher','url, checkedAt, claimNote'])
    f.entity(930,750,620,'설명 Entry',['PK id','FK targetId → Target.id','kind, title, summary','FK sourceIds[] → Source.id','FK assetIds[] → Asset.id','paragraphs, reviewStatus'])
    f.entity(50,1210,620,'이미지 Asset',['PK id','assetKey, alt','FK targetIds[] → Target.id','FK sourceId → Source.id','width, height, sha256'])
    f.path([(670,280),(800,280),(800,340),(930,340)],'1 : N',735,235)
    f.path([(1240,531),(1240,750)],'1 : N',1260,652)
    f.path([(930,943),(810,943),(810,840),(670,840)],'N : M',728,888)
    f.path([(360,1210),(360,903)],'N : 1',380,1095)
    f.path([(670,1376),(760,1376),(760,445),(930,445)],'N : M',696,1145)
    f.text(50,1580,'* parentBuildingId는 부분(kind=part)에만 필수입니다.',28)
    f.text(50,1625,'선은 주요 관계, 각 FK의 화살표는 참조 대상을 나타냅니다.',28)
    f.save('erd-core')
    f=Figure(1600,1220)
    f.text(40,20,'논리 ERD 2 · 질문과 등록 사진의 부분 탐색',36,True)
    f.text(40,78,'질문·부분 탐색은 Should·Sprint 미배치, 예시는 US-01에 연결',27)
    f.entity(50,170,620,'질문 Question · US-11',['PK id','label','FK targetId → Target.id','FK answerEntryId → Entry.id'])
    f.entity(930,170,620,'대상·설명 참조',['Target.PK id','Entry.PK id','같은 대상의 answer 설명만 연결'])
    f.path([(670,350),(930,350)],'N : 1 (각 참조)',700,296)
    f.entity(50,560,620,'지원 영역 Region · US-12',['PK id','FK assetId → Asset.id','FK partId → Target.id (part)','rect (0~1 좌표)'])
    f.entity(930,560,620,'등록 이미지·부분 참조',['Asset.PK id','Target.PK id (kind=part)','등록 사진 안의 지원 영역만 연결'])
    f.path([(670,740),(930,740)],'N : 1 (각 참조)',700,686)
    f.entity(50,950,620,'예시 Example · US-01',['PK id, label','FK assetId → Asset.id','FK targetId → Target.id'])
    f.entity(930,950,620,'검수한 이미지·대상 참조',['Asset.PK id','Target.PK id','실제 인식과 구분하여 표시'])
    f.path([(670,1090),(930,1090)],'N : 1 (각 참조)',700,1036)
    f.save('erd-extension')
    print(json.dumps({'diagrams':['erd-core','erd-extension']},ensure_ascii=False))

if __name__=='__main__':main()
