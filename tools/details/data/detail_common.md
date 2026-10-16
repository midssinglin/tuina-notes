# Shared instructions for detail-entry agents (推拿整復手札)

Site: a Traditional Chinese (Taiwan) tuina / manual-therapy study web app. Repo: /home/claude/tuina-notes (DO NOT edit anything there; only write your output file under /home/claude/work/).
Data you can load with node (load in this order; `global.window={}` first):
  src/data_muscles.js (window.MUSCLES: id,name,origin,insertion,action,palpation,release,referral,points,sinew…)
  src/data_meridians.js (window.MERIDIANS, window.POINTS {id,name,mer,loc,ind,tn}, window.SINEWS {id,name,note,sick,knots}, window.MER_NOTES)
  src/data_kb.js (window.KB_ITEMS — course notes; course = primary authority for the course's own concepts)
Book summaries already made: tools/books/out/<slug>.json (jingjin 經筋手療法圖解, sizhi 四肢手療法, jingxue 經穴大全, jizhui 脊椎手療法圖解, zhengji 整脊醫學, zhengfu 整復醫學, kines 基礎肌動學) — each has entries/outline/conflicts with page numbers.
Raw OCR text (noisy tesseract, Traditional Chinese, one file per PDF page): /home/claude/ocr/txt/<書名>/p0001.txt … Book names: 經筋手療法, 經穴大全, 四肢手療法, 基礎肌動學, 脊椎手療法, 整脊醫學, 整復醫學 (the last three may still be in progress — check which pages exist; PDF page number ≠ printed page number, cite the PDF page as 「p.N」 unless you can read the printed number). Use `grep -l` / `rg` to find relevant pages, then read them.

## Rules
- COPYRIGHT: never copy sentences from the books. Write every field in your own words (facts, numbers and standard terms are fine). Cite pages.
- Language: Traditional Chinese, Taiwan usage (e.g. 公分, 觸診, 肌肉名稱依網站既有名稱). Concise, practical, written for a tuina student who works on clients.
- Safety: never recommend high-velocity thrusts on the neck, deep pressure on arteries/nerves, invasive methods (needling, bloodletting, injections) — if a book mentions them, say 「書中另有針刺/放血等方法，本站不操作」. Mention pregnancy cautions where standard (e.g. LI4, SP6, BL60, BL67, GB21).
- If the book disagrees with the site's current data or the course, keep the site's value, and put the difference in a `diff` field (short). If OCR is unreadable for an item, write from standard references (WHO standard acupuncture point locations, mainstream kinesiology) and set pages to 「標準參考」.
- Use site ids for cross-references: muscles = MUSCLES ids (e.g. glute_med), points = POINTS ids (e.g. GB30), sinews = SINEWS ids (e.g. GB).
- Validate your JSON with node/python before finishing. Keep CPU use light (OCR is running in the background) — no heavy parallel jobs.
- When done, reply with a 5-line summary (counts, notable diffs, gaps).
