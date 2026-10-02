// Pixel renderer. Internal resolution is the NES playfield, 256×240.

import { dayKey, nextCardIn, rankFor } from "./blitz.js";

const SKY = {
  1: ["#5c94fc", "#8cbcfc"],
  2: ["#fc9848", "#f8c878"],
  3: ["#14143c", "#2c2c70"],
  4: ["#14080c", "#3c1418"],
  5: ["#2c7868", "#b7d7a4"],
  6: ["#241838", "#4a4068"],
  7: ["#f0c878", "#a86830"],
  8: ["#100818", "#342868"],
  9: ["#1c4038", "#e0b060"],
};

const HERO = [
  ".....RRRRRR.....",
  "....RRRRRRRRR...",
  "....HHHSSSSS....",
  "...HHSHSSSSSS...",
  "...HHSHSSBSBS...",
  "....SSSSSSSS....",
  "......BBBBBB....",
  "....BBBBBBBBBB..",
  "...BBBBBBBBBBB..",
  "...BBBBYYBBBBB..",
  "...BBBBBBBBBB...",
  ".....DDDDDD.....",
  "....DDDDDDDD....",
  "....DDD..DDD....",
  "...DDDD..DDDD...",
  "................",
];

const HERO_STEP = [
  ".....RRRRRR.....",
  "....RRRRRRRRR...",
  "....HHHSSSSS....",
  "...HHSHSSSSSS...",
  "...HHSHSSBSBS...",
  "....SSSSSSSS....",
  "......BBBBBB....",
  "....BBBBBBBBBB..",
  "...BBBBBBBBBBB..",
  "...BBBBYYBBBBB..",
  "...BBBBBBBBBB...",
  "......DDDD......",
  ".....DDDDDD.....",
  ".....DD..DD.....",
  "....DDD..DDD....",
  "................",
];

const HERO_JUMP = [
  ".....RRRRRR.....",
  "....RRRRRRRRR...",
  "....HHHSSSSS....",
  "...HHSHSSSSSS...",
  "...HHSHSSBSBS...",
  "....SSSSSSSS....",
  "...BBBBBBBBBB...",
  "..BBBBBBBBBBBB..",
  "..BBBBYYBBBBBB..",
  "...BBBBBBBBB....",
  "....DD....DD....",
  "...DDD....DDD...",
  "................",
  "................",
  "................",
  "................",
];

const BUG = [
  "................",
  "................",
  "....KKKKKKKK....",
  "...KYYYYYYYYK...",
  "..KYKYKYKYKYK...",
  "..KYYYYYYYYYYK..",
  "..KYYKKYYKKYYK..",
  "..KYYYYYYYYYYK..",
  "...KYYYYYYYYK...",
  "....KKKKKKKK....",
  ".....KK..KK.....",
  "....KKK..KKK....",
  "................",
  "................",
  "................",
  "................",
];

const INK = {
  R: "#e83820",
  H: "#6b3010",
  S: "#fcb890",
  B: "#3050f0",
  Y: "#f8d030",
  D: "#6b3814",
  K: "#201408",
  ".": null,
};

function blit(ctx, art, x, y, tall) {
  for (let j = 0; j < art.length; j++) {
    for (let i = 0; i < art[j].length; i++) {
      const color = INK[art[j][i]];
      if (!color) continue;
      ctx.fillStyle = color;
      if (tall) ctx.fillRect(x + i, y + j * 2, 1, 2);
      else ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

function worldOf(view) {
  return view.level?.world || 1;
}

export function draw(ctx, view, now) {
  ctx.imageSmoothingEnabled = false;
  if (view.screen === "boot") return drawBoot(ctx, now, view);
  if (view.screen === "title" || view.screen === "letter") return drawTitle(ctx, view, now);
  if (view.screen === "map") return drawMap(ctx, view, now);
  if (view.screen === "ending") return drawEnding(ctx, view, now);
  if (view.screen === "fuse") return drawFuseLobby(ctx, view, now);
  if (view.screen === "fuseout") return drawFuseOut(ctx, view, now);
  drawPlay(ctx, view, now);
  if (view.fuseRun) drawFuseHud(ctx, view, now);
}

function drawBoot(ctx, now, view) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 240);
  const t = now - view.bootAt;
  ctx.fillStyle = t > 400 ? "#fcfcfc" : "#404040";
  center(ctx, "NORMAL MODE", 96);
  center(ctx, "COUNCIL", 116);
  if (t > 900) {
    ctx.fillStyle = "#f8d030";
    center(ctx, "PRESENTS", 150);
  }
}

function drawTitle(ctx, view, now) {
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, "#5c94fc");
  sky.addColorStop(1, "#8cbcfc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 240);
  drawHills(ctx, 0, "#00a800", "#005800", now);
  for (let i = 0; i < 3; i++) drawCloud(ctx, 20 + i * 90 + ((now / 80) % 40), 28 + i * 14);
  ctx.fillStyle = "#e83820";
  ctx.fillRect(0, 0, 256, 6);
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(0, 6, 256, 3);
  const bob = Math.sin(now / 280) * 3;
  banner(ctx, "VIMARIO", 64 + bob, 20, "#101010");
  banner(ctx, "VIMARIO", 62 + bob, 20, "#fcfcfc");
  banner(ctx, "NORMAL MODE", 92, 8, "#101010");
  blit(ctx, HERO, 120, 108 + Math.abs(Math.sin(now / 180)) * -8, false);
  ctx.fillStyle = "#101418";
  ctx.fillRect(0, 162, 256, 78);
  const items = view.menuItems;
  const y0 = items.length > 4 ? 166 : items.length > 3 ? 172 : 184;
  items.forEach((item, i) => {
    banner(ctx, (i === view.menu ? "> " : "  ") + item, y0 + i * 14, 8, i === view.menu ? "#f8d030" : "#fcfcfc");
  });
  if (items.length < 3 && Math.floor(now / 400) % 2 === 0) banner(ctx, "J K     ENTER", 230, 8, "#9ece6a");
}

export const WORLD_NODES = [
  { world: 1, name: "PLAINS", x: 40, y: 172 },
  { world: 2, name: "WORDS", x: 104, y: 172 },
  { world: 3, name: "LINES", x: 168, y: 164 },
  { world: 4, name: "CASTLE", x: 216, y: 124 },
  { world: 5, name: "MARSH", x: 216, y: 76 },
  { world: 6, name: "EDIT", x: 152, y: 44 },
  { world: 7, name: "BOOKS", x: 84, y: 44 },
  { world: 8, name: "HALL", x: 36, y: 96 },
  { world: 9, name: "CHORD", x: 112, y: 132 },
];

function worldTitle(view, world) {
  const level = view.levels.find((item) => item.world === world);
  return (level?.worldName || "WORLD " + world).toUpperCase();
}

function worldStars(view, world) {
  const rows = view.levels.filter((item) => item.world === world);
  const got = rows.reduce((sum, item) => sum + (view.save.stars[item.id] || 0), 0);
  return { got, max: rows.length * 3 };
}

function drawMap(ctx, view, now) {
  if (view.mapDepth === "course") {
    drawCourseList(ctx, view, now);
    return;
  }
  const world = view.mapWorld || 1;
  const [c0, c1] = SKY[world] || SKY[1];
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, c0);
  sky.addColorStop(1, c1);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 240);
  drawWorldPick(ctx, view, now);
}

