// 由 tools/details/data/*.json 產生 src/data_detail.js
// 內容：穴位／肌肉／骨骼／經筋詳解、手法目錄、整合說明（統一說法＋名詞表）
// 用法：node tools/details/gen_details.js
global.window = {};
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '../../src/');
const DATA = path.join(__dirname, 'data/');
for (const f of ['data_motions.js', 'data_muscles.js', 'data_meridians.js', 'data_rules.js', 'data_assess.js', 'data_kb.js', 'data_books.js'].filter((f) => fs.existsSync(SRC + f))) eval(fs.readFileSync(SRC + f, 'utf8'));
const W = window;
const J = (f) => JSON.parse(fs.readFileSync(DATA + f, 'utf8'));
const MU = {}; W.MUSCLES.forEach((m) => (MU[m.id] = m));
const PT = {}; W.POINTS.forEach((p) => (PT[p.id] = p));
const PAT = {}; W.PATTERNS.forEach((p) => (PAT[p.id] = p.name));

const rec = J('reconcile.json');
const techs = J('detail_techs.json');
const bones = J('detail_bones.json');
const sinews = J('detail_sinews.json');
const muscles = Object.assign({}, J('detail_muscles_U.json'), J('detail_muscles_L.json'));
const points = Object.assign({}, J('detail_points_A.json'), J('detail_points_B.json'), J('detail_points_C.json'));
const OJ = (f, d) => (fs.existsSync(DATA + f) ? J(f) : d);
const emu = Object.assign({}, OJ('enrich_muscles_U.json', {}), OJ('enrich_muscles_L.json', {}));
const ebn = OJ('enrich_bones.json', {}); const esn = OJ('enrich_sinews.json', {});
const arts = OJ('articles_theory.json', []); const NVJ = OJ('nerves.json', null);
const mnerve = (NVJ && NVJ.muscleNerve) || {};
const lst = (a) => (Array.isArray(a) ? a.map((x) => '- ' + x).join('\n') : a || '');

// 已知的知識庫 id（用來把文字中的 id 轉成連結）
const KNOWN = new Set(W.KB_ITEMS.map((k) => k.id));
rec.topics.forEach((t) => KNOWN.add(t.id));
Object.keys(techs).forEach((k) => KNOWN.add(k));
Object.keys(bones).forEach((k) => KNOWN.add(k));
KNOWN.add('u-overview'); KNOWN.add('u-glossary');
arts.forEach((a) => KNOWN.add(a.id)); if (NVJ) { (NVJ.articles || []).forEach((a) => KNOWN.add(a.id)); KNOWN.add('nv-tables'); } KNOWN.add('d-sn-overview');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const muIds = Object.keys(MU).sort((a, b) => b.length - a.length);
const ptIds = Object.keys(PT).sort((a, b) => b.length - a.length);
function link(text) {
  let s = String(text || '');
  // 肌肉：「名稱(id)」或「名稱（id）」→ [[m:id]]
  muIds.forEach((id) => { s = s.replace(new RegExp('([\\u4e00-\\u9fff]{0,12})\\s?[（(]' + esc(id) + '[)）]', 'g'), '[[m:' + id + ']]'); });
  // 規則 id → 名稱
  s = s.replace(/[，、,]\s*(p_[a-z0-9_]+)(?=[)）])/g, (m0, id) => (PAT[id] ? '' : m0));
  s = s.replace(/[（(]\s*(p_[a-z0-9_]+)\s*[)）]/g, (m0, id) => (PAT[id] ? '（評估規則「' + PAT[id] + '」）' : m0));
  s = s.replace(/\b(p_[a-z0-9_]+)\b/g, (m0, id) => (PAT[id] ? '「' + PAT[id] + '」' : m0));
  // 穴位：「名稱 ID」「名稱（ID）」→ [[p:ID]]；單獨的 ID 也轉
  ptIds.forEach((id) => {
    const nm = PT[id].name;
    s = s.replace(new RegExp(esc(nm) + '\\s?[（(]?' + esc(id) + '(?![\\w-])[)）]?', 'g'), '[[p:' + id + ']]');
    s = s.replace(new RegExp('(?<![\\w:\\-\\[])' + esc(id) + '(?![\\w-])', 'g'), '[[p:' + id + ']]');
  });
  // 知識庫條目 id
  s = s.replace(/(?<![\w:\-[])((?:k|u|b|tq|bn)-[a-z0-9]+(?:-[a-z0-9]+)*)/g, (m0, id) => (KNOWN.has(id) ? '[[k:' + id + ']]' : m0));
  return s;
}
// 1) 2) 3) 步驟 → 清單
function steps(s) {
  s = String(s || '').trim(); if (!s) return '';
  if (/(^|[^\d])1\)\s?/.test(s) && /2\)/.test(s)) return s.split(/(?=(?<![\d.])\d{1,2}\)\s?)/).map((x) => x.trim()).filter(Boolean).map((x) => '- ' + x).join('\n');
  return s;
}
const lines = (s) => String(s || '').split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x) => (/^[-•]/.test(x) ? x : '- ' + x)).join('\n');
const sec = (title, body, mode) => { if (!body || !String(body).trim()) return ''; const b = mode === 'list' ? lines(body) : mode === 'steps' ? steps(body) : String(body).trim(); return '### ' + title + '\n' + link(b) + '\n\n'; };

