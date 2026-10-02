// Game rules for courses (side view) and buffers (vim mazes).
// State is plain data so undo can clone it.

import { crossesWall, findTarget, gotoTarget, lineTarget, matchTarget, paraTarget, searchTarget, starWord, wordTarget } from "./vim.js";

const LESSON = {
  h: "h moves left one character.",
  l: "l moves right one character.",
  j: "j moves down one line. On a course, j drops.",
  k: "k moves up. On a course, k jumps or bumps a block.",
  w: "w jumps to the start of the next word.",
  b: "b jumps to the start of the word.",
  e: "e jumps to the end of the word.",
  "0": "0 jumps to the start of the line.",
  "^": "^ jumps to the first non-blank on the line.",
  $: "$ jumps to the end of the line.",
  f: "f lands on the character. t stops just before it.",
  t: "t stops just before the character. f would land on it.",
  F: "F finds the character backward.",
  T: "T stops just before the character, searching backward.",
  ";": "; repeats the last f, F, t, or T.",
  ",": ", repeats the last find in the other direction.",
  gg: "gg goes to the first line. 4G goes to line 4.",
  G: "G goes to the last line. 4G goes to line 4.",
  x: "x deletes the character under the cursor.",
  "/": "/ searches forward. n repeats it. N goes backward.",
  "?": "? searches backward.",
  n: "n repeats the last search.",
  N: "N repeats the search backward.",
  W: "W jumps to the next WORD. Punctuation rides along. On a course, W skips one platform.",
  B: "B jumps back to the start of a WORD.",
  E: "E jumps to the end of a WORD, punctuation included.",
  "%": "% jumps to the matching bracket.",
  r: "r replaces the character under the cursor. r~ on X writes the exit.",
  "*": "* searches forward for the word under the cursor.",
  "}": "} jumps to the next blank line.",
  "{": "{ jumps to the previous blank line.",
  guu: "guu lowercases the whole line.",
  gUw: "gUw uppercases the word.",
  m: "ma remembers this spot.",
  "'": "'a jumps back to mark a.",
  ".": ". repeats the last x or r.",
};

function key(x, y) {
  return x + "," + y;
}

export function ensureLevel(level) {
  if (level.totalCoins != null) return level;
  let n = 0;
  for (const phase of level.phases) {
    if (phase.kind === "maze") {
      for (const row of phase.rows) n += [...row].filter((c) => c === "*").length;
      n += (phase.coins || []).length;
    } else {
      for (const row of phase.rows) n += [...row].filter((c) => c === "C").length;
      for (const q of phase.questions || []) if ((q.item || "coin") === "coin") n++;
      n += (phase.pickups || []).length;
    }
  }
  level.totalCoins = n;
  return level;
}

export function createGame(level) {
  ensureLevel(level);
  const state = {
    phaseIndex: 0,
    coins: 0,
    score: 0,
    keystrokes: 0,
    deaths: 0,
    big: false,
    won: false,
    facing: 1,
    lastSearch: null,
    message: "",
    lesson: "",
    hint: "",
  };
  enterPhase(state, level);
  return state;
}

export function enterPhase(state, level) {
  const phase = level.phases[state.phaseIndex];
  state.dead = false;
  state.phaseClear = false;
  state.bugs = [];
  state.mush = null;
  state.destroyed = {};
  state.usedQ = {};
  state.coinsArr = [];
  state.tiles = null;
  state.lines = null;
  state.pits = {};
  state.walls = {};
  state.exits = {};
  state.doors = {};
  state.spikes = {};
  state.pluses = {};
  state.letterAt = {};
  state.bossI = 0;
  state.opened = false;
  state.hint = "";
  state.marks = {};
  state.lastChange = null;
  state.spikeChars = phase.spikeChars || [];
  state.needSeals = phase.seals || [];
  state.gotSeals = {};
  state.pendingSeal = "";
  state.checks = phase.checkpoints || [];
  if (phase.kind === "maze") loadMaze(state, phase);
  else loadCourse(state, phase);
  state.message = phase.intro || "";
  state.lesson = phase.lesson || "";
  if (phase.kind === "boss") {
    const ch = phase.boss.letters[0];
    state.message = `Strike ${ch}.`;
  }
}

export function advancePhase(state, level) {
  if (state.phaseIndex >= level.phases.length - 1) {
    state.won = true;
    state.phaseClear = false;
    return true;
  }
  state.phaseIndex += 1;
  const coins = state.coins;
  const score = state.score;
  const keys = state.keystrokes;
  const deaths = state.deaths;
  const big = state.big;
  enterPhase(state, level);
  state.coins = coins;
  state.score = score;
  state.keystrokes = keys;
  state.deaths = deaths;
  state.big = big;
  return false;
}

function loadMaze(state, phase) {
  const h = phase.rows.length;
  const w = phase.rows[0].length;
  state.kind = "maze";
  state.w = w;
  state.h = h;
  const lines = [];
  let start = phase.start ? { x: phase.start.x, y: phase.start.y } : { x: 0, y: 0 };
  for (let y = 0; y < h; y++) {
    if (phase.rows[y].length !== w) throw new Error(`ragged maze row ${y}`);
    let line = "";
    for (let x = 0; x < w; x++) {
      let ch = phase.rows[y][x];
      const id = key(x, y);
      if (ch === "@") {
        start = { x, y };
        ch = " ";
      } else if (ch === "`") {
        state.pits[id] = true;
        ch = " ";
      } else if (ch === "#") {
        state.walls[id] = true;
      } else if (ch === "D") {
        state.doors[id] = true;
        state.walls[id] = true;
        ch = "#";
      } else if (ch === "~") {
        state.exits[id] = true;
      } else if (ch === "*") {
        state.coinsArr.push({ x, y, got: false });
        ch = " ";
      } else if (ch === "+") {
        state.pluses[id] = true;
      }
      if (phase.spikeChars && phase.spikeChars.includes(ch)) state.spikes[id] = true;
      line += ch;
    }
    lines.push(line);
  }
  for (const c of phase.coins || []) state.coinsArr.push({ x: c.x, y: c.y, got: false, gem: !!c.gem });
  state.gem = phase.gem || null;
  state.gemUsed = false;
  state.lines = lines;
  state.px = start.x;
  state.py = start.y;
  state.goal = "exit";
}

