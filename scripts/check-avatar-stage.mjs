import { chromium, expect } from "@playwright/test";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

// Isolated renderer fixtures: no user cookies, profile writes, or room membership changes.
const output = "D:/Github/meetopia/.data/avatar-ui";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import { Scene } from './src/client/scene';
      import { drawAvatar, avatarNameOffset, AVATAR_MAP_SCALE } from './src/client/art/avatar';
      import { paintedTopY, paintedHeadMetrics } from './src/client/art/avatar-painted';
      import { loadAvatarAssets, unifiedBodySprite } from './src/client/art/avatar-assets';
      import { DEFAULT_AVATAR, AVATAR_DIRECTIONS, BODY_SHAPES, HAIR_STYLES } from './src/shared/avatar';
      window.runAvatarStageQa = async () => {
        await loadAvatarAssets();
        await document.fonts.ready;
        const board = document.createElement('div');
        board.id = 'avatar-stage-qa';
        board.style.cssText = 'position:absolute;inset:0 auto auto 0;z-index:999999;display:grid;grid-template-columns:repeat(3,280px);gap:10px;background:#0b1c20;padding:16px;color:#edf4ef;text-align:center;font:13px sans-serif';
        const scene = Object.create(Scene.prototype);
        scene.emotes = new Map();
        const fxScene = Object.create(Scene.prototype);
        const fxCanvas = document.createElement('canvas');fxCanvas.width=100;fxCanvas.height=100;
        fxScene.map = {width:1,height:1};
        fxScene.layers = {floor:fxCanvas,labels:fxCanvas,sprites:[],lights:[],illustrated:false};
        fxScene.ripples=[];fxScene.puffs=[];
        fxScene.ripple(.5,.5,10);fxScene.puff(.5,.5,10);
        const fxFrame = {w:100,h:100,dpr:1,cam:{x:0,y:0,zoom:1},people:[],self:null,target:null,hoverTile:null,focusObj:null,links:[],privateZone:null,showRadius:false,speakers:[],reducedMotion:false};
        for (const time of [9,10.2,11]) fxScene.draw(fxCanvas.getContext('2d'),{...fxFrame,time});
        if(fxScene.ripples.length || fxScene.puffs.length) throw Error('Expired effects retained');
        const results = [];
        let connectedHeads = 0;
        let movingFrames = 0;
        let proportionChecks = 0;
        for(const hair of HAIR_STYLES) {
          const a={...DEFAULT_AVATAR,hair};
          const front=paintedHeadMetrics(a,'down');
          for(const dir of ['down-left','left','right','down-right']) {
            const head=paintedHeadMetrics(a,dir);
            if(!head || head.width>front.width+.01 || head.height>front.height+.01) throw Error('Inflated turning head: '+hair+' '+dir);
            proportionChecks++;
          }
        }
        for (const hair of HAIR_STYLES) for (const dir of AVATAR_DIRECTIONS) for(const activity of ['idle','walk','run']) for(let frame=0;frame<(activity==='idle'?1:8);frame++) {
          const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;
          const ctx=canvas.getContext('2d');
          const time=frame/8;
          drawAvatar(ctx,{...DEFAULT_AVATAR,body:'tall',hair},100,175,AVATAR_MAP_SCALE,{dir,activity,walk:0,time,staticPose:false});
          const pixels=ctx.getImageData(0,0,200,200).data;
          let started=false, gap=0;
          for (let y=0;y<161;y++) {
            let solid=false;
            for(let x=50;x<150;x++) if(pixels[(y*200+x)*4+3]>100) {solid=true;break;}
            if(solid) {started=true;gap=0;} else if(started && ++gap>=2) throw Error('Floating head: '+hair+' '+dir+' '+activity+' frame='+frame+' y='+y);
          }
          if(activity==='idle') connectedHeads++;else movingFrames++;
        }
        for (const body of BODY_SHAPES) for (const dir of AVATAR_DIRECTIONS) {
          const a = {...DEFAULT_AVATAR, body};
          if (avatarNameOffset(a,dir) < paintedTopY(a,dir)*AVATAR_MAP_SCALE+18) throw Error('Name overlaps hair: '+body+' '+dir);
        }
        for (const bottom of ['trousers', 'cargo']) for (const condition of ['normal','hungry','tired']) {
          const avatar = {...DEFAULT_AVATAR, body:'tall', hair:'spiky', hairColor:'#2c70ac', outfit:'jacket', bodyColor:'#297f7d', accessory:'glasses', bottom, shoes:'boots'};
          if (!unifiedBodySprite(avatar,'down','idle',0)) throw Error('Unsupported daily body: '+bottom);
          const canvas = document.createElement('canvas');
          canvas.width = 280; canvas.height = 300;
          const ctx = canvas.getContext('2d');
          const view = { x:70/32, y:(131-8)/32, phase:0, speaking:0, isSelf:true, seed:0, condition,
            p:{id:'fixture',name:'ihydkpati1144', avatar, dir:'down', status:'active', sitting:false, media:{mic:false,cam:false,screen:false}}};
          ctx.scale(2,2);
          scene.drawPerson(ctx,view,0);
          const pixels = ctx.getImageData(0,0,280,300).data;
          let top = 300;
          if (condition === 'normal') {
            for (let y=0;y<300;y++) {
              if (Array.from({length:100}, (_,x)=>pixels[(y*280+x+90)*4+3]).some(a=>a>150)) {top=y;break;}
            }
          }
          const ly=131-avatarNameOffset(avatar,'down');
          if (condition==='normal' && top-(ly+12)*2 < 6) throw Error('Rendered label intersects head');
          ctx.save(); ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#e5d4ae';ctx.fillRect(0,0,140,150);ctx.restore();
          scene.drawNamePill(ctx,view,ly);
          const cell=document.createElement('div');cell.append(canvas,document.createTextNode(bottom+' / boots / '+condition));board.append(cell);
          results.push({bottom,condition,labelClearsHead:true});
        }
        document.body.append(board);
        for (const dir of AVATAR_DIRECTIONS) {
          const cell=document.createElement('div'),canvas=document.createElement('canvas');canvas.width=280;canvas.height=300;
          const ctx=canvas.getContext('2d');ctx.fillStyle='#e5d4ae';ctx.fillRect(0,0,280,300);
          drawAvatar(ctx,{...DEFAULT_AVATAR,body:'tall',hair:'spiky',hairColor:'#2c70ac',outfit:'jacket',bodyColor:'#297f7d',shoes:'boots',bottom:'cargo',accessory:'glasses'},140,270,2.48,{dir,walk:0,time:0,staticPose:true});
          cell.append(canvas,document.createTextNode(dir));board.append(cell);
        }
        return {ok:true,fixtures:results.length,connectedHeads,movingFrames,proportionChecks,allBodyDirections:BODY_SHAPES.length*AVATAR_DIRECTIONS.length,futureEffectsSafe:true};
      };
    `,
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  tsconfig: "tsconfig.json",
});
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 750 } });
  await page.goto(process.env.UI_CHECK_URL ?? "http://localhost:3000/register");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => window.runAvatarStageQa());
  expect(result.ok).toBe(true);
  await page.locator("#avatar-stage-qa").screenshot({ path: output + "/stage-cargo-boots.png" });
  await page
    .locator("#avatar-stage-qa canvas")
    .first()
    .screenshot({ path: output + "/stage-single.png" });
  await page
    .locator("#avatar-stage-qa canvas")
    .nth(9)
    .screenshot({ path: output + "/stage-rear-left.png" });
  await page
    .locator("#avatar-stage-qa canvas")
    .nth(10)
    .screenshot({ path: output + "/stage-rear.png" });
  await page
    .locator("#avatar-stage-qa canvas")
    .nth(7)
    .screenshot({ path: output + "/stage-quarter-glasses.png" });
  await page
    .locator("#avatar-stage-qa canvas")
    .nth(8)
    .screenshot({ path: output + "/stage-profile-glasses.png" });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
