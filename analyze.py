# -*- coding: utf-8 -*-
import csv, re, sys
io_path = "2026 World Cup Team Picks (Responses) - Fantasy Team Scores.csv"

# ---- The 32 teams that advanced (from Wikipedia knockout bracket) ----
# Round of 32 matchups: each tuple is (teamA, teamB). Winner advances.
R32 = [
    ("South Africa", "Canada"),
    ("Brazil", "Japan"),
    ("Germany", "Paraguay"),
    ("Netherlands", "Morocco"),
    ("Ivory Coast", "Norway"),
    ("France", "Sweden"),
    ("Mexico", "Ecuador"),
    ("England", "DR Congo"),
    ("Belgium", "Senegal"),
    ("United States", "Bosnia and Herzegovina"),
    ("Spain", "Austria"),
    ("Portugal", "Croatia"),
    ("Switzerland", "Algeria"),
    ("Australia", "Egypt"),
    ("Argentina", "Cape Verde"),
    ("Colombia", "Ghana"),
]
ALIVE = set()
for a,b in R32:
    ALIVE.add(a); ALIVE.add(b)

# map team -> its R32 opponent (for collision detection)
opp = {}
for a,b in R32:
    opp[a]=b; opp[b]=a

def clean_team(cell):
    # strip leading flag emoji + spaces, and trailing " - Group X"
    if not cell: return None
    t = cell
    # remove "- Group X" suffix
    t = re.split(r"\s*-\s*Group", t)[0]
    # remove any non-letter leading chars (flags)
    t = re.sub(r"^[^A-Za-z]+", "", t).strip()
    return t

players = []
with open(io_path, encoding="utf-8") as f:
    rows = list(csv.reader(f))
# header is row index 1 (0-based): ,Name,Team Score,Tier1 Team,Tier1 Score,...
for r in rows[2:]:
    if len(r) < 15 or not r[1].strip():
        continue
    name = r[1].strip()
    total = int(r[2])
    picks = []
    for ti in range(6):
        tcol = 3 + ti*2
        scol = 4 + ti*2
        team = clean_team(r[tcol])
        score = int(r[scol]) if r[scol].strip() else 0
        picks.append((ti+1, team, score, r[tcol].split(" - ")[-1].strip() if " - " in r[tcol] else ""))
    players.append({"name":name,"total":total,"picks":picks})

# sanity: recompute totals
print("=== TOTAL CHECK ===")
for p in players:
    s = sum(x[2] for x in p["picks"])
    flag = "" if s==p["total"] else "  <-- MISMATCH"
    # print(f'{p["name"]}: csv={p["total"]} sum={s}{flag}')
    if flag: print(f'{p["name"]}: csv={p["total"]} sum={s}{flag}')
print("(only mismatches shown)")

MAX_KO_POINTS = 15  # 5 knockout games * 3 (champion path)

print("\n=== PER PLAYER: live/dead teams, floor, ceiling ===")
results=[]
floors=[p["total"] for p in players]
max_floor = max(floors)
for p in players:
    live=[]; dead=[]
    for (tier,team,score,grp) in p["picks"]:
        if team in ALIVE:
            live.append((team,score))
        else:
            dead.append((team,score))
    # ceiling with intra-player R32 collision handling:
    # if a player holds both sides of an R32 match, only one can advance past R32.
    # Both still play the R32 game (max 3 each), but only one can earn the remaining 12.
    live_names=[t for t,_ in live]
    n_live=len(live)
    collisions=0
    seen=set()
    for t in live_names:
        if opp.get(t) in live_names and t not in seen and opp.get(t) not in seen:
            collisions+=1
            seen.add(t); seen.add(opp[t])
    # naive ceiling
    ceiling_naive = p["total"] + MAX_KO_POINTS*n_live
    # collision-adjusted: each colliding pair loses 12 pts of the "loser" (keeps 3 for the R32 game)
    ceiling_adj = ceiling_naive - collisions*12
    results.append({
        "name":p["name"],"total":p["total"],"n_live":n_live,
        "live":live,"dead":dead,"ceiling":ceiling_adj,"collisions":collisions
    })

results.sort(key=lambda x:(-x["total"], -x["ceiling"]))
print(f"Leader floor (locked) = {max_floor}\n")
for r in results:
    live_s=", ".join(f"{t}({s})" for t,s in r["live"])
    dead_s=", ".join(f"{t}({s})" for t,s in r["dead"]) or "—"
    elim = "DEAD-TO-WIN" if r["ceiling"] < max_floor else ""
    coll = f" [collisions:{r['collisions']}]" if r["collisions"] else ""
    print(f'{r["name"]:12} cur={r["total"]:2} live={r["n_live"]} ceil={r["ceiling"]:3}{coll} {elim}')
    print(f'   LIVE: {live_s}')
    print(f'   OUT : {dead_s}')

print("\n=== ELIMINATION FROM CONTENTION (rigorous) ===")
elim=[r for r in results if r["ceiling"]<max_floor]
if not elim:
    print("Nobody is mathematically eliminated yet (max possible >= leader's locked floor for all).")
else:
    for r in elim:
        print(f'{r["name"]}: ceiling {r["ceiling"]} < leader floor {max_floor}')

# Who has the most live teams / strongest position
print("\n=== LIVE TEAM COUNT DISTRIBUTION ===")
from collections import Counter
c=Counter(r["n_live"] for r in results)
for k in sorted(c, reverse=True):
    print(f'{k} live teams: {c[k]} players')
