/**
 * Host half of Cutout Pet.
 *
 * It owns what the page cannot do on its own: keeping the uploaded portrait,
 * answering the signed-in account's wallet balance, and handing both back as
 * two same-origin routes. No credential ever reaches the page.
 *
 * @module dsh-cutout-pet
 */

import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name. */
export const name = 'dsh-cutout-pet'

/** Both halves need the HTTP carrier; a missing one keeps this row pending. */
export const inject = ['webServer']

/** One URL prefix owns every route, so one disposer removes everything. */
const PREFIX = '/.dsh-pet'
const BALANCE_PATH = `${PREFIX}/balance`
const ART_PATH = `${PREFIX}/art.png`
const UPLOAD_PATH = `${PREFIX}/art`
const STATE_PATH = `${PREFIX}/state`

/** How long one balance answer is reused before the account is asked again. */
const CACHE_MS = 60_000

/** Uploaded artwork limits: a sticker, not a photo library. */
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024
const MAX_REQUEST_BYTES = 4 * 1024 * 1024
const MIN_ART_SIDE = 32
const MAX_ART_SIDE = 2048

const HERE = dirname(fileURLToPath(import.meta.url))

/** Uploaded art lives beside the session data, not inside the package. */
const DATA_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugin-data', 'dsh-cutout-pet')
const ART_FILE = join(DATA_DIR, 'art.png')

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Cached bundled fallback: the file never changes while the plugin is loaded. */
let fallbackArtwork

/** Cached account answer shared by every page watching the pet. */
let cachedAt = 0
let cachedValue

/**
 * Send one JSON body without letting a page or proxy reuse a stale copy.
 * @param {import('node:http').ServerResponse} res - response to complete.
 * @param {number} status - HTTP status code.
 * @param {unknown} value - JSON-serialisable body.
 */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/**
 * Read a bounded JSON request body.
 * @param {import('node:http').IncomingMessage} req - incoming request.
 * @param {number} limit - maximum accepted bytes.
 * @returns {Promise<any>} parsed body.
 */
async function readJsonBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      const error = new Error('request body too large')
      error.code = 'too-large'
      throw error
    }
    chunks.push(chunk)
  }
  if (size === 0) {
    const error = new Error('empty request body')
    error.code = 'empty'
    throw error
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('request body is not JSON')
    error.code = 'malformed'
    throw error
  }
}

/**
 * Read the bundled fallback artwork once, then serve it from memory.
 * @returns {Promise<Buffer>} PNG bytes.
 */
async function readFallback() {
  if (fallbackArtwork === undefined) fallbackArtwork = await readFile(join(HERE, 'assets', 'default.png'))
  return fallbackArtwork
}

/**
 * Current custom artwork, if one was uploaded.
 * @returns {Promise<{ bytes: Buffer, version: number } | null>} stored art or null.
 */
async function readCustomArt() {
  try {
    const [bytes, info] = await Promise.all([readFile(ART_FILE), stat(ART_FILE)])
    return { bytes, version: Math.round(info.mtimeMs) }
  } catch {
    return null
  }
}

/**
 * Snapshot of what the pet should draw right now.
 * @returns {Promise<{ ok: true, hasCustom: boolean, version: number }>} state.
 */
async function artState() {
  const custom = await readCustomArt()
  return { ok: true, hasCustom: custom !== null, version: custom === null ? 0 : custom.version }
}

/**
 * Describe the calling page to the account service.
 * @param {URL} url - request URL carrying the page locale.
 * @returns {{ version: string, locale: string, timezoneOffsetSeconds: number }}
 */
