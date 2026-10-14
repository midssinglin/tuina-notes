// 由 /home/claude/ocr/out/*.json 產生 src/data_books.js（參考書補充條目、比對）
global.window = {};
const fs = require('fs');
const SRC = require('path').join(__dirname, '../../src/');
for (const f of ['data_muscles.js', 'data_meridians.js', 'data_rules.js', 'data_kb.js']) eval(fs.readFileSync(SRC + f, 'utf8'));
const W = window;
const KT = {}; W.KB_ITEMS.forEach((k) => (KT[k.id] = k.title));
const PN = {}; W.PATTERNS.forEach((p) => (PN[p.id] = p.name));
const BOOKS = [
  { slug: 'jingjin', title: '經筋手療法圖解' },
  { slug: 'sizhi', title: '四肢手療法（圖解）' },
  { slug: 'jingxue', title: '經穴大全' },
].filter((b) => fs.existsSync(require('path').join(__dirname, 'out', b.slug + '.json')));
const refs = (s) => String(s || '')
  .replace(/\bk-[a-z0-9-]+/g, (id) => (KT[id] ? '「' + KT[id] + '」' : id))
  .replace(/\bp_[a-z0-9_]+/g, (id) => (PN[id] ? '「' + PN[id] + '」' : id));
const items = []; const books = []; const allC = [];
const SEV = { 高: 0, 中: 1, 低: 2 };
for (const b of BOOKS) {
  const d = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'out', b.slug + '.json'), 'utf8'));
  const m = d.meta || {};
  books.push({ slug: b.slug, title: b.title, author: m.author, publisher: m.publisher, year: m.year });
  d.entries.forEach((e) => items.push({ id: e.id, cat: e.cat, src: '參考書《' + b.title + '》' + (e.pages || ''), title: e.title, body: e.body, tags: (e.tags || []).concat(['參考書']), muscles: e.muscles || [], points: e.points || [], regions: e.regions || [], book: b.slug }));
  // 介紹
  let ib = `**${m.author || ''}**，${m.publisher || ''}，${m.year || ''}。\n\n${m.summary || ''}\n\n### 章節地圖\n`;
  (d.outline || []).forEach((o) => (ib += `- **${o.chapter}**（${o.pages}）：${o.gist}\n`));
  ib += `\n### 本站整理的條目（${d.entries.length} 則）\n`;
  d.entries.forEach((e) => (ib += `- ${e.title}（${e.pages || ''}）\n`));
  ib += `\n條目都是用自己的話整理重點並標註頁碼，示意圖為依書中內容重新繪製；細節請對照原書。`;
  items.push({ id: 'b-' + b.slug + '-intro', cat: '人物與流派', src: '參考書《' + b.title + '》', title: '參考書：《' + b.title + '》導讀', body: ib, tags: ['參考書', b.title], book: b.slug });
  // 比對
  const cs = d.conflicts.slice().sort((a, c) => (SEV[a.severity] ?? 3) - (SEV[c.severity] ?? 3));
  let cb = `逐項比對《${b.title}》與課堂資料。共 ${cs.length} 項：` + ['高', '中', '低'].map((s) => s + ' ' + cs.filter((c) => c.severity === s).length).join('、') + '（嚴重度）。\n';
  cb += '「衝突」＝說法相反；「程度差異」＝方向相同但做法或強度不同；「用詞不同」＝同一件事不同名稱；「補充」＝課堂沒提到或一致的地方。\n';
  cs.forEach((c) => {
    allC.push(Object.assign({}, c, { btitle: b.title, slug: b.slug }));
    cb += `\n### 【${c.severity}】${c.topic}（${c.type}）\n`;
    if (c.severity === '高') cb += `!! ${refs(c.note)}\n`;
    cb += `- **課堂：**${refs(c.course)}\n- **本書：**${c.book}（${c.pages}）\n`;
    if (c.severity !== '高') cb += `- **怎麼看：**${refs(c.note)}\n`;
  });
  items.push({ id: 'b-' + b.slug + '-compare', cat: '原則', src: '參考書《' + b.title + '》比對', title: '《' + b.title + '》與課程的比對', body: cb, tags: ['參考書', '衝突', '比對'], book: b.slug });
}
// 總覽
const hi = allC.filter((c) => c.severity === '高'); const mid = allC.filter((c) => c.severity === '中');
let ob = `目前已整理 ${BOOKS.length} 本參考書（${BOOKS.map((b) => '《' + b.title + '》').join('、')}），共比對 ${allC.length} 項：衝突 ${allC.filter((c) => c.type === '衝突').length}、程度差異 ${allC.filter((c) => c.type === '程度差異').length}、用詞不同 ${allC.filter((c) => c.type === '用詞不同').length}、補充 ${allC.filter((c) => c.type === '補充').length}。\n\n`;
ob += '### 取捨原則\n- **安全優先**：書中涉及衝擊性矯正、脫位整復、放血或對婦科／攝護腺疾病的療效宣稱，一律以課堂的「先轉介、只做周邊放鬆」為準。\n- **定位以現行標準為準**：穴位定位以 WHO／WPRO 標準（《經穴大全》）為準，本站的穴位資料已依此修正。\n- **用詞不同不等於衝突**：書以股骨動作命名（內旋／外旋肌），課堂以髂骨相對 S2 的位置命名（EX／IN），對應的肌肉其實一致。\n- 有疑問時，用課堂的主動／被動測試與觸診實際確認，再決定處理哪一側。\n';
ob += '\n### 嚴重度「高」\n';
hi.forEach((c) => (ob += `- **${c.topic}**（《${c.btitle}》${c.pages}）：${refs(c.note)}\n`));
ob += '\n### 嚴重度「中」\n';
mid.forEach((c) => (ob += `- **${c.topic}**（《${c.btitle}》${c.pages}，${c.type}）\n`));
ob += '\n各書的完整比對見：' + BOOKS.map((b) => '「《' + b.title + '》與課程的比對」').join('、') + '。';
items.unshift({ id: 'b-overview', cat: '原則', src: '參考書比對', title: '參考書與課程理論：衝突總覽', body: ob, tags: ['參考書', '衝突', '比對', '總覽'] });
const out = '/* 參考書補充條目與比對（由 tools/books/gen_books.js 產生；內容為自行整理之摘要並標註頁碼） */\n'
  + 'window.KB_BOOKS = ' + JSON.stringify(books) + ';\n'
  + 'window.KB_ITEMS.push(...' + JSON.stringify(items, null, 0) + ');\n';
fs.writeFileSync(SRC + 'data_books.js', out);
console.log('items', items.length, 'conflicts', allC.length, 'high', hi.length, 'mid', mid.length);
