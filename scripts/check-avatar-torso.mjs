import { chromium, expect } from "@playwright/test";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
const output = "D:/Github/meetopia/.data/avatar-torso-v4";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import { loadAvatarAssets,avatarSprite,paintedAvatarReady } from './src/client/art/avatar-assets';
import { drawAvatar,AVATAR_MAP_SCALE } from './src/client/art/avatar';
import { DEFAULT_AVATAR,OUTFITS,AVATAR_DIRECTIONS,BODY_SHAPES } from './src/shared/avatar';
window.torsoQA=async()=>{
 await loadAvatarAssets();if(!paintedAvatarReady())throw Error('Missing avatar atlas');
 const board=document.createElement('main');board.id='torso-qa';board.style.cssText='display:grid;grid-template-columns:repeat(4,220px);gap:12px;background:#102326;padding:16px;color:white;font:14px sans-serif';document.body.replaceChildren(board);
 let renders=0,connections=0;const snapshots=[];
 for(const outfit of OUTFITS)for(const body of BODY_SHAPES)for(const dir of AVATAR_DIRECTIONS){
  const a={...DEFAULT_AVATAR,outfit,body,hair:'spiky',hairColor:'#257fc6',bodyColor:'#168f79',eyewear:'square'};
  const source=avatarSprite(a,dir,'cloth');if(source.collarX===undefined||source.collarY===undefined)throw Error('Missing directional collar '+outfit+' '+dir);
  for(const activity of ['sit','type','wave','present'])for(const time of [0,.25,.625]){
   const c=document.createElement('canvas');c.width=220;c.height=220;const ctx=c.getContext('2d');
   drawAvatar(ctx,a,110,195,3,{dir,activity,sitting:activity==='sit'||activity==='type',time,staticPose:false});
   const pixels=ctx.getImageData(0,0,220,220).data;
   // A connected central silhouette above the waist: catches an actually floating head, not
   // a cosmetic outline difference. Visual shoulder/material review is still required.
   let started=false,gap=0;const seated=activity==='sit'||activity==='type',hip=195-3*(3+(seated?4:body==='tall'?9:body==='small'?6:8));
   for(let y=0;y<hip-1;y++){
    let solid=false;for(let x=92;x<=128;x++)if(pixels[(y*220+x)*4+3]>100){solid=true;break;}
    if(solid){started=true;gap=0;}else if(started&&++gap>=3)throw Error('Floating head/torso '+outfit+' '+body+' '+dir+' '+activity+' time='+time+' y='+y);
   }
   if(!started)throw Error('Empty avatar');connections++;renders++;
   if(body==='tall'&&['up','right','down','left'].includes(dir)&&activity==='sit'&&time===0){
    c.dataset.fixture=outfit+'-'+dir;const cell=document.createElement('section');cell.innerHTML='<p>'+outfit+' · '+dir+'</p>';cell.append(c);board.append(cell);snapshots.push(c.dataset.fixture);
    ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#183332';ctx.fillRect(0,0,220,220);ctx.restore();
   }
  }
 }
 return {outfits:8,bodies:3,directions:8,actions:4,times:3,renders,connections,snapshots};
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
  const page = await browser.newPage({ viewport: { width: 960, height: 900 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.UI_CHECK_URL ?? "http://localhost:3000/register");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => window.torsoQA());
  expect(errors).toEqual([]);
  await page.locator("#torso-qa").screenshot({ path: output + "/overview.png" });
  for (const dir of ["right", "left", "up", "down"])
    await page
      .locator('[data-fixture="jacket-' + dir + '"]')
      .screenshot({ path: output + "/jacket-" + dir + ".png" });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
