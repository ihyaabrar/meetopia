import { chromium, expect } from "@playwright/test";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
const output = "D:/Github/meetopia/.data/workstation-v2";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import { workstationPreview } from './src/client/art/workstation-preview';
import { workstationLayout,workstationReady } from './src/client/art/workstation-assets';
import { WORKSTATION_DIRECTIONS } from './src/shared/workstation';
import { DEFAULT_AVATAR } from './src/shared/avatar';
import { SEATED_PELVIS_OFFSET } from './src/shared/avatar-metrics';
window.masterQA=async()=>{
 const board=document.createElement('main');board.id='master-qa';board.style.cssText='display:grid;grid-template-columns:repeat(2,440px);gap:16px;background:#102326;padding:20px;font:16px sans-serif;color:white';document.body.replaceChildren(board);
 const snapshots=[];let checked=0;
 for(const body of ['tall','round','small'])for(const dir of WORKSTATION_DIRECTIONS){
  const fixture=await workstationPreview(dir,{...DEFAULT_AVATAR,body,outfit:'jacket',hair:'spiky',hairColor:'#257fc6',bodyColor:'#168f79',eyewear:'square'});
  if(!workstationReady())throw Error('Missing master');
  const chair=workstationLayout(fixture.map.objects[1],fixture.map),desk=workstationLayout(fixture.map.objects[0],fixture.map);
  if(Math.abs(chair.contact.y-fixture.person.y*32-SEATED_PELVIS_OFFSET)>0.001)throw Error('Pelvis contact changed');
  for(const part of ['desk','monitor','keyboard']) {const r=desk[part],sprite=desk.kit[part];if(Math.abs(r.w/r.h-sprite.width/sprite.height)>0.001)throw Error('Distorted '+part);}
  for(const zoom of [1,2])for(const activity of ['sit','type']){
   const c=document.createElement('canvas');c.width=440;c.height=360;c.dataset.fixture=body+'-'+dir+'-'+zoom+'-'+activity;
   fixture.draw(c,{zoom,activity,time:0});
   if(body==='tall'&&zoom===2&&activity==='sit'){const card=document.createElement('section');card.innerHTML='<h2>'+dir+'</h2>';card.append(c);board.append(card);snapshots.push(c.dataset.fixture);}
   checked++;
  }
  const typing=document.createElement('canvas');typing.width=440;typing.height=360;typing.dataset.fixture=body+'-'+dir+'-typing';fixture.draw(typing,{zoom:2,activity:'type',time:1.2});if(body==='tall'){board.append(typing);snapshots.push(typing.dataset.fixture);}
 }
 return {directions:4,bodies:3,zooms:2,frames:checked,snapshots};
};`,
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  tsconfig: "tsconfig.json",
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const page = await browser.newPage({ viewport: { width: 936, height: 900 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.UI_CHECK_URL ?? "http://localhost:3000/register");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => window.masterQA());
  expect(errors).toEqual([]);
  for (const name of result.snapshots)
    await page.locator('[data-fixture="' + name + '"]').screenshot({ path: output + "/" + name + ".png" });
  await page.locator("#master-qa").screenshot({ path: output + "/overview.png" });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
