# 推拿整復手札

推拿整復課程的學習與臨床輔助工具：客人評估、部位連帶影響、症狀模擬、3D 人體圖譜（骨骼、肌肉、經絡、穴位、經筋與動作示範）、知識庫（含 12 段課堂逐字稿）、個案紀錄與會員後台。

**網站：** https://midssinglin.github.io/tuina-notes/

## 功能

| 分頁 | 內容 |
|---|---|
| 評估 | 勾選主訴、觀察與測試結果，列出可能模式、偏緊／被拉長的肌肉、連帶部位與穴位；可一鍵存到個案 |
| 連鎖 | 身體部位之間的連帶影響圖 |
| 模擬 | 骨盆三個角度、薦椎、膝踝等狀態的症狀模擬 |
| 3D 圖譜 | BodyParts3D 真實骨骼與肌肉、經絡穴位經筋、38 個關節動作示範 |
| 知識庫 | 課堂筆記整理的條目、肌肉穴位資料、12 段逐字稿（依堂次／部位／知識點分類）；會員投稿、管理員審核；照片、錄音檔、語音與文字輸入 |
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
python3 build.py      # 產生 dist/（claude.ai 版）與 gh/docs/（GitHub Pages 版）
```

3D 模型處理（`tools/anat/`）與逐字稿處理（`tools/tx/`）的腳本一併附上，需要原始資料才能重跑。

## 內容與授權說明

- 3D 骨骼與肌肉模型：**BodyParts3D**，© The Database Center for Life Science，授權 [CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/)。本專案的簡化模型（`docs/anatomy.*`）依同一授權釋出。
- 3D 繪圖：[three.js](https://threejs.org/)（MIT）。
- 課堂筆記與逐字稿內容來自推拿整復課程，逐字稿為自動語音辨識，錯字很多，僅供學習參考。
- 本工具為學習輔助，不取代醫師診斷；評估結果僅供思考參考。
