/* ===== 解剖座標系統 =====
   單位：公尺，身高約 1.70，腳底 y=0。受試者面向 +z，受試者左側為 +x。
   s = +1 左側，-1 右側。所有點以函式產生，肌肉／經絡／穴位共用同一套座標。 */
(function () {
  const V = (x, y, z) => ({ x, y, z });
  const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, k) => V(a.x * k, a.y * k, a.z * k);
  const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  const len = (a) => Math.hypot(a.x, a.y, a.z);
  const norm = (a) => { const l = len(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const M = (p, s) => V(p.x * s, p.y, p.z); // mirror helper: p 以左側(+x)定義

  // ---- 軀幹截面表 y, 半寬 W, 前 Zf, 後 Zb, 中心 x 偏移 0 ----
  const TORSO = [
    [0.80, 0.150, 0.060, 0.090],
    [0.84, 0.172, 0.072, 0.118],
    [0.88, 0.178, 0.078, 0.126],
    [0.92, 0.176, 0.082, 0.120],
    [0.98, 0.164, 0.090, 0.104],
    [1.04, 0.150, 0.100, 0.090],
    [1.10, 0.134, 0.096, 0.084],
    [1.16, 0.138, 0.096, 0.088],
    [1.22, 0.148, 0.104, 0.098],
    [1.28, 0.158, 0.114, 0.104],
    [1.34, 0.164, 0.120, 0.108],
    [1.39, 0.166, 0.112, 0.106],
    [1.425, 0.155, 0.090, 0.098],
    [1.455, 0.100, 0.058, 0.078],
    [1.475, 0.060, 0.046, 0.062],
    [1.51, 0.054, 0.046, 0.056],
    [1.545, 0.052, 0.046, 0.052],
  ];
  function interp(tab, y, col) {
    if (y <= tab[0][0]) return tab[0][col];
    if (y >= tab[tab.length - 1][0]) return tab[tab.length - 1][col];
    for (let i = 0; i < tab.length - 1; i++) {
      const a = tab[i], b = tab[i + 1];
      if (y >= a[0] && y <= b[0]) {
        const t = (y - a[0]) / (b[0] - a[0]);
        // catmull-rom
        const p0 = (tab[i - 1] || a)[col], p1 = a[col], p2 = b[col], p3 = (tab[i + 2] || b)[col];
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      }
    }
  }
  const SE = 2.6; // superellipse exponent
  function torsoProf(y) { return { W: interp(TORSO, y, 1), Zf: interp(TORSO, y, 2), Zb: interp(TORSO, y, 3) }; }
  // 軀幹表面點：x 為距中線距離（帶正負），face 'f' 前 / 'b' 後，inset 內縮
  function torsoPt(y, x, face, inset = 0) {
    const p = torsoProf(y);
    const W = Math.max(0.01, p.W - inset);
    const ax = Math.min(Math.abs(x) / W, 0.999);
    const Z = (face === 'f' ? p.Zf : p.Zb) - inset;
    const z = Z * Math.pow(1 - Math.pow(ax, SE), 1 / SE);
    return V(x, y, face === 'f' ? z : -z);
  }
  // 以角度表示：phi 0=正前，90=左側，180=正後，270=右側
  function torsoAng(y, phiDeg, inset = 0) {
    const p = torsoProf(y), ph = phiDeg * Math.PI / 180;
    const sx = Math.sin(ph), cz = Math.cos(ph);
    const W = p.W - inset, Z = (cz >= 0 ? p.Zf : p.Zb) - inset;
    const e = 2 / SE;
    return V(W * Math.sign(sx) * Math.pow(Math.abs(sx), e), y, Z * Math.sign(cz) * Math.pow(Math.abs(cz), e));
  }

  // ---- 頭部（橢球）----
  const HEAD = { c: V(0, 1.595, 0.008), r: V(0.074, 0.108, 0.096) };
  function headPt(y, x, face, inset = 0) {
    const c = HEAD.c, r = HEAD.r;
    const dy = (y - c.y) / (r.y - inset);
    const k = Math.max(0, 1 - dy * dy);
    const rx = (r.x - inset) * Math.sqrt(k), rz = (r.z - inset) * Math.sqrt(k);
    const ax = Math.min(Math.abs(x) / Math.max(rx, 1e-4), 0.999);
    const z = rz * Math.sqrt(1 - ax * ax);
    return V(x, y, c.z + (face === 'f' ? z : -z));
  }

  // ---- 脊椎 ----
  const SPINE = [
    ['C1', 1.528, 0.002], ['C2', 1.512, 0.004], ['C3', 1.498, 0.007], ['C4', 1.485, 0.008], ['C5', 1.472, 0.006], ['C6', 1.459, 0.0], ['C7', 1.445, -0.010],
    ['T1', 1.428, -0.022], ['T2', 1.410, -0.032], ['T3', 1.391, -0.041], ['T4', 1.371, -0.048], ['T5', 1.351, -0.053], ['T6', 1.330, -0.056],
    ['T7', 1.309, -0.057], ['T8', 1.287, -0.056], ['T9', 1.265, -0.053], ['T10', 1.243, -0.048], ['T11', 1.221, -0.042], ['T12', 1.198, -0.035],
    ['L1', 1.172, -0.027], ['L2', 1.143, -0.019], ['L3', 1.113, -0.014], ['L4', 1.082, -0.014], ['L5', 1.051, -0.020],
  ];
  const VERT = {};
  SPINE.forEach(([n, y, z]) => {
    const back = torsoPt(y, 0, 'b').z;
    const cerv = n[0] === 'C';
    VERT[n] = {
      name: n, y, body: V(0, y, z),
      sp: V(0, y - (cerv ? 0.006 : n[0] === 'T' ? 0.014 : 0.008), back + (n === 'C7' || n === 'T1' ? 0.008 : 0.013)),
      r: cerv ? 0.011 : n[0] === 'T' ? 0.0135 + 0.004 * (parseInt(n.slice(1)) / 12) : 0.019,
      h: cerv ? 0.009 : n[0] === 'T' ? 0.015 : 0.022,
    };
  });
  // 薦椎各節（後表面中線點）
  const SAC = [['S1', 1.022, -0.048], ['S2', 0.996, -0.064], ['S3', 0.970, -0.076], ['S4', 0.946, -0.084], ['S5', 0.924, -0.088], ['Co', 0.895, -0.082]];
  SAC.forEach(([n, y, z]) => { VERT[n] = { name: n, y, body: V(0, y, z), sp: V(0, y, z - 0.012 - (n === 'S1' ? 0.006 : 0)), r: 0.012, h: 0.02 }; });
  const sacW = { S1: 0.052, S2: 0.044, S3: 0.034, S4: 0.024, S5: 0.016, Co: 0.008 };

  // ---- 肢體段 ----
  const J = {
    shoulder: V(0.186, 1.405, -0.016), elbow: V(0.226, 1.118, -0.030), wrist: V(0.262, 0.866, 0.008), handTip: V(0.282, 0.688, 0.020),
    hip: V(0.090, 0.915, 0.014), knee: V(0.096, 0.505, 0.004), ankle: V(0.092, 0.085, -0.012),
  };
  const SEG = {
    uarm: { a: 'shoulder', b: 'elbow', r: (t) => 0.047 - 0.010 * t + 0.004 * Math.sin(Math.PI * t * 0.8) },
    farm: { a: 'elbow', b: 'wrist', r: (t) => 0.040 + 0.004 * Math.sin(Math.PI * Math.min(1, t * 2.2)) * (1 - t) - 0.013 * t },
    thigh: { a: 'hipSkin', b: 'knee', r: (t) => 0.086 - 0.036 * t + 0.006 * Math.sin(Math.PI * t) },
    leg: { a: 'knee', b: 'ankle', r: (t) => 0.050 + 0.012 * Math.exp(-Math.pow((t - 0.28) / 0.17, 2)) - 0.017 * t },
  };
  J.hipSkin = V(0.098, 0.885, 0.004);
  function segFrame(segName, s) {
    const sg = SEG[segName];
    const A = M(J[sg.a], s), B = M(J[sg.b], s);
    const ax = norm(sub(B, A));
    let f = V(0, 0, 1); f = norm(sub(f, mul(ax, dot(f, ax))));
    let l = norm(cross(ax, f)); if (l.x * s < 0) l = mul(l, -1);
    return { A, B, ax, f, l, L: len(sub(B, A)), r: sg.r };
  }
  // 肢體表面點：theta 0 前、90 外側、180 後、270 內側
  function limbPt(segName, s, t, thetaDeg, inset = 0) {
    const F = segFrame(segName, s), th = thetaDeg * Math.PI / 180;
    const r = F.r(t) - inset;
    const c = add(F.A, mul(F.ax, F.L * t));
    return add(c, add(mul(F.f, r * Math.cos(th)), mul(F.l, r * Math.sin(th))));
  }
  function limbAxis(segName, s, t) { const F = segFrame(segName, s); return add(F.A, mul(F.ax, F.L * t)); }

  // ---- 手（掌心向前，拇指在外側）----
  // u: 0 腕 → 1 指尖；w: -1 尺側(內) → +1 橈側(外)；face 'p' 掌 / 'd' 背
  function handPt(s, u, w, face = 'p') {
    const W = J.wrist;
    const y = W.y - 0.075 * Math.min(u, 1) * 1.0 - (u > 1 ? 0 : 0);
    const len = u <= 0.45 ? u / 0.45 * 0.085 : 0.085 + (u - 0.45) / 0.55 * 0.095;
    const x = W.x + 0.012 + w * 0.040 + len * 0.10;
    const z = W.z + 0.006 + (face === 'p' ? 0.013 : -0.013) * (u < 0.45 ? 1 : 0.6) + len * 0.04;
    return M(V(x, W.y - len, z), s);
  }
  // 手指：idx 1 拇指 … 5 小指，t 0 掌指關節 → 1 指尖
  function fingerPt(s, idx, t, side = 0, face = 'p') {
    const W = J.wrist;
    if (idx === 1) {
      const base = V(W.x + 0.045, W.y - 0.040, W.z + 0.020);
      const tip = V(W.x + 0.075, W.y - 0.105, W.z + 0.040);
      const p = lerp(base, tip, t);
      return M(add(p, V(side * 0.009, 0, face === 'p' ? 0.006 : -0.006)), s);
    }
    const w = [0, 0, 0.72, 0.24, -0.24, -0.72][idx];
    const lens = [0, 0, 0.078, 0.088, 0.082, 0.064][idx];
    const base = handPt(1, 0.45, w, 'p');
    const b = V(base.x, base.y, W.z + 0.012);
    const tip = V(b.x + 0.004 * w, b.y - lens, b.z + 0.012);
    const p = lerp(b, tip, t);
    return M(add(p, V(side * 0.0085, 0, face === 'p' ? 0.007 : -0.007)), s);
  }

  // ---- 足 ----
  // u: 0 足跟 → 1 趾尖；w: -1 內側 → +1 外側；face 'd' 足背 / 'p' 足底
  function footPt(s, u, w, face = 'd') {
    const A = J.ankle;
    const z = -0.065 + u * 0.255;
    const half = 0.026 + 0.018 * Math.min(1, u * 1.4);
    const x = A.x + 0.004 + w * half + u * 0.016;
    const top = u < 0.35 ? 0.075 - u * 0.03 : Math.max(0.018, 0.0645 - (u - 0.35) * 0.075);
    const y = face === 'p' ? 0.004 : top * (1 - 0.25 * Math.abs(w));
    return M(V(x, y, z), s);
  }
  function toePt(s, idx, t, face = 'd') {
    const w = [0, -0.85, -0.42, 0.0, 0.42, 0.82][idx];
    const b = footPt(1, 0.80, w, face);
    const tipZ = [0, 0.196, 0.192, 0.184, 0.176, 0.166][idx];
    const p = V(b.x + 0.002 * w, face === 'p' ? 0.005 : 0.016, b.z + (tipZ - b.z) * t);
    return M(p, s);
  }

  // ---- 骨性標誌 ----
  function LM(name, s = 1) {
    const T = (p) => M(p, s);
    switch (name) {
      case 'EOP': return V(0, 1.548, -0.090); // 枕外隆凸
      case 'occLine': return T(V(0.045, 1.545, -0.080)); // 上項線外側
      case 'mastoid': return T(V(0.058, 1.540, -0.020));
      case 'mandAngle': return T(V(0.050, 1.500, 0.030));
      case 'zygoma': return T(V(0.064, 1.590, 0.060));
      case 'temporal': return T(V(0.070, 1.630, 0.020));
      case 'sternumTop': return V(0, 1.422, 0.086);
      case 'manubrium': return V(0, 1.400, 0.098);
      case 'xiphoid': return V(0, 1.232, 0.106);
      case 'sternoclav': return T(V(0.022, 1.425, 0.080));
      case 'clavMid': return T(V(0.090, 1.440, 0.072));
      case 'acromion': return T(V(0.185, 1.448, -0.008));
      case 'coracoid': return T(V(0.150, 1.410, 0.040));
      case 'scapSup': return T(V(0.088, 1.418, -0.080));
      case 'scapInf': return T(V(0.098, 1.248, -0.086));
      case 'scapMedSpine': return T(V(0.074, 1.378, -0.096));
      case 'scapGlen': return T(V(0.165, 1.402, -0.030));
      case 'scapLatBorderMid': return T(V(0.140, 1.320, -0.070));
      case 'gTub': return T(V(0.208, 1.408, 0.004));
      case 'lTub': return T(V(0.192, 1.400, 0.022));
      case 'bicGroove': return T(V(0.200, 1.385, 0.022));
      case 'deltTub': return T(V(0.214, 1.270, -0.006));
      case 'latEpi': return T(V(0.253, 1.116, -0.030));
      case 'medEpi': return T(V(0.196, 1.116, -0.036));
      case 'olecranon': return T(V(0.222, 1.122, -0.058));
      case 'radTub': return T(V(0.236, 1.085, -0.006));
      case 'radStyl': return T(V(0.286, 0.868, 0.006));
      case 'ulnStyl': return T(V(0.240, 0.868, -0.008));
      case 'ASIS': return T(V(0.118, 1.028, 0.078));
      case 'AIIS': return T(V(0.104, 0.968, 0.064));
      case 'PSIS': return T(V(0.040, 0.998, -0.098));
      case 'crestTop': return T(V(0.142, 1.068, -0.018));
      case 'crestPost': return T(V(0.090, 1.058, -0.072));
      case 'iliacFossa': return T(V(0.090, 1.010, 0.030));
      case 'ischTub': return T(V(0.058, 0.852, -0.050));
      case 'pubicSym': return V(0, 0.892, 0.078);
      case 'pubicTub': return T(V(0.024, 0.896, 0.076));
      case 'pubicRamusInf': return T(V(0.036, 0.860, 0.052));
      case 'gTroch': return T(V(0.158, 0.905, -0.004));
      case 'lTroch': return T(V(0.112, 0.866, -0.012));
      case 'linAsp': return T(V(0.120, 0.700, -0.030));
      case 'femLatCond': return T(V(0.128, 0.505, -0.006));
      case 'femMedCond': return T(V(0.070, 0.508, -0.008));
      case 'patella': return T(V(0.100, 0.515, 0.050));
      case 'tibTub': return T(V(0.100, 0.450, 0.040));
      case 'tibMedCond': return T(V(0.075, 0.480, 0.004));
      case 'pesAns': return T(V(0.078, 0.448, 0.022));
      case 'fibHead': return T(V(0.136, 0.468, -0.014));
      case 'gerdy': return T(V(0.125, 0.468, 0.026));
      case 'latMall': return T(V(0.124, 0.068, -0.022));
      case 'medMall': return T(V(0.068, 0.078, -0.004));
      case 'calcaneus': return T(V(0.094, 0.030, -0.066));
      case 'navicular': return T(V(0.074, 0.048, 0.040));
      case 'base5MT': return T(V(0.128, 0.022, 0.050));
      case 'base1MT': return T(V(0.080, 0.032, 0.080));
      case 'headMT1': return T(V(0.086, 0.020, 0.150));
      case 'headMT5': return T(V(0.136, 0.014, 0.128));
      case 'navel': return V(0, 1.040, torsoPt(1.04, 0, 'f').z);
      default: throw new Error('no landmark ' + name);
    }
  }

  window.ANAT = { V, add, sub, mul, lerp, len, norm, dot, cross, M, torsoProf, torsoPt, torsoAng, headPt, HEAD, VERT, SPINE, SAC, sacW, J, SEG, segFrame, limbPt, limbAxis, handPt, fingerPt, footPt, toePt, LM };
})();
