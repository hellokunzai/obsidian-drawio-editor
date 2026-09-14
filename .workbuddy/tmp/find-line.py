import zlib, struct, sys

def load(path):
    d = open(path, 'rb').read()
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
    stride = w * ch
    out, prev, pos = [], bytearray(stride), 0
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
                b = prev[x]; c = prev[x-ch] if x >= ch else 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out.append(bytes(line)); prev = line
    def px(x, y):
        o = x * ch
        return (out[y][o], out[y][o+1], out[y][o+2], out[y][o+3] if ch == 4 else 255)
    return w, h, px

def is_red(c, tol=26):
    r, g, b, _ = c
    return r - g > tol and r - b > tol

def scan(path, tag, y0, y1):
    w, h, px = load(path)
    print('=' * 72)
    print(tag, w, 'x', h)
    print(' y | 最长「非红灰线」run | 起-止 x | 颜色 | 该行非红像素数')
    for y in range(y0, min(y1, h)):
        best = (0, 0, None)
        run, start, col = 0, 0, None
        nonred = 0
        for x in range(w):
            c = px(x, y)
            grey = (not is_red(c)) and (abs(c[0]-c[1]) < 12 and abs(c[1]-c[2]) < 12)
            if grey:
                nonred += 1
            if grey and run > 0 and c == col:
                run += 1
            elif grey:
                if run > best[0]:
                    best = (run, start, col)
                run, start, col = 1, x, c
            else:
                if run > best[0]:
                    best = (run, start, col)
                run, start, col = 0, 0, None
        if run > best[0]:
            best = (run, start, col)
        if best[0] >= 20:
            c = best[2]
            print(f'{y:>3} | {best[0]:>4}px | x {best[1]:>3}-{best[1]+best[0]-1:<3} | #{c[0]:02x}{c[1]:02x}{c[2]:02x} | {nonred}')

scan(sys.argv[1], 'CURRENT(plugin)', 26, 255)
