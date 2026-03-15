import { OllangClient } from './client';
import { Orders } from './resources/orders';
import { Projects } from './resources/projects';
import { Revisions } from './resources/revisions';
import { Uploads } from './resources/uploads';
import { CustomInstructions } from './resources/customInstructions';
import { Scans, ScanSessionResponse } from './resources/scans';
import { CMS } from './resources/cms';
import { OllangConfig } from './types';

export class Ollang {
  private client: OllangClient;
  private scanSession?: ScanSessionResponse;

  public orders: Orders;
  public projects: Projects;
  public revisions: Revisions;
  public uploads: Uploads;
  public customInstructions: CustomInstructions;
  public scans: Scans;
  public cms: CMS;

  constructor(config: OllangConfig) {
    this.client = new OllangClient(config);

    this.orders = new Orders(this.client);
    this.projects = new Projects(this.client);
    this.revisions = new Revisions(this.client);
    this.uploads = new Uploads(this.client);
    this.customInstructions = new CustomInstructions(this.client);
    this.scans = new Scans(this.client);
    this.cms = new CMS(this.client);
  }

  async initializeScanSession(
    projectId?: string,
    folderName?: string
  ): Promise<ScanSessionResponse> {
    try {
      this.scanSession = await this.scans.getOrCreateSession(projectId, folderName);
      console.log('✅ Scan session initialized:', this.scanSession.id);
      return this.scanSession;
    } catch (error) {
      console.error('❌ Failed to initialize scan session:', error);
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
