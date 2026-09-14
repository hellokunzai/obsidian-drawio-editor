"""从原型渲染图里量出 ②③ 两列的分割线位置与上下间距（DPR=2 → CSS = px/2）。"""
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

w, h, ch, buf = load_png(sys.argv[1])
def px(x, y):
    o = y*w*ch + x*ch
    return (buf[o], buf[o+1], buf[o+2])

def analyse(name, X0, X1):
    print(f'\n================ {name}  (x {X0}..{X1}) ================')
    c = Counter(px(x, y) for y in range(0, h, 2) for x in range(X0, X1, 2))
    bg = c.most_common(1)[0][0]
    print('底色 #%02x%02x%02x' % bg)

    def isline(x, y):
        r, g, b = px(x, y)
        dr, dg, db = bg[0]-r, bg[1]-g, bg[2]-b
        return 8 <= dr <= 95 and max(dr, dg, db) - min(dr, dg, db) <= 20

    W = X1 - X0
    lines = []
    for y in range(h):
        xs = [x for x in range(X0, X1) if isline(x, y)]
        if len(xs) > 0.7 * W:
            if lines and y - lines[-1] <= 2: continue
            lines.append(y)
    # 内容带
    bands = []
    for y in range(h):
        cnt = sum(1 for x in range(X0, X1)
                  if max(abs(px(x, y)[i]-bg[i]) for i in range(3)) > 10)
        if cnt >= 4:
            if bands and y - bands[-1][1] <= 2: bands[-1][1] = y
            else: bands.append([y, y])

    def css(v): return round(v / 2.0, 1)

    print('检测到的横线（DPR2 设备行 / CSS y）：')
    for y in lines:
        print(f'   y={y:4d}  CSS {css(y):7.1f}')
    print()
    print('每条线到「上一条线」之间的内容带（看上下间距是否对称）：')
    prev = None
    for y in lines:
        above = [b for b in bands if b[1] < y - 1]
        below = [b for b in bands if b[0] > y + 1]
        a = above[-1] if above else None
        b = below[0] if below else None
        gap_a = css(y - a[1] - 1) if a else None
        gap_b = css(b[0] - y - 1) if b else None
        print(f'   CSS y={css(y):7.1f}   上距 {gap_a}   下距 {gap_b}')
    print()
    print('全部内容带（CSS y）：')
    for a, b in bands:
        print(f'   {css(a):7.1f} .. {css(b):7.1f}   高 {css(b-a+1):6.1f}')

analyse('② v0.17.1 现状', 64, 668)
analyse('③ v0.17.2 本次', 720, 1324)
