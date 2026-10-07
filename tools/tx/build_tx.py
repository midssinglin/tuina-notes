import sys, re, json, glob, os
sys.path.insert(0, '/home/claude/tx'); from s2tw import s2twp
PARTS = {
 '頭頸': ['頸椎','脖子','頭痛','頭部','枕骨','寰椎','頸部','後腦','顳','風池','胸鎖乳突','頭骨','下顎','頸','偏頭痛'],
 '肩・上肢': ['肩膀','肩胛','肩','手臂','手肘','肘','手腕','前臂','肱','鎖骨','旋轉肌','三角肌','網球肘','手指','虎口','上肢'],
 '胸背': ['胸椎','背部','肋骨','肋','胸廓','橫膈','膈','呼吸','菱形','胸口','胸'],
 '腰': ['腰椎','腰部','下背','椎間盤','閃腰','腰方','豎脊','腰痛','腰'],
 '骨盆・薦椎': ['骨盆','薦椎','薦骨','薦','骶','髂','恥骨','尾椎','尾骨','坐骨','耳狀面','長短腳'],
 '髖臀': ['髖','臀','屁股','梨狀','大轉子','鼠蹊','股骨頭','闊筋膜'],
 '膝・大腿': ['膝蓋','膝','髕','股四頭','膕','半月板','大腿','十字韌帶'],
 '踝足': ['腳踝','踝','足弓','腳跟','距骨','跟骨','腳底','腳趾','扁平足','脛','小腿','足'],
}
TOPICS = {
 '骨盆角度': ['前傾','後傾','外展','內收','長短腳','角度','高低腳','耳狀面'],
 '肌肉': ['肌肉','收縮','拉長','緊繃','肌腱','筋膜','韌帶'],
 '神經': ['神經','坐骨神經','發麻','麻麻','脊髓','神經根'],
 '經絡穴位': ['經絡','經脈','穴位','穴道','膀胱經','膽經','胃經','脾經','肝經','腎經','大腸經','小腸經','三焦','心包','任脈','督脈','肺經','心經'],
 '經筋': ['經筋','筋結','結點'],
 '臟腑・中醫': ['臟腑','五臟','六腑','氣血','陰陽','五行','脾胃','肝膽','腎氣','寒濕','濕氣','營衛','痹','中醫','內臟'],
 '手法': ['手法','推拿','按摩','按壓','撥筋','扳','牽引','點按','力度','復位','整復','放鬆','推'],
 '評估': ['評估','檢查','觀察','測試','觸診','站姿','走路','姿勢','主動','被動','判斷'],
 '安全禁忌': ['禁忌','不能按','轉介','醫院','骨折','孕婦','高血壓','危險','醫生','開刀'],
 '婦科': ['子宮','月經','經痛','卵巢','婦科','生理期','卵子'],
 '案例': ['客人','個案','病人','案例','學員','患者'],
}
def score(text, D):
    out = {}
    for tag, kws in D.items():
        n = 0; used = text
        for k in sorted(kws, key=len, reverse=True):
            c = used.count(k)
            if c: n += c * (1.0 if len(k) >= 2 else 0.5); used = used.replace(k, '□')
        if n: out[tag] = n
    return out
FIX = [('骶', '薦'), ('臏', '髕')]
lecs = []; segs = []
for f in sorted(glob.glob('/home/claude/asr/out/*.clean.txt')):
    lec = os.path.basename(f).replace('.clean.txt', '').replace('_1', '')
    raw = open(f, encoding='utf-8').read()
    t = s2twp(raw)
    for a, b in FIX: t = t.replace(a, b)
    L = {'id': lec, 'date': lec[:2] + '/' + lec[2:4], 'part': lec[5:] if '-' in lec else '', 'n': 0, 'dur': 0}
    for line in t.split('\n'):
        m = re.match(r'^\[(\d+):(\d\d)\]\s*(.*)$', line.strip())
        if not m: continue
        sec = int(m.group(1)) * 60 + int(m.group(2)); txt = m.group(3).strip()
        if len(txt) < 20: continue
        ps = score(txt, PARTS); ts = score(txt, TOPICS)
        parts = [k for k, v in sorted(ps.items(), key=lambda x: -x[1]) if v >= 1][:3]
        topics = [k for k, v in sorted(ts.items(), key=lambda x: -x[1]) if v >= 1][:4]
        segs.append({'id': lec + '@' + str(sec), 'lec': lec, 't': sec, 'x': txt, 'p': parts, 'k': topics})
        L['n'] += 1; L['dur'] = sec
    tot_p = {}; tot_k = {}
    for s in segs:
        if s['lec'] != lec: continue
        for p in s['p']: tot_p[p] = tot_p.get(p, 0) + 1
        for k in s['k']: tot_k[k] = tot_k.get(k, 0) + 1
    L['p'] = [k for k, _ in sorted(tot_p.items(), key=lambda x: -x[1])[:4]]
    L['k'] = [k for k, _ in sorted(tot_k.items(), key=lambda x: -x[1])[:4]]
    lecs.append(L)
out = {'v': 1, 'parts': list(PARTS), 'topics': list(TOPICS), 'kw': {'p': PARTS, 'k': TOPICS}, 'lecs': lecs, 'segs': segs}
json.dump(out, open('/home/claude/tx/transcripts.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(segs), 'segs', os.path.getsize('/home/claude/tx/transcripts.json') // 1024, 'KB')
from collections import Counter
print(Counter(p for s in segs for p in s['p'])); print(Counter(k for s in segs for k in s['k']))
print(sum(1 for s in segs if not s['p'] and not s['k']), 'untagged')
for L in lecs: print(L['id'], L['n'], L['dur']//60, L['p'], L['k'])