// ===== 穴位 =====
const DPT = {};
Object.entries(points).forEach(([id, d]) => {
  if (!PT[id]) return;
  let b = '';
  b += sec('詳細定位與取穴', d.loc);
  b += sec('局部解剖', d.anat);
  b += sec('主治', d.ind, 'list');
  b += sec('推拿操作', d.tuina);
  b += sec('常用配伍', String(d.combo || '').split(/[；;]\s*/).join('\n'), 'list');
  if (d.special) b += sec('特定穴', d.special);
  if (d.caution) b += '!! ' + link('注意：' + d.caution) + '\n\n';
  if (d.diff) b += sec('與其他說法的差異', d.diff);
  b += sec('出處', d.pages);
  DPT[id] = { md: b.trim(), muscles: (d.muscles || []).filter((m) => MU[m]) };
});
// ===== 肌肉 =====
const DMU = {}; const MX = {}; const BX = {}; const SX = {};
Object.entries(muscles).forEach(([id, d]) => {
  if (!MU[id]) return;
  let b = '';
  b += sec('神經支配', d.nerve);
  b += sec('作用細節', d.act);
  b += sec('檢查（肌力與長度）', d.test);
  b += sec('縮短／過緊時', d.short);
  b += sec('被拉長／無力時', d.long);
  b += sec('激痛點與轉移痛', d.trigger);
  b += sec('推拿處理', d.tuina, 'steps');
  b += sec('自我伸展', d.stretch);
  b += sec('強化運動', d.strengthen);
  b += sec('常見問題與鑑別', d.clinical);
  b += sec('所屬經筋', d.sinew);
  const e = emu[id] || {}; const mn = mnerve[id] || {};
  b += sec('常見症狀', lst(e.symptoms));
  b += sec('連帶效應', e.chain);
  b += sec('代償', e.compensation);
  b += sec('骨頭移位對這條肌肉的影響', e.boneEffect);
  b += sec('神經連結', [mn.nerve ? '支配：' + mn.nerve + (mn.roots ? '（' + mn.roots + '）' : '') + '。' : '', mn.link || '', e.nerveLink || ''].filter(Boolean).join('\n'));
  b += sec('在經筋中的角色', e.sinewRole);
  b += sec('觸診表徵', e.palpSigns);
  b += sec('再確認（輔助檢查）', lst(e.confirm));
  if (d.diff) b += sec('與網站資料／其他書的差異', d.diff);
  b += sec('出處', [d.pages, e.sources].filter(Boolean).join('；'));
  DMU[id] = { md: b.trim() };
  MX[id] = { nerve: mn.nerve ? mn.nerve + (mn.roots ? '（' + mn.roots + '）' : '') : d.nerve, short: d.short, long: d.long, symptoms: e.symptoms, chain: e.chain, compensation: e.compensation, boneEffect: e.boneEffect, palpSigns: e.palpSigns, confirm: e.confirm, nerveLink: mn.link || e.nerveLink };
});
// ===== 骨骼 =====
const DBN = {};
Object.entries(bones).forEach(([id, d]) => {
  let b = '';
  b += sec('位置與形狀', d.where);
  b += sec('骨性標誌與觸診', d.landmarks);
  b += sec('關節與動作', d.joints);
  b += sec('附著的肌肉與韌帶', d.attach);
  b += sec('課堂重點', d.course);
  b += sec('常見錯位與評估', d.dysfunction);
  b += sec('整復要點', d.adjust, 'steps');
  const e = ebn[id] || {};
  b += sec('移位時對肌肉、關節、神經的影響', e.displace);
  b += sec('連帶與代償', e.chain);
  b += sec('觀察與觸診表徵', lst(e.signs));
  b += sec('再確認（輔助檢查）', lst(e.confirm));
  if (d.red) b += '!! ' + link('安全警訊：' + d.red) + '\n\n';
  if (d.diff) b += sec('書與課堂的差異', d.diff);
  b += sec('出處', [d.pages, e.sources].filter(Boolean).join('；'));
  BX[id] = { where: d.where, landmarks: d.landmarks, joints: d.joints, attach: d.attach, course: d.course, dysfunction: d.dysfunction, displace: e.displace, adjust: d.adjust };
  DBN[id] = { name: d.name, en: d.en, md: b.trim(), muscles: (d.muscles || []).filter((m) => MU[m]), points: (d.points || []).filter((p) => PT[p]) };
});
// ===== 經筋 =====
const DSN = {};
Object.entries(sinews).forEach(([id, d]) => {
  if (id === 'overview') return;
  let b = '';
  b += sec('起點', d.start);
  b += sec('循行（起、結、行）', d.course);
  if ((d.knots || []).length) {
    b += '### 結點與觸診\n|結|位置|怎麼摸|肌肉|穴位|\n|---|---|---|---|---|\n';
    d.knots.forEach((k) => { b += '|' + [k.name, k.where, k.palp, (k.muscles || []).filter((m) => MU[m]).map((m) => '[[m:' + m + ']]').join('、'), (k.points || []).filter((p) => PT[p]).map((p) => '[[p:' + p + ']]').join('、')].map((x) => link(String(x || '')).replace(/\|/g, '／').replace(/\n/g, ' ')).join('|') + '|\n'; });
    b += '\n';
  }
  b += sec('病候', d.sick);
  b += sec('評估', d.assess);
  b += sec('手療法', d.tuina);
  b += sec('與經脈、課堂的關係', d.related);
  const e = esn[id] || {};
  b += sec('功用', e.function);
  b += sec('經筋病的表徵', lst(e.signs));
  b += sec('沿途經過的肌肉', e.muscleChain);
  b += sec('快速評估', e.assessQuick);
  if (d.diff) b += sec('差異', d.diff);
  b += sec('出處', [d.pages, e.sources].filter(Boolean).join('；'));
  SX[id] = { start: d.start, sick: d.sick, function: e.function, signs: e.signs, muscleChain: e.muscleChain };
  DSN[id] = { md: b.trim(), muscles: (d.muscles || []).filter((m) => MU[m]), points: (d.points || []).filter((p) => PT[p]), knots: (d.knots || []).map((k) => k.name), knotsFull: (d.knots || []).map((k) => ({ name: k.name, where: k.where, muscles: (k.muscles || []).filter((m) => MU[m]) })) };
});
const snOverview = (esn.overview && esn.overview.body ? link(esn.overview.body) + '\n\n' : '') + link(sinews.overview.body) + '\n\n### 出處\n' + [sinews.overview.pages, esn.overview && esn.overview.sources].filter(Boolean).join('；');
// ===== 手法 =====
const GROUPS = ['基本手法', '軟組織與經筋', '骨盆', '脊椎', '四肢', '原則'];
const TECHS = Object.entries(techs).map(([id, d]) => {
  let b = '';
  if (d.risk === '高') b += '!! 高風險手法：本站不建議自行操作；先轉介／在合格指導下學習。下面的步驟是安全的替代做法。\n\n';
  b += sec('目的與作用', d.aim);
  b += sec('操作步驟', d.how, 'steps');
  b += sec('要點與常見錯誤', d.points);
  b += sec('適用情況', d.use);
  b += sec('禁忌與注意', d.contra);
  b += sec('與課堂的關係', d.course);
  if (d.diff) b += sec('書與書／書與課堂的不同做法', d.diff);
  b += sec('出處', d.pages);
  return { id, name: d.name, group: d.group, risk: d.risk, md: b.trim(), muscles: (d.muscles || []).filter((m) => MU[m]), regions: d.regions || [], use: d.use };
}).sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));

