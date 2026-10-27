/* ===== 客人評估 v3：分站（主訴 → 站姿 → 坐姿 → 俯臥 → 仰臥 → 動作測試）、骨性標誌、處理原則 =====
   依課堂流程（k-eval-0903、k-eval-order）與整合說明 u-treatment-order 編排。
   item: { id, label（看得到的現象，短）, side?, sideLabel?, how?（怎麼檢查，一句）, lm?（骨性標誌 key） }
   這個檔案在 data_rules.js 之後載入：重建 window.FINDINGS。模式（PATTERNS）全部定義在 data_rules.js。
   2026-10 優化：合併重複項目（舊 id 見 FINDING_ALIASES），新增 c_rest_pain、t_heel90_uneven、a_sh_resist。 */

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
  { id: 'cc', name: '主訴', sub: '傷科問診', pose: 'map', intro: '先問清楚：哪裡痛、多久、怎麼開始、什麼時候加重。點人形上的部位可直接勾選（點左右側的點分別記左／右，兩側都點＝雙側）。安全警訊先問，有勾選就先轉介。',
    groups: [
      { name: '安全警訊（先問）', red: true, items: [
        { id: 'r_trauma', label: '外傷後劇痛、變形、腫脹', how: '車禍、跌倒、撞擊後不能承重或骨頭局部劇痛 → 先排除骨折。' },
        { id: 'r_night', label: '夜間痛加劇、發燒、體重減輕', how: '躺著休息也越來越痛，或有癌症病史 → 先就醫（單純睡覺壓到才痛不算）。' },
        { id: 'r_saddle', label: '大小便異常、會陰麻木', how: '馬尾症候群警訊 → 立即急診。' },
        { id: 'r_weak', label: '進行性無力、肌肉萎縮', how: '腳抬不起、拖腳、握力越來越差 → 先轉介。' },
        { id: 'r_chest', label: '胸痛合併冒冷汗或喘', how: '可能是心臟問題 → 立即就醫。' },
        { id: 'r_headache', label: '突發劇烈頭痛、口齒不清', how: '「這輩子最痛」的頭痛、單側無力、講話不清 → 立即就醫。' },
        { id: 'r_vasc', label: '轉頭或仰頭時頭暈、視線模糊、噁心', how: '椎動脈供血警訊：不做頸部旋轉、後仰，先轉介。' },
        { id: 'r_osteo', label: '骨質疏鬆、長期類固醇或高齡', how: '骨頭脆：不做衝擊、扳動，按壓力道減輕。' },
        { id: 'r_anticoag', label: '服用抗凝血劑、容易瘀青', how: '力道放輕，避免深壓與刮痧式手法。' },
      ] },
      { name: '頭頸', items: [
        { id: 'c_head_front', label: '前額痛', lm: 'forehead' }, { id: 'c_head_side', label: '側頭痛（偏頭痛）', side: true, lm: 'temple' }, { id: 'c_head_back', label: '後頭痛（枕部）', lm: 'occ' }, { id: 'c_head_top', label: '頭頂痛（巔頂）', lm: 'vertex' },
        { id: 'c_neck', label: '頸痛、轉頭卡', side: true, lm: 'neck_b' }, { id: 'c_neckstiff', label: '肩頸僵硬、痠', lm: 'c7' }, { id: 'c_jaw', label: '顳顎痛、咬合痛', side: true, lm: 'jaw' },
      ] },
      { name: '肩與上肢', items: [
        { id: 'c_sh_front', label: '肩前痛', side: true, lm: 'shf' }, { id: 'c_sh_raise', label: '舉手痛、舉不高', side: true, lm: 'acrom' }, { id: 'c_scap_between', label: '肩胛骨之間痛', lm: 'tsp' },
        { id: 'c_arm_numb', label: '手麻', side: true, lm: 'hand' }, { id: 'c_elbow_lat', label: '手肘外側痛', side: true, lm: 'elat' }, { id: 'c_elbow_med', label: '手肘內側痛', side: true, lm: 'emed' }, { id: 'c_wrist', label: '手腕痛', side: true, lm: 'wrist' },
      ] },
      { name: '軀幹與骨盆', items: [
        { id: 'c_chest', label: '胸悶、呼吸淺', lm: 'chest' }, { id: 'c_lbp', label: '下背痛', side: true, lm: 'erec' },
        { id: 'c_lbp_acute', label: '閃到腰（突然發生）', side: true, lm: 'ql', how: '彎腰、搬重物、轉身時突然痛到不太能動。' },
        { id: 'c_si', label: '薦髂、臀部痛', side: true, lm: 'psis' }, { id: 'c_groin', label: '鼠蹊、恥骨痛', side: true, lm: 'groin' },
      ] },
      { name: '下肢', items: [
        { id: 'c_sciatic', label: '臀腿後側放射痛', side: true, lm: 'ham' }, { id: 'c_thigh_lat', label: '大腿外側緊痛', side: true, lm: 'tlat' },
        { id: 'c_knee_front', label: '膝前痛', side: true, lm: 'kf' }, { id: 'c_knee_med', label: '膝內側痛', side: true, lm: 'km' }, { id: 'c_knee_lat', label: '膝外側痛', side: true, lm: 'kl' }, { id: 'c_knee_back', label: '膝後痛', side: true, lm: 'popl' },
        { id: 'c_calf', label: '小腿緊、抽筋', side: true, lm: 'calf' }, { id: 'c_ankle', label: '腳踝痛、舊扭傷', side: true, lm: 'ank' }, { id: 'c_heel', label: '腳跟、足底痛', side: true, lm: 'heel' },
      ] },
      { name: '病程與誘因（傷科）', items: [
        { id: 'c_onset_acute', label: '急性：72 小時內、剛受傷', how: '急性期以舒緩為主：遠端取穴配合活動，局部不重壓、不矯正。' },
        { id: 'c_onset_sub', label: '亞急性：數天到 3 個月', how: '腫痛已退但還沒恢復：無痛範圍內逐步增加活動。' },
        { id: 'c_onset_chronic', label: '慢性：超過 3 個月或反覆發作', how: '慢性的痛點多是「受害者」：由下往上找上下游的原因。' },
        { id: 'c_mech_trauma', label: '有扭傷、跌倒、撞擊史', how: '問清楚哪一年、哪一側、當時有沒有就醫。' },
        { id: 'c_mech_overuse', label: '重複動作、久坐久站、姿勢引起', how: '問工作姿勢與慣用手、支撐腳：這是一股固定的拉力。' },
        { id: 'c_surgery', label: '開過刀、骨折、人工關節', how: '手術部位與人工關節依醫囑角度，不做扳動。' },
        { id: 'o_pregnant', label: '孕期、產後', how: '孕期不做矯正，避開合谷、三陰交、肩井、崑崙、至陰與腹部、腰薦重壓，側臥為主。' },
      ] },
      { name: '疼痛性質', items: [
        { id: 'c_pain_sharp', label: '刺痛、動到某個角度才痛', how: '偏組織受傷或夾擠：找出痛的角度，處理時避開它。' },
        { id: 'c_pain_dull', label: '痠脹悶痛、按了舒服', how: '多為「被拉長的痛」或疲勞：找對側或拮抗側縮短的肌肉。' },
        { id: 'c_pain_numb', label: '麻、電、放射感', how: '沿神經路徑：對照皮節找節段，並做直腿抬高或頸椎測試。' },
        { id: 'c_pain_swell', label: '紅、腫、熱', how: '發炎期：不熱敷、不深壓局部，可冰敷並處理上下游。' },
        { id: 'c_rest_pain', label: '休息、夜裡也會痛', how: '不是壓到才痛：多見於五十肩、肌腱炎這類發炎沾黏；合併發燒、體重減輕、越來越痛時改勾安全警訊。' },
        { id: 'c_worse_morning', label: '早上起床最僵、活動後改善', how: '晨僵超過 1 小時、年輕人的下背與臀痛 → 建議就醫排除發炎性關節炎。' },
        { id: 'c_worse_sit', label: '久坐加重', how: '坐久起身時最痛：想到椎間盤、梨狀肌、骨盆後倒坐姿。' },
        { id: 'c_worse_stand', label: '久站、走路加重', how: '想到小面關節受壓（腰椎前凸）、足弓與足底筋膜。' },
        { id: 'c_worse_cough', label: '咳嗽、打噴嚏、用力時痛', how: '腹壓上升時痛或往腿放射 → 偏椎間盤，先做神經學篩檢。' },
      ] },
    ] },
  { id: 'stand', name: '站姿', sub: '正面、側面、背面觀察', pose: 'stand', intro: '客人放鬆站、雙腳與肩同寬、眼看前方，不要刻意站直。依課堂順序由下往上看：足 → 踝、距骨 → 膝 → 骨盆 → 肩胛 → 頭。望診看外觀，再用觸診確認。',
    groups: [
      { name: '正面', items: [
        { id: 'o_flatfoot', label: '足弓塌（扁平足）', side: true, lm: 'foot', how: '看內側足弓與地面的空隙；請客人踮腳，足弓出現＝柔軟型。' },
        { id: 'o_toe_out', label: '腳尖外八', side: true, lm: 'foot', how: '比較兩腳尖朝外的角度。不是筆記的 ② 判定依據，② EX／IN 以俯臥髂後上棘為準；其他說法（參考）：外八多伴髖外轉、臀後六肌緊，或股骨前傾角。' },
        { id: 'o_toe_in', label: '腳尖內八', side: true, lm: 'foot', how: '比較兩腳尖朝內的角度。其他說法（參考）：內八多伴髖內轉，常見於 ② EX 側。' },
        { id: 'o_knee_o', label: 'O 型腿（膝內翻）', how: '雙腳內踝併攏時兩膝之間有空隙。' }, { id: 'o_knee_x', label: 'X 型腿（膝外翻）', how: '雙膝併攏時兩內踝碰不到。' },
        { id: 'o_patella_in', label: '髕骨朝內', side: true, lm: 'kf', how: '腳尖朝正前方時髕骨卻朝內 → 股骨內轉。' },
        { id: 'o_sh_high', label: '高低肩', side: true, sideLabel: '高側', lm: 'clav', how: '比較肩峰與鎖骨高度，再從背面看肩胛上角、下角是否平行（有旋轉時高低可能是旋轉帶出來的）。' },
        { id: 'o_head_tilt', label: '頭側傾', side: true, sideLabel: '傾向', lm: 'jaw', how: '站、坐都看：坐下仍側傾 → 頸肩本身；坐下消失 → 往下查。' },
      ] },
      { name: '側面', items: [
        { id: 'o_head_fwd', label: '頭前傾（耳垂在肩峰前）', lm: 'scm', how: '重力線：耳垂、肩峰、大轉子、膝前、外踝前應約在同一直線。' },
        { id: 'o_round', label: '圓肩', lm: 'shf', how: '肩峰在耳垂前方、手背朝前；分清是肩胛整塊前傾，還是只有肱骨內轉。' },
        { id: 'o_kyph', label: '駝背（胸椎後凸）', lm: 'tsp', how: '看上背弧度；趴下後仍拱起 → 偏結構性。' },
        { id: 'o_lordosis', label: '臀翹、腰窩深（腰椎前凸增加）', lm: 'erec', how: '① A 線索，要到俯臥用髂後上棘確認。' },
        { id: 'o_flatback', label: '臀扁、腰平', lm: 'sac', how: '① P 線索，要到俯臥用髂後上棘確認。' },
        { id: 'o_sway', label: '骨盆前移、上身後仰（搖擺背）', lm: 'troch', how: '大轉子在重力線前方、胸廓往後，常伴膝過伸。' },
        { id: 'o_knee_hyper', label: '膝往後頂（膝過伸）', side: true, lm: 'popl', how: '側面看膝在重力線後方。' },
      ] },
      { name: '背面', items: [
        { id: 'o_calc_valgus', label: '跟骨外翻', side: true, lm: 'heel', how: '從後面看跟腱與跟骨的線往外歪，常伴足弓塌。' },
        { id: 'o_gfold', label: '臀褶一側較低', side: true, sideLabel: '低側', lm: 'gfold', how: '低側臀部下垂：① P 或該側骨盆偏低的線索。' },
        { id: 'o_crest_high', label: '髂嵴一側較高', side: true, sideLabel: '高側', lm: 'crest', how: '兩手掌平放髂嵴上緣、拇指順便比髂前上棘；整側都高＝骨盆側傾（長短腳、③ EX、腰方肌），坐下再比一次。' },
        { id: 'o_waist_tri', label: '腰三角不對稱', side: true, sideLabel: '空隙大側', lm: 'waist', how: '手臂自然下垂，比較手臂與腰之間的空隙。' },
        { id: 'o_scoli', label: '脊椎側彎', side: true, sideLabel: '凸側(腰)', lm: 'tl', how: '沿棘突畫線；請客人前彎，看肋骨或腰是否一側隆起（有隆起＝有旋轉）。' },
        { id: 'o_scap_dist', label: '肩胛內緣離脊椎較遠', side: true, lm: 'scap_med', how: '量兩側肩胛內緣到棘突的距離；遠的一側肩胛前突，菱形肌、中斜方被拉長。' },
        { id: 'o_wing', label: '翼狀肩胛', side: true, lm: 'scap_inf', how: '雙手推牆，肩胛內緣、下角翹起 → 前鋸肌無力。' },
        { id: 'o_lean_down', label: '身體向痛側彎（痛側在下）', side: true, sideLabel: '痛側', lm: 'waist', how: '筆記：急性腰閃傷的外觀。有放射痛、麻木無力時仍先做神經學篩檢。' },
        { id: 'o_lean_up', label: '身體偏離痛側（痛側在上）', side: true, sideLabel: '痛側', lm: 'waist', how: '筆記：椎間盤（慢性）的外觀。' },
      ] },
    ] },
  { id: 'sit', name: '坐姿', sub: '背面觀察', pose: 'sit', intro: '客人坐在沒有扶手的椅子或床緣，雙腳踩地、膝 90°。坐下後腿長的影響被排除：站姿有、坐姿消失的歪斜來自下肢；坐姿仍在的來自骨盆、薦椎或脊椎本身。',
    groups: [
      { name: '坐姿背面', items: [
        { id: 's_scoli_gone', label: '坐下後側彎消失或減輕', lm: 's_tsp', how: '→ 源頭在下肢（長短腳、足、膝）。' },
        { id: 's_scoli_stay', label: '坐下後側彎仍在', lm: 's_tsp', how: '→ 源頭在骨盆、薦椎或脊椎本身。' },
        { id: 's_crest_high', label: '坐姿髂嵴仍一側較高', side: true, sideLabel: '高側', lm: 's_crest', how: '坐下仍高 → 骨盆本身（③ 角度、腰方肌），不是腿長。' },
        { id: 's_lean', label: '坐姿身體偏向一側', side: true, sideLabel: '偏向', lm: 's_isch', how: '手掌放在兩側坐骨下，比較承重是否一樣。' },
        { id: 's_sh_high', label: '坐姿仍高低肩', side: true, sideLabel: '高側', lm: 's_acrom', how: '坐下仍高低 → 與下肢無關，看骨盆、脊椎與肩胛本身。' },
        { id: 's_slump', label: '坐在薦骨上（骨盆後倒、駝背）', lm: 's_tsp', how: '自然坐時骨盆往後倒、腰背拱起。' },
      ] },
      { name: '坐姿動作', items: [
        { id: 's_flex_test', label: '前彎時一側髂後上棘先往上跑', side: true, lm: 's_psis', how: '兩拇指放兩側髂後上棘下緣，請客人慢慢往前彎；先上移或上移較多的一側，薦髂關節活動較差。' },
        { id: 's_rot_lim', label: '轉身受限或痛', side: true, sideLabel: '轉向', lm: 's_tsp', how: '坐姿雙手抱胸往左右轉（骨盆被固定），比較角度與痛；② EX／IN 會帶出脊椎旋轉。' },
      ] },
    ] },
  { id: 'prone', name: '俯臥', sub: '靜態觸診', pose: 'prone', intro: '客人趴好、臉放洞裡、雙手放身側，先托腿讓脊椎被撐起、肌肉放鬆（筆記）。由下往上：足跟 → 膝 → 坐骨、大轉子 → 骨盆（髂後上棘對 S2）→ 薦椎 → 腰胸椎 → 肩胛。兩側一起比，不要只摸一邊。',
    groups: [
      { name: '下肢', items: [
        { id: 't_heel_long', label: '長腳側（足跟較靠足端）', side: true, lm: 'heel', how: '俯臥雙腳併攏、腳背放鬆比兩足跟（或仰臥擺正骨盆比內踝下緣）；先排除骨折、手術造成的結構性長短。' },
        { id: 't_heel_short', label: '短腳側（足跟較靠頭端）', side: true, lm: 'heel', how: '與長腳是同一個比較：判斷哪一側「不正常」後勾那一側。' },
        { id: 't_heel90_uneven', label: '屈膝 90°：兩足跟高低不同', side: true, sideLabel: '較高側', lm: 'heel', how: '筆記薦椎檢查第 2 步：小腿頂起成屈膝，從床尾看兩足跟是否一樣高；不同 → 薦椎或骨盆歪。' },
        { id: 't_heel_buttock', label: '屈膝：足跟離臀部較近', side: true, lm: 'heel', how: '筆記：較近的一側多為 ① A；只當輔助，以髂後上棘高低為主。' },
        { id: 't_heel_buttock_far', label: '屈膝：足跟離臀部較遠', side: true, lm: 'heel', how: '① P 的輔助線索。' },
        { id: 't_heel_out', label: '屈膝 90°：較外轉、足跟偏外', side: true, lm: 'popl', how: '筆記：俯臥膝背屈 90°，兩側比較；較外轉、足跟偏外的一側 → ② EX 線索。' },
        { id: 't_heel_in', label: '屈膝 90°：較內轉、足跟偏內', side: true, lm: 'popl', how: '與 EX 側相反 → ② IN 線索。' },
        { id: 't_rot_limited', label: '抬小腿做內外旋：一側打不開', side: true, lm: 'popl', how: '筆記薦椎檢查第 3 步：打不開可能是薦髂關節、髖關節或附近肌肉卡住。' },
        { id: 'p_ham_tender', label: '膕繩肌緊、壓痛', side: true, lm: 'ham', how: '坐骨結節下方到大腿後側，兩側比硬度與壓痛。' },
        { id: 'p_calf_tender', label: '小腿後側緊、壓痛', side: true, lm: 'calf', how: '腓腸肌兩頭與比目魚肌（承山一帶），兩側比較。' },
      ] },
      { name: '骨盆與薦椎', items: [
        { id: 't_psis_high', label: '髂後上棘偏頭側（較高）', side: true, lm: 'psis', how: '兩拇指沿髂嵴往後找到最後的骨突（約平 S2），放在下緣比較：偏頭側＝① A 線索。' },
        { id: 't_psis_low', label: '髂後上棘偏足側（較低）', side: true, lm: 'psis', how: '偏足側＝① P 線索。' },
        { id: 't_psis_far', label: '同高、離 S2 較遠（② EX）', side: true, lm: 'psis', how: '兩側同一水平時，量拇指到 S2 中線的距離：遠＝② EX。' },
        { id: 't_psis_near', label: '同高、離 S2 較近（② IN）', side: true, lm: 'psis', how: '近＝② IN。' },
        { id: 't_psis_upfar', label: '又高又遠（③ EX）', side: true, lm: 'psis', how: '髂後上棘偏頭側且離 S2 遠、髂嵴與坐骨結節也一起偏頭側 → ③ EX（短腳）；勾這項就不要再勾「較高」「較遠」。' },
        { id: 't_psis_lownear', label: '又低又近（③ IN）', side: true, lm: 'psis', how: '偏足側且靠近 S2 → ③ IN；勾這項就不要再勾「較低」「較近」。' },
        { id: 't_isch_high', label: '坐骨結節較高', side: true, lm: 'isch', how: '拇指由臀橫紋中點往上頂到坐骨結節下緣比較：較高＝① A 線索。' },
        { id: 't_isch_low', label: '坐骨結節較低、臀部下垂', side: true, lm: 'isch', how: '① P 線索。' },
        { id: 't_troch_thick', label: '大轉子摸起來較厚', side: true, lm: 'troch', how: '手先放鬆、指尖張開，上下都摸到骨頭才算；厚＝② EX 輔助線索。' },
        { id: 't_troch_thin', label: '大轉子摸起來較薄、尖', side: true, lm: 'troch', how: '薄尖＝② IN 輔助線索。' },
        { id: 't_stl_tight', label: '薦結節韌帶較緊、滑動差', side: true, lm: 'stl', how: '坐骨結節內上方往薦骨外下緣，拇指橫向撥動比較彈性；② EX 側常較緊。' },
        { id: 'p_sacbase', label: '薦骨底一側較深', side: true, lm: 'sac', how: '拇指放在兩側髂後上棘內側的薦骨溝，較深的一側薦骨底往前（點頭）。' },
        { id: 'p_ila', label: '薦骨下外角一側較凸', side: true, lm: 'sac', how: '兩拇指放薦骨下端兩側的下外角，比較哪一側較往後凸。' },
        { id: 'p_piri_tender', label: '梨狀肌（臀中央深處）壓痛', side: true, lm: 'piri', how: '薦骨外緣到大轉子上緣的連線上；壓下去若腿麻立即減力。' },
        { id: 'p_gmed_tender', label: '臀中肌（髂嵴下方）壓痛', side: true, lm: 'gmed', how: '髂嵴下 2–3 指到大轉子上方，兩側比硬度與壓痛。' },
      ] },
      { name: '脊椎與肩胛', items: [
        { id: 'p_ql_tender', label: '腰方肌壓痛（髂嵴上緣外側）', side: true, lm: 'ql', how: '沿髂嵴上緣、第 12 肋下緣往內按，重現腰側痛。' },
        { id: 'p_erec_bulge', label: '腰旁肌一側隆起、較硬', side: true, lm: 'erec', how: '手掌平放腰兩側比較飽滿度與硬度。' },
        { id: 'p_spinous', label: '棘突或棘突旁壓痛、排列偏移', lm: 'tl', how: '中指放棘突、食指無名指放兩側，由上往下滑，找轉折點與壓痛。' },
        { id: 'p_tl_junction', label: '胸腰交界（T12–L1）轉折、壓痛', lm: 'tl', how: '第 12 肋往內找到 T12，比較上下兩節的旋轉方向。' },
        { id: 'p_scap_tender', label: '肩胛內緣條索、壓痛', side: true, lm: 'scap_med', how: '菱形肌、中斜方、提肩胛肌附著處；按了舒服多是被拉長的痛。' },
        { id: 't_infra', label: '天宗壓痛、放射到肩前', side: true, lm: 'infra', how: '棘下窩中央按壓，痛往肩前、上臂走 → 棘下肌。' },
        { id: 't_scap_sitlie', label: '坐 → 臥：肩胛位置改變', side: true, lm: 'scap_inf', how: '先在坐姿標記兩側肩胛下角，趴下後再比：改變 → 跟骨盆有關（筆記）。' },
        { id: 't_scap_same', label: '坐 → 臥：肩胛位置不變', side: true, lm: 'scap_inf', how: '不變且骨盆正 → 問題在肩本身（筆記）。' },
      ] },
    ] },
  { id: 'supine', name: '仰臥', sub: '靜態觸診與測試', pose: 'supine', intro: '客人仰臥、雙腿伸直放中線。先看再摸：腳掌倒向、內踝長短 → 髂前上棘、恥骨 → 腹部 → 胸廓、鎖骨、肩峰 → 頸前與枕下；最後做仰臥的測試。',
    groups: [
      { name: '下肢與骨盆', items: [
        { id: 'q_foot_out', label: '腳掌外倒較多', side: true, lm: 'foot', how: '放鬆時腳掌往外倒得多＝股骨外轉。不是筆記的 ② 判定依據；其他說法（參考）：常見於臀後六肌緊、② IN 側。' },
        { id: 'q_foot_in', label: '腳掌較直立、外倒較少', side: true, lm: 'foot', how: '其他說法（參考）：髖偏內轉，常見於 ② EX 側；② 以俯臥髂後上棘為準。' },
        { id: 'q_longsit_ant', label: '仰臥 → 長坐：內踝由長變短', side: true, lm: 'ank', how: '先屈膝抬臀放下擺正骨盆比內踝，再請客人直膝坐起比一次：由長變短 → ① A。' },
        { id: 'q_longsit_post', label: '仰臥 → 長坐：內踝由短變長', side: true, lm: 'ank', how: '由短變長 → ① P。' },
        { id: 'q_asis_low', label: '髂前上棘偏足側（較低）', side: true, lm: 'asis', how: '兩拇指放髂前上棘下緣比較：① A 時髂前上棘往前下。' },
        { id: 'q_asis_high', label: '髂前上棘偏頭側（較高）', side: true, lm: 'asis', how: '① P 時髂前上棘往後上。' },
        { id: 'q_pubic', label: '恥骨上支一側較高', side: true, sideLabel: '高側', lm: 'pubis', how: '先說明並取得同意，手掌由肚臍往下滑到恥骨上緣，兩拇指比較；③ 角度常伴恥骨高低。' },
        { id: 'q_adductor', label: '大腿內側（內收肌）緊、壓痛', side: true, lm: 'tmed', how: '由膝往鼠蹊分段按，兩側比較；鼠蹊處力道放輕。' },
        { id: 'q_patella', label: '髕骨活動差、偏外', side: true, lm: 'kf', how: '膝放鬆伸直，上下、內外推動髕骨比較兩側。' },
        { id: 't_pes', label: '鵝足壓痛（膝內下）', side: true, lm: 'pes', how: '脛骨內上、膝關節線下約 2–3 指；靠近肌腱附著處，只輕壓。' },
        { id: 't_itb', label: '膝外上方（膝陽關）壓痛', side: true, lm: 'kl', how: '股骨外上髁上方的凹陷，髂脛束經過處。' },
      ] },
      { name: '腹部與胸廓', items: [
        { id: 'q_psoas', label: '臍旁深層（腰大肌）壓痛', side: true, lm: 'psoas', how: '屈膝放鬆腹部，臍旁 2–3 指慢慢沉入，請客人輕抬腿確認；避開腹主動脈搏動處。' },
        { id: 'q_abd_tense', label: '腹部緊繃（腹直肌）', lm: 'abd', how: '手掌平放腹部，請客人放鬆呼吸，仍緊硬或一側較緊。' },
        { id: 'q_rib_flare', label: '肋弓外翻、一側肋骨隆起', side: true, lm: 'rib', how: '從床尾看兩側肋弓；手放下肋請客人深吸，比較擴張。' },
        { id: 'q_sh_lift', label: '肩峰離床面較高', side: true, lm: 'shf', how: '從床頭或床尾看兩肩峰到床面的距離：高的一側胸小肌緊。' },
        { id: 't_pecmin', label: '喙突內下方壓痛（胸小肌）', side: true, lm: 'cora', how: '喙突內下方、第 3–5 肋上，按壓時請客人吸氣更明顯；手麻即減力。' },
        { id: 'q_sc_prom', label: '胸鎖關節一側前突、壓痛', side: true, lm: 'sc', how: '站姿先看、仰臥再摸兩側鎖骨內端：前突的一側鎖骨被肩往前內擠。' },
      ] },
      { name: '頸與頭', items: [
        { id: 'q_scm', label: '胸鎖乳突肌緊、壓痛', side: true, lm: 'scm', how: '頭稍轉向同側讓肌肉放鬆，拇指與食指拿捏；避開頸動脈搏動處。' },
        { id: 't_scalene', label: '缺盆上方（斜角肌）壓痛、手麻重現', side: true, lm: 'scal', how: '只輕觸，不重壓缺盆（臂神經叢、鎖骨下動脈）。' },
        { id: 'q_subocc', label: '枕下緊、壓痛', lm: 'occ', how: '指腹勾住枕骨下緣慢慢上托，比較兩側硬度。' },
        { id: 'q_jaw_dev', label: '張口時下頜偏向一側', side: true, sideLabel: '偏向', lm: 'jaw', how: '面對客人，看張口過程中下巴中線往哪一側偏。' },
      ] },
      { name: '仰臥測試', items: [
        { id: 't_thomas', label: 'Thomas 測試：大腿離床', side: true, lm: 'groin', how: '客人坐床尾躺下、抱對側膝到胸：測試側大腿離床 → 髂腰肌緊；小腿被帶直 → 股直肌緊。' },
        { id: 't_slr_mid', label: '直腿抬高 45–70° 痛，>70° 反而不痛', side: true, lm: 'ham', how: '課堂：這樣的角度 → 梨狀肌（假性坐骨神經痛）。' },
        { id: 't_slr_low', label: '直腿抬高 <45° 就放射到小腿、腳', side: true, lm: 'ham', how: '→ 神經根問題，先轉介。' },
        { id: 'q_faber_groin', label: '4 字測試：鼠蹊痛', side: true, lm: 'groin', how: '患側腳踝放對側膝上、膝往下放：鼠蹊前方痛 → 髖關節。' },
        { id: 'q_faber_si', label: '4 字測試：薦髂後側痛', side: true, how: '同上，痛在後側薦髂 → 薦髂關節。' },
        { id: 'q_hip_ir', label: '屈髖 90°：髖內轉較少', side: true, lm: 'groin', how: '屈髖屈膝 90°（或坐床緣），小腿往外擺＝髖內轉，比兩側角度；內轉少且鼠蹊深處痛 → 髖關節；不痛只覺臀深處緊 → 臀後六肌緊。' },
      ] },
    ] },
  { id: 'move', name: '動作測試', sub: '主被動、特殊測試', pose: null, intro: '三分法：先請客人自己做（主動），再由你幫他做（被動）。主動痛、被動不痛 → 肌肉；主被動都不足且痛 → 骨／關節，或慢性發炎沾黏；主動做不到但不痛、被動可 → 神經（轉介）。',
    groups: [
      { name: '三分法', items: [
        { id: 't_muscle', label: '主動痛、被動不痛（→ 肌肉）', how: '收縮才痛：拉傷、勞損、肌腱小撕裂。' },
        { id: 't_joint', label: '主動、被動都不足且痛（→ 骨／關節、沾黏）', how: '關節卡住，或五十肩、肌腱炎這類發炎沾黏；外傷後先排除骨折。' },
        { id: 't_nerve', label: '主動做不到但不痛、被動可動（→ 神經）', how: '神經問題，不屬推拿處理範圍，請轉介。' },
      ] },
      { name: '脊椎', items: [
        { id: 'a_flex_pain', label: '前彎時痛', how: '前彎、坐久痛 → 偏椎間盤，或後側肌肉被拉長。' },
        { id: 'a_ext_pain', label: '後仰時痛', how: '後仰、久站痛 → 偏小面關節（關節突關節）受壓。' },
        { id: 'a_sidebend', label: '側彎受限', side: true, sideLabel: '彎向', how: '雙手沿大腿外側往下滑，比較兩側能到的位置；記受限的方向。' },
        { id: 't_neck_rot', label: '轉頭到對側受限、肩胛上角壓痛', side: true, sideLabel: '痛側', lm: 'scap_sup', how: '坐姿慢慢轉頭比較兩側角度，再按肩胛上角（提肩胛肌止點）；記壓痛那一側。' },
        { id: 'a_neck_ext', label: '頸後仰轉向一側時手麻加重', side: true, how: '椎間孔擠壓 → 頸神經根，先轉介；只輕做一次，不做頸部扳動。' },
      ] },
      { name: '上肢', items: [
        { id: 'a_sh_arc', label: '肩外展 60–120° 疼痛弧', side: true, how: '慢慢側舉：中段痛、過了反而不痛 → 肩峰下夾擠。' },
        { id: 'a_sh_resist', label: '肩抗阻時痛、被動角度正常', side: true, how: '手臂放在痛的角度請客人頂住你的手（外轉、外展、內轉各試）：抗阻痛而被動可到頂 → 旋轉肌袖肌腱。' },
        { id: 'a_sh_er', label: '肩外轉受限（被動也受限）', side: true, how: '肘貼身屈 90° 往外轉；主被動都受限 → 五十肩（關節囊）傾向。' },
        { id: 'a_sh_ir', label: '手背摸背受限（內轉）', side: true, how: '手背沿背後往上摸，比較拇指能到的脊椎節段。' },
      ] },
      { name: '下肢', items: [
        { id: 't_trend', label: '單腳站時對側骨盆下掉', side: true, sideLabel: '站立腳', how: 'Trendelenburg：站立腳的臀中肌無力。' },
        { id: 'a_squat', label: '深蹲時膝往內夾', side: true, how: '雙腳與肩同寬慢慢蹲，從正面看膝是否往內偏過大拇趾。' },
        { id: 't_df_limited', label: '踝背屈受限', side: true, how: '弓箭步膝碰牆：腳尖離牆的距離比對側短，或蹲下時足跟先離地。' },
        { id: 't_knee_flex', label: '膝越彎越痛、會卡住', side: true, how: '被動屈膝到底比較兩側，問痛點在關節線上還是周圍。' },
        { id: 'a_ankle_inv', label: '踝內翻時外踝前下方痛', side: true, how: '舊扭傷的前距腓韌帶區。' },
        { id: 't_bone_tender', label: '骨頭局部壓痛、輕敲鑽痛', how: '外傷後骨頭點狀壓痛、輕敲遠端會痛到該點 → 先排除骨折。' },
      ] },
    ] },
];

