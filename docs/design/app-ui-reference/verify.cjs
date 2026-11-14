const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
let playwright;
try { playwright=require('playwright'); }
catch { playwright=require(path.resolve('.codex-build/node_modules/playwright')); }
const {chromium}=playwright;
(async()=>{
 const out=path.resolve('docs/design/app-ui-reference/evidence');await fs.mkdir(out,{recursive:true});
 const options={headless:true};
 if(process.env.VTG_BROWSER_EXECUTABLE)options.executablePath=process.env.VTG_BROWSER_EXECUTABLE;
 const browser=await chromium.launch(options);
 const checks=[];const ok=(name)=>checks.push(name);let errors=[];let network=[];
 try{
 const page=await browser.newPage({viewport:{width:1320,height:1200},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(path.resolve('docs/design/app-ui-reference/index.html')).href);
 await page.evaluate(()=>document.fonts.ready);await page.locator('#scene-image').evaluate(img=>img.decode());
 for(const [i,id]of ['home','detail','scene','compose','photo','notes'].entries())await page.locator(`#${id} .phone`).screenshot({path:path.join(out,`0${i+1}-${id}.png`),animations:'disabled'});
 console.log(await page.locator('#home').ariaSnapshot());
 await page.locator('#home .photo-entry').click();assert.equal(await page.locator('#scene .back').getAttribute('href'),'#home');ok('Home-to-scene retains home return target');
 console.log(await page.locator('#scene').ariaSnapshot());
 await page.locator('[data-note="0"]').click();
 await page.locator('#scene .phone').screenshot({path:path.join(out,'03-reader.png'),animations:'disabled'});
 assert.equal(await page.locator('.scene-bottom').isVisible(),false);assert.equal(await page.locator('#fit').isVisible(),false);ok('Reader hides other scene actions');
 console.log(await page.locator('#reader').ariaSnapshot());
 await page.locator('#recommend').click();assert.equal(await page.locator('#recommend span').textContent(),'25');
 await page.locator('#recommend').click();assert.equal(await page.locator('#recommend span').textContent(),'24');ok('Fixture recommendation toggles and reverses');
 await page.locator('#more').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'close-reader');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#reader-layer').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.dataset.note),'0');ok('Reader keyboard trap, Escape and focus restoration');
 await page.locator('#fit').click();
 const mapping=await page.evaluate(()=>{const img=document.getElementById('scene-image').getBoundingClientRect();return [...document.querySelectorAll('.trace')].map(t=>{const r=t.getBoundingClientRect();return {dx:Math.abs(r.x+r.width/2-(img.x+Number(t.dataset.u)*img.width)),dy:Math.abs(r.y+r.height/2-(img.y+Number(t.dataset.v)*img.height))};});});
 assert(mapping.every(x=>x.dx<1&&x.dy<1));ok('Real DOM photo/anchor alignment within 1 CSS px in contain');
 await page.locator('#scene .phone').screenshot({path:path.join(out,'03-full-photo.png')});await page.locator('#fit').click();
 await page.locator('#detail .quiet-action').click();assert.equal(await page.locator('#scene .back').getAttribute('href'),'#detail');ok('Detail-to-scene retains detail return target');
 console.log(await page.locator('#compose').ariaSnapshot());
 await page.locator('#body').fill('같은 마당을 다시 바라봤다.');await page.locator('input[value="private"]').check();
 assert.equal(await page.locator('[form="note-form"]').textContent(),'나만 저장');await page.locator('[form="note-form"]').click();assert((await page.locator('#my-note').textContent()).includes('같은 마당을 다시 바라봤다.'));
 await page.locator('#notes .phone').screenshot({path:path.join(out,'06-note-saved.png')});
 await page.locator('#my-note a').click();assert.equal(await page.locator('#body').inputValue(),'같은 마당을 다시 바라봤다.');ok('Draft text retained across document navigation; mock save only');
 console.log(await page.locator('#photo').ariaSnapshot());
 await page.locator('#photo-file').setInputFiles(path.resolve('mobile/assets/places/geunjeongjeon.jpg'));await page.waitForFunction(()=>!document.getElementById('input-preview').hidden);
 const chosen=await page.locator('#input-preview').getAttribute('src');await page.locator('#photo .phone').screenshot({path:path.join(out,'05-photo-selected.png')});
 await page.locator('#photo-file').setInputFiles({name:'invalid.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not an image')});await page.waitForFunction(()=>document.getElementById('photo-state').textContent.includes('열지 못'));
 assert.equal(await page.locator('#input-preview').getAttribute('src'),chosen);await page.locator('#photo .phone').screenshot({path:path.join(out,'05-photo-error.png')});ok('Decode error retains prior photo');
 await page.locator('#clear-photo').click();assert.equal(await page.locator('#input-preview').isVisible(),false);ok('Clear hides preview without deleting source');
 console.log(await page.locator('.review-tools').ariaSnapshot());
 const layouts=[];
 for(const width of ['360','390','430'])for(const large of [false,true]){
  await page.locator('#width').selectOption(width);await page.locator('#large').setChecked(large);
  const measure=await page.evaluate(()=>[...document.querySelectorAll('.phone')].map(el=>{const scroll=el.querySelector('.screen-scroll');return {id:el.closest('.study').id,width:el.clientWidth,scrollWidth:el.scrollWidth,innerOverflow:scroll?scroll.scrollWidth-scroll.clientWidth:0};}));
  assert(measure.every(m=>m.scrollWidth<=m.width+1&&m.innerOverflow<=1));layouts.push({width,large,measure});
 }
 ok('Six phone frames: 360/390/430 at 100/200 percent, no horizontal overflow');
 await page.locator('#width').selectOption('360');
 await page.locator('#compose .phone').screenshot({path:path.join(out,'04-compose-large.png')});
 const footer=await page.locator('.compose-footer').boundingBox(),phone=await page.locator('#compose .phone').boundingBox();assert(footer.y>=phone.y&&footer.y+footer.height<=phone.y+phone.height+1);ok('Composer completion action stays inside phone at 200 percent');
 await page.locator('[data-note="0"]').click();
 await page.locator('#scene .phone').screenshot({path:path.join(out,'03-reader-large.png')});
 await page.locator('#note-body').evaluate(el=>el.textContent='오래 바라보니 다른 장면이 보였다. '.repeat(55));
 await page.locator('#note-body').evaluate(el=>el.scrollTop=el.scrollHeight);
 const long=await page.locator('#reader').evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('header button,footer button')].map(x=>{const b=x.getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom+1;});});assert(long.every(Boolean));
 await page.locator('#scene .phone').screenshot({path:path.join(out,'03-reader-long.png')});ok('Long note scrolls while close and footer controls stay visible');
 await page.locator('#opaque').check();await page.locator('#scene .phone').screenshot({path:path.join(out,'03-reader-opaque.png')});
 assert.equal(await page.locator('#reader').evaluate(el=>getComputedStyle(el).backdropFilter),'none');ok('Reduced-transparency preview is opaque without blur');
 await page.locator('#close-reader').click();
 await page.locator('#large').uncheck();await page.locator('#opaque').uncheck();await page.locator('#width').selectOption('390');
 await page.setViewportSize({width:360,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=360));ok('Reference document itself reflows at 360px browser viewport');
 assert.equal(errors.length,0);assert.equal(network.length,0);ok('No JavaScript errors or HTTP requests during checks');
 const sources={};for(const file of ['index.html','reference.css','reference.js'])sources[file]=crypto.createHash('sha256').update(await fs.readFile(path.resolve('docs/design/app-ui-reference',file))).digest('hex');
 await fs.writeFile(path.join(out,'checks.json'),JSON.stringify({date:'2026-11-06',scope:'Local HTML only; not Android or user-study evidence',browser:await browser.version(),sources,checks,layouts,errors,network},null,2));
 console.log(JSON.stringify({checks:checks.length,results:checks,errors,network}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
