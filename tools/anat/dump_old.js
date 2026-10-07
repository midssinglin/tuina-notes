global.window = global;
global.THREE = require('/home/claude/site/vendor/three.min.js');
const fs = require('fs');
const load = (f) => eval(fs.readFileSync(f, 'utf8'));
load('/home/claude/anat/build/anatomy_old.js');
load('/home/claude/anat/build/body3d_old.js');
['data_muscles', 'data_meridians'].forEach((f) => load('/home/claude/site/src/' + f + '.js'));
const A = window.ANAT, P = A.P;
const arr = (p) => [+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5)];
// region classification in old space
function region(p, sHint) {
  const s = Math.sign(p.x) || sHint; const sd = s > 0 ? 'L' : 'R';
  if (p.y > 1.47) return 'core';
  // hand
  const W = A.M(A.J.wrist, s);
  { const hc = A.handPt(s, 0.35, 0, 'p'); if (A.len(A.sub(p, hc)) < 0.085 || (p.y < W.y && Math.abs(p.x) > 0.2 && p.y > 0.6)) return 'arm' + sd; }
  if (p.y < 0.12) return 'leg' + sd;
  let best = null;
  for (const seg of ['uarm', 'farm', 'thigh', 'leg']) {
    const F = A.segFrame(seg, s); const d = A.sub(p, F.A); const t = A.dot(d, F.ax) / F.L;
    if (t < -0.05 || t > 1.05) continue;
    const c = A.add(F.A, A.mul(F.ax, F.L * t)); const r = A.len(A.sub(p, c)); const R = F.r(Math.min(1, Math.max(0, t)));
    if (r < R + 0.02) { const isArm = seg === 'uarm' || seg === 'farm'; const junction = (seg === 'uarm' && t < 0.18) || (seg === 'thigh' && t < 0.12);
      best = (junction ? 'j' : '') + (isArm ? 'arm' : 'leg') + sd; if (!junction) return best; }
  }
  return best || 'core';
}
function densify(specs, s) {
  const out = [];
  for (let i = 0; i < specs.length; i++) {
    const a = specs[i], b = specs[i + 1];
    out.push(P(a, s)); if (!b) break;
    if (a[0] === b[0] && (a[0] === 'L' ? a[1] === b[1] : true) && ['T', 'L', 'H', 'TA'].includes(a[0])) {
      const n = 6;
      for (let k = 1; k < n; k++) { const t = k / n; const c = a.slice();
        for (let q = 1; q < a.length; q++) if (typeof a[q] === 'number' && typeof b[q] === 'number') c[q] = a[q] + (b[q] - a[q]) * t;
        if (a[0] === 'T' || a[0] === 'H') c[3] = a[3]; out.push(P(c, s)); }
    }
  }
  return out;
}
const surf = (p, s) => A.pushOut(p, 0, s);
const out = { lm: [], mer: {}, sinew: {}, points: {}, fibers: {} };
// landmarks
const LMN = ['EOP','occLine','mastoid','mandAngle','zygoma','temporal','sternumTop','manubrium','xiphoid','sternoclav','clavMid','acromion','coracoid','scapSup','scapInf','scapMedSpine','scapGlen','scapLatBorderMid','gTub','lTub','bicGroove','deltTub','latEpi','medEpi','olecranon','radTub','radStyl','ulnStyl','ASIS','AIIS','PSIS','crestTop','crestPost','iliacFossa','ischTub','pubicSym','pubicTub','pubicRamusInf','gTroch','lTroch','linAsp','femLatCond','femMedCond','patella','tibTub','tibMedCond','pesAns','fibHead','gerdy','latMall','medMall','calcaneus','navicular','base5MT','base1MT','headMT1','headMT5'];
[1, -1].forEach((s) => {
  LMN.forEach((n) => out.lm.push(['L:' + n, s, arr(A.LM(n, s))]));
  ['shoulder','elbow','wrist','handTip','hip','knee','ankle'].forEach((n) => out.lm.push(['J:' + n, s, arr(A.M(A.J[n], s))]));
  for (let f = 1; f <= 5; f++) { out.lm.push(['F:' + f, s, arr(A.fingerPt(s, f, 1))]); out.lm.push(['Fb:' + f, s, arr(A.fingerPt(s, f, 0))]); out.lm.push(['T:' + f, s, arr(A.toePt(s, f, 1))]); }
});
Object.keys(A.VERT).forEach((n) => { out.lm.push(['VB:' + n, 0, arr(A.VERT[n].body)]); out.lm.push(['SP:' + n, 0, arr(A.VERT[n].sp)]); });
// old surface samples (for surface correspondences)
out.surf = [];
// torso: y, phi
for (let y = 0.86; y <= 1.46; y += 0.03) for (let ph = 0; ph < 360; ph += 22.5) out.surf.push(['T', y, ph, arr(A.torsoAng(y, ph))]);
for (let y = 1.47; y <= 1.55; y += 0.02) for (let ph = 0; ph < 360; ph += 30) out.surf.push(['N', y, ph, arr(A.torsoAng(y, ph))]);
['uarm', 'farm', 'thigh', 'leg'].forEach((seg) => [1, -1].forEach((s) => { for (let t = 0.1; t <= 0.951; t += 0.085) for (let th = 0; th < 360; th += 30) out.surf.push(['S:' + seg, s, t, th, arr(A.limbPt(seg, s, t, th, 0))]); }));
// head: ellipsoid dirs
for (let el = -30; el <= 80; el += 20) for (let az = 0; az < 360; az += 30) { const e = el * Math.PI / 180, a = az * Math.PI / 180; const c = A.HEAD.c, r = A.HEAD.r; out.surf.push(['H', el, az, arr(A.V(c.x + r.x * Math.cos(e) * Math.sin(a), c.y + r.y * Math.sin(e), c.z + r.z * Math.cos(e) * Math.cos(a)))]); }
window.MERIDIANS.forEach((mer) => {
  const sides = mer.mid ? [1] : [1, -1]; out.mer[mer.id] = [];
  sides.forEach((s) => (mer.paths || [mer.path]).forEach((path) => { const pts = densify(path, s).map((q) => surf(q, s)); out.mer[mer.id].push({ s, pts: pts.map(arr), reg: pts.map((p) => region(p, s)) }); }));
});
window.SINEWS.forEach((sw) => {
  const o = out.sinew[sw.id] = { paths: [], knots: [] };
  [1, -1].forEach((s) => {
    (sw.paths || []).forEach((path) => { const pts = densify(path, s).map((q) => surf(q, s)); o.paths.push({ s, pts: pts.map(arr), reg: pts.map((p) => region(p, s)) }); });
    (sw.knots || []).forEach((k) => { const p = surf(P(k.at, s), s); o.knots.push({ s, name: k.name, p: arr(p), reg: region(p, s) }); });
  });
});
window.POINTS.forEach((pt) => {
  const sides = pt.mid ? [1] : [1, -1];
  out.points[pt.id] = sides.map((s) => { const p = surf(P(pt.at, s), s); return { s, p: arr(p), reg: region(p, s) }; });
});
window.MUSCLES.forEach((m) => {
  const sides = m.mid ? [1] : [1, -1];
  out.fibers[m.id] = sides.map((s) => ({ s, lines: A.muscleFibers(m, s).map((pts) => { const d = A.curvePoints(pts, 20).pts.map((q) => A.V(q.x, q.y, q.z)); return (m.deep ? d : d.map((q) => A.pushOut(q, m.inset != null ? m.inset : 0.012, s))).map(arr); }) }));
});
fs.writeFileSync('/home/claude/anat/build/old.json', JSON.stringify(out));
console.log('lm', out.lm.length, 'surf', out.surf.length, 'mer', Object.keys(out.mer).length, 'pts', Object.keys(out.points).length);
