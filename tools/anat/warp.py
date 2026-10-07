import json, struct, numpy as np, re, sys
from scipy.spatial import cKDTree
from scipy.interpolate import RBFInterpolator
man=json.load(open('anatomy.json')); sel=json.load(open('sel2.json')); cz=man['cz']
LMJ=json.load(open('landmarks.json')); old=json.load(open('old.json'))
def load(fid):
    b=open('simp/%s.bin'%fid,'rb').read(); nv,ni=struct.unpack('II',b[:8])
    P=np.frombuffer(b,np.float32,nv*3,8).reshape(-1,3).astype(np.float64)
    I=np.frombuffer(b,np.uint32,ni,8+nv*12).reshape(-1,3).astype(np.int64)
    return np.stack([P[:,0]/1000,P[:,2]/1000,-P[:,1]/1000-cz],1),I
import pickle
S=pickle.load(open('skin.pkl','rb')); SV,SF,VN,SR=S['SV'],S['SF'],S['VN'],S['SR']
L={k:np.array(v) for k,v in LMJ['L'].items()}
def mir(p,s): q=np.array(p,float).copy(); q[0]*=s; return q
# ---------- y map old->real ----------
VO={}; 
for nm,s,p in old['lm']:
    if nm.startswith('VB:'): VO[nm[3:]]=p[1]
pairs=[(0.0,0.0),(0.085,L['ankle'][1]),(0.505,L['knee'][1]),(0.915,L['hip'][1])]
for k,v in LMJ['VERT'].items(): 
    if k in VO: pairs.append((VO[k],v['y']))
pairs.append((1.595+0.108, SV[:,1].max()))
pairs=sorted(pairs); 
# enforce monotonic
xs=[];ys=[]
for a,b in pairs:
    if xs and (a<=xs[-1] or b<=ys[-1]): continue
    xs.append(a);ys.append(b)
ymap=lambda y: np.interp(y,xs,ys)
# ---------- ray hit ----------
def ray(o,d,allowed,maxd=0.4):
    d=d/np.linalg.norm(d); w=SV-o; t=w@d; perp=np.linalg.norm(w-np.outer(t,d),axis=1)
    m=(t>0.004)&(perp<0.012)&(t<maxd)
    if allowed is not None: m&=np.isin(SR,allowed)
    if not m.any(): return None
    i=np.where(m)[0]; j=i[np.argmin(t[i])]
    # verify first hit overall is allowed region (avoid passing through other regions)
    m2=(t>0.004)&(perp<0.012)&(t<t[j]-0.006)
    if m2.any(): return None
    return o+d*t[j]
pairs_o=[];pairs_r=[];tags=[]
def addp(o,r,tag): pairs_o.append(np.array(o,float)); pairs_r.append(np.array(r,float)); tags.append(tag)
# landmarks
RMAP={'J:shoulder':'shoulder','J:elbow':'elbow','J:wrist':'wrist','J:handTip':'handTip','J:hip':'hip','J:knee':'knee','J:ankle':'ankle'}
for nm,s,p in old['lm']:
    if nm.startswith('L:') and nm[2:] in L: addp(p,mir(L[nm[2:]],s if s else 1) if nm[2:] not in ('EOP','pubicSym','sternumTop','manubrium','xiphoid') else L[nm[2:]]*[0,1,1],nm)
    elif nm in RMAP: addp(p,mir(L[RMAP[nm]],s),nm)
    elif nm.startswith('F:'): addp(p,mir(LMJ['fing'][nm[2:]],s),nm)
    elif nm.startswith('Fb:'): addp(p,mir(LMJ['fing'][nm[3:]+'base'],s),nm)
    elif nm.startswith('T:'): addp(p,mir(LMJ['toes'][nm[2:]],s),nm)
    elif nm.startswith('VB:') or nm.startswith('SP:'):
        k=nm[3:]; v=LMJ['VERT'].get(k)
        if v: addp(p, v['body'] if nm[:2]=='VB' else v['sp'], nm)
