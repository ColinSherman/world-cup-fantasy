# -*- coding: utf-8 -*-
"""Generate web/src/data/{players.json, baseline.json} from the picks CSV.
Bracket + Elo live as JS constants in web/src/lib/bracket.js (static)."""
import csv, re, json, os, random
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV  = os.path.join(ROOT, "2026 World Cup Team Picks (Responses) - Fantasy Team Scores.csv")
OUT  = os.path.join(ROOT, "web", "src", "data")
os.makedirs(OUT, exist_ok=True)

ELO = {
 "Spain":2144,"Argentina":2144,"France":2123,"England":2028,"Brazil":2009,"Netherlands":2030,
 "Portugal":2010,"Colombia":1990,"Croatia":1970,"Germany":1965,"Belgium":1935,"Morocco":1925,
 "Japan":1875,"Switzerland":1860,"Senegal":1855,"Norway":1850,"Ecuador":1850,"Austria":1845,
 "Sweden":1815,"United States":1810,"Mexico":1800,"Algeria":1785,"Ivory Coast":1770,"Canada":1765,
 "Paraguay":1760,"Bosnia and Herzegovina":1760,"Egypt":1755,"Australia":1745,"South Africa":1730,
 "Ghana":1720,"DR Congo":1715,"Cape Verde":1650,
}
R32 = [("South Africa","Canada"),("Brazil","Japan"),("Germany","Paraguay"),("Netherlands","Morocco"),
 ("Ivory Coast","Norway"),("France","Sweden"),("Mexico","Ecuador"),("England","DR Congo"),
 ("Belgium","Senegal"),("United States","Bosnia and Herzegovina"),("Spain","Austria"),("Portugal","Croatia"),
 ("Switzerland","Algeria"),("Australia","Egypt"),("Argentina","Cape Verde"),("Colombia","Ghana")]
R16=[(1,4),(3,6),(2,5),(7,8),(12,11),(10,9),(15,14),(13,16)]; QF=[(2,1),(5,6),(3,4),(7,8)]; SF=[(1,2),(3,4)]
ALIVE=set()
for a,b in R32: ALIVE|={a,b}

def parse_cell(cell):
    grp=""
    m=re.search(r"Group\s+([A-Z])", cell)
    if m: grp=m.group(1)
    name=re.sub(r"^[^A-Za-z]+","",re.split(r"\s*-\s*Group",cell)[0]).strip()
    return name, grp

players=[]
with open(CSV,encoding="utf-8") as f: rows=list(csv.reader(f))
for r in rows[2:]:
    if len(r)<15 or not r[1].strip(): continue
    picks=[]
    for i in range(6):
        nm,grp=parse_cell(r[3+i*2])
        gp=int(r[4+i*2]) if r[4+i*2].strip() else 0
        picks.append({"name":nm,"tier":i+1,"group":grp,"gp":gp,"alive":nm in ALIVE})
    players.append({"name":r[1].strip(),"total":int(r[2]),"teams":picks})

with open(os.path.join(OUT,"players.json"),"w",encoding="utf-8") as f:
    json.dump(players,f,indent=1,ensure_ascii=False)
print(f"players.json: {len(players)} players")

# ---------- baseline projections (Elo Monte Carlo, no knockout results yet) ----------
N=200000; random.seed(11)
def wp(a,b): return 1.0/(1.0+10**((ELO[b]-ELO[a])/400.0))
def play(a,b): return a if random.random()<wp(a,b) else b
champ=defaultdict(int); win=defaultdict(float); ssum=defaultdict(float)
rounds=defaultdict(lambda: defaultdict(int))   # team -> round(1..5) reached count
for _ in range(N):
    gw=defaultdict(int)
    r32w=[play(a,b) for a,b in R32]
    for w in r32w: gw[w]+=1
    r16w=[play(r32w[x-1],r32w[y-1]) for x,y in R16]
    for w in r16w: gw[w]+=1
    qfw=[play(r16w[x-1],r16w[y-1]) for x,y in QF]
    for w in qfw: gw[w]+=1
    sfw=[play(qfw[x-1],qfw[y-1]) for x,y in SF]
    for w in sfw: gw[w]+=1
    c=play(sfw[0],sfw[1]); gw[c]+=1; champ[c]+=1
    for t in ALIVE: rounds[t][gw[t]]+=1
    tot={p["name"]:p["total"]+sum(3*gw[t["name"]] for t in p["teams"]) for p in players}
    best=max(tot.values()); ws=[n for n,v in tot.items() if v==best]
    for n in ws: win[n]+=1.0/len(ws)
    for n,v in tot.items(): ssum[n]+=v

baseline={
 "n":N,
 "poolWin":{p["name"]:round(win[p["name"]]/N,4) for p in players},
 "expFinal":{p["name"]:round(ssum[p["name"]]/N,1) for p in players},
 "champ":{t:round(champ[t]/N,4) for t in ELO if champ[t]},
 # roundProb[team][k] = P(team wins exactly k knockout games), k=0..5
 "roundProb":{t:[round(rounds[t][k]/N,4) for k in range(6)] for t in ALIVE},
}
with open(os.path.join(OUT,"baseline.json"),"w",encoding="utf-8") as f:
    json.dump(baseline,f,indent=1,ensure_ascii=False)
print("baseline.json written. Top champ:",sorted(baseline['champ'].items(),key=lambda x:-x[1])[:3])
print("Leader poolWin:",sorted(baseline['poolWin'].items(),key=lambda x:-x[1])[:3])
