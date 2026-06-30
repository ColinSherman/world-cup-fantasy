# -*- coding: utf-8 -*-
import csv, re
CSV="2026 World Cup Team Picks (Responses) - Fantasy Team Scores.csv"
R32=[("South Africa","Canada"),("Brazil","Japan"),("Germany","Paraguay"),("Netherlands","Morocco"),
("Ivory Coast","Norway"),("France","Sweden"),("Mexico","Ecuador"),("England","DR Congo"),
("Belgium","Senegal"),("United States","Bosnia and Herzegovina"),("Spain","Austria"),("Portugal","Croatia"),
("Switzerland","Algeria"),("Australia","Egypt"),("Argentina","Cape Verde"),("Colombia","Ghana")]
R16=[(1,4),(3,6),(2,5),(7,8),(12,11),(10,9),(15,14),(13,16)]; QF=[(2,1),(5,6),(3,4),(7,8)]; SF=[(1,2),(3,4)]
def leaf(t):return("leaf",t)
r32=[("game",f"R32#{i}",leaf(a),leaf(b)) for i,(a,b) in enumerate(R32,1)]
r16=[("game",f"R16#{i}",r32[x-1],r32[y-1]) for i,(x,y) in enumerate(R16,1)]
qf=[("game",f"QF#{i}",r16[x-1],r16[y-1]) for i,(x,y) in enumerate(QF,1)]
sf=[("game",f"SF#{i}",qf[x-1],qf[y-1]) for i,(x,y) in enumerate(SF,1)]
FINAL=("game","F#1",sf[0],sf[1])
ALL=set()
for a,b in R32: ALL|={a,b}
def clean(c): return re.sub(r"^[^A-Za-z]+","",re.split(r"\s*-\s*Group",c)[0]).strip()
players=[]
with open(CSV,encoding="utf-8") as f: rows=list(csv.reader(f))
for r in rows[2:]:
    if len(r)<15 or not r[1].strip(): continue
    players.append({"name":r[1].strip(),"total":int(r[2]),"teams":set(clean(r[3+i*2]) for i in range(6))&ALL})
NEG=-10**9
def mow(node,owned,res):
    if node[0]=="leaf": return (0,NEG) if node[1] in owned else (NEG,0)
    _,g,c1,c2=node
    if g in res:
        w=res[g]; return (0,NEG) if w in owned else (NEG,0)
    L=mow(c1,owned,res);R=mow(c2,owned,res);bL=max(L);bR=max(R)
    return (max(L[0]+bR+1,R[0]+bL+1), max(L[1]+bR,R[1]+bL))
def fc(p,res):
    o=p["teams"]; lock=sum(3 for g,w in res.items() if w in o)
    fl=p["total"]+lock; fut=max(max(mow(FINAL,o,res)),0); return fl,fl+3*fut
def bw(node,wt,res):
    if node[0]=="leaf": return {wt.get(node[1],0):0}
    _,g,c1,c2=node
    if g in res: return {wt.get(res[g],0):0}
    L=bw(c1,wt,res);R=bw(c2,wt,res);bL=max(L.values());bR=max(R.values());o={}
    for side,oth in ((L,bR),(R,bL)):
        for w,v in side.items():
            c=v+w+oth
            if w not in o or c>o[w]: o[w]=c
    return o
def margin(P,Q,res):
    Po=P["teams"]-Q["teams"];Qo=Q["teams"]-P["teams"];wt={}
    for t in Po:wt[t]=1
    for t in Qo:wt[t]=-1
    lock=sum(3*wt.get(w,0) for w in res.values())
    return (P["total"]-Q["total"])+lock+3*max(bw(FINAL,wt,res).values())
def elim(res):
    out=[]
    for P in players:
        d=[Q["name"] for Q in players if Q is not P and margin(P,Q,res)<0]
        if d: out.append((P["name"],d))
    return out

base_elim={n for n,_ in elim({})}
scenarios={"SOUTH AFRICA WINS":{"R32#1":"South Africa"},"CANADA WINS":{"R32#1":"Canada"}}
print("Owners — South Africa:",sorted(p['name'] for p in players if "South Africa" in p['teams']))
print("Owners — Canada:      ",sorted(p['name'] for p in players if "Canada" in p['teams']))
base={p['name']:fc(p,{}) for p in players}
for label,res in scenarios.items():
    print("\n"+"="*58); print(label); print("="*58)
    print(f"{'Player':12}{'floor':>7}{'d_floor':>7}{'ceiling':>9}{'d_ceil':>7}")
    rows=[]
    for p in players:
        fl,ce=fc(p,res); bfl,bce=base[p['name']]
        rows.append((p['name'],fl,fl-bfl,ce,ce-bce))
    for n,fl,df,ce,dc in sorted(rows,key=lambda x:-x[1]):
        if df or dc:
            print(f"{n:12}{fl:7}{df:+7}{ce:9}{dc:+7}")
    new=[ (n,d) for n,d in elim(res) if n not in base_elim]
    print("New eliminations:", new if new else "none")
