# -*- coding: utf-8 -*-
"""Conditional Monte Carlo: pool-win odds if South Africa wins Game 1 vs if Canada wins.
Common random numbers across the two scenarios => clean deltas."""
import csv, re, random
from collections import defaultdict
CSV="2026 World Cup Team Picks (Responses) - Fantasy Team Scores.csv"
N=200000; random.seed(7)
ELO={"Spain":2144,"Argentina":2144,"France":2123,"England":2028,"Brazil":2009,"Netherlands":2030,
"Portugal":2010,"Colombia":1990,"Croatia":1970,"Germany":1965,"Belgium":1935,"Morocco":1925,"Japan":1875,
"Switzerland":1860,"Senegal":1855,"Norway":1850,"Ecuador":1850,"Austria":1845,"Sweden":1815,"USA":1810,
"United States":1810,"Mexico":1800,"Algeria":1785,"Ivory Coast":1770,"Canada":1765,"Paraguay":1760,
"Bosnia and Herzegovina":1760,"Egypt":1755,"Australia":1745,"South Africa":1730,"Ghana":1720,"DR Congo":1715,"Cape Verde":1650}
R32=[("South Africa","Canada"),("Brazil","Japan"),("Germany","Paraguay"),("Netherlands","Morocco"),
("Ivory Coast","Norway"),("France","Sweden"),("Mexico","Ecuador"),("England","DR Congo"),
("Belgium","Senegal"),("United States","Bosnia and Herzegovina"),("Spain","Austria"),("Portugal","Croatia"),
("Switzerland","Algeria"),("Australia","Egypt"),("Argentina","Cape Verde"),("Colombia","Ghana")]
R16=[(1,4),(3,6),(2,5),(7,8),(12,11),(10,9),(15,14),(13,16)]; QF=[(2,1),(5,6),(3,4),(7,8)]; SF=[(1,2),(3,4)]
def wp(a,b): return 1.0/(1.0+10**((ELO[b]-ELO[a])/400.0))
def clean(c): return re.sub(r"^[^A-Za-z]+","",re.split(r"\s*-\s*Group",c)[0]).strip()
ALL=set()
for a,b in R32: ALL|={a,b}
players=[]
with open(CSV,encoding="utf-8") as f: rows=list(csv.reader(f))
for r in rows[2:]:
    if len(r)<15 or not r[1].strip(): continue
    players.append({"name":r[1].strip(),"total":int(r[2]),"teams":[clean(r[3+i*2]) for i in range(6)]})

def run(rv, force1):
    gw=defaultdict(int)
    r32w=[]
    for i,(a,b) in enumerate(R32):
        if i==0 and force1: w=force1
        else: w=a if rv[i]<wp(a,b) else b
        gw[w]+=1; r32w.append(w)
    r16w=[]
    for j,(x,y) in enumerate(R16):
        a,b=r32w[x-1],r32w[y-1]; w=a if rv[16+j]<wp(a,b) else b; gw[w]+=1; r16w.append(w)
    qfw=[]
    for j,(x,y) in enumerate(QF):
        a,b=r16w[x-1],r16w[y-1]; w=a if rv[24+j]<wp(a,b) else b; gw[w]+=1; qfw.append(w)
    sfw=[]
    for j,(x,y) in enumerate(SF):
        a,b=qfw[x-1],qfw[y-1]; w=a if rv[28+j]<wp(a,b) else b; gw[w]+=1; sfw.append(w)
    a,b=sfw[0],sfw[1]; w=a if rv[30]<wp(a,b) else b; gw[w]+=1
    return gw

def tally(force1):
    win=defaultdict(float); ssum=defaultdict(float)
    rng=random.Random(7)   # identical stream per scenario => common random numbers
    for _ in range(N):
        rv=[rng.random() for _ in range(31)]
        gw=run(rv,force1)
        tot={p["name"]:p["total"]+sum(3*gw[t] for t in p["teams"]) for p in players}
        best=max(tot.values()); winners=[n for n,v in tot.items() if v==best]
        for n in winners: win[n]+=1.0/len(winners)
        for n,v in tot.items(): ssum[n]+=v
    return {p['name']:win[p['name']]/N*100 for p in players},{p['name']:ssum[p['name']]/N for p in players}

wSA,eSA=tally("South Africa")
wCA,eCA=tally("Canada")
pSA=wp("South Africa","Canada")*100
print(f"P(South Africa beats Canada) per Elo = {pSA:.0f}%   (Canada {100-pSA:.0f}%)\n")
print(f"{'Player':12}{'SA win%':>9}{'CA win%':>9}{'swing':>8}{'ExpSA':>8}{'ExpCA':>8}")
order=sorted(players,key=lambda p:-(wSA[p['name']]+wCA[p['name']]))
for p in order:
    n=p['name']; sw=wCA[n]-wSA[n]
    print(f"{n:12}{wSA[n]:8.1f}%{wCA[n]:8.1f}%{sw:+7.1f}{eSA[n]:8.1f}{eCA[n]:8.1f}")
print("\nswing = (Canada-win pool%) minus (SA-win pool%); + means Canada winning helps them")