function loadCourse(state, phase) {
  const rows = phase.rows;
  const h = rows.length;
  const w = rows[0].length;
  state.kind = phase.kind === "boss" ? "boss" : "course";
  state.w = w;
  state.h = h;
  state.tiles = [];
  const reserved = new Set([".", "#", "=", "?", "^", "P", "Q", "S", "G", "C", "F", "@", "B", "M", ",", "*", "D"]);
  let start = { x: 1, y: 1 };
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`ragged course row ${y} (${rows[y].length}!=${w})`);
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      let cell = { t: "empty" };
      if (ch === "#") cell = { t: "solid" };
      else if (ch === "=") cell = { t: "platform" };
      else if (ch === "B") cell = { t: "brick" };
      else if (ch === "?") cell = { t: "question" };
      else if (ch === "^") cell = { t: "spike" };
      else if (ch === "P") cell = { t: "pipe", side: "l" };
      else if (ch === "Q") cell = { t: "pipe", side: "r" };
      else if (ch === "F") cell = { t: "flag" };
      else if (ch === "S") cell = { t: "sign" };
      else if (ch === ",") cell = { t: "blank" };
      else if (ch === "@") start = { x, y };
      else if (ch === "G") state.bugs.push({ x, y, dir: -1 });
      else if (ch === "C") state.coinsArr.push({ x, y, got: false });
      else if ("()[]{}".includes(ch)) {
        cell = { t: "letter", ch };
        state.letterAt[key(x, y)] = ch;
      } else if (!reserved.has(ch) && /[A-Za-z]/.test(ch)) {
        cell = { t: "letter", ch };
        state.letterAt[key(x, y)] = ch;
      }
      row.push(cell);
    }
    state.tiles.push(row);
  }
  for (const c of phase.pickups || []) state.coinsArr.push({ x: c.x, y: c.y, got: false });
  if (phase.boss) {
    const b = phase.boss;
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (state.tiles[y] && state.tiles[y][x]) state.tiles[y][x] = { t: "hurt" };
      }
    }
  }
  if (phase.start) start = phase.start;
  state.px = start.x;
  state.py = start.y;
  state.goal = phase.goal || "flag";
}

function tileAt(state, x, y) {
  if (x < 0 || x >= state.w || y < 0) return { t: "solid" };
  if (y >= state.h) return { t: "void" };
  if (state.destroyed[key(x, y)]) return { t: "empty" };
  return state.tiles[y][x];
}

function solid(tile) {
  if (!tile) return false;
  return tile.t === "solid" || tile.t === "platform" || tile.t === "brick" || tile.t === "question" || tile.t === "spike" || tile.t === "pipe" || tile.t === "hurt";
}

function canStand(state, x, y) {
  if (x < 0 || x >= state.w || y < 0 || y >= state.h) return false;
  const here = tileAt(state, x, y);
  if (solid(here) || here.t === "void") return false;
  return solid(tileAt(state, x, y + 1));
}

function kill(state, events, message) {
  state.dead = true;
  state.message = message;
  events.push({ t: "die" });
}

function takeCoins(state, x, y, events) {
  for (const c of state.coinsArr) {
    if (!c.got && c.x === x && c.y === y) {
      c.got = true;
      state.coins += 1;
      state.score += 200;
      events.push({ t: "coin", x, y });
      if (c.gem) sealGem(state, events);
    }
  }
}

function sealGem(state, events) {
  const gem = state.gem;
  if (!gem || state.gemUsed) return;
  state.gemUsed = true;
  for (const cell of gem.close || []) {
    const id = key(cell.x, cell.y);
    const row = state.lines[cell.y].split("");
    row[cell.x] = "#";
    state.lines[cell.y] = row.join("");
    state.walls[id] = true;
    delete state.exits[id];
  }
  for (const cell of gem.open || []) {
    const id = key(cell.x, cell.y);
    const ch = cell.ch || " ";
    const row = state.lines[cell.y].split("");
    row[cell.x] = ch;
    state.lines[cell.y] = row.join("");
    delete state.walls[id];
    if (ch === "~") state.exits[id] = true;
  }
  events.push({
    t: "open",
    cells: [
      ...(gem.close || []).map((cell) => ({ x: cell.x, y: cell.y, kind: "close" })),
      ...(gem.open || []).map((cell) => ({ x: cell.x, y: cell.y, kind: "open" })),
    ],
  });
  state.message = "The gem seals the way you came. A hatch opened.";
}

function bugAt(state, x, y) {
  return state.bugs.find((b) => b.x === x && b.y === y);
}

function stomp(state, bug, events) {
  state.bugs = state.bugs.filter((b) => b !== bug);
  state.score += 100;
  events.push({ t: "stomp", x: bug.x, y: bug.y });
}

function hitBoss(state, phase, events) {
  state.bossI += 1;
  state.score += 500;
  events.push({ t: "hit" });
  if (state.bossI >= phase.boss.letters.length) {
    state.phaseClear = true;
    state.message = "King Insert was deleted.";
    events.push({ t: "flag" });
  } else if (phase.boss.dance) {
    swingBoss(state, phase);
  } else {
    const next = phase.boss.letters[state.bossI];
    state.message = `Deleted. Strike ${next}.`;
  }
}

function paintPad(state, pad, letter, spiked) {
  const y = pad.y;
  for (let x = pad.x; x < pad.x + pad.w; x++) {
    if (state.tiles[y + 1]) state.tiles[y + 1][x] = { t: spiked ? "spike" : "solid" };
    const here = state.tiles[y] && state.tiles[y][x];
    if (here && here.t === "letter") {
      delete state.letterAt[key(x, y)];
      state.tiles[y][x] = { t: "empty" };
    }
  }
  if (letter && state.tiles[y]) {
    state.tiles[y][pad.x] = { t: "letter", ch: letter };
    state.letterAt[key(pad.x, y)] = letter;
  }
}

function swingBoss(state, phase) {
  const dance = phase.boss.dance;
  const next = phase.boss.letters[state.bossI];
  const side = state.bossI % 2 === 1 ? "left" : "right";
  const place = side === "left" ? dance.left : dance.right;
  const other = side === "left" ? dance.right : dance.left;
  paintPad(state, place, next, false);
  paintPad(state, other, null, true);
  state.message = `He swings ${side}. The opening is ${next}. Red bites.`;
}

function bossCheck(state, level, x, y, events) {
  const phase = level.phases[state.phaseIndex];
  if (phase.kind !== "boss" || state.phaseClear || state.dead) return;
  const ch = state.letterAt[key(x, y)];
  if (!ch) return;
  const want = phase.boss.letters[state.bossI];
  if (ch === want) hitBoss(state, phase, events);
  else state.message = `That is ${ch}. Strike ${want}.`;
}

