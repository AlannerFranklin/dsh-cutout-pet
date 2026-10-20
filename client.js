/**
 * Browser half of Cutout Pet.
 *
 * Two registrations share one bundle:
 * - `shell.overlay`: the draggable pet itself, with a balance bubble and a few
 *   idle animations.
 * - `settings.section`: the page where a picture is turned into a pet. The
 *   cutout runs here, in the page's own canvas, so the Host never needs an image
 *   library — it only stores the finished PNG.
 *
 * The file is one immediately-invoked function because the shell evaluates it as
 * a classic script on every revision: top-level `let`/`const` would be
 * redeclared and the new copy would die before registering.
 */
;(function () {
  window.__ModuleLoader__.load({
    id: 'dsh-cutout-pet',
    factory(require) {
      const React = require('react')
      const h = React.createElement

      const NAMESPACE = 'cutout-pet'
      const ANCHOR_KEY = 'dsh-cutout-pet/anchor'
      const ART_EVENT = 'dsh-cutout-pet/art'
      const PERSON_WIDTH = 190
      const ART_ASPECT = 640 / 480
      const REFRESH_MS = 60_000
      const ART_URL = '/.dsh-pet/art.png'
      const BALANCE_URL = '/.dsh-pet/balance'
      const UPLOAD_URL = '/.dsh-pet/art'
      const STATE_URL = '/.dsh-pet/state'

      const MAX_PROCESS_SIDE = 560
      const OUTPUT_WIDTH = 480
      const OUTLINE_RADIUS = 3
      const DEFAULT_TOLERANCE = 56

      const DICT = {
        zh: {
          title: '抠图桌宠',
          settingsLabel: '抠图桌宠',
          balance: '余额',
          loading: '正在读取余额…',
          error: '余额读取失败',
          retry: '点击重试',
          signedOut: '登录 DeepSeek 账号后显示余额',
          updated: '更新于 {time}',
          bonus: '含赠送 {amount}',
          hint: '拖动可换位置，点击刷新余额',
          settingsTitle: '抠图桌宠',
          settingsLead: '上传一张人物图片，插件在本地把它抠成透明立绘，立刻变成浮在 Harness 上的桌宠。图片不会离开这台电脑。',
          currentArt: '当前立绘',
          upload: '选择图片',
          replace: '换一张图片',
          save: '保存为桌宠',
          saving: '保存中…',
          reset: '恢复默认',
          processing: '抠图中…',
          removeBackground: '去掉背景（推荐）',
          tolerance: '去背强度',
          toleranceHint: '背景干净时调低更保险；背景杂物多时调高。',
          previewTitle: '预览',
          ready: '处理好了，点「保存为桌宠」生效。',
          saved: '已保存，桌宠已经换上新立绘。',
          resetDone: '已恢复默认立绘。',
          failed: '处理失败：{message}',
          unsupported: '这张图片读不出来，换一张 JPG/PNG 试试。',
          hintPhoto: '照片、渐变背景很难抠干净；这种情况可以取消「去掉背景」，把整张图当作桌宠。',
          defaultArt: '当前使用内置草莓占位立绘，上传图片后可替换。',
          customArt: '当前使用你上传的立绘。',
        },
        en: {
          title: 'Cutout Pet',
          settingsLabel: 'Cutout Pet',
          balance: 'Balance',
          loading: 'Reading balance…',
          error: 'Balance unavailable',
          retry: 'Click to retry',
          signedOut: 'Sign in to your DeepSeek account to see the balance',
          updated: 'Updated {time}',
          bonus: 'incl. bonus {amount}',
          hint: 'Drag to move, click to refresh',
          settingsTitle: 'Cutout Pet',
          settingsLead: 'Upload a picture of a character and the plugin cuts it out locally into a transparent sticker that floats over Harness. The image never leaves this machine.',
          currentArt: 'Current artwork',
          upload: 'Choose image',
          replace: 'Choose another',
          save: 'Use as pet',
          saving: 'Saving…',
          reset: 'Restore default',
          processing: 'Cutting out…',
          removeBackground: 'Remove the background (recommended)',
          tolerance: 'Background tolerance',
          toleranceHint: 'Lower is safer for clean backgrounds; raise it when the background has clutter.',
          previewTitle: 'Preview',
          ready: 'Looks good — press "Use as pet".',
          saved: 'Saved. The pet is wearing the new artwork.',
          resetDone: 'Default artwork restored.',
          failed: 'Processing failed: {message}',
          unsupported: 'That image cannot be read. Try a JPG or PNG.',
          hintPhoto: 'Photos and gradients rarely cut cleanly; turn off "Remove the background" to keep the whole picture as the pet.',
          defaultArt: 'The built-in strawberry placeholder is showing. Upload a picture to replace it.',
          customArt: 'Your uploaded artwork is in use.',
        },
      }

      const SYMBOL = { CNY: '¥', USD: '$' }

      const CSS = `
.cp-pet { position: fixed; pointer-events: none; font-family: inherit; }
.cp-figure { pointer-events: auto; position: relative; width: ${PERSON_WIDTH}px; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; transform-origin: 50% 100%; transition: transform .28s ease-out; transform: translate3d(var(--look-x, 0px), var(--look-y, 0px), 0) rotate(var(--drag-tilt, 0deg)); }
.cp-figure:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 6px; border-radius: 12px; }
.cp-sway { transform-origin: 50% 100%; animation: cp-sway 7.6s ease-in-out infinite; }
.cp-breathe { transform-origin: 50% 100%; animation: cp-breathe 4.4s ease-in-out infinite; }
.cp-art { display: block; width: ${PERSON_WIDTH}px; height: auto; -webkit-user-drag: none; filter: drop-shadow(0 10px 16px rgba(28, 12, 16, .16)); transition: filter .2s ease; }
.cp-pet[data-dragging="true"] .cp-figure { cursor: grabbing; }
.cp-pet[data-dragging="true"] .cp-art { filter: drop-shadow(0 18px 26px rgba(28, 12, 16, .28)); }
.cp-figure:hover .cp-art { filter: drop-shadow(0 12px 20px rgba(28, 12, 16, .22)) brightness(1.02); }
.cp-fallback { display: flex; align-items: center; justify-content: center; width: ${PERSON_WIDTH}px; height: ${Math.round(PERSON_WIDTH * ART_ASPECT)}px; border-radius: 16px; background: linear-gradient(180deg, #fadbdf, #f0b9c5); color: #7a3b46; font-size: 12px; line-height: 1.5; text-align: center; padding: 0 14px; box-sizing: border-box; }
.cp-sparkles { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.cp-sparkle { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #fff; box-shadow: 0 0 7px rgba(255, 255, 255, .95); opacity: 0; animation: cp-sparkle 6s ease-in-out infinite; }
.cp-bubble { pointer-events: auto; cursor: pointer; position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%); margin-bottom: 6px; min-width: 96px; max-width: 200px; padding: 7px 12px 8px; box-sizing: border-box; border-radius: 14px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l1); box-shadow: 0 8px 20px rgba(28, 12, 16, .14); text-align: center; }
.cp-bubble::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 9px; height: 9px; background: var(--dsw-alias-bg-overlay); border-right: 1px solid var(--dsw-alias-border-l1); border-bottom: 1px solid var(--dsw-alias-border-l1); transform: translateX(-50%) rotate(45deg); }
.cp-label { font-size: 10px; line-height: 1.4; letter-spacing: .04em; color: var(--dsw-alias-label-secondary); }
.cp-value { font-size: 17px; font-weight: 600; line-height: 1.3; font-variant-numeric: tabular-nums; }
.cp-value--state { font-size: 12px; font-weight: 500; line-height: 1.45; color: var(--dsw-alias-label-primary); white-space: normal; }
.cp-note { font-size: 10px; line-height: 1.45; margin-top: 2px; color: var(--dsw-alias-label-secondary); }
.cp-note--error { color: var(--dsw-alias-state-error-primary); }
@keyframes cp-sway { 0%, 100% { transform: rotate(-.7deg); } 50% { transform: rotate(.7deg); } }
@keyframes cp-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(.997, 1.008); } }
@keyframes cp-sparkle { 0% { opacity: 0; transform: translate3d(0, 6px, 0) scale(.6); } 25% { opacity: .95; } 70% { opacity: .5; } 100% { opacity: 0; transform: translate3d(6px, -26px, 0) scale(1.15); } }
@media (prefers-reduced-motion: reduce) {
  .cp-sway, .cp-breathe, .cp-sparkle { animation: none; }
  .cp-figure { transition: none; }
}

.cp-section { display: flex; flex-direction: column; gap: 18px; max-width: 660px; font-size: 13px; line-height: 1.6; color: var(--dsw-alias-label-primary); }
.cp-section h2 { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.4; }
.cp-section p { margin: 0; font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.cp-head { display: flex; flex-direction: column; gap: 4px; }
.cp-art-row { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
.cp-preview { position: relative; width: 200px; height: 267px; border-radius: 14px; border: 1px solid var(--dsw-alias-border-l1); background-color: var(--dsw-alias-bg-layer-1); background-image: conic-gradient(rgba(128,128,128,.10) 0 25%, transparent 0 50%, rgba(128,128,128,.10) 0 75%, transparent 0); background-size: 16px 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.cp-preview img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.cp-preview-note { font-size: 11px; color: var(--dsw-alias-label-tertiary); margin-top: 6px; }
.cp-controls { display: flex; flex-direction: column; gap: 12px; flex: 1 1 300px; min-width: 260px; }
.cp-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.cp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer; }
.cp-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
.cp-btn:disabled { opacity: .45; cursor: not-allowed; }
.cp-btn--primary { background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff; }
.cp-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.cp-field { display: flex; flex-direction: column; gap: 4px; }
.cp-field-label { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.cp-field input[type="range"] { width: 100%; accent-color: var(--dsw-alias-brand-primary); }
.cp-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.cp-check input { accent-color: var(--dsw-alias-brand-primary); }
.cp-status { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); min-height: 18px; }
.cp-status--error { color: var(--dsw-alias-state-error-primary); }
.cp-status--ok { color: var(--dsw-alias-state-success-primary); }
.cp-divider { height: 1px; background: var(--dsw-alias-border-l1); border: 0; margin: 0; }
`

      /** Inputs larger than this are downscaled before any pixel work. */
      const MAX_PROCESS_PIXELS = MAX_PROCESS_SIDE

      /** Pixel offset of the byte triplet for one index. */
      function at(index) {
        return index * 4
      }

      /** Decode a file into an Image plus its object URL (caller revokes). */
      function loadImageFile(file) {
        return new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file)
          const image = new Image()
          image.onload = () => resolve({ image, url })
          image.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('decode-failed'))
          }
          image.src = url
        })
      }

      /** Median of the border colours, the reference a flat background sits near. */
      function borderReference(data, width, height) {
        const reds = []
        const greens = []
        const blues = []
        const stepX = Math.max(1, Math.floor(width / 64))
        const stepY = Math.max(1, Math.floor(height / 64))
        const push = (index) => {
          const p = at(index)
          reds.push(data[p])
          greens.push(data[p + 1])
          blues.push(data[p + 2])
        }
        for (let x = 0; x < width; x += stepX) {
          push(x)
          push((height - 1) * width + x)
        }
        for (let y = 0; y < height; y += stepY) {
          push(y * width)
          push(y * width + width - 1)
        }
        const median = (values) => {
          values.sort((a, b) => a - b)
          return values[Math.floor(values.length / 2)]
        }
        return [median(reds), median(greens), median(blues)]
      }

      /**
       * Flood-fill the background from the borders, keyed to the border colour.
       * @param {Uint8ClampedArray} data - RGBA pixels, mutated in place.
       * @param {number} width - canvas width.
       * @param {number} height - canvas height.
       * @param {number} tolerance - per-channel distance still counted as background.
       */
      function removeBackground(data, width, height, tolerance) {
        const [refR, refG, refB] = borderReference(data, width, height)
        const tolerance2 = tolerance * tolerance
        const visited = new Uint8Array(width * height)
        const queue = new Int32Array(width * height)
        let head = 0
        let tail = 0

        const matches = (index) => {
          const p = at(index)
          const dr = data[p] - refR
          const dg = data[p + 1] - refG
          const db = data[p + 2] - refB
          return dr * dr + dg * dg + db * db <= tolerance2
        }
        const seed = (index) => {
          if (visited[index] !== 0) return
          visited[index] = 1
          if (matches(index)) queue[tail++] = index
          else visited[index] = 2
        }

        for (let x = 0; x < width; x += 1) {
          seed(x)
          seed((height - 1) * width + x)
        }
        for (let y = 0; y < height; y += 1) {
          seed(y * width)
          seed(y * width + width - 1)
        }

        while (head < tail) {
          const index = queue[head++]
          data[at(index) + 3] = 0
          const x = index % width
          const neighbours = [index - width, index + width]
          if (x > 0) neighbours.push(index - 1)
          if (x < width - 1) neighbours.push(index + 1)
          for (const next of neighbours) {
            if (next < 0 || next >= width * height || visited[next] !== 0) continue
            if (matches(next)) {
              visited[next] = 1
              queue[tail++] = next
            } else {
              visited[next] = 2
            }
          }
        }
      }

      /** Keep the main silhouette; drop sparkles and detached watermark strokes. */
      function keepMainSilhouette(data, width, height) {
        const total = width * height
        const mask = new Uint8Array(total)
        for (let i = 0; i < total; i += 1) mask[i] = data[at(i) + 3] > 0 ? 1 : 0
        const label = new Int32Array(total).fill(-1)
        const sizes = []
        const stack = []
        for (let start = 0; start < total; start += 1) {
          if (mask[start] === 0 || label[start] !== -1) continue
          const id = sizes.length
          let size = 0
          stack.push(start)
          label[start] = id
          while (stack.length > 0) {
            const index = stack.pop()
            size += 1
            const x = index % width
            const neighbours = [index - width, index + width]
            if (x > 0) neighbours.push(index - 1)
            if (x < width - 1) neighbours.push(index + 1)
            for (const next of neighbours) {
              if (next < 0 || next >= total || mask[next] === 0 || label[next] !== -1) continue
              label[next] = id
              stack.push(next)
            }
          }
          sizes.push(size)
        }
        if (sizes.length === 0) return
        const largest = Math.max(...sizes)
        const keepAbove = Math.max(64, largest * 0.02)
        for (let i = 0; i < total; i += 1) {
          if (mask[i] === 1 && sizes[label[i]] < keepAbove) data[at(i) + 3] = 0
        }
      }

      /** Soften the cut edge with one 3x3 box pass over the alpha channel. */
      function featherAlpha(data, width, height) {
        const source = new Uint8Array(width * height)
        for (let i = 0; i < width * height; i += 1) source[i] = data[at(i) + 3]
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            let sum = 0
            let count = 0
            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                const nx = x + dx
                const ny = y + dy
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
                sum += source[ny * width + nx]
                count += 1
              }
            }
            data[at(y * width + x) + 3] = Math.round(sum / count)
          }
        }
      }

      /** Bounding box of pixels whose alpha clears the cutoff. */
      function alphaBox(data, width, height, cutoff) {
        let minX = width
        let minY = height
        let maxX = -1
        let maxY = -1
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (data[at(y * width + x) + 3] < cutoff) continue
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }
        if (maxX < 0) return null
        return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      }

      /** Separable maximum filter used for the sticker outline. */
      function dilateMask(mask, width, height, radius) {
        const horizontal = new Uint8Array(width * height)
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            let hit = 0
            const from = Math.max(0, x - radius)
            const to = Math.min(width - 1, x + radius)
            for (let nx = from; nx <= to; nx += 1) {
              if (mask[y * width + nx] === 1) {
                hit = 1
                break
              }
            }
            horizontal[y * width + x] = hit
          }
        }
        const result = new Uint8Array(width * height)
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            let hit = 0
            const from = Math.max(0, y - radius)
            const to = Math.min(height - 1, y + radius)
            for (let ny = from; ny <= to; ny += 1) {
              if (horizontal[ny * width + x] === 1) {
                hit = 1
                break
              }
            }
            result[y * width + x] = hit
          }
        }
        return result
      }

      /** Paint a white sticker edge behind the cut figure and return a data URL. */
      function withOutline(canvas) {
        const width = canvas.width
        const height = canvas.height
        const context = canvas.getContext('2d')
        const pixels = context.getImageData(0, 0, width, height)
        const mask = new Uint8Array(width * height)
        for (let i = 0; i < width * height; i += 1) mask[i] = pixels.data[at(i) + 3] > 32 ? 1 : 0
        const dilated = dilateMask(mask, width, height, OUTLINE_RADIUS)

        const out = document.createElement('canvas')
        out.width = width
        out.height = height
        const outContext = out.getContext('2d')
        const edge = outContext.createImageData(width, height)
        for (let i = 0; i < width * height; i += 1) {
          if (dilated[i] === 0) continue
          const p = at(i)
          edge.data[p] = 255
          edge.data[p + 1] = 255
          edge.data[p + 2] = 255
          edge.data[p + 3] = 255
        }
        outContext.putImageData(edge, 0, 0)
        outContext.drawImage(canvas, 0, 0)
        return out.toDataURL('image/png')
      }

      /**
       * Turn one picture into a transparent, trimmed, outlined PNG data URL.
       * @param {HTMLImageElement} image - decoded source image.
       * @param {{ removeBackground: boolean, tolerance: number }} options - cutout switches.
       * @returns {string} PNG data URL.
       */
      function cutoutFromImage(image, options) {
        const sourceWidth = image.naturalWidth || image.width
        const sourceHeight = image.naturalHeight || image.height
        const scale = Math.min(1, MAX_PROCESS_PIXELS / Math.max(sourceWidth, sourceHeight))
        const width = Math.max(1, Math.round(sourceWidth * scale))
        const height = Math.max(1, Math.round(sourceHeight * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height)

        if (options.removeBackground) {
          removeBackground(pixels.data, width, height, options.tolerance)
          keepMainSilhouette(pixels.data, width, height)
          featherAlpha(pixels.data, width, height)
        }
        context.putImageData(pixels, 0, 0)

        const box = alphaBox(pixels.data, width, height, 8)
        if (box === null) throw new Error('empty-image')

        const pad = 2
        const left = Math.max(0, box.x - pad)
        const top = Math.max(0, box.y - pad)
        const right = Math.min(width, box.x + box.width + pad)
        const bottom = Math.min(height, box.y + box.height + pad)
        const croppedWidth = right - left
        const croppedHeight = bottom - top

        const cropped = document.createElement('canvas')
        cropped.width = croppedWidth
        cropped.height = croppedHeight
        const croppedContext = cropped.getContext('2d')
        croppedContext.drawImage(canvas, left, top, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight)

        const outputWidth = Math.min(OUTPUT_WIDTH, croppedWidth)
        const outputHeight = Math.max(1, Math.round((croppedHeight * outputWidth) / croppedWidth))
        const output = document.createElement('canvas')
        output.width = outputWidth
        output.height = outputHeight
        output.getContext('2d').drawImage(cropped, 0, 0, outputWidth, outputHeight)

        return withOutline(output)
      }

      /** Read the stored anchor, ignoring anything malformed. */
      function readAnchor() {
        try {
          const raw = window.localStorage.getItem(ANCHOR_KEY)
          if (!raw) return null
          const value = JSON.parse(raw)
          if (typeof value?.rx !== 'number' || typeof value?.ry !== 'number') return null
          if (!Number.isFinite(value.rx) || !Number.isFinite(value.ry)) return null
          return {
            rx: Math.min(1, Math.max(0, value.rx)),
            ry: Math.min(1, Math.max(0, value.ry)),
          }
        } catch {
          return null
        }
      }

      /** Persist one anchor; blocked storage must not break dragging. */
      function saveAnchor(anchor) {
        try {
          window.localStorage.setItem(ANCHOR_KEY, JSON.stringify(anchor))
        } catch {
          /* the pet simply starts bottom-right next time */
        }
      }

      /** The default resting place: bottom-right corner. */
      const DEFAULT_ANCHOR = { rx: 1, ry: 1 }

      /** Height the artwork occupies at the configured width. */
      function personHeight() {
        return Math.round(PERSON_WIDTH * ART_ASPECT)
      }

      /**
       * Pixel position for one anchor inside one viewport.
       * Storing the fraction between the free edges is what keeps the pet in its
       * corner when the window grows or shrinks.
       */
      function pixelFromAnchor(anchor, viewport) {
        const freeX = Math.max(0, viewport.width - PERSON_WIDTH - 16)
        const freeY = Math.max(0, viewport.height - personHeight() - 8)
        return {
          x: Math.round(8 + anchor.rx * freeX),
          y: Math.round(64 + anchor.ry * Math.max(0, freeY - 64)),
        }
      }

      /** Anchor for one pixel position inside one viewport (inverse of the above). */
      function anchorFromPixel(pixel, viewport) {
        const freeX = Math.max(0, viewport.width - PERSON_WIDTH - 16)
        const freeY = Math.max(0, viewport.height - personHeight() - 8)
        return {
          rx: freeX === 0 ? 0 : Math.min(1, Math.max(0, (pixel.x - 8) / freeX)),
          ry: freeY <= 64 ? 0 : Math.min(1, Math.max(0, (pixel.y - 64) / (freeY - 64))),
        }
      }

      /** Prefer the primary wallet: CNY first, otherwise whatever the account has. */
      function pickWallet(wallets) {
        if (!Array.isArray(wallets) || wallets.length === 0) return null
        return wallets.find((wallet) => wallet.currency === 'CNY') ?? wallets[0]
      }

      /** Render a balance string with two decimals when it is a number. */
      function fixed(balance) {
        const value = Number(balance)
        if (!Number.isFinite(value)) return String(balance)
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }

      /** Money text with the currency symbol the account reports. */
      function money(wallet) {
        const symbol = SYMBOL[wallet.currency]
        return symbol ? `${symbol}${fixed(wallet.balance)}` : `${wallet.currency} ${fixed(wallet.balance)}`
      }

      /** Interpolate the one placeholder the dictionaries use. */
      function fill(template, values) {
        return template.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole))
      }

      /** Turn the Host answer into the small view model the bubble renders. */
      function viewOf(body, t, locale) {
        if (body && body.ok === true) {
          const main = pickWallet(body.wallets)
          const bonus = pickWallet(body.bonusWallets)
          if (main === null) return { phase: 'error', text: t('error'), note: t('retry') }
          const time = new Date(body.updatedAt ?? Date.now()).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
          })
          return {
            phase: 'ok',
            amount: money(main),
            note: bonus !== null ? fill(t('bonus'), { amount: money(bonus) }) : fill(t('updated'), { time }),
          }
        }
        if (body && body.reason === 'signed-out') return { phase: 'signed-out', text: t('signedOut') }
        return { phase: 'error', text: t('error'), note: t('retry') }
      }

      /** Sparkle positions, sizes and timings: a fixed, pleasant scatter. */
      const SPARKS = [
        { left: '12%', top: '58%', size: 4, delay: 0, duration: 6.4, color: '#ffffff' },
        { left: '78%', top: '46%', size: 3, delay: 1.6, duration: 5.6, color: '#ffe3ea' },
        { left: '68%', top: '72%', size: 5, delay: 3.1, duration: 7.2, color: '#ffffff' },
        { left: '26%', top: '34%', size: 3, delay: 4.4, duration: 6.8, color: '#ffd0dc' },
        { left: '86%', top: '62%', size: 3, delay: 2.2, duration: 6.1, color: '#ffffff' },
        { left: '46%', top: '24%', size: 2, delay: 5.2, duration: 5.9, color: '#fff3f6' },
      ]

      /**
       * Build the pet component for one activation.
       * @param {{ t: (key: string) => string, locale: object | undefined }} env - locale face.
       */
      function createPet(env) {
        const { t, locale } = env
        return function CutoutPet() {
          const [, forceRender] = React.useState(0)
          const [view, setView] = React.useState({ phase: 'loading' })
          const [anchor, setAnchor] = React.useState(() => readAnchor() ?? DEFAULT_ANCHOR)
          const [viewport, setViewport] = React.useState(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
          }))
          const [dragging, setDragging] = React.useState(false)
          const [artVersion, setArtVersion] = React.useState(0)
          const [artMissing, setArtMissing] = React.useState(false)
          const [artAttempt, setArtAttempt] = React.useState(0)
          const drag = React.useRef(null)
          const alive = React.useRef(true)
          const figure = React.useRef(null)

          React.useEffect(() => {
            if (!locale || typeof locale.subscribe !== 'function') return undefined
            return locale.subscribe(() => forceRender((value) => value + 1))
          }, [])

          const activeLocale = locale && typeof locale.getLocale === 'function' ? locale.getLocale().active : 'zh-CN'

          const load = React.useCallback(
            async (force) => {
              setView((previous) =>
                previous.phase === 'ok' || previous.phase === 'signed-out'
                  ? { ...previous, phase: 'refreshing' }
                  : previous,
              )
              try {
                const params = new URLSearchParams({ locale: activeLocale })
                if (force) params.set('refresh', '1')
                const response = await fetch(`${BALANCE_URL}?${params.toString()}`, {
                  cache: 'no-store',
                  headers: { accept: 'application/json' },
                })
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const body = await response.json()
                if (!alive.current) return
                setView(viewOf(body, t, activeLocale))
                if (typeof body.artVersion === 'number' && body.artVersion !== artVersion) {
                  setArtVersion(body.artVersion)
                  setArtMissing(false)
                  setArtAttempt(0)
                }
              } catch {
                if (!alive.current) return
                setView({ phase: 'error', text: t('error'), note: t('retry') })
              }
            },
            [activeLocale, t, artVersion],
          )

          React.useEffect(() => {
            alive.current = true
            void load(false)
            const timer = window.setInterval(() => void load(false), REFRESH_MS)
            const onVisible = () => {
              if (document.visibilityState === 'visible') void load(false)
            }
            const onArt = () => void load(true)
            document.addEventListener('visibilitychange', onVisible)
            window.addEventListener(ART_EVENT, onArt)
            return () => {
              alive.current = false
              window.clearInterval(timer)
              document.removeEventListener('visibilitychange', onVisible)
              window.removeEventListener(ART_EVENT, onArt)
            }
          }, [load])

          React.useEffect(() => {
            const onResize = () =>
              setViewport({ width: window.innerWidth, height: window.innerHeight })
            window.addEventListener('resize', onResize)
            return () => window.removeEventListener('resize', onResize)
          }, [])

          // The upload finishes a moment after the page first asks for the artwork,
          // so a failed load retries a few times before giving up.
          React.useEffect(() => {
            if (!artMissing || artAttempt >= 5) return undefined
            const timer = window.setTimeout(() => {
              setArtAttempt((value) => value + 1)
              setArtMissing(false)
            }, 4000)
            return () => window.clearTimeout(timer)
          }, [artMissing, artAttempt])

          // Lean a few pixels toward the pointer: the cheapest way to make a still
          // drawing feel like it reacts. Written as CSS variables so the animation
          // lives in the stylesheet and this never re-renders React.
          React.useEffect(() => {
            const onMove = (event) => {
              const node = figure.current
              if (node === null || drag.current !== null) return
              const rect = node.getBoundingClientRect()
              const dx = (event.clientX - (rect.left + rect.width / 2)) / window.innerWidth
              const dy = (event.clientY - (rect.top + rect.height * 0.35)) / window.innerHeight
              node.style.setProperty('--look-x', `${Math.max(-5, Math.min(5, dx * 18)).toFixed(2)}px`)
              node.style.setProperty('--look-y', `${Math.max(-3, Math.min(3, dy * 10)).toFixed(2)}px`)
            }
            window.addEventListener('pointermove', onMove)
            return () => window.removeEventListener('pointermove', onMove)
          }, [])

          const tiltTo = (degrees) => {
            const node = figure.current
            if (node === null) return
            node.style.setProperty('--drag-tilt', `${degrees.toFixed(2)}deg`)
          }

          const position = pixelFromAnchor(anchor, viewport)

          const onPointerDown = (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return
            event.preventDefault()
            drag.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              origin: position,
              moved: false,
              last: position,
            }
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }

          const onPointerMove = (event) => {
            const current = drag.current
            if (!current || current.pointerId !== event.pointerId) return
            const dx = event.clientX - current.startX
            const dy = event.clientY - current.startY
            if (!current.moved && Math.abs(dx) + Math.abs(dy) > 4) {
              current.moved = true
              setDragging(true)
            }
            if (!current.moved) return
            tiltTo(Math.max(-7, Math.min(7, dx * 0.05)))
            const pixel = {
              x: Math.min(Math.max(8, current.origin.x + dx), Math.max(8, viewport.width - PERSON_WIDTH - 8)),
              y: Math.min(Math.max(64, current.origin.y + dy), Math.max(64, viewport.height - personHeight() - 8)),
            }
            current.last = pixel
            setAnchor(anchorFromPixel(pixel, viewport))
          }

          const finishDrag = (event, refresh) => {
            const current = drag.current
            if (!current) return
            drag.current = null
            event.currentTarget.releasePointerCapture?.(current.pointerId)
            setDragging(false)
            tiltTo(0)
            if (current.moved) {
              saveAnchor(anchorFromPixel(current.last, viewport))
              return
            }
            if (refresh) void load(true)
          }

          const onKeyDown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            void load(true)
          }

          const summary =
            view.phase === 'ok'
              ? `${t('balance')} ${view.amount}`
              : view.phase === 'loading' || view.phase === 'refreshing'
                ? t('loading')
                : view.text

          const bubble =
            view.phase === 'ok'
              ? [
                  h('div', { className: 'cp-label', key: 'label' }, t('balance')),
                  h('div', { className: 'cp-value', key: 'value' }, view.amount),
                  h('div', { className: 'cp-note', key: 'note' }, view.note),
                ]
              : view.phase === 'loading' || view.phase === 'refreshing'
                ? [
                    h('div', { className: 'cp-label', key: 'label' }, t('balance')),
                    h('div', { className: 'cp-value', key: 'value' }, '…'),
                    h('div', { className: 'cp-note', key: 'note' }, t('loading')),
                  ]
                : view.phase === 'signed-out'
                  ? [
                      h('div', { className: 'cp-value cp-value--state', key: 'value' }, view.text),
                      h('div', { className: 'cp-note', key: 'note' }, t('hint')),
                    ]
                  : [
                      h('div', { className: 'cp-value cp-value--state', key: 'value' }, view.text),
                      h('div', { className: 'cp-note cp-note--error', key: 'note' }, view.note),
                    ]

          return h(
            'div',
            {
              className: 'cp-pet',
              style: { left: `${position.x}px`, top: `${position.y}px`, width: `${PERSON_WIDTH}px` },
              'data-dragging': dragging ? 'true' : 'false',
            },
            h('style', null, CSS),
            h('div', { className: 'cp-bubble', title: t('hint'), onClick: () => void load(true) }, bubble),
            h(
              'div',
              {
                ref: figure,
                className: 'cp-figure',
                role: 'button',
                tabIndex: 0,
                'aria-label': `${t('title')} · ${summary}`,
                title: t('hint'),
                onPointerDown,
                onPointerMove,
                onPointerUp: (event) => finishDrag(event, true),
                onPointerCancel: (event) => finishDrag(event, false),
                onKeyDown,
              },
              artMissing
                ? h('div', { className: 'cp-fallback' }, t('title'))
                : h(
                    'div',
                    { className: 'cp-sway' },
                    h(
                      'div',
                      { className: 'cp-breathe' },
                      h('img', {
                        className: 'cp-art',
                        src: `${ART_URL}?v=${artVersion}&r=${artAttempt}`,
                        width: PERSON_WIDTH,
                        alt: '',
                        draggable: false,
                        onError: () => setArtMissing(true),
                      }),
                    ),
                  ),
            ),
            h(
              'div',
              { className: 'cp-sparkles', 'aria-hidden': 'true' },
              SPARKS.map((spark, index) =>
                h('span', {
                  key: index,
                  className: 'cp-sparkle',
                  style: {
                    left: spark.left,
                    top: spark.top,
                    width: `${spark.size}px`,
                    height: `${spark.size}px`,
                    background: spark.color,
                    animationDelay: `${spark.delay}s`,
                    animationDuration: `${spark.duration}s`,
                  },
                }),
              ),
            ),
          )
        }
      }

      /**
       * Build the settings component: upload, cut out locally, save.
       * @param {{ t: (key: string) => string }} env - locale face.
       */
      function createSettings(env) {
        const { t } = env
        return function CutoutPetSettings() {
          const [state, setState] = React.useState({ hasCustom: false, version: 0 })
          const [tolerance, setTolerance] = React.useState(DEFAULT_TOLERANCE)
          const [removeBg, setRemoveBg] = React.useState(true)
          const [preview, setPreview] = React.useState(null)
          const [busy, setBusy] = React.useState(false)
          const [status, setStatus] = React.useState({ kind: 'idle', text: '' })
          const sourceRef = React.useRef(null)
          const fileInput = React.useRef(null)
          const alive = React.useRef(true)

          React.useEffect(() => {
            alive.current = true
            fetch(STATE_URL, { cache: 'no-store', headers: { accept: 'application/json' } })
              .then((response) => response.json())
              .then((value) => {
                if (alive.current && value && value.ok) setState(value)
              })
              .catch(() => undefined)
            return () => {
              alive.current = false
              const source = sourceRef.current
              if (source && source.url) URL.revokeObjectURL(source.url)
            }
          }, [])

          const runCutout = React.useCallback(
            async (source, options) => {
              setBusy(true)
              setStatus({ kind: 'idle', text: t('processing') })
              try {
                // Yield once so the busy state paints before the pixel work.
                await new Promise((resolve) => window.setTimeout(resolve, 16))
                const dataUrl = cutoutFromImage(source.image, options)
                if (!alive.current) return
                setPreview(dataUrl)
                setBusy(false)
                setStatus({ kind: 'ok', text: t('ready') })
              } catch (error) {
                if (!alive.current) return
                setBusy(false)
                setPreview(null)
                setStatus({
                  kind: 'error',
                  text: fill(t('failed'), { message: error instanceof Error ? error.message : String(error) }),
                })
              }
            },
            [],
          )

          const onFile = async (event) => {
            const file = event.target.files && event.target.files[0]
            event.target.value = ''
            if (!file) return
            setStatus({ kind: 'idle', text: t('processing') })
            try {
              const previous = sourceRef.current
              if (previous && previous.url) URL.revokeObjectURL(previous.url)
              const source = await loadImageFile(file)
              sourceRef.current = source
              await runCutout(source, { removeBackground: removeBg, tolerance })
            } catch {
              sourceRef.current = null
              setStatus({ kind: 'error', text: t('unsupported') })
            }
          }

          React.useEffect(() => {
            const source = sourceRef.current
            if (source === null) return undefined
            const timer = window.setTimeout(() => {
              void runCutout(source, { removeBackground: removeBg, tolerance })
            }, 180)
            return () => window.clearTimeout(timer)
          }, [tolerance, removeBg, runCutout])

          const save = async () => {
            if (preview === null) return
            setBusy(true)
            setStatus({ kind: 'idle', text: t('saving') })
            try {
              const response = await fetch(UPLOAD_URL, {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ png: preview }),
              })
              const value = await response.json()
              if (!response.ok || !value.ok) throw new Error(value.message || `HTTP ${response.status}`)
              if (!alive.current) return
              setState(value)
              setBusy(false)
              setStatus({ kind: 'ok', text: t('saved') })
              window.dispatchEvent(new CustomEvent(ART_EVENT, { detail: { version: value.version } }))
            } catch (error) {
              if (!alive.current) return
              setBusy(false)
              setStatus({
                kind: 'error',
                text: fill(t('failed'), { message: error instanceof Error ? error.message : String(error) }),
              })
            }
          }

          const reset = async () => {
            setBusy(true)
            try {
              const response = await fetch(UPLOAD_URL, { method: 'DELETE', headers: { accept: 'application/json' } })
              const value = await response.json()
              if (!alive.current) return
              setState(value)
              setPreview(null)
              const source = sourceRef.current
              if (source && source.url) URL.revokeObjectURL(source.url)
              sourceRef.current = null
              setBusy(false)
              setStatus({ kind: 'ok', text: t('resetDone') })
              window.dispatchEvent(new CustomEvent(ART_EVENT, { detail: { version: value.version } }))
            } catch {
              if (!alive.current) return
              setBusy(false)
              setStatus({ kind: 'error', text: t('error') })
            }
          }

          const shown = preview !== null ? preview : `${ART_URL}?v=${state.version}`

          return h(
            'div',
            { className: 'cp-section' },
            h('style', null, CSS),
            h(
              'div',
              { className: 'cp-head' },
              h('h2', null, t('settingsTitle')),
              h('p', null, t('settingsLead')),
            ),
            h(
              'div',
              { className: 'cp-art-row' },
              h(
                'div',
                null,
                h('div', { className: 'cp-preview' }, h('img', { src: shown, alt: t('previewTitle') })),
                h('div', { className: 'cp-preview-note' }, t('previewTitle')),
              ),
              h(
                'div',
                { className: 'cp-controls' },
                h(
                  'div',
                  { className: 'cp-row' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'cp-btn cp-btn--primary',
                      onClick: () => fileInput.current && fileInput.current.click(),
                    },
                    preview === null ? t('upload') : t('replace'),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'cp-btn', disabled: preview === null || busy, onClick: () => void save() },
                    t('save'),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'cp-btn', disabled: busy || !state.hasCustom, onClick: () => void reset() },
                    t('reset'),
                  ),
                ),
                h('input', {
                  ref: fileInput,
                  type: 'file',
                  accept: 'image/*',
                  style: { display: 'none' },
                  onChange: (event) => void onFile(event),
                }),
                h(
                  'label',
                  { className: 'cp-check' },
                  h('input', {
                    type: 'checkbox',
                    checked: removeBg,
                    onChange: (event) => setRemoveBg(event.target.checked),
                  }),
                  t('removeBackground'),
                ),
                h(
                  'div',
                  { className: 'cp-field' },
                  h(
                    'div',
                    { className: 'cp-field-label' },
                    `${t('tolerance')} · ${tolerance}`,
                  ),
                  h('input', {
                    type: 'range',
                    min: 8,
                    max: 140,
                    step: 2,
                    value: tolerance,
                    disabled: !removeBg,
                    onChange: (event) => setTolerance(Number(event.target.value)),
                  }),
                  h('div', { className: 'cp-preview-note' }, t('toleranceHint')),
                ),
                h('div', { className: `cp-status${status.kind === 'error' ? ' cp-status--error' : status.kind === 'ok' ? ' cp-status--ok' : ''}` }, status.text),
                h('p', null, t('hintPhoto')),
                h('p', null, state.hasCustom ? t('customArt') : t('defaultArt')),
              ),
            ),
            h('hr', { className: 'cp-divider' }),
          )
        }
      }

      return {
        inject: ['slots'],
        // Test seams: the package's smoke test drives the pixel pipeline directly.
        __cutout: cutoutFromImage,
        __internals: { removeBackground, keepMainSilhouette, featherAlpha, alphaBox, dilateMask },
        apply(ctx) {
          const locale = ctx.get('locale')

          if (locale && typeof locale.register === 'function') {
            ctx.effect(() => {
              const disposers = [
                locale.register(NAMESPACE, 'zh', DICT.zh),
                locale.register(NAMESPACE, 'en', DICT.en),
              ]
              return () => disposers.forEach((dispose) => dispose())
            })
          }

          const translate =
            locale && typeof locale.bind === 'function'
              ? locale.bind(NAMESPACE)
              : (key) => DICT.zh[key] ?? key

          const Pet = createPet({ t: translate, locale })
          const Settings = createSettings({ t: translate })

          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register(
              { name: 'shell.overlay', id: 'cutout-pet', order: 60, label: () => translate('title') },
              Pet,
            ),
          )

          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              { name: 'settings.section', id: 'cutout-pet', order: 35, label: () => translate('settingsLabel') },
              Settings,
            ),
          )
        },
      }
    },
  })
})()
