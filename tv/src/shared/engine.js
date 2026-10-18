// GENERATED from shared/ — edit there and run node scripts/sync-shared.mjs
// Generala / Yahtzee rules engine — pure functions, no UI.
// Everything the "server" would validate lives here (rolls, legality, scoring, end conditions).

export const VARIANTS = {
  generala: {
    id: 'generala',
    cats: ['n1','n2','n3','n4','n5','n6','escalera','full','poker','generala','doble'],
    rounds: 11,
  },
  yahtzee: {
    id: 'yahtzee',
    upper: ['n1','n2','n3','n4','n5','n6'],
    lower: ['three','four','fullhouse','small','large','yahtzee','chance'],
    cats: ['n1','n2','n3','n4','n5','n6','three','four','fullhouse','small','large','yahtzee','chance'],
    rounds: 13,
  },
};
export const SHORT_ROUNDS = 4;
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const COLORS = ['#E8603C','#2A9D8F','#E9B44C','#7B6CF6'];

const counts = d => { const c = [0,0,0,0,0,0,0]; d.forEach(v => c[v]++); return c; };
const sum = d => d.reduce((a,b) => a+b, 0);
const G_STRAIGHTS = ['12345','23456','13456'];
const isGStraight = d => G_STRAIGHTS.includes([...d].sort().join(''));
function longestRun(d){ const u=[...new Set(d)].sort((a,b)=>a-b); let best=1,cur=1; for(let i=1;i<u.length;i++){ if(u[i]===u[i-1]+1){cur++; best=Math.max(best,cur);} else cur=1; } return best; }

// Returns { scores: {cat: number|null}, forced: cat|null, five: bool, joker: bool, servida: bool }
export function potential(variant, sheet, dice, served){
  const c = counts(dice), max = Math.max(...c), five = max === 5, s = sum(dice);
  const used = cat => sheet[cat] !== undefined;
  const out = { scores: {}, forced: null, five, joker: false, servida: !!served && five };
  if (variant === 'generala') {
    const sc = {};
    for (let n=1;n<=6;n++) sc['n'+n] = c[n]*n;
    sc.escalera = isGStraight(dice) ? (served ? 25 : 20) : 0;
    sc.full = (c.includes(3) && c.includes(2)) ? (served ? 35 : 30) : 0;
    sc.poker = max >= 4 ? (served ? 45 : 40) : 0;
    sc.generala = five ? 50 : 0;
    sc.doble = five ? 100 : 0;
    for (const cat of VARIANTS.generala.cats) {
      if (used(cat)) { out.scores[cat] = null; continue; }
      if (cat === 'doble' && !used('generala')) { out.scores[cat] = null; continue; } // locked until the Generala box is filled
      if (cat === 'doble' && sheet.generala !== 50) { out.scores[cat] = 0; continue; } // Generala was scratched: Doble can only be scratched too
      out.scores[cat] = sc[cat];
    }
    return out;
  }
  // Yahtzee (Hasbro): joker rules when rolling a Yahtzee after the Yahtzee box is filled
  const joker = five && used('yahtzee');
  out.joker = joker;
  const sc = {};
  for (let n=1;n<=6;n++) sc['n'+n] = c[n]*n;
  sc.three = max >= 3 ? s : 0;
  sc.four = max >= 4 ? s : 0;
  sc.fullhouse = (c.includes(3) && c.includes(2)) || joker ? 25 : 0;
  sc.small = longestRun(dice) >= 4 || joker ? 30 : 0;
  sc.large = longestRun(dice) >= 5 || joker ? 40 : 0;
  sc.yahtzee = five ? 50 : 0;
  sc.chance = s;
  for (const cat of VARIANTS.yahtzee.cats) out.scores[cat] = used(cat) ? null : sc[cat];
  if (joker) {
    const upperBox = 'n' + dice[0];
    if (!used(upperBox)) {
      out.forced = upperBox;
      for (const cat of VARIANTS.yahtzee.cats) if (cat !== upperBox) out.scores[cat] = null;
    } else if (VARIANTS.yahtzee.lower.some(cat => !used(cat))) {
      for (const cat of VARIANTS.yahtzee.upper) out.scores[cat] = null;
    } // else: only an upper box remains → scores 0 there (already computed)
  }
  return out;
}

export function totals(variant, player){
  const sh = player.sheet || {};
  const val = cat => sh[cat] || 0;
  if (variant === 'generala') {
    const total = VARIANTS.generala.cats.reduce((a,c) => a + val(c), 0);
    return { total, upper: null, upperBonus: 0, yBonus: 0 };
  }
  const upper = VARIANTS.yahtzee.upper.reduce((a,c) => a + val(c), 0);
  const upperBonus = upper >= 63 ? 35 : 0;
  const lower = VARIANTS.yahtzee.lower.reduce((a,c) => a + val(c), 0);
  const yBonus = (player.yahtzeeBonus || 0) * 100;
  return { total: upper + upperBonus + lower + yBonus, upper, upperBonus, yBonus };
}

