import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDot,
  Clock3,
  GitBranch,
  Medal,
  RefreshCcw,
  ShieldCheck,
  Swords,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react';

import tournamentData from '@/data/tournament.json';
import {
  calculatePoolStandings,
  createTournamentResolver,
  formatParticipantSource,
  getMatchSideWinner,
  isMatchComplete,
  type Match,
  type ParticipantRef,
  type Tournament,
} from '@/lib/tournament';

const tournament = tournamentData as Tournament;

function getSetWins(match: Match) {
  return match.sets.reduce(
    (wins, [home, away]) => {
      wins[home > away ? 0 : 1] += 1;
      return wins;
    },
    [0, 0],
  );
}

function BracketMatch({ match }: { match: Match }) {
  const { resolveParticipant } = createTournamentResolver(tournament);
  const home = resolveParticipant(match.home);
  const away = resolveParticipant(match.away);
  const complete = isMatchComplete(match, tournament.meta.rules.setsToWin);
  const ready = Boolean(home && away) && !complete;
  const winner = getMatchSideWinner(match, tournament.meta.rules.setsToWin);
  const setWins = getSetWins(match);

  const participant = (
    side: 'home' | 'away',
    player: ReturnType<typeof resolveParticipant>,
    source: ParticipantRef,
  ) => (
    <div className={`match-player ${winner === side ? 'is-winner' : ''}`}>
      <span className="match-player-name">
        <strong>{player?.code ?? 'À déterminer'}</strong>
        <small>{formatParticipantSource(source)}</small>
      </span>
      {match.sets.length > 0 && (
        <span
          className="set-list"
          aria-label={`Scores de ${player?.code ?? side}`}
        >
          {match.sets.map((set, index) => (
            <span key={`${match.id}-${side}-${index}`}>
              {side === 'home' ? set[0] : set[1]}
            </span>
          ))}
        </span>
      )}
      <b>{complete ? setWins[side === 'home' ? 0 : 1] : '–'}</b>
    </div>
  );

  return (
    <article
      className={`bracket-match ${complete ? 'is-complete' : ready ? 'is-ready' : ''}`}
    >
      <header>
        <span>Match #{match.id}</span>
        <span className="match-status">
          {complete ? 'Terminé' : ready ? 'À jouer' : 'En attente'}
        </span>
      </header>
      {participant('home', home, match.home)}
      {participant('away', away, match.away)}
    </article>
  );
}

function getSourceMatchIds(match: Match) {
  return [match.home, match.away].flatMap((participant) => {
    if ('winnerOf' in participant) return [participant.winnerOf];
    if ('loserOf' in participant) return [participant.loserOf];
    return [];
  });
}

function getVisualRounds(matches: Match[]) {
  const rounds = [...new Set(matches.map((match) => match.round ?? 0))].map(
    (round) => ({
      round,
      matches: matches.filter((match) => match.round === round),
    }),
  );

  for (let index = 1; index < rounds.length; index += 1) {
    const previousOrder = new Map(
      rounds[index - 1].matches.map((match, position) => [match.id, position]),
    );
    rounds[index].matches.sort((left, right) => {
      const sourcePosition = (match: Match) =>
        Math.min(
          ...getSourceMatchIds(match).map(
            (sourceId) => previousOrder.get(sourceId) ?? Number.POSITIVE_INFINITY,
          ),
        );
      return sourcePosition(left) - sourcePosition(right);
    });
  }

  for (let index = rounds.length - 2; index >= 0; index -= 1) {
    const destinationOrder = new Map<string, number>();
    rounds[index + 1].matches.forEach((match, position) => {
      getSourceMatchIds(match).forEach((sourceId) => {
        destinationOrder.set(sourceId, position);
      });
    });
    rounds[index].matches.sort((left, right) => {
      const leftPosition =
        destinationOrder.get(left.id) ?? Number.POSITIVE_INFINITY;
      const rightPosition =
        destinationOrder.get(right.id) ?? Number.POSITIVE_INFINITY;
      return leftPosition - rightPosition;
    });
  }

  return rounds;
}