function worldOpen(view, world) {
  const first = view.levels.findIndex((level) => level.world === world);
  return first >= 0 && first < view.save.unlocked;
}

export function roadDots(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const pad = 24;
  const dots = [];
  for (let d = pad; d <= len - pad + 0.01; d += 7) {
    dots.push({ x: a.x + (dx * d) / len, y: a.y + (dy * d) / len });
  }
  return dots;
}

function drawRoad(ctx, a, b, open) {
  for (const dot of roadDots(a, b)) {
    const x = Math.round(dot.x);
    const y = Math.round(dot.y);
    ctx.fillStyle = open ? "#5a3014" : "#2c2a28";
    ctx.fillRect(x - 2, y, 5, 3);
    ctx.fillStyle = open ? "#f0d0a0" : "#6a6864";
    ctx.fillRect(x - 1, y, 3, 2);
  }
}

function drawLandmark(ctx, world, x, y, open, here) {
  ctx.fillStyle = here ? "#f8d030" : open ? "#e8d8b0" : "#3a3834";
  ctx.fillRect(x - 16, y - 18, 32, 36);
  ctx.fillStyle = "#14120e";
  ctx.fillRect(x - 14, y - 16, 28, 32);
  const c = (color) => (open ? color : "#8a8a8a");
  const ox = x - 12;
  const oy = y - 14;
  if (world === 1) {
    ctx.fillStyle = c("#3cb043");
    ctx.fillRect(ox, oy + 14, 24, 8);
    ctx.fillStyle = c("#e83820");
    ctx.fillRect(ox + 8, oy + 4, 10, 8);
    ctx.fillStyle = c("#fcfcfc");
    ctx.fillRect(ox + 10, oy + 6, 3, 3);
  } else if (world === 2) {
    ctx.fillStyle = c("#c06020");
    ctx.fillRect(ox, oy + 12, 24, 10);
    ctx.fillStyle = c("#f0d060");
    ctx.fillRect(ox + 2, oy + 6, 12, 6);
    ctx.fillRect(ox + 12, oy + 10, 10, 4);
  } else if (world === 3) {
    ctx.fillStyle = c("#2a2a40");
    ctx.fillRect(ox + 2, oy + 4, 20, 18);
    ctx.fillStyle = c("#8cbcfc");
    ctx.fillRect(ox + 8, oy + 10, 8, 12);
  } else if (world === 4) {
    ctx.fillStyle = c("#686070");
    ctx.fillRect(ox + 6, oy + 6, 12, 16);
    ctx.fillRect(ox + 4, oy + 4, 16, 4);
    ctx.fillStyle = c("#e83820");
    ctx.fillRect(ox + 16, oy + 2, 6, 4);
    ctx.fillStyle = c("#f8f8f8");
    ctx.fillRect(ox + 16, oy + 2, 1, 8);
  } else if (world === 5) {
    ctx.fillStyle = c("#1a6848");
    ctx.fillRect(ox, oy + 14, 24, 8);
    ctx.fillStyle = c("#8cbc78");
    ctx.fillRect(ox + 4, oy + 6, 2, 12);
    ctx.fillRect(ox + 14, oy + 4, 2, 14);
  } else if (world === 6) {
    ctx.fillStyle = c("#18b018");
    ctx.fillRect(ox + 4, oy + 8, 10, 14);
    ctx.fillRect(ox + 2, oy + 6, 14, 4);
    ctx.fillStyle = c("#d8fc98");
    ctx.fillRect(ox + 4, oy + 8, 3, 12);
  } else if (world === 7) {
    ctx.fillStyle = c("#8a5a28");
    ctx.fillRect(ox + 2, oy + 4, 20, 4);
    ctx.fillRect(ox + 2, oy + 14, 20, 4);
    ctx.fillStyle = c("#c4a060");
    ctx.fillRect(ox + 4, oy + 8, 4, 6);
    ctx.fillRect(ox + 10, oy + 8, 4, 6);
    ctx.fillRect(ox + 16, oy + 8, 4, 6);
    ctx.fillStyle = c("#ffe8a0");
    ctx.fillRect(ox + 18, oy, 4, 4);
  } else if (world === 8) {
    ctx.fillStyle = c("#6868a0");
    ctx.fillRect(ox + 2, oy + 4, 5, 16);
    ctx.fillRect(ox + 17, oy + 4, 5, 16);
    ctx.fillStyle = c("#e83820");
    ctx.fillRect(ox + 7, oy + 8, 10, 8);
  } else {
    ctx.fillStyle = c("#c8b090");
    ctx.fillRect(ox + 4, oy + 4, 16, 4);
    ctx.fillRect(ox + 4, oy + 4, 4, 16);
    ctx.fillRect(ox + 16, oy + 4, 4, 16);
    ctx.fillStyle = c("#18c818");
    ctx.fillRect(ox + 10, oy + 10, 5, 4);
  }
  ctx.fillStyle = "#101010";
  ctx.fillRect(x - 5, y + 6, 10, 9);
  ctx.fillStyle = open ? "#f8d030" : "#d8d8d8";
  label(ctx, String(world), x - 4, y + 14);
}

