import assert from 'node:assert/strict';
import test from 'node:test';

import tournamentData from '../data/tournament.json' with { type: 'json' };

import { getReadyMatches } from './tournament.ts';

const readyMatchIds = (tournament) =>
  getReadyMatches(tournament).map((match) => match.id);

void test('orders the current ready matches by bracket progress and priority', () => {
  assert.deepEqual(readyMatchIds(tournamentData), ['30', '34', '35']);
});

void test('places match 39 before match 32 after match 30 is completed', () => {
  const tournament = structuredClone(tournamentData);
  const match30 = tournament.matches.find((match) => match.id === '30');
  assert.ok(match30);
  match30.sets = [
    [11, 8],
    [11, 6],
  ];

  assert.deepEqual(readyMatchIds(tournament), ['39', '32', '34', '35']);
});
