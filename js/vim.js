// Vim command parser and pure text motions.
// Motions match normal-mode vim: words, finds, and line jumps.

export function createParser() {
  return {
    mode: "normal",
    count: "",
    pending: "",
    cmd: "",
    searchDir: 1,
    lastFind: null,
    lastSearch: null,
    typed: "",
  };
}

export function parserDisplay(p) {
  if (p.mode === "replace") return "r";
  if (p.mode === "mark") return "m";
  if (p.mode === "jump") return "'";
  if (p.mode === "case") return "g" + (p.pending || "");
  if (p.mode === "search") return (p.searchDir > 0 ? "/" : "?") + p.cmd;
  if (p.mode === "command") return ":" + p.cmd;
  if (p.mode === "find") return p.count + p.pending;
  if (p.mode === "g") return p.count + "g";
  if (p.count) return p.count;
  return "";
}

function reset(p) {
  p.mode = "normal";
  p.count = "";
  p.pending = "";
  p.cmd = "";
  p.typed = "";
}

function pending(p) {
  return { type: "pending", display: parserDisplay(p) };
}

function finish(p, command) {
  const keystrokes = p.typed.length;
  const display = parserDisplay(p);
  reset(p);
  return { type: "command", command, keystrokes, display };
}

function countOf(p) {
  if (!p.count) return null;
  return Math.min(99, parseInt(p.count, 10));
}

export function feed(p, key) {
  if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta" || key === "CapsLock") {
    return pending(p);
  }
  if (key === "Escape") {
    const idle = p.mode === "normal" && p.count === "" && p.typed === "";
    const keystrokes = p.typed.length;
    reset(p);
    if (idle) return { type: "pause", keystrokes: 0, display: "" };
    return { type: "cancel", keystrokes, display: "" };
  }
  if (p.mode === "search") return feedSearch(p, key);
  if (p.mode === "command") return feedCommand(p, key);
  if (p.mode === "find") return feedFind(p, key);
  if (p.mode === "replace") return feedReplace(p, key);
  if (p.mode === "g") return feedG(p, key);
  if (p.mode === "case") return feedCase(p, key);
  if (p.mode === "mark") return feedMark(p, key);
  if (p.mode === "jump") return feedJump(p, key);
  return feedNormal(p, key);
}

function feedNormal(p, key) {
  p.typed += key.length === 1 ? key : key[0];
  if (key.startsWith("Arrow")) return finish(p, { op: "arrow", key });
  if (/^[1-9]$/.test(key) || (key === "0" && p.count)) {
    p.count += key;
    return pending(p);
  }
  if (key === "g") {
    p.mode = "g";
    return pending(p);
  }
  if ("fFtT".includes(key)) {
    p.mode = "find";
    p.pending = key;
    return pending(p);
  }
  if (key === "/" || key === "?") {
    p.mode = "search";
    p.searchDir = key === "/" ? 1 : -1;
    p.cmd = "";
    return pending(p);
  }
  if (key === ":") {
    p.mode = "command";
    p.cmd = "";
    return pending(p);
  }
  const count = countOf(p);
  const n = count || 1;
  if ("hjkl".includes(key)) return finish(p, { op: "move", dir: key, count: n, counted: count != null });
  if (key === "Backspace") return finish(p, { op: "move", dir: "h", count: n, counted: count != null });
  if ("wbeWBE".includes(key)) return finish(p, { op: "word", which: key, count: n });
  if (key === "%") return finish(p, { op: "match", count: n });
  if (key === "*") return finish(p, { op: "star", count: n });
  if (key === "{" || key === "}") return finish(p, { op: "para", dir: key === "}" ? 1 : -1, count: n });
  if (key === "r") {
    p.mode = "replace";
    return pending(p);
  }
  if (key === "0" || key === "^" || key === "$") return finish(p, { op: "line", which: key });
  if (key === "G") return finish(p, { op: "goto", which: "G", line: count });
  if (key === "x") return finish(p, { op: "x", count: n });
  if (key === ";" || key === ",") {
    if (!p.lastFind) return finish(p, { op: "nofind" });
    const f = p.lastFind;
    const dir = key === "," ? -f.dir : f.dir;
    return finish(p, { op: "find", cmd: f.cmd, ch: f.ch, dir, till: f.till, count: n, repeat: true });
  }
  if (key === "n" || key === "N") return finish(p, { op: "searchNext", dir: key === "n" ? 1 : -1 });
  if (key === "u") return finish(p, { op: "undo" });
  if (key === ".") return finish(p, { op: "dot" });
  if (key === "m") {
    p.mode = "mark";
    return pending(p);
  }
  if (key === "'") {
    p.mode = "jump";
    return pending(p);
  }
  if ("iaoAOIVVcCsSdDyYpP".includes(key)) return finish(p, { op: "insert", key });
  if (key === " ") return finish(p, { op: "space" });
  return finish(p, { op: "unknown", key });
}

