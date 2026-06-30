# -*- coding: utf-8 -*-
"""
Overlap-aware elimination. For an ordered pair (P, Q) we compute the MOST P can
beat Q by in any single consistent bracket:

  max(score_P - score_Q) = (total_P - total_Q)
                         + 3 * max over brackets of [ wins(P-only teams) - wins(Q-only teams) ]

Shared teams cancel (they help both equally). If this max < 0, Q beats P in EVERY
bracket -> P is mathematically eliminated (dominated). This is strictly tighter
than the independent floor/ceiling test because it respects overlaps.
"""
import csv, re

CSV = "2026 World Cup Team Picks (Responses) - Fantasy Team Scores.csv"
R32 = [
    ("South Africa","Canada"),("Brazil","Japan"),("Germany","Paraguay"),
    ("Netherlands","Morocco"),("Ivory Coast","Norway"),("France","Sweden"),
    ("Mexico","Ecuador"),("England","DR Congo"),("Belgium","Senegal"),
    ("United States","Bosnia and Herzegovina"),("Spain","Austria"),("Portugal","Croatia"),
    ("Switzerland","Algeria"),("Australia","Egypt"),("Argentina","Cape Verde"),
    ("Colombia","Ghana"),
]
R16=[(1,4),(3,6),(2,5),(7,8),(12,11),(10,9),(15,14),(13,16)]
QF =[(2,1),(5,6),(3,4),(7,8)]
SF =[(1,2),(3,4)]

def leaf(t): return ("leaf",t)
r32=[("game",f"R32#{i}",leaf(a),leaf(b)) for i,(a,b) in enumerate(R32,1)]
r16=[("game",f"R16#{i}",r32[x-1],r32[y-1]) for i,(x,y) in enumerate(R16,1)]
qf =[("game",f"QF#{i}", r16[x-1],r16[y-1]) for i,(x,y) in enumerate(QF,1)]
sf =[("game",f"SF#{i}", qf[x-1], qf[y-1])  for i,(x,y) in enumerate(SF,1)]
FINAL=("game","F#1",sf[0],sf[1])

ALL=set()
for a,b in R32: ALL|={a,b}

def clean(c):
    t=re.split(r"\s*-\s*Group",c)[0]
    return re.sub(r"^[^A-Za-z]+","",t).strip()
players=[]
with open(CSV,encoding="utf-8") as f:
    rows=list(csv.reader(f))
for r in rows[2:]:
    if len(r)<15 or not r[1].strip(): continue
    players.append({"name":r[1].strip(),"total":int(r[2]),
                    "teams":set(clean(r[3+i*2]) for i in range(6)) & ALL})

NEG=-10**9
def best_weighted(node, wt, results):
    """dict emerging_weight(-1/0/1) -> max weighted future wins in subtree."""
    if node[0]=="leaf":
        w=wt.get(node[1],0)
        return {w:0}
    _,gid,c1,c2=node
    if gid in results:
        w=wt.get(results[gid],0)
        return {w:0}
    L=best_weighted(c1,wt,results); R=best_weighted(c2,wt,results)
    bestL=max(L.values()); bestR=max(R.values())
    out={}
    for side,other in ((L,bestR),(R,bestL)):
        for w,val in side.items():
            cand=val+w+other          # emerging team wins THIS game (+w)
            if w not in out or cand>out[w]: out[w]=cand
    return out

def max_margin(P,Q,results):
    """max over brackets of (score_P - score_Q), given decided games in results."""
    Ponly=P["teams"]-Q["teams"]; Qonly=Q["teams"]-P["teams"]
    wt={}
    for t in Ponly: wt[t]=1
    for t in Qonly: wt[t]=-1
    locked=0
    for gid,w in results.items():
        locked+=3*wt.get(w,0)
    fut=max(best_weighted(FINAL,wt,results).values())
    return (P["total"]-Q["total"]) + locked + 3*fut

def eliminated(results):
    out=[]
    for P in players:
        dominators=[]
        for Q in players:
            if P is Q: continue
            if max_margin(P,Q,results) < 0:   # Q beats P in EVERY bracket
                dominators.append(Q["name"])
        if dominators:
            out.append((P["name"],dominators))
    return out

print("="*64)
print("OVERLAP-AWARE ELIMINATION — RIGHT NOW")
print("="*64)
out=eliminated({})
if out:
    for name,doms in out: print(f"  {name}: dominated by {doms}")
else:
    print("  Nobody is eliminated even with overlaps considered.")

# Show the closest calls: smallest max-margin vs ANY rival
print("\nClosest to elimination (smallest 'best margin' over its toughest rival):")
calls=[]
for P in players:
    worst=min((max_margin(P,Q,{}),Q["name"]) for Q in players if Q is not P)
    calls.append((P["name"],worst[0],worst[1]))
calls.sort(key=lambda x:x[1])
for name,m,q in calls[:10]:
    uniq=[p for p in players if p["name"]==name][0]
    print(f"  {name:12} can beat toughest rival ({q}) by at most +{m:>3}  "
          f"(needs >=0 to survive)")

# ---- Forward: does any SINGLE R32 result create an elimination now? ----
print("\n"+"="*64)
print("DO EARLY RESULTS TRIGGER ELIMINATIONS (overlap-aware)?")
print("="*64)
def scan(decided_list, label):
    found=False
    out=eliminated(dict(decided_list))
    if out:
        found=True
        print(f"  [{label}] -> {[(n,d) for n,d in out]}")
    return found

any1=False
for i,(a,b) in enumerate(R32,1):
    for w in (a,b):
        o=eliminated({f"R32#{i}":w})
        if o:
            any1=True
            print(f"  Game{i} {a} v {b}: {w} wins -> {[(n,d) for n,d in o]}")
if not any1:
    print("  No single R32 result eliminates anyone (even with overlaps).")

# how many R32 games (worst case) until first elimination is POSSIBLE
print("\nEarliest possible elimination — minimal team-death scenario per fragile player:")
fragile = sorted(players, key=lambda P: min(max_margin(P,Q,{}) for Q in players if Q is not P))[:6]
for P in fragile:
    # find the rival with the tightest margin and what unique-team wins P needs
    Q=min((Q for Q in players if Q is not P), key=lambda Q:max_margin(P,Q,{}))
    Ponly=P["teams"]-Q["teams"]; Qonly=Q["teams"]-P["teams"]
    print(f"  {P['name']:12} vs {Q['name']:12} | P-only:{sorted(Ponly)}  Q-only:{sorted(Qonly)}")
