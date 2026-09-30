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
const origin=process.argv[2]||'http://127.0.0.1:3000',engine=process.argv[3]||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(executablePath ? { executablePath } : {})});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
try{
 await page.goto(origin+'/?pcb-debug=1',{waitUntil:'domcontentloaded'});await page.waitForSelector('.public-circuit-art[data-viewport-state="ready"]');
 await page.evaluate(()=>{const target=document.querySelector('main');window.__emit=(type,id,x,y)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:id,clientX:x,clientY:y}));window.__emit('pointerdown',11,180,320);});
 await page.waitForFunction(()=>[...document.querySelectorAll('.public-circuit-touch-main')].some(c=>getComputedStyle(c).visibility==='visible'));
 const before=await page.locator('.public-circuit-touch-main').evaluateAll(es=>es.find(e=>getComputedStyle(e).visibility==='visible')?.style.transform);
 await page.evaluate(()=>{window.__emit('pointerup',11,180,320);window.__emit('pointerdown',12,250,320);});await page.waitForTimeout(150);
 const after=await page.locator('.public-circuit-touch-main').evaluateAll(es=>es.find(e=>getComputedStyle(e).visibility==='visible')?.style.transform);
 console.log(JSON.stringify({engine,before,after,reactivated:before!==after}));
 assert.notEqual(after,before,'release/new contact before next animation frame was lost');
 await page.evaluate(()=>{window.__emit('pointerup',12,250,320);scrollTo({top:1200,behavior:'smooth'});});
 await page.waitForFunction(()=>scrollY>20 && scrollY<1000);
 await page.evaluate(()=>window.__emit('pointerdown',13,110,320));
 await page.waitForFunction(()=>[...document.querySelectorAll('.public-circuit-touch-main')].some(e=>getComputedStyle(e).visibility==='visible'&&e.style.transform.startsWith('translate3d(-100px')),{},{timeout:5000});
 console.log(engine+' touch activation during ongoing smooth scroll: pass');
 await page.evaluate(()=>{window.__emit('pointerup',13,110,320);});
}finally{await browser.close();}
