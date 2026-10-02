import { createParser, feed, findTarget, lineTarget, matchTarget, paraTarget, starWord, wordTarget } from "../js/vim.js";
import { advancePhase, createGame, debugView, step } from "../js/logic.js";
import { LEVELS } from "../js/levels.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  }
}

function play(level, keys) {
  const state = createGame(level);
  const parser = createParser();
  let strokes = 0;
  const trace = [];
  for (const key of keys) {
    const fed = feed(parser, key);
    if (fed.type !== "command") continue;
    strokes += fed.keystrokes;
    state.keystrokes = strokes;
    const before = `p${state.phaseIndex} ${state.px},${state.py}`;
    const result = step(state, level, fed.command);
    trace.push({
      key,
      before,
      after: `${state.px},${state.py}`,
      msg: state.message,
      dead: state.dead,
      clear: result.phaseClear,
    });
    if (state.dead) return { ok: false, state, strokes, trace, reason: "dead " + state.message };
    if (result.phaseClear) {
      const won = advancePhase(state, level);
      if (won) return { ok: true, state, strokes, trace, reason: "won" };
    }
  }
  return { ok: !!state.won, state, strokes, trace, reason: state.won ? "won" : "stuck" };
}

function keysOf(spec) {
  return [...spec].flatMap((ch) => (ch === "\n" ? ["Enter"] : [ch]));
}

// --- vim motions ---
{
  const lines = ["hello world", "jugs. the"];
  assert(wordTarget(lines, 0, 0, "w").x === 6, "w from h of hello");
  assert(wordTarget(lines, 4, 0, "w").x === 6, "w from end of hello");
  assert(wordTarget(lines, 0, 1, "w").x === 4, "w lands on punctuation");
  assert(wordTarget(lines, 4, 1, "w").x === 6, "w from punct to next word");
  assert(wordTarget(lines, 0, 0, "e").x === 4, "e end of hello");
  assert(wordTarget(lines, 6, 0, "b").x === 0, "b previous word");
  assert(wordTarget(lines, 8, 0, "b").x === 6, "b start of current word");
  const lead = ["    hello"];
  assert(lineTarget(lead, 0, 0, "^").x === 4, "^ skips blanks");
  assert(lineTarget(lead, 4, 0, "0").x === 0, "0 is column 0");
  assert(lineTarget(lead, 0, 0, "$").x === 8, "$ end");
  const findLine = ["go    mQ   mQ ~"];
  assert(findTarget(findLine, 0, 0, "Q", 1, true).x === 6, "tQ lands before Q");
  assert(findTarget(findLine, 6, 0, "Q", 1, true).x === 11, "second tQ");
  assert(findTarget(findLine, 11, 0, "~", 1, false).x === 14, "f~");
  const wrapped = ["hello", "world"];
  const next = wordTarget(wrapped, 4, 0, "w");
  assert(next && next.y === 1 && next.x === 0, "w crosses lines");
  const comma = ["hello, world"];
  assert(wordTarget(comma, 0, 0, "w").x === 5, "w stops on the comma");
  assert(wordTarget(comma, 0, 0, "W").x === 7, "W skips the comma");
  const nest = ["((Q)Q)~"];
  assert(matchTarget(nest, 0, 0).x === 5, "% outer paren");
  assert(matchTarget(nest, 1, 0).x === 3, "% inner paren");
  const page = [" The QQ fox", "           ", "home ~"];
  assert(paraTarget(page, 0, 0, 1).y === 1, "} blank line");
  assert(paraTarget(page, 0, 1, 1).y === 2, "} last line");
  assert(starWord(["door"], 1, 0) === "door", "word under cursor");
}

// --- parser ---
{
  const p = createParser();
  assert(feed(p, "4").type === "pending", "count pending");
  const cmd = feed(p, "l");
  assert(cmd.command.op === "move" && cmd.command.count === 4 && cmd.keystrokes === 2, "4l");
  const p2 = createParser();
  feed(p2, "f");
  const found = feed(p2, "c");
  assert(found.command.op === "find" && found.command.ch === "c" && found.command.till === false, "fc");
  const again = feed(p2, ";");
  assert(again.command.ch === "c" && again.command.repeat, "; repeats f");
  const p3 = createParser();
  for (const ch of "princess") {
    if (ch === "p") feed(p3, "/");
    feed(p3, ch);
  }
  const search = feed(p3, "Enter");
  assert(search.command.op === "search" && search.command.query === "princess", "/princess");
  const p4 = createParser();
  feed(p4, "g");
  const gg = feed(p4, "g");
  assert(gg.command.which === "gg" && gg.command.line == null, "gg");
  const p5 = createParser();
  feed(p5, "4");
  const g4 = feed(p5, "G");
  assert(g4.command.which === "G" && g4.command.line === 4, "4G");
  const arrow = feed(createParser(), "ArrowLeft");
  assert(arrow.command.op === "arrow", "arrows are not motions");
  const big = feed(createParser(), "W");
  assert(big.command.op === "word" && big.command.which === "W", "W");
  const pct = feed(createParser(), "%");
  assert(pct.command.op === "match" && pct.command.count === 1, "%");
  const star = feed(createParser(), "*");
  assert(star.command.op === "star", "*");
  const jump = feed(createParser(), "}");
  assert(jump.command.op === "para" && jump.command.dir === 1, "}");
  const rp = createParser();
  assert(feed(rp, "r").type === "pending", "r waits");
  const wrote = feed(rp, "~");
  assert(wrote.command.op === "replace" && wrote.command.ch === "~" && wrote.keystrokes === 2, "r~");
}

const hills = "e2we2we3we";
const counts = "e3we2we3we";
const words = "w2w2ww2w2ww2ww2w";