function drawWorldPick(ctx, view, now) {
  for (let i = 0; i < WORLD_NODES.length - 1; i++) {
    drawRoad(ctx, WORLD_NODES[i], WORLD_NODES[i + 1], worldOpen(view, WORLD_NODES[i + 1].world));
  }
  const here = view.mapWorld || 1;
  WORLD_NODES.forEach((node) => {
    const open = worldOpen(view, node.world);
    const selected = node.world === here;
    drawLandmark(ctx, node.world, node.x, node.y, open, selected);
    if (!selected) return;
    const hx = node.x > 200 ? node.x - 34 : node.x < 70 ? node.x + 18 : node.x - 34;
    blit(ctx, Math.floor(now / 180) % 2 ? HERO_STEP : HERO, hx, Math.max(18, node.y - 4), false);
  });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 16);
  ctx.fillRect(0, 208, 256, 32);
  ctx.fillStyle = "#fcfcfc";
  label(ctx, "WORLD MAP", 8, 12);
  pixText(ctx, String(view.save.starsTotal || 0), 220, 3, "#f8d030");
  const node = WORLD_NODES.find((item) => item.world === here);
  const stars = worldStars(view, here);
  label(ctx, (node ? node.world + " " : "") + worldTitle(view, here), 8, 222);
  label(ctx, "STARS " + stars.got + "/" + stars.max, 8, 234);
  label(ctx, "H L  ENTER", 156, 234);
}

function drawCourseList(ctx, view, now) {
  const world = view.mapWorld || 1;
  const [c0, c1] = SKY[world] || SKY[1];
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, c0);
  sky.addColorStop(1, c1);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 240);
  drawLandmark(ctx, world, 214, 46, true, true);
  ctx.fillStyle = "#1a140c";
  ctx.fillRect(16, 70, 224, 128);
  ctx.fillStyle = "#e8d8b0";
  ctx.fillRect(20, 74, 216, 120);
  const rows = view.levels.map((level, index) => ({ level, index })).filter((row) => row.level.world === world);
  const step = 26;
  const y0 = 96 + Math.floor((96 - rows.length * step) / 2);
  rows.forEach((row, i) => {
    const open = row.index < view.save.unlocked;
    const here = row.index === view.mapIndex;
    const y = y0 + i * step;
    if (here) {
      ctx.fillStyle = "#f8d030";
      ctx.fillRect(28, y - 12, 200, 16);
    }
    ctx.fillStyle = here ? "#101010" : open ? "#201810" : "#8a8070";
    label(ctx, row.level.id + " " + row.level.name.toUpperCase(), 32, y);
    if (!open) return;
    const stars = view.save.stars[row.level.id] || 0;
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = s < stars ? "#c08010" : here ? "#a09060" : "#c8b898";
      ctx.fillRect(196 + s * 10, y - 8, 7, 7);
    }
  });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 16);
  ctx.fillRect(0, 208, 256, 32);
  ctx.fillStyle = "#fcfcfc";
  label(ctx, worldTitle(view, world), 8, 12);
  const stars = worldStars(view, world);
  pixText(ctx, String(stars.got).padStart(2, "0"), 220, 3, "#f8d030");
  label(ctx, "J K  ENTER", 8, 222);
  label(ctx, "ESC WORLDS", 8, 234);
}

function drawEnding(ctx, view, now) {
  ctx.fillStyle = "#101418";
  ctx.fillRect(0, 0, 256, 240);
  ctx.fillStyle = "#9ece6a";
  label(ctx, "princess.txt", 8, 16);
  label(ctx, "----------------", 8, 28);
  const lines = [
    "Princess Normal is free.",
    "",
    "King Insert was deleted",
    "one motion at a time.",
    "",
    "stars  " + (view.save.starsTotal || 0) + " / " + (view.levels.length * 3),
    "best   " + (view.save.bestTotal || 0) + " keys",
    "",
    view.wrote ? '"princess.txt" written' : "type  :wq",
  ];
  ctx.fillStyle = "#d0d8cc";
  lines.forEach((line, i) => label(ctx, line, 8, 48 + i * 14));
  if (!view.wrote && Math.floor(now / 400) % 2 === 0) {
    ctx.fillStyle = "#9ece6a";
    label(ctx, ":wq", 8, 210);
  }
  drawPrincess(ctx, 200, 150);
}

