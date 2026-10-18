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