function feedG(p, key) {
  p.typed += key.length === 1 ? key : "?";
  if (key === "g") {
    const count = countOf(p);
    return finish(p, { op: "goto", which: "gg", line: count });
  }
  if (key === "u" || key === "U") {
    p.mode = "case";
    p.pending = key;
    return pending(p);
  }
  return finish(p, { op: "unknown", key });
}

function feedCase(p, key) {
  p.typed += key.length === 1 ? key : "?";
  const upper = p.pending === "U";
  if ((key === "u" && !upper) || (key === "U" && upper)) return finish(p, { op: "case", dir: upper ? "upper" : "lower", scope: "line" });
  if (key === "w") return finish(p, { op: "case", dir: upper ? "upper" : "lower", scope: "word" });
  return finish(p, { op: "unknown", key });
}

function feedMark(p, key) {
  p.typed += key.length === 1 ? key : "?";
  if (/^[a-z]$/.test(key)) return finish(p, { op: "mark", name: key });
  return finish(p, { op: "unknown", key });
}

function feedJump(p, key) {
  p.typed += key.length === 1 ? key : "?";
  if (/^[a-z]$/.test(key)) return finish(p, { op: "jump", name: key });
  return finish(p, { op: "unknown", key });
}

function feedReplace(p, key) {
  if (key.length !== 1) {
    const keystrokes = p.typed.length;
    reset(p);
    return { type: "cancel", keystrokes, display: "" };
  }
  p.typed += key;
  return finish(p, { op: "replace", ch: key });
}

function feedFind(p, key) {
  if (key.length !== 1) {
    const keystrokes = p.typed.length;
    reset(p);
    return { type: "cancel", keystrokes, display: "" };
  }
  p.typed += key;
  const count = countOf(p) || 1;
  const cmd = p.pending;
  const dir = cmd === "F" || cmd === "T" ? -1 : 1;
  const till = cmd === "t" || cmd === "T";
  p.lastFind = { cmd, ch: key, dir, till };
  return finish(p, { op: "find", cmd, ch: key, dir, till, count });
}

function feedSearch(p, key) {
  if (key === "Backspace") {
    p.cmd = p.cmd.slice(0, -1);
    p.typed = p.typed.slice(0, -1);
    return pending(p);
  }
  if (key === "Enter") {
    p.typed += "\n";
    let query = p.cmd;
    let dir = p.searchDir;
    if (!query && p.lastSearch) {
      query = p.lastSearch.query;
      dir = p.lastSearch.dir;
    }
    if (query) p.lastSearch = { query, dir };
    return finish(p, { op: "search", query, dir });
  }
  if (key.length === 1) {
    p.cmd += key;
    p.typed += key;
    return pending(p);
  }
  return pending(p);
}

function feedCommand(p, key) {
  if (key === "Backspace") {
    p.cmd = p.cmd.slice(0, -1);
    p.typed = p.typed.slice(0, -1);
    return pending(p);
  }
  if (key === "Enter") {
    p.typed += "\n";
    const raw = p.cmd.trim().toLowerCase();
    const aliases = { h: "help", help: "help", q: "quit", quit: "quit", retry: "retry", map: "map", mute: "mute", wq: "wq", hint: "hint" };
    const name = aliases[raw];
    if (!name) return finish(p, { op: "colon", name: "bad", raw });
    return finish(p, { op: "colon", name, raw });
  }
  if (key.length === 1) {
    p.cmd += key;
    p.typed += key;
    return pending(p);
  }
  return pending(p);
}

function cls(ch, big) {
  if (ch == null) return "wall";
  if (ch === "\n" || ch === "#") return "break";
  if (ch === " " || ch === "\t") return "blank";
  if (big) return "word";
  if (/[A-Za-z0-9_]/.test(ch)) return "word";
  return "punct";
}

// Flat reading order with a newline break between rows so words don't merge.
function flatten(lines, big) {
  const cells = [];
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < lines[y].length; x++) {
      const ch = lines[y][x];
      cells.push({ x, y, ch, k: ch === "#" ? "break" : cls(ch, big) });
    }
    cells.push({ x: -1, y, ch: "\n", k: "break" });
  }
  return cells;
}

