export interface OllangBrowserConfig {
  apiKey: string;
  projectId?: string;
  baseUrl?: string;
  tmsServerUrl?: string;

  autoDetectCMS?: boolean;
  cmsType?: 'contentful' | 'strapi' | 'sanity' | 'wordpress' | 'custom';

  strapiUrl?: string;

  captureSelectors?: string[];
  excludeSelectors?: string[];
  captureAttributes?: string[];

  i18nFiles?: string[];

  selectedFolder?: string;

  debounceMs?: number;

  debug?: boolean;

  onContentDetected?: (content: CapturedContent[]) => void;
}

export interface CapturedContent {
  id: string;
  text: string;
  type: 'cms' | 'dynamic' | 'dynamic-unmatched';

  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaAlt?: string;

  selector: string;
  xpath: string;
  tagName: string;
  attributes: Record<string, string>;

  cmsType?: string;
  cmsField?: string;
  cmsId?: string;

  strapiContentType?: string;
  strapiEntryId?: number;
  strapiField?: string;
  strapiRoute?: string;

  cmsFields?: Record<string, string>;

  url: string;
  timestamp: number;
  parentContext?: string;
}

interface StrapiContentMeta {
  contentType: string;
  entryId: number;
  field: string;
  rawText: string;
}

interface StrapiMediaMeta {
  contentType: string;
  entryId: number;
  field: string;
  url: string;
  mime: string;
  alt?: string;
}

interface StrapiEntryData {
  contentType: string;
  entryId: number;
  attributes: any;
  url: string;
}

export class OllangBrowser {
  private config: OllangBrowserConfig & {
    baseUrl: string;
    autoDetectCMS: boolean;
    captureSelectors: string[];
    excludeSelectors: string[];
    captureAttributes: string[];
    debounceMs: number;
    onContentDetected: (content: CapturedContent[]) => void;
  };
  private observer: MutationObserver | null = null;
  private capturedContent: Map<string, CapturedContent> = new Map();
  private i18nTexts: Set<string> = new Set();
  private i18nNormalized: Set<string> = new Set();
  private excludedTexts: Set<string> = new Set();
  private selectedContentIds: Set<string> = new Set();
  private folders: Array<{ id: string; name: string }> = [];
  private selectedFolder: string = '';

  private strapiContentMap: Map<string, StrapiContentMeta> = new Map();
  private strapiMediaMap: Map<string, StrapiMediaMeta> = new Map();
  private detectedStrapiUrls: Set<string> = new Set();
  private strapiEntries: Map<string, StrapiEntryData> = new Map();

  private strapiLongTextMap: Map<string, StrapiContentMeta> = new Map();

  private capturedTexts: Map<string, string> = new Map();
  private readonly apiKeyStorageKey = 'ollang_browser_api_key';

  constructor(config: OllangBrowserConfig) {
    this.config = {
      baseUrl: 'http://localhost:5972',
      autoDetectCMS: true,
      captureSelectors: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'span',
        'div',
        'a',
        'button',
        'li',
        'td',
        'th',
        'label',
      ],
      excludeSelectors: [
        'script',
        'style',
        'noscript',
        '.no-translate',
        '#ollang-debug-panel',
        '.ollang-debug-panel',
        '[id^="ollang-"]',
        '[class*="ollang-"]',
      ],
      captureAttributes: ['data-cms-field', 'data-cms-id', 'data-field-id'],
      debounceMs: 2000,
      onContentDetected: () => {},
      ...config,
    };

    if (!this.config.apiKey && typeof window !== 'undefined') {
      const stored = this.getStoredApiKey();
      if (stored) {
        this.config.apiKey = stored;
      }
    }