function drawPlay(ctx, view, now) {
  const state = view.state;
  const level = view.level;
  if (!state || !level) return;
  const world = worldOf(view);
  if (state.kind === "maze") drawMaze(ctx, view, now, world);
  else drawCourse(ctx, view, now, world);
  drawHud(ctx, view);
  drawParticles(ctx, view, now);
  if (view.insertFlash > now) {
    ctx.fillStyle = "rgba(232,56,32,0.35)";
    ctx.fillRect(0, 16, 256, 224);
    ctx.fillStyle = "#fcfcfc";
    center(ctx, "INSERT IS SEALED", 120);
  }
  if (view.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 16, 256, 224);
    ctx.fillStyle = "#fcfcfc";
    center(ctx, "PAUSED", 100);
    center(ctx, "ENTER RESUME", 124);
    center(ctx, view.fuseRun ? ":Q TITLE   :RETRY" : ":Q  MAP    :RETRY", 144);
  }
  if (view.deadUntil > now) {
    ctx.fillStyle = "#fcfcfc";
    center(ctx, "BUFFER RELOADED", 120);
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function actionTop(state, boss) {
  let top = state.py || 0;
  if (state.tiles) {
    for (let y = 0; y < state.h; y++) {
      const row = state.tiles[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        const tile = row[x]?.t;
        if (tile && tile !== "empty") top = Math.min(top, y);
      }
    }
  }
  if (boss) top = Math.min(top, boss.y);
  return top;
}

export function courseFrame(state, pos, top) {
  const scale = state.kind === "boss" ? 1 : 1.25;
  const cell = 16 * scale;
  const visX = 256 / cell;
  const lead = scale === 1 ? 7 : 4;
  const camY = Math.max(0, top - (state.kind === "boss" ? 1 : 2));
  const bandPx = (state.h - camY) * cell;
  const oy = 16 + Math.max(6, Math.floor((224 - Math.min(bandPx, 210)) / 3));
  const camX = clamp(pos.x - lead, 0, Math.max(0, state.w - visX));
  return { scale, camX, camY, ox: 0, oy };
}

export function mazeFrame(state, pos) {
  const hud = 16;
  const maxW = 248;
  const maxH = 224;
  let scale = 1;
  if (state.w * 48 <= maxW && state.h * 48 <= maxH) scale = 3;
  else if (state.w * 32 <= maxW && state.h * 32 <= maxH) scale = 2;
  else if (state.h * 32 <= maxH && Math.floor(maxW / 32) >= 7) scale = 2;
  const cell = 16 * scale;
  const visX = Math.min(state.w, maxW / cell);
  const gridW = Math.min(state.w * cell, maxW);
  const gridH = state.h * cell;
  const ox = Math.max(4, Math.floor((256 - gridW) / 2));
  const oy = hud + Math.max(0, Math.floor((maxH - gridH) / 2));
  const fits = state.w * cell <= maxW + 0.5;
  const camX = fits ? 0 : clamp(Math.round(pos.x - visX * 0.32), 0, Math.max(0, state.w - visX));
  return { scale, camX, camY: 0, ox, oy };
}

function applyFrame(ctx, frame) {
  ctx.translate(frame.ox, frame.oy);
  ctx.scale(frame.scale, frame.scale);
  ctx.translate(-frame.camX * 16, -frame.camY * 16);
}

function dirtTone(world) {
  if (world === 3) return "#141428";
  if (world === 4) return "#2a1014";
  if (world === 5) return "#184828";
  if (world === 6) return "#241830";
  if (world === 7) return "#6a3818";
  if (world === 8) return "#101428";
  if (world === 9) return "#143028";
  return "#7c3010";
}

const FLOOR = {
  1: "#3a342c",
  2: "#4a3018",
  3: "#241c38",
  4: "#3a3038",
  5: "#1c3430",
  6: "#2a2438",
  7: "#4a3418",
  8: "#1a2040",
  9: "#24382c",
};

function drawCourse(ctx, view, now, world) {
  const state = view.state;
  const boss = view.level?.phases?.[state.phaseIndex]?.boss;
  const frame = courseFrame(state, heroPos(view), actionTop(state, boss));
  view.frame = frame;
  view.cam = frame.camX;
  const [c0, c1] = SKY[world] || SKY[1];
  const sky = ctx.createLinearGradient(0, 0, 0, 240);
  sky.addColorStop(0, c0);
  sky.addColorStop(1, c1);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 240);
  if (world === 3 || world === 8) drawStars(ctx, now);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 256, frame.oy);
  ctx.clip();
  drawScenery(ctx, world, now, frame.camX, frame.oy);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 16, 256, 224);
  ctx.clip();
  applyFrame(ctx, frame);
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      const sx = x * 16;
      const sy = y * 16;
      drawTile(ctx, state, x, y, sx, sy, world, now);
    }
  }
  for (const coin of state.coinsArr) {
    if (coin.got) continue;
    const sx = coin.x * 16;
    const sy = coin.y * 16;
    if (state.letterAt?.[coin.x + "," + coin.y]) drawCoinNub(ctx, sx, sy - 4);
    else drawCoin(ctx, sx, sy, now);
  }
  if (state.mush) drawMushroom(ctx, state.mush.x * 16, state.mush.y * 16, now);
  for (const bug of state.bugs) drawBug(ctx, bug.x * 16, bug.y * 16, now);
  if (state.kind === "boss") drawKing(ctx, state, 0, now, view);
  drawTrail(ctx, view, now);
  const pos = heroPos(view);
  blitHero(ctx, view, pos.x * 16, pos.y * 16, now);
  ctx.restore();
  const ground = frame.oy + (state.h - frame.camY) * 16 * frame.scale;
  if (ground < 240) {
    ctx.fillStyle = dirtTone(world);
    ctx.fillRect(0, ground, 256, 240 - ground);
  }
}

function drawMaze(ctx, view, now, world) {
  const state = view.state;
  const pos = heroPos(view);
  const frame = mazeFrame(state, pos);
  view.frame = frame;
  view.cam = frame.camX;
  view.mazeOrigin = { x: frame.ox, y: frame.oy };
  const [c0] = SKY[world] || SKY[1];
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, 256, 240);
  drawScenery(ctx, world, now, frame.camX, 72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 16, 256, 224);
  ctx.clip();
  applyFrame(ctx, frame);
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) drawMazeCell(ctx, state, x, y, world, now);
  }
  for (const coin of state.coinsArr) {
    if (coin.got) continue;
    const ch = state.lines[coin.y]?.[coin.x];
    if (ch && ch !== " " && ch !== "#") drawCoinNub(ctx, coin.x * 16, coin.y * 16);
    else drawCoin(ctx, coin.x * 16, coin.y * 16, now);
  }
  drawOpenFx(ctx, view, now);
  drawTrail(ctx, view, now);
  blitHero(ctx, view, pos.x * 16, pos.y * 16, now);
  ctx.restore();
}

function drawMazeCell(ctx, state, x, y, world, now) {
  const sx = x * 16;
  const sy = y * 16;
  const id = x + "," + y;
  const ch = state.lines[y][x];
  if (state.pits[id]) {
    ctx.fillStyle = FLOOR[world] || "#3a342c";
    ctx.fillRect(sx, sy, 16, 16);
    ctx.fillStyle = "#07060a";
    ctx.fillRect(sx + 3, sy + 5, 10, 7);
    ctx.fillStyle = "#6b2018";
    ctx.fillRect(sx + 3, sy + 5, 10, 2);
    return;
  }
  if (ch === "#" || state.walls[id]) {
    const wall = world === 7 ? "wood" : world === 4 || world === 8 ? "stone" : false;
    drawBrick(ctx, sx, sy, wall);
    return;
  }
  ctx.fillStyle = FLOOR[world] || "#3a342c";
  ctx.fillRect(sx, sy, 16, 16);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(sx, sy, 16, 2);
  if (state.spikes[id]) drawHazard(ctx, sx, sy);
  if (state.exits[id]) {
    drawDoor(ctx, sx, sy, now);
    return;
  }
  if (ch === "+") {
    drawLock(ctx, sx, sy);
    return;
  }
  if (ch && ch !== " ") {
    ctx.fillStyle = state.spikes[id] ? "#ffe0d0" : "#f8e0a0";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText(ch, sx + 4, sy + 11);
  }
}

function drawHazard(ctx, x, y) {
  ctx.fillStyle = "#e03020";
  ctx.fillRect(x + 2, y + 13, 3, 3);
  ctx.fillRect(x + 7, y + 12, 3, 4);
  ctx.fillRect(x + 12, y + 13, 2, 3);
}

