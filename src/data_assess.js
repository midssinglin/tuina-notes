/* ===== 客人評估 v2：分站（主訴 → 站姿 → 坐姿 → 俯臥 → 仰臥 → 動作測試）、骨性標誌、處理建議 =====
   依課堂流程（k-eval-0903、k-eval-order）與整合說明 u-treatment-order 編排。
   item: { id, label, side?, sideLabel?, how?(怎麼檢查), lm?(骨性標誌 key) }
   這個檔案在 data_rules.js 之後載入：重建 window.FINDINGS、補強 window.PATTERNS。 */

/* 骨性標誌（人形座標 200×440）。front＝正面（客人右側在畫面左）、back＝背面（客人左側在畫面左）、sit＝坐姿背面 */
window.LANDMARKS = {
  // 背面
  occ: { v: 'back', C: [100, 58], n: '枕骨下緣' }, c7: { v: 'back', C: [100, 86], n: 'C7 棘突' },
  neck_b: { v: 'back', L: [90, 74], R: [110, 74], n: '頸後側' }, acrom: { v: 'back', L: [52, 100], R: [148, 100], n: '肩峰' },
  scap_sup: { v: 'back', L: [76, 108], R: [124, 108], n: '肩胛上角' }, infra: { v: 'back', L: [68, 128], R: [132, 128], n: '棘下窩（天宗）' },
  scap_med: { v: 'back', L: [85, 136], R: [115, 136], n: '肩胛內緣' }, scap_inf: { v: 'back', L: [78, 162], R: [122, 162], n: '肩胛下角' },
  tsp: { v: 'back', C: [100, 140], n: '胸椎' }, tl: { v: 'back', C: [100, 192], n: '胸腰交界' },
  erec: { v: 'back', L: [91, 214], R: [109, 214], n: '腰旁肌' }, ql: { v: 'back', L: [79, 224], R: [121, 224], n: '腰方肌' },
  waist: { v: 'back', L: [58, 206], R: [142, 206], n: '腰三角' }, crest: { v: 'back', L: [66, 234], R: [134, 234], n: '髂嵴' },
  psis: { v: 'back', L: [90, 249], R: [110, 249], n: '髂後上棘' }, s2: { v: 'back', C: [100, 255], n: 'S2' },
  sac: { v: 'back', C: [100, 266], n: '薦骨' }, gmed: { v: 'back', L: [70, 250], R: [130, 250], n: '臀中肌' },
  piri: { v: 'back', L: [80, 270], R: [120, 270], n: '梨狀肌' }, troch: { v: 'back', L: [55, 283], R: [145, 283], n: '大轉子' },
  stl: { v: 'back', L: [92, 284], R: [108, 284], n: '薦結節韌帶' }, isch: { v: 'back', L: [87, 296], R: [113, 296], n: '坐骨結節' },
  gfold: { v: 'back', L: [79, 306], R: [121, 306], n: '臀褶' }, ham: { v: 'back', L: [78, 334], R: [122, 334], n: '大腿後側' },
  popl: { v: 'back', L: [78, 362], R: [122, 362], n: '膝窩' }, calf: { v: 'back', L: [78, 392], R: [122, 392], n: '小腿後側' },
  heel: { v: 'back', L: [80, 430], R: [120, 430], n: '足跟' }, elbow_b: { v: 'back', L: [36, 190], R: [164, 190], n: '肘後' },
  // 正面
  vertex: { v: 'front', C: [100, 13], n: '巔頂' }, forehead: { v: 'front', C: [100, 26], n: '前額' },
  temple: { v: 'front', R: [80, 34], L: [120, 34], n: '顳部' }, jaw: { v: 'front', R: [85, 57], L: [115, 57], n: '顳顎／咬肌' },
  scm: { v: 'front', R: [92, 76], L: [108, 76], n: '胸鎖乳突肌' }, scal: { v: 'front', R: [84, 88], L: [116, 88], n: '缺盆上（斜角肌）' },
  clav: { v: 'front', R: [74, 96], L: [126, 96], n: '鎖骨' }, sc: { v: 'front', R: [94, 98], L: [106, 98], n: '胸鎖關節' },
  cora: { v: 'front', R: [64, 108], L: [136, 108], n: '喙突下（胸小肌）' }, shf: { v: 'front', R: [54, 114], L: [146, 114], n: '肩前' },
  chest: { v: 'front', C: [100, 128], n: '胸口' }, rib: { v: 'front', R: [76, 170], L: [124, 170], n: '肋弓' },
  elat: { v: 'front', R: [30, 192], L: [170, 192], n: '肘外側' }, emed: { v: 'front', R: [44, 190], L: [156, 190], n: '肘內側' },
  wrist: { v: 'front', R: [25, 250], L: [175, 250], n: '腕' }, hand: { v: 'front', R: [22, 270], L: [178, 270], n: '手指' },
  abd: { v: 'front', C: [100, 202], n: '腹部' }, psoas: { v: 'front', R: [88, 216], L: [112, 216], n: '臍旁深層（腰大肌）' },
  asis: { v: 'front', R: [72, 238], L: [128, 238], n: '髂前上棘' }, groin: { v: 'front', R: [80, 262], L: [120, 262], n: '鼠蹊' },
  pubis: { v: 'front', C: [100, 268], n: '恥骨' }, tlat: { v: 'front', R: [58, 302], L: [142, 302], n: '大腿外側' },
  tmed: { v: 'front', R: [89, 312], L: [111, 312], n: '大腿內側' }, kf: { v: 'front', R: [76, 356], L: [124, 356], n: '膝前（髕骨）' },
  km: { v: 'front', R: [89, 362], L: [111, 362], n: '膝內側' }, kl: { v: 'front', R: [63, 360], L: [137, 360], n: '膝外側' },
  pes: { v: 'front', R: [86, 376], L: [114, 376], n: '鵝足' }, shin: { v: 'front', R: [74, 394], L: [126, 394], n: '脛前' },
  ank: { v: 'front', R: [71, 421], L: [129, 421], n: '踝' }, foot: { v: 'front', R: [73, 435], L: [127, 435], n: '足' },
  // 坐姿背面
  s_acrom: { v: 'sit', L: [52, 100], R: [148, 100], n: '肩峰' }, s_scap: { v: 'sit', L: [80, 138], R: [120, 138], n: '肩胛' },
  s_head: { v: 'sit', C: [100, 36], n: '頭' }, s_tsp: { v: 'sit', C: [100, 150], n: '脊椎' }, s_crest: { v: 'sit', L: [66, 234], R: [134, 234], n: '髂嵴' },
  s_psis: { v: 'sit', L: [90, 249], R: [110, 249], n: '髂後上棘' }, s_isch: { v: 'sit', L: [86, 276], R: [114, 276], n: '坐骨（承重）' },
};

