# betbetter-mcp

An [MCP](https://modelcontextprotocol.io) server that gives any AI assistant access to sports model
win probabilities and fair odds across nine sports — **no API key, no sign-up, free to use.**

Data comes from the [Bet Better open model API](https://betbetter.world/api/), published under
CC BY 4.0.

## What it gives you

For every upcoming fixture the model rates, you get:

| Field | Meaning |
|---|---|
| `game` | The fixture, `Away @ Home` |
| `gameTimeUtc` | Scheduled start, UTC |
| `market` | Head to Head, Spread, Total Points, player props… |
| `selection` | The team, player or outcome being rated |
| `modelProbabilityPct` | Estimated chance it lands, 0–100 |
| `fairOdds` | Decimal odds implied by that probability |
| `confidence` | `HIGH`, `LEAN` or `LONG-SHOT` |
| `verdict` | A one-sentence plain-English summary |

**Leagues:** AFL · MLB · NBA · NFL · NHL · NCAAF · UFC · WNBA · WTA tennis · EPL · La Liga ·
Serie A · Bundesliga · Ligue 1 · World Cup.

## Install

```bash
npx betbetter-mcp
```

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "betbetter": {
      "command": "npx",
      "args": ["-y", "betbetter-mcp"]
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `list_leagues` | Lists every league slug and feed type available |
| `get_model_picks` | Rated selections for one league, filterable by minimum probability |
| `find_fixture` | Searches every league for a team or player and returns their rated selections |

### Example

> "What does the model think about the Geelong game this weekend?"

```json
{
  "game": "Geelong Cats @ Collingwood Magpies",
  "market": "Head to Head",
  "selection": "Geelong Cats",
  "modelProbabilityPct": 54.9,
  "fairOdds": 1.82,
  "confidence": "LEAN"
}
```

## What this does not do

**It publishes no bookmaker prices.** There is no bookmaker name, market price or implied
probability anywhere in the feed, and none is planned — the underlying odds data is licensed under
terms that allow publishing derived work but not redistributing the feed. Everything here is the
model's own output, so it cannot tell you where to bet or at what price.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `BETBETTER_BASE_URL` | `https://betbetter.world` | Override the API origin (testing) |

Responses are cached upstream for 15 minutes. Feeds are empty out of season — that is expected, not
an error.

## Responsible gambling

**18+. Gambling involves risk and most people lose money.** These are model estimates for research,
not betting advice, and not a guarantee of any outcome. A selection rated 70% is meant to lose
roughly three times in ten.

If gambling is causing you harm: [Gambling Help Online](https://www.gamblinghelponline.org.au/) (AU)
or [1-800-GAMBLER](https://www.ncpgambling.org/help-treatment/) (US).

## Licence

MIT for this server. The underlying data is CC BY 4.0 — free to use with attribution to
[Bet Better](https://betbetter.world).
