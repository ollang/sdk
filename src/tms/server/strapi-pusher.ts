import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

const STRAPI_LOCALE_MAP: Record<string, string> = {
  af: 'af-ZA',
  ak: 'ak-GH',
  sq: 'sq-AL',
  am: 'am-ET',
  ar: 'ar-SA',
  hy: 'hy-AM',
  as: 'as-IN',
  az: 'az-Latn-AZ',
  bm: 'bm-ML',
  eu: 'eu-ES',
  be: 'be-BY',
  bn: 'bn-BD',
  bs: 'bs-BA',
  br: 'br-FR',
  bg: 'bg-BG',
  my: 'my-MM',
  ca: 'ca-ES',
  zh: 'zh-Hans-CN',
  hr: 'hr-HR',
  cs: 'cs-CZ',
  da: 'da-DK',
  nl: 'nl-NL',
  en: 'en-US',
  eo: 'eo',
  et: 'et-EE',
  ee: 'ee-GH',
  fil: 'fil-PH',
  fi: 'fi-FI',
  fr: 'fr-FR',
  gl: 'gl-ES',
  ka: 'ka-GE',
  de: 'de-DE',
  el: 'el-GR',
  gu: 'gu-IN',
  ha: 'ha-Latn-NG',
  haw: 'haw-US',
  he: 'he-IL',
  hi: 'hi-IN',
  hu: 'hu-HU',
  is: 'is-IS',
  ig: 'ig-NG',
  id: 'id-ID',
  ga: 'ga-IE',
  it: 'it-IT',
  ja: 'ja-JP',
  kn: 'kn-IN',
  kk: 'kk-Cyrl-KZ',
  km: 'km-KH',
  rw: 'rw-RW',
  ko: 'ko',
  ky: 'ky',
  lo: 'lo',
  lv: 'lv-LV',
  ln: 'ln-CD',
  lt: 'lt-LT',
  mk: 'mk-MK',
  mg: 'mg-MG',
  ms: 'ms-MY',
  ml: 'ml-IN',
  mt: 'mt-MT',
  mr: 'mr-IN',
  mn: 'mn',
  ne: 'ne-NP',
  nb: 'nb-NO',
  nn: 'nn-NO',
  or: 'or-IN',
  om: 'om-ET',
  ps: 'ps-AF',
  fa: 'fa-IR',
  pl: 'pl-PL',
  pt: 'pt-PT',
  pa: 'pa-Guru-IN',
  ro: 'ro-RO',
  ru: 'ru-RU',
  sg: 'sg-CF',
  sr: 'sr-Cyrl-RS',
  sn: 'sn-ZW',
  si: 'si-LK',
  sk: 'sk-SK',
  sl: 'sl-SI',
  so: 'so-SO',
  es: 'es-ES',
  sw: 'sw-KE',
  sv: 'sv-SE',
  tg: 'tg',
  ta: 'ta-IN',
  te: 'te-IN',
  th: 'th-TH',
  ti: 'ti-ET',
  to: 'to-TO',
  tr: 'tr-TR',
  tk: 'tk',
  uk: 'uk-UA',
  ur: 'ur-PK',
  uz: 'uz-Latn-UZ',
  vi: 'vi-VN',
  cy: 'cy-GB',
  yo: 'yo-NG',
  zu: 'zu-ZA',
};

function normalizeLocaleForStrapi(targetLocale: string): string {
  if (targetLocale.includes('-')) return targetLocale;
  return STRAPI_LOCALE_MAP[targetLocale] || targetLocale;
}

