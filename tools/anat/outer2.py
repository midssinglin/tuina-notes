import pickle,numpy as np,struct,json,re,sys
from scipy import ndimage
from scipy.spatial import cKDTree
man=json.load(open('anatomy.json')); cz=man['cz']
b=open(sys.argv[1],'rb').read(); nv,ni=struct.unpack('II',b[:8])
P=np.frombuffer(b,np.float32,nv*3,8).reshape(-1,3).astype(np.float64)
F=np.frombuffer(b,np.uint32,ni,8+nv*12).reshape(-1,3).astype(np.int64)
V=np.stack([P[:,0]/1000,P[:,2]/1000,-P[:,1]/1000-cz],1)
h=0.004; lo=V.min(0)-0.02; dims=np.ceil((V.max(0)+0.02-lo)/h).astype(int)+1
occ=np.zeros(dims,bool); A,B,C=V[F[:,0]],V[F[:,1]],V[F[:,2]]
L=np.max([np.linalg.norm(A-B,axis=1),np.linalg.norm(B-C,axis=1),np.linalg.norm(C-A,axis=1)],0)
n=4
for i in range(n+1):
  for j in range(n+1-i):
    u=i/n;v=j/n;Q=A*u+B*v+C*(1-u-v); k=((Q-lo)/h).astype(int); occ[k[:,0],k[:,1],k[:,2]]=True
for t in np.where(L/n>h*0.8)[0]:
  m=int(np.ceil(L[t]/h*1.5))
  for i in range(m+1):
    for j in range(m+1-i):
      u=i/m;v=j/m;Q=A[t]*u+B[t]*v+C[t]*(1-u-v); k=((Q-lo)/h).astype(int); occ[k[0],k[1],k[2]]=True
lab,_=ndimage.label(~occ); ext=lab==lab[0,0,0]
dt=ndimage.distance_transform_edt(~ext)*h
vi=((V-lo)/h).astype(int); d=dt[vi[:,0],vi[:,1],vi[:,2]]
ov=d<=0.009; of=ov[F].all(1)
FF=F[of]; used=np.unique(FF); remap=-np.ones(len(V),int); remap[used]=np.arange(len(used))
V2=V[used]; F2=remap[FF]
# keep largest connected component
import scipy.sparse as sp
G=sp.coo_matrix((np.ones(len(F2)*3),(np.r_[F2[:,0],F2[:,1],F2[:,2]],np.r_[F2[:,1],F2[:,2],F2[:,0]])),shape=(len(V2),)*2)
nc,cl=sp.csgraph.connected_components(G,directed=False); big=np.bincount(cl).argmax()
keepF=cl[F2[:,0]]==big; F2=F2[keepF]; used=np.unique(F2); remap=-np.ones(len(V2),int); remap[used]=np.arange(len(used)); V2=V2[used]; F2=remap[F2]
print('outer verts',len(V2),'faces',len(F2),'components',nc)
# orient outward: majority of face normals point away from exterior distance gradient -> test with centroid offset
fn=np.cross(V2[F2[:,1]]-V2[F2[:,0]],V2[F2[:,2]]-V2[F2[:,0]]); fn/=np.linalg.norm(fn,axis=1,keepdims=True)+1e-12
cen=V2[F2].mean(1); probe=cen+fn*0.006; pi=np.clip(((probe-lo)/h).astype(int),0,np.array(dims)-1)
outside=ext[pi[:,0],pi[:,1],pi[:,2]]; print('normals outward frac',outside.mean())
if outside.mean()<0.5: F2=F2[:,[0,2,1]]
VN=np.zeros_like(V2); fn=np.cross(V2[F2[:,1]]-V2[F2[:,0]],V2[F2[:,2]]-V2[F2[:,0]])
for k in range(3): np.add.at(VN,F2[:,k],fn)
VN/=np.linalg.norm(VN,axis=1,keepdims=True)+1e-12
# regions via bones
sel=json.load(open('sel2.json'))
def load(fid):
    bb=open('simp/%s.bin'%fid,'rb').read(); a,c=struct.unpack('II',bb[:8])
    PP=np.frombuffer(bb,np.float32,a*3,8).reshape(-1,3).astype(np.float64)
    return np.stack([PP[:,0]/1000,PP[:,2]/1000,-PP[:,1]/1000-cz],1)
ARM=re.compile(r'humerus|radius|ulna|scaphoid|lunate|triquetral|pisiform|trapezi|capitate|hamate|metacarpal|finger|thumb',re.I)
LEG=re.compile(r'femur|patella|tibia|fibula|talus|calcaneus|cuboid|cuneiform|navicular|metatarsal|toe',re.I)
BP=[];BL=[]
for p in sel:
    if p['kind']!='bone': continue
    nm=p['name']; side='L' if re.search(r'\bleft\b',nm,re.I) else ('R' if re.search(r'\bright\b',nm,re.I) else '')
    reg='arm'+side if ARM.search(nm) else ('leg'+side if LEG.search(nm) else 'core')
    W=load(p['fid'])[::2]; BP.append(W); BL+=[reg]*len(W)
_,bi=cKDTree(np.concatenate(BP)).query(V2); SR=np.array(BL)[bi]
print({r:(SR==r).sum() for r in set(SR)})
pickle.dump(dict(SV=V2,SF=F2,VN=VN,SR=SR),open('skin.pkl','wb'))
# write binary: float32 pos, uint32 idx
with open('skin_outer.bin','wb') as f:
    f.write(struct.pack('II',len(V2),len(F2)*3)); f.write(V2.astype(np.float32).tobytes()); f.write(F2.astype(np.uint32).tobytes())