// 由分站重建 FINDINGS（data_rules.js 只放模式；觀察項目都在這裡）
window.FINDINGS = [];
window.STATIONS.forEach((st) => st.groups.forEach((g) => window.FINDINGS.push({ group: st.name + '・' + g.name, station: st.id, red: !!g.red, items: g.items })));

/* 舊 id → 新 id（2026-10 評估優化時合併的重複項目）。存過的評估、個案紀錄可能還用舊 id，
   讀取時用 window.migrateFindings(sel) 換成新 id；左右不同時合併成雙側。 */
window.FINDING_ALIASES = {
  o_asis_high: 'o_crest_high', // 站姿髂前上棘高低 → 併入「髂嵴一側較高」（同一個骨盆側傾觀察）
  s_head_tilt: 'o_head_tilt', // 坐姿頭側傾 → 併入頭側傾（說明裡要求站、坐都看）
  s_hip_rot: 'q_hip_ir', // 坐姿髖內外轉範圍 → 與仰臥屈髖 90° 髖內轉是同一個量法
  q_leg_long: 't_heel_long', // 仰臥內踝較長 → 長腳側（俯臥足跟／仰臥內踝擇一量）
  q_leg_short: 't_heel_short',
  o_clav_high: 'q_sc_prom', // 站姿鎖骨、胸鎖關節突出 → 胸鎖關節前突（站看、躺摸）
  a_rot_pain: 's_rot_lim', // 轉身時痛 → 坐姿轉身受限或痛（固定骨盆做）
};
window.migrateFindings = function (sel) {
  const A = window.FINDING_ALIASES || {}; const out = {};
  Object.keys(sel || {}).forEach((k) => {
    const nk = A[k] || k; const v = sel[k]; if (!v) return;
    out[nk] = out[nk] && out[nk] !== v ? 'B' : v;
  });
  return out;
};