function formatStrapiHttpError(error: any): string {
  const status = error?.response?.status;
  const statusSuffix = typeof status === 'number' ? ` (HTTP ${status})` : '';
  const base = error?.message && !error?.response ? error.message : '';
  const data = error?.response?.data;

  if (typeof data === 'string') {
    const text = data
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 800);
    return (text || 'Strapi response body (non-JSON)') + statusSuffix;
  }

  const err = data?.error;
  if (!err) {
    if (data && typeof data === 'object') {
      try {
        const s = JSON.stringify(data);
        if (s && s !== '{}') return s.slice(0, 1200) + statusSuffix;
      } catch {
        // ignore
      }
    }
    return (base || error?.message || 'Unknown error') + statusSuffix;
  }
  let msg = err.message || err.name || 'Strapi error';
  const details = err.details;
  if (details?.errors && Array.isArray(details.errors)) {
    const parts = details.errors.map((e: any) => {
      const path = Array.isArray(e.path) ? e.path.join('.') : e.path || '';
      const piece = e.message || e.name || JSON.stringify(e);
      return path ? `${path}: ${piece}` : piece;
    });
    if (parts.length) msg = `${msg} — ${parts.join('; ')}`;
  } else if (typeof details === 'string') {
    msg = `${msg} — ${details}`;
  } else if (details && typeof details === 'object') {
    try {
      const compact = JSON.stringify(details);
      if (compact !== '{}') msg = `${msg} — ${compact}`;
    } catch {
      // ignore
    }
  }
  return msg + statusSuffix;
}

export interface StrapiPusherConfig {
  strapiUrl: string;
  strapiToken: string;
}

export interface StrapiTranslationItem {
  contentType: string;
  entryId: number;
  field: string;
  translatedText: string;
  route?: string;
}

export interface StrapiPushResult {
  success: boolean;
  contentType: string;
  entryId: number;
  field: string;
  error?: string;
}

export class StrapiPusher {
  private client: AxiosInstance;
  private config: StrapiPusherConfig;
  private readonly strapiApiRoot: string;