function indexOf(cells, x, y) {
  return cells.findIndex((c) => c.x === x && c.y === y && c.ch !== "\n");
}

function moveW(cells, i) {
  const start = cells[i];
  if (!start) return null;
  let j = i + 1;
  if (j >= cells.length) return null;
  if (start.k === "word" || start.k === "punct") {
    while (j < cells.length && cells[j].k === start.k) j++;
  }
  while (j < cells.length && (cells[j].k === "blank" || cells[j].k === "break")) j++;
  if (j >= cells.length) return null;
  return cells[j];
}

function moveE(cells, i) {
  let j = i + 1;
  if (j >= cells.length) return null;
  while (j < cells.length && (cells[j].k === "blank" || cells[j].k === "break")) j++;
  if (j >= cells.length) return null;
  const k = cells[j].k;
  while (j + 1 < cells.length && cells[j + 1].k === k) j++;
  return cells[j];
}

function moveB(cells, i) {
  let j = i - 1;
  if (j < 0) return null;
  while (j >= 0 && (cells[j].k === "blank" || cells[j].k === "break")) j--;
  if (j < 0) return null;
  const k = cells[j].k;
  while (j - 1 >= 0 && cells[j - 1].k === k) j--;
  return cells[j];
}

function hop(lines, x, y, which) {
  const big = which === "W" || which === "B" || which === "E";
  const small = big ? which.toLowerCase() : which;
  const cells = flatten(lines, big);
  let i = indexOf(cells, x, y);
  if (i < 0) return null;
  const fn = small === "w" ? moveW : small === "e" ? moveE : moveB;
  const hit = fn(cells, i);
  if (!hit || hit.x < 0) return null;
  return { x: hit.x, y: hit.y };
}

export function wordTarget(lines, x, y, which, count = 1) {
  let cx = x;
  let cy = y;
  for (let n = 0; n < count; n++) {
    const hit = hop(lines, cx, cy, which);
    if (!hit) return n === 0 ? null : { x: cx, y: cy, partial: true };
    cx = hit.x;
    cy = hit.y;
  }
  return { x: cx, y: cy };
}

const OPEN = { "(": ")", "[": "]", "{": "}" };
const CLOSE = { ")": "(", "]": "[", "}": "{" };

function stepCell(lines, x, y, dir) {
  if (dir > 0) {
    if (x + 1 < lines[y].length) return { x: x + 1, y };
    if (y + 1 < lines.length) return { x: 0, y: y + 1 };
    return null;
  }
  if (x > 0) return { x: x - 1, y };
  if (y > 0) return { x: lines[y - 1].length - 1, y: y - 1 };
  return null;
}

export function matchTarget(lines, x, y, count = 1) {
  let cx = x;
  let cy = y;
  for (let n = 0; n < count; n++) {
    const hit = matchOnce(lines, cx, cy);
    if (!hit) return n === 0 ? null : { x: cx, y: cy };
    cx = hit.x;
    cy = hit.y;
  }
  return { x: cx, y: cy };
}

