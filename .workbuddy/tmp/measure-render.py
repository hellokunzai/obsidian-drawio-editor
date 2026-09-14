import zlib, struct, sys

def load(path):
    d = open(path, 'rb').read()
    i, w, h, bd, ct, idat = 8, 0, 0, 8, 6, b''
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]
        typ = d[i+4:i+8]; body = d[i+8:i+8+ln]
        if typ == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', body[:10])
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
        i += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1, 2:3, 4:2, 6:4}[ct]; stride = w * ch
    out, prev, pos = [], bytearray(stride), 0
    for y in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos+stride]); pos += stride
        if f == 1:
            for x in range(ch, stride): line[x] = (line[x] + line[x-ch]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                b = prev[x]; c = prev[x-ch] if x >= ch else 0
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out.append(bytes(line)); prev = line
    def px(x, y):
        o = x * ch
        return (out[y][o], out[y][o+1], out[y][o+2])
    return w, h, px

w, h, px = load('.workbuddy/tmp/proto-shot.png')
print(f'截图 {w}x{h}  (2x DPR → CSS {w//2}x{h//2})')

# 列③ 的侧栏：CSS x≈28..306 → PNG 56..612；下半页（PNG y>1000）
X0, X1 = 56, 612
Y0 = 1000

def like(c, t, tol=6):
    return all(abs(c[i]-t[i]) <= tol for i in range(3))

# 侧栏底色 & 分割线预期色（rgba(76,79,105,.16) 叠在 #e6e9ef 上）
SIDE = px(X0+10, Y0+4)
print('侧栏底色 =', '#%02x%02x%02x' % SIDE)
blend = tuple(round(SIDE[i]*(1-0.16) + (76,79,105)[i]*0.16) for i in range(3))
print('分割线预期 =', '#%02x%02x%02x' % blend, '（--obs-border 叠底色）')

print()
print('--- 横贯整列的单行（同一行内 ≥95% 像素同色）---')
for y in range(Y0, h):
    row = [px(x, y) for x in range(X0, X1)]
    # 取众数
    best, cnt = None, 0
    counts = {}
    for c in row:
        k = c
        counts[k] = counts.get(k, 0) + 1
    for k, v in counts.items():
        if v > cnt: best, cnt = k, v
    if cnt >= len(row) * 0.95 and not like(best, SIDE, 3):
        print(f'  y={y:>4} (CSS {y/2:>6.1f})  宽 {cnt}/{len(row)}  #{best[0]:02x}{best[1]:02x}{best[2]:02x}'
              + ('   <== 分割线' if like(best, blend, 8) else ''))

# 第一个色块（纯白 #ffffff）的包围盒 → 实测宽高比
print()
print('--- 列③ 第一个色块（#ffffff）包围盒 ---')
ys = range(Y0, h); xs = range(X0, X1)
pts = [(x, y) for y in ys for x in xs if px(x, y) == (255, 255, 255)]
if pts:
    x0 = min(p[0] for p in pts); x1 = max(p[0] for p in pts)
    y0 = min(p[1] for p in pts); y1 = max(p[1] for p in pts)
    bw, bh = x1-x0+1, y1-y0+1
    print(f'  内芯 {bw}x{bh} px(2x) → CSS {bw/2}x{bh/2}，宽高比 {bw/bh:.3f}（期望 1.5，含 1px 描边后略小）')
    print(f'  含描边约 {bw/2+2}x{bh/2+2} CSS → 比值 {(bw+2)/(bh+2):.3f}')
else:
    print('  未找到纯白块')

# 活动圆点（强调色 #167dff 的实心点）
print()
print('--- 列③ 活动圆点（#167dff）---')
acc = [(x, y) for y in range(Y0, h) for x in range(X0, X1) if like(px(x, y), (22,125,255), 26)]
if acc:
    x0 = min(p[0] for p in acc); x1 = max(p[0] for p in acc)
    y0 = min(p[1] for p in acc); y1 = max(p[1] for p in acc)
    print(f'  圆点 bbox x {x0}-{x1}  y {y0}-{y1}  → 直径 {(x1-x0+1)/2:.1f}x{(y1-y0+1)/2:.1f} CSS')
else:
    print('  未找到')
