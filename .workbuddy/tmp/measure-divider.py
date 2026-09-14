import zlib, struct, sys

def load(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    i, w, h, bd, ct, idat = 8, 0, 0, 8, 6, b''
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]
        typ = d[i+4:i+8]
        body = d[i+8:i+8+ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', body[:10])
        elif typ == b'IDAT':
            idat += body
        elif typ == b'IEND':
            break
        i += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1, 2:3, 4:2, 6:4}[ct]
    assert bd == 8, bd
    stride = w * ch
    out = []
    prev = bytearray(stride)
    pos = 0
    for y in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos+stride]); pos += stride
        if f == 1:
            for x in range(ch, stride):
                line[x] = (line[x] + line[x-ch]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                b = prev[x]
                c = prev[x-ch] if x >= ch else 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out.append(bytes(line))
        prev = line
    def px(x, y):
        o = x * ch
        r, g, b = out[y][o], out[y][o+1], out[y][o+2]
        a = out[y][o+3] if ch == 4 else 255
        return (r, g, b, a)
    return w, h, ch, px

for path, tag in [(sys.argv[1], 'CURRENT(plugin)'), (sys.argv[2], 'REF(drawio)')]:
    w, h, ch, px = load(path)
    print('=' * 70)
    print(tag, w, 'x', h, 'ch=', ch)
    # 背景色采样（左上角内侧）
    print('bg 左上 =', px(6, 6))
    # 打印左边缘 x=4 那一列的纵向色带（用于定位分割线/表头行的 y）
    print('--- x=6 纵向扫描（每行报一次色，连续相同合并）---')
    prev = None
    start = 0
    runs = []
    for y in range(h):
        c = px(6, y)
        if c != prev:
            if prev is not None:
                runs.append((start, y-1, prev))
            prev, start = c, y
    runs.append((start, h-1, prev))
    for a, b, c in runs:
        print(f'  y {a:>4}-{b:<4} ({b-a+1:>3}px)  #{c[0]:02x}{c[1]:02x}{c[2]:02x} a={c[3]}')
