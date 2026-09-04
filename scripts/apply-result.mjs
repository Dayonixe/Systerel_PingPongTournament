import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const authorizedUser = 'dayonixe';
const actor = (process.env.ISSUE_ACTOR ?? '').trim().toLowerCase();
const body = process.env.ISSUE_BODY ?? '';
const dataPath = resolve('data/tournament.json');

if (actor !== authorizedUser) {
  throw new Error(`Le compte ${actor || 'inconnu'} n'est pas autorisé.`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readField(label) {
  const expression = new RegExp(
    `### ${escapeRegex(label)}\\s*\\r?\\n+([\\s\\S]*?)(?=\\r?\\n### |$)`,
    'i',
  );
  const value = body.match(expression)?.[1]?.trim() ?? '';
  return value === '_No response_' ? '' : value;
}

const matchId = readField('Identifiant du match').replace(/^#/, '').trim();
const action = readField('Action');
const scoreInput = readField('Sets');
const shouldDelete = action.toLowerCase().startsWith('supprimer');

if (!action || !matchId || (!shouldDelete && !scoreInput)) {
  throw new Error(
    "L'action, l'identifiant du match et, sauf pour une suppression, les sets sont obligatoires.",
  );
}

const sets = shouldDelete
  ? []
  : scoreInput
      .split(/[,;\n]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const scores = value.split(/\s*[-/:]\s*/).map(Number);
        if (
          scores.length !== 2 ||
          scores.some((score) => !Number.isInteger(score) || score < 0)
        ) {
          throw new Error(`Set invalide : ${value}`);
        }
        return scores;
      });

if (!shouldDelete && (sets.length < 2 || sets.length > 3)) {
  throw new Error('Un match doit contenir deux ou trois sets.');
}

const tournament = JSON.parse(readFileSync(dataPath, 'utf8'));
const { pointsToWin, winBy, setsToWin } = tournament.meta.rules;
const wins = [0, 0];

if (!shouldDelete) {
  for (const [home, away] of sets) {
    const high = Math.max(home, away);
    if (home === away || high < pointsToWin || Math.abs(home - away) < winBy) {
      throw new Error(`Score de set impossible : ${home}/${away}`);
    }
    wins[home > away ? 0 : 1] += 1;
  }

  if (Math.max(...wins) !== setsToWin || Math.min(...wins) >= setsToWin) {
    throw new Error(
      'Le résultat ne désigne pas un vainqueur en deux sets gagnants.',
    );
  }
}

const match = tournament.matches.find((candidate) => candidate.id === matchId);
if (!match) {
  throw new Error(`Match ${matchId} introuvable.`);
}

const playerMap = new Map(
  tournament.players.map((player) => [player.id, player]),
);
const slotMap = new Map(
  tournament.placementSlots.map((slot) => [slot.id, slot.playerId]),
);
const matchMap = new Map(
  tournament.matches.map((candidate) => [candidate.id, candidate]),
);

function winnerSide(candidate) {
  const candidateWins = [0, 0];
  for (const [home, away] of candidate.sets) {
    candidateWins[home > away ? 0 : 1] += 1;
  }
  if (Math.max(...candidateWins) < setsToWin) return null;
  return candidateWins[0] > candidateWins[1] ? 'home' : 'away';
}

function resolveParticipant(reference, visited = new Set()) {
  if ('playerId' in reference) return playerMap.get(reference.playerId) ?? null;
  if ('slotId' in reference)
    return playerMap.get(slotMap.get(reference.slotId)) ?? null;

  const sourceId = reference.winnerOf ?? reference.loserOf;
  if (visited.has(sourceId)) return null;
  visited.add(sourceId);
  const source = matchMap.get(sourceId);
  if (!source) return null;
  const winner = winnerSide(source);
  if (!winner) return null;
  const side = reference.winnerOf
    ? winner
    : winner === 'home'
      ? 'away'
      : 'home';
  return resolveParticipant(source[side], visited);
}

function sourceMatchIds(candidate) {
  return [candidate.home, candidate.away]
    .map((reference) => reference.winnerOf ?? reference.loserOf)
    .filter(Boolean);
}

function clearDependentResults(sourceMatchId) {
  const pending = [sourceMatchId];
  const visited = new Set(pending);
  const cleared = [];

  while (pending.length > 0) {
    const currentId = pending.shift();
    for (const candidate of tournament.matches) {
      if (
        visited.has(candidate.id) ||
        !sourceMatchIds(candidate).includes(currentId)
      ) {
        continue;
      }
      visited.add(candidate.id);
      pending.push(candidate.id);
      if (candidate.sets.length > 0) {
        candidate.sets = [];
        cleared.push(candidate.id);
      }
    }
  }

  return cleared;
}

const home = resolveParticipant(match.home);
const away = resolveParticipant(match.away);
if (!home || !away) {
  throw new Error(
    `Les deux joueurs du match ${matchId} ne sont pas encore connus.`,
  );
}

const previousWinnerSide = winnerSide(match);
let clearedMatches = [];

if (shouldDelete) {
  if (!previousWinnerSide) {
    throw new Error(`Le match ${matchId} n'a pas de résultat à supprimer.`);
  }
  match.sets = [];
  clearedMatches = clearDependentResults(matchId);
} else {
  const nextWinnerSide = wins[0] > wins[1] ? 'home' : 'away';
  match.sets = sets;
  if (previousWinnerSide && previousWinnerSide !== nextWinnerSide) {
    clearedMatches = clearDependentResults(matchId);
  }
}

tournament.meta.updatedAt = new Date().toISOString();
if (process.env.DRY_RUN !== '1') {
  writeFileSync(dataPath, `${JSON.stringify(tournament, null, 2)}\n`, 'utf8');
}

const dependencySummary =
  clearedMatches.length > 0
    ? ` · résultats dépendants supprimés : ${clearedMatches.join(', ')}`
    : '';
const winner = wins[0] > wins[1] ? home : away;
const summary = shouldDelete
  ? `match #${matchId} · résultat supprimé${dependencySummary}`
  : `match #${matchId} · ${home.code} ${wins[0]}–${wins[1]} ${away.code} · ${winner.code} vainqueur${dependencySummary}`;

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\n`, 'utf8');
}

console.log(summary);
