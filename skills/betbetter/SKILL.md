---
name: betbetter-sports-model
description: Get free sports model win probabilities, fair prices, predicted scores and fantasy projections from the Bet Better API. Use when the user asks for a model chance or fair price on a game, player prop or league. No API key.
---

# Bet Better sports model

[Bet Better](https://betbetter.world/) publishes a free, read-only feed of its model output.
No API key, no sign-up, CORS on, licensed CC BY 4.0. Full reference: [Bet Better API docs](https://betbetter.world/api/).

## Feeds

Add `?format=json` to any feed.

| Feed | Path | Example |
|---|---|---|
| Ranked picks | `/{league}/picks` | https://betbetter.world/nba/picks?format=json |
| Player props | `/{league}/prop-bets` | https://betbetter.world/nba/prop-bets?format=json |
| Predicted scores | `/predicted-scores/{sport}` | https://betbetter.world/predicted-scores/nba?format=json |
| Fantasy projections | `/fantasy/{sport}` | https://betbetter.world/fantasy/ |

Some rows are members-only. They show the game, start time and market, with the numbers set to null.
Treat null as "not available", not as zero.

Cache for 15 minutes. Do not poll in a tight loop.

## Steps

1. Work out the league from the request (nba, nfl, mlb, nhl, afl, and so on).
2. Fetch the feed for that league with `?format=json`.
3. Filter to the team or player the user asked about.
4. Report the selection, game, start time, model chance and fair price.
5. Say these are model estimates, not bookmaker prices. The feed has no bookmaker odds.

## Other ways in

- MCP: `npx betbetter-mcp`, source at [edushinka/betbetter-mcp](https://github.com/edushinka/betbetter-mcp).
- Python: `pip install betbetter`.
