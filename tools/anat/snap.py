import json, numpy as np, pickle
from scipy.spatial import cKDTree
from scipy.interpolate import RBFInterpolator
S=pickle.load(open('skin.pkl','rb')); SV,SF,VN,SR=S['SV'],S['SF'],S['VN'],S['SR']
PO=np.load('rbf_PO.npy'); D=np.load('rbf_D.npy')
rbf=RBFInterpolator(PO,D,kernel='thin_plate_spline',smoothing=2e-5)
warp=lambda P: np.asarray(P,float)+rbf(np.asarray(P,float))
old=json.load(open('old.json'))
# vertex->faces adjacency
from collections import defaultdict
adj=[[] for _ in range(len(SV))]
for fi,(a,b,c) in enumerate(SF): adj[a].append(fi); adj[b].append(fi); adj[c].append(fi)
REG={}
for r in ['core','armL','armR','legL','legR']: REG[r]=np.where(SR==r)[0]
trees={}
def allowed(reg):
    side=reg[-1] if reg[-1] in 'LR' else ''
    if reg=='core': return ('core','legL','legR')
    if reg.startswith('jarm'): return ('arm'+side,'core')
    if reg.startswith('arm'): return ('arm'+side,)
    if reg.startswith('jleg') or reg.startswith('leg'): return ('leg'+side,'core')
    return ('core',)
def tree(key):
    if key not in trees:
        idx=np.concatenate([REG[r] for r in key]); trees[key]=(cKDTree(SV[idx]),idx)
    return trees[key]
def closest_tri(p,a,b,c):
    ab=b-a; ac=c-a; ap=p-a
    d1=ab@ap; d2=ac@ap
    if d1<=0 and d2<=0: return a
    bp=p-b; d3=ab@bp; d4=ac@bp
    if d3>=0 and d4<=d3: return b
    vc=d1*d4-d3*d2
    if vc<=0 and d1>=0 and d3<=0: return a+ab*(d1/(d1-d3))
    cp=p-c; d5=ab@cp; d6=ac@cp
    if d6>=0 and d5<=d6: return c
    vb=d5*d2-d1*d6
    if vb<=0 and d2>=0 and d6<=0: return a+ac*(d2/(d2-d6))
    va=d3*d6-d5*d4
    if va<=0 and (d4-d3)>=0 and (d5-d6)>=0: return b+(c-b)*((d4-d3)/((d4-d3)+(d5-d6)))
    den=1/(va+vb+vc); v=vb*den; w=vc*den; return a+ab*v+ac*w
def snap(p,reg,off):
    t,idx=tree(allowed(reg)); _,k=t.query(p,k=6); best=None;bd=9
    for vi in idx[k]:
        for fi in adj[vi]:
            a,b,c=SV[SF[fi]]; q=closest_tri(p,a,b,c); d=np.linalg.norm(q-p)
            if d<bd: bd=d; best=(q,fi)
    q,fi=best; a,b,c=SV[SF[fi]]; n=np.cross(b-a,c-a); ln=np.linalg.norm(n); n=n/ln if ln>1e-12 else np.zeros(3)
    return q+n*off, bd
def resample(P,R,step=0.006):
    P=np.asarray(P); seg=np.linalg.norm(np.diff(P,axis=0),axis=1); s=np.r_[0,np.cumsum(seg)]
    if s[-1]<1e-6: return P,R
    n=max(2,int(s[-1]/step)+1); ss=np.linspace(0,s[-1],n)
    Q=np.stack([np.interp(ss,s,P[:,k]) for k in range(3)],1)
    Ri=[R[min(len(R)-1,np.searchsorted(s,x))] for x in ss]
    return Q,Ri
def line(pts,regs,off):
    W=warp(pts); Q,R=resample(W,regs)
    out=np.array([snap(q,r,0)[0] for q,r in zip(Q,R)])
    for it in range(2):
        sm=out.copy(); sm[1:-1]=(out[:-2]+out[1:-1]*2+out[2:])/4
        out=np.array([snap(q,r,0)[0] for q,r in zip(sm,R)])
    res=np.array([snap(q,r,off)[0] for q,r in zip(out,R)])
    return res
rnd=lambda A: [round(float(x),4) for x in np.asarray(A).ravel()]
geo={'mer':{},'pts':{},'sinew':{},'fib':{}}
bad=[]
for mid,arr in old['mer'].items():
    geo['mer'][mid]=[rnd(line(o['pts'],o['reg'],0.003)) for o in arr]
for sid,o in old['sinew'].items():
    geo['sinew'][sid]={'paths':[rnd(line(p['pts'],p['reg'],0.0045)) for p in o['paths']],
      'knots':[{'name':k['name'],'p':rnd(snap(warp([k['p']])[0],k['reg'],0.005)[0])} for k in o['knots']]}
for pid,arr in old['points'].items():
    L=[]
    for o in arr:
        w=warp([o['p']])[0]; q,d=snap(w,o['reg'],0.0035)
        if d>0.025: bad.append((pid,o['s'],round(d,3)))
        L.append(rnd(q))
    geo['pts'][pid]=L
# fibers (direction overlays): warp only
for mid,arr in [(k,v) for k,v in old['fibers'].items() if k=='tfl_itb']:
    geo['fib'][mid]=[[rnd(warp(l)) for l in o['lines']] for o in arr]
json.dump(geo,open('geo.json','w'),separators=(',',':'))
print('bad snaps',bad)
import os; print(os.path.getsize('geo.json'))
