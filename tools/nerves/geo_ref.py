import json, numpy as np
D='/home/claude/tuina-notes/docs/'
man=json.load(open(D+'anatomy.json')); buf=open(D+'anatomy.data.wasm','rb').read()
pos=np.frombuffer(buf,dtype=np.uint16,count=man['nv']*3).reshape(-1,3).astype(np.float64)
mn=np.array(man['min']); st=np.array(man['step'])
def verts(p): return mn+pos[p['v']:p['v']+p['nv']]*st
P={}
for p in man['parts']:
    P.setdefault(p['zh'],[]).append(p)
def V(zh): return np.vstack([verts(p) for p in P[zh]])
if __name__=='__main__':
    names=[k for k in P if k.startswith('左') or '椎' in k or k in ('薦椎','枕骨')]
    for k in ['左肱骨','左橈骨','左尺骨','左股骨','左脛骨','左腓骨','左鎖骨','左肩胛骨','左髖骨（無名骨）','薦椎','第1腰椎（L1）','第5腰椎（L5）','第12胸椎（T12）','枕骨','左跟骨','左距骨','左梨狀肌','左胸小肌','左前斜角肌','左中斜角肌','左腰大肌','皮膚']:
        if k not in P: print('missing',k); continue
        v=V(k); print(k, 'min',np.round(v.min(0),3),'max',np.round(v.max(0),3),'c',np.round(v.mean(0),3))
    print([k for k in P if '胸椎' in k][:3], [k for k in P if '肋' in k][:10])
