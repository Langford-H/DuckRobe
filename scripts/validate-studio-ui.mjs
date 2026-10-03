import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const url=process.env.DUCKROBE_URL||'http://localhost:5173/';
const output=path.resolve(process.env.DUCKROBE_QA_OUTPUT||'test-results/studio-ui');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(45000);
const errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
async function ready(){await page.waitForFunction(()=>window.duckrobe?.ready,null,{timeout:180000});}
async function check(name,run){try{await run();checks.push({name,status:'passed'});console.log('PASS',name);}catch(error){checks.push({name,status:'failed',error:error.message});console.error('FAIL',name,error.message);}}
async function layout(){return page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return{width:innerWidth,overflow:document.documentElement.scrollWidth,stage:rect('.fitting-room'),closet:rect('.closet'),viewer:rect('.viewer'),save:rect('#save-look'),export:rect('#export-look'),columns:getComputedStyle(document.querySelector('.outfit-grid')).gridTemplateColumns.split(' ').length,scroll:getComputedStyle(document.querySelector('#catalog-scroll')).overflowY,framing:window.duckrobe.preview.getFraming()};});}
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();
 await check('default full character, generous three-column desktop and collapsed tools',async()=>{
  const d=await layout();assert.equal(d.framing,'full');assert.equal(d.columns,3);assert(d.overflow<=1440);assert(d.closet.width>d.stage.width);assert(d.viewer.height>230);assert(d.save.bottom<=900&&d.export.bottom<=900);
  for(const id of ['colors-panel','moves-panel'])assert.equal(await page.locator('#'+id).evaluate(e=>e.open),false);
  assert.equal(await page.locator('#repository-link').getAttribute('href'),'https://github.com/ruziniuuuuu/DuckRobe');
  await page.screenshot({path:path.join(output,'desktop.png')});
 });
 await check('collections and bilingual search remain usable with collapsed color tools',async()=>{
  const catalog=await page.evaluate(()=>window.duckrobe.OUTFITS.map(({id,en,name})=>({id,en,name})));
  const themes=await page.evaluate(()=>window.duckrobe.THEMES.map(t=>t.id));
  for(const id of themes){await page.locator(`[data-theme="${id}"]`).click();assert.equal(await page.locator('[data-outfit]').count(),10);}
  await page.locator('[data-theme="all"]').click();
  for(const text of [catalog[0].en,catalog[0].name]){await page.locator('#outfit-search').fill(text);assert(await page.locator(`[data-outfit="${catalog[0].id}"]`).isVisible());}
  await page.locator('[data-language="zh"]').click();await page.locator('#colors-panel > summary').click();assert(/\p{Script=Han}/u.test(await page.locator('#color-lock').innerText()));await page.keyboard.press('Escape');
  await page.locator('#outfit-search').fill('no-such-duck-qa-837');assert.equal(await page.locator('[data-outfit]').count(),0);await page.locator('#clear-filters').click();assert.equal(await page.locator('[data-outfit]').count(),100);await page.locator('[data-language="en"]').click();
 });
 await check('close-up is manual, categories preserve full view, complete looks restore it',async()=>{
  await page.locator('[data-slot="hat"]').click();assert.equal((await layout()).framing,'full');
  await page.locator('#frame-camera').click();assert.equal((await layout()).framing,'portrait');
  await page.waitForFunction(()=>{const p=window.duckrobe.preview;return p.camera.position.distanceTo(p.controls.target)<.5});
  await page.locator('[data-slot="eyewear"]').click();assert.equal((await layout()).framing,'portrait');
  await page.locator('[data-slot="legwear"]').click();assert.equal((await layout()).framing,'full');
  await page.locator('[data-slot="all"]').click();await page.locator('[data-outfit="butter-walk"] .card-open').click();assert.equal((await layout()).framing,'full');
 });
 await check('exclusive panels, Escape focus, native color input and manual action dismissal',async()=>{
  await page.locator('#colors-panel > summary').click();assert(await page.locator('#shell-color').isVisible());
  await page.locator('#shell-color').evaluate(input=>{input.value='#fa792b';input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>window.duckrobe.state.colors.shell),'#fa792b');
  await page.locator('#moves-panel > summary').click();await page.waitForFunction(()=>!document.querySelector('#colors-panel').open);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#moves-panel').evaluate(e=>e.open),false);assert(await page.locator('#moves-panel > summary').evaluate(e=>e===document.activeElement));
  await page.locator('#moves-panel > summary').click();await page.locator('[data-action="hop"]').click();assert.equal(await page.locator('#moves-panel').evaluate(e=>e.open),false);assert.equal((await layout()).framing,'full');
 });
 await check('laptop, narrow desktop, tablet and mobile retain comfortable columns in both languages',async()=>{
  for(const [width,height,columns] of [[1366,768,3],[1200,800,2],[768,1024,3],[390,844,2],[340,844,2]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
   for(const language of ['en','zh']){
    await page.locator(`[data-language="${language}"]`).click();const d=await layout();assert(d.overflow<=width+1,JSON.stringify(d));assert.equal(d.columns,columns);
    if(width>=1100){assert.equal(d.scroll,'auto');assert(d.export.bottom<=height+1,JSON.stringify(d));}
    else assert.equal(d.scroll,'visible');
    await page.locator('#colors-panel > summary').click();const bounds=await page.locator('#colors-panel .studio-panel-content').boundingBox();assert(bounds.x>=-1&&bounds.x+bounds.width<=width+1);await page.keyboard.press('Escape');
   }
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,`viewport-${width}.png`)});
  }
 });
 await check('full framing contains tall hats and wings, and reduced motion keeps camera changes immediate',async()=>{
  await page.setViewportSize({width:1440,height:900});
  const framed=await page.evaluate(async()=>{
   const app=window.duckrobe,p=app.preview;p.setMotion(false);
   const results=[];
   for(const id of ['library-spell','moon-garden','satellite-letter']){
    app.selectLook(id);p.setFraming('full',{immediate:true});p.camera.updateMatrixWorld(true);
    const native=p.rig.group;native.updateMatrixWorld(true);
    let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity;
    native.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const position=mesh.geometry.getAttribute('position');const v=mesh.position.clone();for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).project(p.camera);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);}});
    results.push({id,minY,maxY,minX,maxX});
   }return results;
  });
  for(const frame of framed)assert(frame.minY> -1&&frame.maxY<1&&frame.minX> -1&&frame.maxX<1,JSON.stringify(frame));
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'),'false');
  await page.locator('#frame-camera').click();const a=await page.evaluate(()=>window.duckrobe.preview.camera.position.toArray());await page.waitForTimeout(250);const b=await page.evaluate(()=>window.duckrobe.preview.camera.position.toArray());assert(a.every((x,i)=>Math.abs(x-b[i])<1e-7));
 });
 await check('no browser errors',async()=>assert.deepEqual(errors,[]));
}finally{await writeFile(path.join(output,'validation.json'),JSON.stringify({url,checks,errors},null,2));await browser.close();}
assert(checks.every(check=>check.status==='passed'),'Studio UI checks failed');
