"""扫描用户截图里的横向分隔线 + 各控件行的 y 位置（逐像素，无 PIL）。"""
import zlib, struct, sys

def load_png(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8
    idat = b''
    w = h = bd = ct = None
    plte = None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]
        typ = d[pos+4:pos+8]
        data = d[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', data[:10])
        elif typ == b'IDAT':
            idat += data
        elif typ == b'PLTE':
            plte = data
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i-ch]) & 0xff
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xff
        elif f == 3:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xff
        elif f == 4:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                b = prev[i]
                c = prev[i-ch] if i >= ch else 0
                pp = a + b - c
                pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xff
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, ch, out, plte

path = sys.argv[1]
w, h, ch, buf, plte = load_png(path)
print(f'PNG {w}x{h} ch={ch}')

def px(x, y):
    o = y * w * ch + x * ch
    return (buf[o], buf[o+1], buf[o+2])

# 取「面板底色」= 最左侧区域中上半部出现最多的色
from collections import Counter
c = Counter()
for y in range(0, h, 3):
    for x in range(0, 8):
        c[px(x, y)] += 1
bg = c.most_common(1)[0][0]
print('面板底色', '#%02x%02x%02x' % bg)

def isline(x, y):
    """该像素是否像一条分割线：比底色明显深，且不是黑字/彩块"""
    r, g, b = px(x, y)
    dr = bg[0]-r; dg = bg[1]-g; db = bg[2]-b
    if dr < 10 or dr > 90:
        return False
    if max(dr, dg, db) - min(dr, dg, db) > 22:
        return False
    return True

# 找出「跨越面板大部分宽度都是线色」的行
print('\n=== 候选横线（该行线色像素占宽度比例 > 0.55）===')
bands = []
for y in range(h):
    cnt = sum(1 for x in range(0, w) if isline(x, y))
    if cnt > 0.55 * w:
        bands.append((y, cnt))
# 合并相邻行
merged = []
for y, cnt in bands:
    if merged and y - merged[-1][-1] <= 2:
        merged[-1].append(y)
    else:
        merged.append([y])
for grp in merged:
    y0 = grp[0]
    # 量这条线的水平起止
    row = [x for x in range(w) if isline(x, y0)]
    if row:
        print(f'  y={y0:4d}  高={len(grp)}px  x={row[0]}..{row[-1]}  色=#%02x%02x%02x' % px(row[len(row)//2], y0))

# 行的「内容」轮廓：找出有非底色内容的 y 区间
print('\n=== 内容行（非底色像素 > 6 个）===')
rows = []
for y in range(h):
    cnt = sum(1 for x in range(w) if px(x, y) != bg and max(abs(px(x,y)[i]-bg[i]) for i in range(3)) > 6)
    rows.append(cnt)
segs = []
for y, cnt in enumerate(rows):
    if cnt > 6:
        if segs and y - segs[-1][1] <= 1:
            segs[-1][1] = y
        else:
            segs.append([y, y])
for a, b in segs:
    print(f'  y {a:4d}..{b:4d}   高 {b-a+1:3d}px')