function drawLock(ctx, x, y) {
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(x + 5, y + 1, 6, 3);
  ctx.fillStyle = "#1a1408";
  ctx.fillRect(x + 6, y + 2, 4, 2);
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(x + 3, y + 4, 10, 9);
  ctx.fillStyle = "#1a1408";
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText("+", x + 4, y + 12);
}

function drawTrail(ctx, view, now) {
  const anim = view.anim;
  if (!anim || (anim.kind !== "jump" && anim.kind !== "dash")) return;
  const pts = anim.points || [];
  if (pts.length < 2) return;
  const t = Math.max(0, Math.min(1, (now - anim.t0) / (anim.dur || 1)));
  for (let i = 0; i < 4; i++) {
    const u = (i / 4) * t;
    const f = u * (pts.length - 1);
    const idx = Math.min(pts.length - 2, Math.floor(f));
    const local = f - idx;
    const a = pts[idx];
    const b = pts[idx + 1];
    if (!a || !b) continue;
    ctx.globalAlpha = (i / 4) * 0.4 * (1 - t);
    ctx.fillStyle = "#f8e0a0";
    ctx.fillRect((a.x + (b.x - a.x) * local) * 16 + 6, (a.y + (b.y - a.y) * local) * 16 + 11, 4, 3);
  }
  ctx.globalAlpha = 1;
}

function drawOpenFx(ctx, view, now) {
  const fx = view.openFx;
  if (!fx || now >= fx.until) return;
  const u = 1 - (fx.until - now) / 420;
  ctx.globalAlpha = Math.max(0, u < 0.45 ? u / 0.45 : (1 - u) / 0.55);
  for (const cell of fx.cells || []) {
    ctx.strokeStyle = cell.kind === "close" ? "#e83820" : "#f8d030";
    ctx.strokeRect(cell.x * 16 + 1.5, cell.y * 16 + 1.5, 13, 13);
  }
  ctx.globalAlpha = 1;
}

function drawScenery(ctx, world, now, shift, horizon) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  const slide = shift * 4;
  if (world === 4) drawArches(ctx, slide);
  else if (world === 6) drawFoundry(ctx, slide);
  else if (world === 7) drawLibrary(ctx, now);
  else if (world === 3) drawStalactites(ctx);
  else if (world === 5) drawReeds(ctx, slide, horizon);
  else if (world === 8) drawColumns(ctx);
  else if (world === 9) drawRopes(ctx, slide);
  else if (world === 2) drawMesas(ctx, slide, horizon);
  else {
    drawBushes(ctx, slide, horizon);
    if (world < 3) {
      drawCloud(ctx, 30 - (slide % 260), 18);
      drawCloud(ctx, 150 - (slide % 260), 28);
    }
  }
  ctx.restore();
}

function drawArches(ctx, shift) {
  ctx.fillStyle = "#4a3034";
  for (let i = 0; i < 4; i++) {
    const x = ((i * 72 - shift) % 340) - 24;
    ctx.fillRect(x, 6, 8, 26);
    ctx.fillRect(x + 26, 6, 8, 26);
    ctx.fillRect(x, 6, 34, 6);
  }
}

function drawFoundry(ctx, shift) {
  ctx.fillStyle = "#3c3458";
  for (let i = 0; i < 3; i++) {
    const x = 12 + i * 86 - (shift % 36);
    ctx.fillRect(x, 20, 34, 7);
    ctx.fillRect(x + 10, 8, 8, 24);
    ctx.fillRect(x + 24, 12, 7, 7);
    ctx.fillRect(x - 8, 22, 10, 4);
  }
}

function drawLibrary(ctx, now) {
  ctx.fillStyle = "#8a5a28";
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 84;
    ctx.fillRect(x, 8, 64, 4);
    ctx.fillRect(x, 20, 64, 4);
    ctx.fillRect(x, 32, 64, 3);
    ctx.fillStyle = "#c4a060";
    for (let book = 0; book < 5; book++) ctx.fillRect(x + 4 + book * 12, 12, 8, 8);
    ctx.fillStyle = "#8a5a28";
  }
  ctx.globalAlpha = 0.35 + Math.sin(now / 420) * 0.08;
  ctx.fillStyle = "#ffe8a0";
  ctx.fillRect(214, 6, 6, 8);
  ctx.fillRect(212, 14, 10, 3);
}

function drawStalactites(ctx) {
  ctx.fillStyle = "#323268";
  for (let i = 0; i < 8; i++) {
    const x = 6 + i * 32;
    ctx.fillRect(x, 0, 6, 8 + (i % 3) * 5);
  }
}

function drawReeds(ctx, shift, horizon) {
  ctx.fillStyle = "#1c5840";
  const y = Math.min(Math.max(horizon - 10, 8), 60);
  for (let i = 0; i < 10; i++) {
    const x = ((i * 28 - shift) % 300) - 6;
    ctx.fillRect(x, y, 2, 16);
  }
}

function drawColumns(ctx) {
  ctx.fillStyle = "#322e60";
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 64;
    ctx.fillRect(x, 2, 12, 36);
    ctx.fillRect(x - 3, 2, 18, 4);
  }
}

function drawRopes(ctx, shift) {
  ctx.fillStyle = "#3a6858";
  for (let i = 0; i < 6; i++) {
    const x = 18 + i * 40 + (shift % 10);
    ctx.fillRect(x, 0, 2, 16 + (i % 2) * 8);
  }
}

function drawMesas(ctx, shift, horizon) {
  ctx.fillStyle = "#a05020";
  const y = Math.max(8, Math.min(horizon - 20, 48));
  for (let i = 0; i < 4; i++) {
    const x = ((i * 84 - shift) % 360) - 30;
    ctx.fillRect(x, y, 48, 12);
    ctx.fillRect(x + 8, y - 6, 28, 6);
  }
}

function drawBushes(ctx, shift, horizon) {
  ctx.fillStyle = "#1c7c28";
  const y = Math.max(12, Math.min(horizon - 12, 52));
  for (let i = 0; i < 5; i++) {
    const x = ((i * 62 - shift) % 340) - 12;
    ctx.fillRect(x, y, 16, 7);
    ctx.fillRect(x + 3, y - 4, 10, 5);
  }
}