window.STATIONS = [
  { id: 'cc', name: '主訴', sub: '傷科問診', pose: 'map', intro: '先問清楚：哪裡痛、多久、怎麼開始、什麼時候加重。點人形上的部位可直接勾選（點左右側的點分別記左／右，兩側都點＝雙側）。警訊先篩檢，有勾選就先轉介。',
    groups: [
      { name: '安全警訊（先問）', red: true, items: [
        { id: 'r_trauma', label: '外傷後劇痛、變形、腫脹', how: '車禍、跌倒、撞擊後不能承重或骨頭局部劇痛 → 先排除骨折。' },
        { id: 'r_night', label: '夜間痛、發燒、體重減輕', how: '休息、躺著也痛且越來越痛，或有癌症病史 → 先就醫。' },
        { id: 'r_saddle', label: '大小便異常、會陰麻木', how: '馬尾症候群警訊 → 立即急診。' },
        { id: 'r_weak', label: '進行性無力、肌肉萎縮', how: '腳抬不起、拖腳、手握力下降越來越明顯。' },
        { id: 'r_chest', label: '胸痛合併冒冷汗或喘', how: '可能是心臟問題 → 立即就醫。' },
        { id: 'r_headache', label: '突發劇烈頭痛／口齒不清', how: '「這輩子最痛」的頭痛、單側無力、講話不清 → 立即就醫。' },
        { id: 'r_vasc', label: '轉頭或仰頭時頭暈、視線模糊、噁心', how: '椎動脈供血警訊：不做頸部旋轉、後仰，先轉介。' },
        { id: 'r_osteo', label: '骨質疏鬆、長期服用類固醇或高齡', how: '骨頭脆：不做任何衝擊、扳動，按壓力道減輕。' },
        { id: 'r_anticoag', label: '服用抗凝血劑、容易瘀青', how: '力道放輕，避免深壓與刮痧式手法。' },
      ] },
      { name: '頭頸', items: [
        { id: 'c_head_front', label: '前額頭痛', lm: 'forehead' }, { id: 'c_head_side', label: '偏頭痛（側頭）', side: true, lm: 'temple' }, { id: 'c_head_back', label: '後頭痛', lm: 'occ' }, { id: 'c_head_top', label: '巔頂痛', lm: 'vertex' },
        { id: 'c_neck', label: '頸痛／轉頭受限', side: true, lm: 'neck_b' }, { id: 'c_neckstiff', label: '肩頸僵硬', lm: 'c7' }, { id: 'c_jaw', label: '顳顎／咬合痛', side: true, lm: 'jaw' },
      ] },
      { name: '肩與上肢', items: [
        { id: 'c_sh_front', label: '肩前痛', side: true, lm: 'shf' }, { id: 'c_sh_raise', label: '舉手痛／舉不高', side: true, lm: 'acrom' }, { id: 'c_scap_between', label: '肩胛間痛', lm: 'tsp' },
        { id: 'c_arm_numb', label: '手麻', side: true, lm: 'hand' }, { id: 'c_elbow_lat', label: '手肘外側痛', side: true, lm: 'elat' }, { id: 'c_elbow_med', label: '手肘內側痛', side: true, lm: 'emed' }, { id: 'c_wrist', label: '手腕痛', side: true, lm: 'wrist' },
      ] },
      { name: '軀幹與骨盆', items: [
        { id: 'c_chest', label: '胸悶／呼吸淺', lm: 'chest' }, { id: 'c_lbp', label: '下背痛', side: true, lm: 'erec' }, { id: 'c_lbp_acute', label: '閃到腰（急性）', side: true, lm: 'ql' },
        { id: 'c_si', label: '薦髂／臀部痛', side: true, lm: 'psis' }, { id: 'c_groin', label: '鼠蹊／恥骨痛', side: true, lm: 'groin' },
      ] },
      { name: '下肢', items: [
        { id: 'c_sciatic', label: '臀腿後側放射痛', side: true, lm: 'ham' }, { id: 'c_thigh_lat', label: '大腿外側緊痛', side: true, lm: 'tlat' },
        { id: 'c_knee_front', label: '膝前痛', side: true, lm: 'kf' }, { id: 'c_knee_med', label: '膝內側痛', side: true, lm: 'km' }, { id: 'c_knee_lat', label: '膝外側痛', side: true, lm: 'kl' }, { id: 'c_knee_back', label: '膝後痛', side: true, lm: 'popl' },
        { id: 'c_calf', label: '小腿緊／抽筋', side: true, lm: 'calf' }, { id: 'c_ankle', label: '腳踝痛／舊扭傷', side: true, lm: 'ank' }, { id: 'c_heel', label: '足底／腳跟痛', side: true, lm: 'heel' },
      ] },
      { name: '病程與誘因（傷科）', items: [
        { id: 'c_onset_acute', label: '急性：72 小時內／剛受傷', how: '急性期以舒緩為主：遠端取穴配合活動、局部不重壓、不矯正。' },
        { id: 'c_onset_sub', label: '亞急性：數天到 3 個月' },
        { id: 'c_onset_chronic', label: '慢性：超過 3 個月或反覆發作', how: '慢性多是「受害者」：往上下游找原因（由下往上）。' },
        { id: 'c_mech_trauma', label: '有扭傷、跌倒、撞擊史' }, { id: 'c_mech_overuse', label: '重複動作、久坐久站、姿勢引起' },
        { id: 'c_surgery', label: '開過刀、骨折、人工關節', how: '手術部位與人工關節依醫囑角度，不做扳動。' },
        { id: 'o_pregnant', label: '孕期／產後', how: '孕期不做矯正、避開合谷、三陰交、肩井、崑崙、至陰與腹部、腰薦重壓；側臥為主。' },
      ] },
      { name: '疼痛性質', items: [
        { id: 'c_pain_sharp', label: '刺痛、動到某角度才痛', how: '偏組織受傷或夾擠：找出痛的角度，避開它。' },
        { id: 'c_pain_dull', label: '痠脹、悶痛、按了舒服', how: '多為「被拉長的痛」或疲勞：找對側縮短的肌肉。' },
        { id: 'c_pain_numb', label: '麻、電、放射感', how: '神經路徑：對照皮節找節段，並做直腿抬高、頸椎測試。' },
        { id: 'c_pain_swell', label: '紅、腫、熱', how: '發炎期：不熱敷、不深壓局部，可冰敷並處理上下游。' },
        { id: 'c_worse_morning', label: '早上起床最僵、活動後改善', how: '晨僵超過 1 小時、年輕男性下背痛 → 建議就醫排除發炎性關節炎。' },
        { id: 'c_worse_sit', label: '久坐加重' }, { id: 'c_worse_stand', label: '久站／走路加重' },
        { id: 'c_worse_cough', label: '咳嗽、打噴嚏、用力時痛', how: '腹壓上升時痛或放射 → 偏椎間盤，先篩神經學。' },
      ] },
    ] },
  { id: 'stand', name: '站姿', sub: '正面、側面、背面觀察', pose: 'stand', intro: '客人放鬆站、雙腳與肩同寬、看前方。依課堂順序由下往上看：足 → 踝、距骨 → 膝 → 骨盆 → 肩胛 → 頭。望診看外觀，再用觸診確認。',
    groups: [
      { name: '正面', items: [
        { id: 'o_flatfoot', label: '扁平足／足弓塌', side: true, lm: 'foot', how: '看內側足弓與地面的空隙；請客人踮腳，足弓出現＝柔軟型。' },
        { id: 'o_toe_out', label: '腳尖外八', side: true, lm: 'foot', how: '比較兩腳尖朝外的角度。外八＝髖偏外轉（② IN 線索），也可能是股骨前傾角，先比坐姿兩側髖內外轉範圍。' },
        { id: 'o_toe_in', label: '腳尖內八', side: true, lm: 'foot', how: '內八＝髖偏內轉（② EX 線索）。' },
        { id: 'o_knee_o', label: 'O 型腿（膝內翻）', how: '雙腳內踝併攏，兩膝間有空隙。' }, { id: 'o_knee_x', label: 'X 型腿（膝外翻）', how: '雙膝併攏，兩內踝碰不到。' },
        { id: 'o_patella_in', label: '髕骨朝內（斜視髕骨）', side: true, lm: 'kf', how: '腳尖朝正前方時，髕骨卻朝內 → 股骨內轉。' },
        { id: 'o_asis_high', label: '髂前上棘一側較高', side: true, sideLabel: '高側', lm: 'asis', how: '兩拇指放在髂前上棘下緣比較高低。' },
        { id: 'o_sh_high', label: '高低肩', side: true, sideLabel: '高側', lm: 'clav', how: '看肩峰與鎖骨高度；也從背面確認。' },
        { id: 'o_clav_high', label: '鎖骨、胸鎖關節一側突出', side: true, lm: 'sc' },
        { id: 'o_head_tilt', label: '頭側傾', side: true, sideLabel: '傾向', lm: 'jaw' },
      ] },
      { name: '側面', items: [
        { id: 'o_head_fwd', label: '頭前傾（耳垂在肩峰前）', lm: 'scm', how: '重力線：耳垂、肩峰、大轉子、膝前、外踝前應約在同一直線。' },
        { id: 'o_round', label: '圓肩', lm: 'shf' }, { id: 'o_kyph', label: '駝背（胸椎後凸）', lm: 'tsp' },
        { id: 'o_lordosis', label: '腰椎前凸增加／臀翹', lm: 'erec', how: '臀翹、腰窩深 → 骨盆前傾（① A）線索。' },
        { id: 'o_flatback', label: '腰平／臀平', lm: 'sac', how: '臀扁、腰椎變平 → ① P 線索。' },
        { id: 'o_sway', label: '骨盆前移、上身後仰（搖擺背）', lm: 'troch', how: '大轉子在重力線前方、胸廓往後；常伴膝過伸。' },
        { id: 'o_knee_hyper', label: '膝過伸（膝往後頂）', side: true, lm: 'popl' },
      ] },
      { name: '背面', items: [
        { id: 'o_calc_valgus', label: '跟骨外翻（跟腱往外歪）', side: true, lm: 'heel', how: '從後面看跟腱與跟骨的線，往外歪＝外翻，常伴足弓塌。' },
        { id: 'o_gfold', label: '臀褶一側較低', side: true, sideLabel: '低側', lm: 'gfold' },
        { id: 'o_crest_high', label: '髂嵴高低', side: true, sideLabel: '高側', lm: 'crest', how: '兩手掌放在髂嵴上緣比較。髂嵴最高點連線約平 L4。' },
        { id: 'o_waist_tri', label: '腰三角不對稱（空隙較大側）', side: true, lm: 'waist', how: '手臂自然下垂，看手臂與腰之間的空隙。' },
        { id: 'o_scoli', label: '脊椎側彎', side: true, sideLabel: '凸側(腰)', lm: 'tl', how: '沿棘突畫線；請客人前彎看肋骨或腰是否一邊隆起。' },
        { id: 'o_scap_dist', label: '肩胛內緣離脊椎較遠', side: true, lm: 'scap_med' },
        { id: 'o_wing', label: '翼狀肩胛', side: true, lm: 'scap_inf', how: '雙手推牆，肩胛內緣翹起 → 前鋸肌無力。' },
        { id: 'o_lean_down', label: '身體向痛側側彎（痛側在下）', side: true, sideLabel: '痛側', lm: 'waist', how: '急性腰閃傷常見；但不能排除椎間盤，要配合神經學篩檢。' },
        { id: 'o_lean_up', label: '身體傾向健側（痛側在上）', side: true, sideLabel: '痛側', lm: 'waist' },
      ] },
    ] },
  { id: 'sit', name: '坐姿', sub: '背面觀察', pose: 'sit', intro: '客人坐在沒有扶手的椅子或床緣，雙腳踩地、膝 90°。坐下後下肢長短的影響被排除：站姿有、坐姿消失的歪斜來自下肢；坐姿仍在的來自骨盆或脊椎本身。',
    groups: [
      { name: '坐姿背面', items: [
        { id: 's_scoli_gone', label: '坐下後側彎消失或減輕', lm: 's_tsp', how: '→ 源頭在下肢（長短腳、足、膝）。' },
        { id: 's_scoli_stay', label: '坐下後側彎仍在', lm: 's_tsp', how: '→ 源頭在骨盆、薦椎或脊椎本身。' },
        { id: 's_crest_high', label: '坐姿髂嵴仍高低', side: true, sideLabel: '高側', lm: 's_crest' },
        { id: 's_lean', label: '坐姿身體偏向一側（承重側）', side: true, sideLabel: '偏向', lm: 's_isch', how: '摸兩側坐骨承重是否一樣。' },
        { id: 's_sh_high', label: '坐姿高低肩', side: true, sideLabel: '高側', lm: 's_acrom', how: '坐姿仍高低肩 → 與下肢無關，看骨盆、脊椎與肩胛本身。' },
        { id: 's_head_tilt', label: '坐姿頭側傾', side: true, sideLabel: '傾向', lm: 's_head' },
        { id: 's_slump', label: '駝背、骨盆後倒（坐在薦骨上）', lm: 's_tsp' },
      ] },
      { name: '坐姿動作', items: [
        { id: 's_flex_test', label: '坐姿前彎：一側髂後上棘先往上跑', side: true, lm: 's_psis', how: '兩拇指放在兩側髂後上棘下緣，請客人慢慢往前彎；先上移或上移較多的一側，薦髂關節活動較差。' },
        { id: 's_rot_lim', label: '坐姿轉身受限', side: true, sideLabel: '轉向', lm: 's_tsp', how: '雙手抱胸往左右轉，比較角度；② EX／IN 會造成脊椎旋轉。' },
        { id: 's_hip_rot', label: '坐姿髖內外轉範圍兩側不同', side: true, sideLabel: '內轉較少', how: '坐床緣，小腿往外擺＝髖內轉、往內擺＝髖外轉；用來區分股骨前傾角與骨盆因素。' },
      ] },
    ] },
  { id: 'prone', name: '俯臥', sub: '靜態觸診', pose: 'prone', intro: '客人趴好、臉放洞裡、雙手放身側，先托腿讓脊椎被撐起、肌肉放鬆（課堂）。由下往上：足跟 → 膝 → 坐骨、大轉子 → 骨盆（髂後上棘對 S2）→ 薦椎 → 腰胸椎 → 肩胛。兩側一起比，不要只摸一邊。',
    groups: [
      { name: '下肢', items: [
        { id: 't_heel_long', label: '伸膝：足跟較長（長腳）', side: true, lm: 'heel', how: '雙腳併攏、腳背放鬆，看兩足跟或內踝誰較靠足端。' },
        { id: 't_heel_short', label: '伸膝：足跟較短（短腳）', side: true, lm: 'heel' },
        { id: 't_heel_buttock', label: '屈膝：足跟離臀部較近', side: true, lm: 'heel', how: '輔助線索（多為 ① A），以髂後上棘高低為主。' },
        { id: 't_heel_buttock_far', label: '屈膝：足跟離臀部較遠', side: true, lm: 'heel' },
        { id: 't_heel_out', label: '屈膝 90°：小腿往外倒（髖內轉）', side: true, lm: 'popl', how: '兩膝屈 90° 讓小腿自然倒：往外倒＝股骨內轉傾向（② EX 線索）。' },
        { id: 't_heel_in', label: '屈膝 90°：小腿往內倒（髖外轉）', side: true, lm: 'popl', how: '往內倒＝股骨外轉傾向（② IN 線索）。' },
        { id: 't_rot_limited', label: '小腿內外旋：較打不開的一側', side: true, lm: 'popl', how: '屈膝抬小腿做內、外旋；打不開可能是薦髂、髖關節或附近肌肉卡住。' },
        { id: 'p_ham_tender', label: '膕繩肌緊、壓痛', side: true, lm: 'ham' }, { id: 'p_calf_tender', label: '小腿後側緊、壓痛', side: true, lm: 'calf' },
      ] },
      { name: '骨盆與薦椎', items: [
        { id: 't_psis_high', label: '髂後上棘較高（偏頭側）', side: true, lm: 'psis', how: '兩拇指沿髂嵴往後找到最後的骨突（約平 S2），拇指放在下緣比較：偏頭側＝① A 線索。' },
        { id: 't_psis_low', label: '髂後上棘較低（偏足側）', side: true, lm: 'psis', how: '偏足側＝① P 線索。' },
        { id: 't_psis_far', label: '同高、離 S2 較遠（② EX）', side: true, lm: 'psis', how: '兩側同一水平時，量拇指到 S2 中線的距離：遠＝EX。' },
        { id: 't_psis_near', label: '同高、離 S2 較近（② IN）', side: true, lm: 'psis' },
        { id: 't_psis_upfar', label: '又高又遠（③ EX）', side: true, lm: 'psis', how: '髂嵴、髂後上棘、坐骨結節整塊偏頭側且離 S2 遠 → 沿耳狀面上滑（③ EX，短腿）。' },
        { id: 't_psis_lownear', label: '又低又近（③ IN）', side: true, lm: 'psis' },
        { id: 't_isch_high', label: '坐骨結節較高', side: true, lm: 'isch', how: '拇指由臀橫紋中點往上頂到坐骨結節下緣比較。' },
        { id: 't_isch_low', label: '坐骨結節較低、臀部下垂', side: true, lm: 'isch' },
        { id: 't_troch_thick', label: '大轉子摸起來較厚', side: true, lm: 'troch', how: '手先放鬆、指尖張開，上下都摸到骨頭才算；厚＝② EX 輔助線索。' },
        { id: 't_troch_thin', label: '大轉子摸起來較薄、尖', side: true, lm: 'troch' },
        { id: 't_stl_tight', label: '薦結節韌帶較緊、滑動差', side: true, lm: 'stl', how: '坐骨結節內上方往薦骨外下緣，拇指橫向撥動比較彈性。' },
        { id: 'p_sacbase', label: '薦骨底一側較深', side: true, lm: 'sac', how: '拇指放在兩側髂後上棘內側的薦骨溝，較深的一側薦骨底往前（點頭）。' },
        { id: 'p_ila', label: '薦骨下外角一側較凸（較後）', side: true, lm: 'sac' },
        { id: 'p_piri_tender', label: '梨狀肌（臀中央深處）壓痛', side: true, lm: 'piri', how: '薦骨外緣到大轉子上緣的連線上；壓下去若腿麻立即減力。' },
        { id: 'p_gmed_tender', label: '臀中肌（髂嵴下方）壓痛', side: true, lm: 'gmed' },
      ] },
      { name: '脊椎與肩胛', items: [
        { id: 'p_ql_tender', label: '腰方肌（髂嵴上緣外側）壓痛', side: true, lm: 'ql' },
        { id: 'p_erec_bulge', label: '腰旁肌一側隆起、較硬', side: true, lm: 'erec' },
        { id: 'p_spinous', label: '棘突壓痛或排列偏移', lm: 'tl', how: '中指放棘突、食指無名指放兩側，由上往下滑，找轉折點與壓痛。' },
        { id: 'p_tl_junction', label: '胸腰交界（T12–L1）轉折、壓痛', lm: 'tl' },
        { id: 'p_scap_tender', label: '肩胛內緣（菱形肌）條索、壓痛', side: true, lm: 'scap_med' },
        { id: 't_infra', label: '天宗壓痛並放射到肩前', side: true, lm: 'infra' },
        { id: 't_scap_sitlie', label: '坐姿 → 臥姿：肩胛相對位置改變', side: true, lm: 'scap_inf', how: '先在坐姿標記兩側肩胛下角，趴下後再比：改變 → 跟骨盆有關。' },
        { id: 't_scap_same', label: '坐姿 → 臥姿：肩胛位置不變', side: true, lm: 'scap_inf', how: '不變且骨盆正 → 問題在肩關節本身。' },
      ] },
    ] },
  { id: 'supine', name: '仰臥', sub: '靜態觸診與測試', pose: 'supine', intro: '客人仰臥、雙腿伸直並在中線。先看再摸：腳掌倒向、內踝長短 → 髂前上棘、恥骨 → 腹部 → 胸廓、鎖骨、肩峰 → 頸前與枕下；再做仰臥的測試。',
    groups: [
      { name: '下肢與骨盆', items: [
        { id: 'q_foot_out', label: '腳掌自然外倒較多（髖外轉）', side: true, lm: 'foot', how: '② IN 線索；也是梨狀肌、臀後六肌緊的表現。' },
        { id: 'q_foot_in', label: '腳掌較直立、外倒較少（髖內轉）', side: true, lm: 'foot', how: '② EX 線索。' },
        { id: 'q_leg_long', label: '內踝較長', side: true, lm: 'ank', how: '先把骨盆擺正（屈膝抬臀放下、拉直雙腿），拇指放兩內踝下緣比較。' },
        { id: 'q_leg_short', label: '內踝較短', side: true, lm: 'ank' },
        { id: 'q_longsit_ant', label: '仰臥 → 長坐：由長變短', side: true, lm: 'ank', how: '仰臥比內踝後請客人直膝坐起再比：由長變短 → ① A。' },
        { id: 'q_longsit_post', label: '仰臥 → 長坐：由短變長', side: true, lm: 'ank', how: '由短變長 → ① P。' },
        { id: 'q_asis_low', label: '髂前上棘較靠足側（較低）', side: true, lm: 'asis', how: '① A 時髂前上棘往前下。' },
        { id: 'q_asis_high', label: '髂前上棘較靠頭側（較高）', side: true, lm: 'asis' },
        { id: 'q_pubic', label: '恥骨上支一側較高', side: true, sideLabel: '高側', lm: 'pubis', how: '先說明並取得同意，手掌由肚臍滑到恥骨上緣，兩拇指比較。第三角度常伴恥骨高低。' },
        { id: 'q_adductor', label: '內收肌緊、壓痛（大腿內側）', side: true, lm: 'tmed' },
        { id: 'q_patella', label: '髕骨活動度差、偏外', side: true, lm: 'kf' },
        { id: 't_pes', label: '鵝足（膝內下）壓痛', side: true, lm: 'pes' }, { id: 't_itb', label: '膝外上方（膝陽關）壓痛', side: true, lm: 'kl' },
      ] },
      { name: '腹部與胸廓', items: [
        { id: 'q_psoas', label: '臍旁深層（腰大肌）壓痛', side: true, lm: 'psoas', how: '屈膝放鬆腹部，臍旁 2–3 指慢慢沉入，請客人輕抬腿確認；避開腹主動脈搏動處。' },
        { id: 'q_abd_tense', label: '腹直肌、腹部緊繃', lm: 'abd' },
        { id: 'q_rib_flare', label: '肋弓外翻、一側肋骨隆起', side: true, lm: 'rib' },
        { id: 'q_sh_lift', label: '肩峰離床面較高（胸小肌緊）', side: true, lm: 'shf', how: '從床尾看兩肩峰到床面的距離。' },
        { id: 't_pecmin', label: '喙突下方壓痛（胸小肌）', side: true, lm: 'cora' },
        { id: 'q_sc_prom', label: '胸鎖關節一側突出、壓痛', side: true, lm: 'sc' },
      ] },
      { name: '頸與頭', items: [
        { id: 'q_scm', label: '胸鎖乳突肌緊、壓痛', side: true, lm: 'scm' },
        { id: 't_scalene', label: '缺盆上方斜角肌壓痛、手麻重現', side: true, lm: 'scal', how: '輕觸，不重壓缺盆（臂神經叢、鎖骨下動脈）。' },
        { id: 'q_subocc', label: '枕下緊、壓痛', lm: 'occ', how: '仰臥，指腹勾住枕骨下緣慢慢上托。' },
        { id: 'q_jaw_dev', label: '張口時下頜偏向一側', side: true, sideLabel: '偏向', lm: 'jaw' },
      ] },
      { name: '仰臥測試', items: [
        { id: 't_thomas', label: 'Thomas 測試：大腿抬起（髖屈肌緊）', side: true, lm: 'groin', how: '床尾抱對側膝到胸，測試側大腿離床 → 髂腰肌緊；小腿伸直 → 股直肌緊。' },
        { id: 't_slr_mid', label: '直腿抬高 45–70° 痛，>70° 反而不痛', side: true, lm: 'ham', how: '→ 梨狀肌（假性坐骨神經痛）。' },
        { id: 't_slr_low', label: '直腿抬高 <45° 就放射到小腿／腳', side: true, lm: 'ham', how: '→ 神經根，先轉介。' },
        { id: 'q_faber_groin', label: '4 字測試：鼠蹊痛', side: true, lm: 'groin', how: '患側腳踝放對側膝上、膝往下放：鼠蹊前方痛 → 髖關節。' },
        { id: 'q_faber_si', label: '4 字測試：薦髂後側痛', side: true, lm: 'asis', how: '同上，痛在後側薦髂 → 薦髂關節。' },
        { id: 'q_hip_ir', label: '髖內轉受限', side: true, lm: 'groin', how: '屈髖屈膝 90°，小腿往外擺＝髖內轉，比較兩側角度。' },
      ] },
    ] },
  { id: 'move', name: '動作測試', sub: '主被動、特殊測試', pose: null, intro: '三分法：先請客人自己做（主動），再由你幫他做（被動）。主動痛被動不痛 → 肌肉；主被動都不足且痛 → 骨／關節或慢性沾黏；主動做不到不痛、被動可 → 神經（轉介）。',
    groups: [
      { name: '三分法', items: [
        { id: 't_muscle', label: '主動動作痛、被動不痛（→肌肉）' }, { id: 't_joint', label: '主動、被動都不足且痛（→骨／關節）' }, { id: 't_nerve', label: '主動不足但不痛、被動可動（→神經）' },
      ] },
      { name: '脊椎', items: [
        { id: 'a_flex_pain', label: '前彎時痛', how: '前彎痛、坐久痛 → 偏椎間盤或後側肌肉被拉長。' },
        { id: 'a_ext_pain', label: '後仰時痛', how: '後仰、久站痛 → 偏小面關節（關節突關節）受壓。' },
        { id: 'a_rot_pain', label: '轉身時痛', side: true, sideLabel: '轉向' },
        { id: 'a_sidebend', label: '側彎受限', side: true, sideLabel: '彎向' },
        { id: 't_neck_rot', label: '轉頭到對側受限＋肩胛上角壓痛', side: true, lm: 'scap_sup' },
        { id: 'a_neck_ext', label: '頸後仰並轉向一側時手麻加重', side: true, how: '椎間孔擠壓 → 頸神經根，先轉介；不做頸部扳動。' },
      ] },
      { name: '上肢', items: [
        { id: 'a_sh_arc', label: '肩外展 60–120° 疼痛弧', side: true, how: '舉到中段痛、過了反而不痛 → 肩峰下夾擠。' },
        { id: 'a_sh_er', label: '肩外轉受限（被動也受限）', side: true, how: '肘貼身屈 90° 往外轉；主被動都受限 → 五十肩（關節囊）傾向。' },
        { id: 'a_sh_ir', label: '手背摸背受限（內轉）', side: true },
      ] },
      { name: '下肢', items: [
        { id: 't_trend', label: '單腳站時對側骨盆下掉', side: true, sideLabel: '站立腳', how: 'Trendelenburg：站立腳的臀中肌無力。' },
        { id: 'a_squat', label: '深蹲：膝往內夾或足跟離地', side: true },
        { id: 't_df_limited', label: '踝背屈受限（蹲下腳跟離地）', side: true },
        { id: 't_knee_flex', label: '膝越彎越痛／會卡住', side: true },
        { id: 'a_ankle_inv', label: '踝內翻時外踝前下方痛', side: true, how: '舊扭傷的前距腓韌帶區。' },
        { id: 't_bone_tender', label: '骨頭局部壓痛、輕敲鑽痛', how: '外傷後骨頭點狀壓痛、輕敲遠端會痛到該點 → 先排除骨折。' },
      ] },
    ] },
];

