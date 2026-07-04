# -*- coding: utf-8 -*-
"""Generate web/src/data/group_timeline.json — each player's cumulative fantasy
score after group matchday 1, 2, 3 (3 group games per team, in date order).
Source: ESPN public scoreboard. Validates that matchday-3 == players.json total."""
import json, os, urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "web", "src", "data")
ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.WORLD/scoreboard?dates="

ALIAS = {
    "USA": "United States",
    "Cote d'Ivoire": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast",
    "Congo DR": "DR Congo", "Congo": "DR Congo",
    "Bosnia-Herzegovina": "Bosnia and Herzegovina", "Bosnia & Herzegovina": "Bosnia and Herzegovina",
    "Korea Republic": "South Korea",
    "Cape Verde Islands": "Cape Verde", "Cabo Verde": "Cape Verde",
    "Czech Republic": "Czechia",
}
norm = lambda n: ALIAS.get(n, n)

def fetch(date):
    try:
        with urllib.request.urlopen(ESPN + date, timeout=20) as r:
            return json.load(r).get("events", [])
    except Exception as e:
        print("  fetch fail", date, e); return []

# Collect each team's group games as (date, points).
team_games = defaultdict(list)
for day in range(11, 28):  # Jun 11–27 = group stage
    date = f"202606{day:02d}"
    for e in fetch(date):
        comp = e.get("competitions", [{}])[0]
        # Jun 11–27 is entirely group stage (knockouts begin Jun 28), so every
        # finished match here is a group game.
        if e.get("status", {}).get("type", {}).get("state") != "post":
            continue
        cs = comp.get("competitors", [])
        if len(cs) < 2:
            continue
        a, b = cs[0], cs[1]
        an, bn = norm(a["team"]["displayName"]), norm(b["team"]["displayName"])
        asc, bsc = int(a.get("score") or 0), int(b.get("score") or 0)
        ap = 3 if asc > bsc else 1 if asc == bsc else 0
        bp = 3 if bsc > asc else 1 if bsc == asc else 0
        team_games[an].append((date, ap))
        team_games[bn].append((date, bp))

# Cumulative points per team after games 1,2,3 (date order).
team_cum = {}
for t, games in team_games.items():
    games.sort()
    cum, run = [], 0
    for _, p in games[:3]:
        run += p; cum.append(run)
    while len(cum) < 3:
        cum.append(cum[-1] if cum else 0)
    team_cum[t] = cum

players = json.load(open(os.path.join(DATA, "players.json"), encoding="utf-8"))
out = {"labels": ["Grp 1", "Grp 2", "Grp 3"], "players": {}}
mismatch = 0
for p in players:
    md = [0, 0, 0]
    for t in p["teams"]:
        cum = team_cum.get(t["name"])
        if cum is None:
            print("  [!] no group games found for", t["name"], "(picked by", p["name"] + ")")
            cum = [t["gp"], t["gp"], t["gp"]]  # fallback: flat at final gp
        for k in range(3):
            md[k] += cum[k]
    out["players"][p["name"]] = md
    if md[2] != p["total"]:
        mismatch += 1
        print(f"  [x] {p['name']}: MD3={md[2]} but total={p['total']} (delta {md[2]-p['total']})")

with open(os.path.join(DATA, "group_timeline.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
print(f"group_timeline.json written. {len(players)} players, {len(team_cum)} teams, {mismatch} mismatches")