function drawTile(ctx, state, x, y, sx, sy, world, now) {
  const tile = state.tiles[y][x];
  const above = y > 0 ? state.tiles[y - 1][x] : { t: "empty" };
  if (tile.t === "solid") drawGround(ctx, sx, sy, above.t === "empty" || above.t === "flag" || above.t === "sign" || above.t === "letter" || above.t === "blank", world);
  else if (tile.t === "brick") drawBrick(ctx, sx, sy, world === 4);
  else if (tile.t === "question") drawQuestion(ctx, sx, sy, !!state.usedQ[x + "," + y], now);
  else if (tile.t === "platform") drawPlatform(ctx, sx, sy, world);
  else if (tile.t === "spike") drawSpikes(ctx, sx, sy);
  else if (tile.t === "pipe") drawPipe(ctx, sx, sy, tile.side, above.t !== "pipe");
  else if (tile.t === "flag") drawFlag(ctx, sx, sy, above.t !== "flag", now);
  else if (tile.t === "sign") drawSign(ctx, sx, sy);
  else if (tile.t === "letter") {
    ctx.fillStyle = "#a07818";
    ctx.fillRect(sx + 1, sy + 6, 14, 9);
    ctx.fillStyle = "#f8d030";
    ctx.fillRect(sx + 2, sy + 2, 12, 8);
    ctx.fillStyle = "#101010";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText(tile.ch, sx + 4, sy + 9);
  } else if (tile.t === "hurt") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(sx, sy, 16, 16);
  }
}

function drawGround(ctx, x, y, lip, world) {
  const tone = world === 5 ? ["#3c8c48", "#68b060", "#b8e090", "#184828"] : world === 7 ? ["#a87838", "#e0b060", "#f8e0a0", "#6a3818"] : world === 8 ? ["#2a3058", "#4a5890", "#b0b8e0", "#101428"] : ["#c06020", "#e88838", "#f8b060", "#7c3010"];
  ctx.fillStyle = tone[0];
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = tone[1];
  ctx.fillRect(x + 2, y + 6, 3, 3);
  ctx.fillRect(x + 10, y + 10, 3, 3);
  if (lip) {
    ctx.fillStyle = tone[2];
    ctx.fillRect(x, y, 16, 3);
    ctx.fillStyle = tone[3];
    ctx.fillRect(x, y + 3, 16, 1);
  }
}

function drawBrick(ctx, x, y, kind) {
  const stone = kind === true || kind === "stone";
  const wood = kind === "wood";
  ctx.fillStyle = wood ? "#7a4a22" : stone ? "#686070" : "#d07030";
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = wood ? "#3a2410" : stone ? "#403848" : "#7c3010";
  ctx.fillRect(x, y + 7, 16, 2);
  ctx.fillRect(x + 7, y, 2, 7);
  ctx.fillRect(x, y + 9, 2, 7);
  ctx.fillRect(x + 7, y + 9, 2, 7);
}

function drawQuestion(ctx, x, y, used, now) {
  ctx.fillStyle = used ? "#a06028" : Math.floor(now / 180) % 2 ? "#f8d030" : "#e8a818";
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = used ? "#7c4010" : "#101010";
  ctx.fillRect(x, y, 16, 2);
  ctx.fillRect(x, y + 14, 16, 2);
  ctx.fillRect(x, y, 2, 16);
  ctx.fillRect(x + 14, y, 2, 16);
  if (!used) {
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText("?", x + 4, y + 12);
  }
}

function drawPlatform(ctx, x, y, world) {
  ctx.fillStyle = world === 2 ? "#f0d060" : "#c08438";
  ctx.fillRect(x, y + 4, 16, 8);
  ctx.fillStyle = "#fff0a0";
  ctx.fillRect(x, y + 4, 16, 2);
  ctx.fillStyle = "#7c4810";
  ctx.fillRect(x, y + 10, 16, 2);
}

function drawSpikes(ctx, x, y) {
  ctx.fillStyle = "#e03020";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 5 + 1, y + 10);
    ctx.lineTo(x + i * 5 + 3, y - 2);
    ctx.lineTo(x + i * 5 + 6, y + 10);
    ctx.fill();
  }
}

function drawPipe(ctx, x, y, side, top) {
  ctx.fillStyle = "#10b018";
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = "#d8fc98";
  ctx.fillRect(side === "l" ? x + 2 : x, y, 3, 16);
  ctx.fillStyle = "#087008";
  ctx.fillRect(side === "r" ? x + 12 : x + 14, y, 3, 16);
  if (top) {
    ctx.fillStyle = "#18d820";
    ctx.fillRect(side === "l" ? x - 2 : x, y, side === "l" ? 18 : 18, 5);
    ctx.fillStyle = "#d8fc98";
    ctx.fillRect(side === "l" ? x : x, y, 3, 5);
  }
}

function drawFlag(ctx, x, y, cloth, now) {
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(x + 7, y, 2, 16);
  if (cloth) {
    const wave = Math.sin(now / 120) * 2;
    ctx.fillStyle = "#18c818";
    ctx.fillRect(x + 9, y + 1, 8 + wave, 6);
    ctx.fillStyle = "#fcfcfc";
    ctx.fillRect(x + 6, y, 4, 3);
  }
}

function drawSign(ctx, x, y) {
  ctx.fillStyle = "#8c5018";
  ctx.fillRect(x + 7, y + 6, 2, 10);
  ctx.fillStyle = "#f8e0a0";
  ctx.fillRect(x + 2, y + 1, 12, 8);
  ctx.fillStyle = "#101010";
  ctx.fillRect(x + 4, y + 4, 8, 1);
}

function drawCoinNub(ctx, x, y) {
  ctx.fillStyle = "#a06810";
  ctx.fillRect(x + 6, y, 5, 4);
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(x + 7, y, 3, 3);
  ctx.fillStyle = "#fff0a0";
  ctx.fillRect(x + 8, y + 1, 1, 1);
}

function drawCoin(ctx, x, y, now) {
  const w = 4 + Math.floor(Math.sin(now / 90 + x) * 3 + 3);
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(x + 8 - w / 2, y + 1, w, 8);
  ctx.fillStyle = "#fff0a0";
  ctx.fillRect(x + 8 - w / 4, y + 2, 2, 6);
}

function drawMushroom(ctx, x, y, now) {
  const bob = Math.sin(now / 160) * 1;
  ctx.fillStyle = "#fcfcfc";
  ctx.fillRect(x + 4, y + 8 + bob, 8, 6);
  ctx.fillStyle = "#e83820";
  ctx.fillRect(x + 2, y + 3 + bob, 12, 7);
  ctx.fillStyle = "#fcfcfc";
  ctx.fillRect(x + 4, y + 5 + bob, 3, 3);
  ctx.fillRect(x + 9, y + 5 + bob, 3, 3);
}

