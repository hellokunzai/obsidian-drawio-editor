"""更细的探测：限定内容 x 区间，输出每条横线的连续段与各行内容带。"""
import zlib, struct, sys
from collections import Counter

def load_png(path):
    d = open(path, 'rb').read()
    pos = 8; idat = b''; w = h = ct = None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]
        typ = d[pos+4:pos+8]; data = d[pos+8:pos+8+ln]
        if typ == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', data[:10])
        elif typ == b'IDAT': idat += data
        pos += 12 + ln
    raw = zlib.decompress(idat); ch = {0:1,2:3,3:1,4:2,6:4}[ct]
    stride = w*ch; out = bytearray(h*stride); prev = bytearray(stride); p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(ch, stride): line[i] = (line[i]+line[i-ch]) & 0xff
        elif f == 2:
            for i in range(stride): line[i] = (line[i]+prev[i]) & 0xff
        elif f == 3:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                line[i] = (line[i] + ((a+prev[i])>>1)) & 0xff
        elif f == 4:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                b = prev[i]; c = prev[i-ch] if i >= ch else 0
                pp = a+b-c; pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i]+pr) & 0xff
        out[y*stride:(y+1)*stride] = line; prev = line
    return w, h, ch, out

path = sys.argv[1]
w, h, ch, buf = load_png(path)
def px(x, y):
    o = y*w*ch + x*ch
    return (buf[o], buf[o+1], buf[o+2])

X0, X1 = 10, 366
c = Counter(px(x, y) for y in range(0, h, 2) for x in range(X0, X1, 2))
bg = c.most_common(1)[0][0]
print(f'PNG {w}x{h}  底色 #%02x%02x%02x' % bg)

def isline(x, y):
    r, g, b = px(x, y)
    dr, dg, db = bg[0]-r, bg[1]-g, bg[2]-b
    if not (10 <= dr <= 95): return False
    if max(dr, dg, db) - min(dr, dg, db) > 20: return False
    return True

print('\n=== 横线（线色像素 > 60% 宽度），列出连续段 ===')
for y in range(h):
    xs = [x for x in range(X0, X1) if isline(x, y)]
    if len(xs) <= 0.6 * (X1 - X0): continue
    runs = []
    for x in xs:
        if runs and x - runs[-1][1] <= 2: runs[-1][1] = x
        else: runs.append([x, x])
    runs = [r for r in runs if r[1]-r[0] >= 20]
    if not runs: continue
    mid = xs[len(xs)//2]
    print(f'  y={y:4d}  段={[(a,b) for a,b in runs]}  色=#%02x%02x%02x' % px(mid, y))

print('\n=== 内容带（该行偏离底色的像素 >= 4）===')
segs = []
for y in range(h):
    cnt = sum(1 for x in range(X0, X1)
              if max(abs(px(x,y)[i]-bg[i]) for i in range(3)) > 8)
    if cnt >= 4:
        if segs and y - segs[-1][1] <= 2: segs[-1][1] = y
        else: segs.append([y, y])
for a, b in segs:
    print(f'  y {a:4d}..{b:4d}  高 {b-a+1:3d}')
