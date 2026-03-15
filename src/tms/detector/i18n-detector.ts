import * as fs from 'fs/promises';
import * as path from 'path';
import { TextItem, ScanConfig, I18nSetupInfo } from '../types.js';

export class I18nDetector {
  async detect(config: ScanConfig): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    for (const includePath of config.includePaths) {
      if (await this.isI18nDirectory(includePath)) {
        const dirTexts = await this.scanI18nDirectory(includePath, config.sourceLanguage);
        texts.push(...dirTexts);
      } else {
        const setup = await this.detectSetup(includePath);

        if (!setup || setup.framework === 'none') {
          continue;
        }

        for (const translationFile of setup.translationFiles) {
          if (config.sourceLanguage && translationFile.language !== config.sourceLanguage) {
            continue;
          }

          const fileTexts = await this.detectFile(translationFile.path);
          texts.push(...fileTexts);
        }
      }
    }

    return texts;
  }

  private async isI18nDirectory(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) return false;

      const dirName = path.basename(dirPath).toLowerCase();
      if (
        dirName.includes('i18n') ||
        dirName.includes('locale') ||
        dirName.includes('translation')
      ) {
        return true;
      }

      const files = await fs.readdir(dirPath);
      const hasJsonFiles = files.some(
        (f) => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')
      );

      return hasJsonFiles;
    } catch {
      return false;
    }
  }

  private async scanI18nDirectory(dirPath: string, sourceLanguage?: string): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const subTexts = await this.scanI18nDirectory(itemPath, sourceLanguage);
        texts.push(...subTexts);
      } else if (item.isFile()) {
        if (
          item.name.endsWith('.json') ||
          item.name.endsWith('.yaml') ||
          item.name.endsWith('.yml')
        ) {
          const lang = path.basename(item.name, path.extname(item.name));

          if (sourceLanguage && lang !== sourceLanguage) {
            continue;
          }

          const fileTexts = await this.detectFile(itemPath);
          texts.push(...fileTexts);
        }
      }
    }

    return texts;
  }

  async detectFile(filePath: string): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    const content = await fs.readFile(filePath, 'utf-8');

    let data: any;
    if (filePath.endsWith('.json')) {
      data = JSON.parse(content);
    } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      data = this.parseSimpleYaml(content);
    } else {
      return texts;
    }

    const items = this.extractKeyValues(data, '', filePath);
    texts.push(...items);

    return texts;
  }

  async detectSetup(projectRoot: string): Promise<I18nSetupInfo | null> {
    const nextI18nConfig = path.join(projectRoot, 'next-i18next.config.js');
    if (await this.fileExists(nextI18nConfig)) {
      return this.detectNextI18next(projectRoot);
    }

    const packageJson = path.join(projectRoot, 'package.json');
    if (await this.fileExists(packageJson)) {
      const pkg = JSON.parse(await fs.readFile(packageJson, 'utf-8'));

      if (pkg.dependencies?.['react-i18next'] || pkg.devDependencies?.['react-i18next']) {
        return this.detectReactI18next(projectRoot);
      }

      if (pkg.dependencies?.['vue-i18n'] || pkg.devDependencies?.['vue-i18n']) {
        return this.detectVueI18n(projectRoot);
      }
    }

    return this.detectGenericI18n(projectRoot);
  }

  private async detectNextI18next(projectRoot: string): Promise<I18nSetupInfo> {
    const translationFiles: I18nSetupInfo['translationFiles'] = [];

    const localesDir = path.join(projectRoot, 'public', 'locales');

    if (await this.fileExists(localesDir)) {
      const languages = await fs.readdir(localesDir);

      for (const lang of languages) {
        const langDir = path.join(localesDir, lang);
        const stat = await fs.stat(langDir);

        if (stat.isDirectory()) {
          const files = await fs.readdir(langDir);

          for (const file of files) {
            if (file.endsWith('.json')) {
              translationFiles.push({
                language: lang,
                path: path.join(langDir, file),
                format: 'json',
              });
            }
          }
        }
      }
    }

    return {
      framework: 'next-i18next',
      configFile: path.join(projectRoot, 'next-i18next.config.js'),
      translationFiles,
      defaultNamespace: 'common',
      namespaces: [...new Set(translationFiles.map((f) => path.basename(f.path, '.json')))],
    };
  }

  private async detectReactI18next(projectRoot: string): Promise<I18nSetupInfo> {
    const possibleDirs = [
      path.join(projectRoot, 'public', 'locales'),
      path.join(projectRoot, 'src', 'locales'),
      path.join(projectRoot, 'locales'),
    ];

    for (const dir of possibleDirs) {
      if (await this.fileExists(dir)) {
        return this.buildI18nSetupFromDir(dir, 'react-i18next');
      }
    }

    return {
      framework: 'react-i18next',
      translationFiles: [],
      defaultNamespace: 'translation',
      namespaces: [],
    };
  }

  private async detectVueI18n(projectRoot: string): Promise<I18nSetupInfo> {
    const possibleDirs = [
      path.join(projectRoot, 'src', 'locales'),
      path.join(projectRoot, 'locales'),
    ];

    for (const dir of possibleDirs) {
      if (await this.fileExists(dir)) {
        return this.buildI18nSetupFromDir(dir, 'vue-i18n');
      }
    }

    return {
      framework: 'vue-i18n',
      translationFiles: [],
      defaultNamespace: 'messages',
      namespaces: [],
    };
  }

  private async detectGenericI18n(projectRoot: string): Promise<I18nSetupInfo | null> {
    const possibleDirs = [
      path.join(projectRoot, 'public', 'locales'),
      path.join(projectRoot, 'src', 'locales'),
      path.join(projectRoot, 'locales'),
      path.join(projectRoot, 'translations'),
      path.join(projectRoot, 'i18n'),
    ];

    for (const dir of possibleDirs) {
      if (await this.fileExists(dir)) {
        return this.buildI18nSetupFromDir(dir, 'custom');
      }
    }

    return null;
  }

  private async buildI18nSetupFromDir(
    dir: string,
    framework: I18nSetupInfo['framework']
  ): Promise<I18nSetupInfo> {
    const translationFiles: I18nSetupInfo['translationFiles'] = [];

    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const langDir = path.join(dir, item.name);
        const files = await fs.readdir(langDir);

        for (const file of files) {
          if (file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml')) {
            translationFiles.push({
              language: item.name,
              path: path.join(langDir, file),
              format: file.endsWith('.json') ? 'json' : 'yaml',
            });
          }
        }
      } else if (item.isFile()) {
        const fileName = item.name;
        if (fileName.endsWith('.json') || fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
          const lang = path.basename(fileName, path.extname(fileName));
          translationFiles.push({
            language: lang,
            path: path.join(dir, fileName),
            format: fileName.endsWith('.json') ? 'json' : 'yaml',
          });
        }
      }
    }

    return {
      framework,
      translationFiles,
      defaultNamespace: 'common',
      namespaces: [
        ...new Set(translationFiles.map((f) => path.basename(f.path, path.extname(f.path)))),
      ],
    };
  }

  private extractKeyValues(
    obj: any,
    prefix: string,
    filePath: string,
    lineOffset: number = 0
  ): TextItem[] {
    const items: TextItem[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        items.push({
          id: `i18n-${filePath}-${fullKey}`,
          text: value,
          type: 'i18n',
          source: {
            file: filePath,
            line: lineOffset,
            column: 0,
          },
          i18nKey: fullKey,
          selected: false,
        });
      } else if (typeof value === 'object' && value !== null) {
        const nestedItems = this.extractKeyValues(value, fullKey, filePath, lineOffset);
        items.push(...nestedItems);
      }
    }

    return items;
  }

  private parseSimpleYaml(content: string): any {
    const result: any = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (value) {
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }

    return result;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
