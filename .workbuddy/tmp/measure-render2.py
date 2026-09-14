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
# 只取「列③」所在的第二行：CSS y > 520 → PNG y > 1040；整幅宽度扫描
Y0, Y1 = 1040, h
LINE = (0xcd, 0xd0, 0xd9)
def isline(c, tol=6):
    return all(abs(c[i]-LINE[i]) <= tol for i in range(3))

print('--- 横线（连续 ≥100px 的 #cdd0d9 行）及其起止 x ---')
y = Y0
while y < Y1:
    if isline(px(1000, y)):
        # 找这一行（可能连续多行）的最后一行
        y2 = y
        while y2 + 1 < Y1 and isline(px(1000, y2 + 1)):
            y2 += 1
        xs = [x for x in range(0, w) if isline(px(x, y))]
        if len(xs) > 200:
            print(f'  PNG y {y}-{y2}  (CSS y {y/2:.1f}-{y2/2:.1f}, 粗 {(y2-y+1)/2}px)  '
                  f'x {min(xs)}-{max(xs)} → CSS x {min(xs)/2:.1f}-{max(xs)/2:.1f} 长 {(max(xs)-min(xs)+1)/2:.1f}px')
        y = y2 + 1
    else:
        y += 1

# 列③ 侧栏外框（找最上面那条横线 = 侧栏 top border）
print()
print('--- 列③ 第一个色块包围盒（限 y 1120..1320）---')
pts = [(x, y) for y in range(1120, 1320) for x in range(40, 700) if px(x, y) == (255, 255, 255)]
if pts:
    x0 = min(p[0] for p in pts); x1 = max(p[0] for p in pts)
    y0 = min(p[1] for p in pts); y1 = max(p[1] for p in pts)
    print(f'  内芯 CSS {(x1-x0+1)/2:.1f} x {(y1-y0+1)/2:.1f}  比值 {(x1-x0+1)/(y1-y0+1):.3f}')
    print(f'  含 1px 描边 CSS {(x1-x0+3)/2:.1f} x {(y1-y0+3)/2:.1f}  比值 {(x1-x0+3)/(y1-y0+3):.3f}  （期望 1.500）')
    print(f'  色块 top/bottom CSS {y0/2:.1f} / {(y1+1)/2:.1f}，left/right CSS {x0/2:.1f} / {(x1+1)/2:.1f}')

print()
print('--- 列③ 活动圆点（强调色）---')
acc = [(x, y) for y in range(1300, 1360) for x in range(40, 700)
       if abs(px(x, y)[0]-22) < 30 and abs(px(x, y)[1]-125) < 30 and abs(px(x, y)[2]-255) < 30]
if acc:
    x0 = min(p[0] for p in acc); x1 = max(p[0] for p in acc)
    y0 = min(p[1] for p in acc); y1 = max(p[1] for p in acc)
    print(f'  bbox CSS x {x0/2:.1f}-{(x1+1)/2:.1f}  y {y0/2:.1f}-{(y1+1)/2:.1f}'
          f'  → {(x1-x0+1)/2:.1f} x {(y1-y0+1)/2:.1f}')
