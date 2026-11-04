import re
import io

h = io.open('shots/dom.html', encoding='utf-8', errors='replace').read()
m = re.search(r'<pre id="diag"[^>]*>(.*?)</pre>', h, re.S)
if not m:
    print('NO DIAG')
else:
    t = m.group(1)
    t = t.replace('&gt;', '>').replace('&lt;', '<').replace('&amp;', '&')
    print(t)
