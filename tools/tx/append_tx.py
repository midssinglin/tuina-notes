"""把新的 ASR 清理稿（/home/claude/asr/out/*.clean.txt）加進 docs/transcripts.json（保留既有堂次）。
用法：python3 tools/tx/append_tx.py 1019-1 1019-2 …"""
import sys, re, json, os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'build_tx.py'), encoding='utf-8').read()
exec(src[src.index('PARTS = {'):src.index('FIX = ')])
sys.path.insert(0, '/home/claude/tx'); from s2tw import s2twp
FIX = [('骶', '薦'), ('臏', '髕')]
P = os.path.join(here, '../../docs/transcripts.json')
d = json.load(open(P, encoding='utf-8'))
for lec in sys.argv[1:]:
    f = '/home/claude/asr/out/%s.clean.txt' % lec
    if not os.path.exists(f): f = '/home/claude/asr/out/%s_1.clean.txt' % lec
    t = s2twp(open(f, encoding='utf-8').read())
    for a, b in FIX: t = t.replace(a, b)
    d['lecs'] = [L for L in d['lecs'] if L['id'] != lec]; d['segs'] = [s for s in d['segs'] if s['lec'] != lec]
    L = {'id': lec, 'date': lec[:2] + '/' + lec[2:4], 'part': lec[5:] if '-' in lec else '', 'n': 0, 'dur': 0}
    tp, tk = {}, {}
    for line in t.split('\n'):
        m = re.match(r'^\[(\d+):(\d\d)\]\s*(.*)$', line.strip())
        if not m: continue
        sec = int(m.group(1)) * 60 + int(m.group(2)); txt = m.group(3).strip()
        if len(txt) < 20: continue
        ps = score(txt, PARTS); ts = score(txt, TOPICS)
        parts = [k for k, v in sorted(ps.items(), key=lambda x: -x[1]) if v >= 1][:3]
        topics = [k for k, v in sorted(ts.items(), key=lambda x: -x[1]) if v >= 1][:4]
        d['segs'].append({'id': lec + '@' + str(sec), 'lec': lec, 't': sec, 'x': txt, 'p': parts, 'k': topics})
        for p in parts: tp[p] = tp.get(p, 0) + 1
        for k in topics: tk[k] = tk.get(k, 0) + 1
        L['n'] += 1; L['dur'] = sec
    L['p'] = [k for k, _ in sorted(tp.items(), key=lambda x: -x[1])[:4]]; L['k'] = [k for k, _ in sorted(tk.items(), key=lambda x: -x[1])[:4]]
    d['lecs'].append(L); print(lec, L['n'], 'segs', L['dur'] // 60, 'min', L['p'], L['k'])
d['lecs'].sort(key=lambda L: L['id'])
json.dump(d, open(P, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('total lecs', len(d['lecs']), 'segs', len(d['segs']), os.path.getsize(P) // 1024, 'KB')
