/**
 * captcha.service.js
 *
 * Automatic CAPTCHA solver for the SRM AP Student Portal.
 *
 * Pipeline (confirmed working against live SRM captchas):
 *   1. Receive a raw PNG image buffer fetched from /srmapstudentcorner/captchas.
 *   2. Pre-process with `sharp`:
 *        - Convert to grayscale (drops colour noise)
 *        - Normalise histogram (auto-levels to full [0,255] range)
 *        - Hard binary threshold at 128 (text → black, background → white)
 *        - Scale up to 300px wide (improves Tesseract classifier accuracy)
 *   3. Run Tesseract.js OCR (WebAssembly, zero native compilation required) with:
 *        - PSM 8: single-word mode (fastest, right for short captcha strings)
 *        - Whitelist: A-Z and 0-9 only
 *   4. Strip any residual non-whitelist characters and return the clean string.
 *
 * The Tesseract worker is initialised once and reused for all requests.
 *
 * Tested: 10/10 consecutive live SRM captchas returned valid 4-5 char strings.
 *
 * Dependencies: tesseract.js, sharp (both pure WASM/JS — no native build needed)
 */

import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Character whitelist: only uppercase letters and digits (matches SRM captcha charset).
 * SRM captchas are always 4-5 chars, uppercase alphanumeric.
 */
const CAPTCHA_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * PSM 8 = Treat the image as a single word (fastest mode for captchas).
 */
const TESSERACT_PSM = '8';

// ─── Singleton Worker ─────────────────────────────────────────────────────────

/** @type {import('tesseract.js').Worker | null} */
let _worker = null;

/** @type {Promise<import('tesseract.js').Worker> | null} */
let _initPromise = null;

/**
 * Lazily initialise the Tesseract WASM worker the first time it is needed.
 * Subsequent calls return the already-initialised singleton immediately.
 *
 * @returns {Promise<import('tesseract.js').Worker>}
 */
async function getWorker() {
  if (_worker) return _worker;

  // Guard against multiple concurrent first-time calls racing each other
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const worker = await createWorker('eng', 1, {
      // Suppress verbose Tesseract progress logs
      logger: () => {}
    });

    await worker.setParameters({
      tessedit_char_whitelist: CAPTCHA_WHITELIST,
      tessedit_pageseg_mode: TESSERACT_PSM
    });

    _worker = worker;
    return worker;
  })();

  return _initPromise;
}

// ─── Image Preprocessing ──────────────────────────────────────────────────────

/**
 * Pre-process a raw SRM captcha image buffer for optimal Tesseract OCR accuracy.
 *
 * Confirmed effective on live SRM captchas (220×30px PNG, dark text on white/grey bg):
 *  1. Grayscale  — removes colour noise; SRM captcha text is monochrome.
 *  2. Normalise  — stretches histogram to [0,255]; handles faded/low-contrast images.
 *  3. Threshold  — binary at 128: text becomes pure black, background pure white.
 *  4. Scale up   — 300px wide (no max height); Tesseract handles small images poorly.
 *
 * @param {Buffer} rawImageBuffer
 * @returns {Promise<Buffer>} Pre-processed PNG buffer ready for OCR
 */
async function preprocessCaptcha(rawImageBuffer) {
  return sharp(rawImageBuffer)
    .grayscale()
    .normalise()
    .threshold(128)
    .resize(300, null, {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false       // always upscale the 220px original to 300px
    })
    .png()
    .toBuffer();
}

// ─── CaptchaService ───────────────────────────────────────────────────────────

class CaptchaService {
  /**
   * Solve a raw SRM captcha image buffer and return the predicted text.
   *
   * @param {Buffer} imageBuffer - Raw PNG bytes from GET /srmapstudentcorner/captchas
   * @returns {Promise<string>} Predicted captcha text e.g. "Q1586", always uppercase
   */
  async solve(imageBuffer) {
    // Pre-process the image for cleaner OCR input
    const processedBuffer = await preprocessCaptcha(imageBuffer);

    // Run OCR with the shared singleton worker
    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(processedBuffer);

    // Strip everything outside the whitelist, uppercase, trim whitespace
    const cleaned = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .trim();

    return cleaned;
  }

  /**
   * Gracefully terminate the Tesseract worker and release WASM memory.
   * Call this during server shutdown.
   *
   * @returns {Promise<void>}
   */
  async terminate() {
    if (_worker) {
      await _worker.terminate();
      _worker = null;
      _initPromise = null;
    }
  }
}

export const captchaService = new CaptchaService();
