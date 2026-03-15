import axios, { AxiosInstance } from 'axios';

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

  constructor(config: StrapiPusherConfig) {
    this.config = config;
    const apiBase = config.strapiUrl.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: `${apiBase}/api`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.strapiToken}`,
      },
      timeout: 30000,
    });
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
    const { contentType, entryId, field, translatedText } = item;
    const normalizedLocale = normalizeLocaleForStrapi(targetLocale);
    const locale = await this.ensureLocale(normalizedLocale);

    try {
      const entryRes = await this.client.get(`/${contentType}/${entryId}?populate=localizations`);

      const attributes = entryRes.data?.data?.attributes || {};
      const originalLocale = attributes.locale;
      const localizations = attributes.localizations?.data || [];

      const existing = localizations.find((loc: any) => loc.attributes?.locale === locale);

      let updateData = this.buildNestedUpdate(field, translatedText);

      if (item.route && !(updateData as any).route) {
        updateData = { ...updateData, route: item.route };
      }

      if (!existing && locale !== originalLocale) {
        const currentRoute =
          (updateData as any).route !== undefined ? (updateData as any).route : attributes.route;
        if (currentRoute) {
          const localeSuffix = (targetLocale.split('-')[0] || targetLocale).toLowerCase();
          if (!(updateData as any).route || (updateData as any).route === attributes.route) {
            (updateData as any).route = `${currentRoute}-${localeSuffix}`;
          }
        }
      }

      if (locale === originalLocale && !existing) {
        await this.client.put(`/${contentType}/${entryId}`, {
          data: updateData,
        });
      } else {
        if (existing) {
          await this.client.put(`/${contentType}/${existing.id}`, {
            data: updateData,
          });
        } else {
          await this.client.post(`/${contentType}/${entryId}/localizations`, {
            locale,
            ...updateData,
          });
        }
      }

      return { success: true, contentType, entryId, field };
    } catch (error: any) {
      const raw = error.response?.data;
      const msg = raw?.error?.message || raw?.message || error.message || 'Unknown error';
      return { success: false, contentType, entryId, field, error: msg };
    }
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
          const fieldUpdate = this.buildNestedUpdate(item.field, item.translatedText);
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

        if (locale === originalLocale && !existing) {
          await this.client.put(`/${contentType}/${entryId}`, {
            data: mergedUpdate,
          });
        } else {
          if (existing) {
            await this.client.put(`/${contentType}/${existing.id}`, {
              data: mergedUpdate,
            });
          } else {
            await this.client.post(`/${contentType}/${entryId}/localizations`, {
              locale,
              ...mergedUpdate,
            });
          }
        }

        for (const item of entryItems) {
          results.push({ success: true, contentType, entryId, field: item.field });
        }
      } catch (error: any) {
        const raw = error.response?.data;
        const msg = raw?.error?.message || raw?.message || error.message || 'Unknown error';

        for (const item of entryItems) {
          errors.push({ success: false, contentType, entryId, field: item.field, error: msg });
        }
      }
    }

    return { results, errors };
  }

  private buildNestedUpdate(fieldPath: string, value: string): Record<string, any> {
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