  constructor(config: StrapiPusherConfig) {
    this.config = config;
    const apiBase = config.strapiUrl.replace(/\/$/, '');
    this.strapiApiRoot = `${apiBase}/api`;

    this.client = axios.create({
      baseURL: this.strapiApiRoot,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.strapiToken}`,
      },
      timeout: 30000,
    });
  }

  private isLikelyStrapiMediaField(fieldPath: string): boolean {
    const leaf = fieldPath.split('.').pop() || fieldPath;
    return /image|media|cover|thumb|photo|picture|banner|logo|icon|avatar|poster|topimage|featured|hero|ogimage|asset/i.test(
      leaf
    );
  }

  private isLikelyRemoteImageUrl(url: string): boolean {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return false;
    if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(u)) return true;
    if (/\/translated-images\//i.test(u)) return true;
    return false;
  }

  private shouldUploadTranslatedImageToStrapiMedia(fieldPath: string, value: string): boolean {
    return this.isLikelyStrapiMediaField(fieldPath) && this.isLikelyRemoteImageUrl(value);
  }

  private filenameFromUrl(url: string): string {
    try {
      const path = new URL(url).pathname;
      const base = path.split('/').pop() || 'image';
      if (base.includes('.')) return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
    } catch {
      // ignore
    }
    return `translated-image-${Date.now()}.png`;
  }

  private mimeFromFilename(name: string): string {
    const ext = (name.split('.').pop() || '').toLowerCase().replace(/\?.*$/, '');
    const map: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      avif: 'image/avif',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
    };
    return map[ext] || 'application/octet-stream';
  }

  /** When CDN returns application/octet-stream, infer real image mime from magic bytes. */
  private sniffImageMimeFromBuffer(buf: Buffer): string | null {
    if (buf.length < 12) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
      return 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    const g = buf.toString('ascii', 0, 6);
    if (g === 'GIF87a' || g === 'GIF89a') return 'image/gif';
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
    return null;
  }

  private isGenericBinaryContentType(ct: string): boolean {
    const x = ct.split(';')[0].trim().toLowerCase();
    return (
      x === '' ||
      x === 'application/octet-stream' ||
      x === 'binary/octet-stream' ||
      x === 'application/x-download'
    );
  }

  private resolveMimeForImageUpload(
    headerContentType: string | undefined,
    filename: string,
    buffer: Buffer
  ): string {
    const rawHeader =
      typeof headerContentType === 'string' ? headerContentType.split(';')[0].trim() : '';
    const fromSniff = this.sniffImageMimeFromBuffer(buffer);
    const fromName = this.mimeFromFilename(filename);

    if (rawHeader && !this.isGenericBinaryContentType(rawHeader) && /^image\//i.test(rawHeader)) {
      return rawHeader;
    }
    if (fromSniff) return fromSniff;
    if (fromName.startsWith('image/')) return fromName;
    if (rawHeader && !this.isGenericBinaryContentType(rawHeader)) return rawHeader;
    return fromSniff || fromName;
  }

  private async uploadRemoteImageToStrapi(fileUrl: string): Promise<number> {
    const download = await axios.get<ArrayBuffer>(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxContentLength: 40 * 1024 * 1024,
      maxBodyLength: 40 * 1024 * 1024,
      validateStatus: (s) => s === 200,
    });

    const buffer = Buffer.from(download.data);
    const filename = this.filenameFromUrl(fileUrl);
    const headerCt =
      typeof download.headers['content-type'] === 'string'
        ? download.headers['content-type']
        : undefined;
    const contentType = this.resolveMimeForImageUpload(headerCt, filename, buffer);

    const looksLikeImage =
      /^image\//i.test(contentType) ||
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(filename) ||
      this.isLikelyRemoteImageUrl(fileUrl);
    if (!looksLikeImage) {
      throw new Error(
        `Strapi media upload: URL is not a recognized image (Content-Type: ${contentType})`
      );
    }

    const form = new FormData();
    form.append('files', buffer, { filename, contentType });

    const uploadRes = await axios.post(`${this.strapiApiRoot}/upload`, form, {
      headers: {
        Authorization: `Bearer ${this.config.strapiToken}`,
        ...form.getHeaders(),
      },
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const payload = uploadRes.data;
    const first = Array.isArray(payload) ? payload[0] : (payload?.data?.[0] ?? payload?.data);
    const id = first?.id;
    if (typeof id !== 'number') {
      throw new Error('Strapi upload did not return a numeric file id');
    }
    return id;
  }

  private async resolveTranslatedValue(
    fieldPath: string,
    translatedText: string
  ): Promise<string | number> {
    if (!this.shouldUploadTranslatedImageToStrapiMedia(fieldPath, translatedText)) {
      return translatedText;
    }
    return this.uploadRemoteImageToStrapi(translatedText.trim());
  }

  private flattenStrapiRelations(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.flattenStrapiRelations(item));
    }
    if (Object.prototype.hasOwnProperty.call(value, 'data')) {
      const d = (value as any).data;
      if (d === null) return null;
      if (Array.isArray(d)) {
        return d.map((x: any) => {
          if (x && typeof x === 'object' && typeof x.id === 'number') return x.id;
          return this.flattenStrapiRelations(x);
        });
      }
      if (typeof d === 'object' && typeof d.id === 'number') {
        return d.id;
      }
      return this.flattenStrapiRelations(d);
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = this.flattenStrapiRelations(v);
    }
    return out;
  }

  private stripReadOnlyStrapiAttributes(attrs: Record<string, any>): Record<string, any> {
    const omit = new Set([
      'createdAt',
      'updatedAt',
      'publishedAt',
      'localizations',
      'createdBy',
      'updatedBy',
      'locale',
    ]);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (omit.has(k)) continue;
      out[k] = v;
    }
    return out;
  }

  /** Do not run relation-flatten on these roots (rich text / blocks can contain `{ data: ... }`). */
  private static readonly SKIP_FLATTEN_ROOT_KEYS = new Set([
    'description',
    'content',
    'body',
    'copy',
    'text',
    'richText',
    'richtext',
    'blocks',
  ]);

  /**
   * GET responses wrap media/relations as { data: { id } }; PUT expects numeric ids. Flatten everywhere
   * except known rich-text roots (handles root-level SEO image etc. without re-breaking description).
   */
  private sanitizeRelationsForStrapiWrite(payload: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (StrapiPusher.SKIP_FLATTEN_ROOT_KEYS.has(k)) {
        out[k] = v;
        continue;
      }
      out[k] = this.flattenStrapiRelations(v);
    }
    return out;
  }

  /**
   * Strapi component instances include internal numeric ids; sending them back can crash the admin API (500).
   */
  private stripStrapiWriteMetadata(value: any): any {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return value.map((x) => this.stripStrapiWriteMetadata(x));
    }
    if (typeof value !== 'object') return value;

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = this.stripStrapiWriteMetadata(v);
    }
    if (typeof out.id === 'number' && Object.keys(out).length > 1) {
      delete out.id;
    }
    if (typeof out.documentId === 'string') {
      delete out.documentId;
    }
    return out;
  }

  private backfillEmptyPayloadFieldsFromSource(
    payload: Record<string, any>,
    sourceAttrs: Record<string, any>
  ): void {
    const skip = new Set([
      'locale',
      'createdAt',
      'updatedAt',
      'publishedAt',
      'localizations',
      'createdBy',
      'updatedBy',
    ]);
    for (const key of Object.keys(sourceAttrs)) {
      if (skip.has(key)) continue;
      const v = payload[key];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim() === '') ||
        (Array.isArray(v) && v.length === 0);
      if (!empty) continue;
      const s = sourceAttrs[key];
      if (s === undefined || s === null) continue;
      if (typeof s === 'string' && s.trim() === '') continue;
      if (Array.isArray(s) && s.length === 0) continue;
      payload[key] = s;
    }
  }

  private async mergePatchWithStrapiEntry(
    contentType: string,
    targetEntryId: number,
    patch: Record<string, any>,
    sourceEntryIdForBackfill?: number | null
  ): Promise<Record<string, any>> {
    const res = await this.client.get(`/${contentType}/${targetEntryId}?populate=*`, {
      timeout: 60000,
    });
    const attrs = res.data?.data?.attributes || {};
    const payload: Record<string, any> = { ...attrs };

    for (const key of Object.keys(patch)) {
      const patchVal = patch[key];
      const attrVal = attrs[key];

      if (typeof patchVal === 'object' && patchVal !== null && !Array.isArray(patchVal)) {
        const base =
          typeof attrVal === 'object' && attrVal !== null && !Array.isArray(attrVal)
            ? this.flattenStrapiRelations(attrVal)
            : {};
        payload[key] = this.deepMerge(base, patchVal);
      } else {
        payload[key] = patchVal;
      }
    }

    if (sourceEntryIdForBackfill != null && sourceEntryIdForBackfill !== targetEntryId) {
      const srcRes = await this.client.get(
        `/${contentType}/${sourceEntryIdForBackfill}?populate=*`,
        { timeout: 60000 }
      );
      const srcAttrs = srcRes.data?.data?.attributes || {};
      this.backfillEmptyPayloadFieldsFromSource(payload, srcAttrs);
    }

    let cleaned = this.stripReadOnlyStrapiAttributes(payload);
    cleaned = this.sanitizeRelationsForStrapiWrite(cleaned);
    cleaned = this.stripStrapiWriteMetadata(cleaned);
    return cleaned;
  }

  private async ensureLocale(targetLocale: string): Promise<string> {
    const normalized = normalizeLocaleForStrapi(targetLocale);

    try {
      const res = await this.client.get('/i18n/locales');
      const locales: any[] = res.data || [];

      const exact = locales.find((l: any) => l.code === normalized);
      if (exact) return exact.code;

      const fallback = locales.find((l: any) => l.code.startsWith(normalized.split('-')[0]));
      if (fallback) {
        return fallback.code;
      }

      return normalized;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message || 'Unknown error';
      return normalized;
    }
  }

  async pushTranslation(
    item: StrapiTranslationItem,
    targetLocale: string
  ): Promise<StrapiPushResult> {
    const { results, errors } = await this.pushBatch([item], targetLocale);
    if (errors.length > 0) {
      return errors[0];
    }
    return results[0]!;
  }

  async pushBatch(
    items: StrapiTranslationItem[],
    targetLocale: string
  ): Promise<{ results: StrapiPushResult[]; errors: StrapiPushResult[] }> {
    const results: StrapiPushResult[] = [];
    const errors: StrapiPushResult[] = [];
    const normalizedLocale = normalizeLocaleForStrapi(targetLocale);
    const locale = await this.ensureLocale(normalizedLocale);

    const grouped = new Map<string, StrapiTranslationItem[]>();
    for (const item of items) {
      const key = `${item.contentType}:${item.entryId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    for (const [key, entryItems] of grouped) {
      const { contentType, entryId } = entryItems[0];

      try {
        const entryRes = await this.client.get(`/${contentType}/${entryId}?populate=localizations`);

        const attributes = entryRes.data?.data?.attributes || {};
        const originalLocale = attributes.locale;
        const localizations = attributes.localizations?.data || [];
        const existing = localizations.find((loc: any) => loc.attributes?.locale === locale);

        let mergedUpdate: Record<string, any> = {};
        for (const item of entryItems) {
          const resolved = await this.resolveTranslatedValue(item.field, item.translatedText);
          const fieldUpdate = this.buildNestedUpdate(item.field, resolved);
          mergedUpdate = this.deepMerge(mergedUpdate, fieldUpdate);
        }

        const explicitRoute = entryItems.find((i) => i.route)?.route;
        if (explicitRoute && !mergedUpdate.route) {
          mergedUpdate.route = explicitRoute;
        }

        if (!existing && locale !== originalLocale) {
          const baseRoute =
            mergedUpdate.route !== undefined ? mergedUpdate.route : attributes.route;
          if (baseRoute) {
            const localeSuffix = (targetLocale.split('-')[0] || targetLocale).toLowerCase();
            if (!mergedUpdate.route || mergedUpdate.route === attributes.route) {
              mergedUpdate.route = `${baseRoute}-${localeSuffix}`;
            }
          }
        }

        const preparePayload = async (
          fetchId: number,
          sourceEntryIdForBackfill?: number | null
        ) => {
          const payload = await this.mergePatchWithStrapiEntry(
            contentType,
            fetchId,
            mergedUpdate,
            sourceEntryIdForBackfill ?? null
          );
          delete payload.locale;
          return payload;
        };

        if (locale === originalLocale && !existing) {
          const finalPayload = await preparePayload(entryId, null);
          await this.client.put(`/${contentType}/${entryId}`, {
            data: finalPayload,
          });
        } else if (existing) {
          const finalPayload = await preparePayload(existing.id, entryId);
          await this.client.put(`/${contentType}/${existing.id}`, {
            data: finalPayload,
          });
        } else {
          const finalPayload = await preparePayload(entryId, null);
          await this.client.post(`/${contentType}/${entryId}/localizations`, {
            locale,
            ...finalPayload,
          });
        }

        for (const item of entryItems) {
          results.push({ success: true, contentType, entryId, field: item.field });
        }
      } catch (error: any) {
        const msg = formatStrapiHttpError(error);

        for (const item of entryItems) {
          errors.push({ success: false, contentType, entryId, field: item.field, error: msg });
        }
      }
    }

    return { results, errors };
  }

  private buildNestedUpdate(fieldPath: string, value: string | number): Record<string, any> {
    const cleanPath = fieldPath.replace(/\[\d+\]/g, '');
    const parts = cleanPath.split('.');

    if (parts.length === 1) return { [parts[0]]: value };

    const result: any = {};
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    return result;
  }

  private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key]) &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}