function arriveCourse(state, level, x, y, events, how) {
  if (x < 0 || y < 0 || x >= state.w || y >= state.h) {
    kill(state, events, "You fell off the course.");
    return;
  }
  const here = tileAt(state, x, y);
  if (here.t === "hurt") {
    kill(state, events, "King Insert deletes a cursor that touches him.");
    return;
  }
  const bug = bugAt(state, x, y);
  if (bug) {
    if (how === "step") {
      kill(state, events, "You walked into a bug. k jumps onto it.");
      return;
    }
    stomp(state, bug, events);
  }
  state.px = x;
  state.py = y;
  takeCoins(state, x, y, events);
  if (state.dead || state.phaseClear) return;
  const under = tileAt(state, x, y + 1);
  if (under.t === "spike") {
    const phase = level.phases[state.phaseIndex];
    const bite = phase.boss?.dance ? "Red bites. That side is his swing. b retreats." : "Spikes. A count skips words: 2w leaps two platforms.";
    kill(state, events, bite);
    return;
  }
  if (here.t === "flag" && state.goal === "flag") {
    state.phaseClear = true;
    state.message = "Flag.";
    events.push({ t: "flag", x, y });
  }
  bossCheck(state, level, x, y, events);
  if ((state.checks || []).some((spot) => spot.x === x && spot.y === y)) events.push({ t: "check", x, y });
}

function arriveMaze(state, x, y, events) {
  state.px = x;
  state.py = y;
  const id = key(x, y);
  takeCoins(state, x, y, events);
  if (state.pits[id]) {
    kill(state, events, "Pit. w leaps a word. l walks one character.");
    return;
  }
  if (state.spikes[id]) {
    const ch = state.lines[y][x];
    const why = ch === "," ? ", is punctuation. w stops on it. W jumps the whole WORD." : `${ch} is lava. t stops before it. f lands on it.`;
    kill(state, events, why);
    return;
  }
  if (state.exits[id]) {
    state.phaseClear = true;
    state.message = "Exit.";
    events.push({ t: "flag", x, y });
  }
  if (!state.dead && (state.checks || []).some((spot) => spot.x === x && spot.y === y)) events.push({ t: "check", x, y });
}

function nearbySign(state, phase) {
  if (!phase.signs) return "";
  for (const s of phase.signs) {
    if (Math.abs(s.x - state.px) + Math.abs(s.y - state.py) <= 1) return s.text;
  }
  return "";
}

function overhead(state) {
  const fresh = (x, y) => {
    const tile = tileAt(state, x, y);
    if (tile.t === "brick" && !state.destroyed[key(x, y)]) return { x, y };
    if (tile.t === "question" && !state.usedQ[key(x, y)]) return { x, y };
    return null;
  };
  const head = fresh(state.px, state.py - 1);
  if (head) return head;
  if (solid(tileAt(state, state.px, state.py - 1))) return null;
  return fresh(state.px, state.py - 2);
}

function doBump(state, level, bump, events) {
  const phase = level.phases[state.phaseIndex];
  const id = key(bump.x, bump.y);
  const tile = state.tiles[bump.y][bump.x];
  events.push({ t: "bump", x: bump.x, y: bump.y });
  if (tile.t === "brick") {
    if (state.big && !state.destroyed[id]) {
      state.destroyed[id] = true;
      state.score += 50;
      events.push({ t: "break", x: bump.x, y: bump.y });
      state.message = "Big Vimario breaks bricks.";
    } else state.message = "Solid brick.";
    state.lesson = LESSON.k;
    return true;
  }
  if (tile.t === "question" && !state.usedQ[id]) {
    state.usedQ[id] = true;
    const q = (phase.questions || []).find((item) => item.x === bump.x && item.y === bump.y);
    const item = q?.item || "coin";
    if (item === "mushroom") {
      const sy = bump.y - 1;
      state.mush = { x: bump.x, y: sy >= 0 ? sy : bump.y, dir: 1 };
      state.message = "A mushroom walked out. Touch it.";
    } else if (item === "hint") {
      state.message = q.hint || "Keep going.";
    } else {
      state.coins += 1;
      state.score += 200;
      events.push({ t: "coin", x: bump.x, y: bump.y });
      state.message = "Coin from the block.";
    }
  } else state.message = "Empty block.";
  state.lesson = LESSON.k;
  return true;
}

function highestLanding(state, tx, fromY) {
  for (let ny = fromY - 2; ny <= fromY + 1; ny++) {
    if (canStand(state, tx, ny)) return ny;
  }
  return null;
}

function arcClear(state, tx) {
  const dir = Math.sign(tx - state.px);
  if (!dir) return true;
  for (let x = state.px + dir; x !== tx; x += dir) {
    if (solid(tileAt(state, x, state.py)) || solid(tileAt(state, x, state.py - 1))) return false;
  }
  return true;
}

function tryJump(state, level, events) {
  const bump = overhead(state);
  if (bump) return doBump(state, level, bump, events);
  const dir = state.facing || 1;
  for (const dist of [1, 2]) {
    const tx = state.px + dir * dist;
    if (tx < 0 || tx >= state.w || !arcClear(state, tx)) continue;
    const ny = highestLanding(state, tx, state.py);
    if (ny == null) continue;
    if (!bugAt(state, tx, ny)) continue;
    const bug = bugAt(state, tx, ny);
    stomp(state, bug, events);
    events.push({ t: "jump", path: [{ x: tx, y: ny }] });
    arriveCourse(state, level, tx, ny, events, "stomp");
    state.lesson = LESSON.k;
    return true;
  }
  for (const dist of [2, 1]) {
    const tx = state.px + dir * dist;
    if (tx < 0 || tx >= state.w || !arcClear(state, tx)) continue;
    const ny = highestLanding(state, tx, state.py);
    if (ny == null) continue;
    events.push({ t: "jump", path: [{ x: tx, y: ny }] });
    arriveCourse(state, level, tx, ny, events, "jump");
    state.lesson = state.lesson || LESSON.k;
    if (!state.message) state.message = "k jumps forward.";
    return true;
  }
  state.message = "Nowhere to land. Face a gap, then press k.";
  state.lesson = LESSON.k;
  return false;
}

