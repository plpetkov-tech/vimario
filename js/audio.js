// Tiny original chiptune. Melodies are not from any Nintendo game.

function mtof(m) {
  return 440 * 2 ** ((m - 69) / 12);
}

const SONGS = {
  title: [60, 64, 67, 72, 67, 64, 69, 65, 62, 67, 64, 60],
  overworld: [60, 64, 67, 72, 76, 72, 67, 64, 62, 65, 69, 65, 64, 60, 64, 67],
  night: [48, 51, 55, 58, 55, 51, 53, 50, 48, 55, 51, 48],
  maze: [45, 48, 51, 48, 46, 49, 53, 49, 45, 51, 48, 45],
  castle: [42, 46, 49, 54, 49, 46, 45, 49, 42, 49, 46, 42],
  map: [67, 72, 76, 79, 76, 72, 74, 79, 76, 72, 67, 64],
  clear: [60, 64, 67, 72, 76, 79, 84],
};

export function createAudio() {
  let ctx = null;
  let muted = false;
  let current = "";
  let timer = 0;
  let stepN = 0;
  let alive = false;

  function ac() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, delay = 0, slide = 0) {
    if (muted || !freq) return;
    const a = ac();
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, gain) {
    if (muted) return;
    const a = ac();
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource();
    const g = a.createGain();
    src.buffer = buf;
    g.gain.value = gain;
    src.connect(g);
    g.connect(a.destination);
    src.start();
  }

  function play(name) {
    if (muted) return;
    ac();
    if (name === "jump") tone(420, 0.12, "square", 0.05, 0, 280);
    else if (name === "coin") {
      tone(988, 0.08, "square", 0.05);
      tone(1319, 0.12, "square", 0.05, 0.07);
    } else if (name === "stomp") {
      noise(0.08, 0.08);
      tone(180, 0.1, "square", 0.06, 0, -80);
    } else if (name === "bump") noise(0.06, 0.07);
    else if (name === "break") noise(0.12, 0.09);
    else if (name === "die") {
      tone(520, 0.14, "square", 0.06, 0, -200);
      tone(330, 0.2, "square", 0.06, 0.12, -180);
      tone(160, 0.28, "triangle", 0.07, 0.24, -80);
    } else if (name === "flag") {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, "square", 0.05, i * 0.09));
    } else if (name === "pipe") tone(240, 0.18, "square", 0.05, 0, -100);
    else if (name === "grow") {
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.08, "square", 0.05, i * 0.06));
    } else if (name === "hit") {
      tone(200, 0.1, "sawtooth", 0.04);
      tone(90, 0.2, "square", 0.05, 0.05);
    } else if (name === "error") tone(110, 0.08, "square", 0.04);
    else if (name === "key") tone(660, 0.03, "square", 0.02);
  }

  function tick() {
    if (!alive || muted) return;
    const notes = SONGS[current];
    if (!notes) return;
    const midi = notes[stepN % notes.length];
    const dur = current === "clear" ? 0.14 : 0.16;
    tone(mtof(midi), dur * 0.85, current === "maze" || current === "castle" ? "triangle" : "square", 0.018);
    if (current === "overworld" || current === "map" || current === "title") {
      const bass = [36, 43, 41, 38][Math.floor(stepN / 4) % 4];
      if (stepN % 2 === 0) tone(mtof(bass), 0.18, "triangle", 0.02);
    }
    stepN += 1;
    timer = setTimeout(tick, dur * 1000);
  }

  function song(id) {
    if (id === current && alive) return;
    clearTimeout(timer);
    current = id;
    stepN = 0;
    alive = Boolean(SONGS[id]);
    if (alive && !muted) tick();
  }

  function stop() {
    clearTimeout(timer);
    alive = false;
    current = "";
  }

  function setMuted(v) {
    muted = v;
    if (muted) clearTimeout(timer);
    else if (current) {
      alive = true;
      tick();
    }
  }

  return {
    play,
    song,
    stop,
    unlock: () => ac(),
    setMuted,
    get muted() {
      return muted;
    },
  };
}
