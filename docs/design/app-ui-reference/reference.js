/* Isolated reference behavior. No fetch, storage, native launch, or photo upload. */
'use strict';
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const sceneImage = $('scene-image');
const traces = [...document.querySelectorAll('.trace')];
const notes = [
  {body:'한참 지붕만 보다가, 돌 사이에 난 풀을 봤다. 오늘은 여기가 제일 기억에 남는다.', count:24, liked:false},
  {body:'같은 곳을 보고 있어도 서로 기억하는 장면은 다르겠지.', count:7, liked:false},
];
let fit = false;
let activeTrace = null;
let activeNote = 0;
let photoUrl = null;
let photoGeneration = 0;
let submitted = null;
const stageControls = () => [...stage.querySelectorAll('.trace,.scene-bottom')];
function layoutScene() {
  const iw = sceneImage.naturalWidth, ih = sceneImage.naturalHeight;
  if (!iw || !ih) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  const scale = (fit ? Math.min : Math.max)(w/iw,h/ih);
  const width = iw*scale, height = ih*scale;
  const left = (w-width)/2, top = (h-height)/2;
  Object.assign(sceneImage.style,{width:`${width}px`,height:`${height}px`,left:`${left}px`,top:`${top}px`});
  traces.forEach(trace => {
    const x = left + Number(trace.dataset.u)*width;
    const y = top + Number(trace.dataset.v)*height;
    trace.style.left = `${x}px`;trace.style.top = `${y}px`;
    trace.hidden = x<24 || x>w-24 || y<24 || y>h-24 || trace.dataset.suppressed==='true';
  });
}
function closeReader() {
  $('reader-layer').hidden = true;
  stage.classList.remove('reading-note');
  document.querySelector('#scene .appbar').inert=false;
  $('note-menu').hidden = true;
  $('more').setAttribute('aria-expanded','false');
  stageControls().forEach(el => {el.inert=false;});
  const trace=activeTrace;
  activeTrace=null;
  if(trace && !trace.hidden) trace.focus();
}
function openReader(trace) {
  activeTrace=trace;activeNote=Number(trace.dataset.note);
  const note=notes[activeNote];
  traces.forEach(el=>el.classList.toggle('selected',el===trace));
  $('note-body').textContent=note.body;
  $('recommend').querySelector('span').textContent=note.count;
  $('recommend').setAttribute('aria-pressed',String(note.liked));
  $('reader-layer').classList.toggle('top',Number(trace.style.top.replace('px',''))>stage.clientHeight*.52);
  $('reader-layer').hidden=false;
  stage.classList.add('reading-note');
  document.querySelector('#scene .appbar').inert=true;
  stageControls().forEach(el=>{el.inert=true;});
  $('reader').focus();
}
traces.forEach(trace=>trace.addEventListener('click',()=>openReader(trace)));
$('close-reader').addEventListener('click',closeReader);
$('reader-layer').addEventListener('click',e=>{if(e.target.classList.contains('reader-scrim'))closeReader();});
$('reader').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();closeReader();return;}
  if(e.key!=='Tab')return;
  const buttons=[...$('reader').querySelectorAll('button')].filter(el=>!el.closest('[hidden]'));
  const first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('reader'))){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
$('recommend').addEventListener('click',()=>{
  const note=notes[activeNote];note.liked=!note.liked;note.count+=note.liked?1:-1;
  $('recommend').setAttribute('aria-pressed',String(note.liked));
  $('recommend').querySelector('span').textContent=note.count;
});
$('more').addEventListener('click',()=>{
  const open=$('note-menu').hidden;$('note-menu').hidden=!open;
  $('more').setAttribute('aria-expanded',String(open));
});
document.querySelectorAll('[data-note-action]').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.noteAction==='hide'){
    const trace=activeTrace;closeReader();trace.dataset.suppressed='true';layoutScene();$('fit').focus();
  }else{
    $('note-body').textContent='신고 흐름은 설계 대상입니다. 이 문서에서는 실제 신고를 전송하지 않습니다.';
  }
}));
$('fit').addEventListener('click',()=>{closeReader();fit=!fit;$('fit').textContent=fit?'확대 보기':'전체 사진';layoutScene();});
sceneImage.addEventListener('load',layoutScene);
new ResizeObserver(layoutScene).observe(stage);
layoutScene();
$('width').addEventListener('change',e=>{document.documentElement.style.setProperty('--phone-width',`${e.target.value}px`);});
$('large').addEventListener('change',e=>document.body.classList.toggle('large',e.target.checked));
$('opaque').addEventListener('change',e=>document.body.classList.toggle('opaque',e.target.checked));
document.querySelectorAll('a[href="#scene"]').forEach(link=>link.addEventListener('click',()=>{
  const origin=link.closest('.study');
  if(origin)document.querySelector('#scene .back').href=`#${origin.id}`;
}));
const placeData={gyotaejeon:{name:'교태전',body:'왕비의 생활 공간과 뒤뜰'},gwanghwamun:{name:'광화문',body:'세 개의 문으로 들어가는 궁궐'}};
document.querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>{
  const place=placeData[button.dataset.place];const area=$('place-preview');
  area.replaceChildren();const img=document.createElement('img');img.src=`../../../mobile/assets/places/${button.dataset.place}.jpg`;img.alt=place.name;
  const p=document.createElement('p');p.textContent=place.body;area.append(img,p);area.hidden=false;
}));
function renderSaved() {
  const area=$('my-note');area.replaceChildren();
  const meta=document.createElement('p');meta.className='note-meta';meta.textContent=`근정전 · ${submitted.visibility==='public'?'공개 선택 예시 (게시 안 됨)':'나만 보기 선택 예시 (기기 저장 안 됨)'}`;
  const body=document.createElement('p');body.textContent=submitted.body;
  const edit=document.createElement('a');edit.href='#compose';edit.className='text-action';edit.textContent='이어서 쓰기';
  area.append(meta,body,edit);
}
$('note-form').addEventListener('submit',e=>{
  e.preventDefault();const body=$('body').value.trim();
  if(!body){$('save-state').textContent='내용을 입력해 주세요.';$('body').focus();return;}
  const visibility=new FormData(e.target).get('visibility');
  submitted={body,visibility};renderSaved();
  $('save-state').textContent='문서 안의 내 글에 반영했어요. 실제 저장·공개는 하지 않았어요.';
});
document.querySelectorAll('input[name="visibility"]').forEach(input=>input.addEventListener('change',()=>{
  document.querySelector('[form="note-form"]').textContent=input.value==='public'?'공개하기':'나만 저장';
}));
$('photo-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  const generation=++photoGeneration;
  const next=URL.createObjectURL(file),probe=new Image();probe.src=next;
  try{await probe.decode();}catch{
    URL.revokeObjectURL(next);
    if(generation===photoGeneration){$('photo-state').textContent='사진을 열지 못했어요. 다른 사진을 선택해 주세요.';e.target.value='';}
    return;
  }
  if(generation!==photoGeneration){URL.revokeObjectURL(next);return;}
  if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=next;
  $('input-preview').src=photoUrl;$('input-preview').hidden=false;
  $('clear-photo').hidden=false;
  $('photo-state').textContent='';e.target.value='';
});
$('clear-photo').addEventListener('click',()=>{
  photoGeneration++;
  $('input-preview').hidden=true;$('input-preview').removeAttribute('src');
  $('clear-photo').hidden=true;
  if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;
  $('photo-state').textContent='선택을 지웠어요. 원본 사진은 삭제하지 않았어요.';
});
window.addEventListener('beforeunload',()=>{if(photoUrl)URL.revokeObjectURL(photoUrl);});
