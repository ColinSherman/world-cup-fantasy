# -*- coding: utf-8 -*-
"""
Monte Carlo for the World Cup Fantasy pool.
Scoring: knockout = +3 to the team that ADVANCES each round, 0 to the loser
(no draws in the bracket). Group-stage points are already locked in each
player's current total. A team therefore adds 3 x (knockout games it wins).
"""
import csv, re, random, json
from collections import defaultdict, Counter

CSV = "2026 World Cup Team Picks (Responses) - Fantasy Team Scores.csv"
N = 200_000
random.seed(42)

# ---------------- Elo ratings (June 2026) ----------------
# Top 5 anchored to confirmed June-27-2026 values; rest are best estimates.
ELO = {
    "Spain":2144,"Argentina":2144,"France":2123,"England":2028,"Brazil":2009,
    "Netherlands":2030,"Portugal":2010,"Colombia":1990,"Croatia":1970,"Germany":1965,
    "Belgium":1935,"Morocco":1925,"Japan":1875,"Switzerland":1860,"Senegal":1855,
    "Norway":1850,"Ecuador":1850,"Austria":1845,"Sweden":1815,"USA":1810,"United States":1810,
    "Mexico":1800,"Algeria":1785,"Ivory Coast":1770,"Canada":1765,"Paraguay":1760,
    "Bosnia and Herzegovina":1760,"Egypt":1755,"Australia":1745,"South Africa":1730,
    "Ghana":1720,"DR Congo":1715,"Cape Verde":1650,
}

# ---------------- Bracket (Round of 32, in official game order) ----------------
R32 = [
    ("South Africa","Canada"),("Brazil","Japan"),("Germany","Paraguay"),
    ("Netherlands","Morocco"),("Ivory Coast","Norway"),("France","Sweden"),
    ("Mexico","Ecuador"),("England","DR Congo"),("Belgium","Senegal"),
    ("United States","Bosnia and Herzegovina"),("Spain","Austria"),("Portugal","Croatia"),
    ("Switzerland","Algeria"),("Australia","Egypt"),("Argentina","Cape Verde"),
    ("Colombia","Ghana"),
]
# R16: winner of game (1-indexed) vs winner of game
R16 = [(1,4),(3,6),(2,5),(7,8),(12,11),(10,9),(15,14),(13,16)]
# QF: pairs of R16 match indices (1-indexed into R16 list)
QF = [(2,1),(5,6),(3,4),(7,8)]
# SF: pairs of QF match indices
SF = [(1,2),(3,4)]

def winp(a,b):
    """Elo win probability of a over b (no draws in knockout)."""
    return 1.0/(1.0+10**((ELO[b]-ELO[a])/400.0))

def play(a,b):
    return a if random.random() < winp(a,b) else b

# ---------------- Load players ----------------
def clean(cell):
    t = re.split(r"\s*-\s*Group", cell)[0]
    return re.sub(r"^[^A-Za-z]+","",t).strip()

players=[]
with open(CSV,encoding="utf-8") as f:
    rows=list(csv.reader(f))
for r in rows[2:]:
    if len(r)<15 or not r[1].strip(): continue
    name=r[1].strip(); total=int(r[2])
    teams=[clean(r[3+i*2]) for i in range(6)]
    players.append({"name":name,"total":total,"teams":teams})

ALL_TEAMS=set()
for a,b in R32: ALL_TEAMS.add(a); ALL_TEAMS.add(b)

# sanity: every alive picked team must have an Elo
for p in players:
    for t in p["teams"]:
        if t in ALL_TEAMS and t not in ELO:
            raise SystemExit(f"Missing Elo for {t}")

# ---------------- Simulate ----------------
win_counts=Counter()          # pool wins (ties split)
outright=Counter()            # outright (sole) wins
score_sum=defaultdict(float)
score_sq=defaultdict(float)
team_round=defaultdict(lambda: Counter())  # team -> Counter of furthest round reached
# rounds: 0=lost R32,1=R16,2=QF,3=SF,4=Final,5=Champion
champ_counts=Counter()

def simulate():
    # play bracket, record games won per team
    games_won=Counter()
    r32w=[]
    for a,b in R32:
        w=play(a,b); games_won[w]+=1; r32w.append(w)
    r16w=[]
    for x,y in R16:
        w=play(r32w[x-1],r32w[y-1]); games_won[w]+=1; r16w.append(w)
    qfw=[]
    for x,y in QF:
        w=play(r16w[x-1],r16w[y-1]); games_won[w]+=1; qfw.append(w)
    sfw=[]
    for x,y in SF:
        w=play(qfw[x-1],qfw[y-1]); games_won[w]+=1; sfw.append(w)
    champ=play(sfw[0],sfw[1]); games_won[champ]+=1
    return games_won, champ, r32w, r16w, qfw, sfw

for _ in range(N):
    games_won, champ, r32w, r16w, qfw, sfw = simulate()
    champ_counts[champ]+=1
    # furthest round per team
    advanced16=set(r32w); advancedqf=set(r16w); advancedsf=set(qfw); finalists=set(sfw)
    for t in ALL_TEAMS:
        if t==champ: team_round[t][5]+=1
        elif t in finalists: team_round[t][4]+=1
        elif t in advancedsf: team_round[t][3]+=1
        elif t in advancedqf: team_round[t][2]+=1
        elif t in advanced16: team_round[t][1]+=1
        else: team_round[t][0]+=1
    # player totals
    totals={}
    for p in players:
        s=p["total"]+sum(3*games_won[t] for t in p["teams"])
        totals[p["name"]]=s
        score_sum[p["name"]]+=s; score_sq[p["name"]]+=s*s
    best=max(totals.values())
    winners=[n for n,v in totals.items() if v==best]
    if len(winners)==1: outright[winners[0]]+=1
    for w in winners: win_counts[w]+=1.0/len(winners)

# ---------------- Report ----------------
print(f"Sims: {N:,}\n")
print("=== TEAM: probability of winning the WHOLE World Cup (sanity vs betting odds) ===")
for t,c in champ_counts.most_common(10):
    print(f"  {t:14} {c/N*100:5.1f}%")

print("\n=== POOL WIN PROBABILITY (ties split) ===")
order=sorted(players,key=lambda p:-win_counts[p["name"]])
print(f'{"Player":12} {"Now":>3} {"Win%":>6} {"Outright%":>9} {"ExpFinal":>8} {"StdDev":>6}')
for p in order:
    n=p["name"]
    mean=score_sum[n]/N
    var=score_sq[n]/N-mean*mean
    sd=var**0.5
    print(f'{n:12} {p["total"]:>3} {win_counts[n]/N*100:5.1f}% {outright[n]/N*100:8.1f}% {mean:8.1f} {sd:6.1f}')

# ---------------- Dump JSON for the future web page ----------------
out={
    "n":N,
    "elo":ELO,
    "r32":R32,"r16":R16,"qf":QF,"sf":SF,
    "players":[{"name":p["name"],"total":p["total"],"teams":p["teams"]} for p in players],
    "champ_prob":{t:champ_counts[t]/N for t in champ_counts},
    "pool_win":{p["name"]:win_counts[p["name"]]/N for p in players},
    "pool_outright":{p["name"]:outright[p["name"]]/N for p in players},
    "exp_final":{p["name"]:score_sum[p["name"]]/N for p in players},
    "team_round_probs":{t:{r:team_round[t][r]/N for r in range(6)} for t in ALL_TEAMS},
}
with open("sim_results.json","w",encoding="utf-8") as f:
    json.dump(out,f,indent=2)
print("\nWrote sim_results.json")
