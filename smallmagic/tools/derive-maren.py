# Build Maren Reed's VRM from VRoid AvatarSample_A.
# The output is a derived file for this game. It is not CC0, and it is not the
# unmodified sample. Do not publish the source sample as its own download.
import io
import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "v7/assets/vrm/AvatarSample_A.vrm"
DST = ROOT / "smallmagic/public/hearth/people/maren-reed.vrm"

# image index -> (r, g, b, mix). Mix is how far the visible pixels move.
TINTS = {
    17: (214, 186, 132, 0.55),  # hoodie, warm linen
    18: (92, 122, 70, 0.42),    # bottoms, moss
    19: (122, 74, 46, 0.35),    # shoes, bark
    20: (176, 96, 58, 0.62),    # hair
    24: (168, 88, 54, 0.62),
    25: (176, 96, 58, 0.62),
    26: (190, 120, 86, 0.5),
}


def read_glb(path):
    data = path.read_bytes()
    assert data[:4] == b"glTF"
    off = 12
    chunks = []
    while off + 8 <= len(data):
        length, kind = struct.unpack_from("<I4s", data, off)
        chunks.append((kind, data[off + 8 : off + 8 + length]))
        off += 8 + length
    js = json.loads(chunks[0][1])
    return js, bytearray(chunks[1][1])


def tint(raw, mime, rgba):
    r, g, b, mix = rgba
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    pix = img.load()
    for y in range(img.height):
        for x in range(img.width):
            pr, pg, pb, pa = pix[x, y]
            if pa < 12:
                continue
            pix[x, y] = (
                int(pr * (1 - mix) + r * mix),
                int(pg * (1 - mix) + g * mix),
                int(pb * (1 - mix) + b * mix),
                pa,
            )
    buf = io.BytesIO()
    if mime == "image/jpeg":
        img.convert("RGB").save(buf, format="JPEG", quality=84, optimize=True)
    else:
        img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def pack(js, blob):
    views = js["bufferViews"]
    pieces = []
    for bv in views:
        start = bv.get("byteOffset", 0)
        pieces.append(bytearray(blob[start : start + bv["byteLength"]]))
    for image in js["images"]:
        slot = TINTS.get(js["images"].index(image))
        if not slot:
            continue
        view = image["bufferView"]
        pieces[view] = bytearray(tint(bytes(pieces[view]), image["mimeType"], slot))
    out = bytearray()
    for bv, piece in zip(views, pieces):
        while len(out) % 4:
            out.append(0)
        bv["byteOffset"] = len(out)
        bv["byteLength"] = len(piece)
        out += piece
    while len(out) % 4:
        out.append(0)
    js["buffers"][0]["byteLength"] = len(out)
    return out


def write_glb(js, blob, path):
    body = json.dumps(js, separators=(",", ":")).encode("utf-8")
    while len(body) % 4:
        body += b" "
    total = 12 + 8 + len(body) + 8 + len(blob)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total)
    out += struct.pack("<I4s", len(body), b"JSON")
    out += body
    out += struct.pack("<I4s", len(blob), b"BIN\x00")
    out += blob
    path.write_bytes(out)


def role(name):
    n = (name or "").lower()
    if "hair" in n and "nml" not in n and "spe" not in n and "matcap" not in n:
        return "hair"
    if "tops" in n:
        return "top"
    if "bottoms" in n:
        return "bottom"
    if "shoes" in n:
        return "shoe"
    return None


def derive(src, dst, title, reference, tints):
    js, blob = read_glb(src)
    meta = js["extensions"]["VRM"]["meta"]
    meta["title"] = title
    meta["author"] = "VRoid"
    meta["licenseName"] = "Other"
    meta["otherLicenseUrl"] = ""
    meta["reference"] = reference
    named = {}
    for image in js["images"]:
        kind = role(image.get("name"))
        if kind and kind in tints:
            named[js["images"].index(image)] = tints[kind]
    global TINTS
    TINTS = named
    blob = pack(js, blob)
    write_glb(js, blob, dst)
    print(f"wrote {dst} {dst.stat().st_size}")


def main():
    note = "This is not a public-domain licence. Do not ship or sell the unmodified sample."
    derive(
        SRC,
        DST,
        "Maren Reed",
        "Derived from VRoid AvatarSample_A for this game as Maren Reed. " + note,
        {
            "hair": (176, 96, 58, 0.62),
            "top": (214, 186, 132, 0.55),
            "bottom": (92, 122, 70, 0.42),
            "shoe": (122, 74, 46, 0.35),
        },
    )
    people = ROOT / "smallmagic/public/hearth/people"
    derive(
        ROOT / "v7/assets/vrm/AvatarSample_B.vrm",
        people / "bram-vroid.vrm",
        "Bram",
        "Derived from VRoid AvatarSample_B for this game as Bram. " + note,
        {
            "hair": (140, 96, 58, 0.45),
            "top": (120, 138, 78, 0.5),
            "bottom": (70, 54, 40, 0.35),
            "shoe": (90, 64, 46, 0.3),
        },
    )
    derive(
        ROOT / "v7/assets/vrm/AvatarSample_C.vrm",
        people / "sable-vroid.vrm",
        "Sable",
        "Derived from VRoid AvatarSample_C for this game as Sable. " + note,
        {
            "hair": (36, 48, 62, 0.55),
            "top": (46, 110, 128, 0.5),
            "bottom": (28, 40, 48, 0.35),
            "shoe": (54, 48, 42, 0.25),
        },
    )


if __name__ == "__main__":
    main()