function tryStep(state, level, dir, events) {
  const sign = dir === "l" ? 1 : -1;
  state.facing = sign;
  const nx = state.px + sign;
  if (nx < 0 || nx >= state.w) {
    state.message = "Edge of the course.";
    state.lesson = LESSON[dir];
    return false;
  }
  const dest = tileAt(state, nx, state.py);
  if (solid(dest) && !solid(tileAt(state, nx, state.py - 1)) && !solid(tileAt(state, state.px, state.py - 1))) {
    events.push({ t: "move", path: [{ x: nx, y: state.py - 1 }] });
    arriveCourse(state, level, nx, state.py - 1, events, "step");
    state.lesson = LESSON[dir];
    return true;
  }
  if (solid(dest)) {
    state.message = "Blocked.";
    state.lesson = LESSON[dir];
    return false;
  }
  let y = state.py;
  const path = [{ x: nx, y }];
  let fall = 0;
  while (!solid(tileAt(state, nx, y + 1)) && y < state.h) {
    y += 1;
    fall += 1;
    path.push({ x: nx, y });
    if (fall > 6) break;
  }
  events.push({ t: "move", path });
  if (fall > 6 || !solid(tileAt(state, nx, y + 1))) {
    state.px = nx;
    state.py = Math.min(y, state.h - 1);
    kill(state, events, "You fell. k jumps a one-tile gap. Wider gaps need w.");
    state.lesson = LESSON[dir];
    return true;
  }
  for (const p of path) {
    arriveCourse(state, level, p.x, p.y, events, "step");
    if (state.dead || state.phaseClear) break;
  }
  state.lesson = LESSON[dir];
  return true;
}

function tryDrop(state, level, events) {
  const phase = level.phases[state.phaseIndex];
  const under = tileAt(state, state.px, state.py + 1);
  if (under.t === "pipe" && phase.goal === "pipe") {
    state.phaseClear = true;
    state.message = "Entering the buffer.";
    state.lesson = "j goes down. On a pipe, j enters.";
    events.push({ t: "pipe" });
    return true;
  }
  if (under.t === "platform") {
    for (let y = state.py + 2; y < state.h; y++) {
      if (canStand(state, state.px, y)) {
        events.push({ t: "move", path: [{ x: state.px, y }] });
        arriveCourse(state, level, state.px, y, events, "drop");
        state.lesson = "j drops through a thin platform.";
        state.message = "Dropped.";
        return true;
      }
    }
    kill(state, events, "Nothing below.");
    return true;
  }
  state.message = "j goes down. This floor is solid. k goes up.";
  state.lesson = LESSON.j;
  return false;
}

function spanAt(state, x, y) {
  if (!canStand(state, x, y)) return null;
  const seen = new Set();
  const stack = [[x, y]];
  const cells = [];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const id = key(cx, cy);
    if (seen.has(id)) continue;
    if (!canStand(state, cx, cy)) continue;
    seen.add(id);
    cells.push({ x: cx, y: cy });
    for (const dx of [-1, 1]) {
      for (const dy of [-1, 0, 1]) stack.push([cx + dx, cy + dy]);
    }
  }
  const minX = Math.min(...cells.map((c) => c.x));
  const maxX = Math.max(...cells.map((c) => c.x));
  const at = (xx) => cells.filter((c) => c.x === xx).sort((a, b) => a.y - b.y)[0];
  return { cells, minX, maxX, start: at(minX), end: at(maxX) };
}

function allSpans(state) {
  const seen = new Set();
  const spans = [];
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (seen.has(key(x, y)) || !canStand(state, x, y)) continue;
      const span = spanAt(state, x, y);
      for (const c of span.cells) seen.add(key(c.x, c.y));
      spans.push(span);
    }
  }
  return spans;
}

function spanOf(spans, x, y) {
  return spans.find((s) => s.cells.some((c) => c.x === x && c.y === y)) || null;
}

function nextSpan(spans, span, y) {
  return spans
    .filter((s) => s.minX > span.maxX)
    .sort((a, b) => a.minX - b.minX || Math.abs(a.start.y - y) - Math.abs(b.start.y - y))[0];
}

function prevSpan(spans, span, y) {
  return spans
    .filter((s) => s.maxX < span.minX)
    .sort((a, b) => b.maxX - a.maxX || Math.abs(a.start.y - y) - Math.abs(b.start.y - y))[0];
}

function sameSpan(a, b) {
  return a && b && a.minX === b.minX && a.maxX === b.maxX && a.start.y === b.start.y && a.end.y === b.end.y;
}

function dashTo(state, level, span, dest, events) {
  const xs = [...new Set(span.cells.map((c) => c.x))].sort((a, b) => a - b);
  const forward = dest.x >= state.px;
  const seq = xs.filter((x) => (forward ? x >= state.px && x <= dest.x : x <= state.px && x >= dest.x));
  if (!forward) seq.reverse();
  const points = [];
  for (const x of seq) {
    if (x === state.px && points.length === 0) continue;
    const options = span.cells.filter((c) => c.x === x);
    options.sort((a, b) => Math.abs(a.y - state.py) - Math.abs(b.y - state.py));
    if (options[0].x === state.px && options[0].y === state.py) continue;
    points.push(options[0]);
  }
  if (!points.length) {
    state.message = "Already there.";
    return false;
  }
  events.push({ t: "dash", path: points });
  for (const p of points) {
    arriveCourse(state, level, p.x, p.y, events, "dash");
    if (state.dead || state.phaseClear) break;
  }
  return true;
}

function leapTo(state, level, dest, events) {
  state.facing = dest.x >= state.px ? 1 : -1;
  events.push({ t: "jump", path: [dest] });
  arriveCourse(state, level, dest.x, dest.y, events, "leap");
  return true;
}