function matchOnce(lines, x, y) {
  let sx = x;
  let sy = y;
  let ch = lines[sy]?.[sx];
  if (!OPEN[ch] && !CLOSE[ch]) {
    let found = false;
    for (let i = x + 1; i < lines[y].length; i++) {
      if (OPEN[lines[y][i]] || CLOSE[lines[y][i]]) {
        sx = i;
        ch = lines[y][i];
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  const forward = Boolean(OPEN[ch]);
  const mate = forward ? OPEN[ch] : CLOSE[ch];
  let depth = 0;
  let cx = sx;
  let cy = sy;
  for (let n = 0; n < 5000; n++) {
    const next = stepCell(lines, cx, cy, forward ? 1 : -1);
    if (!next) return null;
    cx = next.x;
    cy = next.y;
    const cur = lines[cy][cx];
    if (cur === "#") continue;
    if (cur === ch) depth += 1;
    else if (cur === mate) {
      if (depth === 0) return { x: cx, y: cy };
      depth -= 1;
    }
  }
  return null;
}

export function paraTarget(lines, x, y, dir, count = 1) {
  const blank = (line) => [...line].every((ch) => ch === " " || ch === "\t" || ch === "#");
  let cy = y;
  for (let n = 0; n < count; n++) {
    let y2 = cy + dir;
    let found = null;
    while (y2 >= 0 && y2 < lines.length) {
      if (blank(lines[y2])) {
        found = y2;
        break;
      }
      y2 += dir;
    }
    if (found == null) {
      found = dir > 0 ? lines.length - 1 : 0;
      if (found === cy) return n === 0 ? null : { x: 0, y: cy };
    }
    cy = found;
  }
  let lx = 0;
  while (lx < lines[cy].length && lines[cy][lx] === "#") lx += 1;
  if (lx >= lines[cy].length) lx = 0;
  return { x: lx, y: cy };
}

export function starWord(lines, x, y) {
  const line = lines[y] || "";
  if (!/[A-Za-z0-9_]/.test(line[x] || "")) return null;
  let a = x;
  let b = x;
  while (a > 0 && /[A-Za-z0-9_]/.test(line[a - 1])) a -= 1;
  while (b + 1 < line.length && /[A-Za-z0-9_]/.test(line[b + 1])) b += 1;
  return line.slice(a, b + 1);
}

export function lineTarget(lines, x, y, which) {
  const line = lines[y];
  if (!line) return null;
  if (which === "0") return { x: 0, y };
  if (which === "$") return { x: line.length - 1, y };
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
  if (i >= line.length) i = 0;
  return { x: i, y };
}

export function gotoTarget(lines, x, y, which, lineNum) {
  let y2;
  if (which === "gg") y2 = lineNum == null ? 0 : lineNum - 1;
  else y2 = lineNum == null ? lines.length - 1 : lineNum - 1;
  y2 = Math.max(0, Math.min(lines.length - 1, y2));
  const line = lines[y2];
  const x2 = Math.max(0, Math.min(line.length - 1, x));
  return { x: x2, y: y2 };
}

export function findTarget(lines, x, y, ch, dir, till, count = 1) {
  const line = lines[y];
  if (!line) return null;
  let cx = x;
  for (let n = 0; n < count; n++) {
    let hit = -1;
    const step = dir > 0 ? 1 : -1;
    for (let i = cx + step; i >= 0 && i < line.length; i += step) {
      if (line[i] === "#") break;
      if (line[i] !== ch) continue;
      // t/T must actually move. An adjacent match would land on the cursor.
      if (till && i - dir === cx) continue;
      hit = i;
      break;
    }
    if (hit < 0) return null;
    cx = till ? hit - dir : hit;
  }
  return { x: cx, y };
}

export function searchTarget(lines, x, y, query, dir, wrap = true) {
  if (!query) return null;
  const cells = [];
  for (let yy = 0; yy < lines.length; yy++) {
    for (let xx = 0; xx < lines[yy].length; xx++) {
      if (lines[yy][xx] === "#") continue;
      cells.push({ x: xx, y: yy, ch: lines[yy][xx] });
    }
    cells.push({ nl: true, ch: "\n" });
  }
  const text = cells.map((c) => c.ch).join("");
  const map = [];
  for (let i = 0; i < cells.length; i++) if (!cells[i].nl) map.push(i);
  // cursor index in text
  let cursor = 0;
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i].nl && cells[i].x === x && cells[i].y === y) {
      cursor = i;
      break;
    }
  }
  const tryFrom = (from, to) => {
    const slice = text.slice(from, to);
    const rel = dir > 0 ? slice.indexOf(query) : slice.lastIndexOf(query);
    if (rel < 0) return null;
    const at = from + rel;
    // land on the first character of the match that is a real cell
    let i = at;
    while (i < cells.length && cells[i].nl) i++;
    if (i >= cells.length || cells[i].nl) return null;
    return { x: cells[i].x, y: cells[i].y };
  };
  if (dir > 0) {
    const hit = tryFrom(cursor + 1, text.length);
    if (hit) return hit;
    if (wrap) return tryFrom(0, cursor + 1);
  } else {
    const hit = tryFrom(0, cursor);
    if (hit) return hit;
    if (wrap) return tryFrom(cursor, text.length);
  }
  return null;
}

export function crossesWall(lines, x, y, tx, ty) {
  if (y !== ty) {
    // Vertical motions only care about the column they travel.
    if (x !== tx) return false;
    const step = ty > y ? 1 : -1;
    for (let row = y + step; step > 0 ? row <= ty : row >= ty; row += step) {
      if (lines[row][x] === "#") return true;
    }
    return false;
  }
  const a = Math.min(x, tx);
  const b = Math.max(x, tx);
  for (let i = a + 1; i < b; i++) if (lines[y][i] === "#") return true;
  return false;
}
