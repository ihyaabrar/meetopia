import { chromium, expect } from "@playwright/test";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
const output = "D:/Github/meetopia/.data/layered-world";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import { Scene } from './src/client/scene';
import { renderIllustratedPreview } from './src/client/art/world';
import { loadEnvironmentAssets } from './src/client/art/environment-assets';
import { loadAvatarAssets } from './src/client/art/avatar-assets';
import { buildTemplate,TEMPLATE_IDS } from './src/shared/templates';
import { DEFAULT_AVATAR } from './src/shared/avatar';
import { DEFAULT_AUDIO,TILE } from './src/shared/map';
import { seatPose } from './src/shared/seats';
import { workstationFixture } from './src/shared/workstation-fixtures';
window.layeredQA=async()=>{
 await Promise.all([loadAvatarAssets(),loadEnvironmentAssets(),document.fonts.ready]);
 const board=document.createElement('div');board.id='layered-qa';board.style.cssText='background:#0b1c20;color:#fff;padding:20px;display:grid;grid-template-columns:repeat(2,500px);gap:20px;font:16px sans-serif';document.body.replaceChildren(board);
 let objects=0;
 for(const id of TEMPLATE_IDS){ const map=buildTemplate(id);const scene=new Scene(map,k=>k.split('.').at(-1));await scene.layers.ready;
  if(!scene.layers.illustrated)throw Error('Missing atlases');
  if(scene.layers.sprites.length!==map.objects.filter(o=>o.kind!=='rug').length)throw Error('Furniture baked into floor');
  objects+=scene.layers.sprites.length;
  const preview=await renderIllustratedPreview(map,k=>k.split('.').at(-1));const c=preview.canvas;c.dataset.fixture=id;c.style.width='500px';board.append(c);
 }
 for(const dir of ['up','down','left','right']){
  const map=workstationFixture(dir),chair=map.objects[1];
  const seat=seatPose(map,chair),p={id:'qa',conn:'qa',name:'Raka · '+dir,avatar:{...DEFAULT_AVATAR,body:'tall',outfit:'jacket',bodyColor:'#168f79',hair:'spiky',hairColor:'#257fc6',eyewear:'square'},role:'owner',...seat,sitting:true,moving:false,status:'active',manualStatus:false,statusText:null,media:{mic:false,cam:false,screen:false},allowedZone:null,allowedPeers:[],lastActive:0};
  const v={p,x:seat.x,y:seat.y,phase:0,speaking:0,isSelf:true,seed:1};const scene=new Scene(map,k=>k);await scene.layers.ready;
  const c=document.createElement('canvas');c.width=500;c.height=400;c.dataset.fixture='sit-'+dir;scene.draw(c.getContext('2d'),{w:500,h:400,dpr:1,cam:{x:80,y:80,zoom:1.5},time:1,people:[v],self:v,target:null,hoverTile:null,focusObj:null,links:[],privateZone:null,showRadius:false,speakers:[],reducedMotion:true});board.append(c);
 }
 return {worlds:5,independentFurniture:objects,seatedDirections:4,renderer:'layered'};
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
  const page = await browser.newPage({ viewport: { width: 1060, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.UI_CHECK_URL ?? "http://localhost:3000/register");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => window.layeredQA());
  expect(errors).toEqual([]);
  for (const name of [
    "office",
    "home",
    "gaming",
    "studio",
    "rooftop",
    "sit-up",
    "sit-down",
    "sit-left",
    "sit-right",
  ])
    await page.locator('[data-fixture="' + name + '"]').screenshot({ path: output + "/" + name + ".png" });
  await page.locator("#layered-qa").screenshot({ path: output + "/overview.png" });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
