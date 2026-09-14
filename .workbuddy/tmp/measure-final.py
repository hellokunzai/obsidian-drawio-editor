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
print(f'截图 {w}x{h} → CSS {w//2}x{h//2}')
# 第三列（③）的侧栏：CSS x 676..982 → PNG 1352..1964；只扫这一列
CX0, CX1 = 1352, 1964
SIDE = px(CX0 + 60, 700)
LINE = (0xcd, 0xd0, 0xd9)
ACC = (22, 125, 255)
print('侧栏底色 #%02x%02x%02x' % SIDE)

def isline(c, t=LINE, tol=7):
    return all(abs(c[i]-t[i]) <= tol for i in range(3))

def isacc(c, tol=40):
    return all(abs(c[i]-ACC[i]) <= tol for i in range(3))

print()
print('--- ③ 列横线（占该列 ≥90% 宽度）---')
lines = []
for y in range(0, h):
    n = sum(1 for x in range(CX0, CX1) if isline(px(x, y)))
    if n >= (CX1 - CX0) * 0.9:
        xs = [x for x in range(CX0, CX1) if isline(px(x, y))]
        lines.append((y, min(xs), max(xs)))
# 合并连续行
i = 0
while i < len(lines):
    j = i
    while j + 1 < len(lines) and lines[j+1][0] == lines[j][0] + 1:
        j += 1
    y0, y1 = lines[i][0], lines[j][0]
    print(f'  CSS y {y0/2:.1f}-{(y1+1)/2:.1f}（粗 {(y1-y0+1)/2}px）  '
          f'x CSS {min(l[1] for l in lines[i:j+1])/2:.1f}-{max(l[2] for l in lines[i:j+1])/2:.1f}')
    i = j + 1

print()
print('--- ③ 列强调色块（圆点 / 勾选框）纵向位置 ---')
blobs = []
cur = None
for y in range(0, h):
    hit = any(isacc(px(x, y)) for x in range(CX0, CX1))
    if hit and cur is None: cur = [y, y]
    elif hit: cur[1] = y
    elif cur is not None:
        blobs.append(tuple(cur)); cur = None
if cur: blobs.append(tuple(cur))
for a, b in blobs:
    print(f'  CSS y {a/2:.1f}-{(b+1)/2:.1f}  高 {(b-a+1)/2:.1f}px')
if len(blobs) >= 3:
    dots = blobs[0] if blobs[0][1] - blobs[0][0] < 30 else blobs[1]
    print()
    print('=== 量出来的间距 ===')
    # 圆点（第 1 个 accent blob 之后那个小方块）→ 分割线 → 勾选框
    ys = [b for b in blobs]
    print('  accent blob 纵坐标(CSS):', [f'{a/2:.1f}-{(b+1)/2:.1f}' for a, b in ys])
