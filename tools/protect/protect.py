#!/usr/bin/env python3
"""把一份 HTML 加上密碼（StatiCrypt），放到這個公開的網站上。

用法（在 repo 根目錄執行）：
  STATICRYPT_PASSWORD='至少16個字的密碼' python3 tools/protect/protect.py _private/來源.html travel/某趟/ [--share]

會做的事：
  1. 來源裡 <img> 用到的本機圖片：轉正、縮到長邊 1280px、清掉 EXIF（含 GPS），內嵌進頁面，跟文字一起加密
  2. 用 StatiCrypt 加密，套 template.html 的中文密碼頁（noindex、深色模式）
  3. 檢查輸出裡找不到原文和圖片，才寫進 <輸出資料夾>/index.html
  4. --share：印出免輸入密碼的分享連結（連結裡有密碼的雜湊，等同密碼）

來源檔是明文，不能 commit 進這個 repo：放在 _private/（已 gitignore）或 repo 外面。
需要：Node.js（npx 會下載固定版本的 StatiCrypt）、Python 套件 pillow 和 pillow-heif（iPhone 的 HEIC 照片）。
"""
import argparse
import base64
import html.parser
import io
import os
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
SITE = "https://m930406.github.io"
STATICRYPT = "staticrypt@3.5.4"
MIN_PASSWORD = 16
MAX_SIDE = 1280       # 圖片長邊上限（px）
JPEG_QUALITY = 75
WARN_BYTES = 5 * 1024 * 1024

# 密碼頁上的文字。標題刻意寫得很普通：分享連結的預覽、瀏覽器分頁看到的就是它。
TEXT = {
    "--template-title": "需要密碼",
    "--template-instructions": "這一頁有設密碼，輸入後才看得到內容。",
    "--template-placeholder": "密碼",
    "--template-button": "打開",
    "--template-error": "密碼不對，再試一次。",
    "--template-toggle-show": "顯示密碼",
    "--template-toggle-hide": "隱藏密碼",
}

EXTERNAL = re.compile(r"^(https?:|data:|mailto:|tel:|#)", re.I)


def fail(msg):
    sys.exit(f"✗ {msg}")


