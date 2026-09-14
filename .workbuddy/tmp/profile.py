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

def profile(path, boxes):
    w, h, ch, buf = decode_png(path)
    P = lambda x, y: buf[(y*w+x)*ch:(y*w+x)*ch+3]
    print(f"## {os.path.basename(path)}")
    for (x0, y0, x1, y1) in boxes:
        cx = (x0+x1)//2
        print(f"  block ({x0},{y0})-({x1},{y1})")
        # vertical profile at center column (skip 1px border)
        vs = [hx(P(cx, y)) for y in range(y0+1, y1)]
        print("    V:", " ".join(vs[::3]))
        # horizontal profile at center row
        cy = (y0+y1)//2
        hs = [hx(P(x, cy)) for x in range(x0+1, x1)]
        print("    H:", " ".join(hs[::4]))
        # diagonal profile
        n = min(x1-x0, y1-y0)
        ds = [hx(P(x0+1+i, y0+1+i)) for i in range(0, n-2)]
        print("    D:", " ".join(ds[::3]))

if __name__ == '__main__':
    p5 = "C:/Users/hellokunzai/.workbuddy/clipboard-images/clipboard-2026-09-14T08-22-39-585Z-02eb39cf.png"
    profile(p5, [(57,71,101,100),(110,71,154,100),(162,71,206,100),(215,71,259,100),
                 (57,108,101,137),(110,108,154,137),(162,108,206,137),(215,108,259,137)])
    p6 = "C:/Users/hellokunzai/.workbuddy/clipboard-images/clipboard-2026-09-14T08-22-39-586Z-a6f68a8a.png"
    profile(p6, [(67,70,111,99),(120,70,164,99),(172,70,216,99),(225,70,269,99)])
    p4 = "C:/Users/hellokunzai/.workbuddy/clipboard-images/clipboard-2026-09-14T08-22-39-585Z-7c593916.png"
    profile(p4, [(121,67,165,96)])
