/* ===== 推拿整復手札：主程式 ===== */
(function () {
  'use strict';
  const MU = {}; window.MUSCLES.forEach((m) => (MU[m.id] = m));
  const PT = {}; window.POINTS.forEach((p) => (PT[p.id] = p));
  const MER = {}; window.MERIDIANS.forEach((m) => (MER[m.id] = m));
  const SIN = {}; window.SINEWS.forEach((m) => (SIN[m.id] = m));
  const NODE = {}; window.CHAIN_NODES.forEach((n) => (NODE[n.id] = n));
  const FIND = {}; window.FINDINGS.forEach((g) => g.items.forEach((f) => (FIND[f.id] = Object.assign({ group: g.group, stName: String(g.group).split('・')[0] }, f))));
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  const BACKEND = window.TN_BACKEND || null; const FB = !!(BACKEND && BACKEND.kind === 'firebase');
  const AI_NAME = FB ? 'AI（Gemini）' : 'Claude';

  // ---------- DOM 工具 ----------
  Element.prototype.ap = function (...k) { this.append(...k.flat(9).filter((x) => x != null && x !== false)); return this; };
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(9).forEach((c) => { if (c == null || c === false) return; e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return e;
  }
  const $ = (s, r = document) => r.querySelector(s);
  const clear = (e) => { while (e.firstChild) e.removeChild(e.firstChild); return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }
  const store = { get(k, d) { try { const v = localStorage.getItem('tn_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('tn_' + k, JSON.stringify(v)); } catch (e) { } } };
  const sideTxt = (s) => (s === 'L' ? '左' : s === 'R' ? '右' : '雙');
  const sideBadge = (s, cls) => h('span', { class: 'side-b ' + (cls || ''), title: s === 'B' ? '雙側' : s === 'L' ? '左側' : '右側' }, sideTxt(s));

  // ---------- 分頁 ----------
  const TABS = [['assess', '評估'], ['chain', '連鎖'], ['sim', '模擬'], ['v3d', '3D 圖譜'], ['kb', '知識庫'], ['cases', '個案'], ['admin', '後台']];
  let curTab = 'assess';
  function showTab(id) {
    curTab = id;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false'));
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== 'p-' + id));
    if (id === 'v3d') V3.ensure();
    if (id === 'kb') TX.load();
    if (id === 'cases') Cases.render();
    if (id === 'admin') Admin.load();
    store.set('tab', id);
    window.scrollTo({ top: 0 });
  }

  // =====================================================================
  //  身分、權限（claude.ai 帳號）
  // =====================================================================
  const Auth = {
    ready: false, dev: !(window.claude && window.claude.use), db: null, user: null,
    id: null, name: '', avatar: '', isOwner: false, isAdmin: false, ownWrite: null, listeners: [],
    async init() {
      if (!this.dev) {
        const c = window.claude;
        const [db, u] = await Promise.all([c.use('db').catch(() => null), c.use('user').catch(() => null)]);
        this.db = db; this.user = u;
        if (u) { try { const me = await u.me(); this.id = me.id || null; this.name = me.name || ''; this.avatar = me.avatarUrl || ''; this.isOwner = !!me.isOwner; this.isAdmin = !!(me.isOwner || me.canEdit); this.blocked = !!me.blocked; this.email = me.email || ''; } catch (e) { } }
      }
      this.ready = true; this.emit();
    },
    emit() { this.listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },
    role() {
      if (!this.ready) return 'loading';
      if (this.dev) return 'dev';
      if (this.isOwner) return 'owner';
      if (this.isAdmin) return 'admin';
      if (!this.id || !this.db) return 'guest';
      if (this.blocked) return 'blocked';
      return this.ownWrite === false ? 'viewer' : 'member';
    },
    ROLE: FB ? {
      loading: ['讀取中…', '正在確認你的身分。'],
      dev: ['本機模式', '沒有連上資料庫：所有資料只存在這個瀏覽器（僅供測試）。'],
      owner: ['擁有者・管理員', '你是網站擁有者：可直接新增、修改知識條目、審核投稿，並在「後台」管理會員權限、查看所有會員的個案。'],
      admin: ['管理員', '可直接新增、修改知識條目、審核投稿，並在「後台」管理會員、查看所有會員的個案。'],
      member: ['會員', '你可以投稿知識條目（管理員審核通過才會公開），也可以使用個案紀錄。個案只有你和管理員看得到。'],
      viewer: ['會員', '暫時無法寫入資料庫。'],
      blocked: ['已停用', '你的帳號已被管理員停用投稿與個案寫入；其他功能可照常使用。'],
      guest: ['未登入', '用 Google 帳號登入（第一次登入就完成註冊）後，可以使用個案紀錄與投稿。評估、連鎖、模擬、3D 與知識庫不需登入。'],
    } : {
      loading: ['讀取中…', '正在確認你的身分。'],
      dev: ['本機模式', '沒有連上 claude.ai：所有資料只存在這個瀏覽器，權限不上鎖（僅供測試）。'],
      owner: ['擁有者・管理員', '你是這個頁面的擁有者：可直接新增、修改知識條目，審核別人的投稿。個案紀錄只有你自己看得到。'],
      admin: ['管理員', '你在分享設定中是「編輯者」：可直接新增、修改知識條目並審核投稿。個案紀錄只有你自己看得到。'],
      member: ['投稿者', '你可以投稿知識條目（管理員審核通過才會出現在知識庫），也可以使用只屬於你的個案紀錄。'],
      viewer: ['檢視者', '這個帳號對本頁只有檢視權限，無法投稿；個案紀錄只能存在這台裝置。需要投稿請請擁有者把你加為「參與者」。'],
      blocked: ['已停用', ''],
      guest: ['未登入', '請先登入 claude.ai。登入後才能使用個案紀錄與投稿；評估、連鎖、模擬、3D 與知識庫不需登入。'],
    },
    canPublish() { return this.dev || this.isAdmin; },
    canSubmit() { return !this.dev && !this.isAdmin && !this.blocked && !!this.id && !!this.db && this.ownWrite !== false; },
    async names(ids) {
      const out = {}; if (!this.user || !ids.length) return out;
      try { const ps = await this.user.profiles(ids); ids.forEach((i) => (out[i] = (ps && ps[i] && ps[i].name) || '')); } catch (e) { }
      return out;
    },
    sampler() {
      if (!this._sp) this._sp = (async () => {
        let s = null; this._lim = null;
        if (!this.dev) { try { s = await window.claude.use('sample'); } catch (e) { } if (s) { try { this._lim = await s.limits(); } catch (e) { } } }
        return s;
      })();
      return this._sp;
    },
  };

  // 頂欄帳號
  const Acct = {
    open: false,
    render() {
      const el = $('#acct'); if (!el) return; clear(el);
      const r = Auth.role(); const [label, desc] = Auth.ROLE[r];
      const who = Auth.name || (r === 'guest' ? '訪客' : r === 'dev' ? '本機' : r === 'loading' ? '…' : '已登入');
      el.ap(h('button', { class: 'acct-btn', type: 'button', 'aria-expanded': this.open ? 'true' : 'false', 'aria-haspopup': 'dialog', onclick: (e) => { e.stopPropagation(); this.open = !this.open; this.render(); } },
        Auth.avatar ? h('img', { src: Auth.avatar, alt: '' }) : h('span', { class: 'acct-av' + (r === 'guest' ? ' off' : '') }, r === 'guest' ? '鎖' : '我'),
        h('span', { class: 'acct-t' }, h('b', null, who), h('small', { class: 'role-' + r }, label))));
      if (!this.open) return;
      const ok = (b) => h('span', { class: 'acct-ok ' + (b ? 'y' : 'n'), 'aria-label': b ? '可以' : '不可以' }, b ? '✓' : '✕');
      const caseOK = r === 'dev' || r === 'owner' || r === 'admin' || r === 'member' || r === 'viewer';
      const close = () => { this.open = false; this.render(); };
      const pend = Subs.pendingCount();
      el.ap(h('div', { class: 'acct-pop', role: 'dialog', 'aria-label': '身分與權限', onclick: (e) => e.stopPropagation() },
        h('div', { class: 'eyebrow' }, '身分與權限'), h('h4', null, label), h('p', { class: 'small' }, desc),
        h('ul', { class: 'acct-rights' },
          h('li', null, ok(true), '評估、連鎖、模擬、3D、搜尋知識庫'),
          h('li', null, ok(caseOK), '個案紀錄' + (r === 'viewer' ? '（只存這台裝置）' : FB ? (Auth.isAdmin ? '（可查看所有會員）' : '（你和管理員看得到）') : '（只有自己看得到）')),
          h('li', null, ok(Auth.canSubmit() || Auth.canPublish()), Auth.canPublish() ? '新增知識條目（直接發佈）' : '投稿知識條目（需管理員審核）'),
          h('li', null, ok(Auth.canPublish()), '修改條目、審核投稿' + (FB ? '、會員後台' : ''))),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          caseOK ? h('button', { class: 'btn sm', onclick: () => { this.open = false; this.render(); showTab('cases'); } }, '個案紀錄') : null,
          Auth.isAdmin ? h('button', { class: 'btn sm' + (pend ? ' pri' : ''), onclick: () => { this.open = false; this.render(); KB.openSource('審核佇列'); } }, '審核佇列' + (pend ? '（' + pend + '）' : '')) : null,
          Auth.canSubmit() ? h('button', { class: 'btn sm', onclick: () => { this.open = false; this.render(); KB.openSource('我的投稿'); } }, '我的投稿') : null,
          FB && Auth.isAdmin ? h('button', { class: 'btn sm', onclick: () => { close(); showTab('admin'); } }, '會員後台') : null),
        FB ? h('div', { class: 'row', style: { marginTop: '10px' } },
          r === 'guest' ? h('button', { class: 'btn pri', onclick: () => BACKEND.signIn().catch((e) => toast('登入失敗：' + (e && e.code || e))) }, '用 Google 帳號登入') : h('button', { class: 'btn sm', onclick: () => BACKEND.signOut() }, '登出'),
          Auth.email ? h('span', { class: 'small muted' }, Auth.email) : null) : null,
        h('p', { class: 'small muted', style: { marginTop: '10px' } }, FB ? '用 Google 帳號登入，第一次登入即完成註冊，不另外設密碼。會員可投稿與使用個案紀錄；管理員由擁有者在「後台」指定。' : '登入就是你的 claude.ai 帳號，不另外設密碼。角色由這個頁面的分享設定決定：「Editor／編輯者」＝管理員，「Contributor／參與者」＝投稿者，其餘為檢視。')));
    },
  };

  // =====================================================================
  //  知識條目（管理員發佈，存在共享資料庫 notes）
  // =====================================================================
  const Notes = {
    list: [], mode: 'loading', listeners: [],
    init() {
      if (Auth.db) {
        this.mode = 'db';
        Auth.db.collection('notes').onSnapshot((snap) => {
          this.list = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.emit();
        }, () => { this.mode = 'local'; this.loadLocal(); });
        return;
      }
      this.mode = 'local'; this.loadLocal();
    },
    loadLocal() { this.list = Auth.dev ? store.get('notes', []) : []; this.emit(); },
    emit() { this.listeners.forEach((f) => f()); },
    async save(note) {
      if (!Auth.canPublish()) { toast('只有管理員可以直接發佈'); return false; }
      note.updated = Date.now(); if (!note.created) note.created = note.updated; if (Auth.id && !note.by) note.by = Auth.id;
      if (this.mode === 'db') {
        const body = Object.assign({}, note); delete body.id;
        Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
        try {
          if (note.id) await Auth.db.doc('notes/' + note.id).set(body);
          else { const r = await Auth.db.collection('notes').add(body); note.id = r.id; }
          return true;
        } catch (e) {
          if (e && e.code === 'invalid_argument') { toast('沒有權限寫入知識庫'); return false; }
          if (e && e.code === 'quota_exceeded') { toast('資料庫已滿，請刪除部分條目'); return false; }
          toast('儲存失敗，請稍後再試'); return false;
        }
      }
      const L = store.get('notes', []);
      if (!note.id) note.id = 'n' + Date.now().toString(36); const i = L.findIndex((x) => x.id === note.id);
      if (i >= 0) L[i] = note; else L.push(note); store.set('notes', L); this.loadLocal(); return true;
    },
    async remove(id) {
      if (!Auth.canPublish()) { toast('只有管理員可以刪除'); return false; }
      if (this.mode === 'db') { try { await Auth.db.doc('notes/' + id).delete(); return true; } catch (e) { toast('刪除失敗'); return false; } }
      store.set('notes', store.get('notes', []).filter((x) => x.id !== id)); this.loadLocal(); return true;
    },
  };

  // =====================================================================
  //  投稿與審核（kbsub/<uid> 一人一份；管理員可讀寫全部）
  // =====================================================================
  const Subs = {
    mine: {}, all: [], names: {}, listeners: [], showDone: false,
    init() {
      const db = Auth.db; if (!db || !Auth.id && !Auth.isAdmin) return;
      if (Auth.isAdmin) {
        db.collection('kbsub').onSnapshot(async (snap) => {
          this.all = snap.docs.map((d) => ({ uid: d.id, items: (d.data() || {}).items || {} }));
          const need = this.all.map((x) => x.uid).filter((u) => !(u in this.names));
          if (need.length) Object.assign(this.names, await Auth.names(need));
          this.emit();
        }, () => { });
      } else if (Auth.id) {
        db.doc('kbsub/' + Auth.id).onSnapshot((d) => { this.mine = d.exists ? ((d.data() || {}).items || {}) : {}; this.emit(); }, () => { });
      }
    },
    emit() { this.listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },
    pendingCount() { return Auth.isAdmin ? this.all.reduce((n, x) => n + Object.values(x.items).filter((i) => i.status === 'pending').length, 0) : 0; },
    rows() {
      if (Auth.isAdmin) {
        const out = []; this.all.forEach((u) => Object.entries(u.items).forEach(([sid, it]) => out.push(Object.assign({ uid: u.uid, sid }, it))));
        return out.filter((x) => this.showDone || x.status === 'pending').sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (b.updated || 0) - (a.updated || 0));
      }
      return Object.entries(this.mine).map(([sid, it]) => Object.assign({ uid: Auth.id, sid }, it)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    },
    get(uid, sid) {
      if (uid === Auth.id && this.mine[sid]) return Object.assign({ uid, sid }, this.mine[sid]);
      const u = this.all.find((x) => x.uid === uid); return u && u.items[sid] ? Object.assign({ uid, sid }, u.items[sid]) : null;
    },
    async write(uid, items) {
      try { await Auth.db.doc('kbsub/' + uid).set({ items, updated: Date.now() }); return true; }
      catch (e) {
        if (e && e.code === 'invalid_argument') { if (uid === Auth.id && !Auth.isAdmin) { Auth.ownWrite = false; Auth.emit(); } toast('你的帳號對這個頁面只有檢視權限，無法送出'); return false; }
        if (e && e.code === 'quota_exceeded') { toast('投稿空間已滿，請先刪除舊的投稿'); return false; }
        toast('送出失敗，請稍後再試'); return false;
      }
    },
    async submit(entry) {
      if (!Auth.canSubmit()) { toast('需要登入並有投稿權限'); return null; }
      const sid = entry.sid || 's' + Date.now().toString(36);
      const items = JSON.parse(JSON.stringify(this.mine)); const prev = items[sid] || {};
      const body = Object.assign({}, entry); delete body.sid;
      items[sid] = Object.assign(body, { status: 'pending', reason: '', created: prev.created || Date.now(), updated: Date.now() });
      return (await this.write(Auth.id, items)) ? sid : null;
    },
    async withdraw(sid) { const items = JSON.parse(JSON.stringify(this.mine)); delete items[sid]; return this.write(Auth.id, items); },
    async setStatus(uid, sid, status, reason, noteId) {
      const u = this.all.find((x) => x.uid === uid); if (!u || !u.items[sid]) return false;
      const items = JSON.parse(JSON.stringify(u.items));
      Object.assign(items[sid], { status, reason: reason || '', reviewed: Date.now(), noteId: noteId || null, updated: Date.now() });
      return this.write(uid, items);
    },
    async purge(uid, sid) { const u = this.all.find((x) => x.uid === uid); if (!u) return false; const items = JSON.parse(JSON.stringify(u.items)); delete items[sid]; return this.write(uid, items); },
  };
  const ST_LABEL = { pending: ['待審核', 'y'], approved: ['已發佈', 'j'], rejected: ['已退回', 't'] };

  // =====================================================================
  //  AI 輔助（圖片辨識、文字整理）與語音輸入
  // =====================================================================
  const AI = {
    schema() {
      const mus = window.MUSCLES.map((m) => m.id + '=' + m.name.replace(/（.*?）/g, '')).join('；');
      const pts = window.POINTS.map((p) => p.id + '=' + p.name).join('；');
      const regs = window.CHAIN_NODES.map((n) => n.id + '=' + n.name).join('；');
      return '只輸出一個 JSON 物件，不要其他文字：{"title": 字串（24 字內）, "cat": 從 [' + CATS.slice(1).join('、') + '] 選一個, "body": 字串（markdown：段落、「- 」清單、**粗體**、| 表格 |；忠於原文，不要自行補充原文沒有的內容，看不清或聽不清的地方寫「（不清）」）, "tags": 字串陣列（最多 6 個，知識點或部位關鍵字）, "muscles": 只能用肌肉清單的 id, "points": 只能用穴位清單的 id, "regions": 只能用部位清單的 id}\n'
        + '肌肉清單：' + mus + '\n穴位清單：' + pts + '\n部位清單：' + regs;
    },
    clean(o) {
      if (!o || typeof o !== 'object') return null;
      const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
      return {
        title: String(o.title || '').slice(0, 60), cat: CATS.includes(o.cat) && o.cat !== '全部' ? o.cat : '原則', body: String(o.body || ''),
        tags: arr(o.tags).slice(0, 8), muscles: arr(o.muscles).filter((x) => MU[x]), points: arr(o.points).filter((x) => PT[x]), regions: arr(o.regions).filter((x) => NODE[x]),
      };
    },
    async run(kind, payload, onStatus) {
      const s = await Auth.sampler();
      if (!s) { onStatus(FB ? '請先登入才能使用 AI 辨識。' : '這個檢視無法使用 Claude（未登入或未開放），請改用文字輸入。'); return null; }
      const head = '你是推拿整復課程的筆記整理助理，使用繁體中文（台灣用語）。';
      let prompt, opts = { modelTier: 'default' };
      if (kind === 'image') {
        if (!Auth._lim || !Auth._lim.images) { onStatus('這個檢視不能傳送圖片給 ' + AI_NAME + '。'); return null; }
        prompt = head + '附上的是課堂筆記或講義的照片。請辨識上面的文字與圖示重點，整理成一則知識庫條目。圖示（例如骨骼、箭頭、表格）用文字描述。\n' + this.schema();
        opts.images = payload.slice(0, Auth._lim.images.maxCount || 1);
      } else if (kind === 'audio') {
        if (!Auth._lim || !Auth._lim.audio) { onStatus('這個版本不能辨識錄音檔。'); return null; }
        const f = payload[0]; if (f.size > Auth._lim.audio.maxBytes) { onStatus('錄音檔太大（上限約 ' + Math.round(Auth._lim.audio.maxBytes / 1e6) + ' MB），請先剪成較短的片段。'); return null; }
        prompt = head + '附上的是一段課堂或個人錄音（中文，可能夾雜台語或口語）。請先聽寫重點，修正明顯的辨識錯誤，再整理成一則知識庫條目；只寫錄音裡真的講到的內容。\n' + this.schema();
        opts.files = [f];
      } else {
        prompt = head + '下面是使用者輸入的文字（可能來自語音輸入或逐字稿，會有錯字或口語）。請修正明顯錯字、去掉口語贅詞，整理成一則知識庫條目，但不要改變原意。\n' + this.schema() + '\n\n原文：\n' + String(payload).slice(0, 12000);
      }
      onStatus(FB ? (kind === 'image' ? 'AI 正在辨識照片…' : kind === 'audio' ? 'AI 正在聽錄音並整理…（較長的錄音需要一兩分鐘）' : 'AI 正在整理文字…') : kind === 'image' ? 'Claude 正在辨識照片…（使用你自己的 Claude 額度）' : 'Claude 正在整理文字…（使用你自己的 Claude 額度）');
      try { const r = await s.json(prompt, opts); const c = this.clean(r); onStatus(c ? '已填入表單，請檢查後再送出。' : '辨識結果格式不對，請再試一次。'); return c; }
      catch (e) {
        const code = e && e.code;
        onStatus(code === 'not_granted' ? (FB ? 'AI 功能尚未啟用，請管理員到 Firebase 開啟 AI Logic。' : '你沒有允許這個頁面使用 Claude。') : code === 'rate_limited' ? AI_NAME + ' 使用次數暫時到上限，請稍後再試。' : code === 'image_rejected' ? '這張圖片無法讀取（格式或大小不符）。' : code === 'cancelled' ? '已取消。' : '辨識失敗，請稍後再試。');
        return null;
      }
    },
  };
  const Voice = {
    rec: null, on: false,
    supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
    toggle(ta, btn, say) {
      if (this.on && this.rec) { this.rec.stop(); return; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { say('這個瀏覽器不支援網頁語音辨識。手機可直接用鍵盤上的麥克風（語音輸入）說到「內容」欄。'); return; }
      const r = new SR(); r.lang = 'zh-TW'; r.continuous = true; r.interimResults = true;
      const base = ta.value; let fin = '';
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + '。'; else interim += t; }
        ta.value = base + (base && !/\n$/.test(base) ? '\n' : '') + fin + interim; ta.dispatchEvent(new Event('input'));
      };
      r.onerror = (e) => say(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? (FB ? '無法使用麥克風，請在瀏覽器允許麥克風權限，或改用手機鍵盤的語音輸入。' : '這個頁面無法使用麥克風。請改用手機鍵盤的語音輸入；錄音檔可以傳給 Claude 在對話裡轉成文字。') : e.error === 'no-speech' ? '沒有聽到聲音。' : '語音辨識中斷（' + e.error + '）。');
      r.onend = () => { this.on = false; this.rec = null; btn.textContent = '語音輸入'; btn.classList.remove('on'); };
      try { r.start(); this.on = true; this.rec = r; btn.textContent = '停止語音'; btn.classList.add('on'); say('聆聽中…說完按「停止語音」，再按「AI 整理文字」修正錯字。'); }
      catch (e) { say('無法啟動語音辨識。'); }
    },
  };

  // =====================================================================
  //  1. 評估
  // =====================================================================
  const EXAMPLE_ASSESS = { c_lbp: 'R', c_neckstiff: 'B', c_head_back: 'B', c_onset_chronic: 'B', c_worse_sit: 'B', c_pain_dull: 'B', o_head_fwd: 'B', o_round: 'B', o_lordosis: 'B', t_psis_high: 'R', t_isch_high: 'R', q_longsit_ant: 'R', t_thomas: 'R', q_sh_lift: 'B' };
  const STN = window.STATIONS || [];
  const LANDMARK = (k) => (window.LANDMARKS || {})[k] || { n: '', v: '' };
  const REG_ORDER = { foot: 0, ankle: 0, pelvis: 1, hip: 1, pubis: 1, sacrum: 1, lspine: 2, diaphragm: 3, tspine: 3, scap: 4, cspine: 4, occ: 4, knee: 5, shoulder: 5, elbow: 5, wrist: 5, head: 6 };
  const DET = window.DETAIL || { pt: {}, mu: {}, bn: {}, sn: {} };
  const TQ = {}; (window.TECHS || []).forEach((t) => (TQ[t.id] = t));
  const svgNS = 'http://www.w3.org/2000/svg';
  const SV = (t, a, txt) => { const e = document.createElementNS(svgNS, t); for (const k in a || {}) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
  // 人形輪廓（200×440）
  function bodyShape(view) {
    const g = SV('g', { class: 'fig-body' });
    const P = (d) => g.appendChild(SV('path', { d }));
    g.appendChild(SV('ellipse', { cx: 100, cy: 36, rx: 19, ry: 24 }));
    P('M91 58 L109 58 L111 82 L89 82 Z');
    if (view === 'sit') {
      P('M56 92 Q100 80 144 92 L150 112 L140 200 L142 240 Q140 268 128 276 L72 276 Q60 268 58 240 L60 200 L50 112 Z');
      P('M52 98 L38 112 L30 190 L36 236 L48 234 L46 192 L58 130 Z'); P('M148 98 L162 112 L170 190 L164 236 L152 234 L154 192 L142 130 Z');
      g.appendChild(SV('rect', { x: 46, y: 278, width: 108, height: 12, rx: 3, class: 'fig-prop' }));
      g.appendChild(SV('rect', { x: 54, y: 290, width: 8, height: 120, class: 'fig-prop' })); g.appendChild(SV('rect', { x: 138, y: 290, width: 8, height: 120, class: 'fig-prop' }));
      return g;
    }
    P('M56 92 Q100 80 144 92 L150 112 L140 200 L144 246 Q140 276 124 286 L104 290 L96 290 L76 286 Q60 276 56 246 L60 200 L50 112 Z');
    P('M52 98 L38 112 L30 190 L22 256 L18 276 L30 280 L34 258 L46 192 L58 130 Z'); P('M148 98 L162 112 L170 190 L178 256 L182 276 L170 280 L166 258 L154 192 L142 130 Z');
    P('M60 270 L98 284 L94 360 L90 418 L94 438 L66 438 L68 418 L64 360 Z'); P('M140 270 L102 284 L106 360 L110 418 L106 438 L134 438 L132 418 L136 360 Z');
    if (view === 'back') { g.appendChild(SV('line', { x1: 100, y1: 84, x2: 100, y2: 270, class: 'fig-spine' })); }
    else { g.appendChild(SV('path', { d: 'M80 128 Q100 138 120 128', class: 'fig-line' })); g.appendChild(SV('circle', { cx: 100, cy: 205, r: 2, class: 'fig-line' })); }
    return g;
  }

  const Assess = {
    sel: (function (s) { if (window.migrateFindings) return window.migrateFindings(s || {}); const A = window.FINDING_ALIASES || {}; const o = {}; Object.entries(s || {}).forEach(([k, v]) => { o[A[k] || k] = v; }); return o; })(store.get('assess', null) || Object.assign({}, EXAMPLE_ASSESS)), example: !store.get('assess', null), q: '', st: store.get('assess_st', 'cc'), vas: store.get('assess_vas', null), showHow: store.get('assess_how', false), recTab: 'mu', hover: null,
    build(root) {
      const left = h('div', { class: 'card pad as-left' });
      const right = h('div', { class: 'stack', id: 'as-res' });
      this.stepper = h('nav', { class: 'as-steps', 'aria-label': '評估步驟' });
      root.ap(
        h('div', { class: 'sec-h' }, h('h2', null, '客人評估'), h('span', { class: 'muted small' }, '依課堂流程分站：主訴 → 站姿 → 坐姿 → 俯臥 → 仰臥 → 動作測試；右邊即時列出判讀與處理建議')),
        h('p', { class: 'lead' }, '有左右之分的項目：點一下記「左」、再點「右」、第三下「雙側」、第四下取消；人形圖上的點也可以直接點（點客人左側的點＝左）。判讀是輔助思考的清單，不取代你的手感與醫師診斷。'),
        this.stepper, h('div', { class: 'grid2' }, left, right));
      this.jump = h('button', { class: 'btn pri jump', onclick: () => right.scrollIntoView({ behavior: 'smooth' }) }, '看判讀結果 ↓');
      root.ap(this.jump);
      try { new IntersectionObserver((es) => { this.jump.style.visibility = es[0].isIntersecting ? 'hidden' : ''; }).observe(right); } catch (e) { }
      this.left = left; this.right = right; this.renderLeft(); this.renderRight();
    },
    count(st) { let n = 0; st.groups.forEach((g) => g.items.forEach((f) => { if (this.sel[f.id]) n++; })); return n; },
    renderSteps() {
      const S = clear(this.stepper);
      STN.forEach((st, i) => {
        const n = this.count(st); const red = st.groups.some((g) => g.red && g.items.some((f) => this.sel[f.id]));
        S.ap(h('button', { class: 'as-step' + (this.st === st.id && !this.q ? ' on' : ''), 'aria-current': this.st === st.id ? 'step' : null, onclick: () => this.go(st.id) },
          h('span', { class: 'no' }, i + 1), h('span', { class: 'nm' }, st.name), h('span', { class: 'sub' }, st.sub), n ? h('span', { class: 'cnt' + (red ? ' red' : '') }, n) : null));
      });
    },
    go(id) { this.st = id; this.q = ''; store.set('assess_st', id); this.renderLeft(); if (window.innerWidth < 900) this.stepper.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    renderLeft() {
      this.renderSteps();
      const L = clear(this.left);
      L.ap(h('div', { class: 'row', style: { marginBottom: '10px' } },
        this.example ? h('span', { class: 'ex-tag' }, '目前是範例：久坐上班族') : null,
        h('span', { class: 'sp' }),
        h('label', { class: 'small row', style: { gap: '4px' } }, h('input', { type: 'checkbox', checked: this.showHow, onchange: (e) => { this.showHow = e.target.checked; store.set('assess_how', this.showHow); this.renderGroups(); } }), '顯示檢查方法'),
        h('button', { class: 'btn sm', onclick: () => { this.sel = Object.assign({}, EXAMPLE_ASSESS); this.example = true; this.vas = null; this.persist(); this.renderLeft(); this.renderRight(); } }, '載入範例'),
        h('button', { class: 'btn sm', onclick: () => { this.sel = {}; this.example = false; this.vas = null; this.persist(); this.renderLeft(); this.renderRight(); } }, '清除全部')));
      L.ap(h('input', { class: 'fsearch', id: 'as-q', placeholder: '跨站篩選項目，例如：膝、肩、髂後上棘…', value: this.q, oninput: (e) => { this.q = e.target.value.trim(); this.renderSteps(); this.renderGroups(); } }));
      this.groupsEl = h('div'); L.ap(this.groupsEl); this.renderGroups();
    },
    station() { return STN.find((s) => s.id === this.st) || STN[0]; },
    renderGroups() {
      const G = clear(this.groupsEl);
      if (this.q) {
        let any = false;
        STN.forEach((st) => st.groups.forEach((g) => {
          const items = g.items.filter((f) => f.label.includes(this.q) || g.name.includes(this.q) || (f.how || '').includes(this.q) || (f.lm && LANDMARK(f.lm).n.includes(this.q)));
          if (!items.length) return; any = true; G.ap(this.groupBox(g, items, st.name + '・'));
        }));
        if (!any) G.ap(h('div', { class: 'empty' }, '沒有符合「' + this.q + '」的項目。'));
        return;
      }
      const st = this.station();
      G.ap(h('div', { class: 'as-intro' }, h('h3', null, st.name + (st.sub ? '：' + st.sub : '')), h('p', { class: 'small' }, st.intro)));
      if (st.id === 'cc') G.ap(this.vasBox());
      if (st.id === 'nerve') {
        const segs = []; st.groups.forEach((g) => g.items.forEach((f) => { if (this.sel[f.id]) String(f.seg || '').split(/[、,，\s–-]+/).forEach((s) => { if (/^[CTLS]\d{1,2}$/.test(s) && !segs.includes(s)) segs.push(s); }); }));
        G.ap(h('div', { class: 'row', style: { margin: '0 0 12px' } }, h('button', { class: 'btn sm', onclick: () => V3.showDerm(segs) }, segs.length ? '在 3D 標出皮節：' + segs.join('、') : '在 3D 看皮節圖'), KB.has('nv-tables') ? h('button', { class: 'btn sm', onclick: () => KB.open('nv-tables') }, '皮節、肌節、反射總表') : null, KB.has('k-nv-derm') ? h('button', { class: 'link small', onclick: () => KB.open('k-nv-derm') }, '神經判斷怎麼做 →') : null));
      }
      if (st.pose) G.ap(this.figure(st));
      st.groups.forEach((g) => G.ap(this.groupBox(g, g.items)));
      const i = STN.indexOf(st);
      G.ap(h('div', { class: 'row as-nav' }, i > 0 ? h('button', { class: 'btn', onclick: () => this.go(STN[i - 1].id) }, '← ' + STN[i - 1].name) : null, h('span', { class: 'sp' }),
        i < STN.length - 1 ? h('button', { class: 'btn pri', onclick: () => this.go(STN[i + 1].id) }, '下一站：' + STN[i + 1].name + ' →') : h('button', { class: 'btn pri', onclick: () => this.right.scrollIntoView({ behavior: 'smooth' }) }, '看判讀與處理建議 →')));
    },
    vasBox() {
      const v = this.vas;
      const out = h('b', { class: 'mono' }, v == null ? '—' : String(v));
      return h('div', { class: 'as-vas' }, h('span', { class: 'small' }, '疼痛程度（0 不痛 – 10 最痛）'),
        h('input', { type: 'range', min: 0, max: 10, step: 1, value: v == null ? 0 : v, 'aria-label': '疼痛程度', oninput: (e) => { this.vas = +e.target.value; out.textContent = String(this.vas); store.set('assess_vas', this.vas); } }), out,
        v != null ? h('button', { class: 'link small', onclick: () => { this.vas = null; store.set('assess_vas', null); this.renderGroups(); } }, '清除') : null);
    },
    groupBox(g, items, prefix) {
      const n = g.items.filter((f) => this.sel[f.id]).length;
      const box = h('div', { class: 'fgroup' + (g.red ? ' red' : '') }, h('h3', null, (prefix || '') + g.name, n ? h('span', { class: 'badge ' + (g.red ? 'y' : 'j') }, n + ' 項') : null));
      if (this.showHow) {
        box.ap(h('div', { class: 'as-rows' }, items.map((f) => { const v = this.sel[f.id];
          return h('button', { class: 'as-row' + (v ? ' on' : ''), 'aria-pressed': v ? 'true' : 'false', onclick: () => this.toggle(f), onmouseenter: () => this.hl(f.lm), onmouseleave: () => this.hl(null) },
            h('span', { class: 'lb' }, f.label, v && f.side ? h('span', { class: 'sd' }, (f.sideLabel || '') + sideTxt(v)) : null), f.how ? h('span', { class: 'hw' }, f.how) : (f.lm ? h('span', { class: 'hw' }, '觸診位置：' + LANDMARK(f.lm).n) : null)); })));
      } else {
        box.ap(h('div', { class: 'chips' }, items.map((f) => { const v = this.sel[f.id];
          return h('button', { class: 'chip' + (v ? ' on' : ''), 'aria-pressed': v ? 'true' : 'false', title: f.how || (f.lm ? '位置：' + LANDMARK(f.lm).n : ''), onclick: () => this.toggle(f), onmouseenter: () => this.hl(f.lm), onmouseleave: () => this.hl(null) },
            f.label, v && f.side ? h('span', { class: 'sd' }, (f.sideLabel || '') + sideTxt(v)) : null); })));
      }
      return box;
    },
    // 人形圖：骨性標誌熱點
    figure(st) {
      const views = st.pose === 'map' || st.pose === 'stand' ? ['front', 'back'] : st.pose === 'sit' ? ['sit'] : st.pose === 'prone' ? ['back'] : ['front'];
      const items = []; st.groups.forEach((g) => g.items.forEach((f) => { if (f.lm) items.push(f); }));
      const wrap = h('div', { class: 'as-fig' + (views.length === 1 ? ' one' : '') });
      this.dots = [];
      views.forEach((vw) => {
        const svg = SV('svg', { viewBox: '0 0 200 450', role: 'img', 'aria-label': (st.name) + '骨性標誌圖' });
        if (st.pose === 'prone' || st.pose === 'supine') svg.appendChild(SV('rect', { x: 4, y: 4, width: 192, height: 442, rx: 10, class: 'fig-table' }));
        svg.appendChild(bodyShape(vw));
        const byLm = {}; items.forEach((f) => { const lm = LANDMARK(f.lm); if (lm.v === vw) (byLm[f.lm] = byLm[f.lm] || []).push(f); });
        Object.entries(byLm).forEach(([k, fs]) => {
          const lm = LANDMARK(k);
          const spots = lm.C ? [['B', lm.C]] : [['L', lm.L], ['R', lm.R]];
          spots.forEach(([sd, xy]) => {
            const on = fs.some((f) => { const v = this.sel[f.id]; return v && (sd === 'B' || v === sd || v === 'B'); });
            const c = SV('circle', { cx: xy[0], cy: xy[1], r: 6.5, class: 'fig-dot' + (on ? ' on' : ''), tabindex: 0, role: 'button', 'data-lm': k });
            c.appendChild(SV('title', null, lm.n + (sd !== 'B' ? '（' + sideTxt(sd) + '）' : '') + '：' + fs.map((f) => f.label).join('／')));
            const act = () => { if (fs.length === 1) this.toggleAt(fs[0], sd); else this.pickAt(fs, sd, k); };
            c.addEventListener('click', act); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
            svg.appendChild(c); this.dots.push(c);
          });
        });
        const cap = vw === 'front' ? (st.pose === 'supine' ? '仰臥（客人右側在左）' : '正面（客人右側在左）') : vw === 'back' ? (st.pose === 'prone' ? '俯臥（客人左側在左）' : '背面（客人左側在左）') : '坐姿背面（客人左側在左）';
        wrap.ap(h('figure', null, svg, h('figcaption', null, cap)));
      });
      this.pickBox = h('div', { class: 'as-pick', hidden: true }); wrap.ap(this.pickBox);
      return wrap;
    },
    hl(lm) { (this.dots || []).forEach((d) => d.classList.toggle('hl', !!lm && d.dataset.lm === lm)); },
    pickAt(fs, sd, k) {
      const B = clear(this.pickBox); B.hidden = false;
      B.ap(h('div', { class: 'small muted' }, LANDMARK(k).n + (sd !== 'B' ? '（' + sideTxt(sd) + '）' : '') + '：選一項'), h('div', { class: 'chips' }, fs.map((f) => h('button', { class: 'chip sm' + (this.sel[f.id] ? ' on' : ''), onclick: () => { B.hidden = true; this.toggleAt(f, sd); } }, f.label))), h('button', { class: 'link small', onclick: () => (B.hidden = true) }, '關閉'));
    },
    toggleAt(f, sd) {
      const v = this.sel[f.id];
      if (!f.side || sd === 'B') { if (v) delete this.sel[f.id]; else this.sel[f.id] = 'B'; }
      else { const o = sd === 'L' ? 'R' : 'L'; const nx = !v ? sd : v === sd ? null : v === 'B' ? o : 'B'; if (nx) this.sel[f.id] = nx; else delete this.sel[f.id]; }
      this.changed();
    },
    toggle(f) {
      const v = this.sel[f.id];
      if (!f.side) { if (v) delete this.sel[f.id]; else this.sel[f.id] = 'B'; }
      else { const nx = { undefined: 'L', L: 'R', R: 'B', B: undefined }[v]; if (nx) this.sel[f.id] = nx; else delete this.sel[f.id]; }
      this.changed();
    },
    changed() {
      if (this.example) { this.example = false; const t = this.left.querySelector('.ex-tag'); if (t) t.remove(); }
      this.persist(); this.renderSteps(); this.renderGroups(); this.renderRight();
    },
    persist() { store.set('assess', this.example ? null : this.sel); store.set('assess_vas', this.vas); },
    compute() {
      const sel = this.sel;
      const pats = [];
      window.PATTERNS.forEach((p) => {
        let score = 0, max = 0; const sides = { L: 0, R: 0 }; const hits = [];
        for (const k in p.t) { max += p.t[k]; if (sel[k]) { score += p.t[k]; hits.push(k); if (sel[k] === 'L') sides.L += p.t[k]; if (sel[k] === 'R') sides.R += p.t[k]; } }
        if (score >= 3) { const side = sides.L > sides.R ? 'L' : sides.R > sides.L ? 'R' : 'B'; pats.push({ p, score, max, side, hits }); }
      });
      pats.sort((a, b) => b.score / Math.sqrt(b.max) - a.score / Math.sqrt(a.max));
      const top = pats.slice(0, 7);
      const opp = (s) => (s === 'L' ? 'R' : s === 'R' ? 'L' : 'B');
      const rel = (r, side) => (r === 'both' || r === 'mid' ? 'B' : r === 'same' ? side : opp(side));
      const tight = {}, weak = {};
      const add = (acc, mid, side, w, why) => {
        if (!MU[mid]) return; const o = acc[mid] || (acc[mid] = { id: mid, L: 0, R: 0, why: new Set() });
        if (side === 'B') { o.L += w; o.R += w; } else o[side] += w; o.why.add(why);
      };
      top.forEach(({ p, score, side }) => {
        const k = score / 4;
        (p.tight || []).forEach(([m, r, w]) => add(tight, m, rel(r, side), w * k, p.name));
        (p.weak || []).forEach(([m, r, w]) => add(weak, m, rel(r, side), w * k, p.name));
      });
      const rank = (acc) => Object.values(acc).map((o) => Object.assign(o, { s: Math.max(o.L, o.R), side: o.L > 0 && o.R > 0 ? (Math.abs(o.L - o.R) < 0.5 ? 'B' : o.L > o.R ? 'L' : 'R') : o.L > 0 ? 'L' : 'R' })).sort((a, b) => b.s - a.s);
      const T = rank(tight), Wk = rank(weak);
      // 穴位：規則 + 緊肌的相關穴
      const pts = {}; const ptWhy = {};
      top.forEach(({ p, score }) => (p.points || []).forEach((id, i) => { pts[id] = (pts[id] || 0) + score - i * 0.3; (ptWhy[id] = ptWhy[id] || new Set()).add(p.name); }));
      T.slice(0, 5).forEach((o) => (MU[o.id].points || []).slice(0, 2).forEach((id) => { pts[id] = (pts[id] || 0) + o.s * 0.4; (ptWhy[id] = ptWhy[id] || new Set()).add(MU[o.id].name); }));
      // 經筋：由緊的肌肉推
      const sn = {}; T.slice(0, 10).forEach((o) => (MU[o.id].sinew || []).forEach((s) => { const x = sn[s] || (sn[s] = { id: s, s: 0, mus: [], L: 0, R: 0 }); x.s += o.s; x.mus.push(o.id); x.L += o.L; x.R += o.R; }));
      const sinews = Object.values(sn).filter((x) => SIN[x.id]).sort((a, b) => b.s - a.s).slice(0, 5).map((x) => Object.assign(x, { side: x.L > 0 && x.R > 0 ? (Math.abs(x.L - x.R) < 0.5 ? 'B' : x.L > x.R ? 'L' : 'R') : x.L > 0 ? 'L' : 'R' }));
      // 骨頭、手法
      const bones = {}; const techs = {};
      top.forEach(({ p, score, side }) => {
        (p.bones || []).forEach(([id, r, note]) => { const s = rel(r, side); const b = bones[id] || (bones[id] = { id, s: 0, sides: new Set(), notes: [], from: new Set() }); b.s += score; b.sides.add(s); if (note && !b.notes.includes(note)) b.notes.push(note); b.from.add(p.name); });
        (p.techs || []).forEach((id, i) => { if (!TQ[id]) return; const t = techs[id] || (techs[id] = { id, s: 0, from: new Set() }); t.s += score - i * 0.4; t.from.add(p.name); });
      });
      const sideOf = (set) => (set.has('B') || (set.has('L') && set.has('R')) ? 'B' : set.has('L') ? 'L' : set.has('R') ? 'R' : 'B');
      const regions = new Set(); top.forEach(({ p }) => { (p.region || []).forEach((r) => regions.add(r)); (p.chain || []).forEach((r) => regions.add(r)); });
      const red = Object.keys(sel).filter((k) => k.startsWith('r_')).concat(top.filter((x) => x.p.refer).map((x) => x.p.id));
      const care = (window.CARE_RULES || []).filter((r) => r.when.some((k) => sel[k]));
      return { top, tight: T, weak: Wk, pts: Object.entries(pts).sort((a, b) => b[1] - a[1]).map((x) => x[0]).filter((id) => PT[id]).slice(0, 12), ptWhy, sinews,
        bones: Object.values(bones).filter((b) => DET.bn[b.id]).sort((a, b) => b.s - a.s).slice(0, 8).map((b) => Object.assign(b, { side: sideOf(b.sides) })),
        techs: Object.values(techs).sort((a, b) => b.s - a.s).slice(0, 8), regions: [...regions], red, care };
    },
    renderRight() {
      const R = clear(this.right); const res = this.compute(); this.last = res; const sel = this.sel;
      if (this.jump) this.jump.textContent = res.top.length ? '看判讀結果（' + res.top.length + '）↓' : '看判讀結果 ↓';
      // 摘要列
      const nAll = Object.keys(sel).length;
      R.ap(h('div', { class: 'card pad as-sum' }, h('div', { class: 'row' }, h('b', null, '已記錄 ' + nAll + ' 項'), this.vas != null ? h('span', { class: 'badge ' + (this.vas >= 7 ? 't' : this.vas >= 4 ? 'y' : 'j') }, '疼痛 ' + this.vas + '/10') : null, h('span', { class: 'sp' }),
        STN.map((st) => { const n = this.count(st); return n ? h('button', { class: 'chip sm', onclick: () => this.go(st.id) }, st.name + ' ' + n) : null; }))));
      if (res.red.length) {
        const flags = res.red.map((k) => (FIND[k] ? FIND[k].label : (window.PATTERNS.find((p) => p.id === k) || {}).name)).filter(Boolean);
        R.ap(h('div', { class: 'alert' }, h('b', null, '先確認安全：'), flags.join('、'), '。這些情況建議先轉介醫師檢查，推拿只做周邊放鬆，避免局部重壓、扳動。'));
      }
      if (res.care.length) R.ap(h('div', { class: 'card pad' }, h('div', { class: 'res-h' }, h('h3', null, '處理原則（依主訴與病程）')),
        h('div', { class: 'stack', style: { gap: '8px' } }, res.care.map((c) => h('div', { class: 'care' }, h('b', null, c.title), h('p', { class: 'small', style: { margin: '2px 0 0' } }, c.text, (c.kb || []).filter((k) => KB.has(k)).map((k) => h('button', { class: 'link small', style: { marginLeft: '6px' }, onclick: () => KB.open(k) }, '看說明 →'))))))));
      const tri = sel.t_muscle ? ['肌肉', '主動收縮會痛、被動（你幫他動）不痛 → 以肌肉放鬆為主。'] : sel.t_joint ? ['骨／關節或沾黏', '主動、被動都動不到位且會痛 → 關節或骨頭問題，也可能是慢性發炎沾黏（五十肩、肌腱炎）；先找角度、評估骨盆／脊椎位置，再處理周邊肌肉；外傷後要排除骨折。'] : sel.t_nerve ? ['神經', '主動不足卻不痛、被動可動 → 神經問題（如中風、神經損傷），不屬推拿處理範圍，請轉介。'] : null;
      if (tri) R.ap(h('div', { class: 'card pad' }, h('div', { class: 'eyebrow' }, '三分法（課堂 0727-2）'), h('div', null, h('b', null, '傾向「' + tri[0] + '」問題：'), tri[1])));
      if (!res.top.length) { R.ap(h('div', { class: 'empty' }, '從主訴開始，依序在各站勾選觀察與觸診結果；符合的模式、建議處理的肌肉、經筋、穴位、骨頭與手法會出現在這裡。')); return; }
      // 模式
      R.ap(h('div', { class: 'card pad' },
        h('div', { class: 'res-h' }, h('h3', null, '可能的模式'), h('span', { class: 'sp' }), h('span', { class: 'count' }, res.top.length + ' 項')),
        h('div', { class: 'stack' }, res.top.map(({ p, score, max, side, hits }) => h('div', { class: 'pat' },
          h('div', { class: 'pat-h' }, h('h4', null, p.name), side !== 'B' ? sideBadge(side) : null, p.refer ? h('span', { class: 'badge y' }, '建議轉介') : null, h('span', { class: 'sp' }),
            h('span', { class: 'meter', title: '符合程度' }, h('i', { style: { width: Math.min(100, (score / Math.min(max, 9)) * 100) + '%' } }))),
          h('p', { class: 'small', style: { margin: '6px 0' } }, p.desc),
          h('div', { class: 'chips', style: { gap: '4px' } }, hits.map((k) => FIND[k] ? h('span', { class: 'chip sm ev' }, h('span', { class: 'muted' }, (FIND[k].stName || '') + '・'), FIND[k].label, sel[k] && FIND[k].side && sel[k] !== 'B' ? '（' + sideTxt(sel[k]) + '）' : '') : null)),
          p.tech ? h('p', { class: 'small', style: { margin: '6px 0 0' } }, h('b', null, '處理思路：'), p.tech) : null,
          (p.confirm || []).length ? h('div', { class: 'confirm' }, h('div', { class: 'eyebrow' }, '再確認（表徵與輔助檢查）'), h('ul', null, p.confirm.map((c) => { const f = c.f && FIND[c.f]; const on = f && sel[c.f];
            return h('li', null, h('span', { class: 'badge ' + ({ muscle: 't', bone: 'y', nerve: 'w', sinew: 'j' }[c.kind] || '') }, { muscle: '肌肉', bone: '骨頭', test: '測試', nerve: '神經', sinew: '經筋' }[c.kind] || '檢查'), ' ', c.text.replace(/^再確認：/, ''),
              f ? h('button', { class: 'chip sm' + (on ? ' on' : ''), style: { marginLeft: '6px' }, title: on ? '已記錄' : '點一下把這個結果記到評估', onclick: () => this.toggle(f) }, on ? '✓ 已記錄' : '＋ 記錄結果') : null); }))) : null,
          p.diff ? h('p', { class: 'small muted', style: { margin: '6px 0 0' } }, h('b', null, '和相似模式的差別：'), p.diff) : null,
          h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'badge' }, p.src), h('span', { class: 'sp' }), h('button', { class: 'link small', onclick: () => KB.openSearch(p.name.replace(/（.*?）/g, '').split('／')[0]) }, '查相關知識')))))));
      // 處理建議（分頁）
      const tabs = [['mu', '肌肉', res.tight.length + res.weak.length], ['sn', '經筋', res.sinews.length], ['pt', '穴位', res.pts.length], ['bn', '骨頭／關節', res.bones.length], ['tq', '手法', res.techs.length]];
      const body = h('div', { class: 'rec-body' });
      const seg = h('div', { class: 'seg rec-tabs', role: 'tablist' }, tabs.map(([k, n, c]) => h('button', { role: 'tab', class: this.recTab === k ? 'on' : '', 'aria-selected': String(this.recTab === k), onclick: () => { this.recTab = k; seg.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('on', tabs[i][0] === k); b.setAttribute('aria-selected', String(tabs[i][0] === k)); }); this.renderRec(body, res); } }, n, c ? h('span', { class: 'muted mono', style: { fontSize: '11px', marginLeft: '4px' } }, c) : null)));
      R.ap(h('div', { class: 'card pad' }, h('div', { class: 'res-h' }, h('h3', null, '建議處理')), seg, body));
      this.renderRec(body, res);
      // 處理順序
      R.ap(this.planCard(res));
      R.ap(h('div', { class: 'row' },
        h('button', { class: 'btn pri', onclick: () => { V3.showTension(this.tensionMap(res)); } }, '在 3D 顯示緊／弱肌肉'),
        h('button', { class: 'btn', onclick: () => Chain.highlight(res.regions) }, '看連帶影響圖'),
        h('button', { class: 'btn', onclick: () => Cases.fromAssess(), title: '把這次評估結果存成個案的就診紀錄' }, '存到個案紀錄')));
      const edges = window.CHAIN_EDGES.filter((e) => res.regions.includes(e.a));
      R.ap(h('div', { class: 'card pad' }, h('div', { class: 'res-h' }, h('h3', null, '可能連帶影響的部位')),
        h('div', { class: 'chips', style: { marginBottom: '8px' } }, res.regions.map((r) => NODE[r] ? h('button', { class: 'chip', onclick: () => Chain.highlight([r], r) }, NODE[r].name) : null)),
        h('div', null, edges.slice(0, 6).map((e) => h('div', { class: 'edge-item small' }, h('span', { class: 'to' }, NODE[e.a].name + ' → ' + NODE[e.b].name), '　', e.how)))));
      const mids = new Set(res.tight.slice(0, 8).map((o) => o.id).concat(res.weak.slice(0, 6).map((o) => o.id)));
      const mine = Notes.list.filter((n) => (n.muscles || []).some((m) => mids.has(m)) || (n.regions || []).some((r) => res.regions.includes(r)));
      if (mine.length) R.ap(h('div', { class: 'card pad' }, h('div', { class: 'res-h' }, h('h3', null, '相關的新增條目')), mine.slice(0, 5).map((n) => h('div', { class: 'edge-item small' }, h('button', { class: 'link', onclick: () => KB.openNote(n.id) }, n.title), '　', (n.body || '').slice(0, 60)))));
    },
    renderRec(B, res) {
      clear(B); const k = this.recTab;
      const first = (s, n) => { s = String(s || '').replace(/\[\[[a-z]+:([\w-]+)\]\]/g, (m0, id) => (MU[id] || PT[id] || {}).name || id).replace(/[#*]/g, '').trim(); const i = s.search(/[。；]/); return (i > 0 && i < (n || 90) ? s.slice(0, i + 1) : s.slice(0, n || 90) + (s.length > (n || 90) ? '…' : '')); };
      if (k === 'mu') {
        const mrow = (o, i, kind) => { const m = MU[o.id]; const d = (DET.mu[o.id] || {}).md || '';
          const tip = kind === 't' ? first(m.release, 80) : '多為「被拉長的痛」：先放鬆對側的緊肌，再伸展／強化。';
          return h('div', { class: 'mrow' }, h('span', { class: 'rank' }, i + 1), h('div', null, h('span', { class: 'nm' }, m.name), ' ', sideBadge(o.side)),
            h('div', { class: 'row', style: { gap: '4px' } }, d ? h('button', { class: 'btn sm ghost', onclick: () => KB.open('mu:' + o.id), title: '看詳解：檢查、處理步驟、伸展與強化' }, '詳解') : null, h('button', { class: 'btn sm ghost', onclick: () => V3.focusMuscle(o.id), title: '在 3D 中查看位置' }, '3D')),
            h('div', { class: 'why' }, tip, h('br'), h('span', { class: 'muted' }, '來自：' + [...o.why].join('、')))); };
        B.ap(h('div', { class: 'cols2' },
          h('div', null, h('div', { class: 'res-h' }, h('span', { class: 'dot t' }), h('b', null, '優先放鬆（偏緊）')), h('div', { class: 'mlist' }, res.tight.slice(0, 8).map((o, i) => mrow(o, i, 't')))),
          h('div', null, h('div', { class: 'res-h' }, h('span', { class: 'dot w' }), h('b', null, '被拉長／待強化')), res.weak.length ? h('div', { class: 'mlist' }, res.weak.slice(0, 6).map((o, i) => mrow(o, i, 'w'))) : h('p', { class: 'small muted' }, '目前沒有明顯被拉長的肌群。'),
            h('p', { class: 'small muted', style: { marginTop: '8px' } }, '課堂原則：骨頭沒移位時，痠痛多是「被拉長的痛」；兩邊一樣緊或一樣鬆都不會痛，一緊一鬆才會。'))));
      } else if (k === 'sn') {
        if (!res.sinews.length) { B.ap(h('p', { class: 'small muted' }, '目前沒有明確對應的經筋。')); return; }
        B.ap(h('p', { class: 'small muted' }, '依偏緊的肌肉推算所屬經筋；沿經筋由遠端往近端找「結」處理（以痛為輸）。'));
        res.sinews.forEach((x) => { const s = SIN[x.id]; const ds = DET.sn[x.id] || {}; const kn = (ds.knotsFull || []).filter((kk) => (kk.muscles || []).some((m) => x.mus.includes(m)));
          B.ap(h('div', { class: 'rec-item' }, h('div', { class: 'row' }, h('span', { class: 'dot', style: { background: hex(s.color || 0x888888) } }), h('b', null, s.name), sideBadge(x.side), h('span', { class: 'sp' }),
            h('button', { class: 'btn sm ghost', onclick: () => KB.open('sw:' + x.id) }, '詳解'), h('button', { class: 'btn sm ghost', onclick: () => V3.focusSinew(x.id) }, '3D')),
            h('div', { class: 'small' }, '相關肌肉：', x.mus.map((m) => MU[m].name).join('、')),
            kn.length ? h('div', { class: 'small' }, '要找的結：', kn.map((kk) => kk.name + '（' + kk.where + '）').join('；')) : (ds.knots || []).length ? h('div', { class: 'small muted' }, '結：' + ds.knots.join('、')) : null)); });
      } else if (k === 'pt') {
        B.ap(h('div', { class: 'stack', style: { gap: '6px' } }, res.pts.map((id) => { const p = PT[id]; const mer = MER[p.mer] || {};
          return h('div', { class: 'rec-item' }, h('div', { class: 'row' }, h('span', { class: 'dot', style: { background: hex(mer.color || 0x888888) } }), h('b', null, p.name), h('span', { class: 'muted mono small' }, id), h('span', { class: 'sp' }),
            DET.pt[id] ? h('button', { class: 'btn sm ghost', onclick: () => KB.open('pt:' + id) }, '詳解') : null, h('button', { class: 'btn sm ghost', onclick: () => V3.focusPoint(id) }, '3D')),
            h('div', { class: 'small' }, first(p.loc, 70)), p.tn ? h('div', { class: 'small muted' }, '推拿：' + first(p.tn, 70)) : null, h('div', { class: 'small muted' }, '來自：' + [...(res.ptWhy[id] || [])].join('、'))); })));
      } else if (k === 'bn') {
        if (!res.bones.length) { B.ap(h('p', { class: 'small muted' }, '目前沒有需要特別處理的骨頭或關節。')); return; }
        B.ap(h('p', { class: 'small muted' }, '骨頭的位置多半跟著肌肉走：先放鬆把它拉歪的肌肉，再輕輕回位，處理後重新量。'));
        res.bones.forEach((b) => { const d = DET.bn[b.id];
          B.ap(h('div', { class: 'rec-item' }, h('div', { class: 'row' }, h('b', null, d.name), b.side !== 'B' ? sideBadge(b.side) : null, h('span', { class: 'sp' }), h('button', { class: 'btn sm ghost', onclick: () => KB.open(b.id) }, '詳解')),
            b.notes.length ? h('div', { class: 'small' }, b.notes.join('；')) : null, h('div', { class: 'small muted' }, '來自：' + [...b.from].join('、')))); });
      } else {
        if (!res.techs.length) { B.ap(h('p', { class: 'small muted' }, '目前沒有對應的手法建議。')); return; }
        res.techs.forEach((t) => { const d = TQ[t.id];
          B.ap(h('div', { class: 'rec-item' }, h('div', { class: 'row' }, h('b', null, d.name), h('span', { class: 'badge' }, d.group), h('span', { class: 'badge ' + (d.risk === '高' ? 't' : d.risk === '中' ? 'y' : 'j') }, '風險' + d.risk), h('span', { class: 'sp' }), h('button', { class: 'btn sm ghost', onclick: () => KB.open(t.id) }, '步驟')),
            h('div', { class: 'small' }, first(d.use, 90)), h('div', { class: 'small muted' }, '來自：' + [...t.from].join('、')))); });
        B.ap(h('p', { class: 'small muted', style: { marginTop: '6px' } }, '風險「高」的手法本站不建議自行操作；步驟頁提供安全的替代做法。'));
      }
    },
    planCard(res) {
      const steps = [];
      if (res.red.length) steps.push(['安全', '有警訊項目：先轉介，確認前只做遠端與周邊的輕柔放鬆。']);
      if (this.sel.c_onset_acute || this.sel.c_lbp_acute) steps.push(['急性先舒緩', '遠端取穴配合慢慢活動，局部不重壓、不矯正；腫熱可冰敷。']);
      const pats = res.top.filter((x) => !x.p.refer).slice().sort((a, b) => Math.min(...(a.p.region || []).map((r) => REG_ORDER[r] ?? 9)) - Math.min(...(b.p.region || []).map((r) => REG_ORDER[r] ?? 9)));
      const nm = (o) => MU[o[0]] ? MU[o[0]].name : '';
      pats.slice(0, 5).forEach(({ p, side }) => {
        const tq = (p.techs || []).filter((t) => TQ[t]).slice(0, 2).map((t) => TQ[t].name).join('、');
        const ms = (p.tight || []).slice(0, 3).map(nm).filter(Boolean).join('、');
        steps.push([p.name + (side !== 'B' ? '（' + sideTxt(side) + '）' : ''), (ms ? '先放鬆 ' + ms : '') + (tq ? (ms ? '；' : '') + '手法：' + tq : '') + '。']);
      });
      const recheck = [...new Set(res.top.flatMap((x) => x.hits))].filter((k) => !k.startsWith('c_') && !k.startsWith('r_') && FIND[k]).slice(0, 6).map((k) => FIND[k].label);
      if (recheck.length) steps.push(['重新評估', '每處理完一步就重新量：' + recheck.join('、') + '。最後回頭確認骨盆。']);
      const ws = res.weak.slice(0, 2).map((o) => MU[o.id].name); const ts = res.tight.slice(0, 2).map((o) => MU[o.id].name);
      if (ws.length || ts.length) steps.push(['居家建議', (ts.length ? '伸展 ' + ts.join('、') : '') + (ws.length ? (ts.length ? '；' : '') + '強化 ' + ws.join('、') : '') + '（各肌肉「詳解」有動作說明）。']);
      return h('div', { class: 'card pad' }, h('div', { class: 'res-h' }, h('h3', null, '建議處理順序'), h('span', { class: 'sp' }), KB.has('u-treatment-order') ? h('button', { class: 'link small', onclick: () => KB.open('u-treatment-order') }, '順序原則') : null),
        h('p', { class: 'small muted', style: { margin: '0 0 6px' } }, '依「先地基、再脊椎、最後局部」排列：足踝 → 骨盆、薦椎 → 腰 → 胸 → 頸肩 → 痛的局部（膝、肩、肘…）。'),
        h('ol', { class: 'plan' }, steps.map(([t, d]) => h('li', null, h('b', null, t), '：', d))));
    },
    summary() {
      const res = this.last || this.compute(); const sel = this.sel;
      const byStation = STN.map((st) => { const fx = []; st.groups.forEach((g) => g.items.forEach((f) => { const v = sel[f.id]; if (v) fx.push(f.label + (f.side && v !== 'B' ? '（' + sideTxt(v) + '）' : '')); })); return fx.length ? st.name + '：' + fx.join('、') : null; }).filter(Boolean);
      const nm = (o) => MU[o.id].name + (o.side !== 'B' ? '（' + sideTxt(o.side) + '）' : '');
      const lines = [];
      if (this.vas != null) lines.push('疼痛：' + this.vas + '/10');
      if (res.top.length) lines.push('可能模式：' + res.top.slice(0, 3).map(({ p, side }) => p.name + (side !== 'B' ? '（' + sideTxt(side) + '）' : '')).join('、'));
      if (res.tight.length) lines.push('偏緊：' + res.tight.slice(0, 6).map(nm).join('、'));
      if (res.weak.length) lines.push('被拉長：' + res.weak.slice(0, 4).map(nm).join('、'));
      if (res.sinews.length) lines.push('經筋：' + res.sinews.slice(0, 3).map((x) => SIN[x.id].name).join('、'));
      if (res.pts.length) lines.push('穴位：' + res.pts.slice(0, 6).map((id) => PT[id].name).join('、'));
      if (res.bones.length) lines.push('骨頭／關節：' + res.bones.slice(0, 4).map((b) => DET.bn[b.id].name.replace(/（.*/, '') + (b.side !== 'B' ? '（' + sideTxt(b.side) + '）' : '')).join('、'));
      if (res.techs.length) lines.push('手法：' + res.techs.slice(0, 4).map((t) => TQ[t.id].name).join('、'));
      if (res.red.length) lines.push('需注意：' + res.red.map((k) => (FIND[k] ? FIND[k].label : '')).filter(Boolean).join('、'));
      return { path: byStation.join('\n'), assess: lines.join('\n') };
    },
    tensionMap(res) {
      const st = {}; const lv = (s, max) => Math.min(1, s / max);
      const mt = res.tight[0] ? res.tight[0].s : 1, mw = res.weak[0] ? res.weak[0].s : 1;
      res.weak.forEach((o) => { st[o.id] = { L: o.L ? -Math.max(0.3, lv(o.L, mw)) : undefined, R: o.R ? -Math.max(0.3, lv(o.R, mw)) : undefined }; });
      res.tight.forEach((o) => { st[o.id] = { L: o.L ? Math.max(0.3, lv(o.L, mt)) : (st[o.id] || {}).L, R: o.R ? Math.max(0.3, lv(o.R, mt)) : (st[o.id] || {}).R }; });
      return st;
    },
  };

  // =====================================================================
  //  2. 連鎖
  // =====================================================================
  const Chain = {
    sel: 'sacrum', hl: null,
    build(root) {
      root.ap(h('div', { class: 'sec-h' }, h('h2', null, '連帶影響'), h('span', { class: 'muted small' }, '點身體上的節點，看它會影響哪裡、又常被哪裡影響')),
        h('p', { class: 'lead' }, '課堂反覆強調「痛的地方常是受害者」。膝蓋問題先看上面（骨盆、髖）再看下面（踝、距骨），兩者都正常才處理膝本身；薦椎是腰椎的底座，骨盆歪了脊椎一定跟著代償。'));
      this.svgBox = h('div', { class: 'card pad' });
      this.info = h('div', { class: 'card pad' });
      root.ap(h('div', { class: 'chain-wrap' }, this.svgBox, this.info));
      this.render();
    },
    highlight(regions, selId) { this.hl = regions; this.sel = selId || regions[0] || this.sel; showTab('chain'); this.render(); },
    render() {
      const W = 220, H = 470; const ns = 'http://www.w3.org/2000/svg';
      const S = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
      const svg = S('svg', { viewBox: `-74 0 ${W + 148} ${H}`, class: 'chain-svg', role: 'img', 'aria-label': '人體連鎖關係圖' });
      // 人形
      const body = [['ellipse', { cx: 110, cy: 38, rx: 22, ry: 27 }], ['rect', { x: 100, y: 62, width: 20, height: 22, rx: 6 }], ['path', { d: 'M62 96 Q110 82 158 96 L170 120 L162 236 Q110 262 58 236 L50 120 Z' }],
        ['path', { d: 'M58 232 Q110 252 162 232 L168 270 Q110 292 52 270 Z' }], ['path', { d: 'M54 268 L104 282 L96 372 L94 432 L62 436 L64 372 Z' }], ['path', { d: 'M166 268 L116 282 L124 372 L126 432 L158 436 L156 372 Z' }],
        ['path', { d: 'M50 104 L30 112 L18 200 L10 266 L26 270 L36 202 L54 132 Z' }], ['path', { d: 'M170 104 L190 112 L202 200 L210 266 L194 270 L184 202 L166 132 Z' }],
        ['path', { d: 'M60 434 L94 432 L100 450 L54 452 Z' }], ['path', { d: 'M160 434 L126 432 L120 450 L166 452 Z' }]];
      body.forEach(([t, a]) => { a.class = 'body'; svg.appendChild(S(t, a)); });
      const sel = this.sel; const outs = new Set(), ins = new Set();
      window.CHAIN_EDGES.forEach((e) => { if (e.a === sel) outs.add(e.b); if (e.b === sel) ins.add(e.a); });
      window.CHAIN_EDGES.forEach((e) => {
        const a = NODE[e.a], b = NODE[e.b]; const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.18, my = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
        const cls = e.a === sel ? 'edge out' : e.b === sel ? 'edge in' : 'edge';
        svg.appendChild(S('path', { d: `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`, class: cls }));
      });
      window.CHAIN_NODES.forEach((n) => {
        const g = S('g', { class: 'node' + (n.id === sel ? ' sel' : outs.has(n.id) ? ' out' : ins.has(n.id) ? ' in' : ''), tabindex: 0, role: 'button', 'aria-label': n.name });
        g.appendChild(S('circle', { cx: n.x, cy: n.y, r: (this.hl || []).includes(n.id) ? 9 : 7 }));
        const right = n.lab ? n.lab === 'r' : n.x >= 110; const tx = S('text', { x: n.x + (right ? 11 : -11), y: n.y + (n.dy || 3.5), 'text-anchor': right ? 'start' : 'end' }); tx.textContent = n.name;
        g.appendChild(tx);
        const go = () => { this.sel = n.id; this.render(); };
        g.addEventListener('click', go); g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
        svg.appendChild(g);
      });
      clear(this.svgBox).ap(svg, h('div', { class: 'legend', style: { marginTop: '8px', justifyContent: 'center' } }, h('span', null, h('i'), '會影響'), h('span', null, h('i', { class: 'in' }), '常見源頭')));
      // 資訊
      const n = NODE[sel]; const I = clear(this.info);
      I.ap(h('div', { class: 'eyebrow' }, '選取部位'), h('h3', { style: { fontSize: '22px', margin: '2px 0 10px' } }, n.name));
      const out = window.CHAIN_EDGES.filter((e) => e.a === sel), inn = window.CHAIN_EDGES.filter((e) => e.b === sel);
      I.ap(h('div', { class: 'res-h' }, h('span', { class: 'dot t' }), h('h3', null, '這裡出問題，會影響 →')));
      I.ap(out.length ? h('div', null, out.map((e) => h('div', { class: 'edge-item' }, h('button', { class: 'link to', onclick: () => { this.sel = e.b; this.render(); } }, NODE[e.b].name), h('div', { class: 'small' }, e.how), h('span', { class: 'badge' }, e.src)))) : h('p', { class: 'small muted' }, '沒有記錄的往下傳遞。'));
      I.ap(h('hr', { class: 'thin' }), h('div', { class: 'res-h' }, h('span', { class: 'dot w' }), h('h3', null, '← 常見的源頭')));
      I.ap(inn.length ? h('div', null, inn.map((e) => h('div', { class: 'edge-item' }, h('button', { class: 'link to', onclick: () => { this.sel = e.a; this.render(); } }, NODE[e.a].name), h('div', { class: 'small' }, e.how), h('span', { class: 'badge' }, e.src)))) : h('p', { class: 'small muted' }, '沒有記錄的源頭。'));
      const pats = window.PATTERNS.filter((p) => (p.region || []).includes(sel));
      if (pats.length) I.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, '相關評估模式'), h('div', { class: 'chips', style: { marginTop: '6px' } }, pats.map((p) => h('button', { class: 'chip', onclick: () => { Assess.sel = Object.fromEntries(Object.keys(p.t).slice(0, 2).map((k) => [k, FIND[k] && FIND[k].side ? 'R' : 'B'])); Assess.example = false; Assess.persist(); Assess.renderLeft(); Assess.renderRight(); showTab('assess'); } }, p.name))));
      const myn = Notes.list.filter((x) => (x.regions || []).includes(sel));
      if (myn.length) I.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, '新增條目'), myn.map((x) => h('div', { class: 'edge-item small' }, h('button', { class: 'link', onclick: () => KB.openNote(x.id) }, x.title))));
    },
  };

  // =====================================================================
  //  3. 模擬
  // =====================================================================
  const SAC_STATES = [['none', '正常'], ['fwd', '雙側向前點頭卡住（Nutation 彈不回來）'], ['back', '雙側向後反點頭（Counternutation）'], ['RoR', 'Right on Right（沿右斜軸右轉；自然步態方向卡住）'], ['LoL', 'Left on Left（沿左斜軸左轉；自然步態方向卡住）'],
    ['RoL', 'Right on Left（沿左斜軸右轉；向後扭轉，翹腳、半躺）'], ['LoR', 'Left on Right（沿右斜軸左轉；向後扭轉，翹腳、半躺）'], ['R_fwd', '右邊單邊向前點頭'], ['R_back', '右邊單邊向後反點頭'], ['L_fwd', '左邊單邊向前點頭'], ['L_back', '左邊單邊向後反點頭']];
  const SIM_MUSCLES = ['ql', 'iliopsoas', 'rectus_fem', 'hamstrings', 'glute_max', 'piriformis', 'deep_rot', 'glute_med', 'tfl_itb', 'adductors', 'erector', 'rectus_abd', 'pec_minor', 'pec_major', 'trap_u', 'levator', 'scm', 'subocc', 'rhomboid', 'lat', 'tib_post', 'gastroc'];
  const SIM0 = () => ({ aL: 0, aR: 0, xL: 0, xR: 0, uL: 0, uR: 0, sac: 'none', head: 0, tilt: 0, shL: 0, shR: 0, round: 0, kyph: 0, kneeL: 0, kneeR: 0, archL: 0, archR: 0, sprL: false, sprR: false, m: {} });
  const SIM_PRESETS = [
    ['久坐上班族', { aL: 1, aR: 1, head: 2, round: 2, kyph: 1, m: { iliopsoas: { L: 1, R: 1 }, pec_minor: { L: 1, R: 1 } } }],
    ['右腳翹腳習慣', { aR: -1, xL: 1, uR: 0, sac: 'RoL', m: { piriformis: { L: 1, R: 0 } } }],
    ['右腰方肌緊（閃腰後）', { m: { ql: { R: 2, L: 0 } } }],
    ['左踝舊扭傷', { sprL: true, archL: -1, xL: -1 }],
    ['跑者（右膝外側痛）', { xR: 1.5, m: { tfl_itb: { R: 2, L: 0 } } }],
    ['急性閃腰（右側痛）', { aR: 1, xR: -1, m: { ql: { R: 2, L: 0 } } }],
    ['產後骨盆', { aL: 1.5, aR: 0.5, uL: 1, sac: 'L_fwd' }],
  ];
  const Sim = {
    p: Object.assign(SIM0(), store.get('sim', null) || SIM_PRESETS[0][1]), example: !store.get('sim', null),
    build(root) {
      root.ap(h('div', { class: 'sec-h' }, h('h2', null, '症狀模擬'), h('span', { class: 'muted small' }, '調整骨盆角度、薦椎狀態或肌肉張力，看姿勢怎麼變、哪些部位會受影響')),
        h('p', { class: 'lead' }, '骨盆採課堂的三個角度：第一角度 A/P（前傾／後傾，繞 S2；A 長腳、P 短腿）、第二角度 EX/IN（髂後上棘同高、離 S2 遠／近，造成脊椎旋轉）、第三角度（沿耳狀面 EX 外展＝又高又遠，對應 A＋EX；IN 內收＝又低又近，對應 P＋IN；造成側彎）。圖是示意，數值越大偏移越多。'));
      this.ctl = h('div', { class: 'card' }); this.views = h('div', { class: 'card pad' }); this.res = h('div', { class: 'card pad sim-res' });
      root.ap(h('div', { class: 'sim-wrap' }, this.ctl, this.views, this.res));
      this.cmpEl = h('div', { class: 'card pad sim-cmp' }); root.ap(this.cmpEl);
      Compare.listeners.push(() => this.renderCmp());
      this.renderCtl(); this.update(); this.renderCmp();
    },
    renderCmp() {
      if (!this.cmpEl) return; const E = this.cmpEl;
      const quick = () => {
        const out = []; Object.entries(this.p.m || {}).forEach(([id, o]) => { if ((o.L || o.R) && MU[id]) out.push(['muscle', id, MU[id].name]); });
        const p = this.p; if (p.aL || p.aR) out.push(['muscle', 'rectus_fem', '股直肌'], ['muscle', 'iliopsoas', '髂腰肌'], ['muscle', 'hamstrings', '膕繩肌']);
        if (p.xL || p.xR) out.push(['muscle', 'glute_med', '臀中肌'], ['muscle', 'tfl_itb', '闊筋膜張肌／髂脛束'], ['muscle', 'deep_rot', '臀後六肌'], ['muscle', 'piriformis', '梨狀肌']);
        if (p.uL || p.uR) out.push(['muscle', 'adductors', '內收肌群'], ['muscle', 'glute_min', '臀小肌']);
        out.push(['bone', 'bn-hip', '髖骨（無名骨）'], ['bone', 'bn-sacrum', '薦椎'], ['bone', 'bn-lspine', '腰椎'], ['bone', 'bn-femur', '股骨'], ['sinew', 'BL', '足太陽經筋'], ['sinew', 'GB', '足少陽經筋'], ['sinew', 'ST', '足陽明經筋']);
        const seen = new Set(); return out.filter(([k, id]) => { const key = k + id; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 18);
      };
      clear(E).ap(h('div', { class: 'res-h' }, h('h3', null, '多選比較：肌肉、骨頭、經筋、神經'), h('span', { class: 'muted small' }, '　從模擬中相關的項目快速加入，或搜尋；加入後可並排比較、在 3D 分色顯示')));
      const box = h('div'); E.ap(box); Compare.tray(box, { picker: true, table: true, quick });
    },
    set(k, v) { this.p[k] = v; this.example = false; store.set('sim', this.p); this.update(); },
    renderCtl() {
      const C = clear(this.ctl); const p = this.p;
      const sl = (k, lab, min, max, step, ends) => {
        const out = h('output', null, (+p[k]).toFixed(1));
        const r = h('input', { type: 'range', min, max, step, value: p[k], id: 'sim-' + k, 'aria-label': lab, oninput: (e) => { out.textContent = (+e.target.value).toFixed(1); this.set(k, +e.target.value); } });
        return [h('div', { class: 'slider' }, h('span', { class: 'lab' }, lab), r, out), ends ? h('div', { class: 'ends' }, h('span', null, ends[0]), h('span', null, ends[1])) : null];
      };
      C.ap(h('div', { class: 'ctl' }, h('div', { class: 'row' }, h('h3', null, '常見範例'), this.example ? h('span', { class: 'ex-tag' }, '範例') : null),
        h('div', { class: 'presets' }, SIM_PRESETS.map(([n, v]) => h('button', { class: 'chip', onclick: () => { this.p = Object.assign(SIM0(), JSON.parse(JSON.stringify(v))); this.example = false; store.set('sim', this.p); this.renderCtl(); this.update(); } }, n)),
          h('button', { class: 'chip', onclick: () => { this.p = SIM0(); store.set('sim', this.p); this.renderCtl(); this.update(); } }, '全部歸零'))));
      C.ap(h('div', { class: 'ctl' }, h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, '骨盆（無名骨）'), h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => V3.showPelvis(this.effective().E) }, '在 3D 看這個骨盆')),
        h('div', { class: 'eyebrow' }, '第一角度　P 後傾 ← → A 前傾'), sl('aL', '左', -2, 2, 0.5), sl('aR', '右', -2, 2, 0.5),
        h('div', { class: 'eyebrow', style: { marginTop: '6px' } }, '第二角度　IN 內轉 ← → EX 外轉'), sl('xL', '左', -2, 2, 0.5), sl('xR', '右', -2, 2, 0.5),
        h('div', { class: 'eyebrow', style: { marginTop: '6px' } }, '第三角度（耳狀面）　IN 內收 ← → EX 外展'), sl('uL', '左', -2, 2, 0.5), sl('uR', '右', -2, 2, 0.5, ['又低又近', '又高又遠'])));
      const selS = h('select', { class: 'selectbox', id: 'sim-sac', onchange: (e) => this.set('sac', e.target.value) }, SAC_STATES.map(([v, n]) => h('option', { value: v, selected: p.sac === v }, n)));
      C.ap(h('div', { class: 'ctl' }, h('h3', null, '薦椎（卡住的 10 種狀態）'), selS));
      C.ap(h('div', { class: 'ctl' }, h('h3', null, '上半身'), sl('head', '頭前傾', 0, 3, 0.5), sl('tilt', '頭側傾', -2, 2, 0.5, ['右傾', '左傾']), sl('shL', '左肩', -2, 2, 0.5, ['下壓', '上提']), sl('shR', '右肩', -2, 2, 0.5), sl('round', '圓肩', 0, 3, 0.5), sl('kyph', '駝背', 0, 3, 0.5)));
      C.ap(h('div', { class: 'ctl' }, h('h3', null, '下肢'), sl('kneeL', '左膝', -2, 2, 0.5, ['X 型', 'O 型']), sl('kneeR', '右膝', -2, 2, 0.5), sl('archL', '左足弓', -2, 2, 0.5, ['扁平', '高弓']), sl('archR', '右足弓', -2, 2, 0.5),
        h('div', { class: 'row', style: { marginTop: '6px' } }, ['L', 'R'].map((s) => h('label', { class: 'chip' + (p['spr' + s] ? ' on' : '') }, h('input', { type: 'checkbox', checked: p['spr' + s], style: { margin: 0 }, onchange: (e) => { this.set('spr' + s, e.target.checked); e.target.parentNode.classList.toggle('on', e.target.checked); } }), (s === 'L' ? '左' : '右') + '踝舊扭傷')))));
      const det = h('details', { class: 'ctl' }, h('summary', null, h('b', null, '肌肉張力（進階）'), h('span', { class: 'muted small' }, '　+ 緊／縮短　− 弱／被拉長')));
      det.ap(h('div', { class: 'mslider head' }, h('span'), h('span', null, '左'), h('span', null, '右')));
      SIM_MUSCLES.forEach((id) => {
        const v = p.m[id] || { L: 0, R: 0 };
        const mk = (s) => h('input', { type: 'range', min: -2, max: 2, step: 0.5, value: v[s] || 0, 'aria-label': MU[id].name + (s === 'L' ? '左' : '右'), oninput: (e) => { const o = this.p.m[id] || (this.p.m[id] = { L: 0, R: 0 }); o[s] = +e.target.value; this.example = false; store.set('sim', this.p); this.update(); } });
        det.ap(h('div', { class: 'mslider' }, h('span', null, MU[id].name.replace(/（.*/, '')), mk('L'), mk('R')));
      });
      if (Object.values(p.m).some((o) => o.L || o.R)) det.open = true;
      C.ap(det);
    },
    effective() {
      const p = this.p; const E = JSON.parse(JSON.stringify(p)); const flags = new Set();
      const sd = (s) => s; const o = (s) => (s === 'L' ? 'R' : 'L');
      for (const id in p.m) {
        ['L', 'R'].forEach((s) => {
          const v = (p.m[id] || {})[s] || 0; if (!v) return; const pos = Math.max(0, v), neg = Math.min(0, v);
          switch (id) {
            case 'ql': E['u' + s] += 0.45 * pos; break;
            case 'iliopsoas': E['a' + s] += 0.4 * v; break;
            case 'rectus_fem': E['a' + s] += 0.25 * v; break;
            case 'hamstrings': E['a' + s] -= 0.4 * v; break;
            case 'glute_max': E['a' + s] -= 0.15 * v; break;
            case 'erector': E['a' + s] += 0.2 * v; break;
            case 'rectus_abd': E['a' + s] -= 0.2 * v; E.kyph += 0.1 * pos; break;
            case 'piriformis': E['x' + s] -= 0.4 * pos; break;
            case 'deep_rot': E['x' + s] -= 0.45 * pos; break;
            case 'glute_med': E['x' + s] += 0.3 * pos; if (neg) flags.add('trend' + s); break;
            case 'tfl_itb': E['x' + s] += 0.35 * pos; break;
            case 'adductors': E['knee' + s] -= 0.25 * pos; E['u' + s] -= 0.3 * pos; break;
            case 'pec_minor': E.round += 0.25 * pos; E['sh' + s] -= 0.15 * pos; break;
            case 'pec_major': E.round += 0.2 * pos; E.kyph += 0.1 * pos; break;
            case 'trap_u': E['sh' + s] += 0.45 * v; E.tilt += (s === 'L' ? 1 : -1) * 0.15 * pos; break;
            case 'levator': E['sh' + s] += 0.35 * v; E.tilt += (s === 'L' ? 1 : -1) * 0.15 * pos; break;
            case 'scm': E.head += 0.25 * pos; E.tilt += (s === 'L' ? 1 : -1) * 0.1 * pos; break;
            case 'subocc': E.head += 0.2 * pos; break;
            case 'rhomboid': E.round += 0.15 * -neg; break;
            case 'lat': E['sh' + s] -= 0.25 * pos; E['u' + s] += 0.15 * pos; break;
            case 'tib_post': E['arch' + s] += 0.4 * neg; break;
            case 'gastroc': if (pos) flags.add('df' + s); break;
          }
        });
      }
      E.head = Math.max(0, E.head); E.round = Math.max(0, E.round); E.kyph = Math.max(0, E.kyph);
      // 衍生量
      const D = {};
      ['L', 'R'].forEach((s) => {
        D['psisH' + s] = 0.6 * E['a' + s] + 0.6 * E['u' + s];
        D['psisW' + s] = 0.6 * E['x' + s] + 0.5 * E['u' + s];
        D['len' + s] = 0.35 * E['a' + s] - 0.8 * Math.max(0, E['u' + s]); // A 長腳、P 短腿；③EX 斜向上 → 短腿（課堂）
      });
      const sacBase = { none: [0, 0], fwd: [1, 1], back: [-1, -1], RoR: [1, -0.3], LoL: [-0.3, 1], RoL: [-0.3, -1], LoR: [-1, -0.3], R_fwd: [0, 1], R_back: [0, -1], L_fwd: [1, 0], L_back: [-1, 0] }[E.sac];
      // sacBase: [左底, 右底]；+ = 往前（深）、− = 往後（淺）
      D.sacL = sacBase[0]; D.sacR = sacBase[1];
      D.ob = (D.psisHL - D.psisHR) * 0.5 + (D.sacR - D.sacL) * 0.15; // + 左高
      D.legDiff = D.lenL - D.lenR; // + 左長
      D.lsb = -D.ob * 1.0 + ((p.m.ql || {}).R || 0) * 0.25 - ((p.m.ql || {}).L || 0) * 0.25; // + 腰椎凸向左
      D.lrot = (E.xL - E.xR) * 0.5 + (D.sacR - D.sacL) * 0.3; // + 往左轉
      D.lord = (E.aL + E.aR) / 2;
      D.tsb = -0.75 * D.lsb;
      D.shDiff = (E.shL - E.shR) * 0.6 + 0.5 * D.tsb; // + 左高
      D.headTilt = E.tilt - 0.35 * D.tsb;
      D.flags = flags;
      return { E, D };
    },
    muscleStates(E, D) {
      const st = {}; const add = (id, s, v) => { const o = st[id] || (st[id] = { L: 0, R: 0 }); if (s === 'B') { o.L += v; o.R += v; } else o[s] += v; };
      ['L', 'R'].forEach((s) => {
        const o = s === 'L' ? 'R' : 'L';
        const a = E['a' + s], x = E['x' + s], u = E['u' + s], sh = E['sh' + s], k = E['knee' + s], ar = E['arch' + s];
        if (a > 0) { add('iliopsoas', s, a); add('rectus_fem', s, 0.7 * a); add('erector', s, 0.5 * a); add('tfl_itb', s, 0.3 * a); add('glute_max', s, -0.5 * a); add('hamstrings', s, -0.5 * a); }
        if (a < 0) { add('hamstrings', s, -a); add('glute_max', s, -0.6 * a); add('rectus_abd', s, -0.4 * a); add('iliopsoas', s, 0.5 * a); }
        if (x > 0) { add('glute_med', s, x); add('glute_min', s, 0.8 * x); add('tfl_itb', s, 0.8 * x); add('deep_rot', s, -0.4 * x); add('piriformis', s, -0.3 * x); } // 筆記：② EX
        if (x < 0) { add('deep_rot', s, -x); add('piriformis', s, -x); add('glute_med', s, 0.3 * x); add('tfl_itb', s, 0.3 * x); } // 筆記：② IN 臀後六肌
        if (u > 0) { add('glute_med', s, 0.8 * u); add('glute_min', s, 0.7 * u); add('tfl_itb', s, 0.7 * u); add('ql', s, 0.5 * u); add('adductors', s, -0.3 * u); } // ③ EX
        if (u < 0) { add('adductors', s, -u); add('glute_med', s, 0.3 * u); } // ③ IN 內收肌群
        if (sh > 0) { add('trap_u', s, sh); add('levator', s, 0.9 * sh); add('trap_l', s, -0.4 * sh); }
        if (sh < 0) { add('lat', s, -0.5 * sh); add('pec_minor', s, -0.4 * sh); }
        if (k > 0) { add('tfl_itb', s, 0.6 * k); add('vastus_lat', s, 0.4 * k); add('adductors', s, -0.3 * k); }
        if (k < 0) { add('adductors', s, -0.6 * k); add('tfl_itb', s, -0.3 * k); add('vastus_med', s, 0.5 * k); add('glute_med', s, 0.5 * k); }
        if (ar < 0) { add('tib_post', s, ar); add('peroneus', s, -0.6 * ar); add('gastroc', s, -0.5 * ar); add('soleus', s, -0.5 * ar); add('plantar', s, -0.5 * ar); }
        if (ar > 0) { add('plantar', s, 0.6 * ar); add('peroneus', s, -0.3 * ar); }
        if (E['spr' + s]) { add('peroneus', s, 1); add('gastroc', s, 0.6); add('soleus', s, 0.6); add('tib_ant', s, 0.4); }
      });
      if (E.round) { add('pec_minor', 'B', 0.8 * E.round); add('pec_major', 'B', 0.6 * E.round); add('rhomboid', 'B', -0.6 * E.round); add('trap_m', 'B', -0.6 * E.round); }
      if (E.kyph) { add('rectus_abd', 'B', 0.4 * E.kyph); add('pec_major', 'B', 0.4 * E.kyph); add('erector', 'B', -0.3 * E.kyph); add('trap_l', 'B', -0.4 * E.kyph); }
      if (E.head) { add('subocc', 'B', E.head); add('scm', 'B', 0.7 * E.head); add('scalene', 'B', 0.5 * E.head); add('levator', 'B', 0.4 * E.head); add('trap_u', 'B', 0.4 * E.head); add('trap_l', 'B', -0.3 * E.head); }
      const t = D.headTilt; if (Math.abs(t) > 0.2) { const s = t > 0 ? 'L' : 'R'; add('trap_u', s, 0.5 * Math.abs(t)); add('scm', s, 0.4 * Math.abs(t)); add('levator', s, 0.3 * Math.abs(t)); }
      if (E.sac !== 'none') { add('piriformis', 'B', 0.6); const s = /^R|RoR|RoL/.test(E.sac) && !/^L/.test(E.sac) ? 'R' : /^L/.test(E.sac) ? 'L' : 'B'; add('multifidus', s, 0.8); add('ql', s === 'B' ? 'B' : s, 0.3); }
      if (Math.abs(D.lsb) > 0.3) { const conc = D.lsb > 0 ? 'R' : 'L'; add('ql', conc, 0.5 * Math.abs(D.lsb)); add('erector', conc, 0.3 * Math.abs(D.lsb)); }
      for (const id in this.p.m) ['L', 'R'].forEach((s) => { const v = this.p.m[id][s]; if (v) add(id, s, v); });
      for (const id in st) { st[id].L = Math.max(-2, Math.min(2, st[id].L)); st[id].R = Math.max(-2, Math.min(2, st[id].R)); }
      return st;
    },
    regions(E, D) {
      const R = []; const push = (id, sev, txt) => { if (sev >= 0.25) R.push({ id, sev: Math.min(3, sev), txt }); };
      const aD = Math.abs(E.aL - E.aR), xD = Math.abs(E.xL - E.xR), uD = Math.abs(E.uL - E.uR);
      const pel = []; if (Math.abs(D.lord) >= 0.5) pel.push(D.lord > 0 ? '雙側前傾（A）' : '雙側後傾（P）'); if (aD >= 0.5) pel.push('一側前傾一側後傾（第一角度不對稱，易痛）'); if (xD >= 0.5) pel.push('EX/IN 不對稱（第二角度）'); ['L', 'R'].forEach((s) => { const u = E['u' + s]; if (Math.abs(u) >= 0.5) pel.push((s === 'L' ? '左' : '右') + (u > 0 ? '③ EX 外展（髂後上棘又高又遠＝A＋EX）' : '③ IN 內收（又低又近＝P＋IN）')); });
      push('pelvis', Math.max(aD, xD, uD) * 1.1 + Math.abs(D.lord) * 0.5, pel.join('；') || '輕微偏移');
      if (E.sac !== 'none' || aD >= 1) push('sacrum', E.sac !== 'none' ? 2 : aD * 0.8, E.sac !== 'none' ? SAC_STATES.find((x) => x[0] === E.sac)[1] + '：腰椎的底座歪了，L5 跟著轉。' : '兩側無名骨前後不一致，薦髂關節容易卡住、薦椎扭轉。');
      const ls = []; if (Math.abs(D.lsb) > 0.3) ls.push('側彎，凸向' + (D.lsb > 0 ? '左' : '右') + '（來自骨盆高低／第三角度、腰方肌）'); if (Math.abs(D.lrot) > 0.3) ls.push('旋轉（第二角度 EX/IN 或薦椎扭轉帶動）'); if (Math.abs(D.lord) > 0.4) ls.push(D.lord > 0 ? '前凸增加，L4–L5 小面關節受壓' : '曲度變平，椎間盤後側壓力增加');
      push('lspine', Math.abs(D.lsb) * 1.2 + Math.abs(D.lrot) * 1.2 + Math.abs(D.lord) * 0.6, ls.join('；'));
      const ts = []; if (Math.abs(D.tsb) > 0.3) ts.push('反向代償側彎，轉折點在胸腰交界'); if (E.kyph > 0.3) ts.push('後凸增加'); push('tspine', Math.abs(D.tsb) + E.kyph * 0.7, ts.join('；'));
      const cs = []; if (E.head > 0.3) cs.push('頭前傾 → 上頸過伸、枕下肌群縮短（後頭痛、頭暈）'); if (Math.abs(D.headTilt) > 0.3) cs.push('頭側傾（代償眼睛水平）'); push('cspine', E.head * 0.9 + Math.abs(D.headTilt) * 0.7, cs.join('；'));
      const sc = []; if (Math.abs(D.shDiff) > 0.3) sc.push((D.shDiff > 0 ? '左' : '右') + '肩較高'); if (E.round > 0.3) sc.push('圓肩：肩胛前傾外展，肩峰下空間變小（肩夾擠）'); push('scap', Math.abs(D.shDiff) + E.round * 0.8, sc.join('；'));
      if (E.round > 1 || E.head > 1.5) push('shoulder', E.round * 0.6 + E.head * 0.3, '肩夾擠、旋轉肌袖受力增加；胸小肌下方神經血管受壓可能手麻。');
      const hip = []; ['L', 'R'].forEach((s) => { if (E['x' + s] >= 0.5) hip.push((s === 'L' ? '左' : '右') + '② EX：大轉子較厚、俯臥屈膝 90° 較外轉、足跟偏外（筆記；臀中、臀小、闊筋膜張肌）'); if (E['x' + s] <= -0.5) hip.push((s === 'L' ? '左' : '右') + '② IN：大轉子較薄尖、俯臥屈膝 90° 較內轉（筆記；臀後六肌緊，梨狀肌下方坐骨神經可能受壓）'); });
      push('hip', Math.max(Math.abs(E.xL), Math.abs(E.xR)) * 1.1, hip.join('；'));
      const kn = []; if (Math.abs(D.legDiff) > 0.3) kn.push('功能性長短腳：' + (D.legDiff > 0 ? '右' : '左') + '腳較短，兩膝受力不均'); ['L', 'R'].forEach((s) => { const k = E['knee' + s]; if (Math.abs(k) >= 0.5) kn.push((s === 'L' ? '左' : '右') + (k > 0 ? '膝內翻（O 型）：外側髂脛束、內側半月板受壓' : '膝外翻（X 型）：內側鵝足、髕骨外移')); if (Math.abs(E['x' + s]) >= 1) kn.push((s === 'L' ? '左' : '右') + '股骨旋轉改變髂脛束經過膝外側的角度（跑者膝）'); if (E['spr' + s]) kn.push((s === 'L' ? '左' : '右') + '踝角度不足 → 膝用旋轉代償（膝是受害者）'); });
      push('knee', Math.abs(D.legDiff) + Math.max(Math.abs(E.kneeL), Math.abs(E.kneeR)) * 0.8 + (E.sprL || E.sprR ? 1 : 0) + (Math.max(Math.abs(E.xL), Math.abs(E.xR)) >= 1 ? 0.8 : 0), kn.join('；'));
      const an = []; ['L', 'R'].forEach((s) => { if (E['arch' + s] <= -0.5) an.push((s === 'L' ? '左' : '右') + '足弓塌，避震變差'); if (E['arch' + s] >= 0.5) an.push((s === 'L' ? '左' : '右') + '高弓足，外側承重'); if (E['spr' + s]) an.push((s === 'L' ? '左' : '右') + '踝扭傷後活動度下降、腓骨肌沾黏'); });
      if (Math.abs(D.legDiff) > 0.6) an.push('短腳側踝與足承重改變');
      push('ankle', Math.max(Math.abs(E.archL), Math.abs(E.archR)) * 0.8 + (E.sprL || E.sprR ? 1.5 : 0) + (Math.abs(D.legDiff) > 0.6 ? 0.5 : 0), an.join('；'));
      { const um = Math.max(Math.abs(E.uL), Math.abs(E.uR)); if (uD >= 0.5 || um >= 1) push('pubis', Math.max(uD, um * 0.6), '第三角度使恥骨聯合高低，常見鼠蹊痛' + (Math.min(E.uL, E.uR) <= -0.5 ? '；③ IN 內收肌群（內收長短肌、股薄肌、恥骨肌）緊。' : '。')); }
      if (E.kyph > 1 || E.head > 1.5) push('diaphragm', E.kyph * 0.5 + E.head * 0.3, '胸廓活動受限、呼吸變淺，也會影響薦椎的呼吸波。');
      ['L', 'R'].forEach((s) => { if (D.flags.has('trend' + s)) push('hip', 1.2, (s === 'L' ? '左' : '右') + '臀中肌無力：單腳站時對側骨盆下掉。'); });
      return R.sort((a, b) => b.sev - a.sev);
    },
    update() {
      const { E, D } = this.effective(); this.last = { E, D };
      this.drawViews(E, D);
      const st = this.muscleStates(E, D); this.lastStates = st;
      const regs = this.regions(E, D);
      const R = clear(this.res);
      R.ap(h('div', { class: 'res-h' }, h('h3', null, '受影響部位')));
      R.ap(regs.length ? h('div', null, regs.map((r) => h('div', { class: 'region-row' }, h('div', null, h('button', { class: 'link', style: { fontWeight: 700 }, onclick: () => Chain.highlight([r.id], r.id) }, NODE[r.id].name), h('div', { class: 'sev' }, [1, 2, 3].map((i) => h('i', { class: r.sev >= i - 0.5 ? 'on' : '' })))), h('div', null, r.txt)))) : h('p', { class: 'small muted' }, '目前接近中立姿勢。'));
      const list = Object.entries(st).map(([id, o]) => ({ id, L: o.L, R: o.R, mx: Math.max(Math.abs(o.L), Math.abs(o.R)) })).filter((o) => o.mx >= 0.3 && MU[o.id]);
      const tight = list.filter((o) => Math.max(o.L, o.R) >= 0.3).sort((a, b) => Math.max(b.L, b.R) - Math.max(a.L, a.R)).slice(0, 8);
      const weak = list.filter((o) => Math.min(o.L, o.R) <= -0.3).sort((a, b) => Math.min(a.L, a.R) - Math.min(b.L, b.R)).slice(0, 6);
      const bar = (o, kind) => { const v = kind === 't' ? Math.max(o.L, o.R) : -Math.min(o.L, o.R); const side = kind === 't' ? (Math.abs(o.L - o.R) < 0.3 ? 'B' : o.L > o.R ? 'L' : 'R') : (Math.abs(o.L - o.R) < 0.3 ? 'B' : o.L < o.R ? 'L' : 'R');
        return h('div', { class: 'bar' }, h('span', null, h('button', { class: 'link', style: { color: 'var(--ink)', textDecoration: 'none' }, onclick: () => V3.focusMuscle(o.id) }, MU[o.id].name), ' ', sideBadge(side)), h('span', { class: 'mono small muted' }, v.toFixed(1)), h('span', { class: 'track' }, h('i', { style: { width: Math.min(100, v / 2 * 100) + '%', background: kind === 't' ? 'var(--tight)' : 'var(--weak)' } }))); };
      R.ap(h('hr', { class: 'thin' }), h('div', { class: 'res-h' }, h('span', { class: 'dot t' }), h('h3', null, '推論偏緊（先放鬆）')), h('div', null, tight.length ? tight.map((o) => bar(o, 't')) : h('p', { class: 'small muted' }, '—')));
      R.ap(h('div', { class: 'res-h', style: { marginTop: '10px' } }, h('span', { class: 'dot w' }), h('h3', null, '推論被拉長／偏弱')), h('div', null, weak.length ? weak.map((o) => bar(o, 'w')) : h('p', { class: 'small muted' }, '—')));
      R.ap(h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn pri', onclick: () => { const m = {}; for (const id in st) m[id] = { L: st[id].L / 2, R: st[id].R / 2 }; V3.showTension(m); } }, '在 3D 看這組張力')));
      R.ap(h('p', { class: 'small muted', style: { marginTop: '10px' } }, '處理順序（課堂 0817）：三個角度不按順序，先做「差最多」的那個角度；角度裡面先做最緊的那條肌肉；做完重新量，其他角度常會跟著改變。'));
    },
    drawViews(E, D) {
      const V = clear(this.views);
      V.ap(h('div', { class: 'views' }, h('figure', null, this.backSVG(E, D), h('figcaption', null, '後視（站姿）')), h('figure', null, this.sideSVG(E, D), h('figcaption', null, '側視（面向右）'))));
      const notes = [];
      if (Math.abs(D.legDiff) > 0.3) notes.push((D.legDiff > 0 ? '右' : '左') + '腳功能性較短');
      if (Math.abs(D.ob) > 0.25) notes.push((D.ob > 0 ? '左' : '右') + '側髂嵴較高');
      if (E.sac !== 'none') notes.push('薦椎：' + SAC_STATES.find((x) => x[0] === E.sac)[1].split('（')[0]);
      V.ap(h('div', { class: 'chips', style: { marginTop: '8px', justifyContent: 'center' } }, notes.map((n) => h('span', { class: 'badge t' }, n))));
    },
    backSVG(E, D) {
      const ns = 'http://www.w3.org/2000/svg'; const S = (t, a, txt) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); if (txt) e.textContent = txt; return e; };
      const W = 240, H = 520; const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pose', role: 'img', 'aria-label': '後視姿勢圖' });
      const cx = 120; const g = (p) => svg.appendChild(p);
      // 後視：受試者的左側在畫面左側
      const L = -1, R = 1; // 畫面方向：左側 = -x
      const hipY = 300; const crestH = { L: -D.psisHL * 7, R: -D.psisHR * 7 };
      const psis = { L: [cx - 16 - D.psisWL * 4, 312 + crestH.L], R: [cx + 16 + D.psisWR * 4, 312 + crestH.R] };
      // 鉛垂線
      g(S('line', { x1: cx, y1: 10, x2: cx, y2: 510, class: 'plumb' }));
      // 骨盆（髂骨翼）
      ['L', 'R'].forEach((s) => {
        const sg = s === 'L' ? -1 : 1; const dy = crestH[s]; const rot = -sg * (E['x' + s]) * 3;
        const pts = [[cx + sg * 14, 330 + dy], [cx + sg * 20, 296 + dy], [cx + sg * 44, 280 + dy], [cx + sg * 68, 288 + dy], [cx + sg * 66, 312 + dy], [cx + sg * 46, 336 + dy], [cx + sg * 30, 346 + dy]];
        const path = 'M' + pts.map((p) => p.join(' ')).join(' L') + ' Z';
        const e = S('path', { d: path, class: 'bone', transform: `rotate(${rot} ${cx + sg * 40} ${310 + dy})` }); g(e);
        g(S('circle', { cx: psis[s][0], cy: psis[s][1], r: 4, class: 'mk' }));
      });
      g(S('line', { x1: psis.L[0] - 4, y1: psis.L[1], x2: psis.R[0] + 4, y2: psis.R[1], class: 'ref' }));
      g(S('line', { x1: cx - 70, y1: 284 + crestH.L, x2: cx + 70, y2: 284 + crestH.R, class: 'ref' }));
      // 薦椎
      const sTop = 312 + (crestH.L + crestH.R) / 2; const tilt = (crestH.R - crestH.L) * 0.6;
      const sac = S('path', { d: `M${cx - 17} ${sTop - 6} L${cx + 17} ${sTop - 6} L${cx} ${sTop + 40} Z`, class: 'bone', transform: `rotate(${-tilt * 0.5} ${cx} ${sTop})` }); g(sac);
      const baseMark = (x, y, v) => { if (!v) return; g(S('circle', { cx: x, cy: y, r: v > 0 ? 3.5 : 6, class: v > 0 ? 'hot' : 'cool', opacity: 0.9 })); };
      baseMark(cx - 11, sTop - 1, D.sacL); baseMark(cx + 11, sTop - 1, D.sacR);
      if (/o[RL]$/.test(E.sac)) { const right = E.sac.endsWith('R'); g(S('line', { x1: right ? cx + 15 : cx - 15, y1: sTop - 6, x2: right ? cx - 7 : cx + 7, y2: sTop + 34, class: 'warn', 'stroke-dasharray': '4 3' })); }
      // 脊椎
      const lsbX = -D.lsb * 9 * (1); // 凸向左（受試者左＝畫面左）
      const tsbX = -D.tsb * 9;
      const rotTxt = D.lrot;
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const y = sTop - 8 - i * 9.8; const t = i / 24;
        const lumb = Math.sin(Math.PI * Math.min(1, t / 0.32)) * (t < 0.32 ? 1 : 0) * lsbX;
        const thor = t > 0.28 && t < 0.88 ? Math.sin(Math.PI * (t - 0.28) / 0.6) * tsbX : 0;
        const cerv = t > 0.82 ? Math.sin(Math.PI * (t - 0.82) / 0.18) * (D.headTilt * 3) : 0;
        pts.push([cx + lumb + thor + cerv - tilt * 0.3 * (1 - t), y]);
      }
      g(S('path', { d: 'M' + pts.map((p) => p.join(' ')).join(' L'), class: 'spine' }));
      pts.forEach((p, i) => { if (i % 1 === 0 && i < 24) { const r = S('rect', { x: p[0] - (i < 5 ? 5 : 4), y: p[1] - 3, width: i < 5 ? 10 : 8, height: 6, rx: 1.5, class: 'bone' }); if (i < 5 && Math.abs(rotTxt) > 0.3) r.setAttribute('transform', `skewX(${rotTxt * 10} )`); g(r); } });
      if (Math.abs(rotTxt) > 0.3) g(S('text', { x: cx + 26, y: sTop - 30 }, '腰椎旋轉 ' + (rotTxt > 0 ? '↺' : '↻')));
      // 肩胛、肩
      const c7 = pts[24]; const shY = { L: 128 - (D.shDiff > 0 ? D.shDiff : 0) * 8 - E.shL * 2, R: 128 - (D.shDiff < 0 ? -D.shDiff : 0) * 8 - E.shR * 2 };
      ['L', 'R'].forEach((s) => {
        const sg = s === 'L' ? -1 : 1; const y = shY[s]; const ab = E.round * 5;
        g(S('path', { d: `M${cx + sg * (24 + ab)} ${y + 8} L${cx + sg * (52 + ab)} ${y + 2} L${cx + sg * (30 + ab)} ${y + 64} Z`, class: 'bone' }));
        g(S('line', { x1: c7[0], y1: c7[1] + 6, x2: cx + sg * (64 + ab * 0.6), y2: y, class: 'ln' }));
        g(S('circle', { cx: cx + sg * (66 + ab * 0.6), cy: y + 4, r: 9, class: 'bone' }));
        g(S('line', { x1: cx + sg * (70 + ab * 0.6), y1: y + 12, x2: cx + sg * 78, y2: 270, class: 'ln' }));
      });
      g(S('line', { x1: cx - 76, y1: shY.L + 4, x2: cx + 76, y2: shY.R + 4, class: 'ref' }));
      // 頭
      const hx = c7[0] + D.headTilt * 4; g(S('ellipse', { cx: hx, cy: 50, rx: 24, ry: 30, class: 'bone', transform: `rotate(${-D.headTilt * 6} ${c7[0]} 100)` }));
      g(S('line', { x1: c7[0], y1: c7[1], x2: hx, y2: 78, class: 'spine' }));
      // 下肢
      ['L', 'R'].forEach((s) => {
        const sg = s === 'L' ? -1 : 1; const hy = 322 + crestH[s] * 0.8; const hx2 = cx + sg * 40;
        const knee = [cx + sg * (36 - E['knee' + s] * 6), 412 + crestH[s] * 0.6]; const lenAdj = -D['len' + s] * 6;
        const heel = [cx + sg * 34, 498 + lenAdj * 0 + crestH[s] * 0.5];
        g(S('line', { x1: hx2, y1: hy, x2: knee[0], y2: knee[1], class: 'ln', 'stroke-width': 4 }));
        g(S('line', { x1: knee[0], y1: knee[1], x2: heel[0], y2: heel[1] - 6, class: 'ln', 'stroke-width': 3.5 }));
        g(S('circle', { cx: knee[0], cy: knee[1], r: 6, class: 'bone' }));
        const arch = E['arch' + s]; const tiltA = -sg * arch * 6;
        g(S('ellipse', { cx: heel[0], cy: heel[1], rx: 9, ry: 7, class: 'bone', transform: `rotate(${tiltA} ${heel[0]} ${heel[1]})` }));
        if (E['spr' + s]) g(S('circle', { cx: heel[0], cy: heel[1] - 14, r: 9, class: 'warn' }));
        if (Math.abs(E['x' + s]) >= 0.5) g(S('text', { x: heel[0] + sg * 14 - (sg < 0 ? 22 : 0), y: heel[1] + 18 }, E['x' + s] > 0 ? '外轉' : '內轉'));
      });
      const hL = 498 + crestH.L * 0.5, hR = 498 + crestH.R * 0.5;
      g(S('line', { x1: cx - 50, y1: hL - 8, x2: cx + 50, y2: hR - 8, class: 'ref' }));
      g(S('text', { x: 6, y: 20 }, '左'));
      const tr = S('text', { x: W - 18, y: 20 }, '右'); g(tr);
      return svg;
    },
    sideSVG(E, D) {
      const ns = 'http://www.w3.org/2000/svg'; const S = (t, a, txt) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); if (txt) e.textContent = txt; return e; };
      const W = 240, H = 520; const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pose', role: 'img', 'aria-label': '側視姿勢圖' }); const g = (p) => svg.appendChild(p);
      const px = 118; // 鉛垂線
      g(S('line', { x1: px, y1: 8, x2: px, y2: 512, class: 'plumb' }));
      const lord = D.lord, ky = E.kyph, hf = E.head;
      const tiltDeg = 10 + lord * 7; // 骨盆前傾角
      // 骨盆
      const pc = [px - 2, 300];
      const pel = S('path', { d: `M${pc[0] - 30} ${pc[1] - 14} Q${pc[0]} ${pc[1] - 30} ${pc[0] + 30} ${pc[1] - 6} L${pc[0] + 22} ${pc[1] + 22} Q${pc[0]} ${pc[1] + 30} ${pc[0] - 22} ${pc[1] + 18} Z`, class: 'bone', transform: `rotate(${tiltDeg - 10} ${pc[0]} ${pc[1]})` }); g(pel);
      const rad = (tiltDeg - 10) * Math.PI / 180; const rot = (x, y) => [pc[0] + (x - pc[0]) * Math.cos(rad) - (y - pc[1]) * Math.sin(rad), pc[1] + (x - pc[0]) * Math.sin(rad) + (y - pc[1]) * Math.cos(rad)];
      const asis = rot(pc[0] + 30, pc[1] - 6), psis = rot(pc[0] - 28, pc[1] - 16);
      g(S('circle', { cx: asis[0], cy: asis[1], r: 3.5, class: 'mk' })); g(S('circle', { cx: psis[0], cy: psis[1], r: 3.5, class: 'mk' }));
      g(S('line', { x1: psis[0], y1: psis[1], x2: asis[0], y2: asis[1], class: 'ref' }));
      g(S('text', { x: asis[0] + 6, y: asis[1] + 3 }, 'ASIS')); g(S('text', { x: psis[0] - 30, y: psis[1] - 4 }, 'PSIS'));
      // 脊椎曲線：S1 → C1
      const s1 = rot(pc[0] - 20, pc[1] - 24);
      const L3 = [s1[0] + 10 + lord * 6, 236]; const T12 = [s1[0] - 2, 196]; const T7 = [s1[0] - 14 - ky * 6, 150]; const C7 = [s1[0] - 2 + ky * 3 + hf * 4, 104]; const C1 = [C7[0] + 6 + hf * 9, 74];
      g(S('path', { d: `M${s1[0]} ${s1[1]} Q${L3[0] + 6} ${L3[1] + 18} ${L3[0]} ${L3[1]} T${T12[0]} ${T12[1]} Q${T7[0] - 4} ${T7[1] + 10} ${T7[0]} ${T7[1]} T${C7[0]} ${C7[1]} Q${C7[0] + 8} ${C7[1] - 14} ${C1[0]} ${C1[1]}`, class: 'spine' }));
      // 胸廓
      g(S('ellipse', { cx: T7[0] + 30, cy: 158, rx: 36, ry: 46, class: 'soft', transform: `rotate(${-ky * 4} ${T7[0] + 30} 158)` }));
      // 頭
      const head = [C1[0] + 14, 50]; g(S('ellipse', { cx: head[0], cy: head[1], rx: 30, ry: 33, class: 'bone' }));
      const ear = [head[0] - 4, 58]; g(S('circle', { cx: ear[0], cy: ear[1], r: 4, class: hf > 0.4 ? 'hot' : 'mk' }));
      // 肩峰
      const acr = [C7[0] + 8 + E.round * 7, 116]; g(S('circle', { cx: acr[0], cy: acr[1], r: 7, class: 'bone' })); g(S('circle', { cx: acr[0], cy: acr[1], r: 3, class: E.round > 0.4 ? 'hot' : 'mk' }));
      g(S('line', { x1: acr[0], y1: acr[1] + 6, x2: acr[0] + 4 + E.round * 2, y2: 268, class: 'ln', 'stroke-width': 3 }));
      // 大轉子、膝、踝
      const gt = [px + 2, 318]; g(S('circle', { cx: gt[0], cy: gt[1], r: 6, class: 'bone' })); g(S('circle', { cx: gt[0], cy: gt[1], r: 2.5, class: 'mk' }));
      const knee = [px + 4, 410]; const ank = [px - 4, 494];
      g(S('line', { x1: gt[0], y1: gt[1], x2: knee[0], y2: knee[1], class: 'ln', 'stroke-width': 4 })); g(S('line', { x1: knee[0], y1: knee[1], x2: ank[0], y2: ank[1], class: 'ln', 'stroke-width': 3.5 }));
      g(S('circle', { cx: knee[0], cy: knee[1], r: 6, class: 'bone' }));
      g(S('path', { d: `M${ank[0] - 16} ${ank[1] + 10} L${ank[0] + 44} ${ank[1] + 12} L${ank[0] + 40} ${ank[1] + 2} L${ank[0] - 4} ${ank[1] - 8} Z`, class: 'bone' }));
      // 偏離鉛垂線標記
      const dev = (p, label) => { const d = p[0] - px; if (Math.abs(d) > 5) { g(S('line', { x1: px, y1: p[1], x2: p[0], y2: p[1], class: 'warn' })); g(S('text', { x: Math.max(p[0], px) + 8, y: p[1] - 6 }, label + (d > 0 ? ' 前移' : ' 後移'))); } };
      dev(ear, '耳垂'); dev(acr, '肩峰');
      g(S('text', { x: 6, y: 20 }, '後')); g(S('text', { x: W - 18, y: 20 }, '前'));
      g(S('text', { x: 6, y: H - 8 }, '骨盆傾角 ≈ ' + Math.round(tiltDeg) + '°（中立約 10°）'));
      return svg;
    },
  };

  // =====================================================================
  //  4. 3D 圖譜
  // =====================================================================
  // 點選骨骼時的筆記摘要
  const NERVE = { C1: '頭頂（痠痛麻）、高血壓、地中海禿、睡眠品質不好', C2: '顏面（眼耳口鼻），頸椎造成的較少', C3: '喉嚨', C4: '肩膀（筆記：流鼻血）', C5: '手臂陰面延伸至手掌心', C6: '第 1、2 指，第 3 指一半', C7: '第 2、3、4 指（C8 從 C7 與 T1 之間出來：第 4、5 指與第 3 指一半，高爾夫球肘）',
    T1: '肩峰 → 手肘內側 → 手腕內側', T2: '肩峰後 2 指、肩胛稜線下緣 → 肘尖 → 五指同時麻；甲亢 T2–T4', T3: '腋下 → 肘窩（網球肘）→ 手腫脹；壓迫：躁鬱', T4: '最容易出狀況的節段之一；甲亢 T2–T4', T5: '半身痠麻、遊走性痠痛；壓迫：憂鬱；T5–T7 高血壓、糖尿病', T6: 'T5–T6：顏面、免疫、肝膽脾胃、健忘、內耳平衡', T7: 'T5–T7：高血壓、糖尿病；兩肩胛下角連線約平 T7', T8: '胃 T8–T10', T9: '胃 T8–T10', T10: '胃 T8–T10', T12: '最容易出狀況的節段之一；膈肌角（T12–L1）',
    L1: '大腿上面一段', L2: '大腿中間一段', L3: '髕骨下緣一段', L4: '大腿內側 → 小腿內側 → 前面 2 隻半腳趾；兩髂嵴最高點連線約平 L4', L5: '大腿後側 → 小腿後側 → 中間 3 隻腳趾（另一頁筆記：沿小腿外側到足背）' };
  const BROTHER = { C1: 'L5', C2: 'L4', C3: 'L3', C4: 'L2', C5: 'L1', L5: 'C1', L4: 'C2', L3: 'C3', L2: 'C4', L1: 'C5' };
  const SHU = { T1: 'BL11', T2: 'BL12', T3: 'BL13', T4: 'BL14', T5: 'BL15', T6: 'BL16', T7: 'BL17', T8: 'EX-B3', T9: 'BL18', T10: 'BL19', T11: 'BL20', T12: 'BL21', L1: 'BL22', L2: 'BL23', L3: 'BL24', L4: 'BL25', L5: 'BL26' };
  function boneNote(zh, en) {
    const b = zh.replace(/^[左右]/, ''); const L = [];
    const v = (zh.match(/（([CTL]\d+)）/) || [])[1];
    if (v && !/椎間盤/.test(zh)) {
      if (NERVE[v]) L.push('- **神經（筆記）**：' + NERVE[v]);
      if (BROTHER[v]) L.push('- **兄弟椎**：' + v + ' ↔ ' + BROTHER[v]);
      if (SHU[v] && PT[SHU[v]]) L.push('- **背俞穴**：[[p:' + SHU[v] + ']]（棘突下旁開 1.5 寸）');
      if (v === 'C1' || v === 'C2') L.push('- 上頸以旋轉為主；枕下肌群附著（[[m:subocc]]）。');
      return L.join('\n');
    }
    if (/椎間盤/.test(zh)) return '- 椎間盤（慢性）分肩上型、肩下型，外觀「痛側在上」；急性腰閃傷則「痛側在下」。';
    if (/薦椎/.test(b)) return '- **S1 呼吸軸、S2 重心（質量中心）、S3 骨盆（薦椎）軸**。\n- 父母椎：Co1 與 S1–S5 對應上面各段脊椎（S1≈C1–C5、S2≈C6–T2、S3≈T3–T7、S4≈T8–T12、S5≈L1–L5）。\n- 薦椎是腰椎的底座；可卡在 10 種狀態（見知識庫「薦椎」）。薦椎跟著枕骨走。';
    if (/髖骨/.test(b)) return '- 無名骨＝髂骨＋坐骨＋恥骨；與薦椎在耳狀面形成薦髂關節。\n- 三個角度：① A／P（繞 S2）② EX／IN（離 S2 遠／近）③ 沿耳狀面 EX（又高又遠）／IN（又低又近）。\n- A：髂後上棘較高、坐骨結節較高、長腳；P：較低、短腿。';
    if (/距骨|跟骨|舟狀骨（足）|骰骨|楔狀骨|蹠骨|趾骨/.test(b)) return '- 足的分區（筆記）：**後足＝跟骨；中足＝距骨、舟狀骨、骰骨；前足＝楔形骨、蹠骨**（其他說法（參考）：解剖書把距骨歸後足、楔狀骨歸中足）。\n- 踝＝脛骨、腓骨、距骨。檢查由下往上：前中足 → 足跟 → 距骨 → 脛腓 → 股骨 → 骨盆。' + (/跟骨/.test(b) ? '\n- 足太陽經筋「結於踵」；跟骨腫痛為足太陽經筋病。' : '');
    if (/脛骨/.test(b)) return '- 脛骨下端＝內踝；三角韌帶（扇形韌帶）：脛舟（脾經）、脛跟（腎經）、脛距（前：肝經；後：膀胱經）。\n- 膝伸直最後 30° 時脛骨外轉約 10°（鎖住膝；筆記與 [[m:popliteus]] 同列）。';
    if (/腓骨/.test(b)) return '- 腓骨下端＝外踝；外踝韌帶：前距腓、跟腓、後距腓（距跟）。\n- 骨性對應：鎖骨 → 恥骨 → 腓骨 → 顴骨。';
    if (/股骨/.test(b)) return '- 股骨頸約 125°；股骨與脛骨夾角約 170–175°（< 175° X 型，> 175° O 型；筆記）。\n- 大轉子厚＝第二角度 EX、薄尖＝IN。';
    if (/髕骨/.test(b)) return '- 人體最大的種子骨；髕骨不在滑軌上會造成膝交鎖、膝前痛。';
    if (/肩胛骨/.test(b)) return '- 肩胛胸廓關節是平面關節，唯一沒有關節面。\n- 上提：上斜方、提肩胛（菱形）；下壓：下斜方、闊背、鎖骨下、胸小；前突：前鋸；後縮：中斜方、菱形；上旋：上下斜方、前鋸；下旋：菱形、胸小。\n- 坐姿轉臥姿肩胛位置會變 → 跟骨盆有關。膏肓：右氣不足、左血不足；肩胛內緣右對肝、左對心。';
    if (/鎖骨/.test(b)) return '- 胸鎖關節＝馬鞍關節；肩鎖、喙鎖關節。\n- 骨性對應：鎖骨 → 恥骨 → 腓骨 → 顴骨。';
    if (/肱骨/.test(b)) return '- 內上髁：屈腕、旋前肌群（高爾夫球肘）；外上髁：伸腕、旋後肌群（網球肘）。\n- 穩定肱骨：旋轉肌袖（棘上、棘下、小圓、肩胛下肌）。杵臼關節都是先滾動再滑動。';
    if (/橈骨|尺骨/.test(b)) return '- 骨間膜把腕部往上傳的力平分傳到肱骨；腕部的力約 80% 走橈骨。\n- 手：肱、橈骨（上肢）；腳：脛、腓骨（下肢）。';
    if (/顴骨/.test(b)) return '- 骨性對應：鎖骨 → 恥骨 → 腓骨 → 顴骨。臉跟著結構走。';
    if (/枕骨/.test(b)) return '- 薦椎跟著枕骨走；枕下是最容易出狀況的地方之一。\n- 足少陰經筋、足太陽經筋都結於枕骨。';
    if (/頂骨|額骨|顳骨|蝶骨/.test(b)) return '- 頭骨網狀力學（筆記）：鱗狀縫 → 身體側邊；冠狀縫 → 對側邊；矢狀縫、人字縫 → 背側邊。\n- 頭顱骨跟薦尾對脊柱一樣：薦尾是源頭、脊椎是末梢；髮穴多為身體的問題點（尾骨居多）。';
    if (/肋骨|肋軟骨|胸骨|劍突/.test(b)) return '- 呼吸：後下鋸肌（下段）、後上鋸肌（上段）；鎖骨下、第 2 肋骨一帶以前斜角肌最多（筆記）；前、中斜角肌拉第 1 肋、後斜角肌拉第 2 肋（錄音 0928-2）。\n- 肋骨隨胸椎旋轉時，斜角肌一緊一鬆，可把頸椎拉歪。';
    return '';
  }

  // =====================================================================
  //  多選比較（肌肉／骨頭／經筋／神經／穴位）
  // =====================================================================
  const CMP_COLORS = ['#e8590c', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#f59f00', '#0ca678', '#d6336c', '#5c7cfa'];
  const CMP_KIND = { muscle: '肌肉', bone: '骨頭', sinew: '經筋', nerve: '神經', point: '穴位' };
  const NV = () => window.NERVE_DATA || {};
  const cut = (s, n) => { s = String(s || '').replace(/\[\[[a-z]+:([\w-]+)\]\]/g, (m0, id) => (MU[id] || PT[id] || SIN[id] || {}).name || id).replace(/[#*]/g, '').replace(/\s+/g, ' ').trim(); n = n || 140; return s.length > n ? s.slice(0, n) + '…' : s; };
  const Compare = {
    items: store.get('cmp', []), listeners: [],
    key(kind, id) { return kind + ':' + id; },
    has(kind, id) { return this.items.some((x) => x.kind === kind && x.id === id); },
    label(kind, id) {
      if (kind === 'muscle') return (MU[id] || {}).name || id;
      if (kind === 'bone') return ((DET.bn || {})[id] || {}).name || id;
      if (kind === 'sinew') return (SIN[id] || {}).name || id;
      if (kind === 'nerve') return (NV()[id] || (window.NERVES3D || {})[id] || {}).name || id;
      if (kind === 'point') return PT[id] ? PT[id].name + ' ' + id : id;
      return id;
    },
    color(i) { return CMP_COLORS[i % CMP_COLORS.length]; },
    toggle(kind, id) { if (this.has(kind, id)) this.remove(kind, id); else this.add(kind, id); },
    add(kind, id) { if (!id || this.has(kind, id)) return; if (this.items.length >= 8) { toast('最多比較 8 項'); return; } this.items.push({ kind, id }); this.changed(); toast('已加入比較：' + this.label(kind, id)); },
    remove(kind, id) { this.items = this.items.filter((x) => !(x.kind === kind && x.id === id)); this.changed(); },
    clear() { this.items = []; this.changed(); },
    changed() { store.set('cmp', this.items); this.listeners.forEach((f) => f()); },
    // 3D：骨頭用骨骼詳解 id，換成模型零件
    show3D() {
      showTab('v3d'); V3.ensure();
      const kinds = new Set(this.items.map((x) => x.kind));
      V3.setLayers({ muscle: kinds.has('muscle') || !kinds.size, bone: true, sinew: kinds.has('sinew'), nerve: kinds.has('nerve'), point: kinds.has('point'), meridian: false, skin: kinds.has('point') });
      const go = () => {
        const parts = V3.inst.boneParts ? V3.inst.boneParts() : [];
        const list = this.items.map((x, i) => { const c = { kind: x.kind, id: x.id, color: this.color(i), label: this.label(x.kind, x.id) }; if (x.kind === 'bone') c.ids = parts.filter((p) => window.boneIdOf && window.boneIdOf(p.zh) === x.id).map((p) => p.fid); return c; });
        V3.inst.setCompare(list); V3.cmpOn = true; V3.renderCmpBar();
      };
      V3.whenReady(go); if (V3.inst && V3.inst.isReady && V3.inst.isReady()) go();
    },
    rows(kind) {
      const mx = (id) => (DET.mx || {})[id] || {}; const bx = (id) => (DET.bx || {})[id] || {}; const sx = (id) => (DET.sx || {})[id] || {};
      if (kind === 'muscle') return [['起點', (id) => MU[id].origin], ['止點', (id) => MU[id].insertion], ['作用', (id) => MU[id].action], ['神經', (id) => mx(id).nerve || MU[id].nerve], ['經筋', (id) => (MU[id].sinew || []).map((s) => (SIN[s] || {}).name).filter(Boolean).join('、')],
        ['縮短／過緊', (id) => mx(id).short], ['被拉長／無力', (id) => mx(id).long], ['常見症狀', (id) => (mx(id).symptoms || MU[id].symptoms || []).join('、')], ['骨頭移位的影響', (id) => mx(id).boneEffect], ['代償', (id) => mx(id).compensation], ['觸診表徵', (id) => mx(id).palpSigns || MU[id].palpation], ['放鬆', (id) => MU[id].release]];
      if (kind === 'bone') return [['位置', (id) => bx(id).where], ['骨性標誌', (id) => bx(id).landmarks], ['關節', (id) => bx(id).joints], ['附著肌', (id) => bx(id).attach], ['課堂重點', (id) => bx(id).course], ['常見錯位', (id) => bx(id).dysfunction], ['移位時的影響', (id) => bx(id).displace], ['整復要點', (id) => bx(id).adjust]];
      if (kind === 'sinew') return [['起點', (id) => sx(id).start], ['經過的肌肉', (id) => sx(id).muscleChain || (DET.sn[id] || {}).muscles && DET.sn[id].muscles.map((m) => (MU[m] || {}).name).join('、')], ['結', (id) => ((DET.sn[id] || {}).knots || []).join('、')], ['功用', (id) => sx(id).function], ['病候', (id) => sx(id).sick || SIN[id].sick], ['表徵', (id) => (sx(id).signs || []).join('；')]];
      if (kind === 'nerve') return [['神經根', (id) => (NV()[id] || {}).roots], ['走向', (id) => (NV()[id] || {}).course], ['支配肌肉', (id) => (NV()[id] || {}).motorText || ((NV()[id] || {}).motor || []).map((m) => (MU[m] || {}).name).join('、')], ['感覺區', (id) => (NV()[id] || {}).sensory], ['卡壓點', (id) => ((NV()[id] || {}).entrap || []).map((e) => e.site).join('、')], ['受損表現', (id) => (NV()[id] || {}).lesion]];
      return [['定位', (id) => PT[id].loc], ['主治', (id) => PT[id].ind], ['推拿', (id) => PT[id].tn]];
    },
    table(box) {
      clear(box);
      if (!this.items.length) { box.ap(h('p', { class: 'small muted' }, '還沒有比較項目。在 3D 圖譜點選肌肉、骨頭、經筋、神經或穴位後按「＋ 比較」，或在下面搜尋加入。')); return; }
      const byKind = {}; this.items.forEach((x, i) => (byKind[x.kind] = byKind[x.kind] || []).push(Object.assign({ i }, x)));
      Object.entries(byKind).forEach(([kind, arr]) => {
        const rows = this.rows(kind);
        const tbl = h('table', { class: 'cmp-tbl' }, h('tr', null, h('th', null, CMP_KIND[kind]), arr.map((x) => h('th', null, h('span', { class: 'dot', style: { background: this.color(x.i) } }), ' ', this.label(kind, x.id)))),
          rows.map(([lab, f]) => h('tr', null, h('th', { scope: 'row' }, lab), arr.map((x) => { let v = ''; try { v = f(x.id) || ''; } catch (e) { v = ''; } return h('td', null, cut(v, 160) || '—'); }))));
        box.ap(h('div', { class: 'tblwrap cmp-wrap' }, tbl));
      });
      const ms = this.items.filter((x) => x.kind === 'muscle').map((x) => x.id);
      if (ms.length > 1) {
        const sn = {}; ms.forEach((m) => (MU[m].sinew || []).forEach((s) => (sn[s] = (sn[s] || 0) + 1))); const shared = Object.entries(sn).filter(([, n]) => n > 1).map(([s]) => (SIN[s] || {}).name).filter(Boolean);
        const pts = {}; ms.forEach((m) => (MU[m].points || []).forEach((p) => (pts[p] = (pts[p] || 0) + 1))); const sp = Object.entries(pts).filter(([, n]) => n > 1).map(([p]) => (PT[p] || {}).name).filter(Boolean);
        box.ap(h('p', { class: 'small' }, h('b', null, '共同點：'), shared.length ? '同屬 ' + shared.join('、') + '；' : '沒有共同經筋；', sp.length ? '共同穴位 ' + sp.join('、') + '。' : '沒有共同穴位。'));
      }
    },
    picker(box, opt) {
      const q = h('input', { class: 'fsearch', placeholder: '搜尋要加入比較的肌肉、骨頭、經筋、神經或穴位…', style: { margin: '0 0 6px' } }); const res = h('div', { class: 'chips' });
      const all = () => [].concat(window.MUSCLES.map((m) => ['muscle', m.id, m.name]), Object.entries(DET.bn || {}).map(([id, b]) => ['bone', id, b.name]), window.SINEWS.map((s) => ['sinew', s.id, s.name]), Object.entries(NV()).length ? Object.entries(NV()).map(([id, n]) => ['nerve', id, n.name]) : Object.entries(window.NERVES3D || {}).map(([id, n]) => ['nerve', id, n.name]), window.POINTS.map((p) => ['point', p.id, p.name + ' ' + p.id]));
      const draw = () => { const t = q.value.trim(); clear(res); if (!t) { (opt && opt.quick ? opt.quick() : []).forEach(([k, id, n]) => res.ap(h('button', { class: 'chip sm' + (this.has(k, id) ? ' on' : ''), onclick: () => { this.toggle(k, id); draw(); } }, (this.has(k, id) ? '✓ ' : '＋ ') + n))); return; }
        all().filter(([, id, n]) => n.includes(t) || id.toLowerCase().includes(t.toLowerCase())).slice(0, 24).forEach(([k, id, n]) => res.ap(h('button', { class: 'chip sm' + (this.has(k, id) ? ' on' : ''), onclick: () => { this.toggle(k, id); draw(); } }, h('span', { class: 'muted' }, CMP_KIND[k] + '・'), (this.has(k, id) ? '✓ ' : '＋ ') + n))); };
      q.addEventListener('input', draw); box.ap(q, res); draw();
    },
    tray(box, opt) {
      clear(box);
      box.ap(h('div', { class: 'row' }, h('b', null, '比較'), h('span', { class: 'muted small' }, this.items.length + ' / 8 項'), h('span', { class: 'sp' }),
        this.items.length ? h('button', { class: 'btn sm pri', onclick: () => this.show3D() }, '在 3D 分色顯示') : null,
        this.items.length ? h('button', { class: 'btn sm', onclick: () => { this.clear(); if (V3.inst) V3.inst.clearCompare(); } }, '清除') : null));
      if (this.items.length) box.ap(h('div', { class: 'chips', style: { marginTop: '6px' } }, this.items.map((x, i) => h('span', { class: 'chip sm cmp-chip' }, h('span', { class: 'dot', style: { background: this.color(i) } }), h('span', { class: 'muted' }, CMP_KIND[x.kind] + '・'), this.label(x.kind, x.id), h('button', { class: 'x', 'aria-label': '移除', onclick: () => this.remove(x.kind, x.id) }, '×')))));
      if (opt && opt.picker) { const pk = h('div', { style: { marginTop: '8px' } }); box.ap(pk); this.picker(pk, opt); }
      if (opt && opt.table) { const tb = h('div', { style: { marginTop: '10px' } }); box.ap(tb); this.table(tb); }
    },
  };
  const cmpBtn = (kind, id) => h('button', { class: 'btn sm' + (Compare.has(kind, id) ? ' on' : ''), title: '加入或移出多選比較', onclick: (e) => { Compare.toggle(kind, id); e.currentTarget.classList.toggle('on', Compare.has(kind, id)); e.currentTarget.textContent = Compare.has(kind, id) ? '✓ 已加入比較' : '＋ 比較'; } }, Compare.has(kind, id) ? '✓ 已加入比較' : '＋ 比較');

  const V3 = {
    inst: null, layers: { skin: false, bone: true, muscle: true, meridian: false, sinew: false, point: false, nerve: false }, sel: null, tension: null, q: '', mode: 'muscle',
    build(root) {
      root.ap(h('div', { class: 'sec-h' }, h('h2', null, '3D 骨骼・肌肉・經絡'), h('span', { class: 'muted small' }, '拖曳旋轉、雙指或滾輪縮放；點選肌肉、經絡或穴位看說明')));
      this.stage = h('div', { class: 'v3-stage', id: 'v3-stage' }, h('div', { class: 'v3-hint' }, '骨骼、肌肉為真實比例模型；經絡與穴位依骨性標誌推算，取穴仍以實際觸摸為準'));
      const tools = h('div', { class: 'v3-tools' });
      const lay = [['skin', '皮膚'], ['bone', '骨骼'], ['muscle', '肌肉'], ['meridian', '經脈'], ['sinew', '經筋'], ['point', '穴位'], ['nerve', '神經']];
      lay.forEach(([k, n]) => tools.ap(h('button', { class: 'btn sm' + (this.layers[k] ? ' on' : ''), 'data-layer': k, 'aria-pressed': String(this.layers[k]), onclick: (e) => this.toggleLayer(k, e.currentTarget) }, n)));
      tools.ap(h('span', { class: 'sp' }));
      [['front', '前'], ['back', '後'], ['left', '左'], ['right', '右']].forEach(([v, n]) => tools.ap(h('button', { class: 'btn sm', onclick: () => this.inst && this.inst.view(v) }, n)));
      tools.ap(h('button', { class: 'btn sm', onclick: () => { if (this.inst) { this.inst.reset(); this.inst.clear(); this.inst.setDermatome(null); this.dermSel = []; this.cmpOn = false; this.sel = null; this.renderInfo(); this.renderList(); this.renderCmpBar(); } } }, '重置'));
      this.stage.ap(tools);
      this.tbar = h('div', { class: 'card pad', hidden: true });
      this.side = h('div', { class: 'v3-side' });
      this.listBox = h('div', { class: 'card v3-list' });
      this.info = h('div', { class: 'card pad v3-info' });
      const modeBtns = h('div', { class: 'row' }, [['muscle', '肌肉'], ['meridian', '經脈'], ['sinew', '經筋'], ['point', '穴位'], ['nerve', '神經'], ['derm', '皮節'], ['motion', '動作'], ['cmp', '比較']].map(([k, n]) => h('button', { class: 'chip' + (this.mode === k ? ' on' : ''), 'data-mode': k, onclick: () => this.setMode(k) }, n)));
      const search = h('input', { class: 'fsearch', placeholder: '搜尋：例如 梨狀肌、膽經、風池', style: { margin: 0 }, oninput: (e) => { this.q = e.target.value.trim(); this.renderList(); } });
      this.cmpBar = h('div', { class: 'card pad cmp-bar', hidden: true });
      this.side.ap(this.tbar, this.cmpBar, h('div', { class: 'stack', style: { gap: '8px' } }, modeBtns, search), this.listBox, this.info);
      this.cmpBox = h('div', { class: 'card pad cmp-box', hidden: true });
      root.ap(h('div', { class: 'v3-wrap' }, this.stage, this.side), this.cmpBox);
      Compare.listeners.push(() => { this.renderCmpBar(); if (this.mode === 'cmp') this.renderList(); if (this.cmpOn && this.inst) Compare.show3D(); });
      this.renderList(); this.renderInfo(); this.renderCmpBar();
    },
    ensure() {
      if (this.inst) return;
      if (!window.THREE || !THREE.OrbitControls) { this.stage.ap(h('div', { class: 'empty', style: { margin: '60px 20px' } }, '3D 元件載入失敗，請確認網路後重新整理頁面。')); return; }
      try {
        const cs = getComputedStyle(document.documentElement);
        this.inst = Body3D.create(this.stage, { muscles: window.MUSCLES, meridians: window.MERIDIANS, points: window.POINTS, sinews: window.SINEWS, nerves: window.NERVES3D || {} }, {
          colors: { skin: new THREE.Color(cs.getPropertyValue('--skin3d').trim() || '#d2b8a3').getHex() },
          onPick: (u) => { if (!u) return; this.pick(u.kind, u.id); },
          base: window.ASSET_BASE || '',
        });
        Object.entries(this.layers).forEach(([k, v]) => this.inst.setLayer(k, v));
        if (this.pending) { const f = this.pending; this.pending = null; setTimeout(f, 50); }
      } catch (e) { this.stage.ap(h('div', { class: 'empty', style: { margin: '60px 20px' } }, '這個裝置無法顯示 3D（WebGL 不可用）。仍可使用右側清單查閱肌肉與穴位說明。')); }
    },
    whenReady(f) { if (this.inst) f(); else this.pending = f; },
    setMode(k) {
      this.mode = k; this.side.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === k));
      if (k === 'nerve') { this.setLayers({ nerve: true, bone: true, muscle: false, skin: false }); this.ensure(); }
      if (k === 'derm') { this.ensure(); this.whenReady(() => this.inst.setDermatome(this.dermSel && this.dermSel.length ? this.dermSel : 'all')); this.sel = { kind: 'derm', id: null }; this.renderInfo(); }
      else if (this.inst && this.inst.setDermatome) { this.inst.setDermatome(null); }
      this.renderList(); this.renderCmpBar();
    },
    renderCmpBar() {
      if (!this.cmpBar) return; const show = Compare.items.length > 0 || this.mode === 'cmp';
      this.cmpBar.hidden = !show; this.cmpBox.hidden = !(Compare.items.length > 0 && this.cmpTable);
      if (!show) return;
      Compare.tray(this.cmpBar);
      this.cmpBar.ap(h('div', { class: 'row', style: { marginTop: '6px' } }, h('label', { class: 'small row', style: { gap: '4px' } }, h('input', { type: 'checkbox', checked: !!this.cmpMode, onchange: (e) => { this.cmpMode = e.target.checked; } }), '比較模式：點選即加入'), h('span', { class: 'sp' }),
        Compare.items.length ? h('button', { class: 'btn sm', onclick: () => { this.cmpTable = !this.cmpTable; this.renderCmpBar(); if (this.cmpTable) this.cmpBox.scrollIntoView({ behavior: 'smooth' }); } }, this.cmpTable ? '收起比較表' : '看比較表') : null,
        this.cmpOn ? h('button', { class: 'btn sm', onclick: () => { this.cmpOn = false; if (this.inst) this.inst.clearCompare(); this.renderCmpBar(); } }, '結束 3D 比較') : null));
      if (!this.cmpBox.hidden) { clear(this.cmpBox).ap(h('div', { class: 'res-h' }, h('h3', null, '比較表'), h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => Compare.show3D() }, '在 3D 分色顯示'))); const tb = h('div'); this.cmpBox.ap(tb); Compare.table(tb); }
    },
    toggleLayer(k, btn) { this.layers[k] = !this.layers[k]; if (btn) { btn.classList.toggle('on', this.layers[k]); btn.setAttribute('aria-pressed', String(this.layers[k])); } if (this.inst) this.inst.setLayer(k, this.layers[k]); },
    setLayers(o) { Object.assign(this.layers, o); this.stage.querySelectorAll('[data-layer]').forEach((b) => { const k = b.dataset.layer; b.classList.toggle('on', this.layers[k]); b.setAttribute('aria-pressed', String(this.layers[k])); }); if (this.inst) Object.entries(this.layers).forEach(([k, v]) => this.inst.setLayer(k, v)); },
    pick(kind, id) {
      if (kind === 'derm') { this.mode = 'derm'; const s = this.dermSel || (this.dermSel = []); const i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); if (this.inst) this.inst.setDermatome(s.length ? s.slice() : 'all'); this.sel = { kind: 'derm', id }; this.side.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === 'derm')); this.renderInfo(); this.renderList(); return; }
      if (this.cmpMode && ['muscle', 'bone', 'sinew', 'nerve', 'point'].includes(kind)) { let cid = id; if (kind === 'bone') { const info = this.inst && this.inst.partName(id); cid = info && window.boneIdOf ? window.boneIdOf(info.zh) : null; } if (cid) Compare.toggle(kind, cid); return; }
      if (this.sel && this.sel.kind === 'motion' && this.inst) { if (kind === 'muscle') { this.renderInfoMuscleOnly = true; } else { this.inst.stopMotion(); } }
      this.sel = { kind, id };
      if (kind === 'meridian' || kind === 'point' || kind === 'sinew' || kind === 'muscle' || kind === 'nerve') this.mode = kind;
      this.side.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === this.mode));
      if (this.inst) this.inst.select(kind, [id], { focus: kind !== 'bone', dist: kind === 'point' ? 0.75 : undefined });
      this.renderInfo(); this.renderList();
    },
    focusMuscle(id) { showTab('v3d'); this.setLayers({ muscle: true, skin: true }); this.whenReady(() => this.pick('muscle', id)); if (this.inst) this.pick('muscle', id); },
    focusPoint(id) { showTab('v3d'); this.setLayers({ point: true, meridian: true, muscle: false, bone: false, skin: true }); this.whenReady(() => this.pick('point', id)); if (this.inst) this.pick('point', id); },
    focusMeridian(id) { showTab('v3d'); this.setLayers({ meridian: true, point: true, muscle: false, bone: false, skin: true }); this.whenReady(() => this.pick('meridian', id)); if (this.inst) this.pick('meridian', id); },
    playMotion(id, side) {
      showTab('v3d'); this.mode = 'motion'; this.side.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === 'motion'));
      this.setLayers({ skin: false, meridian: false, point: false, sinew: false, bone: true, muscle: true }); this.ensure();
      this.sel = { kind: 'motion', id }; this.motionPlaying = true;
      const go = () => { this.inst.startMotion(id, { side: side || this.motionSide || 'L' }); this.inst.onMotionTick((t) => { if (this.mSlider) this.mSlider.value = String(Math.round(t * 100)); }); };
      this.whenReady(go); if (this.inst) go();
      this.renderList(); this.renderInfo();
    },
    showPelvis(E) { showTab('v3d'); this.setLayers({ skin: false, meridian: false, point: false, sinew: false, bone: true, muscle: false }); this.ensure(); this.sel = { kind: 'motion', id: '__pelvis' };
      const go = () => this.inst.showPelvisPose(E); this.whenReady(go); if (this.inst) go();
      const I = clear(this.info); I.ap(h('div', { class: 'eyebrow' }, '症狀模擬 → 3D'), h('h3', null, '目前模擬的骨盆姿勢'), h('p', { class: 'small' }, '藍點＝兩側髂後上棘（PSIS）、紅點＝S2。比較兩側 PSIS 的高低（第一角度）、離 S2 的遠近（第二角度）。角度已放大示意。'), h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => this.setLayers({ muscle: !this.layers.muscle }) }, '顯示／隱藏肌肉'), h('button', { class: 'btn sm', onclick: () => { showTab('sim'); } }, '回到症狀模擬'), h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => this.stopMotion() }, '結束'))); },
    stopMotion() { if (this.inst) this.inst.stopMotion(); this.sel = null; this.setLayers({ skin: false, bone: true, muscle: true }); this.renderInfo(); this.renderList(); },
    showMuscles(ids) { showTab('v3d'); this.setLayers({ muscle: true, bone: true, skin: false, meridian: false, point: false, sinew: false }); const go = () => { this.inst.clear(); this.inst.select('muscle', ids, { focus: true, dist: 2.6 }); }; this.whenReady(go); if (this.inst) go(); },
    showMerMuscles(id) { const mn = (window.MER_NOTES || {})[id]; if (!mn) return; showTab('v3d'); this.setLayers({ muscle: true, bone: true, skin: false, meridian: true, point: false });
      const go = () => { this.inst.select('muscle', mn.muscles.filter((m) => MU[m]), { focus: true, dist: 3.0 }); }; this.whenReady(go); if (this.inst) go(); },
    focusNerve(id) { showTab('v3d'); this.setLayers({ nerve: true, bone: true, muscle: false, skin: false, meridian: false, sinew: false, point: false }); this.whenReady(() => this.pick('nerve', id)); if (this.inst) this.pick('nerve', id); },
    showDerm(segs) { showTab('v3d'); this.ensure(); this.dermSel = [].concat(segs || []); this.mode = 'derm'; this.side.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === 'derm')); this.whenReady(() => { this.inst.setDermatome(this.dermSel.length ? this.dermSel.slice() : 'all'); this.inst.view('front'); }); this.sel = { kind: 'derm', id: this.dermSel[0] || null }; this.renderList(); this.renderInfo(); },
    focusSinew(id) { showTab('v3d'); this.setLayers({ sinew: true, muscle: false, meridian: false, skin: true, bone: true }); this.whenReady(() => this.pick('sinew', id)); if (this.inst) this.pick('sinew', id); },
    showTension(map) {
      this.tension = map; showTab('v3d'); this.setLayers({ muscle: true, bone: true, skin: true, meridian: false, point: false, sinew: false });
      const apply = () => { this.inst.clear(); this.inst.setMuscleStates(map); this.inst.view('back'); };
      this.whenReady(apply); if (this.inst) apply();
      const T = this.tbar; T.hidden = false; clear(T).ap(h('div', { class: 'row' }, h('b', null, '顯示張力'), h('span', { class: 'tension-key' }, h('span', null, h('span', { class: 'dot t' }), ' 緊'), h('span', null, h('span', { class: 'dot w' }), ' 被拉長／弱')), h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => { this.tension = null; T.hidden = true; if (this.inst) this.inst.setMuscleStates({}); } }, '關閉')));
      this.mode = 'muscle'; this.renderList();
    },
    renderList() {
      const B = clear(this.listBox); const q = this.q; const m = (s) => !q || s.toLowerCase().includes(q.toLowerCase());
      const item = (kind, id, name, sub, color) => h('button', { class: 'v3-item' + (this.sel && this.sel.kind === kind && this.sel.id === id ? ' on' : ''), onclick: () => { if (kind === 'point') this.setLayers({ point: true }); if (kind === 'meridian') this.setLayers({ meridian: true }); if (kind === 'sinew') this.setLayers({ sinew: true }); if (kind === 'muscle') this.setLayers({ muscle: true }); this.ensure(); this.pick(kind, id); } }, color ? h('span', { class: 'sw', style: { background: color } }) : null, h('span', null, name), h('span', { class: 'en' }, sub));
      if (this.mode === 'muscle') {
        const groups = {}; window.MUSCLES.forEach((x) => { if (!m(x.name + x.en + x.region)) return; (groups[x.region] = groups[x.region] || []).push(x); });
        Object.entries(groups).forEach(([g, arr]) => { B.ap(h('div', { class: 'grp' }, g)); arr.forEach((x) => { const t = this.tension && this.tension[x.id]; const v = t ? Math.max(Math.abs(t.L || 0), Math.abs(t.R || 0)) * Math.sign((t.L || 0) + (t.R || 0)) : 0; B.ap(item('muscle', x.id, x.name, x.layer, v > 0.05 ? 'var(--tight)' : v < -0.05 ? 'var(--weak)' : null)); }); });
      } else if (this.mode === 'motion') {
        const groups = {}; (window.MOTIONS || []).forEach((x) => { if (!m(x.name + x.group + (x.note || ''))) return; (groups[x.group] = groups[x.group] || []).push(x); });
        Object.entries(groups).forEach(([g, arr]) => { B.ap(h('div', { class: 'grp' }, g)); arr.forEach((x) => B.ap(h('button', { class: 'v3-item' + (this.sel && this.sel.kind === 'motion' && this.sel.id === x.id ? ' on' : ''), onclick: () => this.playMotion(x.id) }, h('span', { class: 'sw', style: { background: 'var(--tight)' } }), h('span', null, x.name), h('span', { class: 'en' }, x.max || '')))); });
      } else if (this.mode === 'meridian') {
        window.MERIDIANS.forEach((x) => { if (m(x.name + x.id + x.short)) B.ap(item('meridian', x.id, x.name, x.id, hex(x.color))); });
      } else if (this.mode === 'sinew') {
        window.SINEWS.forEach((x) => { if (m(x.name + x.note + x.sick)) B.ap(item('sinew', x.id, x.name, '經筋', hex(x.color))); });
      } else if (this.mode === 'nerve') {
        const src = Object.keys(NV()).length ? NV() : (window.NERVES3D || {}); const groups = {};
        Object.entries(src).forEach(([id, n]) => { if (!m(n.name + (n.roots || '') + (n.plexus || '') + (n.course || ''))) return; (groups[n.plexus || '神經'] = groups[n.plexus || '神經'] || []).push([id, n]); });
        Object.entries(groups).forEach(([g, arr]) => { B.ap(h('div', { class: 'grp' }, g)); arr.forEach(([id, n]) => B.ap(item('nerve', id, n.name, n.roots || '', '#' + (((window.NERVES3D || {})[id] || {}).color || 0xf3d36b).toString(16).padStart(6, '0')))); });
      } else if (this.mode === 'derm') {
        const cols = (this.inst && this.inst.dermColors) || {}; const D = (window.NERVE_INFO || {}).dermatomes || [];
        ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3', 'S4'].forEach((sg) => { const d = D.find((x) => x.seg === sg) || {}; if (!m(sg + (d.area || '') + (NERVE[sg] || ''))) return;
          B.ap(h('button', { class: 'v3-item' + ((this.dermSel || []).includes(sg) ? ' on' : ''), onclick: () => this.pick('derm', sg) }, h('span', { class: 'sw', style: { background: cols[sg] != null ? '#' + cols[sg].toString(16).padStart(6, '0') : 'var(--line)' } }), h('span', null, sg), h('span', { class: 'en' }, cut(d.area || NERVE[sg] || '', 18)))); });
      } else if (this.mode === 'cmp') {
        const pk = h('div', { class: 'pad' }); B.ap(pk); Compare.picker(pk, { quick: () => [].concat(this.sel && ['muscle', 'sinew', 'nerve', 'point'].includes(this.sel.kind) ? [[this.sel.kind, this.sel.id, Compare.label(this.sel.kind, this.sel.id)]] : [], [['muscle', 'piriformis', '梨狀肌'], ['muscle', 'glute_med', '臀中肌'], ['muscle', 'iliopsoas', '髂腰肌'], ['bone', 'bn-hip', '髖骨'], ['bone', 'bn-sacrum', '薦椎'], ['sinew', 'BL', '足太陽經筋'], ['sinew', 'GB', '足少陽經筋']]) });
        return;
      } else {
        window.MERIDIANS.forEach((mer) => { const arr = window.POINTS.filter((p) => p.mer === mer.id && m(p.name + p.id + p.ind + p.loc)); if (!arr.length) return; B.ap(h('div', { class: 'grp' }, mer.name)); arr.forEach((p) => B.ap(item('point', p.id, p.name, p.id, hex(mer.color)))); });
      }
      if (!B.children.length) B.ap(h('p', { class: 'small muted pad' }, '找不到符合的項目。'));
    },
    det(I, md, kbId, label) {
      if (!md) return;
      const box = h('div', { class: 'prose small', html: KB.md(md) });
      const d = h('details', { class: 'det' }, h('summary', null, label || '詳解（參考書與課堂整理）'), box, h('button', { class: 'link small', onclick: () => KB.open(kbId) }, '在知識庫開啟完整頁 →'));
      I.ap(d); KB.bindRefs(box);
    },
    renderInfo() {
      const I = clear(this.info); const s = this.sel;
      if (!s) { I.ap(h('div', { class: 'eyebrow' }, '使用方式'), h('p', { class: 'small' }, '從清單或模型上點選。肌肉會顯示起止點、作用、觸診位置與放鬆手法；經脈與經筋顯示循行；穴位顯示定位與推拿應用。'), h('p', { class: 'small muted' }, '小技巧：先開「骨骼＋肌肉」找肌肉走向；找穴位時改開「經脈＋穴位」，皮膚會變成不透明，比較好看清楚正反面。')); return; }
      if (s.kind === 'motion') {
        const d = (window.MOTIONS || []).find((x) => x.id === s.id); if (!d) { I.ap(h('h3', null, '骨盆姿勢'), h('button', { class: 'btn sm', onclick: () => this.stopMotion() }, '結束')); return; }
        const st = this.inst ? this.inst.motionState() : { side: 'L', playing: true, t: 0 };
        const mchip = (a, cls) => { const [id, w] = Array.isArray(a) ? a : [a, 'same']; return MU[id] ? h('button', { class: 'chip', onclick: () => this.focusMuscle(id) }, h('span', { class: 'dot ' + cls }), MU[id].name + (w === 'opp' ? '（對側）' : ''), MU[id].nerve ? h('span', { class: 'muted small' }, ' ' + MU[id].nerve.replace(/（筆記.*?）/, '')) : null) : null; };
        const playBtn = h('button', { class: 'btn sm pri', onclick: (e) => { const on = !(this.inst && this.inst.motionState().playing); if (this.inst) this.inst.setMotionPlaying(on); e.currentTarget.textContent = on ? '暫停' : '播放'; } }, st.playing ? '暫停' : '播放');
        this.mSlider = h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round((st.t || 0) * 100), 'aria-label': '動作幅度', style: { flex: '1' }, oninput: (e) => { if (this.inst) this.inst.setMotionT(+e.target.value / 100); playBtn.textContent = '播放'; } });
        const sideBtns = d.side === false ? null : h('div', { class: 'row' }, h('span', { class: 'small muted' }, '側別'), ['L', 'R'].map((sd) => h('button', { class: 'chip' + ((this.motionSide || 'L') === sd ? ' on' : ''), onclick: () => { this.motionSide = sd; if (this.inst) this.inst.setMotionSide(sd); this.renderInfo(); } }, sd === 'L' ? '左' : '右')));
        I.ap(h('div', { class: 'eyebrow' }, d.group), h('h3', null, d.name), h('div', { class: 'muted small' }, '幅度：' + (d.max || '')),
          h('div', { class: 'row', style: { marginTop: '8px' } }, playBtn, this.mSlider),
          h('div', { class: 'row', style: { marginTop: '6px' } }, sideBtns, h('span', { class: 'small muted' }, '速度'), h('select', { class: 'selectbox', style: { width: 'auto', padding: '3px 6px' }, onchange: (e) => this.inst && this.inst.setMotionSpeed(+e.target.value) }, [['0.5', '慢'], ['1', '一般'], ['1.8', '快']].map(([v, n]) => h('option', { value: v, selected: v === '1' }, n))), h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => this.stopMotion() }, '結束示範')),
          h('p', { class: 'small', style: { marginTop: '10px' } }, d.note || ''),
          h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, '主動肌（紅）'), h('div', { class: 'chips', style: { marginTop: '4px' } }, (d.movers || []).map((a) => mchip(a, 't'))),
          (d.antag || []).length ? h('div', null, h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, '被拉長的拮抗肌（藍）'), h('div', { class: 'chips', style: { marginTop: '4px' } }, d.antag.map((a) => mchip(a, 'w')))) : null,
          (d.kb || []).length ? h('div', { class: 'row', style: { marginTop: '10px' } }, d.kb.filter((k) => KB.byId(k)).map((k) => h('button', { class: 'link small', onclick: () => KB.open(k) }, '知識庫：' + KB.byId(k).title))) : null,
          h('p', { class: 'small muted', style: { marginTop: '10px' } }, '示意動畫：骨頭以關節中心轉動，肌肉依附著的骨頭跟著變形；角度與軸向為教學用近似，骨盆角度有放大。'));
        return;
      }
      if (s.kind === 'muscle') {
        const x = MU[s.id]; const t = this.tension && this.tension[s.id];
        I.ap(h('div', { class: 'eyebrow' }, x.region + '・' + x.layer), h('h3', null, x.name), h('div', { class: 'row' }, h('span', { class: 'muted small mono' }, x.en), h('span', { class: 'sp' }), cmpBtn('muscle', s.id)),
          t ? h('div', { class: 'row', style: { marginTop: '6px' } }, ['L', 'R'].map((sd) => t[sd] ? h('span', { class: 'badge ' + (t[sd] > 0 ? 't' : 'w') }, (sd === 'L' ? '左 ' : '右 ') + (t[sd] > 0 ? '偏緊' : '被拉長')) : null)) : null,
          h('dl', { class: 'kv' }, h('dt', null, '起點'), h('dd', null, x.origin), h('dt', null, '止點'), h('dd', null, x.insertion), h('dt', null, '作用'), h('dd', null, x.action), h('dt', null, '觸診'), h('dd', null, x.palpation), h('dt', null, '放鬆'), h('dd', null, x.release), h('dt', null, '轉移痛'), h('dd', null, x.referral), x.nerve ? h('dt', null, '神經') : null, x.nerve ? h('dd', null, x.nerve) : null),
          h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '相關穴位'), h('div', { class: 'chips', style: { marginTop: '4px' } }, (x.points || []).filter((p) => PT[p]).map((p) => h('button', { class: 'chip', onclick: () => this.focusPoint(p) }, PT[p].name))),
          (() => { const ms = Object.entries(window.MER_NOTES || {}).filter(([, n]) => n.muscles.includes(s.id)).map(([k]) => k).filter((k) => MER[k]); return ms.length ? h('div', null, h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '所屬經絡（筆記）'), h('div', { class: 'chips', style: { marginTop: '4px' } }, ms.map((k) => h('button', { class: 'chip', onclick: () => this.focusMeridian(k) }, h('span', { class: 'dot', style: { background: hex(MER[k].color) } }), MER[k].name)))) : null; })(),
          h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '相關經筋'), h('div', { class: 'chips', style: { marginTop: '4px' } }, (x.sinew || []).filter((p) => SIN[p]).map((p) => h('button', { class: 'chip', onclick: () => this.focusSinew(p) }, SIN[p].name))),
          h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'link small', onclick: () => KB.openSearch(x.name.replace(/（.*/, '')) }, '在知識庫搜尋「' + x.name.replace(/（.*/, '') + '」')));
        this.det(I, (DET.mu[s.id] || {}).md, 'mu:' + s.id);
      } else if (s.kind === 'nerve') {
        const n = NV()[s.id] || {}; const n3 = (window.NERVES3D || {})[s.id] || {};
        I.ap(h('div', { class: 'eyebrow' }, (n.plexus || '神經') + (n.roots ? '・' + n.roots : '')), h('h3', null, n.name || n3.name || s.id), h('div', { class: 'row' }, h('span', { class: 'muted small mono' }, n.en || ''), h('span', { class: 'sp' }), cmpBtn('nerve', s.id)),
          h('p', { class: 'small muted' }, '3D 走向為依骨性標誌畫出的示意，用來理解路徑與卡壓點，不是精確位置。'),
          n.course ? h('dl', { class: 'kv' }, h('dt', null, '走向'), h('dd', null, n.course), n.sensory ? h('dt', null, '感覺') : null, n.sensory ? h('dd', null, n.sensory) : null, n.lesion ? h('dt', null, '受損') : null, n.lesion ? h('dd', null, n.lesion) : null) : null,
          (n.motor || []).filter((m) => MU[m]).length ? h('div', null, h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, '支配的肌肉'), h('div', { class: 'chips', style: { marginTop: '4px' } }, n.motor.filter((m) => MU[m]).map((m) => h('button', { class: 'chip', onclick: () => this.focusMuscle(m) }, MU[m].name))), n.motorText ? h('p', { class: 'small muted', style: { margin: '4px 0 0' } }, n.motorText) : null,
            h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => { this.setLayers({ muscle: true, nerve: true }); this.inst && this.inst.select('muscle', n.motor.filter((m) => MU[m]), { focus: true, dist: 2.4 }); } }, '在 3D 標出這些肌肉')) : null,
          (n.entrap || []).length ? h('div', null, h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, '常見卡壓點'), (n.entrap || []).map((e) => h('div', { class: 'edge-item small' }, h('b', null, e.site), '：', e.cause || '', e.signs ? '。表現：' + e.signs : '', e.test ? '。檢查：' + e.test : '', e.tuina ? h('div', { class: 'muted' }, '推拿：' + e.tuina) : null))) : null,
          (n.points || []).filter((x) => PT[x]).length ? h('div', null, h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, '沿線穴位'), h('div', { class: 'chips', style: { marginTop: '4px' } }, n.points.filter((x) => PT[x]).map((x) => h('button', { class: 'chip', onclick: () => this.focusPoint(x) }, PT[x].name)))) : null,
          n.notes ? h('p', { class: 'small', style: { marginTop: '8px' } }, h('b', null, '課堂筆記：'), n.notes) : null,
          KB.has('nv:' + s.id) ? h('button', { class: 'link small', style: { marginTop: '8px' }, onclick: () => KB.open('nv:' + s.id) }, '在知識庫開啟完整頁 →') : null);
      } else if (s.kind === 'derm') {
        const sel = this.dermSel || []; const D = (window.NERVE_INFO || {}).dermatomes || [];
        I.ap(h('div', { class: 'eyebrow' }, '皮節（示意）'), h('h3', null, sel.length ? sel.join('、') : '全部皮節'),
          h('p', { class: 'small' }, '點清單或皮膚上的區域可選取多個節段比較；再點一次取消。皮膚上的分區是依骨骼位置推算的示意，實際皮節有個人差異且相鄰節段會重疊。'),
          sel.map((sg) => { const d = D.find((x) => x.seg === sg) || {}; return h('div', { class: 'edge-item small' }, h('b', null, sg), '：', d.area || '', d.landmark ? '（記憶點：' + d.landmark + '）' : '', NERVE[sg] ? h('div', null, h('span', { class: 'muted' }, '課堂筆記：'), NERVE[sg]) : null, d.course ? h('div', { class: 'muted' }, d.course) : null); }),
          h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => { this.dermSel = []; if (this.inst) this.inst.setDermatome('all'); this.renderInfo(); this.renderList(); } }, '顯示全部'), h('button', { class: 'btn sm', onclick: () => { this.dermSel = []; if (this.inst) this.inst.setDermatome(null); this.setMode('muscle'); } }, '關閉皮節'),
            KB.has('k-nv-derm') ? h('button', { class: 'link small', onclick: () => KB.open('k-nv-derm') }, '皮節與神經判斷 →') : null));
      } else if (s.kind === 'meridian') {
        const x = MER[s.id]; const pts = window.POINTS.filter((p) => p.mer === s.id);
        const mn = (window.MER_NOTES || {})[s.id];
        I.ap(h('div', { class: 'eyebrow' }, x.side + (x.time ? '・' + x.time : '')), h('h3', null, x.name), h('p', { class: 'small' }, x.course),
          mn && mn.organ ? h('p', { class: 'small' }, h('b', null, '臟腑（筆記）：'), mn.organ) : null,
          mn ? h('div', null, h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, '筆記：本經相關肌肉'), h('p', { class: 'small muted', style: { margin: '2px 0 4px' } }, mn.text),
            h('div', { class: 'chips' }, mn.muscles.filter((m) => MU[m]).map((m) => h('button', { class: 'chip', onclick: () => this.focusMuscle(m) }, MU[m].name))),
            h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => this.showMerMuscles(s.id) }, '在 3D 一次標出這些肌肉')) : null,
          SIN[s.id] ? h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => this.focusSinew(s.id) }, '看' + SIN[s.id].name) : null,
          h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '本經常用穴'), h('div', { class: 'chips', style: { marginTop: '4px' } }, pts.map((p) => h('button', { class: 'chip', onclick: () => this.pick('point', p.id) }, p.name))));
      } else if (s.kind === 'sinew') {
        const x = SIN[s.id];
        I.ap(h('div', { class: 'eyebrow' }, '經筋（課堂筆記）'), h('h3', null, x.name), h('div', { class: 'row' }, h('span', { class: 'sp' }), cmpBtn('sinew', s.id)), h('p', { class: 'small' }, x.note), h('p', { class: 'small' }, h('b', null, '病候：'), x.sick),
          h('p', { class: 'small muted' }, '經筋總則（筆記）：寒則反折筋急、熱則筋弛縱不收；陽（背）急則反折、陰（腹）急則俯不能伸。'),
          h('div', { class: 'eyebrow' }, '「結」的位置'), h('div', { class: 'chips', style: { marginTop: '4px' } }, (x.knots || []).map((k) => h('span', { class: 'chip' }, k.name))),
          MER[s.id] ? h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => this.focusMeridian(s.id) }, '看同名經脈')) : null);
        this.det(I, (DET.sn[s.id] || {}).md, 'sw:' + s.id);
      } else if (s.kind === 'bone') {
        const info = this.inst && this.inst.partName(s.id); const zh = info ? info.zh : s.id; const en = info ? info.name : '';
        const note = boneNote(zh, en);
        I.ap(h('div', { class: 'eyebrow' }, info && info.kind === 'cart' ? '軟骨' : '骨骼'), h('h3', null, zh), h('div', { class: 'row' }, h('span', { class: 'muted small mono' }, en), h('span', { class: 'sp' }), window.boneIdOf && window.boneIdOf(zh) ? cmpBtn('bone', window.boneIdOf(zh)) : null),
          note ? h('div', { class: 'prose small', html: KB.md(note) }) : h('p', { class: 'small muted' }, '可在知識庫搜尋這塊骨頭的相關筆記。'),
          h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'link small', onclick: () => KB.openSearch(zh.replace(/^[左右]/, '').replace(/（.*）/, '')) }, '在知識庫搜尋「' + zh.replace(/^[左右]/, '').replace(/（.*）/, '') + '」')));
        KB.bindRefs(I);
        const bid = window.boneIdOf && window.boneIdOf(zh); if (bid && DET.bn[bid]) this.det(I, DET.bn[bid].md, bid, '骨骼詳解：' + DET.bn[bid].name);
      } else {
        const p = PT[s.id]; const mer = MER[p.mer];
        const rel = window.MUSCLES.filter((x) => (x.points || []).includes(p.id));
        I.ap(h('div', { class: 'eyebrow' }, (mer ? mer.name : '') + '・' + p.id), h('h3', null, p.name), h('div', { class: 'row' }, h('span', { class: 'sp' }), cmpBtn('point', s.id)),
          h('dl', { class: 'kv' }, h('dt', null, '定位'), h('dd', null, p.loc), h('dt', null, '主治'), h('dd', null, p.ind), p.tn ? h('dt', null, '推拿') : null, p.tn ? h('dd', null, p.tn) : null),
          rel.length ? h('div', null, h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '附近／相關肌肉'), h('div', { class: 'chips', style: { marginTop: '4px' } }, rel.map((x) => h('button', { class: 'chip', onclick: () => this.focusMuscle(x.id) }, x.name)))) : null,
          mer ? h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => this.focusMeridian(mer.id) }, '看整條' + mer.name)) : null);
        this.det(I, (DET.pt[s.id] || {}).md, 'pt:' + s.id);
      }
    },
  };

  // =====================================================================
  //  5. 知識庫
  // =====================================================================
  const CATS = ['全部', '原則', '評估', '骨盆', '薦椎', '脊椎', '頸肩', '上肢', '膝', '踝足', '骨骼', '神經', '經筋', '經絡穴位', '中醫基礎', '手法', '安全', '人物與流派'];
  const REGION_OPTS = window.CHAIN_NODES.map((n) => [n.id, n.name]);
  const KB = {
    q: '', cat: '全部', src: '全部', dsub: '全部', selId: null, editing: null,
    build(root) {
      root.ap(h('div', { class: 'sec-h' }, h('h2', null, '知識庫'), h('span', { class: 'muted small', id: 'kb-count' })));
      const search = h('input', { class: 'kb-search', id: 'kb-q', placeholder: '搜尋知識點、肌肉、穴位、經筋、逐字稿…（例如：薦椎、梨狀肌、跑者膝、風池）', value: this.q, oninput: (e) => { this.q = e.target.value.trim(); this.renderList(); } });
      this.addBtn = h('button', { class: 'btn pri', onclick: () => this.edit(null) }, '＋ 新增知識');
      root.ap(h('div', { class: 'kb-top' }, search, this.addBtn));
      this.filters = h('div', { class: 'kb-filters' }); this.subf = h('div', { class: 'kb-filters sub' }); root.ap(this.filters, this.subf);
      this.list = h('div', { class: 'kb-list' }); this.detail = h('div', { class: 'card pad kb-detail' });
      root.ap(h('div', { class: 'kb-layout' }, h('div', null, this.list), this.detail));
      this.renderFilters(); this.renderList(); this.renderDetail();
    },
    sources() {
      const s = ['全部', '課堂', '補充', '參考書', '整合說明', '詳解', '手法', '新增條目', '逐字稿'];
      if (Auth.isAdmin) s.push('審核佇列'); else if (Auth.canSubmit() || Object.keys(Subs.mine).length) s.push('我的投稿');
      return s;
    },
    refresh() {
      this.addBtn.textContent = Auth.canPublish() ? '＋ 新增知識' : '＋ 投稿新知識';
      if (!this.sources().includes(this.src)) this.src = '全部';
      this.renderFilters(); this.renderList(); if (!this.editing) this.renderDetail();
    },
    all() {
      const out = []; const rep = {};
      Notes.list.forEach((n) => { if (n.replaces) rep[n.replaces] = n; });
      const noteItem = (n, id) => ({ type: 'note', id, nid: n.id, title: n.title, cat: n.cat || '原則', src: n.src || '新增條目', body: n.body || '', muscles: n.muscles || [], points: n.points || [], regions: n.regions || [], tags: n.tags || [], mine: true, replaces: n.replaces || null });
      window.KB_ITEMS.forEach((k) => out.push(rep[k.id] ? noteItem(rep[k.id], k.id) : Object.assign({ type: 'kb' }, k)));
      Notes.list.forEach((n) => { if (!n.replaces || !window.KB_ITEMS.some((k) => k.id === n.replaces)) out.push(noteItem(n, 'note:' + n.id)); });
      if (this._syn) return out.concat(this._syn);
      const syn = [];
      window.MUSCLES.forEach((m) => syn.push({ type: 'muscle', id: 'mu:' + m.id, mid: m.id, title: m.name, cat: '肌肉', src: '肌肉資料', dsub: '肌肉', body: `${m.en}。起點：${m.origin}。止點：${m.insertion}。作用：${m.action}。觸診：${m.palpation} 放鬆：${m.release} 轉移痛：${m.referral}` + (DET.mu[m.id] ? '\n' + DET.mu[m.id].md : ''), symptoms: m.symptoms }));
      window.POINTS.forEach((p) => syn.push({ type: 'point', id: 'pt:' + p.id, pid: p.id, title: p.name + '（' + p.id + '）', cat: '穴位', src: (MER[p.mer] || {}).name || '', dsub: '穴位', body: `定位：${p.loc}。主治：${p.ind}。${p.tn ? '推拿：' + p.tn : ''}` + (DET.pt[p.id] ? '\n' + DET.pt[p.id].md : '') }));
      window.SINEWS.forEach((s) => syn.push({ type: 'sinew', id: 'sw:' + s.id, sid: s.id, title: s.name, cat: '經筋', src: '課堂筆記', dsub: '經筋', body: s.note + ' 病候：' + s.sick + (DET.sn[s.id] ? '\n' + DET.sn[s.id].md : '') }));
      Object.entries(DET.bn).forEach(([id, b]) => syn.push({ type: 'bone', id, title: b.name, cat: '骨骼', src: '骨骼詳解', dsub: '骨骼', body: b.en + '\n' + b.md, muscles: b.muscles, points: b.points }));
      (window.TECHS || []).forEach((x) => syn.push({ type: 'tech', id: x.id, title: x.name, cat: '手法', src: '手法目錄・' + x.group, dsub: x.group, risk: x.risk, body: x.md, muscles: x.muscles, regions: x.regions }));
      this._syn = syn;
      return out.concat(syn);
    },
    match(it) {
      if (this.cat !== '全部') { if (this.cat === '經筋' ? !(it.cat === '經筋') : this.cat === '經絡穴位' ? !(it.cat === '經絡穴位' || it.type === 'point') : it.cat !== this.cat) return false; }
      if (this.src === '新增條目' && !it.mine) return false;
      if (this.src === '課堂' && !(String(it.src).includes('課堂') || String(it.src).includes('筆記'))) return false;
      if (this.src === '補充' && !String(it.src).includes('補充')) return false;
      if (this.src === '參考書' && !String(it.src).startsWith('參考書')) return false;
      if (this.src === '整合說明' && it.src !== '整合說明') return false;
      if (this.src === '詳解' && !(['muscle', 'point', 'sinew', 'bone'].includes(it.type) || it.id === 'd-sn-overview')) return false;
      if (this.src === '手法' && it.type !== 'tech') return false;
      if ((this.src === '詳解' || this.src === '手法') && this.dsub !== '全部' && it.dsub !== this.dsub && !(it.id === 'd-sn-overview' && this.dsub === '經筋')) return false;
      if (!this.q) return it.type === 'kb' || it.type === 'note' || this.src === '詳解' || this.src === '手法' || (this.cat === '經筋' && it.type === 'sinew') || (this.cat === '手法' && it.type === 'tech') || (this.cat === '骨骼' && it.type === 'bone');
      const terms = this.q.split(/\s+/).filter(Boolean);
      const hay = (it.title + ' ' + it.body + ' ' + (it.tags || []).join(' ') + ' ' + (it.symptoms || []).join(' ') + ' ' + (it.muscles || []).map((m) => (MU[m] || {}).name || '').join(' ') + ' ' + it.cat).toLowerCase();
      return terms.every((t) => hay.includes(t.toLowerCase()));
    },
    special() { return this.src === '逐字稿' ? 'tx' : this.src === '審核佇列' || this.src === '我的投稿' ? 'sub' : null; },
    renderFilters() {
      const F = clear(this.filters); const sp = this.special();
      if (!sp) CATS.forEach((c) => F.ap(h('button', { class: 'chip' + (this.cat === c ? ' on' : ''), onclick: () => { this.cat = c; this.renderFilters(); this.renderList(); } }, c)));
      if (sp !== 'tx' && sp !== 'sub') F.ap(h('span', { style: { width: '12px' } }));
      this.sources().forEach((s) => {
        const n = s === '審核佇列' ? Subs.pendingCount() : 0;
        F.ap(h('button', { class: 'chip src' + (this.src === s ? ' on' : '') + (s === '審核佇列' || s === '我的投稿' ? ' lock' : ''), onclick: () => this.openSource(s) }, s === '全部' ? '所有來源' : s, n ? h('span', { class: 'cnt' }, n) : null));
      });
      clear(this.subf); this.subf.hidden = sp !== 'tx' && this.src !== '詳解' && this.src !== '手法';
      if (sp === 'tx') TX.renderFilters(this.subf);
      else if (this.src === '詳解' || this.src === '手法') {
        const opts = this.src === '詳解' ? ['全部', '穴位', '肌肉', '骨骼', '經筋'] : ['全部'].concat(window.TECH_GROUPS || []);
        if (!opts.includes(this.dsub)) this.dsub = '全部';
        opts.forEach((o) => this.subf.ap(h('button', { class: 'chip sm' + (this.dsub === o ? ' on' : ''), onclick: () => { this.dsub = o; this.renderFilters(); this.renderList(); } }, o)));
      }
    },
    openSource(s) {
      showTab('kb'); this.src = s; this.dsub = '全部'; this.selId = null; this.editing = null;
      if (s === '逐字稿') TX.load();
      this.renderFilters(); this.renderList(); this.renderDetail();
    },
    hl(text) { if (!this.q) return esc(text); let s = esc(text); this.q.split(/\s+/).filter(Boolean).forEach((t) => { const re = new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); s = s.replace(re, (m) => '<mark>' + m + '</mark>'); }); return s; },
    pick(id, btn) {
      this.selId = id; this.editing = null; this.renderDetail();
      this.list.querySelectorAll('.kb-item').forEach((b) => b.classList.remove('on')); if (btn) btn.classList.add('on');
      if (window.innerWidth < 900) this.detail.scrollIntoView({ behavior: 'smooth' });
    },
    renderList() {
      const L = clear(this.list); const sp = this.special();
      if (sp === 'tx') { TX.renderList(L); return; }
      if (sp === 'sub') { SubUI.renderList(L); return; }
      const items = this.all().filter((it) => this.match(it));
      const score = (it) => (this.q && it.title.includes(this.q) ? 0 : 1) + (it.type === 'kb' || it.type === 'note' ? 0 : 0.5);
      items.sort((a, b) => score(a) - score(b));
      const nn = Notes.list.length;
      $('#kb-count').textContent = items.length + ' 筆' + (nn ? '・新增條目 ' + nn + ' 筆' : '') + (Notes.mode === 'local' && Auth.dev ? '（本機模式）' : '');
      if (this.q && TX.data) {
        const n = TX.filtered(this.q, true).length;
        if (n) L.ap(h('button', { class: 'kb-hint', onclick: () => { TX.lec = '全部'; TX.part = '全部'; TX.topic = '全部'; this.openSource('逐字稿'); } }, '逐字稿中有 ', h('b', null, n), ' 段提到「' + this.q + '」→ 查看'));
      }
      if (!items.length) { L.ap(h('div', { class: 'empty' }, '沒有找到「' + this.q + '」。試試別的關鍵字，或按「' + this.addBtn.textContent.replace('＋ ', '') + '」把它記下來。')); return; }
      items.slice(0, 400).forEach((it) => {
        const preview = it.body.replace(/\*\*|\[\[.*?\]\]|#+ |^!! /gm, '').replace(/\|[\s|:-]*\|/g, ' ').replace(/\|/g, ' ').replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 120);
        const b = h('button', { class: 'kb-item' + (this.selId === it.id ? ' on' : ''), onclick: () => this.pick(it.id, b) },
          h('h4', { html: this.hl(it.title) }), h('p', { html: this.hl(preview) }),
          h('div', { class: 'kb-meta' }, h('span', { class: 'badge ' + (it.mine ? 'y' : it.type === 'kb' ? 'j' : '') }, it.mine ? (it.replaces ? '管理員修訂' : '新增條目') : it.cat), h('span', { class: 'badge' }, it.src), it.risk ? h('span', { class: 'badge ' + (it.risk === '高' ? 't' : it.risk === '中' ? 'y' : 'j') }, '風險' + it.risk) : null));
        L.ap(b);
      });
    },
    md(text) {
      // 極簡 markdown：段落、**粗體**、- 清單、表格 |a|b|、[[m:id]] [[p:id]] [[s:id]] 連結
      const lines = String(text).split('\n'); let html = ''; let inList = false; let tbl = [];
      const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[\[([mpsrk]):([\w-]+)\]\]/g, (m0, k, id) => {
        const name = k === 'm' ? (MU[id] || {}).name : k === 'p' ? (PT[id] || {}).name : k === 's' ? (SIN[id] || {}).name : k === 'k' ? this.title(id) : (NODE[id] || {}).name; return name ? `<button class="link ref" data-k="${k}" data-id="${id}">${esc(name)}</button>` : (k === 'k' ? id : m0); });
      const flushT = () => { if (!tbl.length) return; html += '<div class="tblwrap"><table>' + tbl.map((r, i) => '<tr>' + r.map((c) => (i === 0 ? '<th>' : '<td>') + inline(c.trim()) + (i === 0 ? '</th>' : '</td>')).join('') + '</tr>').join('') + '</table></div>'; tbl = []; };
      lines.forEach((ln) => {
        const fm = /^\s*\[\[fig:([\w-]+)\]\]\s*$/.exec(ln);
        if (fm) { flushT(); if (inList) { html += '</ul>'; inList = false; } const F = (window.KB_FIGS || {})[fm[1]]; if (F) html += '<figure class="kb-fig">' + F.svg + (F.cap ? '<figcaption>' + esc(F.cap) + '</figcaption>' : '') + '</figure>'; return; }
        if (/^\|.*\|$/.test(ln.trim())) { if (inList) { html += '</ul>'; inList = false; } const cells = ln.trim().slice(1, -1).split('|'); if (!cells.every((c) => /^\s*-+\s*$/.test(c))) tbl.push(cells); return; } else flushT();
        if (/^\s*[-•]\s+/.test(ln)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(ln.replace(/^\s*[-•]\s+/, '')) + '</li>'; return; }
        if (inList) { html += '</ul>'; inList = false; }
        if (/^!!\s/.test(ln)) { if (inList) { html += '</ul>'; inList = false; } html += '<div class="kb-conflict">' + inline(ln.replace(/^!!\s/, '')) + '</div>'; return; }
        if (/^###?\s/.test(ln)) { html += '<p><strong>' + inline(ln.replace(/^###?\s/, '')) + '</strong></p>'; return; }
        if (ln.trim()) html += '<p>' + inline(ln) + '</p>';
      });
      flushT(); if (inList) html += '</ul>';
      return html;
    },
    bindRefs(root) {
      root.querySelectorAll('button.ref').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.k, id = b.dataset.id; if (k === 'm') V3.focusMuscle(id); else if (k === 'p') V3.focusPoint(id); else if (k === 's') V3.focusSinew(id); else if (k === 'k') KB.open(id); else Chain.highlight([id], id); }));
    },
    renderDetail() {
      const D = clear(this.detail);
      if (this.editing) { this.renderForm(D); return; }
      const sp = this.special();
      if (sp === 'tx') { TX.renderDetail(D, this.selId); return; }
      if (sp === 'sub') { SubUI.renderDetail(D, this.selId); return; }
      const it = this.all().find((x) => x.id === this.selId);
      if (!it) {
        D.ap(h('div', { class: 'eyebrow' }, '知識庫'), h('h3', null, '從左邊選一則來看'), h('p', { class: 'small' }, '收錄課堂筆記（經筋、薦椎、骨盆三角度、頭痛分類）與課堂錄音整理出的重點，另以肌動學、整脊與經穴的通識補充（標示「補充」）。「逐字稿」可以依堂次、部位、知識點瀏覽各堂課錄音的原始逐字稿；「參考書」收錄老師推薦書籍的重點整理（自己的話＋頁碼）與和課堂理論的比對；「整合說明」是課堂與各書說法不一致處的統一結論；「詳解」為每個穴位、肌肉、骨骼、經筋依參考書整理的完整說明；「手法」收錄各種推拿、整復、整脊手法的步驟與禁忌。'),
          h('p', { class: 'small' }, '搜尋時也會找到肌肉、穴位與經筋資料；沒有搜尋時只列知識條目。'),
          h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '快速入口'), h('div', { class: 'chips', style: { marginTop: '6px' } }, ['薦椎', '三個角度', '被拉長', '膝', '經筋', '頭痛', '梨狀肌', '手法'].map((t) => h('button', { class: 'chip', onclick: () => this.openSearch(t) }, t)), (window.KB_BOOKS || []).length ? h('button', { class: 'chip on', onclick: () => this.open('b-overview') }, '參考書與課程比對') : null, this.has('u-overview') ? h('button', { class: 'chip on', onclick: () => this.open('u-overview') }, '統一說法總表') : null, h('button', { class: 'chip on', onclick: () => this.openSource('手法') }, '手法目錄'), h('button', { class: 'chip on', onclick: () => this.openSource('詳解') }, '穴位・肌肉・骨骼・經筋詳解')),
          h('div', { class: 'eyebrow', style: { marginTop: '12px' } }, '新增知識的方式'),
          h('p', { class: 'small' }, Auth.canPublish() ? '你是管理員：新增或修改的條目會直接發佈；也可以在「審核佇列」核准別人的投稿。' : Auth.canSubmit() ? '你可以投稿：用文字、語音輸入或拍照讓 Claude 辨識，送出後由管理員審核。' : '登入並取得投稿權限後，可以用文字、語音或照片投稿新知識（需管理員審核）。'));
        return;
      }
      if (it.type === 'muscle') { D.ap(h('div', { class: 'eyebrow' }, '肌肉'), h('h3', null, it.title)); const m = MU[it.mid]; D.ap(h('dl', { class: 'kv' }, h('dt', null, '起點'), h('dd', null, m.origin), h('dt', null, '止點'), h('dd', null, m.insertion), h('dt', null, '作用'), h('dd', null, m.action), h('dt', null, '觸診'), h('dd', null, m.palpation), h('dt', null, '放鬆'), h('dd', null, m.release), h('dt', null, '轉移痛'), h('dd', null, m.referral), m.nerve ? h('dt', null, '神經') : null, m.nerve ? h('dd', null, m.nerve) : null), h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn pri', onclick: () => V3.focusMuscle(m.id) }, '在 3D 看位置'), cmpBtn('muscle', m.id))); this.detBlock(D, (DET.mu[m.id] || {}).md); TX.relatedBlock(D, [m.name.replace(/（.*/, '')]); return; }
      if (it.type === 'point') { const p = PT[it.pid]; D.ap(h('div', { class: 'eyebrow' }, it.src), h('h3', null, it.title), h('dl', { class: 'kv' }, h('dt', null, '定位'), h('dd', null, p.loc), h('dt', null, '主治'), h('dd', null, p.ind), h('dt', null, '推拿'), h('dd', null, p.tn || '—')), h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn pri', onclick: () => V3.focusPoint(p.id) }, '在 3D 看位置'), cmpBtn('point', p.id))); this.detBlock(D, (DET.pt[p.id] || {}).md); const rm = ((DET.pt[p.id] || {}).muscles || []).filter((x) => MU[x]); if (rm.length) D.ap(h('div', { class: 'chips', style: { marginTop: '8px' } }, rm.map((x) => h('button', { class: 'chip', onclick: () => V3.focusMuscle(x) }, h('span', { class: 'dot t' }), MU[x].name)))); return; }
      if (it.type === 'sinew') { const s = SIN[it.sid]; D.ap(h('div', { class: 'eyebrow' }, '經筋・課堂筆記'), h('h3', null, s.name), h('p', null, s.note), h('p', null, h('b', null, '病候：'), s.sick), h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: () => V3.focusSinew(s.id) }, '在 3D 看循行'), h('button', { class: 'btn', onclick: () => this.open('d-sn-overview') }, '經筋總論'), cmpBtn('sinew', s.id))); this.detBlock(D, (DET.sn[s.id] || {}).md); TX.relatedBlock(D, [s.name]); return; }
      if (it.type === 'bone' || it.type === 'tech') {
        D.ap(h('div', { class: 'row' }, h('span', { class: 'badge j' }, it.cat), h('span', { class: 'badge' }, it.src), it.risk ? h('span', { class: 'badge ' + (it.risk === '高' ? 't' : it.risk === '中' ? 'y' : 'j') }, '風險' + it.risk) : null),
          h('h3', null, it.title), it.type === 'bone' ? h('div', { class: 'row' }, h('span', { class: 'muted small mono' }, DET.bn[it.id].en), h('span', { class: 'sp' }), cmpBtn('bone', it.id)) : null);
        const md = it.type === 'bone' ? DET.bn[it.id].md : TQ[it.id].md;
        const box = h('div', { class: 'prose', html: this.md(md) }); D.ap(box); this.bindRefs(box);
        const links = [];
        (it.muscles || []).forEach((m) => MU[m] && links.push(h('button', { class: 'chip', onclick: () => V3.focusMuscle(m) }, h('span', { class: 'dot t' }), MU[m].name)));
        (it.points || []).forEach((p) => PT[p] && links.push(h('button', { class: 'chip', onclick: () => V3.focusPoint(p) }, h('span', { class: 'dot j' }), PT[p].name)));
        (it.regions || []).forEach((r) => NODE[r] && links.push(h('button', { class: 'chip', onclick: () => Chain.highlight([r], r) }, '↔ ' + NODE[r].name)));
        if (links.length) D.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, '相關（點選在 3D／連鎖圖查看）'), h('div', { class: 'chips', style: { marginTop: '6px' } }, links));
        const mus = (it.muscles || []).filter((m) => MU[m]); if (mus.length > 1) D.ap(h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => V3.showMuscles(mus) }, '在 3D 一次標出這 ' + mus.length + ' 條肌肉')));
        if (it.type === 'tech') { const same = (window.TECHS || []).filter((x) => x.group === TQ[it.id].group && x.id !== it.id); D.ap(h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '同類手法'), h('div', { class: 'chips', style: { marginTop: '4px' } }, same.map((x) => h('button', { class: 'chip sm', onclick: () => this.open(x.id) }, x.name)))); }
        TX.relatedBlock(D, [it.title.replace(/（.*/, '').replace(/[／、].*/, '')]);
        return;
      }
      const pub = Auth.canPublish();
      const nvId = String(it.id).startsWith('nv:') ? it.id.slice(3) : null;
      if (nvId) D.ap(h('div', { class: 'row', style: { marginBottom: '6px' } }, (window.NERVES3D || {})[nvId] ? h('button', { class: 'btn pri sm', onclick: () => V3.focusNerve(nvId) }, '在 3D 看走向') : null, cmpBtn('nerve', nvId)));
      D.ap(h('div', { class: 'row' }, h('span', { class: 'badge ' + (it.mine ? 'y' : 'j') }, it.mine ? (it.replaces ? '管理員修訂' : '新增條目') : it.cat), h('span', { class: 'badge' }, it.src), h('span', { class: 'sp' }),
        pub && it.mine ? h('button', { class: 'btn sm', onclick: () => this.edit(Notes.list.find((n) => n.id === it.nid)) }, '編輯') : null,
        pub && it.type === 'kb' ? h('button', { class: 'btn sm', title: '修改後會以管理員修訂版取代原文；可隨時還原', onclick: () => this.edit({ title: it.title, cat: it.cat, src: it.src, body: it.body, muscles: it.muscles || [], points: it.points || [], regions: it.regions || [], tags: it.tags || [], replaces: it.id }) }, '修改') : null,
        !pub && Auth.canSubmit() && it.type === 'kb' ? h('button', { class: 'btn sm', title: '提出修改建議，由管理員審核', onclick: () => this.edit({ title: it.title, cat: it.cat, src: it.src, body: it.body, muscles: it.muscles || [], points: it.points || [], regions: it.regions || [], tags: it.tags || [], replaces: it.id }) }, '建議修改') : null));
      D.ap(h('h3', null, it.title));
      if (it.tags && it.tags.length) D.ap(h('div', { class: 'chips', style: { margin: '6px 0' } }, it.tags.map((t) => h('button', { class: 'chip sm', onclick: () => this.openSearch(t) }, '#' + t))));
      const body = h('div', { class: 'prose', html: this.md(it.body) }); D.ap(body); this.bindRefs(body);
      const links = [];
      (it.muscles || []).forEach((m) => MU[m] && links.push(h('button', { class: 'chip', onclick: () => V3.focusMuscle(m) }, h('span', { class: 'dot t' }), MU[m].name)));
      (it.points || []).forEach((p) => PT[p] && links.push(h('button', { class: 'chip', onclick: () => V3.focusPoint(p) }, h('span', { class: 'dot j' }), PT[p].name)));
      (it.regions || []).forEach((r) => NODE[r] && links.push(h('button', { class: 'chip', onclick: () => Chain.highlight([r], r) }, '↔ ' + NODE[r].name)));
      if (links.length) D.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, '相關（點選在 3D／連鎖圖查看）'), h('div', { class: 'chips', style: { marginTop: '6px' } }, links));
      const mots = (window.MOTIONS || []).filter((m) => (m.kb || []).includes(it.id));
      if (mots.length) D.ap(h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, '3D 動作示範'), h('div', { class: 'chips', style: { marginTop: '4px' } }, mots.map((m) => h('button', { class: 'chip', onclick: () => V3.playMotion(m.id) }, '▶ ' + m.name))));
      const mus = (it.muscles || []).filter((m) => MU[m]); if (mus.length > 1) D.ap(h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => V3.showMuscles(mus) }, '在 3D 一次標出這 ' + mus.length + ' 條肌肉')));
      TX.relatedBlock(D, TX.termsOf(it), it.src);
      if (pub && it.replaces) D.ap(h('p', { class: 'small muted', style: { marginTop: '10px' } }, '這是管理員修訂版。', h('button', { class: 'link small', onclick: async () => { if (await Notes.remove(it.nid)) { toast('已還原原文'); this.renderDetail(); } } }, '還原原文')));
    },
    title(id) {
      if (!this._titles) { this._titles = {}; this.all().forEach((x) => { if (x.type !== 'note') this._titles[x.id] = x.title; }); }
      return this._titles[id] || (Notes.list.find((n) => 'note:' + n.id === id) || {}).title || '';
    },
    has(id) { return !!this.title(id); },
    detBlock(D, md, label) { if (!md) return; const box = h('div', { class: 'prose', html: this.md(md) }); D.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, label || '詳解（參考書與課堂整理）'), box); this.bindRefs(box); },
    byId(id) { return this.all().find((x) => x.id === id) || null; },
    open(id) { this.q = ''; this.cat = '全部'; this.src = '全部'; this.editing = null; showTab('kb'); const i = $('#kb-q'); if (i) i.value = ''; this.selId = id; this.renderFilters(); this.renderList(); this.renderDetail(); },
    openSearch(q) { this.q = q; this.cat = '全部'; this.src = '全部'; this.editing = null; showTab('kb'); const i = $('#kb-q'); if (i) i.value = q; this.renderFilters(); this.renderList(); const first = this.all().filter((x) => this.match(x))[0]; this.selId = first ? first.id : null; this.renderDetail(); this.renderList(); },
    openNote(id) { const n = Notes.list.find((x) => x.id === id); this.open(n && n.replaces && window.KB_ITEMS.some((k) => k.id === n.replaces) ? n.replaces : 'note:' + id); },
    blank(extra) { return Object.assign({ title: '', cat: '原則', src: '課堂 ' + new Date().toISOString().slice(5, 10).replace('-', ''), body: '', muscles: [], points: [], regions: [], tags: [] }, extra || {}); },
    edit(note) { this.aiMsg = ''; this.editing = note ? JSON.parse(JSON.stringify(note)) : this.blank(); showTab('kb'); this.renderDetail(); if (window.innerWidth < 900) this.detail.scrollIntoView({ behavior: 'smooth' }); },
    lockCard(D) {
      const r = Auth.role();
      D.ap(h('div', { class: 'lock-card' }, h('div', { class: 'lock-ic', 'aria-hidden': 'true' }, '鎖'), h('h3', null, r === 'guest' ? '請先登入' : '目前沒有投稿權限'),
        h('p', { class: 'small' }, r === 'guest' ? (FB ? '新增知識條目需要先登入（Google 帳號，第一次登入即註冊）。管理員可直接發佈，會員送出後需管理員審核。' : '新增知識條目需要登入 claude.ai。登入後依頁面分享設定，管理員可直接發佈，投稿者送出後需管理員審核。') : r === 'blocked' ? '你的帳號已被管理員停用投稿。' : '這個帳號對本頁只有檢視權限。請頁面擁有者在分享設定把你加為「Contributor／參與者」（可投稿）或「Editor／編輯者」（管理員）。'),
        h('div', { class: 'row' }, FB && r === 'guest' ? h('button', { class: 'btn pri', onclick: () => BACKEND.signIn().catch(() => toast('登入失敗')) }, '用 Google 帳號登入') : null, h('button', { class: 'btn', onclick: () => { this.editing = null; this.renderDetail(); } }, '返回'))));
    },
    renderForm(D) {
      const n = this.editing; const pub = Auth.canPublish(); const sub = Auth.canSubmit();
      if (!pub && !sub) { this.lockCard(D); return; }
      const fromSub = n._from; const isFix = !!n.replaces;
      D.ap(h('div', { class: 'eyebrow' }, pub ? (fromSub ? '審核：編輯後發佈' : n.id ? '編輯條目' : isFix ? '修改原有條目' : '新增知識') : (n.sid ? '修改投稿' : isFix ? '建議修改' : '投稿新知識')),
        h('h3', null, n.title || (pub ? '記下新的知識點' : '投稿一則新知識')));
      if (!pub) D.ap(h('p', { class: 'small muted', style: { margin: '4px 0 0' } }, '送出後會進入審核佇列，管理員核准才會出現在知識庫。'));
      // ---- 輸入輔助：照片、語音、AI 整理 ----
      const status = h('div', { class: 'ai-status small', role: 'status', 'aria-live': 'polite' });
      const say = (t) => { status.textContent = t; this.aiMsg = t; };
      status.textContent = this.aiMsg || '';
      const fill = (o) => { if (!o) return; ['title', 'cat', 'body'].forEach((k) => { if (o[k]) n[k] = o[k]; }); ['tags', 'muscles', 'points', 'regions'].forEach((k) => { n[k] = Array.from(new Set((n[k] || []).concat(o[k] || []))); }); this.renderDetail(); };
      const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', multiple: true, hidden: true, onchange: async (e) => {
        const fs = Array.from(e.target.files || []); e.target.value = ''; if (!fs.length) return;
        imgBtn.disabled = true; const o = await AI.run('image', fs, say); imgBtn.disabled = false; if (o) { n.via = 'image'; if (!n.src || /^課堂 \d{4}$/.test(n.src)) n.src = '照片辨識'; fill(o); $('#nf-status') && ($('#nf-status').textContent = '已依照片填入，請檢查。'); }
      } });
      const imgBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => fileIn.click() }, '照片辨識');
      const voiceBtn = h('button', { type: 'button', class: 'btn sm' }, '語音輸入');
      const audIn = h('input', { type: 'file', accept: 'audio/*', hidden: true, onchange: async (e) => {
        const fs = Array.from(e.target.files || []); e.target.value = ''; if (!fs.length) return;
        audBtn.disabled = true; const o = await AI.run('audio', fs, say); audBtn.disabled = false; if (o) { n.via = 'audio'; if (!n.src || /^課堂 \d{4}$/.test(n.src)) n.src = '錄音辨識：' + fs[0].name.slice(0, 30); fill(o); }
      } });
      const audBtn = h('button', { type: 'button', class: 'btn sm', hidden: true, onclick: () => audIn.click() }, '錄音檔辨識');
      const aiBtn = h('button', { type: 'button', class: 'btn sm', onclick: async () => { const t = (n.body || '').trim(); if (t.length < 10) { say('先在「內容」輸入或用語音說一段文字，再按 AI 整理。'); return; } aiBtn.disabled = true; const o = await AI.run('text', (n.title ? n.title + '\n' : '') + t, say); aiBtn.disabled = false; if (o) fill(o); } }, 'AI 整理文字');
      if (!pub) {
        // AI 輔助（照片、錄音、AI 整理）只開放管理員；會員用文字或語音輸入
        D.ap(h('div', { class: 'ai-bar' }, h('span', { class: 'small muted' }, '快速輸入：'), voiceBtn), status,
          h('p', { class: 'small muted', style: { margin: '2px 0 0' } }, '照片、錄音檔辨識與 AI 整理僅限管理員使用；你可以直接輸入或用語音輸入，管理員審核時會再整理。'));
      } else {
      D.ap(h('div', { class: 'ai-bar' }, h('span', { class: 'small muted' }, '快速輸入：'), imgBtn, audBtn, voiceBtn, aiBtn, fileIn, audIn), status);
      D.ap(h('p', { class: 'small muted', style: { margin: '2px 0 0' } }, FB ? '照片、錄音檔辨識與 AI 整理使用 Gemini（Firebase 免費額度，全站共用）。錄音檔建議 10 分鐘內。' : '照片辨識與 AI 整理會用你自己的 Claude 額度。錄音檔請傳給 Claude 在對話中轉成逐字稿（網頁內無法直接辨識錄音檔）。'));
      Auth.sampler().then((s) => { if (!s) { imgBtn.disabled = true; aiBtn.disabled = true; imgBtn.title = aiBtn.title = FB ? '需要登入才能使用 AI' : '需要登入 claude.ai 才能使用 Claude'; } else if (Auth._lim && Auth._lim.audio) { audBtn.hidden = false; } else if (!Auth._lim || !Auth._lim.images) { imgBtn.disabled = true; imgBtn.title = '這個檢視無法傳送圖片'; } });
      }
      // ---- 表單 ----
      const f = h('form', { class: 'form', onsubmit: async (e) => { e.preventDefault(); await this.saveForm(n); } });
      const inp = (k, lab, attrs = {}) => h('label', null, lab, h('input', Object.assign({ id: 'nf-' + k, value: n[k] || '', oninput: (e) => (n[k] = e.target.value) }, attrs)));
      f.ap(inp('title', '標題', { placeholder: '例如：大轉子觸診判斷 EX/IN', required: true }));
      f.ap(h('div', { class: 'row' }, h('label', { style: { flex: '1 1 140px' } }, '分類', h('select', { id: 'nf-cat', onchange: (e) => (n.cat = e.target.value) }, CATS.slice(1).map((c) => h('option', { value: c, selected: n.cat === c }, c)))), h('label', { style: { flex: '1 1 140px' } }, '來源', h('input', { id: 'nf-src', value: n.src || '', placeholder: '課堂 1005／書名頁碼', oninput: (e) => (n.src = e.target.value) }))));
      const ta = h('textarea', { id: 'nf-body', placeholder: '把老師的說法、你的手感、客人案例寫下來…', oninput: (e) => (n.body = e.target.value) }, n.body || '');
      voiceBtn.addEventListener('click', () => { n.via = n.via || 'voice'; Voice.toggle(ta, voiceBtn, say); });
      f.ap(h('label', null, '內容（可用 **粗體**、- 清單；[[m:梨狀肌id]] 這類連結會自動變成按鈕）', ta));
      f.ap(h('label', null, '標籤（知識點、部位，用逗號或空白分隔）', h('input', { id: 'nf-tags', value: (n.tags || []).join('，'), placeholder: '例如：骨盆, 長短腳, 觸診', oninput: (e) => (n.tags = e.target.value.split(/[，,、\s]+/).map((x) => x.trim()).filter(Boolean)) })));
      const picker = (label, key, options) => {
        const box = h('div', { class: 'pick' }); const chosen = h('div', { class: 'chips' }); const res = h('div', { class: 'pick-res' });
        const q = h('input', { placeholder: '輸入名稱篩選…', 'aria-label': label + '篩選' });
        const draw = () => {
          clear(chosen).ap(...(n[key] || []).map((id) => { const o = options.find((x) => x[0] === id); return o ? h('button', { type: 'button', class: 'chip on', onclick: () => { n[key] = n[key].filter((x) => x !== id); draw(); } }, o[1], ' ×') : null; }));
          const t = q.value.trim(); clear(res).ap(...options.filter((o) => !(n[key] || []).includes(o[0]) && (!t || o[1].includes(t) || o[0].toLowerCase().includes(t.toLowerCase()))).slice(0, t ? 30 : 12).map((o) => h('button', { type: 'button', class: 'chip', onclick: () => { n[key] = (n[key] || []).concat(o[0]); draw(); } }, o[1])));
        };
        q.addEventListener('input', draw); box.ap(chosen, q, res); draw();
        return h('div', null, h('div', { class: 'small muted', style: { marginBottom: '4px' } }, label), box);
      };
      f.ap(picker('關聯肌肉', 'muscles', window.MUSCLES.map((m) => [m.id, m.name])));
      f.ap(picker('關聯穴位', 'points', window.POINTS.map((p) => [p.id, p.name + ' ' + p.id])));
      f.ap(picker('關聯部位（會出現在連鎖圖與評估結果）', 'regions', REGION_OPTS));
      f.ap(h('div', { class: 'row' }, h('button', { class: 'btn pri', type: 'submit' }, pub ? (fromSub ? '核准並發佈' : '儲存並發佈') : '送出審核'), h('button', { class: 'btn', type: 'button', onclick: () => { this.editing = null; this.renderDetail(); } }, '取消'), h('span', { class: 'sp' }),
        pub && n.id ? h('button', { class: 'btn', type: 'button', id: 'nf-del', onclick: async (e) => { const b = e.currentTarget; if (b.dataset.armed) { const ok = await Notes.remove(n.id); if (ok) { toast('已刪除'); this.editing = null; this.selId = null; this.renderList(); this.renderDetail(); } } else { b.dataset.armed = '1'; b.textContent = '再按一次確認刪除'; b.style.color = 'var(--tight)'; } } }, '刪除') : null));
      f.ap(h('p', { class: 'small muted', id: 'nf-status' }, pub ? (Notes.mode === 'db' ? '發佈後所有看這個頁面的人都看得到。' : '本機模式：只存在這個瀏覽器。') : '投稿內容只有你和管理員看得到，核准後才公開。'));
      D.ap(f);
    },
    async saveForm(n) {
      if (!String(n.title || '').trim()) { toast('請輸入標題'); return; }
      const clean = { title: n.title.trim(), cat: n.cat || '原則', src: n.src || '', body: n.body || '', muscles: n.muscles || [], points: n.points || [], regions: n.regions || [], tags: n.tags || [] };
      if (n.replaces) clean.replaces = n.replaces;
      if (Auth.canPublish()) {
        const note = Object.assign({ id: n.id || undefined, created: n.created, by: n.by }, clean);
        if (n._from) note.from = n._from.uid + '/' + n._from.sid;
        if (n.replaces && !n.id) { const ex = Notes.list.find((x) => x.replaces === n.replaces); if (ex) note.id = ex.id; }
        const ok = await Notes.save(note); if (!ok) return;
        if (n._from) await Subs.setStatus(n._from.uid, n._from.sid, 'approved', '', note.id);
        toast(n._from ? '已核准並發佈' : '已發佈');
        this.editing = null; if (!n._from) { this.src = '全部'; this.selId = n.replaces || 'note:' + note.id; }
        this.renderFilters(); this.renderList(); this.renderDetail();
      } else {
        const sid = await Subs.submit(Object.assign({ sid: n.sid, via: n.via || 'text' }, clean)); if (!sid) return;
        toast('已送出，等待管理員審核'); this.editing = null; this.src = '我的投稿'; this.selId = 'sub:' + Auth.id + ':' + sid;
        this.renderFilters(); this.renderList(); this.renderDetail();
      }
    },
  };

  // ---------- 投稿／審核畫面 ----------
  const SubUI = {
    renderList(L) {
      const admin = Auth.isAdmin; const rows = Subs.rows();
      $('#kb-count').textContent = admin ? Subs.pendingCount() + ' 則待審核' : rows.length + ' 則投稿';
      if (admin) L.ap(h('label', { class: 'small row', style: { gap: '6px', margin: '0 0 8px' } }, h('input', { type: 'checkbox', checked: Subs.showDone, onchange: (e) => { Subs.showDone = e.target.checked; KB.renderList(); } }), '也顯示已處理的投稿'));
      if (!rows.length) { L.ap(h('div', { class: 'empty' }, admin ? '目前沒有待審核的投稿。' : '你還沒有投稿。按上方「＋ 投稿新知識」開始。')); return; }
      rows.forEach((r) => {
        const id = 'sub:' + r.uid + ':' + r.sid; const st = ST_LABEL[r.status] || ST_LABEL.pending;
        const b = h('button', { class: 'kb-item' + (KB.selId === id ? ' on' : ''), onclick: () => KB.pick(id, b) },
          h('h4', null, r.title || '（無標題）'), h('p', null, String(r.body || '').replace(/\n/g, ' ').slice(0, 100)),
          h('div', { class: 'kb-meta' }, h('span', { class: 'badge ' + st[1] }, st[0]), r.replaces ? h('span', { class: 'badge' }, '修改建議') : null, h('span', { class: 'badge' }, { image: '照片', voice: '語音', audio: '錄音檔', text: '文字' }[r.via] || '文字'),
            admin ? h('span', { class: 'badge' }, Subs.names[r.uid] || '投稿者') : null, h('span', { class: 'badge' }, new Date(r.updated || r.created || 0).toLocaleDateString('zh-TW'))));
        L.ap(b);
      });
    },
    renderDetail(D, selId) {
      const m = /^sub:([^:]+):(.+)$/.exec(selId || ''); const r = m && Subs.get(m[1], m[2]);
      if (!r) { D.ap(h('div', { class: 'eyebrow' }, Auth.isAdmin ? '審核佇列' : '我的投稿'), h('h3', null, '從左邊選一則投稿'), h('p', { class: 'small' }, Auth.isAdmin ? '核准後條目會出現在知識庫「新增條目」；也可以先編輯再發佈，或填寫原因退回。' : '投稿只有你和管理員看得到。被退回的投稿可以修改後重新送出。')); return; }
      const st = ST_LABEL[r.status] || ST_LABEL.pending; const admin = Auth.isAdmin;
      D.ap(h('div', { class: 'row' }, h('span', { class: 'badge ' + st[1] }, st[0]), h('span', { class: 'badge' }, r.cat || '原則'), r.src ? h('span', { class: 'badge' }, r.src) : null, admin ? h('span', { class: 'badge' }, '投稿者：' + (Subs.names[r.uid] || '（名稱不公開）')) : null));
      D.ap(h('h3', null, r.title || '（無標題）'));
      if (r.replaces) { const orig = window.KB_ITEMS.find((k) => k.id === r.replaces); D.ap(h('p', { class: 'small alert' }, '這是對原有條目「' + (orig ? orig.title : r.replaces) + '」的修改建議。核准後會以修訂版取代原文。')); }
      if (r.status === 'rejected' && r.reason) D.ap(h('p', { class: 'small alert' }, h('b', null, '退回原因：'), r.reason));
      if ((r.tags || []).length) D.ap(h('div', { class: 'chips', style: { margin: '6px 0' } }, r.tags.map((t) => h('span', { class: 'chip sm' }, '#' + t))));
      const body = h('div', { class: 'prose', html: KB.md(r.body || '') }); D.ap(body); KB.bindRefs(body);
      const links = [];
      (r.muscles || []).forEach((x) => MU[x] && links.push(h('span', { class: 'chip' }, MU[x].name)));
      (r.points || []).forEach((x) => PT[x] && links.push(h('span', { class: 'chip' }, PT[x].name)));
      (r.regions || []).forEach((x) => NODE[x] && links.push(h('span', { class: 'chip' }, '↔ ' + NODE[x].name)));
      if (links.length) D.ap(h('div', { class: 'chips', style: { marginTop: '8px' } }, links));
      const draft = () => ({ title: r.title, cat: r.cat, src: r.src, body: r.body, muscles: r.muscles || [], points: r.points || [], regions: r.regions || [], tags: r.tags || [], replaces: r.replaces || undefined });
      D.ap(h('hr', { class: 'thin' }));
      if (admin && r.status === 'pending') {
        const reason = h('input', { class: 'inp', style: { flex: '1 1 200px' }, placeholder: '退回原因（會給投稿者看）', 'aria-label': '退回原因' });
        D.ap(h('div', { class: 'row' },
          h('button', { class: 'btn pri', onclick: async () => { const note = Object.assign(draft(), { from: r.uid + '/' + r.sid }); if (r.replaces) { const ex = Notes.list.find((x) => x.replaces === r.replaces); if (ex) note.id = ex.id; } if (await Notes.save(note)) { await Subs.setStatus(r.uid, r.sid, 'approved', '', note.id); toast('已核准並發佈'); } } }, '核准發佈'),
          h('button', { class: 'btn', onclick: () => KB.edit(Object.assign(draft(), { _from: { uid: r.uid, sid: r.sid } })) }, '編輯後發佈')),
          h('div', { class: 'row', style: { marginTop: '8px' } }, reason, h('button', { class: 'btn', onclick: async () => { if (await Subs.setStatus(r.uid, r.sid, 'rejected', reason.value.trim())) toast('已退回'); } }, '退回')));
      } else if (admin) {
        D.ap(h('div', { class: 'row' }, r.noteId ? h('button', { class: 'btn sm', onclick: () => KB.openNote(r.noteId) }, '查看已發佈條目') : null, h('span', { class: 'sp' }),
          h('button', { class: 'btn sm', onclick: async (e) => { const b = e.currentTarget; if (b.dataset.armed) { if (await Subs.purge(r.uid, r.sid)) { toast('已從佇列移除'); KB.selId = null; } } else { b.dataset.armed = '1'; b.textContent = '再按一次確認移除'; } } }, '從佇列移除')));
      } else {
        D.ap(h('div', { class: 'row' },
          r.status !== 'approved' ? h('button', { class: 'btn pri', onclick: () => KB.edit(Object.assign(draft(), { sid: r.sid, via: r.via })) }, r.status === 'rejected' ? '修改後重新送出' : '修改') : h('button', { class: 'btn', onclick: () => KB.openNote(r.noteId) }, '查看已發佈條目'),
          h('span', { class: 'sp' }),
          h('button', { class: 'btn sm', onclick: async (e) => { const b = e.currentTarget; if (b.dataset.armed) { if (await Subs.withdraw(r.sid)) { toast('已刪除投稿'); KB.selId = null; } } else { b.dataset.armed = '1'; b.textContent = '再按一次確認刪除'; } } }, r.status === 'pending' ? '撤回' : '刪除')));
      }
    },
  };

  // =====================================================================
  //  逐字稿（課堂錄音，依堂次／部位／知識點分類）
  // =====================================================================
  const TX = {
    data: null, p: null, failed: false, lec: '全部', part: '全部', topic: '全部', limit: 60,
    load() {
      if (this.p) return this.p;
      this.p = fetch('transcripts.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
        this.data = d; this.failed = !d;
        if (curTab === 'kb' && KB.list) { KB.renderFilters(); KB.renderList(); if (!KB.editing) KB.renderDetail(); }
        return d;
      });
      return this.p;
    },
    lecName(id) { const L = this.data && this.data.lecs.find((x) => x.id === id); return L ? L.date + (L.part ? '－' + L.part : '') : id; },
    fmt(t) { return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); },
    filtered(q, ignore) {
      if (!this.data) return [];
      const terms = (q || '').split(/\s+/).filter(Boolean);
      return this.data.segs.filter((s) => (ignore || ((this.lec === '全部' || s.lec === this.lec)
        && (this.part === '全部' || s.p.includes(this.part))
        && (this.topic === '全部' || (this.topic === '未分類' ? !s.p.length && !s.k.length : s.k.includes(this.topic)))))
        && terms.every((t) => s.x.includes(t)));
    },
    renderFilters(F) {
      if (!this.data) { F.ap(h('span', { class: 'small muted' }, this.failed ? '逐字稿載入失敗。' : '載入逐字稿…')); return; }
      const re = () => { KB.selId = null; this.limit = 60; KB.renderFilters(); KB.renderList(); KB.renderDetail(); };
      F.ap(h('label', { class: 'small tx-sel' }, '堂次 ', h('select', { onchange: (e) => { this.lec = e.target.value; re(); } }, h('option', { value: '全部' }, '全部 ' + ((this.data && this.data.lecs) || []).length + ' 段'), this.data.lecs.map((L) => h('option', { value: L.id, selected: this.lec === L.id }, this.lecName(L.id) + '（' + Math.round(L.dur / 60) + ' 分）')))));
      F.ap(h('span', { class: 'small muted tx-lab' }, '部位'));
      ['全部'].concat(this.data.parts).forEach((p) => F.ap(h('button', { class: 'chip sm' + (this.part === p ? ' on' : ''), onclick: () => { this.part = p; re(); } }, p)));
      F.ap(h('span', { class: 'small muted tx-lab' }, '知識點'));
      ['全部'].concat(this.data.topics, ['未分類']).forEach((p) => F.ap(h('button', { class: 'chip sm' + (this.topic === p ? ' on' : ''), onclick: () => { this.topic = p; re(); } }, p)));
    },
    preview(s) {
      const terms = KB.q.split(/\s+/).filter(Boolean); let i = terms.length ? s.x.indexOf(terms[0]) : -1;
      const a = i > 40 ? i - 40 : 0; return (a ? '…' : '') + s.x.slice(a, a + 120) + (s.x.length > a + 120 ? '…' : '');
    },
    renderList(L) {
      if (!this.data) { L.ap(h('div', { class: 'empty' }, this.failed ? '逐字稿載入失敗，請重新整理頁面。' : '載入逐字稿…')); return; }
      const segs = this.filtered(KB.q);
      $('#kb-count').textContent = '逐字稿 ' + segs.length + ' 段';
      L.ap(h('p', { class: 'small muted tx-note' }, '自動語音辨識的逐字稿，錯字很多，適合用來「找老師在哪一段講過」再對照錄音；整理好的重點請看知識條目。標籤由關鍵字自動判斷。'));
      if (!segs.length) { L.ap(h('div', { class: 'empty' }, '沒有符合的段落。')); return; }
      segs.slice(0, this.limit).forEach((s) => {
        const id = 'tx:' + s.id;
        const b = h('button', { class: 'kb-item tx' + (KB.selId === id ? ' on' : ''), onclick: () => KB.pick(id, b) },
          h('h4', null, h('span', { class: 'mono' }, this.lecName(s.lec)), '　', h('span', { class: 'mono muted' }, this.fmt(s.t))),
          h('p', { html: KB.hl(this.preview(s)) }),
          h('div', { class: 'kb-meta' }, s.p.map((p) => h('span', { class: 'badge j' }, p)), s.k.map((k) => h('span', { class: 'badge' }, k))));
        L.ap(b);
      });
      if (segs.length > this.limit) L.ap(h('button', { class: 'btn', style: { width: '100%' }, onclick: () => { this.limit += 60; KB.renderList(); } }, '再顯示 60 段（共 ' + segs.length + ' 段）'));
    },
    kbOf(lec) { const code = lec.slice(0, 4); return window.KB_ITEMS.filter((k) => String(k.src || '').includes(code)); },
    renderDetail(D, selId) {
      if (!this.data) { D.ap(h('p', { class: 'small muted' }, '載入逐字稿…')); return; }
      const s = selId && selId.startsWith('tx:') ? this.data.segs.find((x) => 'tx:' + x.id === selId) : null;
      if (!s) {
        D.ap(h('div', { class: 'eyebrow' }, '逐字稿'), h('h3', null, ((this.data && this.data.lecs) || []).length + ' 段課堂錄音'), h('p', { class: 'small' }, '每段約 1.5 分鐘，依關鍵字自動標上部位與知識點。點一堂課可以只看那一堂。'));
        const G = h('div', { class: 'tx-lecs' });
        this.data.lecs.forEach((L) => G.ap(h('button', { class: 'tx-lec' + (this.lec === L.id ? ' on' : ''), onclick: () => { this.lec = L.id; KB.selId = null; KB.renderFilters(); KB.renderList(); KB.renderDetail(); } },
          h('b', { class: 'mono' }, this.lecName(L.id)), h('span', { class: 'small muted' }, Math.round(L.dur / 60) + ' 分・' + L.n + ' 段・知識條目 ' + this.kbOf(L.id).length),
          h('span', { class: 'small' }, L.p.slice(0, 3).join('、')), h('span', { class: 'small muted' }, L.k.slice(0, 3).join('、')))));
        D.ap(G); return;
      }
      const same = this.data.segs.filter((x) => x.lec === s.lec); const i = same.indexOf(s);
      D.ap(h('div', { class: 'row' }, h('span', { class: 'badge j' }, '逐字稿'), h('span', { class: 'badge mono' }, this.lecName(s.lec) + '　' + this.fmt(s.t)), h('span', { class: 'sp' }),
        h('button', { class: 'btn sm', disabled: i <= 0, onclick: () => { KB.selId = 'tx:' + same[i - 1].id; KB.renderDetail(); } }, '‹ 上一段'),
        h('button', { class: 'btn sm', disabled: i >= same.length - 1, onclick: () => { KB.selId = 'tx:' + same[i + 1].id; KB.renderDetail(); } }, '下一段 ›')));
      D.ap(h('h3', { style: { marginTop: '6px' } }, '課堂 ' + this.lecName(s.lec) + '・' + this.fmt(s.t) + ' 起'));
      if (s.p.length || s.k.length) D.ap(h('div', { class: 'chips', style: { margin: '6px 0' } }, s.p.map((p) => h('button', { class: 'chip sm', onclick: () => { this.part = p; this.topic = '全部'; KB.selId = null; KB.renderFilters(); KB.renderList(); KB.renderDetail(); } }, p)), s.k.map((k) => h('button', { class: 'chip sm', onclick: () => { this.topic = k; this.part = '全部'; KB.selId = null; KB.renderFilters(); KB.renderList(); KB.renderDetail(); } }, '#' + k))));
      D.ap(h('div', { class: 'prose tx-text', html: KB.hl(s.x) }));
      const kb = this.kbOf(s.lec);
      if (kb.length) D.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, '這堂課整理出的知識條目'), h('div', { class: 'chips', style: { marginTop: '6px' } }, kb.map((k) => h('button', { class: 'chip', onclick: () => KB.open(k.id) }, k.title))));
      if (Auth.canPublish() || Auth.canSubmit()) D.ap(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => KB.edit(KB.blank({ src: '逐字稿 ' + this.lecName(s.lec) + ' ' + this.fmt(s.t), body: s.x, tags: s.p.concat(s.k) })) }, Auth.canPublish() ? '用這段起草知識條目' : '用這段投稿知識條目'), h('span', { class: 'small muted' }, '起草後可按「AI 整理文字」修正錯字')));
    },
    termsOf(it) {
      const set = new Set();
      String(it.title || '').split(/[\s、，,（）()「」『』／/：:・\-—？?！!]+/).forEach((w) => { if (w.length >= 2 && w.length <= 6) set.add(w); });
      (it.tags || []).forEach((t) => t.length >= 2 && set.add(t));
      (it.muscles || []).forEach((m) => MU[m] && set.add(MU[m].name.replace(/（.*/, '')));
      if (this.data) { const hay = it.title + ' ' + String(it.body || '').slice(0, 400); Object.values(this.data.kw.p).concat(Object.values(this.data.kw.k)).forEach((ks) => ks.forEach((k) => { if (k.length >= 2 && hay.includes(k)) set.add(k); })); }
      return [...set];
    },
    related(terms, src) {
      if (!this.data || !terms.length) return [];
      const code = (String(src || '').match(/\d{4}/) || [])[0];
      return this.data.segs.map((s) => { let sc = 0; const hit = new Set(); terms.forEach((t) => { const c = s.x.split(t).length - 1; if (c) { sc += Math.min(c, 3); hit.add(t); } }); if (hit.size > 1) sc += hit.size; if (code && s.lec.startsWith(code) && sc) sc += 1.5; return { s, sc }; })
        .filter((x) => x.sc >= 3).sort((a, b) => b.sc - a.sc).slice(0, 3).map((x) => x.s);
    },
    relatedBlock(D, terms, src) {
      if (!this.data) return;
      const segs = this.related(terms, src); if (!segs.length) return;
      D.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, '相關逐字稿（自動比對）'),
        h('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } }, segs.map((s) => h('button', { class: 'tx-mini', onclick: () => { KB.q = ''; const i = $('#kb-q'); if (i) i.value = ''; this.lec = '全部'; this.part = '全部'; this.topic = '全部'; KB.src = '逐字稿'; KB.selId = 'tx:' + s.id; KB.renderFilters(); KB.renderList(); KB.renderDetail(); } },
          h('span', { class: 'mono small' }, this.lecName(s.lec) + ' ' + this.fmt(s.t)), h('span', { class: 'small muted' }, s.x.slice(0, 70) + '…')))));
    },
  };

  // =====================================================================
  //  6. 個案紀錄（只有本人看得到：data/users/<自己的 id>/）
  // =====================================================================
  const WD = '日一二三四五六';
  const pad2 = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const parseLocal = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; };
  function apptLabel(s) {
    const d = parseLocal(s); if (!d) return '';
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); const d0 = new Date(d); d0.setHours(0, 0, 0, 0);
    const diff = Math.round((d0 - t0) / 864e5);
    const rel = diff === 0 ? '今天' : diff === 1 ? '明天' : diff === 2 ? '後天' : diff > 0 ? diff + ' 天後' : '已過 ' + -diff + ' 天';
    return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WD[d.getDay()] + '）' + (/T/.test(s) ? ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '') + '・' + rel;
  }
  const Cases = {
    list: [], others: [], scope: 'mine', loadingAll: false, mode: 'loading', sel: null, editing: null, visitEdit: null, q: '', mask: store.get('caseMask', false), unsub: null, built: false, pending: null, writeFail: false,
    key() { return 'cases_' + (Auth.id || 'dev'); },
    init() {
      if (this.unsub) { try { this.unsub(); } catch (e) { } this.unsub = null; }
      const r = Auth.role();
      if (r === 'loading') this.mode = 'loading';
      else if (r === 'dev') { this.mode = 'local'; this.list = store.get(this.key(), []); }
      else if (!Auth.id || !Auth.db) { this.mode = 'locked'; this.list = []; }
      else if (store.get('caseLocal_' + Auth.id, false)) { this.mode = 'local'; this.list = store.get(this.key(), []); }
      else {
        this.mode = 'db';
        this.unsub = Auth.db.collection('data/users/' + Auth.id).onSnapshot((snap) => { this.list = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((c) => c.kind === 'case'); this.render(); }, () => { this.mode = 'error'; this.render(); });
      }
      this.render();
    },
    useLocal() { if (Auth.id) store.set('caseLocal_' + Auth.id, true); this.writeFail = false; this.init(); },
    async save(c) {
      c.kind = 'case'; c.updated = Date.now(); if (!c.created) c.created = c.updated;
      if (this.mode === 'db') {
        const body = JSON.parse(JSON.stringify(c)); delete body.id;
        try {
          if (c.id) await Auth.db.doc('data/users/' + Auth.id + '/' + c.id).set(body);
          else { const r = await Auth.db.collection('data/users/' + Auth.id).add(body); c.id = r.id; }
          return true;
        } catch (e) {
          if (e && e.code === 'invalid_argument') { Auth.ownWrite = false; Auth.emit(); this.writeFail = true; this.render(); toast('這個帳號無法把個案存到雲端'); return false; }
          if (e && e.code === 'quota_exceeded') { toast('個案資料空間已滿'); return false; }
          toast('儲存失敗，請稍後再試'); return false;
        }
      }
      if (this.mode !== 'local') return false;
      const L = store.get(this.key(), []); if (!c.id) c.id = 'c' + Date.now().toString(36);
      const i = L.findIndex((x) => x.id === c.id); if (i >= 0) L[i] = c; else L.push(c);
      store.set(this.key(), L); this.list = L; return true;
    },
    async remove(id) {
      if (this.mode === 'db') { try { await Auth.db.doc('data/users/' + Auth.id + '/' + id).delete(); return true; } catch (e) { toast('刪除失敗'); return false; } }
      const L = store.get(this.key(), []).filter((x) => x.id !== id); store.set(this.key(), L); this.list = L; return true;
    },
    nm(c) { const n = c.name || '（未命名）'; return this.mask ? n.slice(0, 1) + '○'.repeat(Math.max(1, Math.min(2, n.length - 1))) : n; },
    ph(c) { const p = c.phone || ''; return this.mask && p ? '••••' + p.replace(/\D/g, '').slice(-3) : p; },
    cur() { return this.scope === 'all' ? this.others : this.list; },
    get(id) { return this.cur().find((c) => c.id === id) || null; },
    ro(c) { return !!(c && c._uid && c._uid !== Auth.id); },
    async loadAll() {
      if (!FB || !Auth.isAdmin) return;
      this.loadingAll = true; this.render();
      try {
        const ps = await BACKEND.listProfiles(); const out = [];
        await Promise.all(ps.map(async (p) => { try { (await BACKEND.casesOf(p.id)).filter((c) => c.kind === 'case').forEach((c) => out.push(Object.assign(c, { _uid: p.id, _owner: p.name || p.email || '會員' }))); } catch (e) { } }));
        this.others = out;
      } catch (e) { toast('讀取會員個案失敗'); }
      this.loadingAll = false; this.render();
    },
    setScope(sc, uid) { this.scope = sc; this.sel = null; this.editing = null; this.visitEdit = null; this.ownerFilter = uid || null; if (sc === 'all') this.loadAll(); else this.render(); },
    fromAssess() {
      this.pending = Assess.summary(); showTab('cases');
      if (this.sel && this.get(this.sel)) this.openVisit(this.get(this.sel)); else this.render();
      toast('選一位個案，評估結果會帶入就診紀錄');
    },
    openVisit(c, v) {
      this.editing = null; this.sel = c.id;
      this.visitEdit = v ? JSON.parse(JSON.stringify(v)) : { d: today(), path: this.pending ? this.pending.path : '', assess: this.pending ? this.pending.assess : '', treat: '', prog: '', next: c.appt || '', sync: true };
      this.render();
    },
    render() {
      const root = $('#p-cases'); if (!root) return;
      if (!this.built) {
        this.built = true;
        this.head = h('div', { class: 'sec-h' }); this.body = h('div');
        root.ap(this.head, h('p', { class: 'lead' }, FB ? '記錄客人的聯絡方式、約診時間、病理與處理進度。資料存在你的帳號底下，只有你和網站管理員看得到。' : '記錄客人的聯絡方式、約診時間、病理與處理進度。資料存在你自己的帳號底下，頁面擁有者與其他管理員都看不到。'), this.body);
      }
      const H = clear(this.head);
      H.ap(h('h2', null, '個案紀錄'),
        this.mode === 'db' ? h('span', { class: 'badge j' }, FB ? '雲端・你和管理員看得到' : '雲端・只有你看得到') : this.mode === 'local' ? h('span', { class: 'badge y' }, Auth.dev ? '本機模式' : '只存在這台裝置') : null,
        h('span', { class: 'sp' }),
        this.mode === 'db' || this.mode === 'local' ? h('label', { class: 'small row', style: { gap: '6px' } }, h('input', { type: 'checkbox', checked: this.mask, onchange: (e) => { this.mask = e.target.checked; store.set('caseMask', this.mask); this.render(); } }), '遮蔽姓名電話') : null);
      const B = clear(this.body);
      if (this.mode === 'loading') { B.ap(h('div', { class: 'empty' }, '確認身分中…')); return; }
      if (this.mode === 'locked') {
        B.ap(h('div', { class: 'lock-card' }, h('div', { class: 'lock-ic', 'aria-hidden': 'true' }, '鎖'), h('h3', null, '登入後才能使用個案紀錄'),
          h('p', { class: 'small' }, FB ? '個案資料包含客人姓名與電話，必須登入才能使用（Google 帳號，第一次登入即註冊）。資料只有你和網站管理員看得到。' : '個案資料包含客人姓名與電話，必須登入 claude.ai 帳號才能使用，而且只存在你自己的帳號底下，其他人（包括頁面擁有者）都看不到。'),
          FB ? h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: () => BACKEND.signIn().catch(() => toast('登入失敗')) }, '用 Google 帳號登入')) : null,
          h('p', { class: 'small muted' }, '評估、連鎖、模擬、3D 與知識庫不需登入即可使用。')));
        return;
      }
      if (this.mode === 'error') { B.ap(h('div', { class: 'alert' }, '暫時無法讀取個案資料，請重新整理頁面。')); return; }
      if (this.writeFail && this.mode === 'db') B.ap(h('div', { class: 'alert', style: { marginBottom: '12px' } }, h('b', null, '無法存到雲端：'), '你的帳號對這個頁面只有檢視權限。可以改存在這台裝置的瀏覽器（換裝置或清除瀏覽資料就會消失），或請頁面擁有者把你加為「Contributor／參與者」。 ',
        h('button', { class: 'btn sm', onclick: () => this.useLocal() }, '改存在這台裝置')));
      if (this.pending) B.ap(h('div', { class: 'alert info', style: { marginBottom: '12px' } }, h('b', null, '有一份評估結果待存入：'), '點選個案（或新增個案）後，就診紀錄會自動帶入。 ', h('button', { class: 'link small', onclick: () => { this.pending = null; this.render(); } }, '取消')));
      const left = h('div', { class: 'card pad case-side' }); const right = h('div', { class: 'card pad case-main' });
      B.ap(h('div', { class: 'case-layout' }, left, right));
      this.renderSide(left); this.renderMain(right);
    },
    renderSide(L) {
      if (FB && Auth.isAdmin) L.ap(h('div', { class: 'seg', role: 'tablist', style: { marginBottom: '10px' } },
        h('button', { class: this.scope === 'mine' ? 'on' : '', onclick: () => this.setScope('mine') }, '我的個案'),
        h('button', { class: this.scope === 'all' ? 'on' : '', onclick: () => this.setScope('all') }, '所有會員（管理員）')));
      if (this.scope === 'all') {
        L.ap(h('input', { class: 'fsearch', placeholder: '搜尋姓名、電話、病理、會員…', value: this.q, oninput: (e) => { this.q = e.target.value.trim(); this.drawList(); } }));
        if (this.ownerFilter) L.ap(h('div', { class: 'small row', style: { gap: '6px', marginBottom: '6px' } }, '只看：' + ((this.others.find((c) => c._uid === this.ownerFilter) || {})._owner || '指定會員'), h('button', { class: 'link small', onclick: () => { this.ownerFilter = null; this.drawList(); } }, '顯示全部')));
        this.listEl = h('div'); L.ap(this.listEl); this.drawList(); return;
      }
      L.ap(h('div', { class: 'row' }, h('input', { class: 'fsearch', style: { flex: '1 1 140px', margin: 0 }, placeholder: '搜尋姓名、電話、病理…', value: this.q, oninput: (e) => { this.q = e.target.value.trim(); this.drawList(); } }),
        h('button', { class: 'btn pri', onclick: () => { this.sel = null; this.visitEdit = null; this.editing = { name: '', phone: '', appt: '', lastPath: '', progress: '', note: '', visits: [] }; this.render(); } }, '＋ 新個案')));
      this.listEl = h('div'); L.ap(this.listEl); this.drawList();
    },
    drawList() {
      const E = clear(this.listEl); const q = this.q; const all = this.scope === 'all';
      const hit = (c) => (!all || !this.ownerFilter || c._uid === this.ownerFilter) && (!q || [c.name, c.phone, c.lastPath, c.progress, c.note, c._owner].some((x) => String(x || '').includes(q)));
      if (all && this.loadingAll) { E.ap(h('p', { class: 'small muted' }, '讀取所有會員的個案…')); return; }
      const src = this.cur();
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const up = src.filter((c) => { const d = parseLocal(c.appt); return d && d >= now && (d - now) / 864e5 <= 31; }).filter(hit).sort((a, b) => parseLocal(a.appt) - parseLocal(b.appt));
      if (up.length) {
        E.ap(h('div', { class: 'eyebrow', style: { margin: '12px 0 6px' } }, '近期約診'));
        up.forEach((c) => E.ap(h('button', { class: 'case-item appt' + (this.sel === c.id ? ' on' : ''), onclick: () => this.open(c.id) }, h('span', { class: 'when mono' }, apptLabel(c.appt)), h('b', null, this.nm(c)), c._owner ? h('span', { class: 'small muted' }, '・' + c._owner) : null)));
      }
      const rows = src.filter(hit).sort((a, b) => (b.updated || 0) - (a.updated || 0));
      E.ap(h('div', { class: 'eyebrow', style: { margin: '14px 0 6px' } }, (all ? '所有會員的個案（' : '全部個案（') + rows.length + '）'));
      if (!src.length) { E.ap(h('p', { class: 'small muted' }, all ? '目前沒有任何會員的個案。' : '還沒有個案。按「＋ 新個案」建立第一筆。')); return; }
      rows.forEach((c) => { const lv = (c.visits || [])[0];
        E.ap(h('button', { class: 'case-item' + (this.sel === c.id ? ' on' : ''), onclick: () => this.open(c.id) },
          h('div', { class: 'row', style: { gap: '8px' } }, h('b', null, this.nm(c)), h('span', { class: 'small muted mono' }, this.ph(c)), c._owner ? h('span', { class: 'badge' }, c._owner) : null, h('span', { class: 'sp' }), lv ? h('span', { class: 'small muted mono' }, lv.d.slice(5).replace('-', '/')) : null),
          c.lastPath ? h('div', { class: 'small muted clip' }, c.lastPath) : null)); });
    },
    open(id) { this.sel = id; this.editing = null; const c = this.get(id); if (this.pending && c && !this.ro(c)) { this.openVisit(c); return; } this.visitEdit = null; this.render(); if (window.innerWidth < 900) setTimeout(() => $('.case-main') && $('.case-main').scrollIntoView({ behavior: 'smooth' }), 30); },
    renderMain(M) {
      if (this.editing) { this.renderForm(M); return; }
      const c = this.sel && this.get(this.sel);
      if (!c) {
        M.ap(h('div', { class: 'eyebrow' }, '個案'), h('h3', null, '選一位個案，或新增一位'),
          h('ul', { class: 'small' }, h('li', null, '基本資料：姓名、手機、下次約診時間'), h('li', null, '上次病理與目前處理進度（每次就診後更新）'), h('li', null, '就診紀錄：每次的主訴、處理內容與進度，可從「評估」頁一鍵帶入判讀結果')),
          h('p', { class: 'small muted' }, this.mode === 'db' ? (FB ? '資料存在你的帳號底下，只有你和網站管理員看得到。給客人看螢幕時可勾「遮蔽姓名電話」。' : '資料存在你自己的帳號底下（data/users/你），連頁面擁有者也看不到。給客人看螢幕時可勾「遮蔽姓名電話」。') : '資料只存在這台裝置的瀏覽器。'));
        return;
      }
      const tel = String(c.phone || '').replace(/[^\d+]/g, ''); const ro = this.ro(c);
      if (ro) M.ap(h('p', { class: 'small alert info', style: { marginBottom: '8px' } }, '這是會員「' + c._owner + '」的個案（管理員唯讀檢視）。'));
      M.ap(h('div', { class: 'row' }, h('h3', { style: { fontSize: '22px' } }, this.nm(c)), h('span', { class: 'sp' }),
        ro ? null : h('button', { class: 'btn sm', onclick: () => { this.editing = JSON.parse(JSON.stringify(c)); this.visitEdit = null; this.render(); } }, '編輯資料')));
      M.ap(h('dl', { class: 'kv' },
        h('dt', null, '手機'), h('dd', null, c.phone ? [this.ph(c), tel && !this.mask ? h('a', { class: 'link small', href: 'tel:' + tel, style: { marginLeft: '8px' } }, '撥打') : null] : '—'),
        h('dt', null, '下次約診'), h('dd', null, c.appt ? h('b', null, apptLabel(c.appt)) : '—'),
        h('dt', null, '上次病理'), h('dd', { class: 'pre' }, c.lastPath || '—'),
        h('dt', null, '處理進度'), h('dd', { class: 'pre' }, c.progress || '—'),
        c.note ? h('dt', null, '備註') : null, c.note ? h('dd', { class: 'pre' }, c.note) : null));
      if (!ro) M.ap(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn pri', onclick: () => this.openVisit(c) }, '＋ 新增就診紀錄'), h('button', { class: 'btn', onclick: () => { this.pending = Assess.summary(); this.openVisit(c); } }, '帶入目前評估結果')));
      if (this.visitEdit) this.renderVisitForm(M, c);
      const vs = (c.visits || []);
      M.ap(h('hr', { class: 'thin' }), h('div', { class: 'eyebrow' }, '就診紀錄（' + vs.length + '）'));
      if (!vs.length) M.ap(h('p', { class: 'small muted' }, '還沒有就診紀錄。'));
      vs.forEach((v, i) => M.ap(h('div', { class: 'visit' },
        h('div', { class: 'row' }, h('b', { class: 'mono' }, v.d), h('span', { class: 'small muted' }, '（' + WD[(parseLocal(v.d) || new Date()).getDay()] + '）'), h('span', { class: 'sp' }),
          ro ? null : h('button', { class: 'link small', onclick: () => { this.visitEdit = Object.assign({ i, sync: false }, JSON.parse(JSON.stringify(v))); this.render(); } }, '修改')),
        v.path ? h('p', { class: 'small pre' }, h('b', null, '主訴／病理：'), v.path) : null,
        v.assess ? h('p', { class: 'small pre muted' }, v.assess) : null,
        v.treat ? h('p', { class: 'small pre' }, h('b', null, '處理：'), v.treat) : null,
        v.prog ? h('p', { class: 'small pre' }, h('b', null, '進度／下次重點：'), v.prog) : null)));
      if (!ro) M.ap(h('div', { class: 'row', style: { marginTop: '16px' } }, h('span', { class: 'sp' }),
        h('button', { class: 'btn sm', onclick: async (e) => { const b = e.currentTarget; if (b.dataset.armed) { if (await this.remove(c.id)) { toast('已刪除個案'); this.sel = null; this.render(); } } else { b.dataset.armed = '1'; b.textContent = '再按一次確認刪除「' + this.nm(c) + '」'; b.style.color = 'var(--tight)'; } } }, '刪除個案')));
    },
    renderVisitForm(M, c) {
      const v = this.visitEdit;
      const ta = (k, lab, ph) => h('label', null, lab, h('textarea', { rows: 3, placeholder: ph || '', oninput: (e) => (v[k] = e.target.value) }, v[k] || ''));
      const f = h('form', { class: 'form visit-form', onsubmit: async (e) => {
        e.preventDefault();
        const vv = { d: v.d || today(), path: v.path || '', assess: v.assess || '', treat: v.treat || '', prog: v.prog || '' };
        const cc = JSON.parse(JSON.stringify(c)); cc.visits = cc.visits || [];
        if (v.i != null) cc.visits[v.i] = vv; else cc.visits.push(vv);
        cc.visits.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
        if (v.sync) { if (vv.path) cc.lastPath = vv.path; if (vv.prog) cc.progress = vv.prog; }
        if (v.next !== undefined) cc.appt = v.next || '';
        if (await this.save(cc)) { toast('已儲存就診紀錄'); this.visitEdit = null; this.pending = null; this.render(); }
      } });
      f.ap(h('div', { class: 'eyebrow' }, v.i != null ? '修改就診紀錄' : '新增就診紀錄'),
        h('div', { class: 'row' }, h('label', { style: { flex: '1 1 140px' } }, '日期', h('input', { type: 'date', value: v.d, oninput: (e) => (v.d = e.target.value) })),
          h('label', { style: { flex: '1 1 200px' } }, '下次約診', h('input', { type: 'datetime-local', value: v.next || '', oninput: (e) => (v.next = e.target.value) }))),
        ta('path', '主訴／病理', '例如：右下背痛三天，久坐加劇；右 PSIS 高'),
        v.assess ? ta('assess', '評估判讀（自動帶入，可修改）') : null,
        ta('treat', '處理內容', '例如：放鬆右腰方肌、髂腰肌；調整第一角度 A'),
        ta('prog', '進度／下次重點', '例如：疼痛 7→3；下次檢查長短腳'),
        h('label', { class: 'small row', style: { gap: '6px' } }, h('input', { type: 'checkbox', checked: !!v.sync, onchange: (e) => (v.sync = e.target.checked) }), '同時更新「上次病理」與「處理進度」'),
        h('div', { class: 'row' }, h('button', { class: 'btn pri', type: 'submit' }, '儲存'), h('button', { class: 'btn', type: 'button', onclick: () => { this.visitEdit = null; this.render(); } }, '取消'),
          h('span', { class: 'sp' }), v.i != null ? h('button', { class: 'btn sm', type: 'button', onclick: async () => { const cc = JSON.parse(JSON.stringify(c)); cc.visits.splice(v.i, 1); if (await this.save(cc)) { this.visitEdit = null; toast('已刪除這筆紀錄'); this.render(); } } }, '刪除這筆') : null));
      M.ap(f);
    },
    renderForm(M) {
      const c = this.editing;
      const inp = (k, lab, attrs) => h('label', null, lab, h('input', Object.assign({ value: c[k] || '', autocomplete: 'off', oninput: (e) => (c[k] = e.target.value) }, attrs || {})));
      const ta = (k, lab, ph) => h('label', null, lab, h('textarea', { rows: 3, placeholder: ph || '', oninput: (e) => (c[k] = e.target.value) }, c[k] || ''));
      const f = h('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault(); if (!String(c.name || '').trim()) { toast('請輸入姓名'); return; }
        c.name = c.name.trim(); const isNew = !c.id;
        if (isNew && this.pending) { c.visits = [{ d: today(), path: this.pending.path, assess: this.pending.assess, treat: '', prog: '' }]; if (!c.lastPath) c.lastPath = this.pending.path; this.pending = null; }
        if (await this.save(c)) { toast(isNew ? '已建立個案' : '已儲存'); this.sel = c.id; this.editing = null; this.render(); }
      } });
      f.ap(h('div', { class: 'eyebrow' }, c.id ? '編輯個案' : '新個案'),
        h('div', { class: 'row' }, h('div', { style: { flex: '1 1 160px' } }, inp('name', '姓名', { required: true, placeholder: '王小明' })), h('div', { style: { flex: '1 1 160px' } }, inp('phone', '手機', { type: 'tel', inputmode: 'tel', placeholder: '0912-345-678' }))),
        inp('appt', '下次約診時間', { type: 'datetime-local' }),
        ta('lastPath', '上次病理', '例如：右側坐骨神經痛，第三角度 IN'),
        ta('progress', '處理進度', '例如：第 3 次，疼痛減半；需加強臀中肌'),
        ta('note', '備註（禁忌、過敏、偏好力道…）'),
        this.pending && !c.id ? h('p', { class: 'small muted' }, '建立後會自動加入一筆今天的就診紀錄（含評估結果）。') : null,
        h('div', { class: 'row' }, h('button', { class: 'btn pri', type: 'submit' }, '儲存'), h('button', { class: 'btn', type: 'button', onclick: () => { this.editing = null; this.render(); } }, '取消')));
      M.ap(f);
    },
  };

  // =====================================================================
  //  7. 會員後台（Firebase 版；擁有者與管理員）
  // =====================================================================
  const fmtTime = (t) => { if (!t) return '—'; const d = new Date(t); return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const ROLE_NAME = { owner: '擁有者', admin: '管理員', member: '會員', blocked: '已停用' };
  const Admin = {
    rows: [], loading: false, loaded: false, q: '', sort: 'last', err: '', caseN: {},
    roleOf(uid) { if (BACKEND && uid === BACKEND.ownerUid) return 'owner'; const r = BACKEND.roles(); if ((r.admins || []).includes(uid)) return 'admin'; if ((r.blocked || []).includes(uid)) return 'blocked'; return 'member'; },
    async load() {
      if (!FB || !Auth.isAdmin) { this.render(); return; }
      this.loading = true; this.err = ''; this.render();
      try { this.rows = await BACKEND.listProfiles(); } catch (e) { this.err = '讀取會員資料失敗：' + (e && e.message || e); }
      this.loading = false; this.loaded = true; this.render();
      // 個案數（背景載入）
      Promise.all(this.rows.map(async (p) => { try { this.caseN[p.id] = (await BACKEND.casesOf(p.id)).filter((c) => c.kind === 'case').length; } catch (e) { } })).then(() => this.render());
    },
    async setRole(uid, role) {
      try { await BACKEND.setRole(uid, role); toast('已將權限改為「' + ROLE_NAME[role] + '」'); } catch (e) { toast('變更失敗：' + (e && e.message || e)); }
      this.render();
    },
    render() {
      const root = $('#p-admin'); if (!root) return; clear(root);
      root.ap(h('div', { class: 'sec-h' }, h('h2', null, '會員後台'), h('span', { class: 'muted small' }, this.rows.length ? this.rows.length + ' 位會員' : ''), h('span', { class: 'sp' }),
        FB && Auth.isAdmin ? h('button', { class: 'btn sm', onclick: () => this.load() }, '重新整理') : null));
      if (!FB || !Auth.isAdmin) { root.ap(h('div', { class: 'lock-card' }, h('div', { class: 'lock-ic' }, '鎖'), h('h3', null, '只有管理員可以使用後台'))); return; }
      root.ap(h('p', { class: 'lead' }, '會員用 Google 帳號登入即自動註冊。你可以在這裡看每位會員的基本資料與登入時間、調整權限，並查看他們的投稿與個案。'));
      if (this.err) root.ap(h('div', { class: 'alert' }, this.err));
      if (this.loading && !this.loaded) { root.ap(h('div', { class: 'empty' }, '讀取會員資料…')); return; }
      const now = Date.now(); const week = this.rows.filter((p) => now - (p.lastLogin || 0) < 7 * 864e5).length;
      const subsBy = {}; Subs.all.forEach((u) => (subsBy[u.uid] = Object.values(u.items)));
      const totalCases = Object.values(this.caseN).reduce((a, b) => a + b, 0);
      root.ap(h('div', { class: 'stat-row' },
        [['會員', this.rows.length], ['管理員', this.rows.filter((p) => ['owner', 'admin'].includes(this.roleOf(p.id))).length], ['7 天內登入', week], ['待審核投稿', Subs.pendingCount()], ['個案總數', totalCases]].map(([k, v]) => h('div', { class: 'stat card pad' }, h('div', { class: 'eyebrow' }, k), h('b', null, v)))));
      root.ap(h('div', { class: 'row', style: { margin: '12px 0' } },
        h('input', { class: 'fsearch', style: { flex: '1 1 220px', margin: 0 }, placeholder: '搜尋姓名或 Email…', value: this.q, oninput: (e) => { this.q = e.target.value.trim(); this.drawList(); } }),
        h('label', { class: 'small row', style: { gap: '6px' } }, '排序', h('select', { class: 'inp', onchange: (e) => { this.sort = e.target.value; this.drawList(); } },
          [['last', '最近登入'], ['first', '最早註冊'], ['name', '姓名']].map(([v, t]) => h('option', { value: v, selected: this.sort === v }, t))))));
      this.listEl = h('div', { class: 'mem-list' }); root.ap(this.listEl); this.drawList();
      root.ap(h('p', { class: 'small muted', style: { marginTop: '14px' } }, '權限說明：管理員可直接發佈／修改知識條目、審核投稿、查看所有會員的個案並調整其他會員權限；會員可投稿與使用自己的個案紀錄；已停用的帳號只能瀏覽。擁有者固定為網站建立者，無法被變更。'));
    },
    drawList() {
      const E = clear(this.listEl); const q = this.q.toLowerCase();
      const subsBy = {}; Subs.all.forEach((u) => (subsBy[u.uid] = Object.values(u.items)));
      let rows = this.rows.filter((p) => !q || String(p.name || '').toLowerCase().includes(q) || String(p.email || '').toLowerCase().includes(q));
      rows.sort((a, b) => this.sort === 'name' ? String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant') : this.sort === 'first' ? (a.created || 0) - (b.created || 0) : (b.lastLogin || 0) - (a.lastLogin || 0));
      if (!rows.length) { E.ap(h('div', { class: 'empty' }, this.rows.length ? '沒有符合的會員。' : '還沒有會員登入過。')); return; }
      rows.forEach((p) => {
        const role = this.roleOf(p.id); const subs = subsBy[p.id] || []; const pend = subs.filter((x) => x.status === 'pending').length;
        const sel = h('select', { class: 'inp', 'aria-label': '權限', disabled: role === 'owner' || p.id === Auth.id, onchange: (e) => this.setRole(p.id, e.target.value) },
          (role === 'owner' ? ['owner'] : ['admin', 'member', 'blocked']).map((r) => h('option', { value: r, selected: role === r }, ROLE_NAME[r])));
        E.ap(h('div', { class: 'mem card pad' },
          h('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } },
            p.photo ? h('img', { class: 'mem-av', src: p.photo, alt: '', referrerpolicy: 'no-referrer' }) : h('span', { class: 'mem-av acct-av' }, (p.name || '?').slice(0, 1)),
            h('div', { style: { minWidth: 0, flex: '1 1 160px' } }, h('b', null, p.name || '（未提供姓名）'), p.id === Auth.id ? h('span', { class: 'badge j', style: { marginLeft: '6px' } }, '你') : null, h('div', { class: 'small muted clip' }, p.email || '')),
            h('span', { class: 'badge ' + (role === 'owner' || role === 'admin' ? 'j' : role === 'blocked' ? 't' : '') }, ROLE_NAME[role]), sel),
          h('dl', { class: 'kv mem-kv' },
            h('dt', null, '註冊'), h('dd', null, fmtTime(p.created)),
            h('dt', null, '最後登入'), h('dd', null, fmtTime(p.lastLogin) + (p.lastLogin ? '（' + relDays(p.lastLogin) + '）' : '')),
            h('dt', null, '登入次數'), h('dd', null, p.logins || 0),
            h('dt', null, '投稿'), h('dd', null, subs.length + ' 則' + (pend ? '（待審 ' + pend + '）' : '')),
            h('dt', null, '個案'), h('dd', null, this.caseN[p.id] == null ? '…' : this.caseN[p.id] + ' 位')),
          h('div', { class: 'row', style: { marginTop: '6px' } },
            h('button', { class: 'btn sm', onclick: () => { showTab('cases'); Cases.setScope('all', p.id); } }, '看個案'),
            subs.length ? h('button', { class: 'btn sm', onclick: () => { Subs.showDone = true; KB.openSource('審核佇列'); } }, '看投稿') : null)));
      });
    },
  };
  function relDays(t) { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? '今天' : d === 1 ? '昨天' : d + ' 天前'; }

  // =====================================================================
  //  啟動
  // =====================================================================
  function boot() {
    const nav = $('#tabs'); TABS.forEach(([id, n], i) => nav.ap(h('button', { class: 'tab', role: 'tab', 'data-tab': id, 'aria-selected': 'false', onclick: () => showTab(id) }, h('span', { class: 'n' }, '0' + (i + 1)), n, id === 'cases' ? h('span', { class: 'tab-lock', 'aria-hidden': 'true' }, '鎖') : null)));
    Assess.build($('#p-assess')); Chain.build($('#p-chain')); Sim.build($('#p-sim')); V3.build($('#p-v3d')); KB.build($('#p-kb'));
    Notes.listeners.push(() => { KB.renderList(); if (!KB.editing) KB.renderDetail(); Assess.renderRight(); });
    Subs.listeners.push(() => { if (curTab === 'admin' && Admin.loaded) Admin.render(); KB.renderFilters(); if (KB.special() === 'sub') { KB.renderList(); if (!KB.editing) KB.renderDetail(); } Acct.render(); });
    Auth.listeners.push(() => { Acct.render(); KB.refresh(); if (Cases.mode === 'loading' || (Cases.mode === 'db' && Auth.ownWrite === false && !Cases.writeFail)) Cases.init(); else Cases.render(); const t = $('.tab[data-tab="cases"] .tab-lock'); if (t) t.hidden = !!(Auth.id || Auth.dev); const at = $('.tab[data-tab="admin"]'); if (at) at.hidden = !(FB && Auth.isAdmin); if (curTab === 'admin') { if (FB && Auth.isAdmin) Admin.load(); else if (Auth.ready) showTab('assess'); } });
    document.addEventListener('click', () => { if (Acct.open) { Acct.open = false; Acct.render(); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && Acct.open) { Acct.open = false; Acct.render(); } });
    const hash = (location.hash || '').slice(1); const start = TABS.some((t) => t[0] === hash) ? hash : store.get('tab', 'assess');
    Acct.render();
    { const at = $('.tab[data-tab="admin"]'); if (at) at.hidden = true; }
    showTab(TABS.some((t) => t[0] === start) ? start : 'assess');
    Auth.init().then(() => { Notes.init(); Subs.init(); Cases.init(); });
  }
  window.APP = { Assess, Chain, Sim, V3, KB, Notes, Subs, Auth, Cases, TX, Admin, Compare, showTab };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
