export type Player = {
  id: number;
  code: string;
};

export type ParticipantRef =
  | { playerId: number }
  | { slotId: number }
  | { winnerOf: string }
  | { loserOf: string };

export type Match = {
  id: string;
  phase: 'pool' | 'main' | 'secondary';
  poolId?: string;
  bracket?: 'winner' | 'loser' | 'grand-final';
  round?: number;
  roundLabel?: string;
  home: ParticipantRef;
  away: ParticipantRef;
  sets: number[][];
};

export type Pool = {
  id: string;
  name: string;
  playerIds: number[];
  qualifyingPlaces: number;
};

export type PlacementSlot = {
  id: number;
  playerId: number;
  label: string;
};

export type Tournament = {
  meta: {
    title: string;
    subtitle: string;
    administrator: string;
    updatedAt: string;
    rules: {
      setsToWin: number;
      pointsToWin: number;
      winBy: number;
      grandFinalReset: boolean;
    };
  };
  players: Player[];
  pools: Pool[];
  placementSlots: PlacementSlot[];
  matches: Match[];
};

export type Standing = {
  player: Player;
  matchesWon: number;
  matchesLost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
};

export type PlayerProgress = {
  phase: 'main' | 'secondary';
  bracket: NonNullable<Match['bracket']>;
  round: number;
  roundLabel: string;
  matchId: string;
  status: 'active' | 'champion' | 'runner-up' | 'eliminated';
  label: string;
};

export type PlayerStanding = Standing & {
  progress: PlayerProgress | null;
};

const setWinner = (set: number[]) => (set[0] > set[1] ? 0 : 1);

export function isMatchComplete(match: Match, setsToWin = 2) {
  const wins = [0, 0];
  match.sets.forEach((set) => {
    wins[setWinner(set)] += 1;
  });
  return wins[0] >= setsToWin || wins[1] >= setsToWin;
}

export function getMatchSideWinner(match: Match, setsToWin = 2) {
  if (!isMatchComplete(match, setsToWin)) return null;
  const wins = [0, 0];
  match.sets.forEach((set) => {
    wins[setWinner(set)] += 1;
  });
  return wins[0] > wins[1] ? 'home' : 'away';
}

export function createTournamentResolver(tournament: Tournament) {
  const playerMap = new Map(
    tournament.players.map((player) => [player.id, player]),
  );
  const slotMap = new Map(
    tournament.placementSlots.map((slot) => [slot.id, slot.playerId]),
  );
  const matchMap = new Map(
    tournament.matches.map((match) => [match.id, match]),
  );

  const resolveParticipant = (
    participant: ParticipantRef,
    visited = new Set<string>(),
  ): Player | null => {
    if ('playerId' in participant)
      return playerMap.get(participant.playerId) ?? null;
    if ('slotId' in participant) {
      const playerId = slotMap.get(participant.slotId);
      return playerId ? (playerMap.get(playerId) ?? null) : null;
    }

    const sourceId =
      'winnerOf' in participant ? participant.winnerOf : participant.loserOf;
    if (visited.has(sourceId)) return null;
    visited.add(sourceId);

    const sourceMatch = matchMap.get(sourceId);
    if (!sourceMatch) return null;
    const winningSide = getMatchSideWinner(
      sourceMatch,
      tournament.meta.rules.setsToWin,
    );
    if (!winningSide) return null;

    const requestedSide =
      'winnerOf' in participant
        ? winningSide
        : winningSide === 'home'
          ? 'away'
          : 'home';
    return resolveParticipant(sourceMatch[requestedSide], visited);
  };

  return { playerMap, slotMap, matchMap, resolveParticipant };
}