nl=len(pairs_o); print('landmark pairs',nl)
# real torso center & radii per level
def torso_info(yr):
    m=(np.abs(SV[:,1]-yr)<0.006)&(np.abs(SV[:,0])<0.03)&(SR=="core")
    if m.sum()<2: return None
    zf=SV[m,2].max(); zb=SV[m,2].min(); zc=(zf+zb)/2; o=np.array([0,yr,zc])
    hf=ray(o,np.array([0,0,1.]),['core']); hb=ray(o,np.array([0,0,-1.]),['core']); hl=ray(o,np.array([1.,0,0]),['core']); hr=ray(o,np.array([-1.,0,0]),['core'])
    if hf is None or hb is None or hl is None or hr is None: return None
    return o, hf[2]-zc, zc-hb[2], (hl[0]-hr[0])/2
import math
ti={}
for row in old['surf']:
    kind=row[0]
    if kind in('T','N'):
        y,ph,p=row[1],row[2],np.array(row[3]); yr=float(ymap(y))
        key=round(yr,4)
        if key not in ti: ti[key]=torso_info(yr)
        info=ti[key]
        if info is None: continue
        o,Zf,Zb,W=info
        # old profile
        sx=math.sin(math.radians(ph)); czz=math.cos(math.radians(ph))
        # old normalized coords: use old point / old extents at angle 0/90/180
        d=np.array([sx*W, 0, czz*(Zf if czz>=0 else Zb)])
        if np.linalg.norm(d)<1e-6: continue
        # superellipse-ish direction: approximate by mapping old point normalized
        h=ray(o,d,['core'])
        if h is not None: addp(p,h,'T')
    elif kind.startswith('S:'):
        seg=kind[2:]; s=row[1]; t=row[2]; th=row[3]; p=np.array(row[4])
        A,B={'uarm':('shoulder','elbow'),'farm':('elbow','wrist'),'thigh':('hipSkin','knee'),'leg':('knee','ankle')}[seg]
        Ar=mir(LMJ['hipSkin'] if A=='hipSkin' else L[A],s); Br=mir(L[B],s)
        ax=(Br-Ar)/np.linalg.norm(Br-Ar); f=np.array([0,0,1.])-ax*ax[2]; f/=np.linalg.norm(f)
        l=np.cross(ax,f); 
        if l[0]*s<0: l=-l
        o=Ar+(Br-Ar)*t; d=f*math.cos(math.radians(th))+l*math.sin(math.radians(th))
        reg=('arm' if seg in('uarm','farm') else 'leg')+('L' if s>0 else 'R')
        h=ray(o,d,[reg],0.15)
        if h is not None: addp(p,h,'S')
    elif kind=='H':
        el,az,p=row[1],row[2],np.array(row[3]); c=np.array(LMJ['HEAD']['c']); r=np.array(LMJ['HEAD']['r'])
        e=math.radians(el); a=math.radians(az)
        d=np.array([r[0]*math.cos(e)*math.sin(a), r[1]*math.sin(e), r[2]*math.cos(e)*math.cos(a)])
        h=ray(c,d,['core'],0.2)
        if h is not None: addp(p,h,'H')
PO=np.array(pairs_o); PR=np.array(pairs_r)
print('total pairs',len(PO), {t:tags.count(t) for t in ('T','S','H')})
# dedupe
_,ui=np.unique(np.round(PO,4),axis=0,return_index=True); ui=np.sort(ui)
PO=PO[ui];PR=PR[ui]
np.save('PO.npy',PO); np.save('PR.npy',PR)
rbf=RBFInterpolator(PO,PR-PO,kernel='thin_plate_spline',smoothing=2e-5)
res=rbf(PO)+PO-PR; print('fit residual mm: mean %.2f max %.2f'%(np.abs(res).mean()*1000, np.abs(res).max()*1000))
np.save('rbf_PO.npy',PO); np.save('rbf_D.npy',PR-PO)
