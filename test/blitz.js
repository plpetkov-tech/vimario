import { createParser, feed } from "../js/vim.js";
import { createGame, step } from "../js/logic.js";
import {
  BEATS,
  applyRun,
  beatIdAt,
  buildLevel,
  cardIds,
  emptyFuse,
  fuseMs,
  judge,
  pointsFor,
  prevDay,
  rankFor,
} from "../js/blitz.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  }
}

function keysOf(spec) {
  return [...spec].flatMap((ch) => (ch === "\n" ? ["Enter"] : [ch]));
}

function play(beat, spec) {
  const level = buildLevel(beat);
  const state = createGame(level);
  const parser = createParser();
  let result = { phaseClear: false };
  for (const key of keysOf(spec)) {
    const fed = feed(parser, key);
    if (fed.type !== "command") continue;
    result = step(state, level, fed.command);
  }
  return judge(beat, state, result);
}

for (const beat of Object.values(BEATS)) {
  assert(play(beat, beat.hit) === "pass", beat.id + " hit " + beat.hit);
  assert(play(beat, beat.miss) === "miss", beat.id + " miss " + beat.miss);
}

const today = cardIds("2026-10-02");
const again = cardIds("2026-10-02");
const tomorrow = cardIds("2026-10-03");
assert(today.length === 12, "card is 12");
assert(today.join() === again.join(), "same day, same card");
assert(today.join() !== tomorrow.join(), "next day is a new card");
assert(new Set(today.slice(0, 3)).size === 3, "easy band");
assert(today.slice(0, 3).every((id) => ["step", "end", "till"].includes(id)), "opens easy");
assert(today.slice(3, 7).every((id) => ["count", "comma", "back", "caret"].includes(id)), "middle band");
assert(today.slice(7).every((id) => ["match", "star", "para", "skip", "write"].includes(id)), "hard band");
const overtime = [12, 13, 14, 15, 16].map((index) => beatIdAt("2026-10-02", index));
assert(overtime.every((id) => ["match", "star", "para", "skip", "write"].includes(id)), "overtime stays hard");

assert(fuseMs(0) > fuseMs(5) && fuseMs(5) > fuseMs(11), "fuse shrinks");
assert(fuseMs(11) > fuseMs(20) && fuseMs(20) === fuseMs(40), "fuse floors");
assert(pointsFor(11, fuseMs(11), fuseMs(11)) > pointsFor(10, fuseMs(10), fuseMs(10)), "card clear pays");

let record = applyRun(emptyFuse(), "2026-10-01", 100);
assert(record.save.streak === 1 && record.freshBest, "first day");
record = applyRun(record.save, "2026-10-01", 50);
assert(record.save.streak === 1 && record.save.best === 100 && !record.freshBest, "same day keeps streak");
record = applyRun(record.save, "2026-10-02", 200);
assert(record.save.streak === 2 && record.save.best === 200, "next day continues");
record = applyRun(record.save, "2026-10-04", 10);
assert(record.save.streak === 1 && record.save.best === 200, "a skipped day starts over");
assert(prevDay("2026-10-01") === "2026-09-30", "month boundary");
assert(rankFor(0) === "CURSOR" && rankFor(1600) === "CARD" && rankFor(3000) === "NORMAL", "ranks");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("fuse ok", today.join(" "));
