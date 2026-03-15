import { TMSConfig, ControlPanelConfig } from './types.js';

export const DEFAULT_PANEL_CONFIG: ControlPanelConfig = {
  position: 'bottom-right',
  theme: 'auto',
  hotkey: 'Ctrl+Shift+T',
  width: 400,
  height: 600,
  minimized: false,
  zIndex: 10000,
};

export const DEFAULT_TMS_CONFIG: Partial<TMSConfig> = {
  version: '1.0.0',
  sourceLanguage: 'en',
  targetLanguages: ['tr'],

  detection: {
    includePaths: ['src', 'pages', 'components', 'app'],
    excludePaths: ['node_modules', '.git', 'dist', 'build', '.next', 'out'],
    includePatterns: ['**/*.{ts,tsx,js,jsx,vue}', '**/locales/**/*.{json,yaml,yml}'],
    detectI18n: true,
    detectHardcoded: true,
    detectCMS: false,
  },

  i18n: {
    framework: 'none',
    translationDir: 'public/locales',
    defaultNamespace: 'common',
    keyStyle: 'nested',
  },

  ollang: {
    apiKey: '',
    baseUrl: 'http://localhost:8080', // TODO: Change to 'https://api-integration.ollang.com' before npm publish
    defaultLevel: 0,
  },

  ui: DEFAULT_PANEL_CONFIG,
};

export class ConfigManager {
  private config: TMSConfig | null = null;

  load(customConfig: Partial<TMSConfig> = {}, projectRoot: string = process.cwd()): TMSConfig {
    const configFile = this.loadConfigFile(projectRoot);

    const envConfig = this.loadFromEnv();

    this.config = {
      ...DEFAULT_TMS_CONFIG,
      ...configFile,
      ...envConfig,
      ...customConfig,
      projectRoot,

      detection: {
        ...DEFAULT_TMS_CONFIG.detection!,
        ...configFile?.detection,
        ...envConfig?.detection,
        ...customConfig.detection,
      },
      i18n: {
        ...DEFAULT_TMS_CONFIG.i18n!,
        ...configFile?.i18n,
        ...envConfig?.i18n,
        ...customConfig.i18n,
      },
      ollang: {
        ...DEFAULT_TMS_CONFIG.ollang!,
        ...configFile?.ollang,
        ...envConfig?.ollang,
        ...customConfig.ollang,
      },
      ui: {
        ...DEFAULT_TMS_CONFIG.ui!,
        ...configFile?.ui,
        ...envConfig?.ui,
        ...customConfig.ui,
      },
    } as TMSConfig;

    this.validate(this.config);

    return this.config;
  }

  private loadConfigFile(projectRoot: string): Partial<TMSConfig> | null {
    const fs = require('fs');
    const path = require('path');

    const configPaths = [
      path.join(projectRoot, '.tmsrc.json'),
      path.join(projectRoot, 'tms.config.json'),
      path.join(projectRoot, '.tmsrc'),
    ];

    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(content);
          console.log(`✅ Loaded config from: ${path.basename(configPath)}`);
          return config;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load config from ${configPath}:`, error);
      }
    }

    return null;
  }

  private loadFromEnv(): Partial<TMSConfig> {
    const config: Partial<TMSConfig> = {};

    if (process.env.OLLANG_API_KEY || process.env.OLLANG_BASE_URL) {
      const ollangConfig: any = {};

      if (process.env.OLLANG_API_KEY) {
        ollangConfig.apiKey = process.env.OLLANG_API_KEY;
      }

      if (process.env.OLLANG_BASE_URL) {
        ollangConfig.baseUrl = process.env.OLLANG_BASE_URL;
      }

      config.ollang = ollangConfig;
    }

    if (process.env.TMS_SOURCE_LANGUAGE) {
      config.sourceLanguage = process.env.TMS_SOURCE_LANGUAGE;
    }

    if (process.env.TMS_TARGET_LANGUAGES) {
      config.targetLanguages = process.env.TMS_TARGET_LANGUAGES.split(',').map((l) => l.trim());
    }

    return config;
  }

  get(): TMSConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  update(updates: Partial<TMSConfig>): TMSConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    this.config = {
      ...this.config,
      ...updates,
    };

    this.validate(this.config);
    return this.config;
  }

  private validate(config: TMSConfig): void {
    if (!config.projectRoot) {
      throw new Error('Project root is required');
    }

    if (!config.sourceLanguage) {
      throw new Error('Source language is required');
    }

    if (!config.targetLanguages || config.targetLanguages.length === 0) {
      throw new Error('At least one target language is required');
    }

    if (!config.detection.includePaths || config.detection.includePaths.length === 0) {
      throw new Error('At least one include path is required for detection');
    }

    if (!config.ollang.apiKey) {
      console.warn('⚠️  OLLANG_API_KEY not set. Translation features will not work.');
    }
  }

  toJSON(): string {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return JSON.stringify(this.config, null, 2);
  }

  fromJSON(json: string): TMSConfig {
    const parsed = JSON.parse(json);
    return this.load(parsed, parsed.projectRoot);
  }
}

export const configManager = new ConfigManager();

export function createConfig(customConfig: Partial<TMSConfig> = {}): TMSConfig {
  return configManager.load(customConfig);
}