function drawBug(ctx, x, y, now) {
  const frame = Math.floor(now / 200) % 2;
  blit(ctx, BUG, x, y + (frame ? 1 : 0), false);
}

function drawDoor(ctx, x, y, now) {
  const stone = Math.floor(now / 320) % 2 ? "#e8d8b0" : "#c8b090";
  ctx.fillStyle = stone;
  ctx.fillRect(x + 1, y + 1, 14, 3);
  ctx.fillRect(x + 1, y + 1, 3, 14);
  ctx.fillRect(x + 12, y + 1, 3, 14);
  ctx.fillStyle = "#140c08";
  ctx.fillRect(x + 4, y + 5, 8, 11);
  ctx.fillStyle = "#18c818";
  ctx.fillRect(x + 6, y + 6, 4, 3);
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(x + 5, y + 6, 1, 5);
}

function drawKing(ctx, state, cam, now, view) {
  const boss = view.level.phases[state.phaseIndex].boss;
  if (!boss) return;
  const x = (boss.x - cam) * 16 - 6;
  const y = boss.y * 16 - 8;
  const hop = Math.sin(now / 200) * 2;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 4, y + 36, 28, 4);
  ctx.fillStyle = "#20a030";
  ctx.fillRect(x + 4, y + 16 + hop, 28, 18);
  ctx.fillStyle = "#e8d060";
  ctx.fillRect(x + 8, y + 20 + hop, 20, 4);
  ctx.fillStyle = "#f0c8a0";
  ctx.fillRect(x + 8, y + hop, 16, 16);
  ctx.fillStyle = "#e83820";
  ctx.fillRect(x + 6, y - 4 + hop, 20, 6);
  ctx.fillRect(x + 2, y + hop, 4, 8);
  ctx.fillRect(x + 26, y + hop, 4, 8);
  ctx.fillStyle = "#101010";
  ctx.fillRect(x + 11, y + 6 + hop, 3, 3);
  ctx.fillRect(x + 18, y + 6 + hop, 3, 3);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 12, y + 6 + hop, 1, 1);
  ctx.fillStyle = "#f8d030";
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText(boss.letters.slice(state.bossI).join(" "), x, y - 8);
}

function drawHero(ctx, view, cam, now) {
  const pos = heroPos(view);
  blitHero(ctx, view, (pos.x - cam) * 16, pos.y * 16 + 16, now);
}

function blitHero(ctx, view, px, py, now) {
  const state = view.state;
  const jumping = view.anim && (view.anim.kind === "jump" || view.anim.kind === "dash");
  const art = jumping ? HERO_JUMP : Math.floor(now / 140) % 2 && view.anim ? HERO_STEP : HERO;
  const tall = state.big;
  const h = tall ? 32 : 16;
  ctx.save();
  if (state.facing < 0) {
    ctx.translate(px + 16, py - (tall ? 16 : 0));
    ctx.scale(-1, 1);
    blit(ctx, art, 0, 0, tall);
  } else {
    blit(ctx, art, px, py - (tall ? 16 : 0), tall);
  }
  ctx.restore();
  void h;
}

function drawPrincess(ctx, x, y) {
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(x + 4, y, 8, 3);
  ctx.fillStyle = "#f0c8a0";
  ctx.fillRect(x + 4, y + 3, 8, 7);
  ctx.fillStyle = "#101010";
  ctx.fillRect(x + 5, y + 5, 2, 2);
  ctx.fillRect(x + 9, y + 5, 2, 2);
  ctx.fillStyle = "#f06098";
  ctx.fillRect(x + 3, y + 10, 10, 12);
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(x + 6, y + 14, 4, 4);
}

function drawHills(ctx, shift, fill, dark) {
  ctx.fillStyle = dark;
  for (let i = -1; i < 4; i++) {
    const x = ((i * 90 - shift) % 360) - 40;
    ctx.beginPath();
    ctx.arc(x, 210, 50, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  for (let i = -1; i < 5; i++) {
    const x = ((i * 70 - shift * 0.6) % 320) - 20;
    ctx.beginPath();
    ctx.arc(x, 220, 34, Math.PI, 0);
    ctx.fill();
  }
}

function drawCloud(ctx, x, y) {
  ctx.fillStyle = "#fcfcfc";
  ctx.fillRect(x, y + 4, 28, 8);
  ctx.fillRect(x + 6, y, 16, 6);
}

function drawStars(ctx, now) {
  ctx.fillStyle = "#fcfcfc";
  for (let i = 0; i < 20; i++) {
    const x = (i * 47) % 256;
    const y = 20 + ((i * 29) % 80);
    if ((Math.floor(now / 300) + i) % 5 !== 0) ctx.fillRect(x, y, 2, 2);
  }
}

function drawLava(ctx, now) {
  const y = 210 + Math.sin(now / 200) * 2;
  ctx.fillStyle = "#e03810";
  ctx.fillRect(0, y, 256, 30);
  ctx.fillStyle = "#f8c020";
  for (let i = 0; i < 8; i++) ctx.fillRect(((i * 40 + now / 20) % 280) - 10, y, 16, 3);
}

const GLYPH = {
  0: [0b111, 0b101, 0b101, 0b101, 0b111],
  1: [0b010, 0b110, 0b010, 0b010, 0b111],
  2: [0b111, 0b001, 0b111, 0b100, 0b111],
  3: [0b111, 0b001, 0b111, 0b001, 0b111],
  4: [0b101, 0b101, 0b111, 0b001, 0b001],
  5: [0b111, 0b100, 0b111, 0b001, 0b111],
  6: [0b111, 0b100, 0b111, 0b101, 0b111],
  7: [0b111, 0b001, 0b001, 0b001, 0b001],
  8: [0b111, 0b101, 0b111, 0b101, 0b111],
  9: [0b111, 0b101, 0b111, 0b001, 0b111],
  "-": [0b000, 0b000, 0b111, 0b000, 0b000],
};

function pixText(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const rows = GLYPH[ch];
    if (!rows) {
      cx += 8;
      continue;
    }
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (rows[row] & (1 << (2 - col))) ctx.fillRect(cx + col * 2, y + row * 2, 2, 2);
      }
    }
    cx += 8;
  }
  return cx;
}

