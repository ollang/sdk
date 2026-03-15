import { TextItem, ScanConfig, I18nSetupInfo } from '../types.js';
import { I18nDetector } from './i18n-detector.js';
import { HardcodedDetector } from './hardcoded-detector.js';

export class TextDetector {
  private i18nDetector: I18nDetector;
  private hardcodedDetector: HardcodedDetector;

  constructor() {
    this.i18nDetector = new I18nDetector();
    this.hardcodedDetector = new HardcodedDetector();
  }

  async scan(config: ScanConfig): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    if (config.detectI18n) {
      const i18nTexts = await this.i18nDetector.detect(config);
      texts.push(...i18nTexts);
    }

    if (config.detectHardcoded) {
      const hardcodedTexts = await this.hardcodedDetector.detect(config);
      texts.push(...hardcodedTexts);
    }

    return texts;
  }

  async scanFiles(paths: string[]): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    for (const path of paths) {
      const fileTexts = await this.i18nDetector.detectFile(path);
      texts.push(...fileTexts);
    }

    return texts;
  }

  async detectI18nSetup(projectRoot: string): Promise<I18nSetupInfo | null> {
    return this.i18nDetector.detectSetup(projectRoot);
  }
}
