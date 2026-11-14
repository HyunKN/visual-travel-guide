// Run against compiled reference modules; no mobile runtime or network is exercised.
const assert = require('node:assert/strict');
const path = require('node:path');
const folder = path.resolve(process.argv[2]);
const { containRect, project, unproject, groupMarkers } = require(path.join(folder, 'geometry.js'));
const { validateBody, MAX_BODY_UTF8_BYTES } = require(path.join(folder, 'contract.js'));
let checks = 0;
const test = (name, fn) => { fn(); checks++; process.stdout.write(`PASS ${name}\n`); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test('different phone and image sizes preserve anchors and edge touch targets', () => {
  for (const stage of [{width:320,height:400},{width:360,height:480},{width:390,height:620},{width:600,height:320}]) {
    for (const image of [{width:1600,height:1000},{width:800,height:1600}]) {
      const rect = containRect(image, stage);
      for (let u=0; u<=10; u++) for (let v=0; v<=10; v++) {
        const point = project({u:u/10,v:v/10}, rect);
        const back = unproject(point,rect);
        assert.ok(back); near(back.u,u/10); near(back.v,v/10);
        assert.ok(point.x-24>=-1e-10 && point.x+24<=stage.width+1e-10);
        assert.ok(point.y-24>=-1e-10 && point.y+24<=stage.height+1e-10);
      }
    }
  }
});
test('letterboxing and invalid coordinates cannot create anchors', () => {
  const rect = containRect({width:1600,height:1000},{width:390,height:600});
  assert.equal(unproject({x:0,y:0},rect),null);
  assert.equal(unproject({x:NaN,y:100},rect),null);
  assert.throws(()=>project({u:1.1,v:0.5},rect),RangeError);
  assert.throws(()=>containRect({width:0,height:1},{width:390,height:600}),RangeError);
  assert.throws(()=>containRect({width:1,height:1},{width:48,height:600}),RangeError);
});
test('overlap groups conserve IDs, have disjoint touch targets, and ignore query order', () => {
  const markers = Array.from({length:60},(_,i)=>({id:`m${String(i).padStart(2,'0')}`,x:24+(i*53)%312,y:24+(i*71)%460}));
  const groups = groupMarkers(markers);
  assert.deepEqual(groups,groupMarkers([...markers].reverse()));
  assert.deepEqual(groups.flatMap(g=>g.ids).sort(),markers.map(m=>m.id).sort());
  for(let i=0;i<groups.length;i++) for(let j=i+1;j<groups.length;j++) {
    assert.ok(Math.abs(groups[i].x-groups[j].x)>=56 || Math.abs(groups[i].y-groups[j].y)>=56);
  }
  assert.deepEqual(groupMarkers([]),[]);
  assert.throws(()=>groupMarkers([{id:'same',x:0,y:0},{id:'same',x:1,y:1}]),RangeError);
});
test('free text preserves multiline Korean and rejects empty or oversized payloads', () => {
  assert.equal(validateBody('  \n\t'), 'empty');
  assert.equal(validateBody('지붕 그림자가 길었다.\n다음에는 아침에 와보고 싶다.'),null);
  assert.equal(validateBody('a'.repeat(MAX_BODY_UTF8_BYTES)),null);
  assert.equal(validateBody('가'.repeat(Math.floor(MAX_BODY_UTF8_BYTES/3)+1)),'too-large');
});
process.stdout.write(`${checks} reference checks passed; native UI and server remain unverified.\n`);