export function maxRounds(state){ return state.demoLength === 'short' ? SHORT_ROUNDS : VARIANTS[state.variant].rounds; }

const freshHand = () => ({ dice: [1,2,3,4,5], held: [false,false,false,false,false], rollsLeft: 3, rolled: false, done: false });

export function newGame(cfg){
  const code = Array.from({length:4}, () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random()*23)]).join('');
  return {
    version: 1, phase: 'lobby', roomCode: code, createdAt: Date.now(),
    variant: cfg.variant, mode: cfg.mode, narrator: cfg.narrator !== false, demoLength: cfg.demoLength || 'full',
    players: [], round: 0, activeIdx: 0, hand: freshHand(), hands: {}, paused: false, closed: false,
    winnerIds: [], feed: [], seq: 0,
  };
}

export function joinPlayer(state, p){
  if (!state || state.closed) return { error: 'closed' };
  if (state.players.some(x => x.id === p.id)) return { state: { ...state, players: state.players.map(x => x.id === p.id ? { ...x, connected: true } : x) }, rejoined: true };
  if (state.phase !== 'lobby') return { error: 'started' };
  if (state.players.length >= MAX_PLAYERS) return { error: 'full' };
  const player = { id: p.id, name: p.name.trim().slice(0,14) || 'Player', color: p.color, sheet: {}, yahtzeeBonus: 0, servida: false, connected: true };
  return { state: { ...state, players: [...state.players, player], seq: state.seq + 1 } };
}

export function setConnected(state, id, connected){
  return { ...state, players: state.players.map(p => p.id === id ? { ...p, connected } : p), seq: state.seq + 1 };
}

export function startGame(state){
  if (state.players.length < MIN_PLAYERS) return { error: 'notEnough' };
  const hands = {}; state.players.forEach(p => hands[p.id] = freshHand());
  return { state: { ...state, phase: 'playing', round: 1, activeIdx: 0, hand: freshHand(), hands, seq: state.seq + 1 } };
}

function handOf(state, pid){ return state.mode === 'simul' ? state.hands[pid] : state.hand; }
function withHand(state, pid, hand){
  return state.mode === 'simul' ? { ...state, hands: { ...state.hands, [pid]: hand } } : { ...state, hand };
}
function activeId(state){ return state.players[state.activeIdx] && state.players[state.activeIdx].id; }
function canAct(state, pid){
  if (state.phase !== 'playing' || state.paused) return 'notPlaying';
  if (state.mode === 'turns' && activeId(state) !== pid) return 'notYourTurn';
  if (state.mode === 'simul' && state.hands[pid] && state.hands[pid].done) return 'alreadyDone';
  return null;
}

export function rollDice(state, pid, rng = Math.random){
  const err = canAct(state, pid); if (err) return { error: err };
  const h = handOf(state, pid);
  if (h.rollsLeft <= 0) return { error: 'noRolls' };
  const dice = h.dice.map((v, i) => (h.held[i] && h.rolled) ? v : 1 + Math.floor(rng()*6));
  const nh = { ...h, dice, rollsLeft: h.rollsLeft - 1, rolled: true, rollId: (h.rollId||0) + 1 };
  return { state: { ...withHand(state, pid, nh), seq: state.seq + 1 } };
}

export function toggleHold(state, pid, i){
  const err = canAct(state, pid); if (err) return { error: err };
  const h = handOf(state, pid);
  if (!h.rolled) return { error: 'rollFirst' };
  const held = h.held.slice(); held[i] = !held[i];
  return { state: { ...withHand(state, pid, { ...h, held }), seq: state.seq + 1 } };
}

export function handPotential(state, pid){
  const h = handOf(state, pid); const p = state.players.find(x => x.id === pid);
  if (!h || !p || !h.rolled) return null;
  return potential(state.variant, p.sheet, h.dice, h.rollsLeft === 2);
}

function leader(state){
  let best = null, bestT = -1, tie = false;
  for (const p of state.players) { const t = totals(state.variant, p).total; if (t > bestT) { best = p; bestT = t; tie = false; } else if (t === bestT) tie = true; }
  return tie ? null : best;
}

