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

path = sys.argv[1]
w, h, px = load(path)
xs = [int(a) for a in sys.argv[2].split(',')]
y0, y1 = int(sys.argv[3]), int(sys.argv[4])
print('size', w, h, ' x =', xs)
bg = px(xs[0], y0 - 1)
print('参考底色 bg =', '#%02x%02x%02x' % bg[:3])
for y in range(y0, min(y1, h)):
    cols = [px(x, y) for x in xs]
    s = ' '.join('#%02x%02x%02x' % c[:3] for c in cols)
    uniq = len(set(cols))
    tag = ''
    if uniq == 1 and cols[0][:3] != bg[:3]:
        tag = '  <== 整行同色（线条候选）'
    print(f'{y:>3} | {s} | 不同色数={uniq}{tag}')
