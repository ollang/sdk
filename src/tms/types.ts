export interface TextItem {
  id: string;

  text: string;

  type: 'i18n' | 'hardcoded' | 'cms';

  source: {
    file: string;
    line: number;
    column: number;
    context?: string;
  };

  i18nKey?: string;
  i18nNamespace?: string;

  cmsField?: string;
  cmsId?: string;

  strapiContentType?: string;
  strapiEntryId?: number;
  strapiField?: string;
  strapiRoute?: string;

  cmsFields?: Record<string, string>;

  translatedCmsFields?: Record<string, string>;

  selected: boolean;
  translated?: string;
  edited?: boolean;
  status?: 'scanned' | 'translating' | 'translated' | 'submitted';
  translations?: Record<string, string>;

  statusByLanguage?: Record<string, 'none' | 'translating' | 'translated' | 'submitted'>;

  category?: string;
  tags?: string[];
  metadata?: any;

  _videoData?: any;
  _imageData?: any;
  _audioData?: any;
}

export interface ScanConfig {
  includePaths: string[];

  excludePaths: string[];

  includePatterns: string[];

  detectI18n: boolean;

  detectHardcoded: boolean;

  detectCMS: boolean;

  sourceLanguage?: string;
}

export interface I18nSetupInfo {
  framework: 'react-i18next' | 'next-i18next' | 'vue-i18n' | 'custom' | 'none';

  configFile?: string;

  translationFiles: {
    language: string;
    path: string;
    format: 'json' | 'yaml' | 'js';
  }[];

  defaultNamespace?: string;

  namespaces: string[];
}

export interface TranslationOrder {
  id: string;

  status: OrderStatus;

  texts: TextItem[];

  sourceLanguage: string;

  targetLanguage: string;

  createdAt: Date;

  completedAt?: Date;

  cost?: number;

  creditsUsed?: number;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Translation {
  textId: string;

  originalText: string;

  translatedText: string;

  confidence?: number;
}

export interface CreateTranslationOrderParams {
  texts: TextItem[];

  sourceLanguage: string;

  targetLanguage: string;

  level: number;

  projectId?: string;

  folderName?: string;

  folderId?: string;

  context?: string;
}

export interface CodeChange {
  file: string;

  type: 'modify' | 'create' | 'delete';

  diff: string;

  description: string;
}

export interface ApplyResult {
  success: boolean;

  changeId: string;

  filesModified: string[];

  filesCreated: string[];

  errors: ApplyError[];

  backupPath?: string;

  commitHash?: string;
}

export interface ApplyError {
  file: string;

  line?: number;

  message: string;

  textId?: string;
}

export interface ApplyOptions {
  createBackup: boolean;

  createCommit: boolean;
  commitMessage?: string;

  createBranch: boolean;
  branchName?: string;

  formatCode: boolean;

  runLinter: boolean;
}

export interface ApplyTranslationsParams {
  translations: Translation[];

  textItems: TextItem[];

  targetLanguage: string;

  i18nSetup: I18nSetupInfo;

  options: ApplyOptions;
}

export interface ControlPanelConfig {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  theme: 'light' | 'dark' | 'auto';

  hotkey: string;

  width: number;

  height: number;

  minimized: boolean;

  zIndex: number;
}

export type ControlPanelEvent =
  | 'text-selected'
  | 'text-deselected'
  | 'translate-requested'
  | 'preview-requested'
  | 'apply-requested'
  | 'filter-changed'
  | 'search-changed';

export type EventHandler = (data: any) => void;

export interface TMSConfig {
  version: string;

  projectRoot: string;

  sourceLanguage: string;

  targetLanguages: string[];

  detection: {
    includePaths: string[];
    excludePaths: string[];
    includePatterns: string[];
    detectI18n: boolean;
    detectHardcoded: boolean;
    detectCMS: boolean;
  };

  i18n: {
    framework: I18nSetupInfo['framework'];
    configFile?: string;
    translationDir: string;
    defaultNamespace: string;
    keyStyle: 'nested' | 'flat';
  };

  ollang: {
    apiKey: string;
    baseUrl: string;
    projectId?: string;
    defaultLevel: number;
    mockMode?: boolean;
  };

  video?: {
    translationType?: 'aiDubbing' | 'subtitle';
  };

  ui: ControlPanelConfig;
}

export interface TMSState {
  config: TMSConfig;

  texts: TextItem[];

  i18nSetup: I18nSetupInfo | null;

  selectedTextIds: Set<string>;

  currentOrder: TranslationOrder | null;

  translations: Map<string, Translation>;

  editedTranslations: Map<string, string>;

  imageTranslations?: Map<
    string,
    {
      originalPath: string;
      translatedPath: string;
      targetLanguage: string;
      isUrl: boolean;
      orderId: string;
    }
  >;

  panelVisible: boolean;
  panelMinimized: boolean;
  previewActive: boolean;
  searchQuery: string;
  activeFilters: TextItem['type'][];

  isScanning: boolean;
  isTranslating: boolean;
  isApplying: boolean;
  lastError: Error | null;
}

export interface BackupInfo {
  id: string;

  timestamp: Date;

  files: string[];

  description: string;
}