function courseWord(state, level, which, count, events) {
  const big = "WBE".includes(which);
  const motion = big ? which.toLowerCase() : which;
  const hops = big ? count * 2 : count;
  const origin = spanOf(allSpans(state), state.px, state.py);
  if (!origin) {
    state.message = "You are not standing on a platform.";
    return false;
  }
  let x = state.px;
  let y = state.py;
  let dest = null;
  for (let i = 0; i < hops; i++) {
    const spans = allSpans(state);
    const span = spanOf(spans, x, y);
    if (!span) break;
    let step = null;
    if (motion === "w") {
      const n = nextSpan(spans, span, y);
      if (!n) break;
      step = n.start;
    } else if (motion === "b") {
      if (x !== span.start.x || y !== span.start.y) step = span.start;
      else {
        const p = prevSpan(spans, span, y);
        if (!p) break;
        step = p.start;
      }
    } else {
      if (x !== span.end.x || y !== span.end.y) step = span.end;
      else {
        const n = nextSpan(spans, span, y);
        if (!n) break;
        step = n.end;
      }
    }
    if (!step) break;
    dest = step;
    x = step.x;
    y = step.y;
  }
  if (!dest) {
    state.message = motion === "b" ? "No previous word." : "No next word.";
    state.lesson = LESSON[which] || LESSON[motion];
    return false;
  }
  state.lesson = big ? LESSON[which] : LESSON[motion] + " On a course, each platform is a word.";
  const endSpan = spanOf(allSpans(state), dest.x, dest.y);
  if (sameSpan(origin, endSpan)) return dashTo(state, level, origin, dest, events);
  return leapTo(state, level, dest, events);
}

function courseMatch(state, level, count, events) {
  const lines = [];
  for (let y = 0; y < state.h; y++) {
    let row = "";
    for (let x = 0; x < state.w; x++) {
      const ch = state.letterAt[key(x, y)] || " ";
      row += "()[]{}".includes(ch) ? ch : " ";
    }
    lines.push(row);
  }
  const target = matchTarget(lines, state.px, state.py, count);
  state.lesson = LESSON["%"];
  if (!target) {
    state.message = "No matching bracket.";
    return false;
  }
  if (!canStand(state, target.x, target.y)) {
    state.message = "The match is not a floor.";
    return false;
  }
  return leapTo(state, level, target, events);
}

function mazeReplace(state, ch, events) {
  const x = state.px;
  const y = state.py;
  const id = key(x, y);
  state.lesson = LESSON.r;
  if (state.walls[id] || state.lines[y][x] === "#") {
    state.message = "Walls stay. Stand on X, then r~.";
    return false;
  }
  const prev = state.lines[y][x];
  const row = state.lines[y].split("");
  row[x] = ch;
  state.lines[y] = row.join("");
  if (state.pits[id]) delete state.pits[id];
  if (state.spikes[id] && ch !== "Q") delete state.spikes[id];
  events.push({ t: "break", x, y });
  state.lastChange = { op: "replace", ch };
  if (ch === "~" && prev === "X") {
    state.exits[id] = true;
    state.message = "Wrote ~. That cell is the exit.";
    arriveMaze(state, x, y, events);
    return true;
  }
  if (ch === "~") {
    state.message = "That ~ is not the hole. Stand on X, then r~.";
    return true;
  }
  delete state.exits[id];
  state.message = `Replaced ${prev === " " ? "a blank" : prev} with ${ch}.`;
  return true;
}

function mazeStar(state, count, events) {
  const word = starWord(state.lines, state.px, state.py);
  state.lesson = LESSON["*"];
  if (!word) {
    state.message = "No word under the cursor.";
    return false;
  }
  let x = state.px;
  let y = state.py;
  let target = null;
  for (let n = 0; n < count; n++) {
    const hit = searchTarget(state.lines, x, y, word, 1, true);
    if (!hit || (hit.x === x && hit.y === y)) break;
    target = hit;
    x = hit.x;
    y = hit.y;
  }
  state.lastSearch = { query: word, dir: 1 };
  if (!target) {
    state.message = `No other "${word}".`;
    return false;
  }
  const moved = leapMaze(state, target, events, LESSON["*"]);
  if (moved) state.message = `* ${word}`;
  return moved;
}

function courseLine(state, level, which, events) {
  const spans = allSpans(state);
  const span = spanOf(spans, state.px, state.py);
  if (!span) {
    state.message = "No line under you.";
    return false;
  }
  let dest = span.start;
  if (which === "$") dest = span.end;
  if (which === "^") {
    const ordered = [...span.cells].sort((a, b) => a.x - b.x || a.y - b.y);
    dest = ordered.find((c) => tileAt(state, c.x, c.y).t !== "blank") || span.start;
  }
  state.lesson = LESSON[which] + " On a course, the platform you stand on is the line.";
  return dashTo(state, level, span, dest, events);
}

function floorsInColumn(state, x) {
  const ys = [];
  for (let y = 0; y < state.h; y++) if (canStand(state, x, y)) ys.push(y);
  return ys;
}

function courseGoto(state, level, which, line, events) {
  const ys = floorsInColumn(state, state.px);
  if (!ys.length) {
    state.message = "No floor in this column.";
    return false;
  }
  const idx = line == null ? (which === "gg" ? 0 : ys.length - 1) : Math.min(ys.length, Math.max(1, line)) - 1;
  const y = ys[idx];
  state.lesson = LESSON[which] + " On a course, lines are the floors in your column.";
  if (y === state.py) {
    state.message = "Already on that floor.";
    return false;
  }
  return leapTo(state, level, { x: state.px, y }, events);
}

function courseFind(state, level, ch, dir, till, count, events) {
  let x = state.px;
  const y = state.py;
  for (let n = 0; n < count; n++) {
    let hit = -1;
    const step = dir > 0 ? 1 : -1;
    for (let i = x + step; i >= 0 && i < state.w; i += step) {
      const tile = tileAt(state, i, y);
      if (solid(tile) && tile.t !== "letter") break;
      if (state.letterAt[key(i, y)] !== ch) continue;
      if (till && i - dir === x) continue;
      hit = i;
      break;
    }
    if (hit < 0) {
      state.message = `${ch} not found on this line.`;
      state.lesson = LESSON.f;
      return false;
    }
    if (till) {
      const land = hit - dir;
      if (land === x || land < 0 || land >= state.w) {
        state.message = "Nothing before that character.";
        return false;
      }
      x = land;
    } else x = hit;
  }
  if (!canStand(state, x, y)) {
    state.message = "Can't stand there.";
    return false;
  }
  state.lesson = till ? LESSON.t : LESSON.f;
  return leapTo(state, level, { x, y }, events);
}

function courseX(state, events) {
  const fx = state.px + (state.facing || 1);
  const bug = bugAt(state, state.px, state.py) || bugAt(state, fx, state.py);
  if (bug) {
    stomp(state, bug, events);
    state.lesson = LESSON.x;
    state.message = "Deleted.";
    return true;
  }
  const front = tileAt(state, fx, state.py);
  if (state.big && front.t === "brick") {
    state.destroyed[key(fx, state.py)] = true;
    events.push({ t: "break", x: fx, y: state.py });
    state.lesson = LESSON.x;
    state.message = "Brick deleted.";
    return true;
  }
  state.message = "Nothing to delete under the cursor.";
  state.lesson = LESSON.x;
  return false;
}

