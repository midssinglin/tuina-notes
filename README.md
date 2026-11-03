# 推拿整復手札（網站）

推拿整復課程的評估、3D 人體圖譜、知識庫、練習與個案紀錄工具：**https://midssinglin.github.io/tuina-notes/**

- 這個 repo 只放建置好的網站（`docs/`，GitHub Pages）。原始碼與課程內容在私人 repo。
- 3D 圖譜開放給所有人；其他功能需用 Google 帳號登入註冊，並經管理員批准。
- 課程內容以 AES-GCM 加密（`content.bin`、`tx.bin`），解密金鑰只提供給已批准的會員（由 Firestore 安全性規則把關）。
- 可安裝成 App（PWA），下載過的內容可離線使用。

3D 模型：BodyParts3D（© DBCLS, CC BY-SA 2.1 JP）。
