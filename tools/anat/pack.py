import json,struct,numpy as np,pickle
from zh import zh
man=json.load(open('anatomy.json')); sel=json.load(open('sel2.json')); cz=man['cz']
def load(fid):
    b=open('simp/%s.bin'%fid,'rb').read(); nv,ni=struct.unpack('II',b[:8])
    P=np.frombuffer(b,np.float32,nv*3,8).reshape(-1,3).astype(np.float64)
    I=np.frombuffer(b,np.uint32,ni,8+nv*12).astype(np.int64)
    return np.stack([P[:,0]/1000,P[:,2]/1000,-P[:,1]/1000-cz],1),I
parts=[];Ps=[];Is=[]
for p in sel:
    if p['kind']=='skin': continue
    V,I=load(p['fid']); g=p.get('group')
    if p['kind']=='muscle' and 'extensor digitorum' in p['name'].lower() and ('longus' in p['name'].lower() or 'brevis' in p['name'].lower()): g='toe_ext'
    parts.append(dict(fid=p['fid'],name=p['name'],zh=zh(p['name']),kind=p['kind'],side=p.get('side'),group=g)); Ps.append(V); Is.append(I)
S=pickle.load(open('skin.pkl','rb'))
parts.append(dict(fid='FMA7163',name='Skin',zh='皮膚',kind='skin',side='M',group=None)); Ps.append(S['SV']); Is.append(S['SF'].ravel())
allP=np.concatenate(Ps); mn=allP.min(0); mx=allP.max(0); step=(mx-mn)/65535
pos=[];idx=[];v=0;i=0
for p,V,I in zip(parts,Ps,Is):
    assert len(V)<65536
    q=np.round((V-mn)/step).astype(np.uint16); pos.append(q.ravel()); idx.append(I.astype(np.uint16))
    p.update(v=v,nv=len(V),i=i,ni=len(I)); v+=len(V); i+=len(I)
pos=np.concatenate(pos); idx=np.concatenate(idx)
pb=pos.tobytes(); pad=(-len(pb))%4; pb+=b'\0'*pad
open('anatomy2.bin','wb').write(pb+idx.tobytes())
json.dump(dict(min=mn.tolist(),step=step.tolist(),posBytes=len(pb),nv=int(v),ni=int(i),parts=parts),open('anatomy2.json','w'),ensure_ascii=False,separators=(',',':'))
import os; print(len(parts), os.path.getsize('anatomy2.bin'), os.path.getsize('anatomy2.json'))

# ---- skinning weights: nearest two bones for each muscle / skin vertex ----
from scipy.spatial import cKDTree
bidx=[k for k,p in enumerate(parts) if p['kind'] in ('bone','cart')]
bmap={k:n for n,k in enumerate(bidx)}
BP=[];BL=[]
for k in bidx: BP.append(Ps[k]); BL.append(np.full(len(Ps[k]),bmap[k],np.int32))
BP=np.concatenate(BP); BL=np.concatenate(BL); tree=cKDTree(BP)
sk=[]; off=0
for k,p in enumerate(parts):
    if p['kind'] not in ('muscle','skin'): continue
    V=Ps[k]; d,ii=tree.query(V,k=48); lab=BL[ii]
    b1=lab[:,0]; d1=d[:,0]
    other=lab!=b1[:,None]; has=other.any(1)
    j=np.argmax(other,1); b2=np.where(has,lab[np.arange(len(V)),j],b1); d2=np.where(has,d[np.arange(len(V)),j],d1*10+1)
    P_=4.0; w1=d2**P_/(d1**P_+d2**P_+1e-30)
    arr=np.stack([b1,b2,np.round(w1*255)],1).astype(np.uint8)
    sk.append(arr.ravel()); p['sk']=off; off+=len(V)
sk=np.concatenate(sk)
raw=open('anatomy2.bin','rb').read(); pad=(-len(raw))%4; skOff=len(raw)+pad
open('anatomy2.bin','wb').write(raw+b'\0'*pad+sk.tobytes())
man2=json.load(open('anatomy2.json')); man2['parts']=parts; man2['skOff']=skOff; man2['bones']=bidx
json.dump(man2,open('anatomy2.json','w'),ensure_ascii=False,separators=(',',':'))
print('skin weights',len(sk)//3,'bytes',os.path.getsize('anatomy2.bin'))