function mazeStep(state, dir, events) {
  const delta = { h: [-1, 0], l: [1, 0], j: [0, 1], k: [0, -1] }[dir];
  const nx = state.px + delta[0];
  const ny = state.py + delta[1];
  state.lesson = LESSON[dir];
  if (nx < 0 || ny < 0 || nx >= state.w || ny >= state.h) {
    state.message = dir === "h" || dir === "l" ? "End of the line." : "No more lines.";
    return false;
  }
  if (state.lines[ny][nx] === "#" || state.walls[key(nx, ny)]) {
    state.message = "Wall.";
    return false;
  }
  if (dir === "h") state.facing = -1;
  if (dir === "l") state.facing = 1;
  events.push({ t: "move", path: [{ x: nx, y: ny }] });
  arriveMaze(state, nx, ny, events);
  return true;
}

function readingHitsWall(lines, x, y, tx, ty) {
  let cx = x;
  let cy = y;
  const forward = ty > y || (ty === y && tx >= x);
  for (let n = 0; n < 4000; n++) {
    if (forward) {
      cx += 1;
      if (!lines[cy] || cx >= lines[cy].length) {
        cy += 1;
        cx = 0;
        if (cy >= lines.length) return true;
      }
    } else {
      cx -= 1;
      if (cx < 0) {
        cy -= 1;
        if (cy < 0) return true;
        cx = lines[cy].length - 1;
      }
    }
    if (cy === ty && cx === tx) return false;
    if (lines[cy][cx] === "#") return true;
  }
  return true;
}

function leapMaze(state, target, events, lesson, words) {
  state.lesson = lesson;
  if (!target) {
    state.message = "Nothing there.";
    return false;
  }
  if (target.x === state.px && target.y === state.py) {
    state.message = "Already there.";
    return false;
  }
  if (crossesWall(state.lines, state.px, state.py, target.x, target.y) || (words && readingHitsWall(state.lines, state.px, state.py, target.x, target.y))) {
    state.message = "A wall is in the way.";
    return false;
  }
  const ch = state.lines[target.y][target.x];
  if (ch === "#" || state.walls[key(target.x, target.y)]) {
    state.message = "Blocked.";
    return false;
  }
  state.facing = target.x >= state.px ? 1 : -1;
  events.push({ t: "jump", path: [{ x: target.x, y: target.y }] });
  arriveMaze(state, target.x, target.y, events);
  return true;
}

function mazeX(state, events) {
  const id = key(state.px, state.py);
  state.lesson = LESSON.x;
  if (!state.pluses[id]) {
    state.message = "Nothing to delete. Stand on + and press x.";
    return false;
  }
  delete state.pluses[id];
  state.lastChange = { op: "x" };
  const row = state.lines[state.py].split("");
  row[state.px] = " ";
  state.lines[state.py] = row.join("");
  events.push({ t: "break", x: state.px, y: state.py });
  if (Object.keys(state.pluses).length === 0 && Object.keys(state.doors).length) {
    const cells = Object.keys(state.doors).map((door) => {
      const [x, y] = door.split(",").map(Number);
      return { x, y, kind: "open" };
    });
    for (const door of Object.keys(state.doors)) {
      delete state.walls[door];
      const [x, y] = door.split(",").map(Number);
      const line = state.lines[y].split("");
      line[x] = " ";
      state.lines[y] = line.join("");
    }
    state.doors = {};
    state.opened = true;
    events.push({ t: "open", cells });
    state.message = "Deleted. The door opened.";
  } else state.message = "Deleted the character under the cursor.";
  return true;
}

function moveBugs(state) {
  for (const b of state.bugs) {
    const ok = (x) =>
      x >= 0 &&
      x < state.w &&
      !solid(tileAt(state, x, b.y)) &&
      solid(tileAt(state, x, b.y + 1)) &&
      tileAt(state, x, b.y).t !== "hurt" &&
      !(x === state.px && b.y === state.py);
    let nx = b.x + b.dir;
    if (!ok(nx)) {
      b.dir *= -1;
      nx = b.x + b.dir;
    }
    if (ok(nx)) b.x = nx;
  }
}

function moveMush(state, events) {
  const m = state.mush;
  if (!m) return;
  if (!solid(tileAt(state, m.x, m.y + 1))) {
    m.y += 1;
    if (m.y >= state.h - 1) {
      state.mush = null;
      return;
    }
  } else {
    const nx = m.x + m.dir;
    if (nx < 0 || nx >= state.w || solid(tileAt(state, nx, m.y)) || !solid(tileAt(state, nx, m.y + 1))) m.dir *= -1;
    else m.x = nx;
  }
  if (m.x === state.px && m.y === state.py) {
    state.mush = null;
    if (!state.big) {
      state.big = true;
      state.score += 1000;
      events.push({ t: "grow" });
      state.message = "Vimario grew. Bump a brick from below and it breaks.";
    } else {
      state.score += 1000;
      state.message = "1000 points.";
    }
  }
}

function retile(state, x, y, prev, next) {
  const id = key(x, y);
  const spikes = state.spikeChars || [];
  if (spikes.includes(prev)) delete state.spikes[id];
  if (spikes.includes(next)) state.spikes[id] = true;
}

function rewriteSpan(state, y, a, b, dir) {
  const row = state.lines[y].split("");
  for (let x = a; x <= b; x++) {
    const ch = row[x];
    if (!/[A-Za-z]/.test(ch)) continue;
    const next = dir === "lower" ? ch.toLowerCase() : ch.toUpperCase();
    row[x] = next;
    retile(state, x, y, ch, next);
  }
  state.lines[y] = row.join("");
}

function wordSpan(line, x) {
  const word = /[A-Za-z0-9_]/;
  if (word.test(line[x] || "")) {
    let a = x;
    let b = x;
    while (a > 0 && word.test(line[a - 1])) a -= 1;
    while (b + 1 < line.length && word.test(line[b + 1])) b += 1;
    return [a, b];
  }
  let i = x + 1;
  while (i < line.length && !word.test(line[i])) {
    if (line[i] === "#") return null;
    i += 1;
  }
  if (i >= line.length) return null;
  return wordSpan(line, i);
}