// 由分站重建 FINDINGS（保留舊 id，個案與規則可沿用）
window.FINDINGS = [];
window.STATIONS.forEach((st) => st.groups.forEach((g) => window.FINDINGS.push({ group: st.name + '・' + g.name, station: st.id, red: !!g.red, items: g.items })));

/* 處理原則（依主訴性質） */
window.CARE_RULES = [
  { when: ['c_onset_acute', 'c_lbp_acute'], title: '急性期：先舒緩、不矯正', text: '遠端取穴（委中、後溪、水溝、對側或上下游）配合客人慢慢活動；局部只輕柔放鬆，不重壓、不扳動。72 小時內腫熱可冰敷。之後再重新量骨盆三個角度。', kb: ['u-acute-lbp'] },
  { when: ['c_pain_swell'], title: '有紅腫熱：發炎期', text: '不熱敷、不在發炎處深壓或刮；處理上下游關節與周邊肌肉，抬高休息。持續腫脹或發燒請就醫。' },
  { when: ['c_onset_chronic', 'c_mech_overuse'], title: '慢性／姿勢型：找源頭', text: '痛的地方常是受害者。依課堂順序由下往上找「差最多、最上游」的變因點：足 → 踝、距骨 → 膝 → 骨盆（三角度差最多的先）→ 薦椎 → 脊椎 → 局部。', kb: ['u-treatment-order'] },
  { when: ['c_pain_dull'], title: '痠脹悶痛：多為被拉長', text: '先放鬆對側或拮抗側縮短的肌肉，被拉長的一側不要再拉、不反覆重壓，之後再強化。', kb: ['u-limited-side'] },
  { when: ['c_pain_sharp'], title: '特定角度刺痛', text: '找出痛的角度與方向，處理時避開它；先放鬆周邊，再小範圍、無痛角度內活動。' },
  { when: ['c_pain_numb', 'c_arm_numb', 'c_sciatic'], title: '麻、放射：沿神經路徑查', text: '對照皮節推估節段（知識庫「頸、胸、腰薦神經」），做直腿抬高或頸椎測試；兩側症狀、無力加重、大小便異常 → 先轉介。推拿只沿路放鬆可能卡壓的肌肉（斜角肌、胸小肌、梨狀肌）。' },
  { when: ['c_worse_cough'], title: '腹壓上升時痛', text: '偏椎間盤：不做扭轉、後仰頂腰與衝擊；周邊放鬆與溫和牽引為主，建議就醫確認。', kb: ['u-safety-spine-thrust'] },
  { when: ['c_worse_morning'], title: '晨僵', text: '晨僵超過 1 小時、活動後才改善，尤其年輕人的下背與臀痛，建議先就醫排除發炎性關節炎。' },
  { when: ['o_pregnant'], title: '孕期／產後', text: '不做矯正與衝擊，側臥為主；避開合谷、三陰交、肩井、崑崙、至陰與腹部、腰薦重壓。產後鬆弛素仍有影響，骨盆評估要輕。', kb: ['u-safety-pregnancy'] },
  { when: ['r_osteo', 'r_anticoag', 'c_surgery'], title: '力道與禁忌', text: '骨質疏鬆、類固醇、抗凝血、術後或人工關節：減輕力道、不扳動，依醫囑的活動角度。' },
  { when: ['t_joint'], title: '主被動都受限且痛', text: '可能是骨／關節卡住，也可能是慢性發炎沾黏（五十肩、肌腱炎）——後者不要誤當成錯位硬扳。外傷後先排除骨折。', kb: ['u-three-adhesion'] },
  { when: ['t_bone_tender', 'r_trauma'], title: '先排除骨折', text: '外傷後骨頭點狀壓痛、輕敲遠端會痛到同一點、不能承重 → 先照 X 光；確認前只做遠端與周邊的輕柔處理。' },
  { when: ['c_onset_sub'], title: '亞急性：組織修復期', text: '腫痛已退但還沒恢復：逐步增加無痛範圍的活動，局部手法由輕到中，配合上下游關節與肌肉。' },
  { when: ['t_nerve'], title: '神經型', text: '主動做不到但不痛、被動可動 → 神經問題，不屬推拿處理範圍，請轉介。' },
];

