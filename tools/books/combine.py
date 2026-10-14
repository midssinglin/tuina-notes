import sys, os, re, glob
name = sys.argv[1]; d = f'/home/claude/ocr/txt/{name}'
out = []
for f in sorted(glob.glob(d + '/p*.txt')):
    p = int(os.path.basename(f)[1:5]); t = open(f, encoding='utf-8', errors='ignore').read()
    t = re.sub(r'(?<=[　-鿿＀-￯])[ \t]+(?=[　-鿿＀-￯])', '', t)
    t = re.sub(r'\n{3,}', '\n\n', t).strip()
    out.append(f'\n\n=== [PDF 第 {p} 頁] ===\n' + t)
s = ''.join(out); open(f'/home/claude/ocr/{name}.txt', 'w', encoding='utf-8').write(s); print(name, len(s))
