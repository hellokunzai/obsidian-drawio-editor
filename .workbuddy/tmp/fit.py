import struct, zlib, os

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

def hx(c): return '#%02x%02x%02x' % (int(round(c[0])), int(round(c[1])), int(round(c[2])))

def fit(path, boxes):
    w, h, ch, buf = decode_png(path)
    P = lambda x, y: buf[(y*w+x)*ch:(y*w+x)*ch+3]
    print(f"## {os.path.basename(path)}")
    for (x0, y0, x1, y1) in boxes:
        cx = (x0+x1)//2
        ys = list(range(y0+1, y1))          # skip 1px border
        samples = [(y, P(cx, y)) for y in ys]
        # least squares per channel over [0,1] normalised inside block
        n = len(ys)
        sx = sum(y for y, _ in samples); sy = [sum(c[i] for _, c in samples) for i in range(3)]
        sxx = sum(y*y for y, _ in samples)
        sxy = [sum(y*c[i] for y, c in samples) for i in range(3)]
        den = n*sxx - sx*sx
        top, bot = [], []
        for i in range(3):
            a = (n*sxy[i] - sx*sy[i]) / den        # slope
            b = (sy[i] - a*sx) / n                 # intercept
            top.append(a*y0 + b)                   # value at top edge of shape
            bot.append(a*(y1+1) + b)               # value at bottom edge of shape
        raw_top = P(cx, y0+1); raw_bot = P(cx, y1-1)
        border = P(cx, y0)
        print(f"  box=({x0},{y0})-({x1},{y1})  border={hx(border)}  "
              f"fitTop={hx(top)} fitBot={hx(bot)}  rawTop={hx(raw_top)} rawBot={hx(raw_bot)}")

if __name__ == '__main__':
    p5 = "C:/Users/hellokunzai/.workbuddy/clipboard-images/clipboard-2026-09-14T08-22-39-585Z-02eb39cf.png"
    fit(p5, [(57,71,101,100),(110,71,154,100),(162,71,206,100),(215,71,259,100),
             (57,108,101,137),(110,108,154,137),(162,108,206,137),(215,108,259,137)])
    # 同时复核其它页的纯色块 border 值
    for name, boxes in [
        ("clipboard-2026-09-14T08-22-39-582Z-d4a854cd.png", [(64,72,108,101),(117,72,161,101),(169,72,213,101),(222,72,266,101),(64,109,108,138),(117,109,161,138),(169,109,213,138),(222,109,266,138)]),
        ("clipboard-2026-09-14T08-22-39-583Z-6d95eb9a.png", [(62,70,106,99),(115,70,159,99),(167,70,211,99),(220,70,264,99),(62,107,106,136),(115,107,159,136),(167,107,211,136),(220,107,264,136)]),
        ("clipboard-2026-09-14T08-22-39-584Z-af6e3b55.png", [(58,85,102,114),(111,85,155,114),(163,85,207,114),(216,85,260,114),(58,122,102,151),(111,122,155,151),(163,122,207,151),(216,122,260,151)]),
        ("clipboard-2026-09-14T08-22-39-585Z-7c593916.png", [(68,67,112,96),(121,67,165,96),(173,67,217,96),(226,67,270,96),(68,104,112,133),(121,104,165,133),(173,104,217,133),(226,104,270,133)]),
        ("clipboard-2026-09-14T08-22-39-586Z-a6f68a8a.png", [(67,70,111,99),(120,70,164,99),(172,70,216,99),(225,70,269,99),(67,107,111,136),(120,107,164,136),(172,107,216,136),(225,107,269,136)]),
    ]:
        fit("C:/Users/hellokunzai/.workbuddy/clipboard-images/" + name, boxes)
