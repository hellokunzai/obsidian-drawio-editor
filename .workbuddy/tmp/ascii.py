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

path, y0, y1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
w, h, px = load(path)
bg = px(3, 5)
print(f'{path.split("/")[-1]}  {w}x{h}  bg=#{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}')
print('   ' + ''.join(str((x // 10) % 10) for x in range(0, w, 2)))
print('   ' + ''.join(str(x % 10) for x in range(0, w, 2)))
for y in range(y0, min(y1, h)):
    row = ''
    for x in range(0, w, 2):
        c = px(x, y)
        r, g, b = c
        if r - g > 30 and r - b > 30:
            row += 'R'          # 标注红
        elif abs(r-bg[0]) <= 4 and abs(g-bg[1]) <= 4 and abs(b-bg[2]) <= 4:
            row += '.'          # 背景
        else:
            lum = (r*299 + g*587 + b*114) // 1000
            blum = (bg[0]*299 + bg[1]*587 + bg[2]*114) // 1000
            d = blum - lum
            if d <= 4: row += '-'
            elif d <= 24: row += '+'
            elif d <= 60: row += '*'
            else: row += '#'
    print(f'{y:>3} {row}')