function BracketLane({
  title,
  eyebrow,
  matches,
}: {
  title: string;
  eyebrow: string;
  matches: Match[];
}) {
  const rounds = getVisualRounds(matches);

  return (
    <section className="bracket-lane" aria-label={`${title} — ${eyebrow}`}>
      <div className="lane-heading">
        <span>{eyebrow}</span>
        <h4>{title}</h4>
      </div>
      <div className="bracket-scroll">
        <div className="bracket-rounds">
          {rounds.map(({ round, matches: roundMatches }, roundIndex) => {
            const nextRoundMatches = rounds[roundIndex + 1]?.matches ?? [];
            const singleMatchDestination =
              roundMatches.length === 1
                ? nextRoundMatches.findIndex((match) =>
                    getSourceMatchIds(match).includes(roundMatches[0].id),
                  )
                : -1;
            const alignmentClass =
              nextRoundMatches.length > 1 && singleMatchDestination === 0
                ? ' is-top-aligned'
                : nextRoundMatches.length > 1 &&
                    singleMatchDestination === nextRoundMatches.length - 1
                  ? ' is-bottom-aligned'
                  : '';
            return (
              <div className="bracket-round" key={`${title}-${round}`}>
                <h5>{roundMatches[0]?.roundLabel}</h5>
                <div className={`round-matches${alignmentClass}`}>
                  {roundMatches.map((match) => (
                    <BracketMatch key={match.id} match={match} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TournamentBracket({
  phase,
  index,
}: {
  phase: 'main' | 'secondary';
  index: string;
}) {
  const phaseMatches = tournament.matches.filter(
    (match) => match.phase === phase,
  );
  const winnerMatches = phaseMatches.filter(
    (match) => match.bracket === 'winner',
  );
  const loserMatches = phaseMatches.filter(
    (match) => match.bracket === 'loser',
  );
  const grandFinal = phaseMatches.filter(
    (match) => match.bracket === 'grand-final',
  );
  const readyCount = phaseMatches.filter((match) => {
    const { resolveParticipant } = createTournamentResolver(tournament);
    return (
      !isMatchComplete(match, tournament.meta.rules.setsToWin) &&
      resolveParticipant(match.home) &&
      resolveParticipant(match.away)
    );
  }).length;

  const isMain = phase === 'main';

  return (
    <article className={`tournament-bracket tournament-bracket-${phase}`}>
      <header className="tournament-bracket-heading">
        <div>
          <p className="section-kicker">{index} · Double élimination</p>
          <h3>Tableau {isMain ? 'principal' : 'secondaire'}</h3>
          <p>
            {isMain
              ? 'Les huit qualifiés jouent pour le titre principal.'
              : 'Cinq joueurs, une seconde course vers la coupe.'}
          </p>
        </div>
        <div className="bracket-summary">
          <strong>{readyCount}</strong>
          <span>matchs prêts</span>
        </div>
      </header>

      <BracketLane
        title="Winner bracket"
        eyebrow="Rester invaincu"
        matches={winnerMatches}
      />
      <BracketLane
        title="Loser bracket"
        eyebrow="La deuxième chance"
        matches={loserMatches}
      />
      <BracketLane
        title="Grande finale"
        eyebrow="Un match · pas de reset"
        matches={grandFinal}
      />
    </article>
  );
}

export default function Home() {
  const { resolveParticipant } = createTournamentResolver(tournament);
  const completedMatches = tournament.matches.filter((match) =>
    isMatchComplete(match, tournament.meta.rules.setsToWin),
  );
  const readyMatches = tournament.matches
    .filter(
      (match) =>
        match.phase !== 'pool' &&
        !isMatchComplete(match, tournament.meta.rules.setsToWin) &&
        resolveParticipant(match.home) &&
        resolveParticipant(match.away),
    )
    .sort((left, right) => Number(left.id) - Number(right.id));
  const nextMatch = readyMatches[0];
  const nextHome = nextMatch ? resolveParticipant(nextMatch.home) : null;
  const nextAway = nextMatch ? resolveParticipant(nextMatch.away) : null;

  const stats = [
    { icon: UsersRound, value: tournament.players.length, label: 'joueurs' },
    {
      icon: CircleDot,
      value: tournament.pools.length,
      label: 'poules terminées',
    },
    { icon: Trophy, value: completedMatches.length, label: 'matchs joués' },
  ];
  const updatedAt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date(tournament.meta.updatedAt));

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Retour en haut">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>
            <strong>{tournament.meta.title}</strong>
            <small>{tournament.meta.subtitle}</small>
          </span>
        </a>

        <nav aria-label="Navigation principale">
          <a href="#poules">Poules</a>
          <a href="#tableaux">Tableaux</a>
          <a href="#a-jouer">À jouer</a>
          <a
            className="admin-link"
            href="https://github.com/Dayonixe/Systerel_PingPongTournament/issues/new?template=result.yml"
            target="_blank"
            rel="noreferrer"
          >
            Gérer les scores <ArrowUpRight aria-hidden="true" />
          </a>
        </nav>
      </header>

      <div className="page-shell" id="top">
        <section className="scoreboard-hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="live-dot" /> Tournoi en cours
            </p>
            <h1 id="page-title">
              À chacun sa raquette.
              <span>À un seul la coupe.</span>
            </h1>
            <p className="hero-intro">
              Suivez les scores, les qualifiés et la course aux deux grandes
              finales. Les poules sont closes : place aux tableaux.
            </p>
          </div>

          {nextMatch && (
            <div className="next-match-card">
              <div className="next-match-heading">
                <span>Prochain match</span>
                <strong>#{nextMatch.id}</strong>
              </div>
              <div className="versus">
                <span>{nextHome?.code}</span>
                <em>VS</em>
                <span>{nextAway?.code}</span>
              </div>
              <p>
                Tableau{' '}
                {nextMatch.phase === 'main' ? 'principal' : 'secondaire'} ·{' '}
                {nextMatch.roundLabel?.toLocaleLowerCase('fr')}
              </p>
            </div>
          )}
        </section>

        <section className="stat-grid" aria-label="Résumé du tournoi">
          {stats.map(({ icon: Icon, value, label }) => (
            <article className="stat-card" key={label}>
              <Icon aria-hidden="true" />
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
          <article className="stat-card stat-card-accent">
            <ShieldCheck aria-hidden="true" />
            <strong>2</strong>
            <span>tableaux à départager</span>
          </article>
        </section>

        <section
          className="section-block"
          id="poules"
          aria-labelledby="pools-title"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Phase 01 · terminée</p>
              <h2 id="pools-title">Classement des poules</h2>
            </div>
            <p>
              Les deux premiers rejoignent le tableau principal. Les autres
              poursuivent dans le tableau secondaire.
            </p>
          </div>

          <div className="pool-grid">
            {tournament.pools.map((pool) => {
              const standings = calculatePoolStandings(tournament, pool);
              const poolMatches = tournament.matches.filter(
                (match) => match.phase === 'pool' && match.poolId === pool.id,
              );
              return (
                <article className="pool-card" key={pool.id}>
                  <div className="pool-card-header">
                    <h3>{pool.name}</h3>
                    <span>Final</span>
                  </div>
                  <ol>
                    {standings.map((standing, index) => (
                      <li key={standing.player.id}>
                        <span className="rank">{index + 1}</span>
                        <span className="player-name">
                          <strong>{standing.player.code}</strong>
                          <small>Joueur {standing.player.id}</small>
                        </span>
                        <span className="record">
                          {standing.matchesWon}–{standing.matchesLost}
                        </span>
                        {index < pool.qualifyingPlaces ? (
                          <Medal aria-label="Qualifié" />
                        ) : (
                          <span
                            className="secondary-mark"
                            aria-label="Tableau secondaire"
                          >
                            S
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <details className="pool-results">
                    <summary>
                      Voir les scores <ArrowRight aria-hidden="true" />
                    </summary>
                    <div>
                      {poolMatches.map((match) => {
                        const home = resolveParticipant(match.home);
                        const away = resolveParticipant(match.away);
                        return (
                          <p key={match.id}>
                            <strong>
                              {home?.code} – {away?.code}
                            </strong>
                            <span>
                              {match.sets
                                .map((set) => set.join('/'))
                                .join(' · ')}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="section-block"
          id="tableaux"
          aria-labelledby="brackets-title"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Phase 02 · en cours</p>
              <h2 id="brackets-title">La route des finales</h2>
            </div>
            <p>
              Une défaite envoie dans le loser bracket. Une deuxième élimine.
              Chaque tableau se termine par une grande finale unique.
            </p>
          </div>
          <div className="bracket-stack">
            <TournamentBracket phase="main" index="A" />
            <TournamentBracket phase="secondary" index="B" />
          </div>
        </section>

        <section
          className="section-block upcoming-section"
          id="a-jouer"
          aria-labelledby="upcoming-title"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Prêts à jouer</p>
              <h2 id="upcoming-title">Les prochains duels</h2>
            </div>
            <p>
              Les duels s’affichent dès que leurs deux joueurs sont connus.
            </p>
          </div>
          <div className="upcoming-grid">
            {readyMatches.map((match, index) => {
              const home = resolveParticipant(match.home);
              const away = resolveParticipant(match.away);
              return (
                <article className="upcoming-card" key={match.id}>
                  <div>
                    <span className="queue-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="phase-chip">
                      {match.phase === 'main' ? 'Principal' : 'Secondaire'}
                    </span>
                  </div>
                  <p>
                    <strong>{home?.code}</strong>
                    <Swords aria-hidden="true" />
                    <strong>{away?.code}</strong>
                  </p>
                  <footer>
                    <span>
                      <Clock3 aria-hidden="true" /> Match #{match.id}
                    </span>
                    <span>{match.roundLabel}</span>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rules-strip" aria-label="Règles essentielles">
          <div>
            <GitBranch aria-hidden="true" />
            <span>
              <strong>2 sets gagnants</strong>
              Match au meilleur des trois manches
            </span>
          </div>
          <div>
            <CircleDot aria-hidden="true" />
            <span>
              <strong>11 points</strong>
              Une manche se joue en 11 points
            </span>
          </div>
          <div>
            <RefreshCcw aria-hidden="true" />
            <span>
              <strong>Écart &amp; services</strong>
              2 points d’écart · 2 services chacun, puis 1 chacun à 10–10 · service non croisé
            </span>
          </div>
          <div>
            <Zap aria-hidden="true" />
            <span>
              <strong>Volée autorisée</strong>
              La balle peut être reprise avant son rebond
            </span>
          </div>
          <div>
            <Check aria-hidden="true" />
            <span>
              <strong>Finale unique</strong>
              Aucun match de réinitialisation
            </span>
          </div>
        </section>
      </div>

      <footer className="site-footer">
        <p>
          <span className="footer-ball" /> Tournoi de l’été · Systerel
        </p>
        <p>Dernière saisie le {updatedAt}</p>
      </footer>
    </main>
  );
}
