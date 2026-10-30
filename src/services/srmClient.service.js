import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { config } from '../config/env.js';
import { srmSessionService } from './srmSession.service.js';
import { SrmServiceError, SrmSessionExpiredError } from '../utils/errors.js';

/**
 * Centralized SRM HTTP Client.
 * Manages HTTP communication with the SRM University-AP student portal
 * while ensuring complete per-user session isolation.
 */
class SrmClientService {
  /**
   * Create an Axios instance bound to the user's isolated CookieJar.
   *
   * @param {string} srmSessionKey
   * @returns {import('axios').AxiosInstance}
   */
  getClient(srmSessionKey) {
    const session = srmSessionService.getSession(srmSessionKey);
    if (!session) {
      throw new SrmSessionExpiredError('No active SRM session found. Please log in.');
    }

    const client = wrapper(
      axios.create({
        baseURL: config.srmBaseUrl,
        timeout: config.srmRequestTimeoutMs,
        jar: session.jar,
        withCredentials: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `${config.srmBaseUrl}/`
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      })
    );

    return client;
  }

  /**
   * Inspect HTML response to check if SRM has invalidated the session
   * and redirected to the login page.
   *
   * @param {string} html
   */
  assertNotSessionExpired(html) {
    if (typeof html !== 'string') return;
    const isLoginScreen =
      html.includes('StudentLoginToPortal') ||
      html.includes('id="frmSL"') ||
      html.includes('Portal for Freshers and Senior Students') ||
      html.toLowerCase().includes('session expired');

    if (isLoginScreen) {
      throw new SrmSessionExpiredError('Your SRM session has expired or is invalid. Please sign in again.');
    }
  }