function mazeCase(state, command, events) {
  const dir = command.dir === "upper" ? "upper" : "lower";
  state.lesson = dir === "lower" ? LESSON.guu : LESSON.gUw;
  const line = state.lines[state.py] || "";
  if (command.scope === "line") {
    rewriteSpan(state, state.py, 0, line.length - 1, dir);
    events.push({ t: "break", x: state.px, y: state.py });
    state.message = dir === "lower" ? "The line is quiet." : "The line is shouted.";
    return true;
  }
  const span = wordSpan(line, state.px);
  if (!span) {
    state.message = "No word to change.";
    return false;
  }
  rewriteSpan(state, state.py, span[0], span[1], dir);
  events.push({ t: "break", x: state.px, y: state.py });
  state.message = dir === "lower" ? "That word is quiet." : "That word is shouted.";
  return true;
}

function mazeMark(state, name) {
  state.marks[name] = { x: state.px, y: state.py };
  state.lesson = LESSON.m;
  state.message = `Mark ${name} is here.`;
  return true;
}

function mazeJump(state, name, events) {
  const mark = state.marks[name];
  state.lesson = LESSON["'"];
  if (!mark) {
    state.message = `No mark ${name}. Press m then ${name} first.`;
    return false;
  }
  return leapMaze(state, mark, events, LESSON["'"]);
}

function mazeDot(state, events) {
  state.lesson = LESSON["."];
  const last = state.lastChange;
  if (!last) {
    state.message = "No change to repeat. x or r, then use .";
    return false;
  }
  if (last.op === "x") return mazeX(state, events);
  if (last.op === "replace") return mazeReplace(state, last.ch, events);
  state.message = "Nothing to repeat.";
  return false;
}

function sealOf(state, command) {
  if (command.op === "dot") {
    if (state.lastChange?.op === "replace") return "replace";
    if (state.lastChange?.op === "x") return "delete";
    return "";
  }
  const named = {
    case: "case",
    move: "move",
    word: "word",
    find: "find",
    x: "delete",
    mark: "mark",
    jump: "jump",
    match: "match",
    replace: "replace",
    para: "para",
    star: "star",
    line: "line",
    goto: "goto",
    search: "search",
    searchNext: "search",
  };
  return named[command.op] || "";
}

function sealText(name) {
  const label = {
    case: "guu",
    move: "h j k or l",
    word: "w",
    find: "f",
    delete: "x",
    mark: "ma",
    jump: "'a",
    match: "%",
    replace: "r",
    para: "}",
    star: "*",
    line: "0 ^ or $",
    goto: "G",
    search: "/",
  };
  return label[name] || name;
}

function missingSeals(state, countPending) {
  const need = state.needSeals || [];
  if (!need.length) return [];
  return need.filter((name) => !state.gotSeals[name] && !(countPending && name === state.pendingSeal));
}

function lockedMotion(level, command) {
  const world = level.world || 1;
  const bigWord = command.op === "word" && "WBE".includes(command.which || "");
  if ((command.op === "mark" || command.op === "jump" || command.op === "dot") && world < 8) {
    return "m, ', and . unlock in Mark Hall.";
  }
  if (command.op === "case" && world < 7) return "guu and gUw unlock in Case Library.";
  if ((command.op === "star" || command.op === "para" || command.op === "replace") && world < 6) {
    return "r, *, and } unlock in Edit Outpost.";
  }
  if ((bigWord || command.op === "match") && world < 5) {
    return "W and % unlock in Match Marsh. W skips punctuation. % jumps to the matching bracket.";
  }
  if (world >= 4) return "";
  if (command.op === "word" && world < 2 && !level.allowWord) return "w opens on the next course. This one is h j k l.";
  if (command.op === "line" && world < 3) return "0 ^ $ unlock in Line Cave.";
  if ((command.op === "find" || command.op === "nofind") && world < 3) return "f t ; unlock in Line Cave.";
  if ((command.op === "goto" || command.op === "search" || command.op === "searchNext" || command.op === "x") && world < 4) {
    return "G, /, and x unlock in Insert Castle.";
  }
  return "";
}

function repeat(count, fn) {
  let any = false;
  for (let i = 0; i < count; i++) {
    const moved = fn();
    if (moved) any = true;
    if (!moved) break;
  }
  return any;
}

