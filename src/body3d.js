/* ===== 3D 人體引擎（Three.js r128）＋ BodyParts3D 真實模型 =====
   骨骼、肌肉、皮膚：BodyParts3D（© DBCLS, CC BY-SA 2.1 JP），已減面並量化（anatomy.bin / anatomy.json）。
   經脈、穴位、經筋：依課堂規格點在參數人體上計算，再以標誌點對應（薄板樣條）移到真實模型並貼合皮膚（geo.json）。 */
(function () {
  const ASSET = { bin: 'anatomy.data.wasm', json: 'anatomy.json', geo: 'geo.json' };

  async function fetchWithProgress(url, onProg) {
    const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
    const total = +r.headers.get('content-length') || 0;
    if (!r.body || !r.body.getReader || !total) { const b = await r.arrayBuffer(); onProg && onProg(1); return b; }
    const rd = r.body.getReader(); const chunks = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onProg && onProg(got / total); }
    const out = new Uint8Array(got); let o = 0; chunks.forEach((c) => { out.set(c, o); o += c.length; }); return out.buffer;
  }
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  function polyFromFlat(L) { const pts = []; for (let i = 0; i + 2 < L.length; i += 3) pts.push(new THREE.Vector3(L[i], L[i + 1], L[i + 2])); return pts; }
  function tubeGeo(pts, r, radial = 6) {
    if (pts.length < 2) return null;
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    return new THREE.TubeGeometry(c, Math.max(8, Math.min(600, pts.length * 2)), r, radial, false);
  }
  function taperTube(pts, rmax, segs = 40, rad = 8) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); const fr = curve.computeFrenetFrames(segs, false);
    const pos = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs; const p = curve.getPointAt(t); const N = fr.normals[i], B = fr.binormals[i]; const r = rmax * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25)), 0.5));
      for (let j = 0; j <= rad; j++) { const a = (j / rad) * Math.PI * 2; const cs = Math.cos(a), sn = Math.sin(a); pos.push(p.x + r * (cs * N.x + sn * B.x), p.y + r * (cs * N.y + sn * B.y), p.z + r * (cs * N.z + sn * B.z)); }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  function create(container, data, opts = {}) {
    const W0 = container.clientWidth || 600, H0 = container.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0);
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, W0 / H0, 0.03, 20);
    const HOME = { cam: new THREE.Vector3(0, 0.92, 3.15), tgt: new THREE.Vector3(0, 0.86, 0) };
    camera.position.copy(HOME.cam);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.copy(HOME.tgt); controls.enableDamping = true; controls.dampingFactor = 0.12; controls.minDistance = 0.25; controls.maxDistance = 6; controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d808a, 0.72));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.72); d1.position.set(1.6, 2.6, 2.4); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.42); d2.position.set(-1.8, 1.4, -2.4); scene.add(d2);
    const d3 = new THREE.DirectionalLight(0xffffff, 0.18); d3.position.set(0, -1, 1); scene.add(d3);

    const groups = { skin: new THREE.Group(), bone: new THREE.Group(), muscle: new THREE.Group(), meridian: new THREE.Group(), sinew: new THREE.Group(), point: new THREE.Group() };
    Object.values(groups).forEach((g) => scene.add(g));
    const C = opts.colors || {};
    const matSkin = new THREE.MeshStandardMaterial({ color: C.skin || 0xd9b9a0, roughness: 0.75, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    const matBone = new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.62, metalness: 0 });
    const matCart = new THREE.MeshStandardMaterial({ color: 0xb4cfd4, roughness: 0.55 });
    const matBoneHi = new THREE.MeshStandardMaterial({ color: 0xf2b84b, roughness: 0.5, emissive: 0x6a4200 });
    const matBoneDim = new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.62, transparent: true, opacity: 0.22, depthWrite: false });
    const MUSCLE_BASE = new THREE.Color(C.muscle || 0xb04b42);

    const state = { sel: null, muscleStates: {}, ready: false, pending: [], layers: {} };
    const muscleMeshes = {}, boneMeshes = {}, merMeshes = {}, sinewMeshes = {}, pointMeshes = {}, pointPos = {}; const partInfo = {};

    // ---- 載入提示 ----
    const loader = document.createElement('div'); loader.className = 'b3-loading';
    loader.innerHTML = '<div class="b3-ld-t">載入 3D 解剖模型…</div><div class="b3-ld-bar"><i></i></div><div class="b3-ld-s">約 6 MB，第一次載入需要一點時間</div>';
    container.appendChild(loader);
    const setProg = (f) => { const i = loader.querySelector('i'); if (i) i.style.width = Math.round(f * 100) + '%'; };
    const credit = document.createElement('div'); credit.className = 'b3-credit';
    credit.innerHTML = '3D 模型：BodyParts3D © DBCLS（CC BY-SA 2.1 JP）'; container.appendChild(credit);

    // ---- 標籤 ----
    const labelLayer = document.createElement('div'); labelLayer.className = 'b3-labels'; container.appendChild(labelLayer);
    let labels = [];
    function setLabels(list) { labelLayer.innerHTML = ''; labels = list.map((l) => { const el = document.createElement('div'); el.className = 'b3-label' + (l.cls ? ' ' + l.cls : ''); el.textContent = l.text; labelLayer.appendChild(el); return { el, obj: l.obj || null, pos: l.obj ? new THREE.Vector3() : (l.pos.clone ? l.pos.clone() : new THREE.Vector3(l.pos.x, l.pos.y, l.pos.z)) }; }); }
    function updateLabels() {
      const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
      labels.forEach((l) => { if (l.obj) l.obj.getWorldPosition(l.pos); const p = l.pos.clone().project(camera); const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05; l.el.style.display = vis ? '' : 'none'; l.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px)`; });
    }


    // ===== 動作示範引擎：骨骼剛體轉動＋肌肉／皮膚依最近兩塊骨頭權重變形 =====
    const meshByPart = {}; let boneList = []; const deform = []; const motionMarks = {};
    const SIDED = ['humerus', 'ulna', 'radius', 'hand', 'clavicle', 'scapula', 'hip', 'femur', 'patella', 'tibia', 'fibula', 'talus', 'foot'];
    const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
    function boneKey(name) {
      const n = name.toLowerCase(); const sd = /\bleft\b/.test(n) ? '_L' : /\bright\b/.test(n) ? '_R' : '';
      let g = null;
      if (/humerus/.test(n)) g = 'humerus'; else if (/\bulna\b/.test(n)) g = 'ulna'; else if (/radius/.test(n)) g = 'radius';
      else if (/scaphoid|lunate|triquetral|pisiform|trapezi|trapezoid|capitate|hamate|metacarpal|finger|thumb/.test(n)) g = 'hand';
      else if (/scapula/.test(n)) g = 'scapula'; else if (/clavicle/.test(n)) g = 'clavicle'; else if (/hip bone/.test(n)) g = 'hip';
      else if (/femur/.test(n)) g = 'femur'; else if (/patella/.test(n)) g = 'patella'; else if (/tibia/.test(n)) g = 'tibia'; else if (/fibula/.test(n)) g = 'fibula';
      else if (/talus/.test(n)) g = 'talus'; else if (/calcaneus|cuboid|cuneiform|navicular|metatarsal|toe/.test(n)) g = 'foot';
      else if (/frontal|parietal|occipital|temporal|sphenoid|ethmoid|maxilla|nasal|zygomatic|mandible/.test(n)) return 'skull';
      else if (/^atlas$/.test(n)) return 'C1'; else if (/^axis$|disk of axis/.test(n)) return 'C2';
      else { const m = n.match(/(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (cervical|thoracic|lumbar) vertebra/); if (m) return { cervical: 'C', thoracic: 'T', lumbar: 'L' }[m[2]] + ORD[m[1]]; }
      return g ? g + sd : 'other';
    }
    function addDeform(mesh, p, man, buf) {
      if (p.sk == null || man.skOff == null) return;
      const sk = new Uint8Array(buf, man.skOff + p.sk * 3, p.nv * 3);
      const pos = mesh.geometry.attributes.position, nor = mesh.geometry.attributes.normal;
      const used = new Set(); for (let i = 0; i < p.nv; i++) { used.add(sk[i * 3]); used.add(sk[i * 3 + 1]); }
      deform.push({ mesh, sk, orig: pos.array.slice(), origN: nor.array.slice(), used: [...used], dirty: false });
    }
    const V3o = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
    const Rh = {
      rot(p, axis, deg) { const pv = V3o(p), ax = V3o(axis).normalize(); return new THREE.Matrix4().makeTranslation(pv.x, pv.y, pv.z).multiply(new THREE.Matrix4().makeRotationAxis(ax, deg * Math.PI / 180)).multiply(new THREE.Matrix4().makeTranslation(-pv.x, -pv.y, -pv.z)); },
      mul(...ms) { const r = new THREE.Matrix4(); ms.forEach((m) => r.multiply(m)); return r; },
      tr(v) { const d = V3o(v); return new THREE.Matrix4().makeTranslation(d.x, d.y, d.z); },
      moved(M, p) { const pv = V3o(p); return pv.clone().applyMatrix4(M).sub(pv); },
      axis(a, b) { return V3o(b).sub(V3o(a)).normalize(); },
      mid(a, b) { return V3o(a).add(V3o(b)).multiplyScalar(0.5); },
    };
    const JV = {}; Object.entries(window.JOINTS || {}).forEach(([k, v]) => { JV[k] = new THREE.Vector3(v[0], v[1], v[2]); });
    const MIR = new THREE.Matrix4().makeScale(-1, 1, 1);
    const mirror = (M) => new THREE.Matrix4().multiplyMatrices(MIR, M).multiply(MIR);
    let poseActive = false;
    function applyPose(byKey) {
      const mats = boneList.map((b) => (byKey && byKey[b.key]) || null);
      boneList.forEach((b, n) => { const m = b.mesh; if (!m) return; m.matrixAutoUpdate = false; if (mats[n]) m.matrix.copy(mats[n]); else m.matrix.identity(); m.matrixWorldNeedsUpdate = true; });
      const E = mats.map((M) => (M ? M.elements : null));
      deform.forEach((d) => {
        const moving = d.used.some((n) => E[n]);
        if (!moving && !d.dirty) return;
        const pos = d.mesh.geometry.attributes.position, nor = d.mesh.geometry.attributes.normal; const P = pos.array, N = nor.array, O = d.orig, ON = d.origN, sk = d.sk;
        if (!moving) { P.set(O); N.set(ON); d.dirty = false; pos.needsUpdate = true; nor.needsUpdate = true; d.mesh.geometry.computeBoundingSphere(); return; }
        for (let i = 0, j = 0; i < sk.length; i += 3, j += 3) {
          const e1 = E[sk[i]], e2 = E[sk[i + 1]]; const x = O[j], y = O[j + 1], z = O[j + 2], nx = ON[j], ny = ON[j + 1], nz = ON[j + 2];
          if (!e1 && !e2) { P[j] = x; P[j + 1] = y; P[j + 2] = z; N[j] = nx; N[j + 1] = ny; N[j + 2] = nz; continue; }
          const w = sk[i + 2] / 255, u = 1 - w;
          let ax = x, ay = y, az = z, bx = x, by = y, bz = z, anx = nx, any = ny, anz = nz, bnx = nx, bny = ny, bnz = nz;
          if (e1) { ax = e1[0] * x + e1[4] * y + e1[8] * z + e1[12]; ay = e1[1] * x + e1[5] * y + e1[9] * z + e1[13]; az = e1[2] * x + e1[6] * y + e1[10] * z + e1[14]; anx = e1[0] * nx + e1[4] * ny + e1[8] * nz; any = e1[1] * nx + e1[5] * ny + e1[9] * nz; anz = e1[2] * nx + e1[6] * ny + e1[10] * nz; }
          if (e2) { bx = e2[0] * x + e2[4] * y + e2[8] * z + e2[12]; by = e2[1] * x + e2[5] * y + e2[9] * z + e2[13]; bz = e2[2] * x + e2[6] * y + e2[10] * z + e2[14]; bnx = e2[0] * nx + e2[4] * ny + e2[8] * nz; bny = e2[1] * nx + e2[5] * ny + e2[9] * nz; bnz = e2[2] * nx + e2[6] * ny + e2[10] * nz; }
          P[j] = w * ax + u * bx; P[j + 1] = w * ay + u * by; P[j + 2] = w * az + u * bz; N[j] = w * anx + u * bnx; N[j + 1] = w * any + u * bny; N[j + 2] = w * anz + u * bnz;
        }
        d.dirty = true; pos.needsUpdate = true; nor.needsUpdate = true; d.mesh.geometry.computeBoundingSphere();
      });
      // 標記點跟著無名骨
      markers.forEach((mk) => { const M = byKey && byKey[mk.key]; mk.obj.matrix.copy(M || new THREE.Matrix4()); mk.obj.matrixWorldNeedsUpdate = true; });
      poseActive = !!byKey;
    }
    function poseFor(def, t, side) {
      const raw = def.pose(t, JV, Rh) || {}; const out = {};
      Object.entries(raw).forEach(([k, M]) => { const mm = side === 'R' && def.side !== false ? mirror(M) : M; out[SIDED.includes(k) ? k + '_' + side : k] = mm; });
      return out;
    }
    // 骨盆標記：PSIS、S2
    const markers = []; const markerGroup = new THREE.Group(); markerGroup.visible = false; scene.add(markerGroup);
    (function buildMarkers() {
      const mk = (pos, key, color) => { const holder = new THREE.Object3D(); holder.matrixAutoUpdate = false; const s = new THREE.Mesh(new THREE.SphereGeometry(0.007, 14, 10), new THREE.MeshBasicMaterial({ color, depthTest: false })); s.renderOrder = 20; s.position.copy(pos); holder.add(s); markerGroup.add(holder); markers.push({ obj: holder, key, dot: s }); return s; };
      const J = window.JOINTS || {}; if (!J.psis) return;
      motionMarks.psisL = mk(new THREE.Vector3(J.psis[0], J.psis[1], J.psis[2]), 'hip_L', 0x1d6fd6);
      motionMarks.psisR = mk(new THREE.Vector3(-J.psis[0], J.psis[1], J.psis[2]), 'hip_R', 0x1d6fd6);
      motionMarks.s2 = mk(new THREE.Vector3(J.spS2[0], J.spS2[1], J.spS2[2]), 'none', 0xd8231b);
    })();
    const motion = { def: null, side: 'L', t: 0, playing: false, phase: 0, speed: 1, onTick: null, saved: null };
    function motionStates(def, side) {
      const o = side === 'L' ? 'R' : 'L'; const st = {}; const put = (id, sd, v) => { const e = st[id] || (st[id] = { L: 0, R: 0 }); if (def.side === false) { e.L = v; e.R = v; } else e[sd] = v; };
      (def.antag || []).forEach((a) => { const [id, w] = Array.isArray(a) ? a : [a, 'same']; put(id, w === 'opp' ? o : side, -0.8); });
      (def.movers || []).forEach((a) => { const [id, w] = Array.isArray(a) ? a : [a, 'same']; put(id, w === 'opp' ? o : side, 1); });
      return st;
    }
    function startMotion(id, opt = {}) {
      const def = (window.MOTIONS || []).find((m) => m.id === id); if (!def) return;
      const go = () => {
        if (!motion.saved) motion.saved = { skin: groups.skin.visible, meridian: groups.meridian.visible, point: groups.point.visible, sinew: groups.sinew.visible, bone: groups.bone.visible };
        groups.skin.visible = false; groups.meridian.visible = false; groups.point.visible = false; groups.sinew.visible = false; groups.bone.visible = true; skinMode();
        motion.def = def; motion.side = def.side === false ? 'L' : (opt.side || motion.side || 'L'); motion.phase = 0; motion.t = 0; motion.playing = opt.play !== false;
        state.sel = null; state.muscleStates = motionStates(def, motion.side); refresh();
        markerGroup.visible = !!def.pelvis;
        const lab = def.pelvis ? [{ text: 'PSIS 左', obj: motionMarks.psisL, cls: 'pt' }, { text: 'PSIS 右', obj: motionMarks.psisR, cls: 'pt' }, { text: 'S2', obj: motionMarks.s2, cls: 'mu' }] : [];
        setLabels(lab);
        applyPose(poseFor(def, 0, motion.side));
        const v = def.view || {}; const at = JV[v.at] ? JV[v.at].clone() : new THREE.Vector3(0, 1, 0); const dir = new THREE.Vector3(...(v.dir || [0, 0.1, 1]));
        if (motion.side === 'R' && def.side !== false) { at.x = -at.x; dir.x = -dir.x; }
        if (opt.focus !== false) focusOn(at, v.dist || 1.2, dir.normalize());
      };
      if (!state.ready) state.pending.push(go); else go();
    }
    function stopMotion() {
      if (!motion.def) return; motion.def = null; motion.playing = false; applyPose(null); markerGroup.visible = false; setLabels([]);
      if (motion.saved) { Object.entries(motion.saved).forEach(([k, v]) => { groups[k].visible = v; }); motion.saved = null; skinMode(); }
      state.muscleStates = {}; refresh();
    }
    function setMotionT(t) { motion.t = Math.max(0, Math.min(1, t)); motion.playing = false; if (motion.def) applyPose(poseFor(motion.def, motion.t, motion.side)); }
    let lastT = 0;
    function tickMotion(now) {
      const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0; lastT = now;
      if (!motion.def || !motion.playing) return;
      motion.phase += dt * 1.6 * motion.speed; motion.t = (1 - Math.cos(motion.phase)) / 2;
      applyPose(poseFor(motion.def, motion.t, motion.side)); motion.onTick && motion.onTick(motion.t);
    }
    // 靜態骨盆姿勢（症狀模擬 → 3D）
    function showPelvisPose(p) {
      const go = () => {
        const H = window.MOTION_POSES; if (!H) return;
        const L = H.pelvis(JV, Rh, (p.aL || 0) * 5 + (p.uL || 0) * 4, (p.xL || 0) * 4 + (p.uL || 0) * 3);
        const R = H.pelvis(JV, Rh, (p.aR || 0) * 5 + (p.uR || 0) * 4, (p.xR || 0) * 4 + (p.uR || 0) * 3);
        const out = {}; Object.entries(L).forEach(([k, M]) => { out[k + '_L'] = M; }); Object.entries(R).forEach(([k, M]) => { out[k + '_R'] = mirror(M); });
        if (!motion.saved) motion.saved = { skin: groups.skin.visible, meridian: groups.meridian.visible, point: groups.point.visible, sinew: groups.sinew.visible, bone: groups.bone.visible };
        groups.skin.visible = false; groups.meridian.visible = false; groups.point.visible = false; groups.sinew.visible = false; groups.bone.visible = true; skinMode();
        motion.def = { id: 'pelvis_pose', pelvis: true, pose: () => ({}) }; motion.playing = false; markerGroup.visible = true;
        applyPose(out); setLabels([{ text: 'PSIS 左', obj: motionMarks.psisL, cls: 'pt' }, { text: 'PSIS 右', obj: motionMarks.psisR, cls: 'pt' }, { text: 'S2', obj: motionMarks.s2, cls: 'mu' }]);
        focusOn(new THREE.Vector3(0, 0.88, -0.05), 1.15, new THREE.Vector3(0, 0.45, -1).normalize());
      };
      if (!state.ready) state.pending.push(go); else go();
    }

    // ---- 建立網格 ----
    function buildAnatomy(man, buf) {
      const pos = new Uint16Array(buf, 0, man.nv * 3); const idx = new Uint16Array(buf, man.posBytes, man.ni);
      const mn = man.min, st = man.step;
      man.parts.forEach((p, k) => {
        const P = new Float32Array(p.nv * 3);
        for (let i = 0; i < p.nv * 3; i++) { const a = i % 3; P[i] = mn[a] + pos[p.v * 3 + i] * st[a]; }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setIndex(new THREE.BufferAttribute(idx.slice(p.i, p.i + p.ni), 1)); g.computeVertexNormals(); g.computeBoundingSphere();
        const side = p.side === 'L' ? 1 : p.side === 'R' ? -1 : 0;
        if (p.kind === 'skin') { const m = new THREE.Mesh(g, matSkin); m.userData = { kind: 'skin' }; m.renderOrder = 5; groups.skin.add(m); addDeform(m, p, man, buf); return; }
        if (p.kind === 'muscle') {
          const mat = new THREE.MeshStandardMaterial({ color: MUSCLE_BASE.clone(), roughness: 0.58, metalness: 0, transparent: true, opacity: 1 });
          const m = new THREE.Mesh(g, mat); const id = p.group || ('m_' + p.fid);
          m.userData = { kind: 'muscle', id, side, part: p.zh, fid: p.fid }; (muscleMeshes[id] = muscleMeshes[id] || []).push(m); groups.muscle.add(m); partInfo[p.fid] = p; addDeform(m, p, man, buf); return;
        }
        const m = new THREE.Mesh(g, p.kind === 'cart' ? matCart : matBone); m.userData = { kind: 'bone', id: p.fid, part: p.zh, base: m.material };
        (boneMeshes[p.fid] = boneMeshes[p.fid] || []).push(m); groups.bone.add(m); partInfo[p.fid] = p; meshByPart[k] = m;
      });
      boneList = (man.bones || []).map((k) => { const m = meshByPart[k]; const pp = man.parts[k]; return { mesh: m, key: boneKey(pp.name) }; });
    }
    function buildGeo(G) {
      const MER = {}; (data.meridians || []).forEach((m) => { MER[m.id] = m; });
      Object.entries(G.mer || {}).forEach(([id, arr]) => {
        const mer = MER[id]; if (!mer) return;
        const mat = new THREE.MeshBasicMaterial({ color: mer.color, transparent: true, opacity: 0.95 });
        arr.forEach((L) => { const g = tubeGeo(polyFromFlat(L), 0.0025, 6); if (!g) return; const m = new THREE.Mesh(g, mat.clone()); m.userData = { kind: 'meridian', id }; m.renderOrder = 6; (merMeshes[id] = merMeshes[id] || []).push(m); groups.meridian.add(m); });
      });
      const SW = {}; (data.sinews || []).forEach((s) => { SW[s.id] = s; });
      const knotGeo = new THREE.SphereGeometry(0.0095, 12, 10);
      Object.entries(G.sinew || {}).forEach(([id, o]) => {
        const sw = SW[id]; if (!sw) return;
        o.paths.forEach((L) => { const g = tubeGeo(polyFromFlat(L), 0.0075, 8); if (!g) return; const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: sw.color, transparent: true, opacity: 0.45, roughness: 0.6, depthWrite: false })); m.userData = { kind: 'sinew', id }; m.renderOrder = 7; (sinewMeshes[id] = sinewMeshes[id] || []).push(m); groups.sinew.add(m); });
        o.knots.forEach((k) => { const m = new THREE.Mesh(knotGeo, new THREE.MeshStandardMaterial({ color: sw.color, transparent: true, opacity: 0.8 })); m.position.copy(V3(k.p)); m.userData = { kind: 'sinew', id, knot: k.name }; (sinewMeshes[id] = sinewMeshes[id] || []).push(m); groups.sinew.add(m); });
      });
      const ptGeo = new THREE.SphereGeometry(0.0042, 12, 10);
      (data.points || []).forEach((pt) => {
        const arr = (G.pts || {})[pt.id]; if (!arr) return; const mer = MER[pt.mer];
        arr.forEach((p) => {
          const m = new THREE.Mesh(ptGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: mer ? mer.color : 0x333333, emissiveIntensity: 0.55, roughness: 0.4 }));
          m.position.copy(V3(p)); m.userData = { kind: 'point', id: pt.id }; m.renderOrder = 8;
          (pointMeshes[pt.id] = pointMeshes[pt.id] || []).push(m); (pointPos[pt.id] = pointPos[pt.id] || []).push(m.position.clone()); groups.point.add(m);
        });
      });
      // 資料集中沒有的闊筋膜張肌／髂脛束：以示意管狀補上
      Object.entries(G.fib || {}).forEach(([id, sides]) => {
        if (muscleMeshes[id]) return;
        sides.forEach((lines, si) => {
          lines.forEach((L) => {
            const pts = polyFromFlat(L); if (pts.length < 2) return;
            const mat = new THREE.MeshStandardMaterial({ color: MUSCLE_BASE.clone(), roughness: 0.5, transparent: true, opacity: 1 });
            const m = new THREE.Mesh(taperTube(pts, 0.0085), mat); m.userData = { kind: 'muscle', id, side: si === 0 ? 1 : -1, part: '闊筋膜張肌／髂脛束（示意）' };
            (muscleMeshes[id] = muscleMeshes[id] || []).push(m); groups.muscle.add(m);
          });
        });
      });
    }

    // ---- 顯示狀態 ----
    const COL = { base: MUSCLE_BASE, sel: new THREE.Color(0xff8a2a), tight: new THREE.Color(0xd8231b), weak: new THREE.Color(0x3d7fd1), dim: new THREE.Color(0xb39a94) };
    function refresh() {
      if (!state.ready) return;
      const sel = state.sel; const anySel = !!sel; const ms = state.muscleStates; const anyState = Object.keys(ms).length > 0;
      Object.entries(muscleMeshes).forEach(([id, meshes]) => meshes.forEach((m) => {
        const sd = m.userData.side; const st0 = ms[id]; const st = st0 && (sd > 0 ? st0.L : sd < 0 ? st0.R : Math.max(st0.L || 0, st0.R || 0)) || (st0 && st0.both);
        let c = COL.base, op = 1, em = 0;
        if (anyState) { c = COL.dim; op = 0.16; }
        if (st) { const lv = Math.min(1, Math.abs(st)); c = st > 0 ? COL.tight : COL.weak; op = 0.6 + 0.4 * lv; em = 0.12 + 0.3 * lv; }
        if (anySel && sel.kind === 'muscle') { if (sel.ids.includes(id)) { c = COL.sel; op = 1; em = 0.28; } else if (!st) op = 0.1; }
        m.material.color.copy(c); m.material.opacity = op; m.material.emissive.copy(c).multiplyScalar(em); m.material.depthWrite = op > 0.5; m.material.transparent = op < 1; m.renderOrder = op > 0.5 ? 2 : 1; m.material.needsUpdate = true;
      }));
      Object.entries(merMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { m.material.opacity = !anySel || sel.kind === 'point' || (sel.kind === 'meridian' && sel.ids.includes(id)) ? 0.95 : 0.1; }));
      Object.entries(sinewMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { m.material.opacity = !anySel || (sel.kind === 'sinew' && sel.ids.includes(id)) ? (m.userData.knot ? 0.85 : 0.5) : 0.06; }));
      Object.entries(pointMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { const on = anySel && sel.kind === 'point' && sel.ids.includes(id); m.scale.setScalar(on ? 1.9 : 1); m.material.emissiveIntensity = on ? 1.3 : 0.55; }));
      const boneSel = anySel && sel.kind === 'bone';
      Object.entries(boneMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { m.material = boneSel ? (sel.ids.includes(id) ? matBoneHi : (m.userData.base === matCart ? matCart : matBone)) : m.userData.base; }));
    }
    function centroid(meshes) { const box = new THREE.Box3(); meshes.forEach((m) => box.expandByObject(m)); const c = new THREE.Vector3(); box.getCenter(c); return c; }
    const MER_VIEW = { GB: [1, 0.05, 0.25], TE: [1, 0.05, -0.2], LI: [1, 0.05, 0.35], SI: [0.5, 0.05, -1], BL: [0, 0.05, -1], GV: [0, 0.05, -1] };
    function viewDirFor(c, kind, id) {
      if (kind === 'meridian' || kind === 'sinew') { const v = MER_VIEW[id] || [0, 0.05, 1]; return new THREE.Vector3(...v).normalize(); }
      const ax = Math.abs(c.x);
      if (kind === 'point' || kind === 'muscle') {
        if (ax > 0.17 && c.y > 0.6) return new THREE.Vector3(Math.sign(c.x), 0.1, c.z > 0.0 ? 0.5 : -0.5).normalize(); // 上肢
        if (c.y > 1.45) return new THREE.Vector3(c.x * 4, 0.15, c.z >= -0.02 ? 1 : -1).normalize(); // 頭頸
        return new THREE.Vector3(c.x * 2.5, 0.1, c.z >= -0.015 ? 1 : -1).normalize();
      }
      return null;
    }
    function doSelect(kind, ids, opt = {}) {
      ids = [].concat(ids || []);
      state.sel = ids.length ? { kind, ids } : null; refresh();
      const lab = [];
      if (state.sel) {
        const pool = kind === 'muscle' ? muscleMeshes : kind === 'meridian' ? merMeshes : kind === 'sinew' ? sinewMeshes : kind === 'point' ? pointMeshes : boneMeshes;
        let meshes = []; ids.forEach((id) => { if (pool[id]) meshes = meshes.concat(pool[id]); });
        if (kind === 'point') ids.forEach((id) => (pointPos[id] || []).forEach((p, i) => { if (i === 0 || opt.bothLabels) lab.push({ text: ((data.points || []).find((x) => x.id === id) || {}).name || id, pos: p, cls: 'pt' }); }));
        else if (kind === 'muscle') ids.forEach((id) => { const ms = (muscleMeshes[id] || []).filter((m) => m.userData.side >= 0); if (ms.length) { const m = (data.muscles || []).find((x) => x.id === id); lab.push({ text: m ? m.name : id, pos: centroid(ms), cls: 'mu' }); } });
        else if (kind === 'bone') ids.forEach((id) => { if (boneMeshes[id]) lab.push({ text: (partInfo[id] || {}).zh || id, pos: centroid(boneMeshes[id]), cls: 'mu' }); });
        if (meshes.length && opt.focus !== false) {
          let focusMeshes = meshes;
          if (kind === 'point' || kind === 'muscle') { const left = meshes.filter((m) => (m.userData.side != null ? m.userData.side >= 0 : m.position.x >= -0.001)); if (left.length) focusMeshes = left; }
          if (kind === 'point') focusMeshes = focusMeshes.slice(0, 1);
          const c = centroid(focusMeshes); const box = new THREE.Box3(); focusMeshes.forEach((m) => box.expandByObject(m)); const size = box.getSize(new THREE.Vector3()).length();
          const dist = opt.dist || (kind === 'meridian' || kind === 'sinew' ? Math.min(3.2, Math.max(1.2, size * 1.6)) : Math.min(1.8, Math.max(0.55, size * 2.2)));
          focusOn(c, dist, viewDirFor(c, kind, ids[0]));
        }
      }
      if (opt.labels) opt.labels.forEach((l) => lab.push(l));
      setLabels(lab);
    }
    function select(kind, ids, opt) { if (!state.ready) { state.pending.push(() => doSelect(kind, ids, opt)); return; } doSelect(kind, ids, opt); }
    let anim = null;
    function tween(camTo, tgtTo) { const cf = camera.position.clone(), tf = controls.target.clone(); const t0 = performance.now(); anim = (now) => { const t = Math.min(1, (now - t0) / 550); const e = t * t * (3 - 2 * t); camera.position.lerpVectors(cf, camTo, e); controls.target.lerpVectors(tf, tgtTo, e); if (t >= 1) anim = null; }; }
    function focusOn(c, dist, dirIn) { const dir = dirIn ? dirIn.clone() : camera.position.clone().sub(controls.target).normalize(); tween(c.clone().add(dir.multiplyScalar(dist || 1.2)), c.clone()); }
    function view(name) {
      const tgt = controls.target.clone(); const d = Math.max(1.0, camera.position.distanceTo(tgt));
      const dirs = { front: [0, 0.05, 1], back: [0, 0.05, -1], left: [1, 0.05, 0], right: [-1, 0.05, 0], top: [0, 1, 0.01] };
      tween(tgt.clone().add(new THREE.Vector3(...dirs[name]).normalize().multiplyScalar(d)), tgt);
    }
    function reset() { tween(HOME.cam.clone(), HOME.tgt.clone()); }
    function skinMode() {
      const see = groups.muscle.visible || groups.bone.visible;
      matSkin.opacity = see ? 0.16 : 1; matSkin.depthWrite = !see; matSkin.transparent = see; matSkin.needsUpdate = true;
      groups.skin.children.forEach((m) => { m.renderOrder = see ? 5 : 0; });
    }
    function setLayer(name, on) { state.layers[name] = on; if (groups[name]) groups[name].visible = on; skinMode(); }

    // ---- 點選 ----
    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let down = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!state.ready || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
      const objs = []; ['point', 'meridian', 'sinew', 'muscle', 'bone', 'skin'].forEach((g) => { if (!groups[g].visible) return; if (g === 'skin' && matSkin.transparent) return; groups[g].children.forEach((o) => { if (o.isMesh && (g === 'skin' || o.material.opacity > 0.15)) objs.push(o); }); });
      const hits = ray.intersectObjects(objs, false);
      if (!hits.length) { opts.onPick && opts.onPick(null); return; }
      const near = (k, tol) => hits.find((h) => h.object.userData.kind === k && h.distance - hits[0].distance < tol);
      const h = near('point', 0.03) || near('meridian', 0.012) || near('sinew', 0.015) || hits[0];
      if (h.object.userData.kind === 'skin') { opts.onPick && opts.onPick(null); return; }
      opts.onPick && opts.onPick(h.object.userData);
    });

    function resize() { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(container);
    function loop(now) { requestAnimationFrame(loop); if (anim) anim(now); tickMotion(now); controls.update(); renderer.render(scene, camera); updateLabels(); }
    requestAnimationFrame(loop);
    skinMode();

    // ---- 非同步載入 ----
    const base = opts.base || '';
    let pa = 0, pg = 0;
    Promise.all([
      fetch(base + ASSET.json).then((r) => { if (!r.ok) throw new Error('anatomy.json ' + r.status); return r.json(); }),
      fetchWithProgress(base + ASSET.bin, (f) => { pa = f; setProg(pa * 0.85 + pg * 0.15); }),
      fetchWithProgress(base + ASSET.geo, (f) => { pg = f; setProg(pa * 0.85 + pg * 0.15); }).then((b) => JSON.parse(new TextDecoder().decode(b))),
    ]).then(([man, buf, geo]) => {
      buildAnatomy(man, buf); buildGeo(geo);
      Object.entries(state.layers).forEach(([k, v]) => { if (groups[k]) groups[k].visible = v; }); skinMode();
      state.ready = true; loader.remove(); refresh();
      const q = state.pending; state.pending = []; q.forEach((f) => f());
      opts.onReady && opts.onReady();
    }).catch((err) => {
      loader.innerHTML = '<div class="b3-ld-t">3D 模型載入失敗</div><div class="b3-ld-s">請確認網路連線後重新整理。（' + String(err.message || err) + '）</div>';
      opts.onError && opts.onError(err);
    });

    return {
      select, view, reset, setLayer, refresh,
      setMuscleStates(ms) { state.muscleStates = ms || {}; refresh(); },
      clear() { state.sel = null; refresh(); setLabels([]); },
      partName(fid) { return partInfo[fid] || null; },
      startMotion, stopMotion, setMotionT, showPelvisPose,
      motionState() { return { id: motion.def && motion.def.id, side: motion.side, t: motion.t, playing: motion.playing }; },
      setMotionPlaying(on) { if (!motion.def) return; motion.playing = on; if (on) motion.phase = Math.acos(1 - 2 * motion.t); },
      setMotionSide(sd) { if (!motion.def) return; const id = motion.def.id; motion.side = sd; startMotion(id, { side: sd, focus: true, play: motion.playing }); },
      setMotionSpeed(v) { motion.speed = v; },
      onMotionTick(f) { motion.onTick = f; },
      isReady() { return state.ready; },
      renderer, camera, controls, scene,
    };
  }
  window.Body3D = { create };
})();