export function chooseCategory(state, pid, cat){
  const err = canAct(state, pid); if (err) return { error: err };
  const h = handOf(state, pid);
  if (!h.rolled) return { error: 'rollFirst' };
  const pot = handPotential(state, pid);
  const score = pot.scores[cat];
  if (score === null || score === undefined) return { error: 'categoryUnavailable' };
  const prevLeader = leader(state);
  const events = [];
  const players = state.players.map(p => {
    if (p.id !== pid) return p;
    const np = { ...p, sheet: { ...p.sheet, [cat]: score } };
    if (state.variant === 'yahtzee' && pot.five && p.sheet.yahtzee === 50) { np.yahtzeeBonus = (p.yahtzeeBonus||0) + 1; events.push({ type: 'yahtzeeBonus', pid }); }
    if (state.variant === 'generala' && pot.servida && (cat === 'generala' || cat === 'doble')) np.servida = true;
    return np;
  });
  events.push({ type: 'score', pid, cat, score, served: h.rollsLeft === 2, five: pot.five, joker: pot.joker });
  let next = { ...state, players, seq: state.seq + 1 };
  const me = players.find(p => p.id === pid);
  // Generala servida: instant win in classic turn mode (adaptation: disabled in simultaneous mode, see docs)
  if (state.variant === 'generala' && state.mode === 'turns' && pot.servida && (cat === 'generala' || cat === 'doble')) {
    next = { ...next, phase: 'results', winnerIds: [pid], endReason: 'servida' };
    events.push({ type: 'servidaWin', pid });
    return { state: next, events };
  }
  const rounds = maxRounds(state);
  if (state.mode === 'turns') {
    let idx = state.activeIdx + 1, round = state.round;
    if (idx >= players.length) { idx = 0; round++; }
    next = { ...next, activeIdx: idx, round, hand: freshHand() };
    if (round > rounds) next = finish(next, events);
  } else {
    const hands = { ...state.hands, [pid]: { ...h, done: true } };
    next = { ...next, hands };
    if (players.every(p => hands[p.id].done)) {
      const round = state.round + 1;
      if (round > rounds) next = finish({ ...next, round: state.round }, events);
      else { const fresh = {}; players.forEach(p => fresh[p.id] = freshHand()); next = { ...next, round, hands: fresh }; events.push({ type: 'newRound', round }); }
    }
  }
  if (next.phase === 'playing') {
    const nl = leader(next);
    if (nl && (!prevLeader || prevLeader.id !== nl.id) && state.round > 1) events.push({ type: 'lead', pid: nl.id });
  }
  return { state: next, events };
}

function finish(state, events){
  const ts = state.players.map(p => ({ id: p.id, t: totals(state.variant, p).total, servida: p.servida }));
  const max = Math.max(...ts.map(x => x.t));
  let winners = ts.filter(x => x.t === max);
  if (state.variant === 'generala' && winners.length > 1 && winners.some(w => w.servida)) winners = winners.filter(w => w.servida); // simul-mode tiebreak
  events.push({ type: 'end', winnerIds: winners.map(w => w.id), tie: winners.length > 1 });
  return { ...state, phase: 'results', winnerIds: winners.map(w => w.id), endReason: winners.length > 1 ? 'tie' : 'score' };
}

export function endNow(state){ const events = []; const s = finish({ ...state, paused: false }, events); return { state: s, events }; }

export function rematch(state, overrides = {}){
  const g = newGame({ variant: state.variant, mode: state.mode, narrator: state.narrator, demoLength: state.demoLength, ...overrides });
  g.roomCode = state.roomCode;
  g.players = state.players.map(p => ({ ...p, sheet: {}, yahtzeeBonus: 0, servida: false }));
  return g;
}

// Auto-play helper for the demo: a reasonable greedy policy
export function autoMove(state, pid, rng = Math.random){
  let s = state;
  const h0 = handOf(s, pid);
  if (!h0.rolled) { const r = rollDice(s, pid, rng); if (r.error) return { state: s, events: [] }; s = r.state; }
  let h = handOf(s, pid);
  // hold the most frequent value, reroll the rest, up to the roll budget
  while (h.rollsLeft > 0) {
    const c = counts(h.dice); let bestV = 1; for (let v=1; v<=6; v++) if (c[v] >= c[bestV]) bestV = v;
    if (c[bestV] >= 4 || (s.variant === 'yahtzee' && longestRun(h.dice) >= 4) || (s.variant === 'generala' && isGStraight(h.dice))) break;
    for (let i=0;i<5;i++) if (h.held[i] !== (h.dice[i] === bestV)) s = toggleHold(s, pid, i).state;
    s = rollDice(s, pid, rng).state; h = handOf(s, pid);
  }
  const pot = handPotential(s, pid);
  let best = null, bestScore = -1;
  for (const cat of VARIANTS[s.variant].cats) { const v = pot.scores[cat]; if (v === null || v === undefined) continue; const w = v + (v === 0 && cat.startsWith('n') ? 0.5 : 0); if (w > bestScore) { bestScore = w; best = cat; } }
  const r = chooseCategory(s, pid, best);
  return r.error ? { state: s, events: [] } : r;
}