  /**
   * Request a report resource (Profile, Timetable, Attendance, or Marks).
   * Confirmed SRM endpoint: POST /students/report/studentreportresources.jsp
   *
   * @param {string} srmSessionKey
   * @param {string|number} ids - 1: Profile, 10: Timetable, 3: Attendance, 5: Internal Marks
   * @returns {Promise<string>} Raw HTML string from SRM
   */
  async postReport(srmSessionKey, ids) {
    const client = this.getClient(srmSessionKey);
    const body = new URLSearchParams({ ids: String(ids) }).toString();

    try {
      const response = await client.post('/students/report/studentreportresources.jsp', body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        responseType: 'text'
      });

      this.assertNotSessionExpired(response.data);
      return response.data;
    } catch (err) {
      if (err instanceof SrmSessionExpiredError) throw err;
      if (err.response?.status === 302 && err.response?.headers?.location?.includes('login')) {
        throw new SrmSessionExpiredError();
      }
      throw new SrmServiceError(`SRM report request (ids=${ids}) failed: ${err.message}`);
    }
  }

  /**
   * Fetch the Mark Attendance page to read current status and dynamic tokens.
   * Confirmed SRM endpoint: POST /students/transaction/studentattendance.jsp
   *
   * @param {string} srmSessionKey
   * @param {string} studentId
   * @returns {Promise<string>}
   */
  async getAttendancePage(srmSessionKey, studentId) {
    const client = this.getClient(srmSessionKey);
    const body = new URLSearchParams({
      ids: '33',
      stuId: String(studentId || '')
    }).toString();

    try {
      const response = await client.post('/students/transaction/studentattendance.jsp', body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        responseType: 'text'
      });

      this.assertNotSessionExpired(response.data);
      return response.data;
    } catch (err) {
      if (err instanceof SrmSessionExpiredError) throw err;
      throw new SrmServiceError(`SRM attendance page request failed: ${err.message}`);
    }
  }

  /**
   * Submit an attendance code entered by the student.
   * Confirmed SRM endpoint: POST /students/transaction/studentattendanceresources.jsp
   *
   * @param {string} srmSessionKey
   * @param {object} params
   * @param {string} params.acode
   * @param {string} [params.dynamiclatdata]
   * @param {string} [params.dynamiclonxdata]
   * @returns {Promise<{ resultstatus: string, result: string }>}
   */
  async submitAttendanceCode(srmSessionKey, { acode, dynamiclatdata = '', dynamiclonxdata = '' }) {
    const client = this.getClient(srmSessionKey);
    const body = new URLSearchParams({
      ids: '1',
      acode: String(acode || '').trim().toUpperCase(),
      dynamiclatdata: String(dynamiclatdata || ''),
      dynamiclonxdata: String(dynamiclonxdata || '')
    }).toString();

    try {
      const response = await client.post('/students/transaction/studentattendanceresources.jsp', body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
      });

      let json = response.data;
      if (typeof json === 'string') {
        try {
          json = JSON.parse(json);
        } catch {
          // If response was not valid JSON, check if it's an HTML error/session timeout
          this.assertNotSessionExpired(json);
          throw new SrmServiceError('SRM attendance submission returned an unparseable response.');
        }
      }

      return json;
    } catch (err) {
      if (err instanceof SrmSessionExpiredError) throw err;
      throw new SrmServiceError(`SRM attendance submission failed: ${err.message}`);
    }
  }

  /**
   * Fetch the CAPTCHA image from SRM as a raw binary buffer.
   *
   * The SRM portal serves a fresh CAPTCHA image at:
   *   GET /srmapstudentcorner/captchas   (absolute path on the server)
   *
   * The image is tied to the user's JSESSIONID cookie, so the flow is:
   *   1. GET /  (or /srmapstudentcorner/) to seed the JSESSIONID cookie
   *   2. GET /srmapstudentcorner/captchas using that same cookie jar
   *
   * The JSESSIONID set in step 1 MUST be the same one sent with the
   * subsequent login POST so SRM can validate the captcha code against it.
   *
   * @param {string} srmSessionKey
   * @returns {Promise<Buffer>} Raw image bytes (JPEG/PNG)
   */
  async fetchCaptchaImage(srmSessionKey) {
    const client = this.getClient(srmSessionKey);

    try {
      // Step 1: GET the login page root to seed a fresh JSESSIONID cookie.
      // The SRM portal sets JSESSIONID on the very first GET request.
      // We use '/' which maps to the login page without triggering a 405.
      await client.get('/', {
        responseType: 'text',
        maxRedirects: 5
      });

      // Step 2: Fetch the captcha image using the seeded session cookie.
      // The path is absolute: /srmapstudentcorner/captchas
      // Since our baseURL is already https://student.srmap.edu.in/srmapstudentcorner
      // we request '/captchas' (relative to baseURL).
      const response = await client.get('/captchas', {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (err) {
      throw new SrmServiceError(`Failed to fetch SRM captcha image: ${err.message}`);
    }
  }

  /**
   * Attempt portal authentication via SRM StudentLoginToPortal endpoint.
   *
   * SRM login behaviour (confirmed via live testing):
   *  - On SUCCESS: HTTP 200 response whose HTML is the student home/dashboard page.
   *    The login page markers (id="frmSL", "Portal for Freshers") are absent.
   *  - On FAILURE: HTTP 200 response that re-renders the login page.
   *    The error text is injected into id="divmsg".
   *
   * SRM does NOT issue a bare 302 redirect to the axios client — any redirect
   * is followed automatically by axios (maxRedirects: 5) resulting in a final 200.
   *
   * Success detection: the response HTML must NOT contain the login page sentinel
   * string 'id="frmSL"' (the login form ID present on every error / login page).
   *
   * @param {string} srmSessionKey
   * @param {object} credentials
   * @param {string} credentials.username
   * @param {string} credentials.password
   * @param {string} [credentials.captcha]
   * @returns {Promise<{ success: boolean, message?: string }>}
   */
  async postLogin(srmSessionKey, { username, password, captcha = '' }) {
    const client = this.getClient(srmSessionKey);

    const body = new URLSearchParams({
      txtUserName: username,
      txtAuthKey: password,
      ccode: captcha || ''
    }).toString();

    try {
      const response = await client.post('/StudentLoginToPortal', body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        // Follow redirects — SRM redirects internally and the final page is always 200
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 500
      });

      const html = typeof response.data === 'string' ? response.data : '';

      // ── Success detection ──────────────────────────────────────────────────
      // The login page always contains id="frmSL" (the login form).
      // The student home/dashboard page does NOT contain this form.
      // If it's gone, we've been redirected to the authenticated student area.
      const isLoginPage = html.includes('id="frmSL"') ||
                          html.includes("id='frmSL'") ||
                          html.includes('Portal for Freshers');

      if (!isLoginPage && html.length > 500) {
        // We landed on a page that is NOT the login form → success
        return { success: true };
      }

      // ── Failure detection ──────────────────────────────────────────────────
      // SRM injects the error into id="divmsg" on every failure type.
      const divmsgMatch = html.match(/id=["']divmsg["'][^>]*>([\s\S]*?)<\/div>/i);
      const rawError = divmsgMatch
        ? divmsgMatch[1].replace(/<[^>]+>/g, '').trim()
        : '';

      if (rawError) {
        return { success: false, message: rawError };
      }

      // Fallback: divmsg was empty but the login page was still rendered
      return { success: false, message: 'Invalid credentials or captcha. Please try again.' };
    } catch (err) {
      throw new SrmServiceError(`SRM login request failed: ${err.message}`);
    }
  }
}

export const srmClientService = new SrmClientService();