// ===== 整合說明（統一說法）=====
const items = [];
rec.topics.forEach((t) => {
  let b = '### 本站統一說法\n' + link(t.stance) + '\n\n';
  if (t.verify) b += '!! 這一項仍需請老師確認；確認前以上面的說法為準，並以實際觸診與測試結果判斷。\n\n';
  b += '### 依據\n' + link(t.why) + '\n\n';
  if ((t.alt || []).length) b += '### 其他說法\n' + t.alt.map((a) => '- ' + link(a)).join('\n') + '\n\n';
  const aff = (t.affected || []).filter((x) => KNOWN.has(x) && !x.startsWith('u-'));
  if (aff.length) b += '### 相關條目\n' + aff.map((x) => '[[k:' + x + ']]').join('、') + '\n';
  const pts = (t.affected || []).filter((x) => PAT[x]).map((x) => PAT[x]);
  if (pts.length) b += '\n評估規則：' + pts.join('、') + '\n';
  const mus = (t.affected || []).filter((x) => MU[x]);
  items.push({ id: t.id, cat: '原則', src: '整合說明', title: '統一說法：' + t.topic, tags: ['統一說法', '整合'].concat(t.verify ? ['待確認'] : []), muscles: mus, points: [], regions: [], body: b.trim() });
});
let ov = '課堂筆記、12 堂錄音與 7 本參考書整理後，同一件事常有不同說法。這裡把會互相矛盾的地方逐一比對，定出本站的**統一說法**：課堂自己的系統（骨盆三個角度、三分法、被拉長的痛、由下往上評估）為主；解剖與肌動學以《基礎肌動學》等可驗證的資料修正；安全一律以「先轉介、只做周邊放鬆」為準。各條目內原本的課堂說法保留，矛盾處加上「整合說明」。\n\n';
ov += '標「待確認」的項目是課堂與書不一致、又無法單靠肌動學判斷的地方，建議上課時請老師確認。\n\n';
ov += '### 全部 ' + rec.topics.length + ' 項\n';
rec.topics.forEach((t) => (ov += '- [[k:' + t.id + ']]' + (t.verify ? '（待確認）' : '') + '：' + link(t.stance.split('。')[0]) + '。\n'));
ov += '\n名詞的統一寫法見 [[k:u-glossary]]。';
items.unshift({ id: 'u-overview', cat: '原則', src: '整合說明', title: '知識點整合：統一說法總表', tags: ['統一說法', '整合', '衝突', '總覽'], muscles: [], points: [], regions: [], body: ov });
let gl = '同一個東西在課堂、筆記與各書裡有不同叫法。本站統一用左欄的寫法，右欄是你可能在別處看到的說法。\n\n|名詞|本站用法|也叫|說明|\n|---|---|---|---|\n';
rec.glossary.forEach((g) => (gl += '|' + [g.term, g.unified, (g.aliases || []).join('、'), g.note || ''].map((x) => link(String(x)).replace(/\|/g, '／').replace(/\n/g, ' ')).join('|') + '|\n'));
items.push({ id: 'u-glossary', cat: '原則', src: '整合說明', title: '名詞統一表', tags: ['名詞', '統一說法', '用詞'], muscles: [], points: [], regions: [], body: gl });

