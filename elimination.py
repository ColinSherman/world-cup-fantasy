# -*- coding: utf-8 -*-
"""
Rigorous mathematical-elimination engine.
- floor(P)   = locked points = current total + 3 * (knockout games already decided in P's favor)
- ceiling(P) = floor(P) + 3 * (max FUTURE games P's still-alive teams can win, accounting
               for bracket collisions among P's OWN teams via a tree DP)
A player is eliminated from winning when some other player's floor > their ceiling.
Scoring: knockout advance = +3, no draws (the league's likely rule).
"""
import csv, re
from itertools import product

CSV = "2026 World Cup Team Picks (Responses) - Fantasy Team Scores.csv"

R32 = [
    ("South Africa","Canada"),("Brazil","Japan"),("Germany","Paraguay"),
    ("Netherlands","Morocco"),("Ivory Coast","Norway"),("France","Sweden"),
    ("Mexico","Ecuador"),("England","DR Congo"),("Belgium","Senegal"),
    ("United States","Bosnia and Herzegovina"),("Spain","Austria"),("Portugal","Croatia"),
    ("Switzerland","Algeria"),("Australia","Egypt"),("Argentina","Cape Verde"),
    ("Colombia","Ghana"),
]
R16 = [(1,4),(3,6),(2,5),(7,8),(12,11),(10,9),(15,14),(13,16)]  # R32 game indices
QF  = [(2,1),(5,6),(3,4),(7,8)]                                  # R16 indices
SF  = [(1,2),(3,4)]                                              # QF indices

# ---- Build the tournament tree as nested nodes with a stable game id ----
# node = ("leaf", team) | ("game", id, child1, child2)
def leaf(t): return ("leaf", t)
r32_nodes=[]
for i,(a,b) in enumerate(R32, start=1):
    r32_nodes.append(("game", f"R32#{i}", leaf(a), leaf(b)))
r16_nodes=[]
for i,(x,y) in enumerate(R16, start=1):
    r16_nodes.append(("game", f"R16#{i}", r32_nodes[x-1], r32_nodes[y-1]))
qf_nodes=[]
for i,(x,y) in enumerate(QF, start=1):
    qf_nodes.append(("game", f"QF#{i}", r16_nodes[x-1], r16_nodes[y-1]))
sf_nodes=[]
for i,(x,y) in enumerate(SF, start=1):
    sf_nodes.append(("game", f"SF#{i}", qf_nodes[x-1], qf_nodes[y-1]))
FINAL = ("game", "F#1", sf_nodes[0], sf_nodes[1])

ALL_TEAMS=set()
for a,b in R32: ALL_TEAMS|={a,b}

# ---- Load players ----
def clean(c):
    t=re.split(r"\s*-\s*Group",c)[0]
    return re.sub(r"^[^A-Za-z]+","",t).strip()
players=[]
with open(CSV,encoding="utf-8") as f:
    rows=list(csv.reader(f))
for r in rows[2:]:
    if len(r)<15 or not r[1].strip(): continue
    players.append({"name":r[1].strip(),"total":int(r[2]),
                    "teams":[clean(r[3+i*2]) for i in range(6)]})

NEG=-10**9
def max_owned_wins(node, owned, results):
    """Return (W_own, W_nonown): max FUTURE owned game-wins in this subtree given an
    owned / non-owned team emerges. `results` maps game id -> winner (decided games).
    Decided games contribute 0 future wins (they're already locked into floor)."""
    typ=node[0]
    if typ=="leaf":
        t=node[1]
        return (0,NEG) if t in owned else (NEG,0)
    _,gid,c1,c2=node
    if gid in results:                      # game already played -> emerges = winner, 0 future
        w=results[gid]
        return (0,NEG) if w in owned else (NEG,0)
    L=max_owned_wins(c1,owned,results)
    R=max_owned_wins(c2,owned,results)
    Lfree=max(L); Rfree=max(R)
    W_own   = max(L[0]+Rfree+1, R[0]+Lfree+1)        # owned team wins this game (+1)
    W_nonown= max(L[1]+Rfree,   R[1]+Lfree)          # non-owned wins this game (+0)
    return (W_own, W_nonown)

def floor_ceiling(player, results):
    owned=set(t for t in player["teams"] if t in ALL_TEAMS)
    locked=sum(3 for gid,w in results.items() if w in owned)   # decided owned wins
    fl=player["total"]+locked
    fut=max(max_owned_wins(FINAL, owned, results))
    fut=max(fut,0)
    return fl, fl+3*fut

