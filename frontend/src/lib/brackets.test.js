import { bracketSeedOrder, buildSingleElimBracket } from "./brackets";

const ids = () => {
  let value = 0;
  return (prefix) => `${prefix}-${++value}`;
};

test("standard eight-team seed order keeps top seeds apart", () => {
  expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
});

test("four-team bracket includes two semifinals, championship, and third place", () => {
  const result = buildSingleElimBracket({ league_id: "league", teamIds: ["a", "b", "c", "d"], idFactory: ids() });
  expect(result.bracket.bracket_size).toBe(4);
  expect(result.matches.filter((match) => match.label === "Semifinal")).toHaveLength(2);
  expect(result.matches.filter((match) => match.label === "Championship")).toHaveLength(1);
  expect(result.matches.filter((match) => match.label === "Third Place")).toHaveLength(1);
  expect(result.matches.filter((match) => match.status === "bye")).toHaveLength(0);
});

test("six-team bracket gives byes to seeds one and two and advances them", () => {
  const result = buildSingleElimBracket({ league_id: "league", teamIds: ["a", "b", "c", "d", "e", "f"], idFactory: ids() });
  expect(result.bracket.bracket_size).toBe(8);
  expect(result.matches.filter((match) => match.status === "bye")).toHaveLength(2);
  const semifinals = result.matches.filter((match) => match.round_number === 2);
  expect(semifinals.flatMap((match) => [match.home_seed, match.away_seed]).filter(Boolean)).toEqual(expect.arrayContaining([1, 2]));
});