items.push({ id: 'd-sn-overview', cat: '經筋', src: '詳解', title: '經筋總論：起、結、聚、散與病候總則', tags: ['經筋', '總論', '結筋', '以痛為輸'], muscles: [], points: [], regions: [], body: snOverview });
// ===== 理論整理文章 =====
arts.forEach((a) => items.push({ id: a.id, cat: a.cat || '原則', src: '補充：理論整理', title: a.title, tags: (a.tags || []).concat(['理論']), muscles: (a.muscles || []).filter((m) => MU[m]), points: (a.points || []).filter((p) => PT[p]), regions: a.regions || [], body: link(a.body) + (a.sources ? '\n\n### 參考資料\n' + a.sources : '') }));
// ===== 神經 =====
let nvOut = '/* 神經資料（由 tools/details/gen_details.js 產生） */\nwindow.NERVE_DATA = {}; window.NERVE_INFO = {};\n';
if (NVJ) {
  const ND = {}; (NVJ.nerves || []).forEach((n) => { ND[n.id] = Object.assign({}, n, { motor: (n.motor || []).filter((m) => MU[m]), points: (n.points || []).filter((p) => PT[p]) }); });
  const info = { dermatomes: NVJ.dermatomes || [], myotomes: NVJ.myotomes || [], reflexes: NVJ.reflexes || [], tests: NVJ.tests || [] };
  (NVJ.nerves || []).forEach((n) => {
    let b = '';
    b += sec('神經根與神經叢', [n.roots, n.plexus].filter(Boolean).join('・'));
    b += sec('走向', n.course);
    b += sec('支配的肌肉', ((n.motor || []).filter((m) => MU[m]).map((m) => '[[m:' + m + ']]').join('、')) + (n.motorText ? '\n' + n.motorText : ''));
    b += sec('感覺分布', n.sensory);
    if ((n.entrap || []).length) { b += '### 卡壓點\n|位置|原因|症狀與表徵|檢查|推拿|\n|---|---|---|---|---|\n'; n.entrap.forEach((e) => { b += '|' + [e.site, e.cause, e.signs, e.test, e.tuina].map((x) => link(String(x || '')).replace(/\|/g, '／').replace(/\n/g, ' ')).join('|') + '|\n'; }); b += '\n'; }
    b += sec('受損時的表現', n.lesion);
    if ((n.points || []).length) b += sec('沿線穴位', n.points.filter((p) => PT[p]).map((p) => '[[p:' + p + ']]').join('、'));
    b += sec('與課堂筆記的關係', n.notes);
    b += sec('參考資料', n.sources);
    items.push({ id: 'nv:' + n.id, cat: '神經', src: '神經詳解', title: n.name + (n.en ? '（' + n.en + '）' : ''), tags: ['神經', n.plexus || '', n.roots || ''].filter(Boolean), muscles: (n.motor || []).filter((m) => MU[m]), points: (n.points || []).filter((p) => PT[p]), regions: [], body: b.trim() });
  });
  // 皮節、肌節、反射、測試總表
  if (info.dermatomes.length) items.push({ id: 'nv-tables', cat: '神經', src: '神經詳解', title: '皮節、肌節、反射與神經測試總表', tags: ['皮節', '肌節', '反射', '神經測試'], muscles: [], points: [], regions: [],
    body: '### 皮節\n|節段|區域|記憶點|課堂筆記|\n|---|---|---|---|\n' + info.dermatomes.map((d) => '|' + [d.seg, d.area, d.landmark, d.course].map((x) => link(String(x || '')).replace(/\|/g, '／')).join('|') + '|').join('\n')
      + '\n\n### 肌節（肌力測試）\n|節段|動作|怎麼測|\n|---|---|---|\n' + info.myotomes.map((d) => '|' + [d.seg, d.action, d.test].map((x) => String(x || '').replace(/\|/g, '／')).join('|') + '|').join('\n')
      + '\n\n### 反射\n|反射|節段|做法|\n|---|---|---|\n' + info.reflexes.map((d) => '|' + [d.name, d.seg, d.how].map((x) => String(x || '').replace(/\|/g, '／')).join('|') + '|').join('\n')
      + '\n\n### 神經測試\n|測試|做法|陽性代表|注意|\n|---|---|---|---|\n' + info.tests.map((d) => '|' + [d.name, d.how, d.positive, d.caution].map((x) => link(String(x || '')).replace(/\|/g, '／').replace(/\n/g, ' ')).join('|') + '|').join('\n') });
  (NVJ.articles || []).forEach((a) => items.push({ id: a.id, cat: '神經', src: '補充：神經整理', title: a.title, tags: (a.tags || []).concat(['神經']), muscles: (a.muscles || []).filter((m) => MU[m]), points: (a.points || []).filter((p) => PT[p]), regions: a.regions || [], body: link(a.body) }));
  // 評估：神經站
  const fsx = NVJ.findings || [];
  const sens = fsx.filter((f) => /麻|感覺|皮節|刺痛|觸覺/.test(f.label)); const rest = fsx.filter((f) => !sens.includes(f));
  const station = { id: 'nerve', name: '神經', sub: '皮節、肌節、反射與測試', pose: null, intro: '有麻、無力或放射痛時做：先對照皮節看麻的範圍，再測肌節（肌力）與反射，最後做神經測試；判斷是神經根、周邊神經卡壓，還是肌肉的轉移痛。兩側或上下肢同時出現、進行性無力、大小便異常 → 先轉介。',
    groups: [sens.length ? { name: '感覺（皮節）', items: sens.map((f) => ({ id: f.id, label: f.label, side: !!f.side, seg: f.seg || '', how: [f.how, f.seg ? '（' + f.seg + '）' : ''].filter(Boolean).join('') })) } : null, rest.length ? { name: '肌力、反射與神經測試', items: rest.map((f) => ({ id: f.id, label: f.label, side: !!f.side, seg: f.seg || '', how: [f.how, f.seg ? '（' + f.seg + '）' : ''].filter(Boolean).join('') })) } : null].filter(Boolean) };
  const pats = (NVJ.patterns || []).map((p) => Object.assign({ src: '神經判斷（補充）', tight: [], weak: [], points: [], chain: [], techs: ['tq-principles'] }, p, { tight: (p.tight || []).filter((x) => MU[x[0]]), weak: (p.weak || []).filter((x) => MU[x[0]]), points: (p.points || []).filter((x) => PT[x]), confirm: (p.confirm || []).map((c) => (typeof c === 'string' ? { text: c, kind: 'nerve' } : c)) }));
  nvOut = '/* 神經資料（由 tools/details/gen_details.js 產生；內容為依課堂筆記與主流神經學整理） */\n'
    + 'window.NERVE_DATA = ' + JSON.stringify(ND) + ';\nwindow.NERVE_INFO = ' + JSON.stringify(info) + ';\n'
    + '(function () { const st = ' + JSON.stringify(station) + '; const S = window.STATIONS || (window.STATIONS = []); if (!S.some((x) => x.id === st.id)) S.push(st);\n'
    + "  st.groups.forEach((g) => window.FINDINGS.push({ group: st.name + '・' + g.name, station: st.id, red: false, items: g.items }));\n"
    + '  const P = ' + JSON.stringify(pats) + '; const have = new Set(window.PATTERNS.map((p) => p.id)); P.forEach((p) => { if (!have.has(p.id)) window.PATTERNS.push(p); }); })();\n';
}
fs.writeFileSync(SRC + 'data_nerves.js', nvOut);
const out = '/* 詳解與手法目錄（由 tools/details/gen_details.js 產生；內容為依參考書與課堂自行整理的摘要並標註頁碼） */\n'
  + 'window.DETAIL = ' + JSON.stringify({ pt: DPT, mu: DMU, bn: DBN, sn: DSN, snOverview, mx: MX, bx: BX, sx: SX }) + ';\n'
  + 'window.TECHS = ' + JSON.stringify(TECHS) + ';\n'
  + 'window.TECH_GROUPS = ' + JSON.stringify(GROUPS) + ';\n'
  + 'window.KB_ITEMS.push(...' + JSON.stringify(items) + ');\n';
fs.writeFileSync(SRC + 'data_detail.js', out);
console.log('points', Object.keys(DPT).length, 'muscles', Object.keys(DMU).length, 'bones', Object.keys(DBN).length, 'sinews', Object.keys(DSN).length, 'techs', TECHS.length, 'topics', rec.topics.length, 'KB', (out.length / 1024 | 0) + 'KB');