class Refs(html.parser.HTMLParser):
    """找出頁面引用的所有本機檔案。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.images, self.others, self.text = [], [], []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if value is None:
                continue
            value = value.strip()
            if name == "src" and tag == "img" and not EXTERNAL.match(value):
                self.images.append(value)
            elif name == "srcset" or (name == "style" and "url(" in value):
                self.others.append(f"<{tag} {name}>")
            elif name in ("src", "href", "poster", "data") and value and not EXTERNAL.match(value):
                # 連到網站上其他公開頁面（例如 "/"）可以；連到本機檔案就會變成沒加密的公開檔案
                if not (tag == "a" and name == "href" and value.startswith("/")):
                    self.others.append(f"<{tag} {name}=\"{value}\">")

    def handle_data(self, data):
        self.text.append(data)


def image_data_uri(path):
    try:
        from PIL import Image, ImageOps
    except ImportError:
        fail("需要 Pillow：pip install pillow pillow-heif")
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass
    with Image.open(path) as src:
        img = ImageOps.exif_transpose(src)   # 先照 EXIF 的方向轉正，之後就不需要 EXIF 了
        img.load()
    icc = img.info.get("icc_profile")
    alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if alpha:
        img = img.convert("RGBA")
    img.info = {}                             # 丟掉 EXIF、GPS、XMP 等所有中繼資料（色彩描述檔除外）
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    if alpha:
        img.save(buf, "PNG", optimize=True, icc_profile=icc)
        mime = "image/png"
    else:
        img.convert("RGB").save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True, icc_profile=icc)
        mime = "image/jpeg"
    data = buf.getvalue()
    if b"Exif\x00\x00" in data or b"eXIf" in data:
        fail(f"{path} 的中繼資料沒有清乾淨，停止")
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", help="明文 HTML（放在 _private/ 或 repo 外）")
    ap.add_argument("out_dir", help="輸出到 repo 裡的哪個資料夾，例如 travel/某趟/")
    ap.add_argument("--share", action="store_true", help="印出免輸入密碼的分享連結")
    ap.add_argument("--remember", type=int, default=30, help="「記住這台裝置」幾天（0 = 不過期，-1 = 不提供）")
    ap.add_argument("--hint", help="密碼頁上的說明文字（不要寫人名、地點、日期）")
    args = ap.parse_args()

    password = os.environ.get("STATICRYPT_PASSWORD", "")
    if len(password) < MIN_PASSWORD:
        fail(f"請用環境變數 STATICRYPT_PASSWORD 給密碼，至少 {MIN_PASSWORD} 個字")

    source = pathlib.Path(args.source).resolve()
    out_dir = (REPO / args.out_dir).resolve()
    private = REPO / "_private"
    if not source.is_file():
        fail(f"找不到 {args.source}")
    if REPO in source.parents and private not in source.parents:
        fail("明文來源在 repo 裡、但不在 _private/：會被 commit 公開出去。請移到 _private/ 或 repo 外")
    if REPO not in out_dir.parents or private in out_dir.parents or out_dir == private:
        fail("輸出資料夾要在 repo 裡（而且不是 _private/）")

    page = source.read_text(encoding="utf-8")
    refs = Refs()
    refs.feed(page)
    if refs.others:
        fail("這些本機檔案不會被加密，會變成公開檔案：\n  " + "\n  ".join(sorted(set(refs.others)))
             + "\n圖片請用 <img src>（會內嵌加密）；PDF 等其他檔案請轉成網頁或圖片")

    inlined = 0
    for ref in sorted(set(refs.images)):
        path = (source.parent / ref).resolve()
        if not path.is_file():
            fail(f"找不到圖片 {ref}")
        uri = image_data_uri(path)
        page, n = re.subn(r"""(<img\b[^>]*?\bsrc\s*=\s*)(["'])""" + re.escape(ref) + r"\2", lambda m: f'{m.group(1)}"{uri}"', page)
        inlined += n
    if "name=\"robots\"" not in page:
        page = re.sub(r"<head(\s[^>]*)?>", lambda m: m.group(0) + '\n<meta name="robots" content="noindex">', page, count=1)

    rel = out_dir.relative_to(REPO).as_posix()
    env = dict(os.environ, STATICRYPT_PASSWORD=password)

    def staticrypt(tmp, *extra):
        # StatiCrypt 只吃相對路徑的設定檔，所以在暫存資料夾裡跑，salt 設定檔複製一份進去
        run = subprocess.run(["npx", "--yes", STATICRYPT, *extra, "-c", ".staticrypt.json", "--short"],
                             cwd=tmp, capture_output=True, text=True, env=env)
        if run.returncode:
            fail("StatiCrypt 失敗：\n" + run.stdout + run.stderr)
        return run.stdout

    with tempfile.TemporaryDirectory() as tmp:
        (pathlib.Path(tmp) / ".staticrypt.json").write_bytes((HERE / "staticrypt.json").read_bytes())
        (pathlib.Path(tmp) / "index.html").write_text(page, encoding="utf-8")
        cmd = ["index.html", "-d", "out", "-t", str(HERE / "template.html"),
               "--remember", "false" if args.remember < 0 else str(args.remember)]
        text = dict(TEXT, **({"--template-instructions": args.hint} if args.hint else {}))
        text["--template-remember"] = f"記住這台裝置 {args.remember} 天" if args.remember > 0 else "記住這台裝置"
        for flag, value in text.items():
            cmd += [flag, value]
        staticrypt(tmp, *cmd)
        encrypted = (pathlib.Path(tmp) / "out" / "index.html").read_text(encoding="utf-8")
        # 加了 --share 時 StatiCrypt 只會印連結、不加密，所以另外跑一次
        share = staticrypt(tmp, "--share", f"{SITE}/{rel}/") if args.share else ""

    # 加密後找不到原文、找不到圖片，才寫出去
    template = (HERE / "template.html").read_text(encoding="utf-8")
    chunks = {c for c in re.findall(r"\S{6,}", " ".join(refs.text)) if c not in template}
    leaked = sorted(c for c in chunks if c in encrypted)
    if leaked or re.search(r"data:image/(jpeg|png|webp|gif)", encrypted) or 'name="robots" content="noindex"' not in encrypted:
        fail("加密後的檔案看起來有原文外流，停止：" + ", ".join(leaked[:5]))

    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "index.html"
    target.write_text(encrypted, encoding="utf-8")
    size = target.stat().st_size
    print(f"✓ {target.relative_to(REPO)}：{size / 1024:.0f} KB，內嵌 {inlined} 張圖片")
    if size > WARN_BYTES:
        print("  ⚠ 超過 5 MB，手機開起來會慢：圖片少放幾張，或先裁小")
    if args.share:
        link = next((w for w in share.split() if "#staticrypt_pwd=" in w), None)
        print(f"  分享連結（等同密碼，只傳給要看的人）：{link}" if link else "  ⚠ 沒拿到分享連結：\n" + share)


if __name__ == "__main__":
    main()