export function calculatePoolStandings(tournament: Tournament, pool: Pool) {
  const { playerMap, resolveParticipant } =
    createTournamentResolver(tournament);
  const standings = new Map<number, Standing>();

  pool.playerIds.forEach((playerId) => {
    const player = playerMap.get(playerId);
    if (player) {
      standings.set(playerId, {
        player,
        matchesWon: 0,
        matchesLost: 0,
        setsWon: 0,
        setsLost: 0,
        pointsWon: 0,
        pointsLost: 0,
      });
    }
  });

  tournament.matches
    .filter((match) => match.phase === 'pool' && match.poolId === pool.id)
    .forEach((match) => {
      const home = resolveParticipant(match.home);
      const away = resolveParticipant(match.away);
      if (
        !home ||
        !away ||
        !isMatchComplete(match, tournament.meta.rules.setsToWin)
      ) {
        return;
      }

      const homeStanding = standings.get(home.id);
      const awayStanding = standings.get(away.id);
      if (!homeStanding || !awayStanding) return;

      match.sets.forEach(([homePoints, awayPoints]) => {
        homeStanding.pointsWon += homePoints;
        homeStanding.pointsLost += awayPoints;
        awayStanding.pointsWon += awayPoints;
        awayStanding.pointsLost += homePoints;

        if (homePoints > awayPoints) {
          homeStanding.setsWon += 1;
          awayStanding.setsLost += 1;
        } else {
          awayStanding.setsWon += 1;
          homeStanding.setsLost += 1;
        }
      });

      const winner = getMatchSideWinner(match, tournament.meta.rules.setsToWin);
      if (winner === 'home') {
        homeStanding.matchesWon += 1;
        awayStanding.matchesLost += 1;
      } else {
        awayStanding.matchesWon += 1;
        homeStanding.matchesLost += 1;
      }
    });

  return [...standings.values()].sort((left, right) => {
    const matchDiff = right.matchesWon - left.matchesWon;
    if (matchDiff !== 0) return matchDiff;
    const setDiff =
      right.setsWon - right.setsLost - (left.setsWon - left.setsLost);
    if (setDiff !== 0) return setDiff;
    const pointDiff =
      right.pointsWon - right.pointsLost - (left.pointsWon - left.pointsLost);
    if (pointDiff !== 0) return pointDiff;
    return left.player.id - right.player.id;
  });
}