/* 處理原則（依主訴性質） */
window.CARE_RULES = [
  { when: ['c_onset_acute', 'c_lbp_acute'], title: '急性期：先舒緩、不矯正', text: '遠端取穴（委中、後溪、水溝、對側或上下游）配合客人慢慢活動；局部只輕柔放鬆，不重壓、不扳動。72 小時內腫熱可冰敷。緩解後再重新量骨盆三個角度。', kb: ['u-acute-lbp'] },
  { when: ['c_pain_swell'], title: '有紅腫熱：發炎期', text: '不熱敷、不在發炎處深壓或刮；處理上下游關節與周邊肌肉，抬高休息。持續腫脹或發燒請就醫。' },
  { when: ['c_onset_chronic', 'c_mech_overuse'], title: '慢性／姿勢型：找源頭', text: '痛的地方常是受害者。依課堂順序由下往上找「差最多、最上游」的變因點：足 → 踝、距骨 → 膝 → 骨盆（三個角度差最多的先）→ 薦椎 → 脊椎 → 局部。', kb: ['u-treatment-order'] },
  { when: ['c_pain_dull'], title: '痠脹悶痛：多為被拉長', text: '先放鬆對側或拮抗側縮短的肌肉；被拉長的一側不要再拉、不反覆重壓，之後再強化。', kb: ['u-limited-side'] },
  { when: ['c_pain_sharp'], title: '特定角度刺痛', text: '找出痛的角度與方向，處理時避開它；先放鬆周邊，再在無痛角度內小範圍活動。' },
  { when: ['c_pain_numb', 'c_arm_numb', 'c_sciatic'], title: '麻、放射：沿神經路徑查', text: '對照皮節推估節段（知識庫「頸、胸、腰薦神經」），做直腿抬高或頸椎測試；兩側症狀、無力加重、大小便異常 → 先轉介。推拿只沿路放鬆可能卡壓的肌肉（斜角肌、胸小肌、梨狀肌）。' },
  { when: ['c_worse_cough'], title: '腹壓上升時痛', text: '偏椎間盤：不做扭轉、後仰頂腰與衝擊；周邊放鬆與溫和牽引為主，建議就醫確認。', kb: ['u-safety-spine-thrust'] },
  { when: ['c_worse_morning'], title: '晨僵', text: '晨僵超過 1 小時、活動後才改善，尤其年輕人的下背與臀痛，建議先就醫排除發炎性關節炎。' },
  { when: ['c_rest_pain'], title: '休息、夜間也痛', text: '偏慢性發炎沾黏（五十肩、肌腱炎）：無痛範圍內活動，不硬扳、不在發炎處深壓。合併發燒、體重減輕或越來越痛時先就醫。', kb: ['u-three-adhesion'] },
  { when: ['o_pregnant'], title: '孕期／產後', text: '不做矯正與衝擊，側臥為主；避開合谷、三陰交、肩井、崑崙、至陰與腹部、腰薦重壓。產後鬆弛素仍有影響，骨盆評估要輕。', kb: ['u-safety-pregnancy'] },
  { when: ['r_osteo', 'r_anticoag', 'c_surgery'], title: '力道與禁忌', text: '骨質疏鬆、類固醇、抗凝血、術後或人工關節：減輕力道、不扳動，依醫囑的活動角度。' },
  { when: ['t_joint'], title: '主被動都受限且痛', text: '可能是骨／關節卡住，也可能是慢性發炎沾黏（五十肩、肌腱炎）——後者不要誤當成錯位硬扳。外傷後先排除骨折。', kb: ['u-three-adhesion'] },
  { when: ['t_bone_tender', 'r_trauma'], title: '先排除骨折', text: '外傷後骨頭點狀壓痛、輕敲遠端會痛到同一點、不能承重 → 先照 X 光；確認前只做遠端與周邊的輕柔處理。' },
  { when: ['c_onset_sub'], title: '亞急性：組織修復期', text: '腫痛已退但還沒恢復：逐步增加無痛範圍的活動，局部手法由輕到中，配合上下游關節與肌肉。' },
  { when: ['t_nerve'], title: '神經型', text: '主動做不到但不痛、被動可動 → 神經問題，不屬推拿處理範圍，請轉介。' },
];

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
