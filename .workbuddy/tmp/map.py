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
y0, y1 = int(sys.argv[1]), int(sys.argv[2])
x0, x1 = int(sys.argv[3]), int(sys.argv[4])

print(f'窗口 PNG x {x0}-{x1} (CSS {x0/2}-{x1/2}), y {y0}-{y1} (CSS {y0/2}-{y1/2})')
print('    ' + ''.join(str(int((x0 + i*4)/2) // 100 % 10) for i in range((x1-x0)//4)))
print('    ' + ''.join(str(int((x0 + i*4)/2) // 10 % 10) for i in range((x1-x0)//4)))
print('    ' + ''.join(str(int((x0 + i*4)/2) % 10) for i in range((x1-x0)//4)))
for y in range(y0, y1):
    row = ''
    for x in range(x0, x1, 4):
        c = px(x, y)
        r, g, b = c
        if abs(r-0xe6) <= 4 and abs(g-0xe9) <= 4 and abs(b-0xef) <= 4: row += '.'
        elif abs(r-0xdf) <= 4 and abs(g-0xe2) <= 4 and abs(b-0xea) <= 4: row += ' '
        elif abs(r-0xcd) <= 8 and abs(g-0xd0) <= 8 and abs(b-0xd9) <= 8: row += '='
        elif r < 60 and g < 60 and b < 60: row += '#'
        elif b - r > 60: row += 'A'
        else: row += '+'
    print(f'{y:>4} {row}')
