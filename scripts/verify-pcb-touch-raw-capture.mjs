import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
let playwright;
try { playwright = await import('playwright'); } catch {}
const browserRoot = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright');
if (!playwright && browserRoot) {
 for (const name of await readdir(path.join(browserRoot, '.links'))) {
  const core = (await readFile(path.join(browserRoot, '.links', name), 'utf8')).trim();
  try { playwright = await import(pathToFileURL(path.join(path.dirname(core), 'playwright', 'index.mjs'))); break; } catch {}
 }
}
assert(playwright, 'An installed Playwright module is required for this browser regression check');
const { chromium, webkit } = playwright;
let executablePath;
if (process.argv[3] === 'webkit' && !existsSync(webkit.executablePath()) && browserRoot) {
 for (const name of await readdir(browserRoot)) {
  const candidate = path.join(browserRoot, name, 'Playwright.exe');
  if (name.startsWith('webkit-') && existsSync(candidate)) executablePath = candidate;
 }
} else if (process.argv[3] !== 'webkit') {
 const candidate = path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe');
 if (existsSync(candidate)) executablePath = candidate;
}
const origin=process.argv[2]||'http://192.168.0.101:3000',engine=process.argv[3]||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(executablePath ? { executablePath } : {})});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const uploads=[];
try {
 await page.route('**/api/pcb-touch-capture',async route=>{
  const body=route.request().postData();assert(body.length<=180000,'combined capture exceeds API limit');
  uploads.push(JSON.parse(body));await route.fulfill({status:204});
 });
 await page.goto(origin+'/?pcb-debug=1&pcb-capture=1',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.public-circuit-art[data-viewport-state="ready"]');
 await page.waitForTimeout(500);
 await page.evaluate(()=>{
  window.__captureSavedRAF=window.requestAnimationFrame;
  window.requestAnimationFrame=()=>0;
  const target=document.querySelector('main');
  for(const pointerId of [701,702]) target.dispatchEvent(new PointerEvent('pointerdown',{
   bubbles:true,pointerType:'touch',pointerId,clientX:pointerId===701?110:280,clientY:320,
  }));
 });
 await page.waitForTimeout(850);
 const upload=uploads.find(payload=>payload.events?.some(record=>record.eventType==='pointerdown'&&record.pointerId===702));
 assert(upload,'raw rejected contact was not uploaded');
 assert.equal(upload.frames.length,0,'proof requires no accepted animation frames');
 const first=upload.events.find(record=>record.kind==='raw-before'&&record.pointerId===701);
 const rejected=upload.events.find(record=>record.kind==='raw-before'&&record.pointerId===702);
 assert.equal(first.pointerActive,0,'raw listener must precede ownership mutation');
 assert.equal(rejected.pointerActive,1);
 assert(upload.events.some(record=>record.kind==='decision'&&record.eventId===rejected.eventId&&record.reason==='pointer-ignored-existing-owner'));
 assert(upload.events.some(record=>record.kind==='after-dispatch-batch'&&record.eventId===rejected.eventId&&record.trackedId===701));
 assert.equal(rejected.trusted,0,'synthetic regression is not physical momentum evidence');
 console.log(JSON.stringify({engine,rawOrdering:true,rejectedContactUploaded:true,acceptedFrames:upload.frames.length,bodyChars:JSON.stringify(upload).length,physicalMomentumVerified:false}));
 await page.evaluate(()=>{window.requestAnimationFrame=window.__captureSavedRAF;});
} finally { await browser.close(); }