export function calculatePlayerStandings(tournament: Tournament) {
  const { resolveParticipant } = createTournamentResolver(tournament);
  const standings = new Map<number, Standing>();

  tournament.players.forEach((player) => {
    standings.set(player.id, {
      player,
      matchesWon: 0,
      matchesLost: 0,
      setsWon: 0,
      setsLost: 0,
      pointsWon: 0,
      pointsLost: 0,
    });
  });

  tournament.matches.forEach((match) => {
    const home = resolveParticipant(match.home);
    const away = resolveParticipant(match.away);
    if (
      !home ||
      !away ||
      !isMatchComplete(match, tournament.meta.rules.setsToWin)
    ) {
      return;
    }

    const homeStanding = standings.get(home.id);
    const awayStanding = standings.get(away.id);
    if (!homeStanding || !awayStanding) return;

    match.sets.forEach(([homePoints, awayPoints]) => {
      homeStanding.pointsWon += homePoints;
      homeStanding.pointsLost += awayPoints;
      awayStanding.pointsWon += awayPoints;
      awayStanding.pointsLost += homePoints;

      if (homePoints > awayPoints) {
        homeStanding.setsWon += 1;
        awayStanding.setsLost += 1;
      } else {
        awayStanding.setsWon += 1;
        homeStanding.setsLost += 1;
      }
    });

    const winner = getMatchSideWinner(match, tournament.meta.rules.setsToWin);
    if (winner === 'home') {
      homeStanding.matchesWon += 1;
      awayStanding.matchesLost += 1;
    } else {
      awayStanding.matchesWon += 1;
      homeStanding.matchesLost += 1;
    }
  });

  const bracketPriority: Record<PlayerProgress['bracket'], number> = {
    'grand-final': 3,
    winner: 2,
    loser: 1,
  };
  const statusPriority: Record<PlayerProgress['status'], number> = {
    champion: 4,
    'runner-up': 3,
    active: 2,
    eliminated: 1,
  };
  const progressScore = (match: Match) =>
    (match.round ?? 0) * 10 + bracketPriority[match.bracket ?? 'loser'];

  const rankedStandings: PlayerStanding[] = [...standings.values()].map(
    (standing) => {
      const appearances = tournament.matches.filter((match) => {
        if (match.phase === 'pool') return false;
        const home = resolveParticipant(match.home);
        const away = resolveParticipant(match.away);
        return (
          home?.id === standing.player.id || away?.id === standing.player.id
        );
      });
      const currentMatch = appearances
        .filter(
          (match) => !isMatchComplete(match, tournament.meta.rules.setsToWin),
        )
        .sort((left, right) => progressScore(right) - progressScore(left))[0];
      const latestMatch = appearances
        .filter((match) =>
          isMatchComplete(match, tournament.meta.rules.setsToWin),
        )
        .sort((left, right) => progressScore(right) - progressScore(left))[0];
      const progressMatch = currentMatch ?? latestMatch;

      if (!progressMatch || progressMatch.phase === 'pool') {
        return { ...standing, progress: null };
      }

      const phase = progressMatch.phase;
      const bracket = progressMatch.bracket ?? 'winner';
      const roundLabel = progressMatch.roundLabel ?? 'Tour en cours';
      const bracketName = bracket === 'winner' ? 'winner' : 'loser';
      const labelledRound =
        bracket === 'grand-final' ||
        roundLabel.toLocaleLowerCase('fr').includes(bracketName)
          ? roundLabel
          : `${roundLabel} ${bracketName}`;
      let status: PlayerProgress['status'] = currentMatch
        ? 'active'
        : 'eliminated';

      if (!currentMatch && bracket === 'grand-final') {
        const home = resolveParticipant(progressMatch.home);
        const winner = getMatchSideWinner(
          progressMatch,
          tournament.meta.rules.setsToWin,
        );
        const playerSide = home?.id === standing.player.id ? 'home' : 'away';
        status = winner === playerSide ? 'champion' : 'runner-up';
      }

      return {
        ...standing,
        progress: {
          phase,
          bracket,
          round: progressMatch.round ?? 0,
          roundLabel,
          matchId: progressMatch.id,
          status,
          label: `${labelledRound} · ${phase === 'main' ? 'principal' : 'secondaire'}`,
        },
      };
    },
  );

  return rankedStandings.sort((left, right) => {
    const phaseDiff =
      (right.progress?.phase === 'main' ? 2 : right.progress ? 1 : 0) -
      (left.progress?.phase === 'main' ? 2 : left.progress ? 1 : 0);
    if (phaseDiff !== 0) return phaseDiff;

    const roundDiff =
      (right.progress?.round ?? 0) - (left.progress?.round ?? 0);
    if (roundDiff !== 0) return roundDiff;

    const bracketDiff =
      (right.progress ? bracketPriority[right.progress.bracket] : 0) -
      (left.progress ? bracketPriority[left.progress.bracket] : 0);
    if (bracketDiff !== 0) return bracketDiff;

    const statusDiff =
      (right.progress ? statusPriority[right.progress.status] : 0) -
      (left.progress ? statusPriority[left.progress.status] : 0);
    if (statusDiff !== 0) return statusDiff;

    const winDiff = right.matchesWon - left.matchesWon;
    if (winDiff !== 0) return winDiff;
    const setDiff =
      right.setsWon - right.setsLost - (left.setsWon - left.setsLost);
    if (setDiff !== 0) return setDiff;
    const pointDiff =
      right.pointsWon - right.pointsLost - (left.pointsWon - left.pointsLost);
    if (pointDiff !== 0) return pointDiff;
    return left.player.id - right.player.id;
  });
}

export function formatParticipantSource(participant: ParticipantRef) {
  if ('playerId' in participant) return `Joueur ${participant.playerId}`;
  if ('slotId' in participant) return `N°${participant.slotId}`;
  if ('winnerOf' in participant) return `Vainqueur #${participant.winnerOf}`;
  return `Perdant #${participant.loserOf}`;
}
