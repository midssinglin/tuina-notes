/* ===== Firebase 後端（GitHub Pages 版）=====
 * 在這個版本裡，用 Firebase Auth（Google 登入）+ Firestore + Firebase AI Logic（Gemini）
 * 提供與 claude.ai 執行環境相同的 window.claude.use('db' | 'user' | 'sample') 介面，
 * 主程式 app.js 不需要知道自己跑在哪裡。另外提供 window.TN_BACKEND 給登入、後台使用。
 */
(function () {
  'use strict';
  const C = window.TN_FB; if (!C) return;
  const B = 'https://www.gstatic.com/firebasejs/' + (C.sdk || '12.19.0') + '/';
  let fb = null;

  const boot = (async () => {
    const [A, Au, F] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
    const app = A.initializeApp(C.config);
    const auth = Au.getAuth(app);
    const db = F.initializeFirestore(app, { ignoreUndefinedProperties: true });
    const user = await new Promise((res) => { const un = Au.onAuthStateChanged(auth, (u) => { un(); res(u); }); });
    const roles = { admins: [], blocked: [] };
    try { const r = await F.getDoc(F.doc(db, 'config/roles')); if (r.exists()) Object.assign(roles, r.data()); } catch (e) { }
    if (user) {
      // 會員資料：第一次登入即註冊；之後每次載入更新最後登入時間
      try {
        const ref = F.doc(db, 'profiles/' + user.uid); const cur = await F.getDoc(ref);
        const base = { name: user.displayName || '', email: user.email || '', photo: user.photoURL || '', lastLogin: Date.now() };
        if (!cur.exists()) await F.setDoc(ref, Object.assign(base, { created: Date.now(), logins: 1 }));
        else {
          const last = cur.data().lastLogin || 0;
          // 30 分鐘內重新整理不算新的一次登入
          await F.setDoc(ref, Object.assign(base, Date.now() - last > 30 * 60e3 ? { logins: F.increment(1) } : {}), { merge: true });
        }
      } catch (e) { console.warn('profile', e); }
    }
    fb = { A, Au, F, app, auth, db, user, roles };
    return fb;
  })().catch((e) => { console.error('Firebase 初始化失敗', e); return null; });

  // ---------- Firestore → claude db 介面 ----------
  const CODE = { 'permission-denied': 'invalid_argument', unauthenticated: 'invalid_argument', 'invalid-argument': 'invalid_argument', 'resource-exhausted': 'quota_exceeded', unavailable: 'unavailable' };
  const err = (e) => { const o = new Error((e && e.message) || 'error'); o.code = CODE[e && e.code] || 'unavailable'; return o; };
  const wrapDoc = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data() });
  function docRef(path) {
    const { F, db } = fb; const r = F.doc(db, path);
    return {
      id: r.id, path,
      async get() { try { return wrapDoc(await F.getDoc(r)); } catch (e) { throw err(e); } },
      async set(b) { try { await F.setDoc(r, b); } catch (e) { throw err(e); } },
      async update(b) { try { await F.updateDoc(r, b); } catch (e) { throw err(e); } },
      async delete() { try { await F.deleteDoc(r); } catch (e) { throw err(e); } },
      onSnapshot(cb, ecb) { return F.onSnapshot(r, (s) => cb(wrapDoc(s)), (e) => ecb && ecb(err(e))); },
      collection(c) { return colRef(path + '/' + c); },
    };
  }
  function colRef(path) {
    const { F, db } = fb; const c = F.collection(db, path);
    return {
      path,
      doc(id) { return docRef(path + '/' + (id || F.doc(c).id)); },
      async add(b) { try { const r = await F.addDoc(c, b); return docRef(path + '/' + r.id); } catch (e) { throw err(e); } },
      async get() { try { const s = await F.getDocs(c); return { docs: s.docs.map(wrapDoc), size: s.size }; } catch (e) { throw err(e); } },
      onSnapshot(cb, ecb) { return F.onSnapshot(c, (s) => cb({ docs: s.docs.map(wrapDoc), size: s.size }), (e) => ecb && ecb(err(e))); },
    };
  }
  const dbNS = { doc: (p) => docRef(p), collection: (p) => colRef(p) };

  // ---------- 身分 ----------
  const uid = () => (fb && fb.user ? fb.user.uid : null);
  const isOwner = () => !!(uid() && C.ownerUid && uid() === C.ownerUid);
  const isAdmin = () => isOwner() || !!(uid() && (fb.roles.admins || []).includes(uid()));
  const userNS = {
    async me() { const u = fb.user; return { id: uid(), name: (u && u.displayName) || '', avatarUrl: (u && u.photoURL) || '', color: '#23705d', email: (u && u.email) || null, isOwner: isOwner(), canEdit: isAdmin(), blocked: !!(uid() && (fb.roles.blocked || []).includes(uid())) }; },
    async id() { return uid(); }, async isOwner() { return isOwner(); }, async canEdit() { return isAdmin(); }, async can() { return null; },
    async profiles(ids) {
      const out = {};
      await Promise.all(ids.map(async (i) => { try { const s = await fb.F.getDoc(fb.F.doc(fb.db, 'profiles/' + i)); out[i] = { id: i, name: s.exists() ? (s.data().name || s.data().email || '') : '' }; } catch (e) { out[i] = { id: i, name: '' }; } }));
      return out;
    },
  };

  // ---------- AI（Firebase AI Logic → Gemini）----------
  let sampleP = null;
  function sampleNS() {
    if (sampleP) return sampleP;
    sampleP = (async () => {
      if (C.recaptchaKey) {
        // App Check（reCAPTCHA v3）：只在管理員使用 AI 時才載入
        const AC = await import(B + 'firebase-app-check.js');
        AC.initializeAppCheck(fb.app, { provider: new AC.ReCaptchaV3Provider(C.recaptchaKey), isTokenAutoRefreshEnabled: true });
      }
      const AI = await import(B + 'firebase-ai.js');
      const ai = AI.getAI(fb.app, { backend: new AI.GoogleAIBackend() });
      const models = [].concat(C.models || ['gemini-2.5-flash']);
      const toPart = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res({ inlineData: { data: String(fr.result).split(',')[1], mimeType: blob.type || 'application/octet-stream' } }); fr.onerror = rej; fr.readAsDataURL(blob); });
      let mi = 0;
      const run = async (prompt, opts, json) => {
        const files = Array.from((opts && (opts.images || opts.files)) || []);
        const parts = [{ text: String(prompt) }].concat(await Promise.all(files.map(toPart)));
        for (;;) {
          const model = AI.getGenerativeModel(ai, { model: models[mi], generationConfig: json ? { responseMimeType: 'application/json' } : {} });
          try { const r = await model.generateContent(parts); return r.response.text(); }
          catch (e) {
            const m = String((e && e.message) || e);
            if (/not found|404|is not supported|unknown model/i.test(m) && mi < models.length - 1) { mi++; continue; }
            const o = new Error(m); o.code = /quota|429|exhaust|rate/i.test(m) ? 'rate_limited' : /403|permission|not been used|disabled|API key|not enabled/i.test(m) ? 'not_granted' : /image|mime|unsupported/i.test(m) ? 'image_rejected' : 'unavailable';
            console.warn('AI', m); throw o;
          }
        }
      };
      const s = async (p, o) => ({ text: await run(p, o, false), truncated: false });
      s.json = async (p, o) => { const t = await run(p, o, true); return JSON.parse(String(t).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')); };
      s.limits = async () => ({ inputBytes: 1e6, images: { maxCount: 4, maxBytes: 7e6, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] }, audio: { maxBytes: 15e6 } });
      return s;
    })().catch((e) => { console.warn('AI 模組載入失敗', e); return null; });
    return sampleP;
  }

  window.claude = {
    async use(name) {
      const f = await boot; if (!f) return null;
      if (name === 'db') return dbNS;
      if (name === 'user') return userNS;
      if (name === 'sample') return f.user && isAdmin() ? sampleNS() : null; // AI 只開放管理員
      return null;
    },
  };

  // ---------- 登入、後台 ----------
  window.TN_BACKEND = {
    kind: 'firebase', ready: boot, ownerUid: C.ownerUid || '',
    async signIn() { const f = await boot; const p = new f.Au.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); await f.Au.signInWithPopup(f.auth, p); location.reload(); },
    async signOut() { const f = await boot; await f.Au.signOut(f.auth); location.reload(); },
    roles() { return fb ? fb.roles : { admins: [], blocked: [] }; },
    async listProfiles() { const f = await boot; const s = await f.F.getDocs(f.F.collection(f.db, 'profiles')); return s.docs.map((d) => Object.assign({ id: d.id }, d.data())); },
    async casesOf(u) { const f = await boot; const s = await f.F.getDocs(f.F.collection(f.db, 'data/users/' + u)); return s.docs.map((d) => Object.assign({ id: d.id }, d.data())); },
    async setRole(u, role) {
      const f = await boot; const r = f.roles; const rm = (k) => (r[k] = (r[k] || []).filter((x) => x !== u));
      rm('admins'); rm('blocked'); if (role === 'admin') r.admins.push(u); if (role === 'blocked') r.blocked.push(u);
      await f.F.setDoc(f.F.doc(f.db, 'config/roles'), { admins: r.admins, blocked: r.blocked, updated: Date.now(), by: uid() });
    },
  };
})();