export function step(state, level, command) {
  ensureLevel(level);
  const events = [];
  if (state.dead || state.won) {
    return { changed: false, phaseClear: false, events, message: state.message, lesson: state.lesson };
  }
  state.phaseClear = false;
  const phase = level.phases[state.phaseIndex];
  let changed = false;
  const maze = state.kind === "maze";
  const locked = lockedMotion(level, command);
  state.pendingSeal = sealOf(state, command);
  if (locked) {
    state.message = locked;
    state.lesson = locked;
    return { changed: false, phaseClear: false, events, message: locked, lesson: locked };
  }

  if (command.op === "arrow") {
    state.message = "Arrow keys edit nothing. h left, j down, k up, l right.";
    state.lesson = "j is down. k is up. That never swaps.";
  } else if (command.op === "insert") {
    state.message = "Insert mode is sealed. Stay in Normal mode.";
    state.lesson = "i a o c would insert. Here they do nothing. Esc pauses.";
    events.push({ t: "insert" });
  } else if (command.op === "space") {
    state.message = "Space is not a motion.";
  } else if (command.op === "unknown" || command.op === "nofind") {
    state.message = command.op === "nofind" ? "No find to repeat yet." : `Unmapped key. :help lists motions.`;
  } else if (command.op === "undo" || command.op === "colon") {
    return { changed: false, phaseClear: false, events, message: state.message, lesson: state.lesson, passthrough: true };
  } else if (command.op === "move" && maze) {
    changed = repeat(command.count, () => {
      if (state.dead || state.phaseClear) return false;
      return mazeStep(state, command.dir, events);
    });
  } else if (command.op === "move" && command.dir === "k") {
    changed = repeat(command.count, () => {
      if (state.dead || state.phaseClear) return false;
      return tryJump(state, level, events);
    });
  } else if (command.op === "move" && command.dir === "j") {
    changed = repeat(command.count, () => {
      if (state.dead || state.phaseClear) return false;
      return tryDrop(state, level, events);
    });
  } else if (command.op === "move") {
    changed = repeat(command.count, () => {
      if (state.dead || state.phaseClear) return false;
      return tryStep(state, level, command.dir, events);
    });
  } else if (command.op === "word" && maze) {
    const target = wordTarget(state.lines, state.px, state.py, command.which, command.count);
    changed = leapMaze(state, target, events, LESSON[command.which], true);
  } else if (command.op === "word") {
    changed = courseWord(state, level, command.which, command.count, events);
  } else if (command.op === "line" && maze) {
    changed = leapMaze(state, lineTarget(state.lines, state.px, state.py, command.which), events, LESSON[command.which]);
  } else if (command.op === "line") {
    changed = courseLine(state, level, command.which, events);
  } else if (command.op === "goto" && maze) {
    const which = command.which;
    changed = leapMaze(state, gotoTarget(state.lines, state.px, state.py, which, command.line), events, LESSON[which]);
  } else if (command.op === "goto") {
    changed = courseGoto(state, level, command.which, command.line, events);
  } else if (command.op === "find" && maze) {
    const target = findTarget(state.lines, state.px, state.py, command.ch, command.dir, command.till, command.count);
    changed = leapMaze(state, target, events, command.till ? LESSON.t : LESSON.f);
  } else if (command.op === "find") {
    changed = courseFind(state, level, command.ch, command.dir, command.till, command.count, events);
  } else if (command.op === "search" || command.op === "searchNext") {
    let query = command.op === "search" ? command.query : state.lastSearch?.query;
    let dir = command.op === "search" ? command.dir : command.dir * (state.lastSearch?.dir || 1);
    if (command.op === "searchNext" && state.lastSearch) dir = command.dir === 1 ? state.lastSearch.dir : -state.lastSearch.dir;
    if (!query) state.message = "No previous search. Type /word then Enter.";
    else if (!maze) {
      state.message = "Search shines in a buffer. On a course, f finds a letter.";
      state.lesson = LESSON["/"];
    } else {
      state.lastSearch = { query, dir };
      const target = searchTarget(state.lines, state.px, state.py, query, dir, true);
      const wrapped =
        target &&
        (dir > 0
          ? target.y < state.py || (target.y === state.py && target.x <= state.px)
          : target.y > state.py || (target.y === state.py && target.x >= state.px));
      changed = leapMaze(state, target, events, LESSON["/"]);
      if (changed && wrapped) state.message = "Search hit the edge and wrapped.";
      else if (changed) state.message = `${dir > 0 ? "/" : "?"}${query}`;
      else state.message = `Pattern not found: ${query}`;
    }
  } else if (command.op === "x" && maze) {
    changed = mazeX(state, events);
  } else if (command.op === "x") {
    changed = courseX(state, events);
  } else if (command.op === "match" && maze) {
    changed = leapMaze(state, matchTarget(state.lines, state.px, state.py, command.count), events, LESSON["%"]);
  } else if (command.op === "match") {
    changed = courseMatch(state, level, command.count, events);
  } else if (command.op === "replace" && maze) {
    changed = mazeReplace(state, command.ch, events);
  } else if (command.op === "replace") {
    state.message = "r replaces the character under the cursor. That is a buffer.";
    state.lesson = LESSON.r;
  } else if (command.op === "star" && maze) {
    changed = mazeStar(state, command.count, events);
  } else if (command.op === "star") {
    state.message = "* searches for the word under the cursor. That is a buffer.";
    state.lesson = LESSON["*"];
  } else if (command.op === "para" && maze) {
    const target = paraTarget(state.lines, state.px, state.py, command.dir, command.count);
    changed = leapMaze(state, target, events, command.dir > 0 ? LESSON["}"] : LESSON["{"]);
  } else if (command.op === "para") {
    state.message = "} jumps to the next blank line. That is a buffer.";
    state.lesson = LESSON["}"];
  } else if (command.op === "case" && maze) {
    changed = mazeCase(state, command, events);
  } else if (command.op === "case") {
    state.message = "guu changes the letters in a buffer.";
    state.lesson = LESSON.guu;
  } else if (command.op === "mark" && maze) {
    changed = mazeMark(state, command.name);
  } else if (command.op === "mark") {
    state.message = "ma remembers a spot in a buffer.";
    state.lesson = LESSON.m;
  } else if (command.op === "jump" && maze) {
    changed = mazeJump(state, command.name, events);
  } else if (command.op === "jump") {
    state.message = "'a jumps back to a mark in a buffer.";
    state.lesson = LESSON["'"];
  } else if (command.op === "dot" && maze) {
    changed = mazeDot(state, events);
  } else if (command.op === "dot") {
    state.message = ". repeats x or r in a buffer.";
    state.lesson = LESSON["."];
  }

  if (changed && state.pendingSeal) state.gotSeals[state.pendingSeal] = true;
  if (!state.dead && !state.phaseClear && changed && !maze) moveMush(state, events);
  state.hint = maze ? phase.intro || "" : nearbySign(state, phase) || phase.intro || "";
  return {
    changed,
    phaseClear: state.phaseClear,
    events,
    message: state.message,
    lesson: state.lesson,
    hint: state.hint,
  };
}

export function debugView(state) {
  if (state.kind === "maze") {
    return state.lines
      .map((row, y) =>
        [...row]
          .map((ch, x) => {
            if (x === state.px && y === state.py) return "@";
            if (state.pits[key(x, y)]) return "^";
            return ch;
          })
          .join(""),
      )
      .join("\n");
  }
  const rows = [];
  for (let y = 0; y < state.h; y++) {
    let line = "";
    for (let x = 0; x < state.w; x++) {
      if (x === state.px && y === state.py) {
        line += "@";
        continue;
      }
      if (bugAt(state, x, y)) {
        line += "G";
        continue;
      }
      const tile = tileAt(state, x, y);
      const coin = state.coinsArr.some((c) => !c.got && c.x === x && c.y === y);
      if (coin) line += "C";
      else if (tile.t === "solid") line += "#";
      else if (tile.t === "platform") line += "=";
      else if (tile.t === "brick") line += "B";
      else if (tile.t === "question") line += state.usedQ[key(x, y)] ? "b" : "?";
      else if (tile.t === "spike") line += "^";
      else if (tile.t === "pipe") line += "P";
      else if (tile.t === "flag") line += "F";
      else if (tile.t === "hurt") line += "K";
      else if (tile.t === "letter") line += tile.ch;
      else if (tile.t === "sign") line += "S";
      else line += ".";
    }
    rows.push(line);
  }
  return rows.join("\n");
}