function drawFuseLobby(ctx, view, now) {
  ctx.fillStyle = "#14080c";
  ctx.fillRect(0, 0, 256, 240);
  ctx.fillStyle = "#e83820";
  ctx.fillRect(0, 0, 256, 6);
  const pulse = 80 + Math.floor(Math.sin(now / 180) * 40 + 40);
  ctx.fillStyle = `rgb(${pulse},32,24)`;
  ctx.fillRect(0, 220, 256, 8);
  ctx.fillStyle = "#fcfcfc";
  center(ctx, "FUSE", 48);
  ctx.fillStyle = "#f8d030";
  center(ctx, "TODAY", 78);
  const fuse = view.save.fuse || {};
  ctx.fillStyle = "#d0d8cc";
  label(ctx, dayKey(new Date()), 48, 96);
  const lines = [
    "streak  " + (fuse.streak || 0),
    "best    " + (fuse.best || 0),
    "rank    " + rankFor(fuse.best || 0),
  ];
  lines.forEach((line, i) => label(ctx, line, 48, 116 + i * 16));
  const wait = nextCardIn(new Date());
  ctx.fillStyle = "#f8d030";
  label(ctx, `new card ${wait.h}h ${String(wait.m).padStart(2, "0")}m`, 48, 170);
  ctx.fillStyle = "#9ece6a";
  center(ctx, "ENTER", 196);
  ctx.fillStyle = "#888888";
  center(ctx, "ESC TITLE", 214);
}

function drawFuseOut(ctx, view) {
  const out = view.fuseOut || {};
  ctx.fillStyle = "#14080c";
  ctx.fillRect(0, 0, 256, 240);
  ctx.fillStyle = out.fresh ? "#f8d030" : "#e83820";
  center(ctx, out.fresh ? "NEW BEST" : "DISQUALIFIED", 28);
  ctx.fillStyle = "#fcfcfc";
  const reason = (out.reason || "Miss.").slice(0, 28);
  label(ctx, reason, 8, 56);
  label(ctx, (out.hint || "").slice(0, 28), 8, 72);
  ctx.fillStyle = "#f8d030";
  label(ctx, "score   " + (out.score || 0), 8, 100);
  label(ctx, "best    " + (out.best || 0), 8, 116);
  label(ctx, "streak  " + (out.streak || 0), 8, 132);
  label(ctx, "rank    " + (out.rank || "CURSOR"), 8, 148);
  ctx.fillStyle = "#9ece6a";
  const next = out.next ? next.title + " at " + next.need : "top rank";
  label(ctx, next.slice(0, 28), 8, 168);
  ctx.fillStyle = out.card ? "#f8d030" : "#888888";
  const wait = nextCardIn(new Date());
  label(ctx, (out.card ? "card cleared" : "cleared " + (out.cleared || 0)) + `  ${wait.h}h ${String(wait.m).padStart(2, "0")}m`, 8, 188);
  ctx.fillStyle = "#fcfcfc";
  center(ctx, "ENTER REMATCH", 208);
  center(ctx, "P PRACTICE", 222);
}

function drawFuseHud(ctx, view, now) {
  const run = view.fuseRun;
  if (!run) return;
  if (run.practice) {
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 214, 256, 26);
    ctx.fillStyle = "#9ece6a";
    label(ctx, "practice  no fuse", 8, 232);
    return;
  }
  const left = run.frozen || view.paused ? run.left ?? run.fuse : Math.max(0, run.deadline - now);
  const ratio = run.fuse ? Math.max(0, Math.min(1, left / run.fuse)) : 0;
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 214, 256, 26);
  ctx.fillStyle = ratio < 0.28 ? "#e83820" : ratio < 0.55 ? "#f8d030" : "#18c818";
  ctx.fillRect(4, 218, Math.floor(200 * ratio), 6);
  pixText(ctx, String(Math.ceil(left / 100)).padStart(2, "0"), 210, 216, "#fcfcfc");
  ctx.fillStyle = "#fcfcfc";
  label(ctx, (run.beat?.hint || "").slice(0, 26), 8, 236);
}

function drawHud(ctx, view) {
  const state = view.state;
  const level = view.level;
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 0, 256, 16);
  if (view.fuseRun) {
    pixText(ctx, String(view.fuseRun.index + 1).padStart(2, "0"), 4, 3, "#ff6040");
    pixText(ctx, String(view.fuseRun.score).padStart(4, "0"), 120, 3, "#f8d030");
    return;
  }
  pixText(ctx, level.id, 4, 3, "#fcfcfc");
  ctx.fillStyle = "#f8d030";
  ctx.fillRect(78, 4, 6, 8);
  ctx.fillStyle = "#fff0a0";
  ctx.fillRect(80, 5, 2, 6);
  pixText(ctx, String(state.coins).padStart(2, "0"), 88, 3, "#f8d030");
  pixText(ctx, String(state.keystrokes).padStart(3, "0"), 140, 3, "#9ece6a");
  const mode = state.kind === "maze" ? "B" : state.kind === "boss" ? "!" : "N";
  pixText(ctx, mode, 236, 3, state.kind === "maze" ? "#f8d030" : state.kind === "boss" ? "#ff6040" : "#fcfcfc");
}

function drawParticles(ctx, view, now) {
  for (const p of view.particles) {
    const life = p.life || 300;
    const age = (now - p.born) / life;
    if (age >= 1) continue;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x + p.vx * age * 16, p.y + p.vy * age * 12 + age * age * 8, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function heroPos(view) {
  const state = view.state;
  if (!view.anim) return { x: state.px, y: state.py };
  const dur = view.anim.dur || view.anim.until - view.anim.t0 || 1;
  const t = Math.max(0, Math.min(1, (performance.now() - view.anim.t0) / dur));
  const pts = view.anim.points;
  if (!pts.length) return { x: state.px, y: state.py };
  const f = t * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const u = f - i;
  const a = pts[Math.max(0, i)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  if (!a || !b || !Number.isFinite(a.x) || !Number.isFinite(b.x)) return { x: state.px, y: state.py };
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function label(ctx, text, x, y) {
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText(text, x, y);
}

function banner(ctx, text, y, size, color) {
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.fillStyle = color;
  const w = ctx.measureText(text).width;
  ctx.fillText(text, Math.round((256 - w) / 2), y);
}

function center(ctx, text, y) {
  banner(ctx, text, y, 8, ctx.fillStyle);
}
