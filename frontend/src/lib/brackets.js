export function bracketSeedOrder(size) {
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error("Bracket size must be a power of two.");
  let order = [1, 2];
  for (let current = 2; current < size; current *= 2) {
    order = order.flatMap((seed) => [seed, current * 2 + 1 - seed]);
  }
  return order;
}

export function buildSingleElimBracket({ league_id, teamIds, idFactory }) {
  if (teamIds.length < 4) throw new Error("Single-elimination brackets require at least four teams.");
  if (new Set(teamIds).size !== teamIds.length) throw new Error("Seed list contains a duplicate team.");
  let size = 1;
  while (size < teamIds.length) size *= 2;
  const rounds = Math.log2(size);
  const bracket_id = idFactory("bracket");
  const seeds = teamIds.map((team_id, index) => ({ bracket_id, team_id, seed: index + 1 }));
  const matches = [];
  const byRound = {};
  const order = bracketSeedOrder(size);

  for (let round = 1; round <= rounds; round += 1) {
    const count = size / (2 ** round);
    byRound[round] = [];
    for (let number = 1; number <= count; number += 1) {
      const homeSeed = round === 1 ? order[number * 2 - 2] : null;
      const awaySeed = round === 1 ? order[number * 2 - 1] : null;
      const homeTeam = homeSeed && homeSeed <= teamIds.length ? teamIds[homeSeed - 1] : null;
      const awayTeam = awaySeed && awaySeed <= teamIds.length ? teamIds[awaySeed - 1] : null;
      const label = round === rounds ? "Championship"
        : round === rounds - 1 ? "Semifinal"
          : round === rounds - 2 ? "Quarterfinal"
            : `Round of ${size / (2 ** (round - 1))}`;
      const match = {
        id: idFactory("match"), bracket_id, round_number: round, match_number: number, label,
        home_team_id: homeTeam, away_team_id: awayTeam,
        home_seed: homeTeam ? homeSeed : null, away_seed: awayTeam ? awaySeed : null,
        game_id: null,
        status: round === 1 && (!homeTeam || !awayTeam) ? "bye" : round === 1 ? "ready" : "pending",
        winner_team_id: null, loser_team_id: null,
        winner_to_match_id: null, winner_to_slot: null, loser_to_match_id: null, loser_to_slot: null,
      };
      matches.push(match);
      byRound[round].push(match);
    }
  }

  const third = {
    id: idFactory("match"), bracket_id, round_number: rounds, match_number: 2, label: "Third Place",
    home_team_id: null, away_team_id: null, home_seed: null, away_seed: null, game_id: null,
    status: "pending", winner_team_id: null, loser_team_id: null,
    winner_to_match_id: null, winner_to_slot: null, loser_to_match_id: null, loser_to_slot: null,
  };
  matches.push(third);

  for (let round = 1; round < rounds; round += 1) {
    byRound[round].forEach((match, index) => {
      match.winner_to_match_id = byRound[round + 1][Math.floor(index / 2)].id;
      match.winner_to_slot = index % 2 === 0 ? "home" : "away";
    });
  }
  byRound[rounds - 1].forEach((match, index) => {
    match.loser_to_match_id = third.id;
    match.loser_to_slot = index === 0 ? "home" : "away";
  });

  matches.filter((match) => match.status === "bye").forEach((match) => {
    const team = match.home_team_id || match.away_team_id;
    const seed = match.home_seed || match.away_seed;
    match.winner_team_id = team;
    const destination = matches.find((item) => item.id === match.winner_to_match_id);
    destination[`${match.winner_to_slot}_team_id`] = team;
    destination[`${match.winner_to_slot}_seed`] = seed;
  });
  matches.forEach((match) => {
    if (match.status === "pending" && match.home_team_id && match.away_team_id) match.status = "ready";
  });

  return {
    bracket: { id: bracket_id, league_id, bracket_size: size, status: "active" },
    seeds,
    matches,
  };
}
