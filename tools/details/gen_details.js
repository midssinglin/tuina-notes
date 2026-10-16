// 由 tools/details/data/*.json 產生 src/data_detail.js
// 內容：穴位／肌肉／骨骼／經筋詳解、手法目錄、整合說明（統一說法＋名詞表）
// 用法：node tools/details/gen_details.js
global.window = {};
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '../../src/');
const DATA = path.join(__dirname, 'data/');
for (const f of ['data_motions.js', 'data_muscles.js', 'data_meridians.js', 'data_rules.js', 'data_assess.js', 'data_kb.js', 'data_books.js']) eval(fs.readFileSync(SRC + f, 'utf8'));
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

// 已知的知識庫 id（用來把文字中的 id 轉成連結）
const KNOWN = new Set(W.KB_ITEMS.map((k) => k.id));
rec.topics.forEach((t) => KNOWN.add(t.id));
Object.keys(techs).forEach((k) => KNOWN.add(k));
Object.keys(bones).forEach((k) => KNOWN.add(k));
KNOWN.add('u-overview'); KNOWN.add('u-glossary');

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
const DMU = {};
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
  if (d.diff) b += sec('與網站資料／其他書的差異', d.diff);
  b += sec('出處', d.pages);
  DMU[id] = { md: b.trim() };
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
  if (d.red) b += '!! ' + link('安全警訊：' + d.red) + '\n\n';
  if (d.diff) b += sec('書與課堂的差異', d.diff);
  b += sec('出處', d.pages);
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
  if (d.diff) b += sec('差異', d.diff);
  b += sec('出處', d.pages);
  DSN[id] = { md: b.trim(), muscles: (d.muscles || []).filter((m) => MU[m]), points: (d.points || []).filter((p) => PT[p]), knots: (d.knots || []).map((k) => k.name), knotsFull: (d.knots || []).map((k) => ({ name: k.name, where: k.where, muscles: (k.muscles || []).filter((m) => MU[m]) })) };
});
const snOverview = link(sinews.overview.body) + (sinews.overview.pages ? '\n\n### 出處\n' + sinews.overview.pages : '');
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
const out = '/* 詳解與手法目錄（由 tools/details/gen_details.js 產生；內容為依參考書與課堂自行整理的摘要並標註頁碼） */\n'
  + 'window.DETAIL = ' + JSON.stringify({ pt: DPT, mu: DMU, bn: DBN, sn: DSN, snOverview }) + ';\n'
  + 'window.TECHS = ' + JSON.stringify(TECHS) + ';\n'
  + 'window.TECH_GROUPS = ' + JSON.stringify(GROUPS) + ';\n'
  + 'window.KB_ITEMS.push(...' + JSON.stringify(items) + ');\n';
fs.writeFileSync(SRC + 'data_detail.js', out);
console.log('points', Object.keys(DPT).length, 'muscles', Object.keys(DMU).length, 'bones', Object.keys(DBN).length, 'sinews', Object.keys(DSN).length, 'techs', TECHS.length, 'topics', rec.topics.length, 'KB', (out.length / 1024 | 0) + 'KB');
