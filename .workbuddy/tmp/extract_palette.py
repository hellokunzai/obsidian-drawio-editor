import sys, struct, zlib, os, json, collections

def decode_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8
    idat = b''
    w = h = bitd = colort = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bitd, colort = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'IEND':
            break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[colort]
    assert bitd == 8, bitd
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i-ch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                b = prev[i]
                c = prev[i-ch] if i >= ch else 0
                pa = abs(b - c); pb = abs(a - c); pc = abs(a + b - 2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, ch, bytes(out)

def main(path):
    w, h, ch, buf = decode_png(path)
    def px(x, y):
        o = (y*w + x)*ch
        return (buf[o], buf[o+1], buf[o+2])
    # background = most common color
    cnt = collections.Counter()
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            cnt[px(x, y)] += 1
    bg = cnt.most_common(1)[0][0]
    print(f"# {os.path.basename(path)}  {w}x{h} bg={bg} hex=#{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}")

    def isbg(c):
        return abs(c[0]-bg[0]) + abs(c[1]-bg[1]) + abs(c[2]-bg[2]) < 24

    # vertical/horizontal projection of non-bg
    colsum = [0]*w
    rowsum = [0]*h
    for y in range(h):
        for x in range(w):
            if not isbg(px(x, y)):
                colsum[x] += 1
                rowsum[y] += 1
    # find runs with colsum > 2
    def runs(arr, thr):
        res = []
        s = None
        for i, v in enumerate(arr):
            if v > thr and s is None:
                s = i
            elif v <= thr and s is not None:
                res.append((s, i-1)); s = None
        if s is not None:
            res.append((s, len(arr)-1))
        return res
    vr = runs(colsum, 2)
    hr = runs(rowsum, 2)
    print("  col-runs:", vr)
    print("  row-runs:", hr)
    json.dump({"w": w, "h": h, "bg": bg, "vr": vr, "hr": hr}, open(path + ".json", "w"))

if __name__ == '__main__':
    for p in sys.argv[1:]:
        main(p)