/* 骨頭、手法、經筋：補到既有規則 */
(function () {
  const P = {}; window.PATTERNS.forEach((p) => (P[p.id] = p));
  const add = (id, o) => { const p = P[id]; if (!p) return; if (o.t) p.t = Object.assign({}, p.t, o.t); ['bones', 'techs', 'sinews'].forEach((k) => { if (o[k]) p[k] = o[k]; }); };
  // bones: [bn-id, 'same'|'opp'|'both'|'mid', 說明]
  add('p_ant', { t: { q_longsit_ant: 3, q_asis_low: 2, q_leg_long: 1, q_psoas: 1, a_ext_pain: 1, c_worse_stand: 1 }, bones: [['bn-hip', 'same', '① A：髂後上棘偏頭側、髂前上棘往前下；仰臥長腳'], ['bn-lspine', 'mid', '腰椎前凸增加，L5 小面關節受壓'], ['bn-femur', 'same', '股骨跟著內轉、髕骨軌跡改變']], techs: ['tq-pelvis-ap', 'tq-ischemic', 'tq-stretch', 'tq-met'] });
  add('p_post', { t: { q_longsit_post: 3, q_asis_high: 2, q_leg_short: 1, p_ham_tender: 1, s_slump: 1, o_sway: 1, q_abd_tense: 1 }, bones: [['bn-hip', 'same', '① P：髂後上棘偏足側、坐骨低；仰臥短腳'], ['bn-lspine', 'mid', '腰椎曲度變平']], techs: ['tq-pelvis-ap', 'tq-ischemic', 'tq-stretch'] });
  add('p_ex', { t: { t_heel_out: 3, q_foot_in: 2, o_toe_in: 1, o_patella_in: 1, s_rot_lim: 1, p_gmed_tender: 1 }, bones: [['bn-hip', 'same', '② EX：髂後上棘同高、離 S2 遠'], ['bn-femur', 'same', '股骨偏內轉、大轉子較厚'], ['bn-lspine', 'mid', '脊椎逆向旋轉']], techs: ['tq-pelvis-exin', 'tq-ischemic', 'tq-tanbo', 'tq-stretch'] });
  add('p_in', { t: { t_heel_in: 3, q_foot_out: 2, o_toe_out: 1, q_hip_ir: 2, p_piri_tender: 1, s_rot_lim: 1 }, bones: [['bn-hip', 'same', '② IN：髂後上棘同高、離 S2 近'], ['bn-femur', 'same', '股骨偏外轉、大轉子較薄尖'], ['bn-sacrum', 'mid', '薦椎與梨狀肌連動']], techs: ['tq-pelvis-exin', 'tq-ischemic', 'tq-stretch'] });
  add('p_3ex', { t: { s_crest_high: 1, o_asis_high: 1, o_waist_tri: 1, q_leg_short: 1 }, bones: [['bn-hip', 'same', '③ EX：整塊沿耳狀面上滑（又高又遠），短腿'], ['bn-lspine', 'mid', '腰椎直接側彎（無旋轉）'], ['bn-sacrum', 'mid', '恥骨聯合、薦髂一起看']], techs: ['tq-pelvis-3', 'tq-ischemic', 'tq-met'] });
  add('p_3in', { t: { q_adductor: 2, q_pubic: 1 }, bones: [['bn-hip', 'same', '③ IN：沿耳狀面下滑（又低又近）'], ['bn-sacrum', 'mid', '恥骨聯合高低']], techs: ['tq-pelvis-3', 'tq-pubis', 'tq-ischemic'] });
  add('p_sacrum', { t: { s_flex_test: 2, p_sacbase: 2, p_ila: 2, q_faber_si: 1, a_rot_pain: 1 }, bones: [['bn-sacrum', 'mid', '10 種卡法之一：俯臥看薦骨底深淺與下外角'], ['bn-lspine', 'mid', '薦椎是腰椎底座，腰椎跟著轉'], ['bn-hip', 'both', '多半骨盆先歪，薦椎跟著歪']], techs: ['tq-sacrum', 'tq-sij', 'tq-breath'] });
  add('p_piri', { t: { p_piri_tender: 2, q_foot_out: 1, c_worse_sit: 1 }, bones: [['bn-sacrum', 'same', '梨狀肌起於薦骨前面'], ['bn-femur', 'same', '止於大轉子']], techs: ['tq-ischemic', 'tq-stretch', 'tq-distal'] });
  add('p_radic', { t: { c_pain_numb: 1 }, bones: [['bn-lspine', 'mid', '腰椎間盤／神經根：先轉介'], ['bn-disc', 'mid', '']], techs: ['tq-principles'] });
  add('p_acute', { t: { c_onset_acute: 1, p_erec_bulge: 1, a_flex_pain: 1, q_psoas: 1 }, bones: [['bn-lspine', 'mid', '髂腰韌帶、腰椎滑膜嵌頓'], ['bn-hip', 'same', '常呈 A＋IN']], techs: ['tq-distal', 'tq-rou', 'tq-l-traction', 'tq-principles'] });
  add('p_disc', { t: { c_worse_cough: 2, a_flex_pain: 2, c_worse_sit: 1, c_pain_numb: 1 }, bones: [['bn-disc', 'mid', '慢性；痛側在上（不能單憑外觀排除）'], ['bn-lspine', 'mid', '']], techs: ['tq-l-traction', 'tq-principles'] });
  add('p_ql', { t: { p_ql_tender: 3, a_sidebend: 1, o_waist_tri: 1, p_erec_bulge: 1, p_tl_junction: 1 }, bones: [['bn-lspine', 'same', '腰方肌連第 12 肋、L1–L4 橫突與髂嵴'], ['bn-hip', 'same', '上提同側骨盆'], ['bn-rib', 'same', '第 12 肋']], techs: ['tq-ischemic', 'tq-tanbo', 'tq-stretch'] });
  add('p_scap_pelvis', { t: { s_crest_high: 1, s_sh_high: 1 }, bones: [['bn-scapula', 'same', '坐→臥肩胛會變：先處理骨盆'], ['bn-hip', 'both', '找三角度中差最多的'], ['bn-sacrum', 'mid', '']], techs: ['tq-pelvis-ap', 'tq-pelvis-exin', 'tq-scap'] });
  add('p_scap_local', { t: { p_scap_tender: 1, a_sh_ir: 1, o_scap_dist: 1, o_wing: 2 }, bones: [['bn-scapula', 'same', '肩胛胸廓關節（平面關節）'], ['bn-humerus', 'same', '肩胛 → 肱骨、鎖骨的順序']], techs: ['tq-scap', 'tq-gh', 'tq-ischemic'] });
  add('p_headfwd', { t: { q_subocc: 2, q_scm: 1 }, bones: [['bn-occipital', 'mid', '上頸過度伸直、枕下縮短'], ['bn-c1', 'mid', ''], ['bn-tspine', 'mid', '上胸椎後凸']], techs: ['tq-c-occ', 'tq-na', 'tq-t-prone', 'tq-stretch'] });
  add('p_round', { t: { q_sh_lift: 3, o_scap_dist: 1 }, bones: [['bn-scapula', 'same', '前傾、外展'], ['bn-clavicle', 'same', ''], ['bn-tspine', 'mid', '']], techs: ['tq-ischemic', 'tq-scap', 'tq-stretch'] });
  add('p_shhigh', { t: { s_sh_high: 2, s_head_tilt: 1 }, bones: [['bn-scapula', 'same', '高側上提'], ['bn-cspine', 'mid', ''], ['bn-hip', 'both', '坐姿消失 → 往下查骨盆、下肢']], techs: ['tq-na', 'tq-ischemic', 'tq-scap'] });
  add('p_stiffneck', { t: { s_head_tilt: 1 }, bones: [['bn-cspine', 'same', '不做扳動'], ['bn-scapula', 'same', '肩胛上角（提肩胛肌止點）']], techs: ['tq-distal', 'tq-c-mob', 'tq-c-traction', 'tq-ischemic'] });
  add('p_tos', { t: { c_pain_numb: 1 }, bones: [['bn-rib', 'same', '第 1 肋（斜角肌）'], ['bn-clavicle', 'same', '鎖骨下通道'], ['bn-cspine', 'mid', '']], techs: ['tq-rou', 'tq-stretch', 'tq-rib', 'tq-breath'] });
  add('p_cuff', { bones: [['bn-scapula', 'same', ''], ['bn-humerus', 'same', '肱骨頭先滾後滑']], techs: ['tq-ischemic', 'tq-gh', 'tq-scap', 'tq-distal'] });
  add('p_tennis', { t: { c_mech_overuse: 1 }, bones: [['bn-humerus', 'same', '外上髁（不壓骨頭，處理肌腹）'], ['bn-radius', 'same', '橈骨頭']], techs: ['tq-tanbo', 'tq-elbow', 'tq-stretch'] });
  add('p_golfer', { t: { c_mech_overuse: 1 }, bones: [['bn-humerus', 'same', '內上髁'], ['bn-ulna', 'same', '']], techs: ['tq-tui', 'tq-tanbo', 'tq-wrist'] });
  add('p_itb', { t: { c_mech_overuse: 1, t_heel_out: 1, o_knee_o: 1 }, bones: [['bn-femur', 'same', '股骨旋轉改變髂脛束角度'], ['bn-tibia', 'same', 'Gerdy 結節'], ['bn-hip', 'same', '先調 ② EX／IN']], techs: ['tq-pelvis-exin', 'tq-gun', 'tq-tui', 'tq-stretch'] });
  add('p_kneefront', { t: { q_patella: 2, o_patella_in: 1, a_squat: 1 }, bones: [['bn-patella', 'same', '軌跡偏外'], ['bn-femur', 'same', '先看上面'], ['bn-talus', 'same', '再看下面']], techs: ['tq-patella', 'tq-knee', 'tq-stretch'] });
  add('p_kneemed', { t: { q_adductor: 1, o_knee_o: 1 }, bones: [['bn-tibia', 'same', '鵝足附著於脛骨內上'], ['bn-femur', 'same', '']], techs: ['tq-rou', 'tq-knee', 'tq-principles'] });
  add('p_meniscus', { bones: [['bn-tibia', 'same', '半月板：先轉介'], ['bn-femur', 'same', '']], techs: ['tq-principles'] });
  add('p_kneeback', { bones: [['bn-tibia', 'same', '膕肌：膝解鎖'], ['bn-femur', 'same', '']], techs: ['tq-rou', 'tq-knee'] });
  add('p_ankle', { t: { a_ankle_inv: 2, c_mech_trauma: 1, p_calf_tender: 1, a_squat: 1 }, bones: [['bn-talus', 'same', '恢復距骨滑動與背屈'], ['bn-fibula', 'same', '腓骨頭、外踝'], ['bn-calcaneus', 'same', '']], techs: ['tq-ankle', 'tq-fibula', 'tq-foot', 'tq-rou'] });
  add('p_flat', { t: { o_calc_valgus: 2, o_toe_out: 1, a_squat: 1, p_calf_tender: 1 }, bones: [['bn-navicular', 'same', '足弓頂點'], ['bn-calcaneus', 'same', '跟骨外翻'], ['bn-talus', 'same', '距骨內旋']], techs: ['tq-foot', 'tq-ankle', 'tq-tui'] });
  add('p_trend', { t: { p_gmed_tender: 1 }, bones: [['bn-hip', 'same', '對側骨盆下掉'], ['bn-femur', 'same', '']], techs: ['tq-ischemic', 'tq-met'] });
  add('p_kyph', { t: { s_slump: 1, q_abd_tense: 1 }, bones: [['bn-tspine', 'mid', '胸椎後凸'], ['bn-rib', 'both', '肋骨擴張受限'], ['bn-sternum', 'mid', '']], techs: ['tq-t-prone', 'tq-rib', 'tq-stretch'] });
  add('p_breath', { t: { q_rib_flare: 2, q_abd_tense: 1, p_tl_junction: 1 }, bones: [['bn-rib', 'both', '下肋、肋弓'], ['bn-sacrum', 'mid', '呼吸波（S1 呼吸軸）'], ['bn-lspine', 'mid', '橫膈腳附著 L1–L3']], techs: ['tq-rib', 'tq-breath', 'tq-mo'] });
  add('p_tmj', { t: { q_jaw_dev: 3 }, bones: [['bn-mandible', 'same', '顳顎關節'], ['bn-temporal', 'same', '']], techs: ['tq-tmj', 'tq-rou'] });
  add('p_h_front', { bones: [['bn-frontal', 'mid', '']], techs: ['tq-dian', 'tq-tui'] });
  add('p_h_side', { bones: [['bn-temporal', 'same', ''], ['bn-parietal', 'same', '']], techs: ['tq-dian', 'tq-rou'] });
  add('p_h_back', { bones: [['bn-occipital', 'mid', ''], ['bn-c1', 'mid', ''], ['bn-c2', 'mid', '']], techs: ['tq-c-occ', 'tq-dian'] });
  add('p_h_top', { bones: [['bn-parietal', 'mid', '']], techs: ['tq-dian'] });

  // 新增規則
  const NEW = [
    { id: 'p_facet', name: '小面關節（關節突關節）型腰痛', region: ['lspine'], src: '補充：肌動學、整合說明',
      desc: '後仰、轉身、久站時腰痛，前彎反而舒服；痛點在棘突旁一兩指，常伴骨盆前傾、腰椎前凸增加。',
      t: { a_ext_pain: 3, a_rot_pain: 1, c_worse_stand: 1, o_lordosis: 1, p_spinous: 1, p_erec_bulge: 1 },
      tight: [['erector', 'same', 2], ['multifidus', 'same', 2], ['ql', 'same', 1], ['iliopsoas', 'same', 1]], weak: [['rectus_abd', 'both', 1]],
      points: ['BL23', 'BL25', 'EX-B2', 'BL52', 'BL40'], chain: ['pelvis', 'sacrum'],
      bones: [['bn-lspine', 'same', '關節突關節受壓'], ['bn-hip', 'both', '骨盆前傾使腰椎前凸']], techs: ['tq-ischemic', 'tq-l-traction', 'tq-pelvis-ap'],
      tech: '先處理造成前凸的骨盆 A（股直肌、髂腰肌），再放鬆腰旁豎脊、多裂肌；側臥溫和牽引、屈曲方向活動，不做後仰頂腰。' },
    { id: 'p_sij', name: '薦髂關節功能障礙', region: ['sacrum', 'pelvis'], src: '課堂（薦椎檢查）、補充',
      desc: '髂後上棘附近單側痛，坐姿前彎一側髂後上棘先上移、4 字測試痛在後側；常和骨盆角度、梨狀肌一起出現。',
      t: { s_flex_test: 3, q_faber_si: 3, c_si: 2, t_stl_tight: 1, o_gfold: 1, t_rot_limited: 1 },
      tight: [['piriformis', 'same', 2], ['glute_max', 'same', 2], ['ql', 'same', 1], ['multifidus', 'same', 1]], weak: [['glute_med', 'same', 1]],
      points: ['BL27', 'BL28', 'BL31', 'BL32', 'GB30', 'BL40'], chain: ['pelvis', 'lspine', 'hip'],
      bones: [['bn-sacrum', 'mid', '薦髂關節只動約 2°'], ['bn-hip', 'same', '量三角度']], techs: ['tq-sij', 'tq-sacrum', 'tq-pelvis-ap', 'tq-met'],
      tech: '先量骨盆三角度找差最多的，處理該角度最緊的肌肉；薦髂周圍以溫和壓放、呼吸配合，不做衝擊。' },
    { id: 'p_hipjoint', name: '髖關節本身問題（夾擠、退化）', region: ['hip'], src: '補充：一般臨床鑑別', refer: true,
      desc: '鼠蹊深處痛、4 字與髖內轉受限且痛，蹲、穿襪困難；年長者要考慮退化性關節炎。',
      t: { q_faber_groin: 3, q_hip_ir: 2, c_groin: 2, t_joint: 1, s_hip_rot: 1 },
      tight: [['iliopsoas', 'same', 2], ['adductors', 'same', 2], ['deep_rot', 'same', 1], ['tfl_itb', 'same', 1]], weak: [['glute_med', 'same', 1]],
      points: ['GB29', 'GB30', 'ST31', 'LR11'], chain: ['hip', 'pelvis', 'knee'],
      bones: [['bn-femur', 'same', '股骨頭'], ['bn-hip', 'same', '髖臼']], techs: ['tq-hip', 'tq-ischemic', 'tq-principles'],
      tech: '周邊肌肉放鬆與溫和牽引；主被動都受限、夜間痛或持續惡化，建議影像檢查。' },
    { id: 'p_impinge', name: '肩峰下夾擠（疼痛弧）', region: ['shoulder', 'scap'], src: '課堂 0907、補充',
      desc: '肩外展 60–120° 痛、過了反而不痛；肩胛前傾（胸小肌緊）、肩峰下空間變小。',
      t: { a_sh_arc: 4, c_sh_raise: 2, o_round: 1, q_sh_lift: 1, t_pecmin: 1, o_wing: 1 },
      tight: [['pec_minor', 'same', 3], ['supraspinatus', 'same', 1], ['subscap', 'same', 1], ['trap_u', 'same', 1]], weak: [['trap_l', 'same', 2], ['serratus', 'same', 2], ['infraspinatus', 'same', 1]],
      points: ['LI15', 'TE14', 'SI10', 'SI11', 'ST38'], chain: ['scap', 'tspine'],
      bones: [['bn-scapula', 'same', '肩胛前傾、上旋不足'], ['bn-humerus', 'same', '']], techs: ['tq-scap', 'tq-ischemic', 'tq-gh', 'tq-distal'],
      tech: '先鬆胸小肌讓肩胛回位，再處理棘上、肩胛下；強化下斜方與前鋸肌。' },
    { id: 'p_frozen', name: '五十肩（沾黏性關節囊炎）傾向', region: ['shoulder'], src: '課堂、整合說明',
      desc: '外轉最受限，主動、被動都受限且痛，夜間痛；是軟組織沾黏，不是骨頭錯位。',
      t: { a_sh_er: 4, a_sh_ir: 2, t_joint: 2, c_sh_raise: 1, c_onset_chronic: 1 },
      tight: [['subscap', 'same', 3], ['pec_major', 'same', 2], ['teres_major', 'same', 2], ['lat', 'same', 1]], weak: [],
      points: ['LI15', 'TE14', 'SI9', 'LU1', 'ST38'], chain: ['shoulder', 'scap'],
      bones: [['bn-humerus', 'same', '關節囊'], ['bn-scapula', 'same', '']], techs: ['tq-gh', 'tq-scap', 'tq-ischemic', 'tq-principles'],
      tech: '無痛範圍內的關節鬆動與肩胛下肌放鬆；不硬扳。疼痛期很痛時建議就醫。' },
    { id: 'p_c_radic', name: '疑似頸神經根壓迫', region: ['cspine'], src: '補充：一般臨床鑑別', refer: true,
      desc: '頸後仰並轉向一側時手麻加重、沿皮節放射，可能伴無力。',
      t: { a_neck_ext: 4, c_arm_numb: 2, r_weak: 2, c_pain_numb: 1 },
      tight: [['scalene', 'same', 1], ['levator', 'same', 1]], weak: [], points: [], chain: ['cspine', 'shoulder', 'elbow'],
      bones: [['bn-cspine', 'same', '椎間孔'], ['bn-disc', 'mid', '']], techs: ['tq-principles'],
      tech: '先轉介；推拿只做周邊溫和放鬆，不做頸部旋轉、後仰與扳動。' },
    { id: 'p_kneehyper', name: '膝過伸', region: ['knee', 'pelvis'], src: '補充：肌動學',
      desc: '站立時膝往後頂，常伴搖擺背；膝後囊與膕肌受牽扯。',
      t: { o_knee_hyper: 4, o_sway: 1, c_knee_back: 1 },
      tight: [['rectus_fem', 'same', 1], ['soleus', 'same', 1]], weak: [['hamstrings', 'same', 2], ['popliteus', 'same', 1], ['gastroc', 'same', 1]],
      points: ['BL40', 'BL39', 'KI10'], chain: ['knee', 'pelvis', 'ankle'],
      bones: [['bn-tibia', 'same', ''], ['bn-femur', 'same', '']], techs: ['tq-knee', 'tq-met'],
      tech: '放鬆股直肌與比目魚肌，練習站立時膝微彎、強化膕繩肌。' },
    { id: 'p_scoli_func', name: '功能性側彎（源於下肢）', region: ['lspine', 'pelvis'], src: '課堂（由下往上）、整合說明',
      desc: '站姿側彎、坐下就消失或減輕：源頭在長短腳、足踝或膝。',
      t: { s_scoli_gone: 4, o_scoli: 1, t_heel_short: 1, q_leg_short: 1, o_flatfoot: 1 },
      tight: [['ql', 'same', 1]], weak: [], points: ['BL23', 'GB34', 'KI3'], chain: ['foot', 'ankle', 'knee', 'pelvis'],
      bones: [['bn-hip', 'both', ''], ['bn-talus', 'both', '由下往上查'], ['bn-lspine', 'mid', '']], techs: ['tq-foot', 'tq-ankle', 'tq-pelvis-ap'],
      tech: '先找「為什麼短」：足、距骨、膝、股骨、骨盆依序查，處理後再站起來看側彎。' },
    { id: 'p_scoli_pelvis', name: '骨盆／脊椎源性側彎', region: ['lspine', 'pelvis', 'sacrum'], src: '課堂（第三角度）、整合說明',
      desc: '坐下側彎仍在：源頭在骨盆（③ 角度造成直接側彎）、薦椎或脊椎本身。發育中的青少年請骨科追蹤。',
      t: { s_scoli_stay: 4, o_scoli: 1, s_crest_high: 1, s_lean: 1, q_rib_flare: 1 },
      tight: [['ql', 'same', 2], ['iliopsoas', 'same', 1], ['erector', 'same', 1]], weak: [], points: ['BL23', 'BL52', 'GB25', 'EX-B2'], chain: ['pelvis', 'sacrum', 'lspine', 'tspine'],
      bones: [['bn-hip', 'same', '③ EX／IN'], ['bn-sacrum', 'mid', ''], ['bn-lspine', 'mid', '凹側腰方肌、髂腰肌']], techs: ['tq-pelvis-3', 'tq-sacrum', 'tq-ischemic'],
      tech: '量骨盆三角度與薦椎，先處理差最多的；凹側腰方肌、髂腰肌放鬆後重新評估。' },
    { id: 'p_sc', name: '胸鎖／肩鎖關節', region: ['shoulder', 'scap'], src: '課堂 1012、整合說明',
      desc: '鎖骨內端突出或壓痛、舉手時鎖骨附近痛；多與肩胛、肱骨位置有關。',
      t: { q_sc_prom: 3, o_clav_high: 2, c_sh_front: 1 },
      tight: [['scm', 'same', 1], ['pec_major', 'same', 2], ['pec_minor', 'same', 1]], weak: [], points: ['KI27', 'ST12', 'LU1', 'LI16'], chain: ['shoulder', 'cspine'],
      bones: [['bn-clavicle', 'same', '胸鎖＝馬鞍關節'], ['bn-sternum', 'mid', ''], ['bn-scapula', 'same', '先看肩胛與肩']], techs: ['tq-sc', 'tq-scap', 'tq-gh'],
      tech: '不直接按壓突出處；先處理肩胛與肱骨外轉，再看鎖骨是否回位。' },
  ];
  NEW.forEach((p) => { if (!P[p.id]) window.PATTERNS.push(p); });
})();

