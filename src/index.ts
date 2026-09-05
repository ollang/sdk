import { OllangClient } from './client';
import { Orders } from './resources/orders';
import { Projects } from './resources/projects';
import { Revisions } from './resources/revisions';
import { Uploads } from './resources/uploads';
import { CustomInstructions } from './resources/customInstructions';
import { Memories } from './resources/memories';
import { Folders } from './resources/folders';
import { Content } from './resources/content';
import { Billing } from './resources/billing';
import { Locales } from './resources/locales';
import { Figma } from './resources/figma';
import { Scans, ScanSessionResponse } from './resources/scans';
import { CMS } from './resources/cms';
import { OllangConfig } from './types';
import { logger } from './logger.js';

export class Ollang {
  private client: OllangClient;
  private scanSession?: ScanSessionResponse;

  public orders: Orders;
  public projects: Projects;
  public revisions: Revisions;
  public uploads: Uploads;
  public customInstructions: CustomInstructions;
  public memories: Memories;
  public folders: Folders;
  public content: Content;
  public billing: Billing;
  public locales: Locales;
  public figma: Figma;
  public scans: Scans;
  public cms: CMS;

  constructor(config: OllangConfig) {
    this.client = new OllangClient(config);

    this.orders = new Orders(this.client);
    this.projects = new Projects(this.client);
    this.revisions = new Revisions(this.client);
    this.uploads = new Uploads(this.client);
    this.customInstructions = new CustomInstructions(this.client);
    this.memories = new Memories(this.client);
    this.folders = new Folders(this.client);
    this.content = new Content(this.client);
    this.billing = new Billing(this.client);
    this.locales = new Locales(this.client);
    this.figma = new Figma(this.client);
    this.scans = new Scans(this.client);
    this.cms = new CMS(this.client);
  }

  async initializeScanSession(
    projectId?: string,
    folderName?: string
  ): Promise<ScanSessionResponse> {
    try {
      this.scanSession = await this.scans.getOrCreateSession(projectId, folderName);
      logger.debug('Scan session initialized:', this.scanSession.id);
      return this.scanSession;
    } catch (error) {
      logger.error('Failed to initialize scan session', error);
      throw error;
    }
  }

  getScanSession(): ScanSessionResponse | undefined {
    return this.scanSession;
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.client.get('/health');
  }

  getClient(): OllangClient {
    return this.client;
  }
}

export * from './types';
export * from './resources/scans';
export * from './resources/cms';
// Explicit exports keep these names discoverable by Node's native ESM loader.
export { Scans, CMS };

export { OllangBrowser, OllangBrowserConfig, CapturedContent } from './browser';

export {
  TranslationManagementSystem,
  MultiContentTMS,
  ConfigManager,
  createConfig,
  DEFAULT_TMS_CONFIG,
  TextDetector,
  VideoDetector,
  ImageDetector,
  CMSDetector,
} from './tms/index.js';

export type {
  TMSConfig,
  TMSState,
  TextItem,
  ScanConfig,
  I18nSetupInfo,
  TranslationOrder,
  Translation,
  CreateTranslationOrderParams,
  CodeChange,
  ApplyResult,
  ApplyOptions,
  ControlPanelConfig,
  ContentType,
  ContentItem,
  VideoContent,
  ImageContent,
  I18nContent,
  AnyContentItem,
} from './tms/index.js';

export default Ollang;

/*
 * `export default` alone is not enough for `import Ollang from '@ollang-dev/sdk'`.
 *
 * This package compiles to CommonJS, and when Node's ESM loader imports a
 * CommonJS module it binds `default` to `module.exports` — the namespace
 * object — rather than honouring `exports.default`. So the default import
 * resolved to an object and `new Ollang(...)` failed with "Ollang is not a
 * constructor".
 *
 * Making `module.exports` the class itself, with every named export copied
 * onto it, fixes the default import while leaving `import { Ollang }`,
 * `require('@ollang-dev/sdk')` and `require('@ollang-dev/sdk').Ollang`
 * working as before.
 */
declare const module: { exports: Record<string, unknown> } | undefined;

if (typeof module !== 'undefined' && module.exports) {
  const namedExports = module.exports;

  for (const key of Object.keys(namedExports)) {
    // Skip a function's own non-writable statics (`name`, `length`, ...).
    if (Object.prototype.hasOwnProperty.call(Ollang, key)) continue;

    Object.defineProperty(Ollang, key, {
      value: namedExports[key],
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  Object.defineProperty(Ollang, 'default', {
    value: Ollang,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(Ollang, '__esModule', { value: true });

  module.exports = Ollang as unknown as Record<string, unknown>;
}