def standings(results):
    rows=[]
    for p in players:
        fl,ce=floor_ceiling(p,results)
        rows.append({"name":p["name"],"floor":fl,"ceiling":ce})
    return rows

def eliminated(results):
    rows=standings(results)
    out=[]
    for r in rows:
        bar=max(o["floor"] for o in rows if o["name"]!=r["name"])
        if r["ceiling"]<bar:
            out.append((r["name"],r["ceiling"],bar))
    return out, rows

# ================== NOW ==================
print("="*60)
print("RIGHT NOW (group stage done, no knockout games played)")
print("="*60)
out,rows=eliminated({})
rows.sort(key=lambda x:-x["ceiling"])
maxfloor=max(r["floor"] for r in rows)
print(f"Highest locked floor (Nicole) = {maxfloor}")
print(f"{'Player':12} {'floor':>5} {'ceiling':>7}")
for r in rows:
    print(f"{r['name']:12} {r['floor']:5} {r['ceiling']:7}")
print("\nEliminated now:", out if out else "NOBODY")
print("Lowest ceiling in the pool:", min(r['ceiling'] for r in rows),
      "-> still far above the", maxfloor, "bar")

# ============ EFFECT OF EACH SINGLE R32 GAME ============
print("\n"+"="*60)
print("DOES ANY SINGLE ROUND-OF-32 RESULT ELIMINATE ANYONE?")
print("="*60)
any_elim=False
for i,(a,b) in enumerate(R32, start=1):
    for w in (a,b):
        out,_=eliminated({f"R32#{i}":w})
        if out:
            any_elim=True
            print(f"  Game{i} {a} v {b}: if {w} wins -> eliminates {[o[0] for o in out]}")
if not any_elim:
    print("  NO. No single R32 result eliminates anyone.")

# ============ MAX ELIMINATIONS AFTER THE FULL FIRST ROUND ============
print("\n"+"="*60)
print("CAN ANYONE BE ELIMINATED ONCE THE FULL ROUND OF 32 IS DONE?")
print("(adversarial: for each player, try to knock them out)")
print("="*60)
def try_eliminate_after_r32(P):
    """Find an R32 outcome set that eliminates P, if one exists.
    Strategy: pick a bar-setter Q; Q's R32 teams win, P's R32 teams lose."""
    P_owned=set(t for t in P["teams"] if t in ALL_TEAMS)
    best=None
    for Q in players:
        if Q["name"]==P["name"]: continue
        Q_owned=set(t for t in Q["teams"] if t in ALL_TEAMS)
        res={}
        ok=True
        for i,(a,b) in enumerate(R32, start=1):
            gid=f"R32#{i}"
            qa,qb = a in Q_owned, b in Q_owned
            pa,pb = a in P_owned, b in P_owned
            # Q wants its team to win; P wants its team to lose
            if qa and not qb: res[gid]=a
            elif qb and not qa: res[gid]=b
            elif pa and not pb: res[gid]=b      # P's team loses
            elif pb and not pa: res[gid]=a
            # else: irrelevant, leave undecided (doesn't change P ceil or Q floor)
        flP,ceP=floor_ceiling(P,res)
        flQ,_=floor_ceiling(Q,res)
        if flQ>ceP:
            if best is None or flQ-ceP>best[1]:
                best=(Q["name"],flQ-ceP,ceP,flQ,res)
    return best

elim_after_r32=[]
for P in players:
    b=try_eliminate_after_r32(P)
    if b: elim_after_r32.append((P["name"],b))
if elim_after_r32:
    for name,(Q,margin,ceP,flQ,res) in sorted(elim_after_r32,key=lambda x:-x[1][1]):
        # describe which of P's teams must lose
        P=next(p for p in players if p["name"]==name)
        P_owned=set(t for t in P["teams"] if t in ALL_TEAMS)
        lose=[t for t in P_owned if any(res.get(f"R32#{i}")== (b2 if a2==t else a2)
                                        for i,(a2,b2) in enumerate(R32,1) if t in (a2,b2))]
        print(f"  {name:12} OUT if all of {sorted(P_owned)} lose R32 "
              f"AND {Q} sweeps (their ceil {ceP} < {Q}'s floor {flQ})")
else:
    print("  Nobody can be eliminated even after the entire Round of 32.")

# how many teams must a player lose before they're even at risk
print("\n"+"="*60)
print("FRAGILITY: lowest-ceiling players (first at risk as teams fall)")
print("="*60)
rows=standings({})
rows.sort(key=lambda x:x["ceiling"])
for r in rows[:8]:
    print(f"  {r['name']:12} ceiling {r['ceiling']}  (needs an opponent floor > {r['ceiling']} to die)")
