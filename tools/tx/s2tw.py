import os
D='/home/claude/tx/oc/data/dictionary/'
def load(f):
    m={}
    for ln in open(D+f,encoding='utf-8'):
        if '\t' not in ln: continue
        a,b=ln.rstrip('\n').split('\t',1); m.setdefault(a,b.split(' ')[0])
    return m
class MM:
    def __init__(s,*ds):
        s.m={}
        for d in ds: s.m.update(d)
        s.L=max(len(k) for k in s.m)
    def conv(s,t):
        o=[];i=0;n=len(t)
        while i<n:
            for l in range(min(s.L,n-i),0,-1):
                w=t[i:i+l]
                if w in s.m: o.append(s.m[w]); i+=l; break
            else: o.append(t[i]); i+=1
        return ''.join(o)
st=MM(load('STCharacters.txt'),load('STPhrases.txt'))
tw=MM(load('TWPhrases.txt'))
tv=MM(load('TWVariants.txt'))
def s2twp(t): return tv.conv(tw.conv(st.conv(t)))
if __name__=='__main__':
    print(s2twp('这个骨头的肌肉是在髋关节软件里面，颈椎、骶骨、腰椎间盘突出，后面的头发'))
