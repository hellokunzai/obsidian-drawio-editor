import sys, struct, zlib, os, collections

def decode_png(path):
    data = open(path, 'rb').read()
    pos = 8; idat = b''; w = h = bitd = colort = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]; chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR': w, h, bitd, colort = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT': idat += chunk
        elif typ == b'IEND': break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[colort]
    stride = w * ch
    out = bytearray(h * stride); prev = bytearray(stride); p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(ch, stride): line[i] = (line[i] + line[i-ch]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                b = prev[i]; c = prev[i-ch] if i >= ch else 0
                pa = abs(b-c); pb = abs(a-c); pc = abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y*stride:(y+1)*stride] = line; prev = line
    return w, h, ch, bytes(out)

def hx(c): return '#%02x%02x%02x' % (c[0], c[1], c[2])

def analyze(path):
    w, h, ch, buf = decode_png(path)
    P = lambda x, y: buf[(y*w+x)*ch:(y*w+x)*ch+3]
    cnt = collections.Counter(P(x, y) for y in range(h) for x in range(w))
    bg = cnt.most_common(1)[0][0]
    def isbg(c): return abs(c[0]-bg[0])+abs(c[1]-bg[1])+abs(c[2]-bg[2]) < 22

    # flood fill components
    seen = bytearray(w*h)
    comps = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy*w+sx] or isbg(P(sx, sy)): continue
            stack = [(sx, sy)]; seen[sy*w+sx] = 1
            xs = []; ys = []
            while stack:
                x, y = stack.pop(); xs.append(x); ys.append(y)
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and not isbg(P(nx, ny)):
                        seen[ny*w+nx] = 1; stack.append((nx, ny))
            comps.append((len(xs), min(xs), min(ys), max(xs), max(ys)))
    comps = [c for c in comps if c[0] > 40]
    comps.sort(key=lambda c: (round((c[2]+c[4])/2/10), c[1]))
    print(f"## {os.path.basename(path)} {w}x{h} bg={hx(bg)}  comps={len(comps)}")
    for n, (area, x0, y0, x1, y1) in enumerate(comps):
        cx, cy = (x0+x1)//2, (y0+y1)//2
        cols = collections.Counter(P(x, y) for y in range(y0, y1+1) for x in range(x0, x1+1))
        top = cols.most_common(3)
        print(f"  [{n}] box=({x0},{y0})-({x1},{y1}) {x1-x0+1}x{y1-y0+1} area={area} fill={hx(top[0][0])} tops={[hx(c) for c,_ in top]}")
        print(f"       center={hx(P(cx,cy))} edge={hx(P(x0,cy))} top={hx(P(cx,y0))}")

if __name__ == '__main__':
    for p in sys.argv[1:]: analyze(p)
