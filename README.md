# Cutout Pet · 抠图桌宠

Turn **any picture** into a desk pet that floats over the Harness Web UI. The background is
removed right in the page, the figure gets a sticker outline and a little idle life, and a speech
bubble keeps the current DeepSeek account balance in view.

把**任意一张图片**变成浮在 Harness 界面上的桌宠：在页面里直接抠掉背景、加白描边、让她会呼吸会摇摆，
头顶气泡实时显示当前 DeepSeek 账户余额。

---

## Features

- **Upload → cutout → pet.** Pick a JPG/PNG in *Settings → Cutout Pet*. The page's own canvas floods
  the background out from the borders, drops detached specks (sparkles, stray watermark strokes),
  feathers the edge, trims the transparent margin and paints a white sticker outline.
- **Tunable cutout.** Background tolerance slider, plus a switch to keep the whole picture when the
  background is a photo or a gradient.
- **Alive, not animated sprites.** Breathing and swaying anchored at her feet, sparkles drifting
  around her, a few pixels of lean toward the pointer, tilt while dragging.
- **Follows the window.** The position is stored as a fraction of the free space, not pixels, so the
  pet stays in its corner when the window grows or shrinks.
- **Balance bubble.** The Host half asks the signed-in DeepSeek account for its wallet balance
  (CNY/USD, plus bonus wallets). No API key, no token in the page.
- **Local and quiet.** The picture never leaves the machine: it is decoded and cut in the browser; only
  the finished PNG is written to the DSH data directory.

## Install

From the plugin market (once listed):

```bash
dsh plugin --profile <profile> add dsh-cutout-pet
```

Straight from this repository:

```bash
dsh plugin --profile <profile> add github:AlannerFranklin/dsh-cutout-pet
```

or install the folder as a bundle from the Plugins page (`Install from folder`).

After installing, open **Settings → Cutout Pet**, choose an image, adjust *Background tolerance* if
needed, and press **Use as pet**.

## How it works

| Half | Responsibility |
| --- | --- |
| `client.js` | Registers the pet in `shell.overlay` and the settings page in `settings.section`. Runs the cutout in a canvas: border-colour flood fill → main-silhouette filter → 3×3 alpha feather → trim → white outline → PNG data URL. |
| `index.js` | Serves `/.dsh-pet/art.png` (uploaded or bundled default), `/.dsh-pet/state`, `/.dsh-pet/art` (POST/DELETE) and `/.dsh-pet/balance`. Stores the upload at `<DSH_HOME>/plugin-data/dsh-cutout-pet/art.png`. |
| `assets/default.png` | Original strawberry placeholder drawn for this plugin (MIT, same as the code). |

Uploads are validated as real PNG data (signature, IHDR size, 3 MiB cap) before they are written.

## Limitations

- The cutout is a colour-key algorithm, not a segmentation model. Flat or single-colour backgrounds
  cut cleanly; photos, gradients and busy scenes need the switch turned off (whole picture as the pet)
  or an external editor.
- The balance comes from the DeepSeek **account** wallet service. In a profile without a signed-in
  account the bubble says so instead of failing.
- One pet per profile: the artwork is shared, the position is per browser.

## 中文说明

**功能**

- **上传即抠图**：在「设置 → 抠图桌宠」选一张 JPG/PNG。页面用画布从四边做背景泛洪，去掉背景与
  脱落的碎片（亮点、水印笔画），羽化边缘、裁掉透明边，再加一圈白描边。
- **可调**：「去背强度」滑块控制背景容差；背景是照片/渐变时可以关掉去背，整张图当桌宠。
- **会动**：以脚底为原点的呼吸与摇摆、身边漂浮的星光、朝鼠标轻轻倾斜、拖动时跟着倾斜。
- **跟着窗口走**：位置按“可移动空间的比例”保存，窗口放大缩小时她会留在右下角，而不是停原地。
- **余额气泡**：宿主半通过已登录的 DeepSeek 账户取钱包余额（含赠送），页面里没有任何密钥。
- **隐私**：图片不会离开本机——抠图在浏览器里完成，只有处理好的 PNG 写到 DSH 数据目录。

**安装**：`dsh plugin --profile <profile> add github:AlannerFranklin/dsh-cutout-pet`，然后在
「设置 → 抠图桌宠」上传图片、点「保存为桌宠」。

**限制**：抠图是颜色键算法而不是分割模型，纯色/简单背景效果最好；照片类背景建议关掉去背。

## License

MIT © AlannerFranklin. The default strawberry mascot is drawn for this plugin and covered by the same
license; uploaded artwork stays on the user's machine and is never redistributed by the plugin.
