# 推拿整復手札

推拿整復課程的學習與臨床輔助工具：客人評估、部位連帶影響、症狀模擬、3D 人體圖譜（骨骼、肌肉、經絡、穴位、經筋與動作示範）、知識庫（含 12 段課堂逐字稿）、個案紀錄與會員後台。

**網站：** https://midssinglin.github.io/tuina-notes/

## 功能

| 分頁 | 內容 |
|---|---|
| 評估 | 依課堂流程分六站：主訴（傷科問診、警訊、病程、疼痛性質）→ 站姿（正、側、背面）→ 坐姿背面 → 俯臥 → 仰臥 → 動作測試；人形圖上的骨性標誌可直接點選。即時列出可能模式、處理原則，以及建議處理的肌肉、經筋、穴位、骨頭／關節與手法和處理順序；可一鍵存到個案 |
| 連鎖 | 身體部位之間的連帶影響圖 |
| 模擬 | 骨盆三個角度、薦椎、膝踝等狀態的症狀模擬 |
| 3D 圖譜 | BodyParts3D 真實骨骼與肌肉、經絡穴位經筋、38 個關節動作示範 |
| 知識庫 | 課堂筆記整理的條目、統一說法（整合說明）、穴位／肌肉／骨骼／經筋詳解、手法目錄（58 種）、12 段逐字稿（依堂次／部位／知識點分類）；會員投稿、管理員審核；照片、錄音檔、語音與文字輸入 |
| 個案 | 客人姓名、手機、約診時間、上次病理、處理進度、就診紀錄 |
| 後台 | （管理員）會員基本資料、註冊與登入時間、權限調整、查看所有個案與投稿 |

## 帳號與權限

用 Google 帳號登入，第一次登入即完成註冊。

| 角色 | 可以做的事 |
|---|---|
| 未登入 | 評估、連鎖、模擬、3D、瀏覽知識庫 |
| 會員 | ＋ 投稿知識條目（文字／語音輸入，需審核）、自己的個案紀錄 |
| 管理員 | ＋ 直接發佈／修改條目、審核投稿、AI 照片／錄音辨識與整理、會員後台、查看所有會員的個案 |
| 擁有者 | 同管理員，固定為網站建立者 |
| 已停用 | 只能瀏覽 |

權限由 [`firestore.rules`](firestore.rules) 在伺服器端強制執行，網頁上的按鈕只是介面。

## 架構

- 純靜態網頁（`docs/`），由 GitHub Pages 提供。
- 後端：Firebase Authentication（Google 登入）、Cloud Firestore（條目、投稿、個案、會員資料）、Firebase AI Logic（Gemini，照片／錄音辨識與文字整理）。
- `src/fb_shim.js` 把 Firebase 包成與 claude.ai Artifact 執行環境相同的介面，所以同一份 `src/app.js` 也能發佈在 claude.ai。

### 資料結構（Firestore）

```
notes/{id}                 已發佈的知識條目
kbsub/{uid}                會員投稿（items 內含每則投稿與審核狀態）
data/users/{uid}/{caseId}  個案紀錄
profiles/{uid}             會員資料：姓名、Email、頭像、註冊與最後登入時間、登入次數
config/roles               { admins: [uid], blocked: [uid] }
```

## 自行部署

1. 建立 Firebase 專案 → Authentication 開啟 Google 登入 → 授權網域加入 `你的帳號.github.io`。
2. 建立 Cloud Firestore（正式版模式）。
3. 註冊網頁應用程式，把設定填進 `docs/config.js`。
4. 第一次用自己的 Google 帳號登入網站後，到 Authentication → 使用者 複製 UID，填入 `docs/config.js` 的 `ownerUid` 與 `firestore.rules` 的 `OWNER_UID`，再把規則貼到 Firestore → 規則 → 發佈。
5. （選用）AI Logic → 開始使用 → Gemini Developer API，開啟照片／錄音辨識；AI Logic 設定裡開啟「僅限通過驗證的使用者」。
   2026-11-02 起 Firebase 要求 AI Logic 強制使用 App Check：到 reCAPTCHA 建立 v3 金鑰（網域填 `你的帳號.github.io`），在 App Check 註冊網頁應用程式並貼上密鑰，再把網站金鑰填進 `docs/config.js` 的 `recaptchaKey`。
6. GitHub repo → Settings → Pages → Branch `main`、資料夾 `/docs`。

### 從原始碼建置

```
python3 build.py [--claude]   # 產生 docs/index.html（GitHub Pages 版）；--claude 另產生 dist/（claude.ai 版）
```

3D 模型處理（`tools/anat/`）與逐字稿處理（`tools/tx/`）的腳本一併附上，需要原始資料才能重跑。

## 參考書補充

知識庫「參考書」來源收錄老師推薦書籍的重點整理，以及與課堂理論的逐項比對（衝突／程度差異／用詞不同／補充，標嚴重度與頁碼）：

- 黃國松《經筋手療法圖解》（人民衛生出版社，2007）
- 黃國松《四肢手療法（圖解）》（人民衛生出版社，2009）
- 坂元大海、原島廣至《經穴大全》（WHO／WPRO 標準定位）
- 苟亞博、黃國松《脊椎手療法圖解》（人民衛生出版社，2009）
- 苟亞博《整脊醫學》
- 苟亞博《整復醫學》（大方廣，1998）
- Mansfield、Neumann《基礎肌動學》第三版（繁中譯本）：用來校對本站肌肉資料與課程的力學說法

另收錄 1012 課堂錄音的整理與比對（「課堂 1012 重點與比對」）。

### 整合說明與詳解

- **整合說明**：把課堂、筆記與各書互相矛盾的地方逐項比對，定出 47 項統一說法與名詞統一表（標「待確認」的請老師確認），並在原條目加上「整合說明」。
- **詳解**：208 個穴位、58 條肌肉、42 塊（組）骨骼、12 經筋，各自依參考書整理定位／解剖／檢查／處理步驟等，並在 3D 圖譜資訊欄可展開。
- **手法目錄**：基本手法、軟組織與經筋、骨盆三角度、脊椎、四肢與通則共 58 種，含步驟、適用、禁忌與風險分級；衝擊式手法只說明目的與風險，提供安全替代做法。
- 資料與產生腳本在 `tools/details/`（`node tools/details/gen_details.js` → `src/data_detail.js`）；評估的分站、骨性標誌與規則在 `src/data_assess.js`。

條目都是**用自己的話整理並標註頁碼**，示意圖為依書中內容**重新繪製**（`src/data_figs*.js`），不含原書文字或掃描圖。整理流程與中間資料在 `tools/books/`（掃描書 OCR → 逐本整理 → `gen_books.js` 產生 `src/data_books.js`）。穴位資料已依《經穴大全》（WHO 標準）修正 15 個穴的定位描述。

## 內容與授權說明

- 3D 骨骼與肌肉模型：**BodyParts3D**，© The Database Center for Life Science，授權 [CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/)。本專案的簡化模型（`docs/anatomy.*`）依同一授權釋出。
- 3D 繪圖：[three.js](https://threejs.org/)（MIT）。
- 課堂筆記與逐字稿內容來自推拿整復課程，逐字稿為自動語音辨識，錯字很多，僅供學習參考。
- 本工具為學習輔助，不取代醫師診斷；評估結果僅供思考參考。