const SOLUTIONS = {
  "1-1": "2lklk4l",
  "1-2": "6lwe",
  "1-3": "wjj4lj",
  "1-4": "wwwwbbww",
  "2-1": hills + counts,
  "2-2": words,
  "2-3": "webj",
  "2-4": "beww",
  "3-1": "^$j^$j^$j^$",
  "3-2": "6jtQ;;;;f~",
  "3-3": "efcefaefte",
  "3-4": "tQ,0",
  "4-1": "/princess\nnnf~fcfaft",
  "4-2": "3lx8l",
  "4-3": "efcefaeFseft",
  "5-1": "wWWWWw",
  "5-2": "%e%e%e" + "%l%l",
  "5-3": "b2be3be" + "b2b2bb",
  "6-1": "2wr~",
  "6-2": "w*w" + "w**w",
  "6-3": "}}}2ww",
  "7-1": "guuwjl",
  "7-2": "guuw0jguuww",
  "7-3": "gUwwjl",
  "8-1": "maljjlx'af~",
  "8-2": "wxw.w.w",
  "8-3": "maljjlxw.'af~",
  "9-1": "guuwj" + "guub0",
  "9-2": "%l" + "%l%l",
  "9-3": "maljjguuwwx'af~",
};

const MASH = {
  "1-1": "l",
  "1-2": "l",
  "1-3": "l",
  "1-4": "h",
  "2-1": "w",
  "2-2": "w",
  "2-3": "w",
  "2-4": "l",
  "3-1": "l",
  "3-2": "l",
  "3-3": "w",
  "3-4": "l",
  "4-1": "w",
  "4-2": "w",
  "4-3": "w",
  "5-1": "w",
  "5-2": "w",
  "5-3": "b",
  "6-1": "w",
  "6-2": "w",
  "6-3": "w",
  "7-1": "w",
  "7-2": "w",
  "7-3": "w",
  "8-1": "l",
  "8-2": "w",
  "8-3": "w",
  "9-1": "w",
  "9-2": "w",
  "9-3": "l",
};

{
  const early = createGame(LEVELS[0]);
  const blocked = step(early, LEVELS[0], { op: "word", which: "W", count: 1 });
  assert(blocked.message.includes("Match Marsh"), "W stays locked until world 5");
  const castle = LEVELS.find((level) => level.id === "4-3");
  const gate = step(createGame(castle), castle, { op: "replace", ch: "~" });
  assert(gate.message.includes("Edit Outpost"), "r stays locked until world 6");
}

for (const level of LEVELS) {
  const spec = SOLUTIONS[level.id];
  const result = play(level, keysOf(spec));
  if (!result.ok) {
    failed += 1;
    console.error("\nFAIL", level.id, result.reason, "strokes", result.strokes, "coins", result.state.coins + "/" + level.totalCoins);
    console.error(result.trace.map((t) => `${t.key} ${t.before} -> ${t.after} ${t.msg || ""} ${t.dead ? "DEAD" : ""} ${t.clear ? "CLEAR" : ""}`).join("\n"));
    console.error(debugView(result.state));
  } else {
    const stars = result.state.coins >= level.totalCoins && result.state.deaths === 0 && result.strokes <= level.par;
    console.log(
      "OK",
      level.id,
      "keys",
      result.strokes,
      "par",
      level.par,
      "coins",
      result.state.coins + "/" + level.totalCoins,
      stars ? "3star-path" : "clear-only",
    );
    if (result.strokes > level.par) {
      failed += 1;
      console.error("  over par");
    }
    if (result.state.coins < level.totalCoins) {
      failed += 1;
      console.error("  missed coins");
    }
    }
  const mash = play(level, keysOf(MASH[level.id].repeat(40)));
  if (mash.ok) {
    failed += 1;
    console.error("MASH WIN", level.id, "with", MASH[level.id]);
  }
}

{
  const leap = LEVELS.find((level) => level.id === "1-2");
  const skipped = play(leap, keysOf("we"));
  assert(skipped.ok && skipped.state.coins === 0, "1-2 w e finishes without the coin");
  const door = LEVELS.find((level) => level.id === "1-3");
  const straight = play(door, keysOf("ww"));
  assert(straight.ok && straight.state.coins === 0, "1-3 ww finishes without the gem");
  const king = LEVELS.find((level) => level.id === "1-4");
  const mashKing = play(king, keysOf("w".repeat(6)));
  assert(!mashKing.ok, "1-4 six w does not clear the king");
  const shorts = [
    ["2-1", "2w2w3we3w2w3we", 2, "2-1 counted hops finish with two coins"],
    ["2-3", "w2w", 0, "2-3 w2w finishes without the gem"],
    ["2-4", "w", 0, "2-4 w finishes without the coin"],
    ["3-1", "$j$j$j$", 4, "3-1 line ends finish without the first letters"],
    ["3-2", "6jf~", 0, "3-2 f~ finishes without the marks"],
    ["3-3", "fcfafte", 0, "3-3 finds finish without the coins"],
    ["3-4", "0", 0, "3-4 column zero finishes without the marks"],
    ["4-3", "fcfaFsft", 0, "4-3 the feint finishes without the coins"],
    ["9-1", "2w0", 2, "9-1 leap and column zero finish without the capitals"],
    ["9-3", "maljjf+x'af~", 0, "9-3 find skips the burning letter"],
  ];
  for (const [id, spec, coins, msg] of shorts) {
    const level = LEVELS.find((item) => item.id === id);
    const result = play(level, keysOf(spec));
    assert(result.ok && result.state.coins === coins, `${msg} (${result.reason} coins ${result.state.coins})`);
  }
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall playthroughs passed");