/* 由 3D 模型骨骼名稱對到骨骼詳解 id */
window.boneIdOf = function (zh) {
  const b = String(zh || '').replace(/^[左右]/, '');
  const R = [[/椎間盤/, 'bn-disc'], [/寰椎/, 'bn-c1'], [/樞椎/, 'bn-c2'], [/頸椎/, 'bn-cspine'], [/胸椎/, 'bn-tspine'], [/腰椎/, 'bn-lspine'], [/薦椎|薦骨/, 'bn-sacrum'], [/尾骨|尾椎/, 'bn-coccyx'],
    [/額骨/, 'bn-frontal'], [/頂骨/, 'bn-parietal'], [/顳骨/, 'bn-temporal'], [/枕骨/, 'bn-occipital'], [/蝶骨/, 'bn-sphenoid'], [/篩骨/, 'bn-ethmoid'], [/顴骨/, 'bn-zygoma'], [/下頜|下顎/, 'bn-mandible'], [/舌骨/, 'bn-hyoid'],
    [/肋/, 'bn-rib'], [/胸骨|劍突/, 'bn-sternum'], [/鎖骨/, 'bn-clavicle'], [/肩胛骨/, 'bn-scapula'], [/肱骨/, 'bn-humerus'], [/橈骨/, 'bn-radius'], [/尺骨/, 'bn-ulna'],
    [/舟狀骨（腕）/, 'bn-scaphoid'], [/月狀骨/, 'bn-lunate'], [/頭狀骨/, 'bn-capitate'], [/三角骨|豌豆骨|多角骨|鉤狀骨/, 'bn-carpals'], [/掌骨/, 'bn-metacarpal'], [/指骨/, 'bn-phal-hand'],
    [/髖骨|無名骨/, 'bn-hip'], [/股骨/, 'bn-femur'], [/髕骨/, 'bn-patella'], [/脛骨/, 'bn-tibia'], [/腓骨/, 'bn-fibula'], [/距骨/, 'bn-talus'], [/跟骨/, 'bn-calcaneus'], [/舟狀骨（足）/, 'bn-navicular'], [/骰骨/, 'bn-cuboid'], [/楔狀骨/, 'bn-cuneiform'], [/蹠骨/, 'bn-metatarsal'], [/趾骨/, 'bn-phal-foot']];
  for (const [re, id] of R) if (re.test(b)) return id;
  return null;
};