    this.selectedFolder = config.selectedFolder || '';
    this.init();
  }

  private getStoredApiKey(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      const raw = window.localStorage.getItem(this.apiKeyStorageKey);
      return raw && raw.trim() ? raw : null;
    } catch {
      return null;
    }
  }

  private saveApiKey(key: string): void {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(this.apiKeyStorageKey, key);
    } catch {}
  }

  private init(): void {
    if (typeof window === 'undefined') {
      throw new Error('OllangBrowser can only be used in browser environment');
    }

    this.interceptApiCalls();

    this.loadI18nFiles().then(() => {
      console.log(`✅ Loaded ${this.i18nTexts.size} i18n texts from files`);
      this.detectFrameworkI18n();

      setTimeout(() => {
        console.log(
          `🔍 Starting capture with ${this.i18nTexts.size} i18n texts and ${this.strapiContentMap.size} Strapi contents tracked`
        );
        this.startCapture();
      }, 3000);
    });
  }

  private interceptApiCalls(): void {
    this.interceptFetch();
    this.interceptXHR();
  }

  private interceptFetch(): void {
    const self = this;
    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : (input as Request)?.url || String(input);

      return originalFetch(input, init).then((response: Response) => {
        if (self.isStrapiApiUrl(url)) {
          response
            .clone()
            .json()
            .then((data: any) => {
              self.processStrapiResponse(url, data);
            })
            .catch(() => {});
        }
        return response;
      });
    };
  }

  private interceptXHR(): void {
    const self = this;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      (this as any)._ollangUrl = typeof url === 'string' ? url : String(url);
      return originalOpen.call(
        this,
        method,
        url,
        async ?? true,
        username ?? null,
        password ?? null
      );
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      this.addEventListener('load', function (this: XMLHttpRequest) {
        if (self.isStrapiApiUrl((this as any)._ollangUrl)) {
          try {
            const data = JSON.parse(this.responseText);
            self.processStrapiResponse((this as any)._ollangUrl, data);
          } catch (e) {}
        }
      });
      return originalSend.call(this, body);
    };
  }

  private isStrapiApiUrl(url: string): boolean {
    if (!url) return false;

    if (this.config.strapiUrl && url.includes(this.config.strapiUrl)) {
      return true;
    }

    const strapiPatterns = [/\/api\/([\w-]+)(\?|\/|$)/, /cms\./, /strapi/i];
    return strapiPatterns.some((p) => p.test(url));
  }

  private extractContentTypeFromUrl(url: string): string | null {
    const match = url.match(/\/api\/([\w-]+)/);
    return match ? match[1] : null;
  }

  private processStrapiResponse(url: string, responseData: any): void {
    const contentType = this.extractContentTypeFromUrl(url);
    if (!contentType) return;

    // Track detected Strapi base URL
    try {
      const parsed = new URL(url, window.location.origin);
      const base = parsed.origin !== window.location.origin ? parsed.origin : '';
      if (base) this.detectedStrapiUrls.add(base);
    } catch (e) {}

    const data = responseData?.data;
    if (!data) return;

    const entries = Array.isArray(data) ? data : [data];

    for (const entry of entries) {
      if (!entry || !entry.attributes) continue;

      const entryId = entry.id;

      this.strapiEntries.set(`${contentType}:${entryId}`, {
        contentType,
        entryId,
        attributes: entry.attributes,
        url,
      });

      this.extractStrapiFields(entry.attributes, contentType, entryId, '');
    }

    console.log(
      `📦 Strapi [${contentType}]: captured ${entries.length} entries, total tracked: ${this.strapiContentMap.size}`
    );
  }

  private static readonly MAX_FIELD_LENGTH = 500;
  private static readonly LONG_TEXT_FIELDS = new Set([
    'description',
    'content',
    'body',
    'html',
    'markdown',
    'richText',
    'text',
  ]);

  private static readonly MAX_RECURSION_DEPTH = 4;
  private static readonly SKIP_RELATION_KEYS = new Set([
    'author',
    'editor',
    'localizations',
    'category',
    'categories',
  ]);

  private extractStrapiFields(
    obj: any,
    contentType: string,
    entryId: number,
    fieldPath: string,
    depth: number = 0
  ): void {
    if (!obj || typeof obj !== 'object') return;
    if (depth > OllangBrowser.MAX_RECURSION_DEPTH) return;

    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const currentPath = fieldPath ? `${fieldPath}.${key}` : key;

      // Skip relation fields that pull in unrelated entries
      if (OllangBrowser.SKIP_RELATION_KEYS.has(key)) continue;

      if (typeof value === 'string' && value.trim().length >= 2) {
        if (this.isNonTranslatableField(key, value)) continue;

        const normalized = this.normalizeText(value);
        if (normalized.length < 2) continue;

        if (
          normalized.length > OllangBrowser.MAX_FIELD_LENGTH ||
          OllangBrowser.LONG_TEXT_FIELDS.has(key)
        ) {
          const longKey = `${contentType}:${entryId}:${currentPath}`;
          this.strapiLongTextMap.set(longKey, {
            contentType,
            entryId,
            field: currentPath,
            rawText: value,
          });
          this.extractParagraphsFromHtml(value, contentType, entryId, currentPath);
          if (this.config.debug) {
            console.log(
              `📝 Stored long field ${currentPath} (${normalized.length} chars) for API capture`
            );
          }
          continue;
        }

        this.strapiContentMap.set(normalized, {
          contentType,
          entryId,
          field: currentPath,
          rawText: value,
        });
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            this.extractStrapiFields(
              item,
              contentType,
              entryId,
              `${currentPath}[${idx}]`,
              depth + 1
            );
          } else if (typeof item === 'string' && item.trim().length >= 2) {
            const norm = this.normalizeText(item);
            if (norm.length >= 2 && norm.length <= OllangBrowser.MAX_FIELD_LENGTH) {
              this.strapiContentMap.set(norm, {
                contentType,
                entryId,
                field: `${currentPath}[${idx}]`,
                rawText: item,
              });
            }
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        if (key === 'formats' || key === 'provider_metadata') continue;

        if (this.isStrapiMediaObject(value)) {
          this.extractStrapiMedia(value, contentType, entryId, currentPath);
          continue;
        }

        if (key === 'data') continue;
        this.extractStrapiFields(value, contentType, entryId, currentPath, depth + 1);
      }
    }
  }

  private isStrapiMediaObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const data = obj.data;
    if (!data) return false;
    const single = Array.isArray(data) ? data[0] : data;
    return !!(single?.attributes?.url && single?.attributes?.mime);
  }

  private extractStrapiMedia(
    mediaObj: any,
    contentType: string,
    entryId: number,
    fieldPath: string
  ): void {
    const strapiBase = this.config.strapiUrl || [...this.detectedStrapiUrls][0] || '';
    const items: any[] = Array.isArray(mediaObj.data) ? mediaObj.data : [mediaObj.data];

    for (const item of items) {
      if (!item?.attributes?.url) continue;
      const attrs = item.attributes;
      const rawUrl: string = attrs.url;
      const mime: string = attrs.mime || '';

      const isImage =
        mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|svg|webp|avif)(\?|$)/i.test(rawUrl);
      const isVideo = mime.startsWith('video/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(rawUrl);
      if (!isImage && !isVideo) continue;

      const absoluteUrl = rawUrl.startsWith('http') ? rawUrl : `${strapiBase}${rawUrl}`;

      const meta: StrapiMediaMeta = {
        contentType,
        entryId,
        field: fieldPath,
        url: absoluteUrl,
        mime,
        alt: attrs.alternativeText || attrs.caption || attrs.name || undefined,
      };

      this.strapiMediaMap.set(absoluteUrl, meta);

      if (!rawUrl.startsWith('http')) {
        this.strapiMediaMap.set(rawUrl, meta);
      }
    }
  }

  private extractParagraphsFromHtml(
    html: string,
    contentType: string,
    entryId: number,
    fieldPath: string
  ): void {
    const blocks = html
      .split(/<\/p>|<br\s*\/?>|<\/h[1-6]>|<\/li>|<\/div>/i)
      .map((block) => this.normalizeText(block))
      .filter((block) => block.length >= 10);

    for (const block of blocks) {
      if (block.length > OllangBrowser.MAX_FIELD_LENGTH) continue;
      if (this.strapiContentMap.has(block)) continue;
      this.strapiContentMap.set(block, {
        contentType,
        entryId,
        field: fieldPath,
        rawText: block,
      });
    }
  }

  private static readonly SKIP_KEYS = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'publishedAt',
    'publishedDate',
    'locale',
    'route',
    'url',
    'path',
    'slug',
    'hash',
    'ext',
    'mime',
    'provider',
    'previewUrl',
    'provider_metadata',
    'background',
    'name',
    'alternativeText',
    'caption',
    'isInvisible',
    'views',
    'size',
    'width',
    'height',
    'isStory',
    'summary',
  ]);

  private isNonTranslatableField(key: string, value: string): boolean {
    if (OllangBrowser.SKIP_KEYS.has(key)) return true;
    if (/^https?:\/\//.test(value)) return true;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return true;
    if (/^[a-f0-9]{16,}$/.test(value)) return true;
    if (/^\.(jpg|jpeg|png|gif|svg|webp)$/i.test(value)) return true;
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return true;
    if (key === 'fullName' || key === 'firstName' || key === 'lastName') return true;
    if (/^image\//.test(value) || /^video\//.test(value)) return true;
    return false;
  }

  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findStrapiMatch(text: string): StrapiContentMeta | null {
    if (!text || this.strapiContentMap.size === 0) return null;

    const normalized = this.normalizeText(text);
    if (normalized.length < 3) return null;

    const exact = this.strapiContentMap.get(normalized);
    if (exact) return exact;

    let bestMatch: StrapiContentMeta | null = null;
    let bestScore = 0;

    for (const [strapiNorm, meta] of this.strapiContentMap) {
      const domLen = normalized.length;
      const strapiLen = strapiNorm.length;

      if (strapiLen < 10 || domLen < 10) continue;

      if (domLen >= strapiLen && normalized.includes(strapiNorm)) {
        const score = strapiLen / domLen;
        if (score > bestScore && score > 0.6) {
          bestScore = score;
          bestMatch = meta;
        }
      }

      if (strapiLen >= domLen && strapiNorm.includes(normalized)) {
        const score = domLen / strapiLen;
        if (score > bestScore && score > 0.5) {
          bestScore = score;
          bestMatch = meta;
        }
      }

      if (domLen > 30 && strapiLen > 30) {
        const checkLen = Math.min(domLen, strapiLen, 200);
        const domPrefix = normalized.substring(0, checkLen);
        const strapiPrefix = strapiNorm.substring(0, checkLen);
        if (domPrefix === strapiPrefix) {
          const score = checkLen / Math.max(domLen, strapiLen);
          if (score > bestScore && score > 0.5) {
            bestScore = score;
            bestMatch = meta;
          }
        }
      }
    }

    return bestMatch && bestScore > 0.5 ? bestMatch : null;
  }

  private isI18nText(text: string): boolean {
    if (this.i18nTexts.has(text)) return true;
    if (this.i18nTexts.has(text.trim())) return true;
    return this.i18nNormalized.has(this.normalizeText(text));
  }

  private detectFrameworkI18n(): void {
    setTimeout(() => {
      try {
        const translations = this.getAngularTranslations();
        if (translations) {
          this.extractTextsFromObject(translations);
          console.log('✅ Loaded Angular translations from runtime');
        }
      } catch (e) {
        console.warn('Could not auto-detect Angular translations:', e);
      }
    }, 1500);

    if ((window as any).i18next) {
      const i18n = (window as any).i18next;
      if (i18n.store && i18n.language) {
        const translations = i18n.store.data[i18n.language];
        if (translations) {
          this.extractTextsFromObject(translations);
          console.log('✅ Loaded React i18next translations');
        }
      }
    }

    if ((window as any).__VUE_I18N__) {
      const vueI18n = (window as any).__VUE_I18N__;
      if (vueI18n.messages) {
        Object.values(vueI18n.messages).forEach((msgs: any) => {
          this.extractTextsFromObject(msgs);
        });
        console.log('✅ Loaded Vue i18n translations');
      }
    }

    if ((window as any).__NEXT_DATA__?.props?.pageProps?.messages) {
      this.extractTextsFromObject((window as any).__NEXT_DATA__.props.pageProps.messages);
      console.log('✅ Loaded Next.js translations');
    }
  }

  private getAngularTranslations(): any {
    if ((window as any).ng && (window as any).ng.probe) {
      const appRoot = document.querySelector('app-root');
      if (appRoot) {
        try {
          const ctx = (window as any).ng.probe(appRoot);
          if (ctx?.injector) {
            const svc = ctx.injector.get('TranslateService');
            if (svc?.translations) return svc.translations;
          }
        } catch (e) {}
      }
    }

    if ((window as any).__ANGULAR_TRANSLATIONS__) {
      return (window as any).__ANGULAR_TRANSLATIONS__;
    }

    try {
      const stored = localStorage.getItem('translations') || sessionStorage.getItem('translations');
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    return null;
  }

  private async loadI18nFiles(): Promise<void> {
    if (!this.config.i18nFiles || this.config.i18nFiles.length === 0) {
      const paths = ['/assets/i18n/', '/locales/', '/i18n/', '/translations/', '/messages/'];
      const langs = [
        'en',
        'tr',
        'de',
        'es',
        'fr',
        'it',
        'pt',
        'ru',
        'ja',
        'zh',
        'ko',
        'ar',
        'kr',
        'da',
        'fi',
        'nb',
        'nl',
        'sv',
      ];

      for (const basePath of paths) {
        for (const lang of langs) {
          const url = `${basePath}${lang}.json`;
          try {
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              this.extractTextsFromObject(data);
              console.log(`✅ Auto-loaded i18n: ${url}`);
            }
          } catch (error) {}
        }
      }
      return;
    }

    for (const fileUrl of this.config.i18nFiles) {
      try {
        const response = await fetch(fileUrl);
        const data = await response.json();
        this.extractTextsFromObject(data);
      } catch (error) {
        console.warn(`Failed to load i18n file: ${fileUrl}`, error);
      }
    }
  }

  private extractTextsFromObject(obj: any): void {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'string') {
        this.i18nTexts.add(value);
        this.i18nTexts.add(value.trim());
        this.i18nNormalized.add(this.normalizeText(value));
      } else if (typeof value === 'object' && value !== null) {
        this.extractTextsFromObject(value);
      }
    }
  }

  private startCapture(): void {
    if (this.config.autoDetectCMS) {
      this.detectCMS();
    }
    this.startObserving();
    this.scanPage();
  }

  private detectCMS(): void {
    if (window.__CONTENTFUL_SPACE_ID__ || document.querySelector('[data-contentful-entry-id]')) {
      this.config.cmsType = 'contentful';
    }
    if (window.__STRAPI__ || document.querySelector('[data-strapi-field]')) {
      this.config.cmsType = 'strapi';
    }
    if (window.__SANITY__ || document.querySelector('[data-sanity]')) {
      this.config.cmsType = 'sanity';
    }
    if (document.body.classList.contains('wordpress') || window.wp) {
      this.config.cmsType = 'wordpress';
    }

    if (!this.config.cmsType && this.strapiContentMap.size > 0) {
      this.config.cmsType = 'strapi';
    }
    if (this.detectedStrapiUrls.size > 0) {
      this.config.cmsType = 'strapi';
      if (!this.config.strapiUrl) {
        this.config.strapiUrl = [...this.detectedStrapiUrls][0];
      }
    }
  }

  private startObserving(): void {
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: this.config.captureAttributes,
    });
  }

  private handleMutations(mutations: MutationRecord[]): void {
    const affectedNodes = new Set<Node>();
    mutations.forEach((m) => {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => affectedNodes.add(n));
      } else if (m.type === 'characterData' || m.type === 'attributes') {
        affectedNodes.add(m.target);
      }
    });

    affectedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        this.scanElement(el);
        if (el.querySelectorAll) {
          this.config.captureSelectors.forEach((sel) => {
            try {
              el.querySelectorAll(sel).forEach((child) => this.scanElement(child));
            } catch (e) {}
          });
        }
      }
    });
  }

  private captureApiContent(): void {
    for (const [, meta] of this.strapiLongTextMap) {
      const id = this.generateId(`api:${meta.contentType}:${meta.entryId}`, meta.field);
      if (this.capturedContent.has(id)) continue;

      const entryKey = `${meta.contentType}:${meta.entryId}`;
      const entryData = this.strapiEntries.get(entryKey);
      const route = entryData?.attributes?.route;

      const content: CapturedContent = {
        id,
        text: meta.rawText,
        type: 'cms',
        selector: `api://${meta.contentType}/${meta.entryId}/${meta.field}`,
        xpath: '',
        tagName: 'richtext',
        attributes: {},
        url: window.location.href,
        timestamp: Date.now(),
        cmsType: 'strapi',
        cmsField: meta.field,
        cmsId: String(meta.entryId),
        strapiContentType: meta.contentType,
        strapiEntryId: meta.entryId,
        strapiField: meta.field,
        strapiRoute: route,
      };

      this.capturedContent.set(id, content);
      this.config.onContentDetected([content]);
    }

    for (const [, entryData] of this.strapiEntries) {
      const route = entryData.attributes?.route;
      if (!route) continue;

      for (const [, content] of this.capturedContent) {
        if (
          content.strapiContentType === entryData.contentType &&
          content.strapiEntryId === entryData.entryId &&
          !content.strapiRoute
        ) {
          content.strapiRoute = route;
        }
      }
    }
  }

  private scanPage(): void {
    this.config.captureSelectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => this.scanElement(el));
      } catch (e) {}
    });
    this.scanMediaElements();
    this.captureApiContent();
  }

  private scanMediaElements(): void {
    if (this.strapiMediaMap.size === 0) return;

    const mediaSelectors = ['img[src]', 'video[src]', 'source[src]', 'video[poster]'];
    for (const sel of mediaSelectors) {
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        if (el.closest('#ollang-debug-panel')) return;

        const isPoster = sel.endsWith('[poster]');
        const src = isPoster
          ? (el as HTMLVideoElement).poster
          : (el as HTMLImageElement | HTMLVideoElement | HTMLSourceElement).src ||
            el.getAttribute('src') ||
            '';

        if (!src) return;

        let meta = this.strapiMediaMap.get(src);
        if (!meta) {
          try {
            const rel = new URL(src).pathname;
            meta = this.strapiMediaMap.get(rel);
          } catch {
            meta = this.strapiMediaMap.get(src);
          }
        }
        if (!meta) return;

        const id = this.generateId(src, meta.contentType + meta.entryId);
        if (this.capturedContent.has(id)) return;

        const mime = meta.mime || '';
        const mediaType: 'image' | 'video' =
          mime.startsWith('video/') || /\.(mp4|webm|ogg|mov)/i.test(src) ? 'video' : 'image';

        const content: CapturedContent = {
          id,
          text: meta.alt || meta.field,
          type: 'cms',
          selector: this.generateSelector(el),
          xpath: this.generateXPath(el),
          tagName: el.tagName.toLowerCase(),
          attributes: this.extractAttributes(el),
          url: window.location.href,
          timestamp: Date.now(),
          cmsType: 'strapi',
          cmsField: meta.field,
          cmsId: String(meta.entryId),
          strapiContentType: meta.contentType,
          strapiEntryId: meta.entryId,
          strapiField: meta.field,
          mediaUrl: meta.url,
          mediaType,
          mediaAlt: meta.alt,
        };

        this.capturedContent.set(id, content);
        this.config.onContentDetected([content]);
      });
    }
  }

  private scanElement(element: Element): void {
    if (
      this.config.excludeSelectors.some((sel) => {
        try {
          return element.matches(sel);
        } catch (e) {
          return false;
        }
      })
    )
      return;

    if (element.closest('#ollang-debug-panel')) return;

    const text = this.getDirectText(element);
    if (!text || text.trim().length < 3) return;

    const trimmed = text.trim();

    if (/^\d+$/.test(trimmed)) return;
    if (trimmed.length < 5 && !trimmed.includes(' ')) return;
    if (this.excludedTexts.has(trimmed)) return;

    const normalizedForDup = this.normalizeText(trimmed);
    if (this.capturedTexts.has(normalizedForDup)) return;

    const strapiMatch = this.findStrapiMatch(trimmed);

    if (strapiMatch) {
      if (strapiMatch.field === 'description') {
        if (this.config.debug) {
          console.log(
            `ℹ️ Skipping DOM capture for long field ${strapiMatch.contentType}/${strapiMatch.entryId}/${strapiMatch.field}`
          );
        }
        return;
      }

      const captured = this.createCapturedContent(element, trimmed, strapiMatch);
      if (!this.capturedContent.has(captured.id)) {
        this.capturedContent.set(captured.id, captured);
        this.capturedTexts.set(normalizedForDup, captured.id);
        this.config.onContentDetected([captured]);

        if (this.config.debug) {
          console.log(
            `✅ CMS [${strapiMatch.contentType}/${strapiMatch.entryId}/${strapiMatch.field}]: "${trimmed.substring(0, 60)}..."`
          );
        }
      }
      return;
    }

    const hasExplicitAttr =
      element.hasAttribute('data-cms') ||
      element.hasAttribute('data-cms-field') ||
      element.hasAttribute('data-strapi-field') ||
      element.hasAttribute('data-strapi-component') ||
      element.hasAttribute('data-contentful-entry-id') ||
      element.hasAttribute('data-contentful-field-id') ||
      element.hasAttribute('data-sanity') ||
      element.hasAttribute('data-sanity-edit-target');

    if (hasExplicitAttr) {
      const captured = this.createCapturedContent(element, trimmed, null);
      if (!this.capturedContent.has(captured.id)) {
        this.capturedContent.set(captured.id, captured);
        this.capturedTexts.set(normalizedForDup, captured.id);
        this.config.onContentDetected([captured]);
      }
      return;
    }

    if (this.i18nTexts.size > 0 && this.strapiContentMap.size > 0 && !this.isI18nText(trimmed)) {
      if (this.isLikelyStaticContent(element, trimmed)) return;

      const captured = this.createCapturedContent(element, trimmed, null);
      captured.type = 'dynamic-unmatched';
      if (!this.capturedContent.has(captured.id)) {
        this.capturedContent.set(captured.id, captured);
        this.capturedTexts.set(normalizedForDup, captured.id);
        this.config.onContentDetected([captured]);
      }
    }
  }

  private getDirectText(element: Element): string {
    let text = '';
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    if (text.trim()) return text.trim();

    if (element.children.length === 0) {
      return (element.textContent || '').trim();
    }

    return '';
  }

  private isLikelyStaticContent(element: Element, text: string): boolean {
    if (element.tagName === 'A' && text.length < 30) return true;
    if (element.tagName === 'BUTTON' && text.length < 30) return true;
    if (element.closest('footer') || element.closest('header, nav')) return true;
    if (/^(©|\||\+|→|←|×|✓|✗|▶|•)/.test(text)) return true;
    if (/©\s*\d{4}/.test(text)) return true;
    return false;
  }

  private createCapturedContent(
    element: Element,
    text: string,
    strapiMeta: StrapiContentMeta | null
  ): CapturedContent {
    const selector = this.generateSelector(element);
    const xpath = this.generateXPath(element);
    const cmsField = this.extractCMSField(element);
    const cmsId = this.extractCMSId(element);

    const content: CapturedContent = {
      id: this.generateId(selector, text),
      text,
      type: strapiMeta ? 'cms' : cmsField || cmsId ? 'cms' : 'dynamic',
      selector,
      xpath,
      tagName: element.tagName.toLowerCase(),
      attributes: this.extractAttributes(element),
      url: window.location.href,
      timestamp: Date.now(),
    };

    if (this.config.cmsType) content.cmsType = this.config.cmsType;

    if (strapiMeta) {
      content.cmsType = 'strapi';
      content.strapiContentType = strapiMeta.contentType;
      content.strapiEntryId = strapiMeta.entryId;
      content.strapiField = strapiMeta.field;
      content.cmsField = strapiMeta.field;
      content.cmsId = String(strapiMeta.entryId);
    } else {
      if (cmsField) content.cmsField = cmsField;
      if (cmsId) content.cmsId = cmsId;
    }

    return content;
  }

  private extractCMSField(element: Element): string | undefined {
    for (const attr of this.config.captureAttributes) {
      const value = element.getAttribute(attr);
      if (value) return value;
    }
    return (
      element.getAttribute('data-cms-field') ||
      element.getAttribute('data-contentful-field-id') ||
      element.getAttribute('data-strapi-field') ||
      element.getAttribute('data-sanity-edit-target') ||
      undefined
    );
  }

  private extractCMSId(element: Element): string | undefined {
    return (
      element.getAttribute('data-cms-id') ||
      element.getAttribute('data-contentful-entry-id') ||
      element.getAttribute('data-strapi-id') ||
      element.getAttribute('data-sanity-document-id') ||
      undefined
    );
  }

  private extractAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach((a) => {
      if (a.name.startsWith('data-')) attrs[a.name] = a.value;
    });
    return attrs;
  }

  private generateSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    const parts: string[] = [];
    let el: Element | null = element;
    while (el && el !== document.body) {
      let sel = el.tagName.toLowerCase();
      if (el.className) {
        const classes = Array.from(el.classList)
          .filter((c) => !c.startsWith('ng-') && !c.startsWith('tw-'))
          .slice(0, 2);
        if (classes.length) sel += '.' + classes.join('.');
      }
      parts.unshift(sel);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  private generateXPath(element: Element): string {
    if (element.id) return `//*[@id="${element.id}"]`;
    const parts: string[] = [];
    let el: Element | null = element;
    while (el && el !== document.body) {
      let idx = 1;
      let sib = el.previousElementSibling;
      while (sib) {
        if (sib.tagName === el.tagName) idx++;
        sib = sib.previousElementSibling;
      }
      parts.unshift(`${el.tagName.toLowerCase()}[${idx}]`);
      el = el.parentElement;
    }
    return '/' + parts.join('/');
  }

  private generateId(selector: string, text: string): string {
    const str = selector + text;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  public capture(): CapturedContent[] {
    this.scanPage();
    this.groupCmsEntries();
    return Array.from(this.capturedContent.values());
  }

  private groupCmsEntries(): void {
    const entryMap = new Map<string, { items: CapturedContent[]; entryData: any }>();
    const nonCmsItems: CapturedContent[] = [];

    for (const [, item] of this.capturedContent) {
      const isCmsEntry = item.strapiContentType && item.strapiEntryId != null;
      const isMedia = !!item.mediaUrl;

      if (isCmsEntry && !isMedia) {
        const key = `${item.strapiContentType}:${item.strapiEntryId}`;
        if (!entryMap.has(key)) {
          entryMap.set(key, {
            items: [],
            entryData: this.strapiEntries.get(key),
          });
        }
        entryMap.get(key)!.items.push(item);
      } else {
        nonCmsItems.push(item);
      }
    }

    for (const [key, group] of entryMap) {
      const [contentType, entryIdStr] = key.split(':');
      const entryId = Number(entryIdStr);
      const hasDescription = group.items.some((i) => i.strapiField === 'description');
      if (!hasDescription) {
        const longKey = `${contentType}:${entryId}:description`;
        const longMeta = this.strapiLongTextMap.get(longKey);
        if (longMeta) {
          group.items.push({
            id: `api-desc-${contentType}-${entryId}`,
            text: longMeta.rawText,
            type: 'cms',
            selector: `api://${contentType}/${entryId}/description`,
            xpath: '',
            tagName: 'richtext',
            attributes: {},
            url: window.location.href,
            timestamp: Date.now(),
            cmsType: 'strapi',
            cmsField: 'description',
            cmsId: String(entryId),
            strapiContentType: contentType,
            strapiEntryId: entryId,
            strapiField: 'description',
          });
        }
      }
    }

    this.capturedContent.clear();

    for (const [key, group] of entryMap) {
      const [contentType, entryIdStr] = key.split(':');
      const entryId = Number(entryIdStr);
      const titleItem = group.items.find((i) => i.strapiField?.includes('title')) || group.items[0];
      const route =
        group.entryData?.attributes?.route ||
        group.items.find((i) => i.strapiRoute)?.strapiRoute ||
        undefined;

      const cmsFields: Record<string, string> = {};
      for (const item of group.items) {
        if (item.strapiField) {
          cmsFields[item.strapiField] = item.text;
        }
      }

      const groupedId = `cms-entry-${contentType}-${entryId}`;
      const fieldCount = Object.keys(cmsFields).length;
      const grouped: CapturedContent = {
        ...titleItem,
        id: groupedId,
        text: titleItem.text,
        tagName: `entry:${fieldCount} fields`,
        strapiRoute: route,
        cmsFields,
      };
      this.capturedContent.set(groupedId, grouped);
    }

    for (const item of nonCmsItems) {
      this.capturedContent.set(item.id, item);
    }
  }

  public getCapturedContent(): CapturedContent[] {
    return Array.from(this.capturedContent.values());
  }

  public getCmsContent(): CapturedContent[] {
    return Array.from(this.capturedContent.values()).filter((c) => c.type === 'cms');
  }

  public getStrapiMetadata(): {
    trackedTexts: number;
    entries: number;
    detectedUrls: string[];
    cmsType: string | undefined;
  } {
    return {
      trackedTexts: this.strapiContentMap.size,
      entries: this.strapiEntries.size,
      detectedUrls: [...this.detectedStrapiUrls],
      cmsType: this.config.cmsType,
    };
  }

  public clear(): void {
    this.capturedContent.clear();
    this.capturedTexts.clear();
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    const panel = document.getElementById('ollang-debug-panel');
    if (panel) panel.remove();
  }

  public addI18nTexts(texts: string[] | Record<string, any>): void {
    const before = this.i18nTexts.size;
    if (Array.isArray(texts)) {
      texts.forEach((t) => {
        this.i18nTexts.add(t);
        this.i18nTexts.add(t.trim());
        this.i18nNormalized.add(this.normalizeText(t));
      });
    } else {
      this.extractTextsFromObject(texts);
    }
    const added = this.i18nTexts.size - before;
    console.log(`✅ Added ${added} new i18n texts (total: ${this.i18nTexts.size})`);
    if (added > 0 && this.capturedContent.size > 0) {
      this.clear();
      this.scanPage();
    }
  }

  public getI18nTextsCount(): number {
    return this.i18nTexts.size;
  }

  private getEntryRoutes(): Record<string, string> {
    const routes: Record<string, string> = {};
    for (const [key, entry] of this.strapiEntries) {
      if (entry.attributes?.route) {
        routes[key] = entry.attributes.route;
      }
    }
    return routes;
  }

  public async showDebugPanel(): Promise<void> {
    if (document.getElementById('ollang-debug-panel')) return;
    const panel = this.createDebugPanel();
    document.body.appendChild(panel);

    if (!this.config.apiKey) {
      this.showApiKeyFormInPanel();
      return;
    }

    try {
      if (!(await this.validateApiKey())) {
        this.showApiKeyFormInPanel();
        return;
      }
      this.showPanelContent();
    } catch (e) {
      console.error('Failed to validate API key:', e);
      this.showApiKeyFormInPanel();
    }
  }

  private async validateApiKey(): Promise<boolean> {
    try {
      const baseUrl = (this.config.baseUrl || '').replace(/\/$/, '');
      if (!baseUrl) return false;
      const res = await fetch(`${baseUrl}/scans/folders`, {
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
      });
      if (!res.ok) return false;
      const data = await res.json();
      const folders = Array.isArray(data) ? data : data.folders;
      if (folders && Array.isArray(folders)) {
        this.folders = folders;
        if (!this.selectedFolder && folders.length > 0) this.selectedFolder = folders[0].name;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  private showApiKeyFormInPanel(): void {
    const container = document.getElementById('ollang-panel-content');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 20px;">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Ollang API Key Required</h3>
        <p style="margin: 0 0 20px 0; color: #666; font-size: 13px; line-height: 1.5;">
          Enter your Ollang API key for this app. Not the same as any Strapi token.
        </p>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #333; font-size: 13px;">Ollang API Key</label>
          <input type="text" id="ollang-apikey-input" placeholder="Ollang API key"
            style="width: 100%; padding: 8px 10px; border: 2px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; font-family: monospace;" />
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
          <div id="ollang-status-indicator" style="width: 10px; height: 10px; border-radius: 50%; background: #ccc; transition: background-color 0.3s;"></div>
          <span id="ollang-status-text" style="font-size: 12px; color: #666;">Not validated</span>
        </div>
        <button id="ollang-validate-btn" class="ollang-btn" style="width: 100%;">Validate & Continue</button>
      </div>
    `;

    const input = document.getElementById('ollang-apikey-input') as HTMLInputElement;
    const btn = document.getElementById('ollang-validate-btn') as HTMLButtonElement;
    const indicator = document.getElementById('ollang-status-indicator')!;
    const statusText = document.getElementById('ollang-status-text')!;

    const validate = async () => {
      const key = input.value.trim();
      if (!key) {
        this.showStatus('Please enter Ollang API key', 'error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Validating...';
      indicator.style.background = '#ffc107';
      statusText.textContent = 'Validating...';
      statusText.style.color = '#ffc107';
      const prev = this.config.apiKey;
      this.config.apiKey = key;
      try {
        if (await this.validateApiKey()) {
          this.saveApiKey(key);
          indicator.style.background = '#28a745';
          statusText.textContent = 'Valid API key ✓';
          statusText.style.color = '#28a745';
          await new Promise((r) => setTimeout(r, 500));
          this.showPanelContent();
        } else {
          indicator.style.background = '#dc3545';
          statusText.textContent = 'Invalid API key ✗';
          statusText.style.color = '#dc3545';
          this.config.apiKey = prev;
          btn.disabled = false;
          btn.textContent = 'Validate & Continue';
        }
      } catch (e) {
        indicator.style.background = '#dc3545';
        statusText.textContent = 'Validation failed ✗';
        statusText.style.color = '#dc3545';
        this.config.apiKey = prev;
        btn.disabled = false;
        btn.textContent = 'Validate & Continue';
      }
    };

    btn.addEventListener('click', validate);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') validate();
    });
    setTimeout(() => input.focus(), 100);
  }

  private showPanelContent(): void {
    const container = document.getElementById('ollang-panel-content');
    if (!container) return;
    container.innerHTML = '';

    const stats = document.createElement('div');
    stats.id = 'ollang-stats';
    stats.style.cssText = 'padding: 15px; border-bottom: 1px solid #ddd; background: #f8f9fa;';
    this.updateStats(stats);

    const statusArea = document.createElement('div');
    statusArea.id = 'ollang-status';
    statusArea.style.cssText =
      'padding: 10px 15px; border-bottom: 1px solid #ddd; background: #e7f3ff; font-size: 12px; display: none;';
    statusArea.innerHTML =
      '<span id="ollang-status-text">Ready</span><button id="ollang-status-close" style="float: right; background: none; border: none; cursor: pointer; font-size: 14px;">&times;</button>';

    const buttons = document.createElement('div');
    buttons.style.cssText =
      'padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 10px;';
    buttons.innerHTML = `
      <div style="display: flex; gap: 8px;">
        <button id="ollang-capture" class="ollang-btn">Capture</button>
        <button id="ollang-clear" class="ollang-btn ollang-btn-ghost">Clear</button>
      </div>
      <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;">
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          <span style="font-size: 11px; font-weight: 500; color: #64748b;">Folder</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <div id="ollang-folder-dropdown" class="ollang-folder-dropdown">
              <button id="ollang-folder-trigger" type="button" class="ollang-folder-trigger">
                <span id="ollang-folder-label" class="ollang-folder-label">Select folder...</span>
                <span class="ollang-folder-arrow">▾</span>
              </button>
              <div id="ollang-folder-menu" class="ollang-folder-menu"></div>
            </div>
            <button id="ollang-new-folder" class="ollang-btn-sm">+ New</button>
          </div>
        </div>
        <button id="ollang-push-tms" class="ollang-btn ollang-btn-primary">Push to Ollang</button>
      </div>
      <div id="ollang-strapi-schema-block" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
        <span style="font-size: 11px; font-weight: 500; color: #64748b;">Strapi schema (optional)</span>
        <p style="margin: 4px 0 8px 0; font-size: 11px; color: #94a3b8;">Fetch schema here so Push uses Content-Type Builder fields. Use your Strapi API token (not the Ollang TMS API token).</p>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <input type="text" id="ollang-strapi-url" placeholder="Strapi URL (e.g. https://api.example.com)" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;" />
          <input type="password" id="ollang-strapi-jwt" placeholder="Strapi Admin JWT token" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;" />
          <button id="ollang-fetch-schema" class="ollang-btn-sm">Fetch schema</button>
        </div>
      </div>
    `;

    const selectionInfo = document.createElement('div');
    selectionInfo.id = 'ollang-selection-info';
    selectionInfo.style.cssText =
      'padding: 8px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; display: none;';
    selectionInfo.innerHTML = `
      <div class="ollang-selection-bar">
        <div class="ollang-selection-count">
          <span class="ollang-selection-dot"></span>
          <span id="ollang-selected-count">0</span>
          <span class="ollang-selection-label">items selected</span>
        </div>
        <div class="ollang-selection-actions">
          <button id="ollang-select-all" class="ollang-btn ollang-btn-ghost">Select All</button>
          <button id="ollang-deselect-all" class="ollang-btn ollang-btn-ghost">Deselect All</button>
          <button id="ollang-select-cms-only" class="ollang-btn ollang-selection-cms">Select CMS Only</button>
        </div>
      </div>
    `;

    const contentList = document.createElement('div');
    contentList.id = 'ollang-content-list';
    contentList.style.cssText = 'flex: 1; overflow-y: auto; padding: 15px;';

    this.loadFolders();

    container.appendChild(stats);
    container.appendChild(statusArea);
    container.appendChild(buttons);
    container.appendChild(selectionInfo);
    container.appendChild(contentList);

    setTimeout(() => {
      document.getElementById('ollang-capture')?.addEventListener('click', () => {
        this.capture();
        this.updateStats(stats);
        this.showContent(contentList);
        this.showStatus(
          `Captured ${this.capturedContent.size} items (${this.getCmsContent().length} CMS)`,
          'success'
        );
      });
      document.getElementById('ollang-clear')?.addEventListener('click', () => {
        this.clear();
        this.updateStats(stats);
        contentList.innerHTML =
          '<p style="color: #999; text-align: center;">No content captured</p>';
        this.showStatus('Cleared all content', 'success');
      });
      document.getElementById('ollang-select-all')?.addEventListener('click', () => {
        Array.from(this.capturedContent.values()).forEach((c) => this.selectedContentIds.add(c.id));
        this.showContent(contentList);
      });
      document.getElementById('ollang-deselect-all')?.addEventListener('click', () => {
        this.selectedContentIds.clear();
        this.showContent(contentList);
      });
      document.getElementById('ollang-select-cms-only')?.addEventListener('click', () => {
        this.selectedContentIds.clear();
        this.getCmsContent().forEach((c) => this.selectedContentIds.add(c.id));
        this.showContent(contentList);
      });
      document.getElementById('ollang-push-tms')?.addEventListener('click', () => this.pushToTMS());
      document
        .getElementById('ollang-fetch-schema')
        ?.addEventListener('click', () => this.fetchStrapiSchemaInPanel());
      const strapiUrlInput = document.getElementById('ollang-strapi-url') as HTMLInputElement;
      if (strapiUrlInput && !strapiUrlInput.value) {
        strapiUrlInput.value = this.config.strapiUrl || [...this.detectedStrapiUrls][0] || '';
      }

      this.updateFolderOptions();
      const dropdown = document.getElementById('ollang-folder-dropdown');
      const trigger = document.getElementById('ollang-folder-trigger');
      const menu = document.getElementById('ollang-folder-menu');

      if (trigger && menu && dropdown) {
        const toggleMenu = (open?: boolean) => {
          const isOpen = open ?? menu.getAttribute('data-open') !== 'true';
          if (isOpen) {
            menu.style.display = 'block';
            menu.setAttribute('data-open', 'true');
          } else {
            menu.style.display = 'none';
            menu.setAttribute('data-open', 'false');
          }
        };

        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleMenu();
        });

        document.addEventListener('click', (e) => {
          if (!dropdown.contains(e.target as Node)) {
            toggleMenu(false);
          }
        });
      }
      document
        .getElementById('ollang-new-folder')
        ?.addEventListener('click', () => this.showNewFolderDialog());
      document
        .getElementById('ollang-status-close')
        ?.addEventListener('click', () => this.hideStatus());
    }, 0);

    setInterval(() => this.updateStats(stats), 2000);
  }

  private createDebugPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'ollang-debug-panel';
    panel.style.cssText =
      [
        'position: fixed',
        'right: 20px',
        'left: auto',
        'transform: none',
        'bottom: 0',
        'width: min(540px, 100% - 40px)',
        'min-height: 320px',
        'max-height: 90vh',
        'background: #ffffff',
        'border-radius: 12px 12px 0 0',
        'border: 1px solid rgba(15, 23, 42, 0.12)',
        'box-shadow: 0 18px 45px rgba(15, 23, 42, 0.25)',
        'z-index: 999999',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'display: flex',
        'flex-direction: column',
        'overflow: hidden',
        'backdrop-filter: blur(10px)',
        '-webkit-backdrop-filter: blur(10px)',
        'background-clip: padding-box',
      ].join('; ') + ';';

    // Resize handle so user can drag panel upwards
    const resizer = document.createElement('div');
    resizer.style.cssText =
      [
        'height: 6px',
        'cursor: ns-resize',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'background: transparent',
      ].join('; ') + ';';
    const resizerBar = document.createElement('div');
    resizerBar.style.cssText =
      'width: 36px; height: 3px; border-radius: 999px; background: rgba(148, 163, 184, 0.95);';
    resizer.appendChild(resizerBar);

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = startY - e.clientY;
      const newHeight = Math.min(
        Math.max(startHeight + delta, 140),
        Math.round(window.innerHeight * 0.7)
      );
      panel.style.height = `${newHeight}px`;
    };

    const stopResize = () => {
      if (!isResizing) return;
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopResize);
    };

    resizer.addEventListener('mousedown', (e: MouseEvent) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = panel.getBoundingClientRect().height;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', stopResize);
    });

    const header = document.createElement('div');
    header.style.cssText =
      [
        'padding: 10px 16px',
        'border-bottom: 1px solid rgba(148, 163, 184, 0.25)',
        'display: flex',
        'justify-content: space-between',
        'align-items: center',
        'background: #ffffff',
        'border-radius: 12px 12px 0 0',
        'color: #0f172a',
        'box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04)',
      ].join('; ') + ';';
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 32px; height: 32px; border-radius: 999px; background: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.45); padding: 4px;">
          <svg viewBox="0 0 37 32" xmlns="http://www.w3.org/2000/svg" style="width: 26px; height: 22px; display: block;">
            <path d="M35.8246 10.862C34.5972 11.5165 33.2999 12.0249 31.9585 12.3772C30.4527 5.10884 24.8838 0.0517578 18.3428 0.0517578H18.2347C15.3756 0.184498 13.2599 1.58635 12.4149 3.89149C11.2871 6.96393 12.7167 11.1501 15.9666 14.3132C18.6573 16.9259 22.7585 18.4605 26.9677 18.4378C26.2857 21.1303 24.6634 23.4766 22.405 25.037C20.1466 26.5973 17.4072 27.2645 14.7005 26.9134C11.9939 26.5622 9.50584 25.2168 7.70306 23.1296C5.90027 21.0423 4.90653 18.3565 4.90817 15.5759C4.90817 12.9858 6.04543 9.13633 9.25081 6.75996L9.56849 6.52687V0.699269L9.28261 0.854665C8.27975 1.42954 7.30632 2.0563 6.36626 2.73246C1.67098 6.21284 0.0126953 11.6552 0.0126953 15.592C0.0174583 19.7867 1.59692 23.8205 4.427 26.8662C7.25707 29.9119 11.1233 31.7386 15.2329 31.9718C19.3424 32.2049 23.3837 30.8267 26.528 28.12C29.6723 25.4132 31.6812 21.583 32.1427 17.4148C32.5049 17.282 33.0036 17.1428 33.5278 16.9939C34.4967 16.7187 35.4973 16.4338 36.0247 16.1133L36.1168 16.0583V10.7325L35.8246 10.862ZM27.1297 13.4326C24.7312 13.4746 21.4972 12.7851 19.3529 10.6968C17.504 8.89676 16.6495 6.63372 17.0085 5.64626C17.1705 5.21243 17.8598 5.08294 18.3999 5.05056C21.9642 5.0797 26.1639 8.21686 27.1297 13.4326Z" fill="#6148f9" />
          </svg>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 13px; font-weight: 600; color: #0f172a; letter-spacing: 0.02em;">Ollang</span>
          <span style="font-size: 11px; font-weight: 500; color: #64748b;">CMS Detect</span>
        </div>
      </div>
      <button id="ollang-close"
        style="background: #f8fafc; border-radius: 999px; border: 1px solid rgba(148, 163, 184, 0.6); width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; color: #0f172a; cursor: pointer; font-size: 18px; line-height: 1; padding: 0;">
        ×
      </button>
    `;

    const content = document.createElement('div');
    content.id = 'ollang-panel-content';
    content.style.cssText = 'flex: 1; overflow-y: auto; display: flex; flex-direction: column;';

    const style = document.createElement('style');
    style.textContent = `
      .ollang-btn {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #0f172a;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      .ollang-btn:hover {
        background: #f8fafc;
        border-color: #cbd5f5;
      }
      .ollang-btn:disabled {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #94a3b8;
        cursor: not-allowed;
        box-shadow: none;
      }
      .ollang-btn-primary {
        background: #1d4ed8;
        border-color: #1d4ed8;
        color: #ffffff;
      }
      .ollang-btn-primary:hover {
        background: #1e40af;
        border-color: #1e40af;
      }
      .ollang-btn-ghost {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #0f172a;
      }
      .ollang-btn-link {
        background: none;
        border: none;
        color: #2563eb;
        cursor: pointer;
        font-size: 11px;
        text-decoration: underline;
        padding: 0;
      }
      .ollang-btn-sm {
        padding: 4px 10px;
        background: #0f172a;
        color: #ffffff;
        border-radius: 999px;
        border: none;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
      }
      .ollang-btn-sm:hover {
        background: #020617;
      }
      .ollang-selection-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .ollang-selection-count {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #0f172a;
      }
      .ollang-selection-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
      }
      .ollang-selection-label {
        font-size: 11px;
        color: #64748b;
      }
      .ollang-selection-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .ollang-selection-cms {
        color: #16a34a;
      }
      .ollang-folder-dropdown {
        position: relative;
        min-width: 220px;
      }
      .ollang-folder-trigger {
        width: 100%;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #0f172a;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      .ollang-folder-trigger:hover {
        border-color: #cbd5f5;
        background: #f8fafc;
      }
      .ollang-folder-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ollang-folder-arrow {
        font-size: 10px;
        color: #94a3b8;
        margin-left: 6px;
      }
      .ollang-folder-menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        max-height: 200px;
        overflow-y: auto;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15);
        padding: 4px;
        display: none;
        z-index: 10;
      }
      .ollang-folder-option {
        width: 100%;
        text-align: left;
        padding: 6px 8px;
        border-radius: 8px;
        border: none;
        background: transparent;
        font-size: 12px;
        color: #0f172a;
        cursor: pointer;
      }
      .ollang-folder-option:hover {
        background: #eff6ff;
      }
      .ollang-folder-option-active {
        background: #1d4ed8;
        color: #ffffff;
      }
      .ollang-content-item {
        background: #f8fafc;
        padding: 10px;
        margin: 6px 0;
        border-radius: 8px;
        font-size: 12px;
        border: 1px solid #e2e8f0;
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }
      .ollang-content-item.cms-matched {
        border-color: #22c55e;
        background: #f0fdf4;
      }
      .ollang-content-item.selected {
        background: #eff6ff;
        border-color: #2563eb;
      }
      .ollang-content-checkbox {
        margin-top: 2px;
        cursor: pointer;
        width: 16px;
        height: 16px;
      }
      .ollang-content-body {
        flex: 1;
      }
      .ollang-content-text {
        font-weight: 600;
        margin-bottom: 5px;
        color: #0f172a;
      }
      .ollang-content-meta {
        color: #64748b;
        font-size: 11px;
      }
      .ollang-cms-badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
      }
      .ollang-badge-cms {
        background: #dcfce7;
        color: #15803d;
      }
      .ollang-badge-dynamic {
        background: #fef9c3;
        color: #854d0e;
      }
      .ollang-badge-unmatched {
        background: #fee2e2;
        color: #b91c1c;
      }
      #ollang-apikey-input:focus {
        outline: none;
        border-color: #2563eb;
      }
      .ollang-badge-image {
        background: #ede9fe;
        color: #6d28d9;
      }
      .ollang-badge-video {
        background: #fce7f3;
        color: #be185d;
      }
      .ollang-media-item {
        align-items: center;
      }
      .ollang-media-preview {
        width: 52px;
        height: 40px;
        border-radius: 6px;
        object-fit: cover;
        flex-shrink: 0;
        border: 1px solid #e2e8f0;
        background: #f1f5f9;
      }
      .ollang-media-video-thumb {
        width: 52px;
        height: 40px;
        border-radius: 6px;
        background: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 1px solid #e2e8f0;
      }
      .ollang-media-play {
        color: #ffffff;
        font-size: 14px;
        opacity: 0.9;
      }
    `;

    panel.appendChild(style);
    panel.appendChild(resizer);
    panel.appendChild(header);
    panel.appendChild(content);
    setTimeout(() => {
      document.getElementById('ollang-close')?.addEventListener('click', () => panel.remove());
    }, 0);
    return panel;
  }

  private updateStats(el: HTMLElement): void {
    if (!el) return;
    const total = this.capturedContent.size;
    const cms = this.getCmsContent().length;
    const mediaItems = Array.from(this.capturedContent.values()).filter((c) => !!c.mediaUrl);
    const imgCount = mediaItems.filter((c) => c.mediaType === 'image').length;
    const vidCount = mediaItems.filter((c) => c.mediaType === 'video').length;
    el.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="font-size: 12px; font-weight: 600; color: #0f172a;">
          ${total} captured
          <span style="font-weight: 400; color: #64748b; margin-left: 4px;">(${cms} text · ${imgCount} image · ${vidCount} video)</span>
        </div>
        <div style="font-size: 11px; color: #94a3b8;">
          ${this.config.cmsType || 'Auto-detect'}${this.config.strapiUrl ? ' · ' + this.config.strapiUrl : ''}
          · tracked: ${this.strapiContentMap.size} texts, ${this.strapiMediaMap.size} media
        </div>
      </div>
    `;
  }

  private showContent(listDiv: HTMLElement): void {
    const items = Array.from(this.capturedContent.values());
    if (items.length === 0) {
      listDiv.innerHTML = '<p style="color: #999; text-align: center;">No content captured yet</p>';
      this.updateSelectionInfo();
      return;
    }

    items.sort((a, b) => {
      if (a.type === 'cms' && b.type !== 'cms') return -1;
      if (a.type !== 'cms' && b.type === 'cms') return 1;
      return b.text.length - a.text.length;
    });

    listDiv.innerHTML = items
      .map((item) => {
        const sel = this.selectedContentIds.has(item.id);
        const isCms = item.type === 'cms';
        const bc = isCms
          ? 'ollang-badge-cms'
          : item.type === 'dynamic-unmatched'
            ? 'ollang-badge-unmatched'
            : 'ollang-badge-dynamic';
        const bl = isCms ? 'CMS' : item.type === 'dynamic-unmatched' ? 'Unmatched' : 'Dynamic';

        // Media item rendering
        if (item.mediaUrl) {
          const isVideo = item.mediaType === 'video';
          const mediaBadgeLabel = isVideo ? 'Video' : 'Image';
          const mediaBadgeClass = isVideo ? 'ollang-badge-video' : 'ollang-badge-image';
          const preview = isVideo
            ? `<div class="ollang-media-preview ollang-media-video-thumb">
                 <span class="ollang-media-play">▶</span>
               </div>`
            : `<img class="ollang-media-preview" src="${this.escapeHtml(item.mediaUrl)}" alt="${this.escapeHtml(item.mediaAlt || '')}" loading="lazy" />`;

          return `<div class="ollang-content-item ${isCms ? 'cms-matched' : ''} ollang-media-item ${sel ? 'selected' : ''}" data-id="${item.id}">
            <input type="checkbox" class="ollang-content-checkbox" data-id="${item.id}" ${sel ? 'checked' : ''}>
            ${preview}
            <div class="ollang-content-body">
              <div class="ollang-content-text">${this.escapeHtml((item.mediaAlt || item.strapiField || item.mediaUrl).substring(0, 80))}</div>
              <div class="ollang-content-meta">
                <span class="ollang-cms-badge ollang-badge-cms">${bl}</span>
                <span class="ollang-cms-badge ${mediaBadgeClass}">${mediaBadgeLabel}</span>
                ${item.strapiContentType ? ' ' + item.strapiContentType : ''}${item.strapiEntryId ? '#' + item.strapiEntryId : ''}${item.strapiField ? ' → ' + item.strapiField : ''}
              </div>
            </div>
          </div>`;
        }

        // Text item rendering
        const isEntry = !!(item as any).cmsFields;
        const entryLabel = isEntry
          ? `<strong>${item.strapiContentType}#${item.strapiEntryId}</strong> (${Object.keys((item as any).cmsFields).join(', ')})`
          : `&lt;${item.tagName}&gt;${item.strapiContentType ? ' | ' + item.strapiContentType : ''}${item.strapiEntryId ? '#' + item.strapiEntryId : ''}${item.strapiField ? ' → ' + item.strapiField : ''}`;

        return `<div class="ollang-content-item ${isCms ? 'cms-matched' : ''} ${sel ? 'selected' : ''}" data-id="${item.id}">
        <input type="checkbox" class="ollang-content-checkbox" data-id="${item.id}" ${sel ? 'checked' : ''}>
        <div class="ollang-content-body">
          <div class="ollang-content-text">${this.escapeHtml(item.text.substring(0, 80))}${item.text.length > 80 ? '...' : ''}</div>
          <div class="ollang-content-meta"><span class="ollang-cms-badge ${bc}">${bl}</span> ${entryLabel}</div>
        </div></div>`;
      })
      .join('');

    listDiv.querySelectorAll('.ollang-content-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const t = e.target as HTMLInputElement;
        const id = t.dataset.id!;
        const row = listDiv.querySelector(`[data-id="${id}"]`);
        if (t.checked) {
          this.selectedContentIds.add(id);
          row?.classList.add('selected');
        } else {
          this.selectedContentIds.delete(id);
          row?.classList.remove('selected');
        }
        this.updateSelectionInfo();
      });
    });
    this.updateSelectionInfo();
  }

  private updateSelectionInfo(): void {
    const info = document.getElementById('ollang-selection-info');
    const count = document.getElementById('ollang-selected-count');
    const pushBtn = document.getElementById('ollang-push-tms') as HTMLButtonElement;
    if (info && count) {
      if (this.selectedContentIds.size > 0) {
        info.style.display = 'block';
        count.textContent = String(this.selectedContentIds.size);
      } else info.style.display = 'none';
    }
    if (pushBtn) pushBtn.disabled = this.selectedContentIds.size === 0;
  }

  private exportContent(): void {
    const data = JSON.stringify(Array.from(this.capturedContent.values()), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ollang-captured-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const area = document.getElementById('ollang-status');
    const text = document.getElementById('ollang-status-text');
    if (area && text) {
      text.textContent = message;
      area.style.backgroundColor = { success: '#d4edda', error: '#f8d7da', info: '#e7f3ff' }[type];
      area.style.display = 'block';
      if (type !== 'error')
        setTimeout(() => {
          if (area) area.style.display = 'none';
        }, 5000);
    }
  }

  private hideStatus(): void {
    const el = document.getElementById('ollang-status');
    if (el) el.style.display = 'none';
  }

  private async loadFolders(): Promise<void> {
    try {
      if (this.folders.length > 0) {
        this.updateFolderOptions();
        return;
      }
      if (!this.config.apiKey) return;
      const baseUrl = (this.config.baseUrl || '').replace(/\/$/, '');
      if (!baseUrl) return;
      const res = await fetch(`${baseUrl}/scans/folders`, {
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        const folders = Array.isArray(data) ? data : data.folders;
        if (folders?.length > 0) {
          this.folders = folders;
          if (!this.selectedFolder) this.selectedFolder = folders[0].name;
          this.updateFolderOptions();
        }
      }
    } catch (e) {
      console.warn('Failed to load folders:', e);
    }
  }

  private updateFolderOptions(): void {
    const label = document.getElementById('ollang-folder-label');
    const menu = document.getElementById('ollang-folder-menu');
    if (!label || !menu) return;

    // Set current label
    const active = this.selectedFolder || (this.folders[0]?.name ?? '');
    if (active) {
      this.selectedFolder = active;
      label.textContent = active;
    } else {
      label.textContent = 'Select folder...';
    }

    menu.innerHTML = '';
    this.folders.forEach((f) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'ollang-folder-option' +
        (f.name === this.selectedFolder ? ' ollang-folder-option-active' : '');
      btn.textContent = f.name;
      btn.addEventListener('click', () => {
        this.selectedFolder = f.name;
        label.textContent = f.name;
        const items = menu.querySelectorAll('.ollang-folder-option');
        items.forEach((el) => el.classList.remove('ollang-folder-option-active'));
        btn.classList.add('ollang-folder-option-active');
        menu.setAttribute('data-open', 'false');
        (menu as HTMLElement).style.display = 'none';
      });
      menu.appendChild(btn);
    });
  }

  private showNewFolderDialog(): void {
    if (document.getElementById('ollang-new-folder-container')) return;
    const parent = document.querySelector('#ollang-debug-panel #ollang-push-tms')?.parentElement;
    if (!parent) return;

    const container = document.createElement('div');
    container.id = 'ollang-new-folder-container';
    container.style.cssText =
      'width: 100%; padding: 8px 15px 0 15px; display: flex; gap: 6px; align-items: center;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter folder name';
    input.style.cssText =
      'flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;';

    const createBtn = document.createElement('button');
    createBtn.textContent = 'Create';
    createBtn.className = 'ollang-btn-sm';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'ollang-btn-link';
    const remove = () => {
      if (container.parentElement) container.remove();
    };

    createBtn.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) {
        this.showStatus('Please enter a folder name', 'error');
        return;
      }
      this.selectedFolder = name;
      if (!this.folders.find((f) => f.name === name)) this.folders.push({ id: name, name });
      this.updateFolderOptions();
      this.showStatus(`Folder "${name}" selected.`, 'success');
      remove();
    });
    cancelBtn.addEventListener('click', remove);

    container.appendChild(input);
    container.appendChild(createBtn);
    container.appendChild(cancelBtn);
    parent.parentElement?.insertBefore(container, parent.nextSibling);
    setTimeout(() => input.focus(), 0);
  }

  private async fetchStrapiSchemaInPanel(): Promise<void> {
    const baseUrl = (this.config.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) {
      this.showStatus('Missing TMS baseUrl', 'error');
      return;
    }
    const urlInput = document.getElementById('ollang-strapi-url') as HTMLInputElement;
    const jwtInput = document.getElementById('ollang-strapi-jwt') as HTMLInputElement;
    const btn = document.getElementById('ollang-fetch-schema') as HTMLButtonElement;
    const strapiUrl = urlInput?.value?.trim();
    const strapiToken = jwtInput?.value?.trim();
    if (!strapiUrl || !strapiToken) {
      this.showStatus('Enter Strapi URL and Strapi API token', 'error');
      return;
    }
    if (btn) btn.disabled = true;
    this.showStatus('Fetching Strapi schema...', 'info');
    try {
      const res = await fetch(`${baseUrl}/api/strapi-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strapiUrl, strapiToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const n = data.contentTypes?.length ?? 0;
        this.showStatus(`Schema loaded: ${n} content-type(s)`, 'success');
      } else {
        this.showStatus(data.error || `Failed (${res.status})`, 'error');
      }
    } catch (e) {
      this.showStatus('Network error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  private async pushToTMS(): Promise<void> {
    if (this.selectedContentIds.size === 0) {
      this.showStatus('Please select at least one item', 'error');
      return;
    }
    if (!this.selectedFolder) {
      this.showStatus('Please select a folder first', 'error');
      return;
    }
    if (!this.config.apiKey) {
      this.showStatus('Please enter TMS API token first', 'error');
      return;
    }
    const baseUrl = (this.config.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) {
      this.showStatus('Missing baseUrl', 'error');
      return;
    }

    const selected = Array.from(this.capturedContent.values()).filter((c) =>
      this.selectedContentIds.has(c.id)
    );

    const mediaItems = selected.filter(
      (c) => !!c.mediaUrl && (c.type === 'cms' || c.cmsType === 'strapi' || !!c.strapiContentType)
    );
    const textItems = selected.filter(
      (c) => !c.mediaUrl || !(c.type === 'cms' || c.cmsType === 'strapi' || !!c.strapiContentType)
    );

    if (textItems.length === 0 && mediaItems.length === 0) {
      this.showStatus('Nothing to push. Please select at least one text or media item.', 'info');
      return;
    }

    this.showStatus(
      `Pushing ${textItems.length} text and ${mediaItems.length} media items to Ollang...`,
      'info'
    );

    try {
      const hasCmsItems =
        textItems.some(
          (c) => c.type === 'cms' || c.cmsType === 'strapi' || !!c.strapiContentType
        ) || mediaItems.length > 0;

      let strapiFieldConfig: Record<string, string[]> = {};
      const strapiBaseUrl = this.config.strapiUrl || [...this.detectedStrapiUrls][0] || '';
      if (hasCmsItems && strapiBaseUrl && baseUrl) {
        try {
          const configUrl = `${baseUrl}/api/strapi-field-config?strapiUrl=${encodeURIComponent(
            strapiBaseUrl.replace(/\/$/, '')
          )}`;
          const configRes = await fetch(configUrl, {
            headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
          });
          if (configRes.ok) {
            const data = await configRes.json();
            if (data.fieldsByContentType && Object.keys(data.fieldsByContentType).length > 0) {
              strapiFieldConfig = data.fieldsByContentType;
              if (this.config.debug) {
                console.log('[Ollang] Using dynamic Strapi field config:', strapiFieldConfig);
              }
            }
          }
        } catch (e) {
          if (this.config.debug) console.warn('[Ollang] Could not fetch Strapi field config:', e);
        }
      }

      const pathMatchesAllowed = (allowedPath: string, key: string): boolean => {
        if (allowedPath === key) return true;
        if (allowedPath.includes('[]')) {
          const escaped = allowedPath.replace(/\./g, '\\.').replace(/\[\]/g, '\\.\\d+');
          const re = new RegExp(`^${escaped}$`);
          return re.test(key);
        }
        return false;
      };

      const getNestedValue = (obj: any, path: string): any => {
        if (!obj || !path) return undefined;
        const parts = path.split('.');
        let cur: any = obj;
        for (const p of parts) {
          if (cur == null) return undefined;
          cur = cur[p];
        }
        return cur;
      };

      const serializeForCmsField = (value: any): string | undefined => {
        if (value == null) return undefined;
        if (typeof value === 'string' || typeof value === 'number') return String(value);
        if (typeof value === 'object') {
          const url = value?.data?.attributes?.url ?? value?.url;
          if (typeof url === 'string') return url;
          try {
            return JSON.stringify(value);
          } catch {
            return undefined;
          }
        }
        return String(value);
      };

      const entryGroupMap = new Map<string, { items: CapturedContent[]; entryData: any }>();
      const nonCmsTextItems: CapturedContent[] = [];

      for (const c of textItems) {
        if (c.strapiContentType && c.strapiEntryId != null) {
          const key = `${c.strapiContentType}:${c.strapiEntryId}`;
          if (!entryGroupMap.has(key)) {
            entryGroupMap.set(key, {
              items: [],
              entryData: this.strapiEntries.get(key),
            });
          }
          entryGroupMap.get(key)!.items.push(c);
        } else {
          nonCmsTextItems.push(c);
        }
      }

      for (const [key, group] of entryGroupMap) {
        const [contentType, entryIdStr] = key.split(':');
        const entryId = Number(entryIdStr);
        const hasDescription = group.items.some((i) => i.strapiField === 'description');
        if (!hasDescription) {
          const longKey = `${contentType}:${entryId}:description`;
          const longMeta = this.strapiLongTextMap.get(longKey);
          if (longMeta) {
            group.items.push({
              id: `api-desc-${contentType}-${entryId}`,
              text: longMeta.rawText,
              type: 'cms',
              selector: `api://${contentType}/${entryId}/description`,
              xpath: '',
              tagName: 'richtext',
              attributes: {},
              url: window.location.href,
              timestamp: Date.now(),
              cmsType: 'strapi',
              cmsField: 'description',
              cmsId: String(entryId),
              strapiContentType: contentType,
              strapiEntryId: entryId,
              strapiField: 'description',
            });
          }
        }
      }

      const entryTexts = Array.from(entryGroupMap.entries()).map(([key, group]) => {
        const [contentType, entryIdStr] = key.split(':');
        const entryId = Number(entryIdStr);
        const titleItem =
          group.items.find((i) => i.strapiField?.includes('title')) || group.items[0];
        const route =
          group.entryData?.attributes?.route ||
          group.items.find((i) => i.strapiRoute)?.strapiRoute ||
          null;

        const cmsFields: Record<string, string> = {};
        for (const item of group.items) {
          if (item.strapiField) {
            cmsFields[item.strapiField] = item.text;
          }
        }

        const allowedPaths =
          strapiFieldConfig[contentType] ??
          (contentType.endsWith('s') ? strapiFieldConfig[contentType.slice(0, -1)] : undefined);
        if (allowedPaths && allowedPaths.length > 0) {
          const filtered: Record<string, string> = {};
          for (const [path, value] of Object.entries(cmsFields)) {
            if (allowedPaths.some((p) => pathMatchesAllowed(p, path))) {
              filtered[path] = value;
            }
          }
          Object.keys(cmsFields).forEach((k) => delete cmsFields[k]);
          Object.assign(cmsFields, filtered);

          const attrs = group.entryData?.attributes;
          if (attrs) {
            for (const allowedPath of allowedPaths) {
              const normalizedPath = allowedPath.replace(/\[\]/g, '.0');
              const existingKey = Object.keys(cmsFields).find((k) =>
                pathMatchesAllowed(allowedPath, k)
              );
              if (existingKey) continue;
              const raw = getNestedValue(attrs, normalizedPath);
              const serialized = serializeForCmsField(raw);
              if (serialized !== undefined && serialized !== '') {
                cmsFields[allowedPath] = serialized;
              }
            }
          }
        }

        return {
          id: `cms-entry-${contentType}-${entryId}`,
          text: titleItem.text,
          type: 'cms' as const,
          source: {
            file: titleItem.selector || 'browser-dom',
            line: 0,
            column: 0,
            context: titleItem.xpath || '',
          },
          strapiContentType: contentType,
          strapiEntryId: entryId,
          strapiField: titleItem.strapiField || 'header.title',
          strapiRoute: route,
          cmsFields,
          selected: false,
          status: 'scanned' as const,
        };
      });

      const nonCmsTexts = nonCmsTextItems.map((c) => ({
        id: `cms-${c.id}`,
        text: c.text,
        type: (c.type === 'cms' ? 'cms' : 'dynamic') as 'cms' | 'i18n' | 'hardcoded',
        source: {
          file: c.selector || 'browser-dom',
          line: 0,
          column: 0,
          context: c.xpath || '',
        },
        selected: false,
        status: 'scanned' as const,
      }));

      const strapiEntries = Array.from(this.strapiEntries.values()).map((entry) => ({
        contentType: entry.contentType,
        entryId: entry.entryId,
        route: entry.attributes?.route || null,
        locale: entry.attributes?.locale || null,
        title: entry.attributes?.header?.title || entry.attributes?.title || null,
      }));

      const scanData = {
        texts: [...entryTexts, ...nonCmsTexts],
        media: mediaItems.map((c) => ({
          id: `media-${c.id}`,
          mediaUrl: c.mediaUrl,
          mediaType: c.mediaType,
          alt: c.mediaAlt,
          type: 'cms-media',
          source: {
            file: c.selector || 'browser-dom',
            line: 0,
            column: 0,
            context: c.xpath || '',
          },
          metadata: {
            selector: c.selector,
            xpath: c.xpath,
            tagName: c.tagName,
            attributes: c.attributes,
            cmsType: c.cmsType,
            cmsField: c.cmsField,
            cmsId: c.cmsId,
            strapiContentType: c.strapiContentType,
            strapiEntryId: c.strapiEntryId,
            strapiField: c.strapiField,
            strapiRoute: c.strapiRoute,
          },
          selected: false,
          status: 'scanned',
        })),
        isCms: hasCmsItems,
        cms: {
          strapi: {
            entries: strapiEntries,
          },
        },
        routes: this.getEntryRoutes(),
        timestamp: new Date().toISOString(),
        projectRoot: window.location.origin,
        sourceLanguage: 'en',
        targetLanguages: [],
        projectId: this.config.projectId || 'unknown',
        folderName: this.selectedFolder,
      };

      let existingScanId: string | null = null;
      try {
        const listRes = await fetch(`${baseUrl}/scans`, {
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
        });
        if (listRes.ok) {
          const scans = await listRes.json();
          if (Array.isArray(scans)) {
            const url = window.location.href;
            let best: any = null;
            for (const scan of scans) {
              const sd =
                typeof scan.scanData === 'string' ? JSON.parse(scan.scanData) : scan.scanData;
              if (sd?.folderName !== this.selectedFolder) continue;
              const match =
                scan.url === url ||
                scan.originalUrl === url ||
                sd?.projectRoot === window.location.origin;
              if (!best || match) {
                best = scan;
                if (match) break;
              }
            }
            if (best) existingScanId = best.id || best._id;
          }
        }
      } catch (e) {
        console.warn('Failed to list scans:', e);
      }

      const payload = {
        url: window.location.href,
        scanData,
        originalFilename: `cms-scan-${Date.now()}.json`,
        folderName: this.selectedFolder,
      };
      const endpoint = existingScanId ? `${baseUrl}/scans/${existingScanId}` : `${baseUrl}/scans`;
      const method = existingScanId ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Failed: ${res.statusText}`);
      }

      const result = await res.json();
      this.showStatus(
        `✅ Pushed ${selected.length} items to Ollang! Scan ID: ${result.id || 'N/A'}`,
        'success'
      );
      this.selectedContentIds.clear();
      const list = document.getElementById('ollang-content-list');
      if (list) this.showContent(list);
    } catch (e: any) {
      console.error('Push to Ollang error:', e);
      this.showStatus(`❌ Failed to push to Ollang: ${e.message}`, 'error');
    }
  }
}

declare global {
  interface Window {
    __CONTENTFUL_SPACE_ID__?: string;
    __STRAPI__?: any;
    __SANITY__?: any;
    wp?: any;
    Ollang?: typeof OllangBrowser;
  }
}
