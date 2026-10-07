"""建置 docs/index.html（GitHub Pages 版）。用法：python3 build.py [--claude]
--claude 另外輸出 dist/index.html（claude.ai Artifact 版，不含 Firebase）。
3D 模型（docs/anatomy.*、geo.json）與逐字稿（docs/transcripts.json）由 tools/ 產生，已放在 docs/。"""
import os, sys
d = os.path.dirname(os.path.abspath(__file__))
src = lambda f: open(os.path.join(d, 'src', f), encoding='utf-8').read()
html = src('index.html'); css = src('app.css')
js = '\n;\n'.join(src(f) for f in ['data_motions.js', 'body3d.js', 'data_muscles.js', 'data_meridians.js', 'data_rules.js', 'data_kb.js', 'app.js']).replace('</script', '<\\/script')
html = html.replace('/*CSS*/', css).replace('/*JS*/', js)
if '--claude' in sys.argv:
    os.makedirs(os.path.join(d, 'dist'), exist_ok=True)
    open(os.path.join(d, 'dist', 'index.html'), 'w', encoding='utf-8').write(html)
head = ('<!doctype html>\n<html lang="zh-Hant-TW">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect x=%222%22 y=%222%22 width=%2228%22 height=%2228%22 rx=%225%22 fill=%22none%22 stroke=%22%23bd3d28%22 stroke-width=%223%22/%3E%3Ctext x=%2216%22 y=%2222%22 font-size=%2216%22 text-anchor=%22middle%22 fill=%22%23bd3d28%22%3E%E6%95%B4%3C/text%3E%3C/svg%3E">\n')
body = html.replace('<script>' + js + '</script>', '<script src="config.js"></script>\n<script>' + src('fb_shim.js').replace('</script', '<\\/script') + '</script>\n<script>' + js + '</script>')
cut = body.index('<header')
page = head + body[:cut] + '</head>\n<body>\n' + body[cut:] + '\n</body>\n</html>\n'
open(os.path.join(d, 'docs', 'index.html'), 'w', encoding='utf-8').write(page)
print('docs/index.html', len(page) // 1024, 'KB')
