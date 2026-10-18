// Display-only view model: narrator lines and derived labels from a server state.
import * as E from '../src/shared/engine';
import { computeVals, feedText, screenOf } from '../src/viewModel';

const tv = { lang: 'es', muted: false, reduced: true, screen: 'home', helpOpen: false, setup: { variant: 'generala', mode: 'turns', narrator: true, demoLength: 'short' } };

function game(){
  let g = E.newGame({ variant: 'generala', mode: 'turns', narrator: true, demoLength: 'short' });
  g = E.joinPlayer(g, { id: 'a', name: 'Ana', color: E.COLORS[0] }).state;
  g = E.joinPlayer(g, { id: 'b', name: 'Beto', color: E.COLORS[1] }).state;
  return { ...E.startGame(g).state, events: [] };
}

test('screenOf follows the server phase, help and change-variant mode', () => {
  const g = game();
  expect(screenOf(tv, null)).toBe('home');
  expect(screenOf(tv, g)).toBe('playing');
  expect(screenOf({ ...tv, helpOpen: true }, g)).toBe('help');
  expect(screenOf(tv, { ...g, closed: true })).toBe('closed');
  expect(screenOf({ ...tv, changing: true, screen: 'setup' }, { ...g, phase: 'results' })).toBe('setup');
});

test('narrator shows the latest event with a line', () => {
  const g = { ...game(), events: [{ id: 1, type: 'score', pid: 'a', cat: 'n3', score: 9 }, { id: 2, type: 'score', pid: 'b', cat: 'poker', score: 40, variant: 'generala' }] };
  expect(feedText('es', g, g.events[1])).toContain('Beto');
  const v = computeVals(tv, g);
  expect(v.feedVisible).toBe(true);
  expect(v.feedText).toContain('Póker para Beto');
  expect(computeVals({ ...tv, muted: true }, g).feedVisible).toBe(false);
});

test('turn view: active player, potentials and totals', () => {
  let g = game();
  g = E.rollDice(g, 'a', () => 0.99).state; // five sixes, first roll
  const v = computeVals({ ...tv, lang: 'en' }, g);
  expect(v.turnLabel).toBe("Ana's turn");
  expect(v.servidaVisible).toBe(true);
  const gen = v.rows.find(r => r.key === 'generala');
  expect(gen.cells[0].text).toBe('50');
  expect(v.rows[v.rows.length - 1].key).toBe('total');
});

test('3D dice input: held only after a roll, rollKey per roll, shaking with local staleness', () => {
  let g = game();
  g = E.rollDice(g, 'a', () => 0.5).state;
  g = { ...g, hand: { ...g.hand, held: [true, false, false, false, false] } };
  const v = computeVals({ ...tv, now: 1000 }, g);
  expect(v.dice3d.held).toEqual([true, false, false, false, false]);
  expect(v.dice3d.rolled).toBe(true);
  expect(v.dice3d.color).toBe(E.COLORS[0]);
  expect(v.dice3d.rollKey).toBe('1:0:1');
  expect(v.shaking).toBe(false);
  const fresh = computeVals({ ...tv, now: 1000 }, game());
  expect(fresh.dice3d.held).toEqual([false, false, false, false, false]);
  const sh = { ...g, hand: { ...g.hand, shaking: true, shakeTs: 5 } };
  expect(computeVals({ ...tv, lang: 'en', now: 2000 }, sh).statusLabel).toBe('Shaking…');
  expect(computeVals({ ...tv, now: 9000 }, sh).dice3d.shaking).toBe(true);
  expect(computeVals({ ...tv, now: 10001 }, sh).dice3d.shaking).toBe(false); // 8 s after this TV first saw it
});

test('potentials wait for the 3D dice to land (settled or timeout)', () => {
  let g = game();
  g = E.rollDice(g, 'a', () => 0.99).state;
  const base = { ...tv, lang: 'en', dice3d: true };
  const gen = v => v.rows.find(r => r.key === 'generala').cells[0].text;
  expect(computeVals({ ...base, now: 50000 }, g).landing).toBe(true);
  expect(gen(computeVals({ ...base, now: 50000 }, g))).toBe('');
  expect(computeVals({ ...base, now: 50000 }, g).servidaVisible).toBe(false);
  expect(gen(computeVals({ ...base, now: 50000, landedKey: '1:0:1' }, g))).toBe('50');
  expect(gen(computeVals({ ...base, now: 56600 }, g))).toBe('50'); // safety net
});

test('voiceLine carries the narrator key + vars for /api/tts, once per event, only with the narrator on', () => {
  const g = { ...game(), events: [{ id: 7, type: 'score', pid: 'a', cat: 'full', score: 30 }] };
  const v = computeVals(tv, g);
  expect(v.voiceLine).toEqual({ id: g.roomCode + ':7', k: 'full', vars: { name: 'Ana', score: 30, cat: 'Full', n: undefined }, text: 'Full de Ana, 30 puntos. Ordenadito como la mesa del domingo.', lang: 'es' });
  expect(computeVals(tv, { ...g, narrator: false }).voiceLine).toBe(null);
});