function accountClient(url) {
  const locale = url.searchParams.get('locale') || 'zh-CN'
  return {
    version: '1.0.0',
    locale,
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
}

/**
 * Normalise one wallet list into the shape the page renders.
 * @param {readonly { currency: string, balance: string }[]} wallets - account wallets.
 * @returns {{ currency: string, balance: string }[]} plain JSON wallets.
 */
function plainWallets(wallets) {
  if (!Array.isArray(wallets)) return []
  return wallets
    .filter((wallet) => wallet && typeof wallet.currency === 'string' && typeof wallet.balance === 'string')
    .map((wallet) => ({ currency: wallet.currency, balance: wallet.balance }))
}

/**
 * Ask the signed-in account for its balances, reusing a recent answer.
 *
 * A missing service or a signed-out account is a state the page shows as text,
 * not an error: only a throw inside the account service becomes `error`.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context holding services.
 * @param {URL} url - request URL, used for the client metadata.
 * @param {boolean} force - bypass the cache for a user-triggered refresh.
 * @returns {Promise<object>} JSON answer for the page.
 */
async function balanceAnswer(ctx, url, force) {
  const fresh = force || Date.now() - cachedAt > CACHE_MS
  if (!fresh && cachedValue !== undefined) return cachedValue

  const account = ctx.get('deepseekAccount')
  if (account === undefined) {
    cachedValue = { ok: false, reason: 'unavailable', message: 'deepseekAccount service is not composed in this profile' }
    cachedAt = Date.now()
    return cachedValue
  }

  try {
    const balance = await account.getBalance(accountClient(url))
    if (balance === null) {
      const state = await account.getState().catch(() => undefined)
      cachedValue = state?.status === 'signed-out'
        ? { ok: false, reason: 'signed-out' }
        : { ok: false, reason: 'unavailable' }
      cachedAt = Date.now()
      return cachedValue
    }
    if (balance.status === 'failed') {
      cachedValue = { ok: false, reason: 'failed' }
      cachedAt = Date.now()
      return cachedValue
    }
    cachedValue = {
      ok: true,
      wallets: plainWallets(balance.value),
      bonusWallets: plainWallets(balance.bonusWallets),
      updatedAt: Date.now(),
    }
    cachedAt = Date.now()
    return cachedValue
  } catch (error) {
    // Never cache a transport failure: the next poll should try again.
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Decode and validate one uploaded data URL.
 * @param {unknown} input - request body.
 * @returns {Buffer} PNG bytes.
 */
function decodeUpload(input) {
  const dataUrl = typeof input?.png === 'string' ? input.png : ''
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (match === null) {
    const error = new Error('png must be a base64 image/png data URL')
    error.code = 'malformed'
    throw error
  }
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.length < 64 || bytes.length > MAX_UPLOAD_BYTES) {
    const error = new Error(`png must be between 64 bytes and ${MAX_UPLOAD_BYTES} bytes`)
    error.code = 'size'
    throw error
  }
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const error = new Error('png signature missing')
    error.code = 'malformed'
    throw error
  }
  // IHDR follows the signature: width and height are big-endian 32-bit values.
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width < MIN_ART_SIDE || height < MIN_ART_SIDE || width > MAX_ART_SIDE || height > MAX_ART_SIDE) {
    const error = new Error(`png sides must be between ${MIN_ART_SIDE} and ${MAX_ART_SIDE} pixels`)
    error.code = 'size'
    throw error
  }
  return bytes
}

/**
 * Answer one request under the plugin's prefix.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {import('node:http').IncomingMessage} req - incoming request.
 * @param {import('node:http').ServerResponse} res - response to complete.
 */
async function handle(ctx, req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const route = url.pathname
  try {
    if (route === BALANCE_PATH) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, reason: 'method' })
      const answer = await balanceAnswer(ctx, url, url.searchParams.get('refresh') === '1')
      const state = await artState()
      return sendJson(res, 200, { ...answer, artVersion: state.version, hasCustom: state.hasCustom })
    }

    if (route === STATE_PATH) {
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
      return sendJson(res, 200, await artState())
    }

    if (route === ART_PATH) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, reason: 'method' })
      const custom = await readCustomArt()
      const bytes = custom === null ? await readFallback() : custom.bytes
      const etag = `W/"${custom === null ? 'default' : custom.version}-${bytes.length}"`
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { etag, 'cache-control': 'no-cache' })
        return res.end()
      }
      res.writeHead(200, {
        'content-type': 'image/png',
        'cache-control': 'no-cache',
        etag,
        'content-length': bytes.length,
      })
      return res.end(req.method === 'HEAD' ? undefined : bytes)
    }

    if (route === UPLOAD_PATH) {
      if (req.method === 'POST') {
        const body = await readJsonBody(req, MAX_REQUEST_BYTES)
        const bytes = decodeUpload(body)
        await mkdir(DATA_DIR, { recursive: true })
        const temporary = `${ART_FILE}.tmp`
        await writeFile(temporary, bytes)
        await rename(temporary, ART_FILE)
        return sendJson(res, 200, await artState())
      }
      if (req.method === 'DELETE') {
        await unlink(ART_FILE).catch(() => undefined)
        return sendJson(res, 200, await artState())
      }
      return sendJson(res, 405, { ok: false, reason: 'method' })
    }

    return sendJson(res, 404, { ok: false, reason: 'not-found' })
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'error'
    const status = code === 'too-large' ? 413 : code === 'size' || code === 'malformed' ? 400 : 500
    return sendJson(res, status, {
      ok: false,
      reason: code,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Mount the routes the pet page and its settings page need.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 */
export function apply(ctx) {
  ctx.effect(() => {
    const remove = ctx.webServer.register({
      kind: 'prefix',
      path: PREFIX,
      handler: (req, res) => handle(ctx, req, res),
    })
    return () => remove()
  })
}
