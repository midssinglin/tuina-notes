/* ===== 3D 人體引擎（Three.js r128）===== */
(function () {
  const A = window.ANAT;
  const { V, add, sub, mul, lerp, len, norm, M } = A;

  // ---------- 規格點解析 ----------
  // 所有 x 以「左側」定義，s=+1 左，-1 右
  function P(spec, s = 1) {
    if (!Array.isArray(spec)) return spec; // already a point
    const k = spec[0];
    switch (k) {
      case 'X': return M(V(spec[1], spec[2], spec[3]), s);
      case 'LM': return A.LM(spec[1], s);
      case 'T': return M(A.torsoPt(spec[1], spec[2], spec[3], spec[4] || 0), s);
      case 'TA': { const p = A.torsoAng(spec[1], spec[2], spec[3] || 0); return M(p, s); }
      case 'H': return M(A.headPt(spec[1], spec[2], spec[3], spec[4] || 0), s);
      case 'L': return A.limbPt(spec[1], s, spec[2], spec[3], spec[4] || 0);
      case 'LA': return A.limbAxis(spec[1], s, spec[2]);
      case 'HA': return A.handPt(s, spec[1], spec[2], spec[3]);
      case 'FI': return A.fingerPt(s, spec[1], spec[2], spec[3] || 0, spec[4] || 'p');
      case 'FT': return A.footPt(s, spec[1], spec[2], spec[3]);
      case 'TO': return A.toePt(s, spec[1], spec[2], spec[3] || 'd');
      case 'SP': return A.VERT[spec[1]].sp; // 棘突（中線）
      case 'SPX': { const v = A.VERT[spec[1]]; return M(V(spec[2], v.sp.y, A.torsoPt(v.sp.y, spec[2], 'b', spec[3] || 0).z), s); }
      case 'VB': return A.VERT[spec[1]].body;
      case 'TP': { const v = A.VERT[spec[1]]; return M(V(spec[2] || 0.035, v.y, v.body.z - 0.012), s); }
      case 'SAC': { const v = A.VERT[spec[1]]; const w = A.sacW[spec[1]] * (spec[2] == null ? 1 : spec[2]); return M(V(w, v.y, v.sp.z + 0.006 + Math.abs(w) * 0.12), s); }
      case 'MIX': return lerp(P(spec[1], s), P(spec[2], s), spec[3]);
      case 'S': { // 投影到軀幹體表（沿水平放射方向）
        const x = spec[1], y = spec[2], z = spec[3]; const pr = A.torsoProf(y); const Z = z >= 0 ? pr.Zf : pr.Zb;
        const e = Math.pow(Math.abs(x) / pr.W, 2.6) + Math.pow(Math.abs(z) / Z, 2.6); const k = e > 1e-9 ? 1 / Math.pow(e, 1 / 2.6) : 1;
        const o = spec[4] || 0; const kk = k * (1 + o);
        return M(V(x * kk, y, z * kk), s); }
      case 'OFF': { const p = P(spec[1], s); return add(p, M(V(spec[2], spec[3], spec[4]), s)); }
      case 'RIB': return M(ribPoint(spec[1], spec[2], spec[3] || 0.012), s);
      default: throw new Error('bad spec ' + JSON.stringify(spec));
    }
  }
  A.P = P;

  // 肋骨路徑：rib n (1..12)，u 0 後(肋椎關節) → 1 前端
  const RIB_END = [0, 1, 1, 1, 1, 1, 1, 1, 0.92, 0.86, 0.80, 0.55, 0.42];
  function ribPoint(n, u, inset) {
    const v = A.VERT['T' + n];
    const drop = [0, 0.012, 0.03, 0.05, 0.065, 0.075, 0.085, 0.095, 0.10, 0.10, 0.095, 0.075, 0.06][n];
    const y = v.y - 0.004 - drop * Math.pow(u, 1.15) + (n <= 2 ? 0 : 0.012 * Math.sin(Math.PI * u) * 0.3);
    // angle from back (180) to front (0+)
    const phiEnd = n <= 7 ? 8 + (n - 1) * 0.8 : n <= 10 ? 18 + (n - 8) * 9 : n === 11 ? 70 : 92;
    const phi = 180 - (180 - phiEnd) * Math.min(1, u);
    let inset2 = inset + (n === 1 ? 0.035 : n === 2 ? 0.018 : 0.0);
    const p = A.torsoAng(y, phi, inset2);
    if (u < 0.08) { // 靠近脊椎時收向椎體
      const t = u / 0.08; const b = V(0.02, v.y, v.body.z - 0.004);
      return lerp(b, p, t);
    }
    return p;
  }
  A.ribPoint = ribPoint;

  // ---------- 幾何工具 ----------
  function curvePoints(pts, n) {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)), false, 'centripetal');
    return { curve: c, pts: c.getSpacedPoints(n) };
  }
  // 推出到體表以下 inset 處（避免穿入身體）
  function pushOut(p, inset, side) {
    let q = p;
    // 軀幹
    if (p.y > 0.84 && p.y < 1.47) {
      const pr = A.torsoProf(p.y);
      const Zs = p.z >= 0 ? pr.Zf : pr.Zb;
      const W = pr.W - inset, Z = Zs - inset;
      const e = Math.pow(Math.abs(p.x) / W, 2.6) + Math.pow(Math.abs(p.z) / Z, 2.6);
      if (e < 1 && e > 1e-6) { const k = 1 / Math.pow(e, 1 / 2.6); q = V(p.x * k, p.y, p.z * k); }
    }
    // 頸
    else if (p.y >= 1.47 && p.y < 1.55) {
      const pr = A.torsoProf(p.y);
      const W = pr.W - inset, Z = (p.z >= 0 ? pr.Zf : pr.Zb) - inset;
      const e = Math.pow(Math.abs(p.x) / W, 2.6) + Math.pow(Math.abs(p.z) / Z, 2.6);
      if (e < 1 && e > 1e-6) { const k = 1 / Math.pow(e, 1 / 2.6); q = V(p.x * k, p.y, p.z * k); }
    }
    // 頭
    if (p.y > 1.50) {
      const c = A.HEAD.c, r = A.HEAD.r; const dx = q.x - c.x, dy = q.y - c.y, dz = q.z - c.z;
      const e = (dx * dx) / Math.pow(r.x - inset, 2) + (dy * dy) / Math.pow(r.y - inset, 2) + (dz * dz) / Math.pow(r.z - inset, 2);
      if (e < 1 && e > 1e-6) { const k = 1 / Math.sqrt(e); q = V(c.x + dx * k, c.y + dy * k, c.z + dz * k); }
    }
    // 肢體
    const s = Math.sign(q.x) || side;
    { // 肩關節帽（三角肌）
      const c = M(A.J.shoulder, s); const rv = sub(q, c); const r = len(rv); const R = 0.054 - inset;
      if (r < R && r > 1e-5 && q.y > 1.30) q = add(c, mul(rv, R / r));
    }
    for (const seg of ['uarm', 'farm', 'thigh', 'leg']) {
      const F = A.segFrame(seg, s);
      const d = sub(q, F.A); const t = A.dot(d, F.ax) / F.L;
      if (t < 0.02 || t > 0.98) continue;
      const c = add(F.A, mul(F.ax, F.L * t)); const rv = sub(q, c); const r = len(rv);
      const R = F.r(t) - inset;
      if (r < R && r > 1e-5) q = add(c, mul(rv, R / r));
    }
    return q;
  }

  // 錐形管（兩端細）
  function taperTube(points3, rmax, opts = {}) {
    const segs = opts.segs || 40, rad = opts.radial || 7;
    const { curve } = curvePoints(points3, segs);
    const frames = curve.computeFrenetFrames(segs, false);
    const pos = [], nor = [], idx = [];
    const prof = opts.profile || ((t) => 0.28 + 0.72 * Math.pow(Math.sin(Math.PI * t), 0.55));
    for (let i = 0; i <= segs; i++) {
      const t = i / segs; const p = curve.getPointAt(t);
      const N = frames.normals[i], B = frames.binormals[i];
      const r = rmax * prof(t);
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2; const cs = Math.cos(a), sn = Math.sin(a);
        const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
        pos.push(p.x + r * nx, p.y + r * ny, p.z + r * nz); nor.push(nx, ny, nz);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = (i + 1) * (rad + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { pos, nor, idx };
  }
  function mergeParts(parts) {
    const pos = [], nor = [], idx = []; let off = 0;
    parts.forEach((p) => { pos.push(...p.pos); nor.push(...p.nor); p.idx.forEach((i) => idx.push(i + off)); off += p.pos.length / 3; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx); g.computeBoundingSphere();
    return g;
  }
  function tubeGeo(pts, r, segs = 24, radial = 8) {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)), false, 'centripetal');
    return new THREE.TubeGeometry(c, segs, r, radial, false);
  }
  function v3(p) { return new THREE.Vector3(p.x, p.y, p.z); }

  // 肌肉纖維產生器
  function polyAt(list, t, s) { // 沿多點邊線取 t
    if (list.length === 1) return P(list[0], s);
    const f = t * (list.length - 1); const i = Math.min(list.length - 2, Math.floor(f));
    return lerp(P(list[i], s), P(list[i + 1], s), f - i);
  }
  function muscleFibers(m, s) {
    const out = [];
    (m.fibers || []).forEach((f) => {
      if (Array.isArray(f)) { out.push(f.map((sp) => P(sp, s))); return; }
      // sheet：{o:[...], v:[[...],[...]], i:[...], n}
      const n = f.n || 5;
      for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0.5 : k / (n - 1);
        const pts = [polyAt(f.o, t, s)];
        (f.v || []).forEach((edge) => pts.push(polyAt(edge, t, s)));
        pts.push(polyAt(f.i, t, s));
        out.push(pts);
      }
    });
    return out;
  }

  // ---------- 場景 ----------
  function create(container, data, opts = {}) {
    const W0 = container.clientWidth, H0 = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W0, H0);
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, W0 / H0, 0.05, 20);
    camera.position.set(0, 0.95, 3.9);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.88, 0); controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minDistance = 0.35; controls.maxDistance = 5; controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.75));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(1.5, 2.5, 2.5); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.45); d2.position.set(-1.5, 1.5, -2.5); scene.add(d2);

    const groups = { skin: new THREE.Group(), bone: new THREE.Group(), muscle: new THREE.Group(), meridian: new THREE.Group(), sinew: new THREE.Group(), point: new THREE.Group() };
    Object.values(groups).forEach((g) => scene.add(g));

    // ---- 材質 ----
    const C = opts.colors || {};
    const matSkin = new THREE.MeshStandardMaterial({ color: C.skin || 0xd9b9a0, transparent: true, opacity: 0.16, roughness: 0.8, depthWrite: false, side: THREE.DoubleSide });
    const matBone = new THREE.MeshStandardMaterial({ color: C.bone || 0xe6dcc4, roughness: 0.7, metalness: 0.0 });
    const matBoneHi = new THREE.MeshStandardMaterial({ color: 0xf2b84b, roughness: 0.5, emissive: 0x5a3a00 });
    const matCart = new THREE.MeshStandardMaterial({ color: 0xbfd3d6, roughness: 0.6 });
    const muscleBase = C.muscle || 0xa8463d;

    // ---- 皮膚 ----
    (function buildSkin() {
      const ys = [], phis = 48; for (let y = 0.80; y <= 1.548; y += 0.012) ys.push(y);
      const pos = [], idx = [];
      ys.forEach((y) => { for (let j = 0; j <= phis; j++) { const p = A.torsoAng(y, (j / phis) * 360); pos.push(p.x, p.y, p.z); } });
      for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < phis; j++) { const a = i * (phis + 1) + j, b = a + phis + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      groups.skin.add(new THREE.Mesh(g, matSkin));
      const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), matSkin);
      head.scale.set(A.HEAD.r.x, A.HEAD.r.y, A.HEAD.r.z); head.position.copy(v3(A.HEAD.c)); groups.skin.add(head);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 12), matSkin); nose.position.set(0, 1.58, 0.106); nose.rotation.x = 0.35; groups.skin.add(nose);
      [1, -1].forEach((s) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), matSkin); ear.scale.set(0.012, 0.03, 0.02); ear.position.set(0.075 * s, 1.585, -0.005); groups.skin.add(ear);
        ['uarm', 'farm', 'thigh', 'leg'].forEach((seg) => {
          const F = A.segFrame(seg, s); const pts = [], N = 30;
          const rr = []; for (let i = 0; i <= N; i++) { pts.push(v3(add(F.A, mul(F.ax, F.L * i / N)))); rr.push(F.r(i / N)); }
          const c = new THREE.CatmullRomCurve3(pts);
          const tg = new THREE.TubeGeometry(c, N, 1, 20, false);
          const p = tg.attributes.position; // scale radius per ring
          for (let i = 0; i <= N; i++) for (let j = 0; j <= 20; j++) {
            const k = i * 21 + j; const center = c.getPointAt(i / N);
            const vx = p.getX(k) - center.x, vy = p.getY(k) - center.y, vz = p.getZ(k) - center.z;
            p.setXYZ(k, center.x + vx * rr[i], center.y + vy * rr[i], center.z + vz * rr[i]);
          }
          tg.computeVertexNormals(); groups.skin.add(new THREE.Mesh(tg, matSkin));
        });
        [['shoulder', 0.052], ['elbow', 0.037], ['wrist', 0.027], ['knee', 0.05], ['ankle', 0.033]].forEach(([j, r]) => {
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), matSkin); m.position.copy(v3(M(A.J[j], s))); groups.skin.add(m);
        });
        // 手掌
        const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), matSkin);
        const pc = A.handPt(s, 0.25, 0, 'p'); palm.position.set(pc.x, pc.y, pc.z - 0.012); palm.scale.set(0.044, 0.05, 0.016); palm.rotation.z = -0.12 * s; groups.skin.add(palm);
        for (let f = 1; f <= 5; f++) groups.skin.add(new THREE.Mesh(tubeGeo([A.fingerPt(s, f, 0), A.fingerPt(s, f, 0.5), A.fingerPt(s, f, 1)].map((p) => add(p, V(0, 0, -0.007))), f === 1 ? 0.010 : 0.0085, 8, 8), matSkin));
        // 足
        const fp = [], fi = []; const NU = 18, NA = 16;
        for (let i = 0; i <= NU; i++) {
          const u = i / NU; const c = A.footPt(s, u, 0, 'd'); const ml = A.footPt(s, u, -1, 'd'), lt = A.footPt(s, u, 1, 'd');
          const half = Math.abs(lt.x - ml.x) / 2 * (u < 0.06 ? 0.6 + u * 6 : u > 0.94 ? 0.6 + (1 - u) * 6 : 1);
          const top = Math.max(0.012, c.y) * (u < 0.05 ? 0.7 : 1); const cx = (ml.x + lt.x) / 2;
          for (let j = 0; j <= NA; j++) { const a = (j / NA) * Math.PI * 2; fp.push(cx + half * Math.cos(a), top / 2 + (top / 2) * Math.sin(a), c.z); }
        }
        for (let i = 0; i < NU; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; fi.push(a, b, a + 1, b, b + 1, a + 1); }
        const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals(); groups.skin.add(new THREE.Mesh(fg, matSkin));
      });
    })();

    // ---- 骨骼 ----
    const boneMeshes = {}; // id -> [mesh]
    function addBone(id, mesh, mat) { mesh.material = mat || matBone; mesh.userData = { kind: 'bone', id }; (boneMeshes[id] = boneMeshes[id] || []).push(mesh); groups.bone.add(mesh); return mesh; }
    (function buildBones() {
      // 頭骨
      const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20)); skull.scale.set(0.066, 0.085, 0.088); skull.position.set(0, 1.618, -0.006); addBone('skull', skull);
      const face = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16)); face.scale.set(0.052, 0.05, 0.05); face.position.set(0, 1.565, 0.045); addBone('skull', face);
      const mand = tubeGeo([A.LM('mandAngle', 1), V(0.035, 1.49, 0.07), V(0, 1.484, 0.085), V(-0.035, 1.49, 0.07), A.LM('mandAngle', -1)], 0.009, 30, 8); addBone('mandible', new THREE.Mesh(mand));
      [1, -1].forEach((s) => { addBone('mandible', new THREE.Mesh(tubeGeo([A.LM('mandAngle', s), M(V(0.056, 1.535, 0.02), s)], 0.008, 6, 6))); });
      // 脊椎
      A.SPINE.forEach(([n]) => {
        const v = A.VERT[n];
        const body = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r, v.h, 16)); body.position.copy(v3(v.body)); addBone('vert_' + n, body);
        const sp = new THREE.Mesh(tubeGeo([v.body, lerp(v.body, v.sp, 0.5), v.sp], n[0] === 'L' ? 0.006 : 0.004, 6, 6)); addBone('vert_' + n, sp);
        [1, -1].forEach((s) => {
          const tp = new THREE.Mesh(tubeGeo([V(0, v.y, v.body.z - 0.012), M(V(n[0] === 'L' ? 0.045 : n[0] === 'T' ? 0.032 : 0.028, v.y + (n[0] === 'T' ? 0.004 : 0), v.body.z - (n[0] === 'T' ? 0.02 : 0.01)), s)], 0.0035, 4, 6)); addBone('vert_' + n, tp);
        });
        if (n === 'C1') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 20)); ring.rotation.x = Math.PI / 2; ring.position.set(0, v.y, v.body.z - 0.01); addBone('vert_C1', ring); }
      });
      // 椎間盤
      for (let i = 0; i < A.SPINE.length - 1; i++) {
        const a = A.VERT[A.SPINE[i][0]], b = A.VERT[A.SPINE[i + 1][0]];
        if (a.name === 'C1') continue;
        const d = new THREE.Mesh(new THREE.CylinderGeometry(b.r * 0.95, b.r * 0.95, 0.004, 14), matCart); d.position.copy(v3(lerp(a.body, b.body, 0.5))); groups.bone.add(d);
      }
      // 薦椎（三角板）
      const sacPts = []; const sacRows = ['S1', 'S2', 'S3', 'S4', 'S5'];
      const sp = [], si = [];
      sacRows.forEach((n, i) => {
        const v = A.VERT[n]; const w = A.sacW[n];
        for (let j = 0; j <= 8; j++) { const x = -w + (2 * w * j) / 8; const bow = 0.012 * (1 - Math.pow(x / w, 2)); sp.push(x, v.y, v.body.z - bow * 0.5); }
      });
      // 前後兩層
      const front = sp.slice(); const back = []; for (let k = 0; k < sp.length; k += 3) back.push(sp[k], sp[k + 1], sp[k + 2] - 0.016);
      const all = front.concat(back); const off = front.length / 3;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const a = i * 9 + j, b = a + 9; si.push(a, b, a + 1, b, b + 1, a + 1); si.push(off + a, off + a + 1, off + b, off + b, off + a + 1, off + b + 1); }
      for (let i = 0; i < 4; i++) { [0, 8].forEach((j) => { const a = i * 9 + j, b = a + 9; si.push(a, off + a, b, b, off + a, off + b); }); }
      for (let j = 0; j < 8; j++) { si.push(j, j + 1, off + j, off + j, j + 1, off + j + 1); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(all, 3)); sg.setIndex(si); sg.computeVertexNormals();
      addBone('sacrum', new THREE.Mesh(sg, matBone)).material = matBone; groups.bone.children[groups.bone.children.length - 1].material.side = THREE.DoubleSide;
      // 薦椎正中嵴
      addBone('sacrum', new THREE.Mesh(tubeGeo(['S1', 'S2', 'S3', 'S4'].map((n) => A.VERT[n].sp), 0.004, 10, 6)));
      addBone('coccyx', new THREE.Mesh(tubeGeo([A.VERT.S5.body, V(0, 0.905, -0.078), V(0, 0.885, -0.068)], 0.006, 8, 6)));
      // 骨盆（無名骨）
      [1, -1].forEach((s) => {
        const id = s > 0 ? 'innominate_L' : 'innominate_R';
        const crest = [V(0.040, 0.998, -0.098), V(0.075, 1.040, -0.085), A.LM('crestTop', 1), V(0.150, 1.062, 0.030), V(0.118, 1.028, 0.078)];
        const lower = [V(0.040, 0.975, -0.075), V(0.062, 0.950, -0.060), V(0.095, 0.935, -0.020), V(0.108, 0.940, 0.020), V(0.104, 0.965, 0.062)];
        const NU = 16, NV = 8; const ip = [], ii = [];
        const cC = new THREE.CatmullRomCurve3(crest.map(v3)), cL = new THREE.CatmullRomCurve3(lower.map(v3));
        for (let i = 0; i <= NU; i++) { const a = cC.getPointAt(i / NU), b = cL.getPointAt(i / NU); for (let j = 0; j <= NV; j++) { const t = j / NV; const p = a.clone().lerp(b, t); const bulge = 0.012 * Math.sin(Math.PI * t) * Math.sin(Math.PI * i / NU); p.x += bulge; ip.push(p.x * s, p.y, p.z); } }
        for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; if (s > 0) ii.push(a, b, a + 1, b, b + 1, a + 1); else ii.push(a, a + 1, b, b, a + 1, b + 1); }
        const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.Float32BufferAttribute(ip, 3)); ig.setIndex(ii); ig.computeVertexNormals();
        const ilium = new THREE.Mesh(ig, new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.7, side: THREE.DoubleSide })); ilium.userData = { kind: 'bone', id }; (boneMeshes[id] = boneMeshes[id] || []).push(ilium); groups.bone.add(ilium);
        addBone(id, new THREE.Mesh(tubeGeo(crest.map((p) => M(p, s)), 0.0055, 30, 6)));
        // 坐骨、恥骨
        addBone(id, new THREE.Mesh(tubeGeo([M(V(0.095, 0.935, -0.02), s), M(V(0.085, 0.895, -0.045), s), A.LM('ischTub', s)], 0.012, 12, 8)));
        addBone(id, new THREE.Mesh(tubeGeo([A.LM('ischTub', s), M(V(0.048, 0.845, 0.0), s), A.LM('pubicRamusInf', s), M(V(0.012, 0.885, 0.074), s)], 0.008, 16, 8)));
        addBone(id, new THREE.Mesh(tubeGeo([M(V(0.098, 0.925, 0.04), s), M(V(0.06, 0.912, 0.07), s), M(V(0.012, 0.898, 0.078), s)], 0.008, 12, 8)));
        const acet = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2)); acet.rotation.z = s * Math.PI / 2 * 1.0; acet.position.copy(v3(M(V(0.098, 0.918, 0.014), s))); addBone(id, acet);
        // 薦髂關節區
        addBone(id, new THREE.Mesh(tubeGeo([M(V(0.042, 1.02, -0.07), s), M(V(0.048, 0.99, -0.072), s), M(V(0.042, 0.965, -0.075), s)], 0.008, 8, 6)));
      });
      // 肋骨與胸骨
      for (let n = 1; n <= 12; n++) [1, -1].forEach((s) => {
        const pts = []; const end = RIB_END[n];
        for (let i = 0; i <= 20; i++) pts.push(M(ribPoint(n, (i / 20) * end, 0.014), s));
        addBone('rib' + n, new THREE.Mesh(tubeGeo(pts, n === 1 ? 0.0045 : 0.0042, 40, 6)));
        if (n <= 10) { // 肋軟骨
          const last = pts[pts.length - 1]; let tgt;
          if (n <= 7) { const yy = [0, 1.405, 1.385, 1.36, 1.335, 1.31, 1.28, 1.25][n]; tgt = V(0.012 * s, yy, A.torsoPt(yy, 0.012, 'f', 0.014).z); }
          else { const r7 = M(ribPoint(7, RIB_END[7], 0.014), s); tgt = lerp(r7, last, 0.35); }
          groups.bone.add(new THREE.Mesh(tubeGeo([last, lerp(last, tgt, 0.5), tgt], 0.0035, 8, 6), matCart));
        }
      });
      const st = tubeGeo([V(0, 1.418, A.torsoPt(1.418, 0, 'f', 0.012).z), V(0, 1.33, A.torsoPt(1.33, 0, 'f', 0.012).z), V(0, 1.24, A.torsoPt(1.24, 0, 'f', 0.012).z)], 0.012, 12, 8);
      const stm = new THREE.Mesh(st); stm.scale.set(1.6, 1, 0.5); stm.position.z = 0; addBone('sternum', stm);
      stm.geometry.translate(0, 0, 0); // keep
      // 鎖骨、肩胛、上肢
      [1, -1].forEach((s) => {
        const side = s > 0 ? '_L' : '_R';
        addBone('clavicle' + side, new THREE.Mesh(tubeGeo([A.LM('sternoclav', s), A.LM('clavMid', s), M(V(0.15, 1.446, 0.03), s), A.LM('acromion', s)], 0.0065, 20, 8)));
        // 肩胛骨板：投影到背部
        const tri = [A.LM('scapSup', 1), A.LM('scapInf', 1), A.LM('scapGlen', 1)];
        const sp2 = [], si2 = []; const NN = 10;
        for (let i = 0; i <= NN; i++) for (let j = 0; j <= NN - i; j++) {
          const a = i / NN, b = j / NN, c = 1 - a - b;
          let p = V(tri[0].x * c + tri[1].x * a + tri[2].x * b, tri[0].y * c + tri[1].y * a + tri[2].y * b, 0);
          const back = A.torsoPt(p.y, Math.min(p.x, A.torsoProf(p.y).W - 0.01), 'b', 0.022);
          const zz = b > 0.7 ? lerp(back, tri[2], (b - 0.7) / 0.3).z : back.z;
          sp2.push(p.x * s, p.y, zz);
        }
        let k = 0; const rowStart = []; for (let i = 0; i <= NN; i++) { rowStart.push(k); k += NN - i + 1; }
        for (let i = 0; i < NN; i++) for (let j = 0; j < NN - i; j++) {
          const a = rowStart[i] + j, b = rowStart[i] + j + 1, c = rowStart[i + 1] + j; si2.push(a, c, b);
          if (j < NN - i - 1) { const d = rowStart[i + 1] + j + 1; si2.push(b, c, d); }
        }
        const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.Float32BufferAttribute(sp2, 3)); sg2.setIndex(si2); sg2.computeVertexNormals();
        const scap = new THREE.Mesh(sg2, new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.7, side: THREE.DoubleSide })); scap.userData = { kind: 'bone', id: 'scapula' + side }; (boneMeshes['scapula' + side] = boneMeshes['scapula' + side] || []).push(scap); groups.bone.add(scap);
        addBone('scapula' + side, new THREE.Mesh(tubeGeo([A.LM('scapMedSpine', s), M(V(0.12, 1.405, -0.098), s), M(V(0.165, 1.43, -0.07), s), A.LM('acromion', s)], 0.006, 16, 6)));
        addBone('scapula' + side, new THREE.Mesh(tubeGeo([A.LM('scapSup', s), A.LM('scapMedSpine', s), M(V(0.082, 1.31, -0.098), s), A.LM('scapInf', s)], 0.004, 16, 6)));
        addBone('scapula' + side, new THREE.Mesh(tubeGeo([M(V(0.155, 1.408, 0.0), s), A.LM('coracoid', s)], 0.005, 4, 6)));
        // 肱骨
        const hh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12)); hh.position.copy(v3(M(A.J.shoulder, s))); addBone('humerus' + side, hh);
        addBone('humerus' + side, new THREE.Mesh(tubeGeo([M(A.J.shoulder, s), A.LM('deltTub', s), M(V(0.224, 1.15, -0.032), s)], 0.010, 16, 8)));
        addBone('humerus' + side, new THREE.Mesh(tubeGeo([A.LM('medEpi', s), M(A.J.elbow, s), A.LM('latEpi', s)], 0.009, 8, 8)));
        // 橈尺骨
        addBone('radius' + side, new THREE.Mesh(tubeGeo([M(V(0.245, 1.11, -0.022), s), M(V(0.268, 0.99, -0.004), s), A.LM('radStyl', s)], 0.0065, 16, 8)));
        addBone('ulna' + side, new THREE.Mesh(tubeGeo([A.LM('olecranon', s), M(V(0.212, 1.08, -0.04), s), M(V(0.228, 0.97, -0.022), s), A.LM('ulnStyl', s)], 0.006, 16, 8)));
        // 手骨
        const carp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.014)); const cp = A.handPt(s, 0.05, 0, 'p'); carp.position.set(cp.x, cp.y, cp.z - 0.012); addBone('hand' + side, carp);
        for (let f = 1; f <= 5; f++) {
          const base = f === 1 ? A.handPt(s, 0.08, 0.9, 'p') : A.handPt(s, 0.1, [0, 0, 0.72, 0.24, -0.24, -0.72][f], 'p');
          const mcp = A.fingerPt(s, f, 0); const tip = A.fingerPt(s, f, 0.95);
          addBone('hand' + side, new THREE.Mesh(tubeGeo([add(base, V(0, 0, -0.012)), add(mcp, V(0, 0, -0.007))], 0.004, 6, 6)));
          addBone('hand' + side, new THREE.Mesh(tubeGeo([add(mcp, V(0, 0, -0.007)), add(lerp(mcp, tip, 0.5), V(0, 0, -0.007)), add(tip, V(0, 0, -0.007))], 0.0035, 8, 6)));
        }
      });
      // 下肢骨
      [1, -1].forEach((s) => {
        const side = s > 0 ? '_L' : '_R';
        const fh = new THREE.Mesh(new THREE.SphereGeometry(0.023, 16, 12)); fh.position.copy(v3(M(A.J.hip, s))); addBone('femur' + side, fh);
        addBone('femur' + side, new THREE.Mesh(tubeGeo([M(A.J.hip, s), M(V(0.125, 0.905, 0.006), s), A.LM('gTroch', s)], 0.013, 8, 8)));
        addBone('femur' + side, new THREE.Mesh(tubeGeo([A.LM('gTroch', s), M(V(0.14, 0.86, 0.0), s), M(V(0.118, 0.70, 0.004), s), M(V(0.10, 0.535, 0.0), s)], 0.0135, 24, 8)));
        const lt = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8)); lt.position.copy(v3(A.LM('lTroch', s))); addBone('femur' + side, lt);
        ['femLatCond', 'femMedCond'].forEach((c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10)); m.position.copy(v3(A.LM(c, s))); m.scale.set(1, 0.85, 1.2); addBone('femur' + side, m); });
        const pat = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10)); pat.scale.set(0.02, 0.024, 0.009); pat.position.copy(v3(A.LM('patella', s))); addBone('patella' + side, pat);
        addBone('tibia' + side, new THREE.Mesh(tubeGeo([M(V(0.08, 0.478, 0.0), s), M(V(0.12, 0.478, 0.0), s)], 0.02, 4, 10)));
        addBone('tibia' + side, new THREE.Mesh(tubeGeo([M(V(0.098, 0.47, 0.01), s), A.LM('tibTub', s), M(V(0.092, 0.30, 0.012), s), M(V(0.082, 0.10, 0.0), s)], 0.012, 24, 8)));
        const mm = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8)); mm.position.copy(v3(A.LM('medMall', s))); addBone('tibia' + side, mm);
        addBone('fibula' + side, new THREE.Mesh(tubeGeo([A.LM('fibHead', s), M(V(0.134, 0.30, -0.02), s), A.LM('latMall', s)], 0.0055, 24, 6)));
        const fhd = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8)); fhd.position.copy(v3(A.LM('fibHead', s))); addBone('fibula' + side, fhd);
        const lm = new THREE.Mesh(new THREE.SphereGeometry(0.010, 10, 8)); lm.position.copy(v3(A.LM('latMall', s))); addBone('fibula' + side, lm);
        // 足骨
        addBone('foot' + side, new THREE.Mesh(tubeGeo([A.LM('calcaneus', s), M(V(0.096, 0.035, -0.02), s), M(V(0.10, 0.05, 0.02), s)], 0.017, 10, 8)));
        const talus = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10)); talus.position.copy(v3(M(V(0.092, 0.06, -0.008), s))); addBone('foot' + side, talus);
        for (let t = 1; t <= 5; t++) {
          const w = [0, -0.85, -0.42, 0.0, 0.42, 0.82][t];
          const b = A.footPt(s, 0.42, w * 0.8, 'd'); const h = A.footPt(s, 0.78, w, 'd');
          addBone('foot' + side, new THREE.Mesh(tubeGeo([add(b, V(0, -0.012, 0)), add(h, V(0, -0.008, 0))], t === 1 ? 0.007 : 0.0045, 6, 6)));
          addBone('foot' + side, new THREE.Mesh(tubeGeo([add(h, V(0, -0.008, 0)), add(A.toePt(s, t, 0.85), V(0, -0.006, 0))], t === 1 ? 0.0065 : 0.004, 6, 6)));
        }
      });
    })();

    // ---- 肌肉 ----
    const muscleMeshes = {}; // id -> [mesh(L), mesh(R)]
    (data.muscles || []).forEach((m) => {
      const sides = m.mid ? [1] : [1, -1];
      sides.forEach((s) => {
        const parts = [];
        muscleFibers(m, s).forEach((pts) => {
          const { pts: dense } = curvePoints(pts, 26);
          const pp = m.deep ? dense.map((q) => V(q.x, q.y, q.z)) : dense.map((q) => pushOut(V(q.x, q.y, q.z), m.inset != null ? m.inset : 0.012, s));
          parts.push(taperTube(pp, m.r || 0.006, { segs: 30, radial: 7, profile: m.profile }));
        });
        if (!parts.length) return;
        const mat = new THREE.MeshStandardMaterial({ color: muscleBase, roughness: 0.55, metalness: 0.0, transparent: true, opacity: 0.92 });
        const mesh = new THREE.Mesh(mergeParts(parts), mat);
        mesh.userData = { kind: 'muscle', id: m.id, side: s };
        (muscleMeshes[m.id] = muscleMeshes[m.id] || []).push(mesh); groups.muscle.add(mesh);
      });
    });

    // ---- 經絡 / 經筋 / 穴位 ----
    function densify(specs, s) {
      const out = [];
      for (let i = 0; i < specs.length; i++) {
        const a = specs[i], b = specs[i + 1];
        out.push(P(a, s));
        if (!b) break;
        // 同類型參數插值，沿體表
        if (a[0] === b[0] && (a[0] === 'L' ? a[1] === b[1] : true) && ['T', 'L', 'H', 'TA'].includes(a[0])) {
          const n = 6;
          for (let k = 1; k < n; k++) {
            const t = k / n; const c = a.slice();
            for (let q = 1; q < a.length; q++) if (typeof a[q] === 'number' && typeof b[q] === 'number') c[q] = a[q] + (b[q] - a[q]) * t;
            if (a[0] === 'T' || a[0] === 'H') c[3] = a[3];
            out.push(P(c, s));
          }
        }
      }
      return out;
    }
    const merMeshes = {}, sinewMeshes = {};
    (data.meridians || []).forEach((mer) => {
      const sides = mer.mid ? [1] : [1, -1];
      sides.forEach((s) => {
        (mer.paths || [mer.path]).forEach((path) => {
          const pts = densify(path, s).map((q) => pushOut(q, -0.0028, s));
          const mat = new THREE.MeshBasicMaterial({ color: mer.color, transparent: true, opacity: 0.95 });
          const mesh = new THREE.Mesh(tubeGeo(pts, 0.0026, Math.max(30, pts.length * 3), 6), mat);
          mesh.userData = { kind: 'meridian', id: mer.id };
          (merMeshes[mer.id] = merMeshes[mer.id] || []).push(mesh); groups.meridian.add(mesh);
        });
      });
    });
    (data.sinews || []).forEach((sw) => {
      [1, -1].forEach((s) => {
        (sw.paths || []).forEach((path) => {
          const pts = densify(path, s).map((q) => pushOut(q, -0.004, s));
          const mat = new THREE.MeshStandardMaterial({ color: sw.color, transparent: true, opacity: 0.38, roughness: 0.6, depthWrite: false });
          const mesh = new THREE.Mesh(tubeGeo(pts, 0.009, Math.max(30, pts.length * 3), 8), mat);
          mesh.userData = { kind: 'sinew', id: sw.id };
          (sinewMeshes[sw.id] = sinewMeshes[sw.id] || []).push(mesh); groups.sinew.add(mesh);
        });
        (sw.knots || []).forEach((k) => {
          const p = P(k.at, s); const m = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 10), new THREE.MeshStandardMaterial({ color: sw.color, transparent: true, opacity: 0.75 }));
          m.position.copy(v3(p)); m.userData = { kind: 'sinew', id: sw.id, knot: k.name }; (sinewMeshes[sw.id] = sinewMeshes[sw.id] || []).push(m); groups.sinew.add(m);
        });
      });
    });
    const pointMeshes = {}; const pointPos = {};
    const ptGeo = new THREE.SphereGeometry(0.0058, 12, 10);
    (data.points || []).forEach((pt) => {
      const mer = (data.meridians || []).find((m) => m.id === pt.mer);
      const sides = pt.mid ? [1] : [1, -1];
      sides.forEach((s) => {
        const p = pushOut(P(pt.at, s), -0.003, s);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: mer ? mer.color : 0x333333, emissiveIntensity: 0.55, roughness: 0.4 });
        const m = new THREE.Mesh(ptGeo, mat); m.position.copy(v3(p)); m.userData = { kind: 'point', id: pt.id };
        (pointMeshes[pt.id] = pointMeshes[pt.id] || []).push(m); groups.point.add(m);
        (pointPos[pt.id] = pointPos[pt.id] || []).push(p);
      });
    });

    // ---- 標籤 ----
    const labelLayer = document.createElement('div'); labelLayer.className = 'b3-labels'; container.appendChild(labelLayer);
    let labels = []; // {el, pos}
    function setLabels(list) { labelLayer.innerHTML = ''; labels = list.map((l) => { const el = document.createElement('div'); el.className = 'b3-label' + (l.cls ? ' ' + l.cls : ''); el.textContent = l.text; labelLayer.appendChild(el); return { el, pos: new THREE.Vector3(l.pos.x, l.pos.y, l.pos.z) }; }); }
    function updateLabels() {
      const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
      const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
      labels.forEach((l) => {
        const p = l.pos.clone().project(camera);
        const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
        l.el.style.display = vis ? '' : 'none';
        l.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px)`;
      });
    }

    // ---- 狀態與顯示 ----
    const state = { sel: null, muscleStates: {} };
    const COL = { base: new THREE.Color(muscleBase), sel: new THREE.Color(0xff7a2f), tight: new THREE.Color(0xd8231b), weak: new THREE.Color(0x3d7fd1), dim: new THREE.Color(0x9b8a86) };
    function refresh() {
      const sel = state.sel; const anySel = !!sel; const ms = state.muscleStates; const anyState = Object.keys(ms).length > 0;
      Object.entries(muscleMeshes).forEach(([id, meshes]) => meshes.forEach((m) => {
        const st = ms[id] && (ms[id][m.userData.side > 0 ? 'L' : 'R'] ?? ms[id].both);
        let c = COL.base, op = 0.92, em = 0;
        if (anyState) { c = COL.dim; op = 0.18; }
        if (st) { const lv = Math.min(1, Math.abs(st)); c = st > 0 ? COL.tight : COL.weak; op = 0.55 + 0.4 * lv; em = 0.15 + 0.35 * lv; }
        if (anySel) { if (sel.kind === 'muscle' && sel.ids.includes(id)) { c = COL.sel; op = 1; em = 0.35; } else if (!st) { op = sel.kind === 'muscle' ? 0.1 : 0.35; } }
        m.material.color.copy(c); m.material.opacity = op; m.material.emissive = c.clone().multiplyScalar(em); m.material.depthWrite = op > 0.5; m.renderOrder = op > 0.5 ? 2 : 1;
      }));
      Object.entries(merMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { m.material.opacity = !anySel || sel.kind === 'point' || (sel.kind === 'meridian' && sel.ids.includes(id)) ? 0.95 : 0.12; }));
      Object.entries(sinewMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { m.material.opacity = !anySel || (sel.kind === 'sinew' && sel.ids.includes(id)) ? (m.userData.knot ? 0.8 : 0.45) : 0.06; }));
      Object.entries(pointMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { const on = anySel && sel.kind === 'point' && sel.ids.includes(id); m.scale.setScalar(on ? 2.1 : 1); m.material.emissiveIntensity = on ? 1.2 : 0.55; }));
      Object.entries(boneMeshes).forEach(([id, meshes]) => meshes.forEach((m) => { if (!m.userData._mat) m.userData._mat = m.material; m.material = anySel && sel.kind === 'bone' && sel.ids.some((b) => id.startsWith(b)) ? matBoneHi : m.userData._mat; }));
    }
    function centroid(meshes) { const box = new THREE.Box3(); meshes.forEach((m) => box.expandByObject(m)); const c = new THREE.Vector3(); box.getCenter(c); return c; }
    function select(kind, ids, opt = {}) {
      ids = [].concat(ids || []);
      state.sel = ids.length ? { kind, ids } : null;
      refresh();
      const lab = [];
      if (state.sel) {
        const pool = kind === 'muscle' ? muscleMeshes : kind === 'meridian' ? merMeshes : kind === 'sinew' ? sinewMeshes : kind === 'point' ? pointMeshes : boneMeshes;
        let meshes = [];
        ids.forEach((id) => { Object.keys(pool).forEach((k) => { if (k === id || (kind === 'bone' && k.startsWith(id))) meshes = meshes.concat(pool[k]); }); });
        if (kind === 'point') ids.forEach((id) => (pointPos[id] || []).forEach((p, i) => { if (i === 0 || opt.bothLabels) lab.push({ text: (data.points.find((x) => x.id === id) || {}).name || id, pos: p, cls: 'pt' }); }));
        else if (kind === 'muscle') ids.forEach((id) => { const ms = muscleMeshes[id]; if (ms && ms[0]) { const c = centroid([ms[0]]); const m = data.muscles.find((x) => x.id === id); lab.push({ text: m ? m.name : id, pos: c, cls: 'mu' }); } });
        if (meshes.length && opt.focus !== false) {
          const c = centroid(meshes); let dir = null;
          if (kind === 'point' || kind === 'muscle') {
            let zs = 0, xs = 0; meshes.forEach((m) => { const b = new THREE.Box3().setFromObject(m); const cc = new THREE.Vector3(); b.getCenter(cc); zs += cc.z - (cc.y > 0.84 && cc.y < 1.47 ? -0.005 : 0); xs += Math.abs(cc.x); });
            zs /= meshes.length; xs /= meshes.length;
            const sideish = xs > 0.17 && Math.abs(zs) < 0.03;
            dir = sideish ? new THREE.Vector3(1, 0.12, Math.sign(zs) * 0.4 || 0.4) : new THREE.Vector3(0, 0.12, zs >= -0.01 ? 1 : -1);
            dir.normalize();
          }
          focusOn(c, opt.dist, dir);
        }
      }
      if (opt.labels) opt.labels.forEach((l) => lab.push(l));
      setLabels(lab);
    }
    let anim = null;
    function focusOn(c, dist, dirIn) {
      const from = controls.target.clone(); const camFrom = camera.position.clone();
      const dir = dirIn ? dirIn.clone() : camera.position.clone().sub(controls.target).normalize();
      const d = dist || Math.min(1.6, Math.max(0.9, camera.position.distanceTo(controls.target)));
      const camTo = c.clone().add(dir.multiplyScalar(d));
      const t0 = performance.now();
      anim = (now) => { const t = Math.min(1, (now - t0) / 500); const e = t * t * (3 - 2 * t); controls.target.lerpVectors(from, c, e); camera.position.lerpVectors(camFrom, camTo, e); if (t >= 1) anim = null; };
    }
    function view(name) {
      const tgt = controls.target.clone(); const d = Math.max(1.2, camera.position.distanceTo(tgt));
      const dirs = { front: [0, 0.05, 1], back: [0, 0.05, -1], left: [1, 0.05, 0], right: [-1, 0.05, 0], top: [0, 1, 0.01] };
      const dv = new THREE.Vector3(...dirs[name]).normalize();
      const camTo = tgt.clone().add(dv.multiplyScalar(d)); const camFrom = camera.position.clone(); const t0 = performance.now();
      anim = (now) => { const t = Math.min(1, (now - t0) / 500); const e = t * t * (3 - 2 * t); camera.position.lerpVectors(camFrom, camTo, e); if (t >= 1) anim = null; };
    }
    function reset() { const camFrom = camera.position.clone(), tFrom = controls.target.clone(); const t0 = performance.now(); const camTo = new THREE.Vector3(0, 0.95, 3.9), tTo = new THREE.Vector3(0, 0.88, 0); anim = (now) => { const t = Math.min(1, (now - t0) / 500); const e = t * t * (3 - 2 * t); camera.position.lerpVectors(camFrom, camTo, e); controls.target.lerpVectors(tFrom, tTo, e); if (t >= 1) anim = null; }; }
    function skinMode() {
      const see = groups.muscle.visible || groups.bone.visible;
      matSkin.opacity = see ? 0.16 : 0.96; matSkin.depthWrite = !see; matSkin.transparent = see; matSkin.needsUpdate = true;
      groups.skin.children.forEach((m) => { m.renderOrder = see ? 3 : 0; });
    }
    function setLayer(name, on) { if (groups[name]) groups[name].visible = on; skinMode(); }

    // ---- 點選 ----
    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let down = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera); ray.params.Line = { threshold: 0.01 };
      const order = ['point', 'meridian', 'sinew', 'muscle', 'bone'];
      const objs = []; order.forEach((g) => { if (groups[g].visible) groups[g].traverse((o) => { if (o.isMesh && o.userData.kind && o.material.opacity > 0.15) objs.push(o); }); });
      const hits = ray.intersectObjects(objs, false);
      if (!hits.length) { opts.onPick && opts.onPick(null); return; }
      // 穴位優先（若很接近）
      const pt = hits.find((h) => h.object.userData.kind === 'point' && h.distance - hits[0].distance < 0.03);
      const h = pt || hits[0];
      opts.onPick && opts.onPick(h.object.userData);
    });

    function resize() { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(container);
    let running = true;
    function loop(now) { if (!running) return; requestAnimationFrame(loop); if (anim) anim(now); controls.update(); renderer.render(scene, camera); updateLabels(); }
    requestAnimationFrame(loop);
    refresh(); skinMode();
    return {
      select, view, reset, setLayer, refresh,
      setMuscleStates(ms) { state.muscleStates = ms || {}; refresh(); },
      clear() { state.sel = null; refresh(); setLabels([]); },
      renderer, camera, controls, scene,
    };
  }
  A.pushOut = pushOut; A.muscleFibers = muscleFibers; A.curvePoints = curvePoints;
  window.Body3D = { create };
})();
