import { Ollang } from '../index.js';
import { TextDetector } from './detector/text-detector.js';
import { VideoDetector } from './detector/video-detector.js';
import { ImageDetector } from './detector/image-detector.js';
import { AudioDetector } from './detector/audio-detector.js';
import { ConfigManager } from './config.js';
import {
  TMSConfig,
  TMSState,
  TextItem,
  I18nSetupInfo,
  TranslationOrder,
  Translation,
  CreateTranslationOrderParams,
  ScanConfig,
} from './types.js';
import { VideoContent, ImageContent, AudioContent } from './detector/content-type-detector.js';
import { logger } from '../logger.js';

export class TranslationManagementSystem {
  private config: TMSConfig;
  private configManager: ConfigManager;
  private textDetector: TextDetector;
  private videoDetector: VideoDetector;
  private imageDetector: ImageDetector;
  private audioDetector: AudioDetector;
  private ollangClient: Ollang;
  private state: TMSState;

  constructor(customConfig: Partial<TMSConfig> = {}) {
    this.configManager = new ConfigManager();
    this.config = this.configManager.load(customConfig);

    this.ollangClient = new Ollang({
      apiKey: this.config.ollang.apiKey,
      baseUrl: this.config.ollang.baseUrl,
    });

    this.textDetector = new TextDetector();
    this.videoDetector = new VideoDetector();
    this.imageDetector = new ImageDetector();
    this.audioDetector = new AudioDetector();

    this.state = this.createInitialState();
  }

  async scan(): Promise<TextItem[]> {
    this.state.isScanning = true;
    this.state.lastError = null;

    try {
      const scanConfig: ScanConfig = {
        includePaths: this.config.detection.includePaths.map(
          (p) => `${this.config.projectRoot}/${p}`
        ),
        excludePaths: this.config.detection.excludePaths,
        includePatterns: this.config.detection.includePatterns,
        detectI18n: this.config.detection.detectI18n,
        detectHardcoded: this.config.detection.detectHardcoded,
        detectCMS: this.config.detection.detectCMS,
        sourceLanguage: this.config.sourceLanguage,
      };

      const texts = await this.textDetector.scan(scanConfig);

      const i18nSetup = await this.textDetector.detectI18nSetup(this.config.projectRoot);

      const filteredTexts = await this.checkExistingTranslations(texts);

      this.state.texts = filteredTexts;
      this.state.i18nSetup = i18nSetup;

      return filteredTexts;
    } catch (error) {
      this.state.lastError = error as Error;
      throw error;
    } finally {
      this.state.isScanning = false;
    }
  }

  private async checkExistingTranslations(texts: TextItem[]): Promise<TextItem[]> {
    const fs = require('fs').promises;
    const path = require('path');

    const processedTexts: TextItem[] = [];
    let submittedCount = 0;

    for (const text of texts) {
      if (!text.id.startsWith('i18n-')) {
        processedTexts.push(text);
        continue;
      }

      let hasExistingTranslation = false;

      try {
        const withoutPrefix = text.id.substring(5);
        const jsonIndex = withoutPrefix.indexOf('.json');

        if (jsonIndex > 0) {
          const afterJson = withoutPrefix.substring(jsonIndex + 5);

          if (afterJson.startsWith('-')) {
            const sourceFilePath = withoutPrefix.substring(0, jsonIndex + 5);
            const key = afterJson.substring(1);

            for (const targetLanguage of this.config.targetLanguages) {
              const targetFilePath = sourceFilePath.replace(
                `/${this.config.sourceLanguage}.json`,
                `/${targetLanguage}.json`
              );

              try {
                const content = await fs.readFile(targetFilePath, 'utf-8');
                const targetData = JSON.parse(content);

                const keys = key.split('.');
                let current = targetData;
                let exists = true;

                for (const k of keys) {
                  if (current && typeof current === 'object' && k in current) {
                    current = current[k];
                  } else {
                    exists = false;
                    break;
                  }
                }

                if (exists && current && typeof current === 'string') {
                  hasExistingTranslation = true;
                  break;
                }
              } catch (error) {}
            }
          }
        }
      } catch (error) {
        logger.error(`Error checking translation for ${text.id}`, error);
      }

      if (hasExistingTranslation) {
        processedTexts.push({
          ...text,
          status: 'submitted',
        });
        submittedCount++;
      } else {
        processedTexts.push(text);
      }
    }

    return processedTexts;
  }

  async syncWithCodebase(targetLanguage: string): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    for (const text of this.state.texts) {
      if (text.id.startsWith('i18n-')) {
        await this.syncI18nTextWithCodebase(text, targetLanguage, fs, path);
      } else if (text.id.startsWith('video-')) {
        await this.syncVideoTextWithCodebase(text, targetLanguage, fs, path);
      } else if (text.id.startsWith('hardcoded-')) {
        await this.syncHardcodedTextWithCodebase(text, targetLanguage, fs, path);
      } else if (text.id.startsWith('image-')) {
        await this.syncImageTextWithCodebase(text, targetLanguage, fs, path);
      }
    }
  }

  private async syncI18nTextWithCodebase(
    text: TextItem,
    targetLanguage: string,
    fs: typeof import('fs/promises'),
    path: typeof import('path')
  ): Promise<void> {
    const statusByLanguage = (text as any).statusByLanguage || {};
    const langStatus = statusByLanguage[targetLanguage];

    const isSubmittedGlobal = text.status === 'submitted';
    const isSubmittedLang = langStatus === 'submitted';

    if (!isSubmittedGlobal && !isSubmittedLang) return;

    const hasTranslationForThisLanguage = text.translations && text.translations[targetLanguage];

    if (!hasTranslationForThisLanguage) {
      return;
    }

    try {
      const withoutPrefix = text.id.substring(5);
      const jsonIndex = withoutPrefix.indexOf('.json');

      if (jsonIndex > 0) {
        const afterJson = withoutPrefix.substring(jsonIndex + 5);

        if (afterJson.startsWith('-')) {
          const sourceFilePath = withoutPrefix.substring(0, jsonIndex + 5);
          const key = afterJson.substring(1);

          const targetFilePath = sourceFilePath.replace(
            `/${this.config.sourceLanguage}.json`,
            `/${targetLanguage}.json`
          );

          let existsInCodebase = false;

          try {
            const content = await fs.readFile(targetFilePath, 'utf-8');
            const targetData = JSON.parse(content);

            const keys = key.split('.');
            let current = targetData;

            for (const k of keys) {
              if (current && typeof current === 'object' && k in current) {
                current = current[k];
              } else {
                current = null;
                break;
              }
            }

            if (current && typeof current === 'string') {
              existsInCodebase = true;
            }
          } catch (error) {
            // File doesn't exist or can't be read
          }

          const hasTranslation =
            this.state.translations.has(text.id) ||
            (text.translations && text.translations[targetLanguage]);

          if (!existsInCodebase && hasTranslation) {
            text.status = 'translated';
            if (!(text as any).statusByLanguage) {
              (text as any).statusByLanguage = {};
            }
            (text as any).statusByLanguage[targetLanguage] = 'translated';
          } else if (existsInCodebase && hasTranslation) {
            if (text.status !== 'submitted') {
              text.status = 'submitted';
            }
            if (!(text as any).statusByLanguage) {
              (text as any).statusByLanguage = {};
            }
            if ((text as any).statusByLanguage[targetLanguage] !== 'submitted') {
              (text as any).statusByLanguage[targetLanguage] = 'submitted';
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error syncing ${text.id}`, error);
    }
  }

  private async syncVideoTextWithCodebase(
    text: TextItem,
    targetLanguage: string,
    fs: typeof import('fs/promises'),
    path: typeof import('path')
  ): Promise<void> {
    const statusByLanguage = (text as any).statusByLanguage || {};
    const langStatus = statusByLanguage[targetLanguage];
    const isSubmittedGlobal = text.status === 'submitted';
    const isSubmittedLang = langStatus === 'submitted';
    if (!isSubmittedGlobal && !isSubmittedLang) return;

    const translated = text.translations?.[targetLanguage];
    if (!translated) return;

    const videoItem = text as any;
    const sourceFile = videoItem.source?.file || videoItem._videoData?.path;
    const originalUrl = videoItem.text || videoItem._videoData?.url;
    if (!sourceFile || !originalUrl) return;

    const absolutePath = path.resolve(this.config.projectRoot, sourceFile);
    if (
      !absolutePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
      absolutePath !== path.resolve(this.config.projectRoot)
    ) {
      return;
    }

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedLang = targetLanguage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const appliedInFile = new RegExp(
        `"${escapedUrl}"\\s*/\\*\\s*-\\s*"[^"]*"\\s*\\(${escapedLang}\\)\\s*\\*/`
      ).test(content);

      if (!appliedInFile) {
        text.status = 'translated';
        if (!(text as any).statusByLanguage) {
          (text as any).statusByLanguage = {};
        }
        (text as any).statusByLanguage[targetLanguage] = 'translated';
      }
    } catch (error) {
      logger.error(`Error syncing video ${text.id}`, error);
    }
  }

  private async syncHardcodedTextWithCodebase(
    text: TextItem,
    targetLanguage: string,
    fs: typeof import('fs/promises'),
    path: typeof import('path')
  ): Promise<void> {
    const statusByLanguage = (text as any).statusByLanguage || {};
    const langStatus = statusByLanguage[targetLanguage];
    const isSubmittedGlobal = text.status === 'submitted';
    const isSubmittedLang = langStatus === 'submitted';
    if (!isSubmittedGlobal && !isSubmittedLang) return;

    const translated = text.translations?.[targetLanguage];
    if (!translated || !text.source?.file) return;

    const absolutePath = path.resolve(this.config.projectRoot, text.source.file);
    if (
      !absolutePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
      absolutePath !== path.resolve(this.config.projectRoot)
    ) {
      return;
    }

    try {
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      const lines = fileContent.split('\n');
      const lineIdx = text.source.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) return;

      const line = lines[lineIdx];
      const originalText = text.text;
      const appliedInFile =
        line.includes(JSON.stringify(originalText)) &&
        line.includes('/* -') &&
        line.includes(`(${targetLanguage})`);

      if (!appliedInFile) {
        text.status = 'translated';
        if (!(text as any).statusByLanguage) {
          (text as any).statusByLanguage = {};
        }
        (text as any).statusByLanguage[targetLanguage] = 'translated';
      }
    } catch (error) {
      logger.error(`Error syncing hardcoded ${text.id}`, error);
    }
  }

  private async syncImageTextWithCodebase(
    text: TextItem,
    targetLanguage: string,
    fs: typeof import('fs/promises'),
    path: typeof import('path')
  ): Promise<void> {
    const statusByLanguage = (text as any).statusByLanguage || {};
    const langStatus = statusByLanguage[targetLanguage];
    const isSubmittedGlobal = text.status === 'submitted';
    const isSubmittedLang = langStatus === 'submitted';
    if (!isSubmittedGlobal && !isSubmittedLang) return;

    const translated = text.translations?.[targetLanguage];
    if (!translated) return;

    const imageItem = text as any;
    const isUrl = imageItem._imageData?.metadata?.isUrl || /^https?:\/\//.test(text.text || '');
    if (!isUrl) return;

    const sourceFile = imageItem.source?.file || imageItem._imageData?.path;
    const originalUrl = text.text || imageItem._imageData?.url;
    if (!sourceFile || !originalUrl) return;

    const absolutePath = path.resolve(this.config.projectRoot, sourceFile);
    if (
      !absolutePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
      absolutePath !== path.resolve(this.config.projectRoot)
    ) {
      return;
    }

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedLang = targetLanguage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const appliedInFile = new RegExp(
        `"${escapedUrl}"\\s*/\\*\\s*-\\s*"[^"]*"\\s*\\(${escapedLang}\\)\\s*\\*/`
      ).test(content);

      if (!appliedInFile) {
        text.status = 'translated';
        if (!(text as any).statusByLanguage) {
          (text as any).statusByLanguage = {};
        }
        (text as any).statusByLanguage[targetLanguage] = 'translated';
      }
    } catch (error) {
      logger.error(`Error syncing image ${text.id}`, error);
    }
  }

  async translate(
    texts: TextItem[],
    targetLanguage: string,
    level: number = this.config.ollang.defaultLevel,
    folderName?: string,
    folderId?: string
  ): Promise<TranslationOrder> {
    this.state.isTranslating = true;
    this.state.lastError = null;

    try {
      if (this.config.ollang.mockMode) {
        return this.translateMock(texts, targetLanguage, level);
      }

      const params: CreateTranslationOrderParams = {
        texts,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage,
        level,
        projectId: this.config.ollang.projectId,
        folderName,
      };

      const order = await this.createOrder(params);

      this.state.currentOrder = order;

      await this.pollOrderStatus(order.id);

      return order;
    } catch (error) {
      logger.error('Translation failed', error);
      this.state.lastError = error as Error;
      throw error;
    } finally {
      this.state.isTranslating = false;
    }
  }

  private async translateMock(
    texts: TextItem[],
    targetLanguage: string,
    level: number
  ): Promise<TranslationOrder> {
    const order: TranslationOrder = {
      id: `mock-${Date.now()}`,
      status: 'pending',
      texts,
      sourceLanguage: this.config.sourceLanguage,
      targetLanguage,
      createdAt: new Date(),
    };

    this.state.currentOrder = order;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    for (const text of texts) {
      if (text.cmsFields && Object.keys(text.cmsFields).length > 0) {
        for (const [field, value] of Object.entries(text.cmsFields)) {
          const subId = `${text.id}__${field}`;
          const translation: Translation = {
            textId: subId,
            originalText: value,
            translatedText: `[${targetLanguage.toUpperCase()}] ${value}`,
            confidence: 0.95,
          };
          this.state.translations.set(subId, translation);
        }
      } else {
        const translation: Translation = {
          textId: text.id,
          originalText: text.text,
          translatedText: `[${targetLanguage.toUpperCase()}] ${text.text}`,
          confidence: 0.95,
        };
        this.state.translations.set(translation.textId, translation);
      }
    }

    order.status = 'completed';
    order.completedAt = new Date();

    return order;
  }

  private async createOrder(params: CreateTranslationOrderParams): Promise<TranslationOrder> {
    const documentData = {
      metadata: {
        filename: `tms-document-${Date.now()}.json`,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
      },
      slides: [
        {
          id: 'tms_document',
          textElements: params.texts.flatMap((text) => {
            if (text.cmsFields && Object.keys(text.cmsFields).length > 0) {
              return Object.entries(text.cmsFields).map(([field, value]) => ({
                id: `${text.id}__${field}`,
                text: value,
              }));
            }
            return [{ id: text.id, text: text.text }];
          }),
        },
      ],
    };

    const FormData = require('form-data');
    const formData = new FormData();

    const jsonContent = JSON.stringify(documentData, null, 2);
    const jsonBlob = Buffer.from(jsonContent, 'utf-8');
    formData.append('file', jsonBlob, {
      filename: `tms-document-${Date.now()}.json`,
      contentType: 'application/json',
    });
    formData.append('name', `TMS-Document-${Date.now()}`);
    formData.append('sourceLanguage', params.sourceLanguage);

    if (params.folderId) {
      logger.debug(`Using provided folderId: ${params.folderId}`);
      formData.append('folderId', params.folderId);
    } else if (params.folderName) {
      logger.debug(`Getting folderId for folder: ${params.folderName}`);
      try {
        const client = this.ollangClient.getClient();
        const folders =
          await client.get<Array<{ id: string; name: string; projectId?: string }>>(
            '/scans/folders'
          );

        const targetFolder = folders.find((f) => f.name === params.folderName);

        if (targetFolder && targetFolder.id) {
          logger.debug(`Found folderId: ${targetFolder.id}`);
          formData.append('folderId', targetFolder.id);
        } else {
          logger.warn(`Folder "${params.folderName}" not found in folders list`);
        }
      } catch (error) {
        logger.error('Could not get folder list', error);
      }
    } else if (params.projectId) {
      logger.debug(`Getting folder from project: ${params.projectId}`);
      try {
        const project = await this.ollangClient.projects.get(params.projectId);
        if (project.folderId) {
          logger.debug(`Found folderId: ${project.folderId}`);
          formData.append('folderId', project.folderId);
        }
      } catch (error) {
        logger.error('Could not get project folder', error);
      }
    }

    logger.debug('Uploading document...');
    const uploadResponse = await this.ollangClient
      .getClient()
      .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);

    const projectId = uploadResponse.projectId;
    logger.debug(`Document uploaded, project: ${projectId}`);

    const orderParams = {
      orderType: 'document' as const,
      level: params.level,
      projectId,
      targetLanguageConfigs: [
        {
          language: params.targetLanguage,
          isRush: false,
        },
      ],
    };

    logger.debug('Creating order with params:', orderParams);

    const orderResponse = await this.ollangClient.orders.create(orderParams);

    const order: TranslationOrder = {
      id: orderResponse.id,
      status: 'pending',
      texts: params.texts,
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      createdAt: new Date(),
    };

    return order;
  }

  private async pollOrderStatus(orderId: string): Promise<void> {
    const maxAttempts = 240;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const order = await this.ollangClient.orders.get(orderId);
      logger.debug(`Order ${orderId} poll #${attempts + 1}/${maxAttempts}: status=${order.status}`);

      if (order.status === 'completed') {
        await this.extractTranslations(order);

        if (this.state.currentOrder) {
          this.state.currentOrder.status = 'completed';
          this.state.currentOrder.completedAt = new Date();
        }

        return;
      }

      if (order.status === 'failed' || order.status === 'cancelled') {
        if (this.state.currentOrder) {
          this.state.currentOrder.status = order.status;
        }
        throw new Error(`Order ${orderId} ${order.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error(`Order ${orderId} timed out after ${maxAttempts * 5} seconds (20 min)`);
  }

  private async extractTranslations(order: any): Promise<void> {
    try {
      let documents = order.documents || order.targetDocuments || order.orderDocs || [];

      if (!Array.isArray(documents) && order.document) {
        documents = [order.document];
      }

      if (documents.length > 0) {
        logger.debug(`Found ${documents.length} documents`);

        for (const doc of documents) {
          const documentUrl = doc.targetDocumentUrl || doc.url || doc.documentUrl;

          if (documentUrl) {
            logger.debug(`Downloading translated document: ${documentUrl}`);

            const axios = require('axios');
            const response = await axios.get(documentUrl, {
              responseType: 'json',
            });

            const translatedData = response.data;
            logger.debug('Translated document received');

            if (translatedData.slides && Array.isArray(translatedData.slides)) {
              for (const slide of translatedData.slides) {
                if (slide.textElements && Array.isArray(slide.textElements)) {
                  for (const element of slide.textElements) {
                    if (!element || !element.id || !element.text) continue;

                    const id: string = element.id;

                    const isCmsField = id.startsWith('cms-entry-') || id.includes('__');
                    const isKnownText =
                      this.state.texts.some((t) => t.id === id) ||
                      (this.state.currentOrder?.texts || []).some((t) => t.id === id);

                    if (!isCmsField && !isKnownText) {
                      continue;
                    }

                    const translation: Translation = {
                      textId: id,
                      originalText: '',
                      translatedText: element.text,
                      confidence: 1.0,
                    };

                    this.state.translations.set(translation.textId, translation);
                  }
                }
              }
            }
          } else {
            logger.warn('Document URL not found in document');
          }
        }

        logger.debug(`Extracted ${this.state.translations.size} translations`);
      } else {
        logger.debug('No documents found in order, trying alternative methods...');

        if (order.projectId) {
          logger.debug(`Fetching documents from project: ${order.projectId}`);

          try {
            const project = await this.ollangClient.projects.get(order.projectId);
            logger.debug('Project structure received');

            if ((project as any).targetDocuments && (project as any).targetDocuments.length > 0) {
              const targetDoc = (project as any).targetDocuments[0];
              const documentUrl = targetDoc.url || targetDoc.documentUrl;

              if (documentUrl) {
                logger.debug(`Downloading from project: ${documentUrl}`);
                const axios = require('axios');
                const response = await axios.get(documentUrl, {
                  responseType: 'json',
                });

                const translatedData = response.data;

                if (translatedData.slides && Array.isArray(translatedData.slides)) {
                  for (const slide of translatedData.slides) {
                    if (slide.textElements && Array.isArray(slide.textElements)) {
                      for (const element of slide.textElements) {
                        if (element.id && element.text) {
                          const translation: Translation = {
                            textId: element.id,
                            originalText: '',
                            translatedText: element.text,
                            confidence: 1.0,
                          };

                          this.state.translations.set(translation.textId, translation);
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            logger.error('Error fetching from project', error);
          }
        }

        if (this.state.translations.size === 0) {
          const segments = order.segments || [];

          for (const segment of segments) {
            const translation: Translation = {
              textId: segment.metadata?.textId || segment.id,
              originalText: segment.sourceText,
              translatedText: segment.targetText,
              confidence: segment.confidence,
            };

            this.state.translations.set(translation.textId, translation);
          }
        }
      }
    } catch (error) {
      logger.error('Error extracting translations', error);
      throw error;
    }
  }

  private async createProjectWithVtt(params: CreateTranslationOrderParams): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');

    const vttContent = this.generateVttContent(params.texts, params.sourceLanguage);

    const tmpDir = require('os').tmpdir();
    const tmpFile = path.join(tmpDir, `tms-${Date.now()}.vtt`);
    fs.writeFileSync(tmpFile, vttContent, 'utf-8');

    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tmpFile), {
        filename: 'tms-texts.vtt',
        contentType: 'text/vtt',
      });
      formData.append('name', `TMS-${Date.now()}`);
      formData.append('sourceLanguage', params.sourceLanguage);

      const response = await this.ollangClient
        .getClient()
        .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);

      return response.projectId;
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {}
    }
  }

  private generateVttContent(texts: TextItem[], sourceLanguage: string): string {
    let vtt = 'WEBVTT\n\n';

    texts.forEach((text, index) => {
      const startTime = this.formatVttTime(index * 5);
      const endTime = this.formatVttTime(index * 5 + 4);

      vtt += `${index + 1}\n`;
      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `${text.text}\n\n`;
    });

    return vtt;
  }

  private formatVttTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  getState(): TMSState {
    return { ...this.state };
  }

  getConfig(): TMSConfig {
    return { ...this.config };
  }

  getI18nSetup(): I18nSetupInfo | null {
    return this.state.i18nSetup;
  }

  getSDK(): Ollang {
    return this.ollangClient;
  }

  getTexts(): TextItem[] {
    return [...this.state.texts];
  }

  getTranslations(): Map<string, Translation> {
    return new Map(this.state.translations);
  }

  async applyTranslations(targetLanguage: string, textIds?: string[]): Promise<number> {
    this.state.isApplying = true;
    this.state.lastError = null;

    try {
      const translationsToApply =
        textIds && textIds.length > 0
          ? new Map(
              Array.from(this.state.translations.entries()).filter(([id]) => textIds.includes(id))
            )
          : this.state.translations;

      const fs = require('fs').promises;
      const path = require('path');

      const fileGroups = new Map<string, Map<string, string>>();

      for (const [textId, translation] of translationsToApply) {
        if (textId.startsWith('i18n-')) {
          const withoutPrefix = textId.substring(5);

          const jsonIndex = withoutPrefix.indexOf('.json');

          if (jsonIndex > 0) {
            const afterJson = withoutPrefix.substring(jsonIndex + 5);

            if (afterJson.startsWith('-')) {
              const filePath = withoutPrefix.substring(0, jsonIndex + 5);

              // Path traversal protection
              const absoluteFilePath = path.resolve(this.config.projectRoot, filePath);
              if (
                !absoluteFilePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
                absoluteFilePath !== path.resolve(this.config.projectRoot)
              ) {
                logger.warn(`Skipping path outside project root: ${filePath}`);
                continue;
              }

              const key = afterJson.substring(1);

              if (!fileGroups.has(filePath)) {
                fileGroups.set(filePath, new Map());
              }

              fileGroups.get(filePath)!.set(key, translation.translatedText);

              logger.debug(`Mapped: ${key} -> ${filePath}`);
            }
          }
        }
      }

      logger.debug(`Found ${fileGroups.size} files to update`);

      let updatedFiles = 0;

      for (const [originalFilePath, translations] of fileGroups) {
        try {
          const targetFilePath = originalFilePath.replace(
            `/${this.config.sourceLanguage}.json`,
            `/${targetLanguage}.json`
          );

          const absoluteTargetPath = path.resolve(this.config.projectRoot, targetFilePath);
          if (
            !absoluteTargetPath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
            absoluteTargetPath !== path.resolve(this.config.projectRoot)
          ) {
            logger.warn(`Skipping target path outside project root: ${targetFilePath}`);
            continue;
          }

          logger.debug(`Processing: ${targetFilePath}`);

          const targetDir = path.dirname(absoluteTargetPath);
          await fs.mkdir(targetDir, { recursive: true });

          let existingContent: any = {};
          try {
            const content = await fs.readFile(absoluteTargetPath, 'utf-8');
            existingContent = JSON.parse(content);
          } catch (error) {
            logger.debug(`Creating new file: ${targetFilePath}`);
          }

          for (const [key, value] of translations) {
            const keys = key.split('.');
            let current = existingContent;

            for (let i = 0; i < keys.length - 1; i++) {
              if (!current[keys[i]]) {
                current[keys[i]] = {};
              }
              current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
          }

          await fs.writeFile(
            absoluteTargetPath,
            JSON.stringify(existingContent, null, 2) + '\n',
            'utf-8'
          );

          logger.debug(`Updated: ${targetFilePath} (${translations.size} keys)`);
          updatedFiles++;
        } catch (error) {
          logger.error(`Error updating ${originalFilePath}`, error);
        }
      }

      logger.debug(`Applied translations to ${updatedFiles} files`);

      if (this.state.imageTranslations && this.state.imageTranslations.size > 0) {
        logger.debug(`Applying ${this.state.imageTranslations.size} image translations...`);

        for (const [imageId, translation] of this.state.imageTranslations) {
          if (translation.targetLanguage !== targetLanguage) {
            continue;
          }

          if (translation.isUrl) {
            const sourceFile = this.findSourceFileForUrl(imageId);

            if (sourceFile) {
              const absolutePath = path.resolve(this.config.projectRoot, sourceFile);
              await this.addVideoUrlToLocaleMap(
                absolutePath,
                translation.originalPath,
                targetLanguage,
                translation.translatedPath
              );

              updatedFiles++;
            }
          } else {
            const sourceExists = await fs
              .access(translation.originalPath)
              .then(() => true)
              .catch(() => false);

            if (sourceExists) {
              await fs.copyFile(translation.originalPath, translation.translatedPath);
              updatedFiles++;
            }
          }
        }
      }

      for (const [textId, translation] of translationsToApply) {
        if (!textId.startsWith('hardcoded-')) continue;

        const hardItem = this.state.texts.find((t) => t.id === textId);
        if (!hardItem || hardItem.type !== 'hardcoded' || !hardItem.source?.file) continue;

        try {
          await this.applyHardcodedInFile(hardItem, translation.translatedText, targetLanguage);
          updatedFiles++;
          logger.debug(`Applied hardcoded translation for ${textId}`);
        } catch (err) {
          logger.error(`Failed to apply hardcoded translation for ${textId}`, err);
        }
      }

      for (const [textId, translation] of translationsToApply) {
        if (!textId.startsWith('image-')) continue;

        const imageItem = this.state.texts.find((t) => t.id === textId) as any;
        if (!imageItem?._imageData) continue;

        const isUrl = imageItem._imageData.metadata?.isUrl || /^https?:\/\//.test(imageItem.text);
        if (!isUrl) continue;

        const sourceFile = imageItem.source?.file || imageItem._imageData?.path;
        const originalUrl = imageItem.text || imageItem._imageData?.url;
        if (!sourceFile || !originalUrl) continue;

        const absolutePath = path.resolve(this.config.projectRoot, sourceFile);
        if (
          !absolutePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
          absolutePath !== path.resolve(this.config.projectRoot)
        ) {
          logger.warn(`Skipping image path outside project root: ${sourceFile}`);
          continue;
        }

        try {
          await this.addVideoUrlToLocaleMap(
            absolutePath,
            originalUrl,
            targetLanguage,
            translation.translatedText
          );
          updatedFiles++;
          logger.debug(`Applied image URL translation for ${targetLanguage} in ${sourceFile}`);
        } catch (err) {
          logger.error(`Failed to apply image URL translation in ${sourceFile}`, err);
        }
      }

      for (const [textId, translation] of translationsToApply) {
        if (!textId.startsWith('video-')) continue;

        const videoItem = this.state.texts.find((t) => t.id === textId) as any;
        if (!videoItem?._videoData) continue;

        const sourceFile = videoItem.source?.file || videoItem._videoData?.path;
        const originalUrl = videoItem.text || videoItem._videoData?.url;
        if (!sourceFile || !originalUrl) continue;

        const absolutePath = path.resolve(this.config.projectRoot, sourceFile);
        if (
          !absolutePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
          absolutePath !== path.resolve(this.config.projectRoot)
        ) {
          logger.warn(`Skipping video path outside project root: ${sourceFile}`);
          continue;
        }

        try {
          await this.addVideoUrlToLocaleMap(
            absolutePath,
            originalUrl,
            targetLanguage,
            translation.translatedText
          );
          updatedFiles++;
          logger.debug(`Applied video translation for ${targetLanguage} in ${sourceFile}`);
        } catch (err) {
          logger.error(`Failed to apply video translation in ${sourceFile}`, err);
        }
      }

      return updatedFiles;
    } catch (error) {
      this.state.lastError = error as Error;
      throw error;
    } finally {
      this.state.isApplying = false;
    }
  }

  private findSourceFileForUrl(imageId: string): string | null {
    const imageItem = this.state.texts.find((t) => t.id === imageId);

    if (!imageItem) {
      return null;
    }

    if ((imageItem as any)._imageData) {
      const imageData = (imageItem as any)._imageData;
      if (imageData.metadata?.sourceFile) {
        return imageData.metadata.sourceFile;
      }
      if (imageData.metadata?.isUrl) {
        return imageData.path;
      }
    }

    return null;
  }

  private async replaceUrlInFile(filePath: string, oldUrl: string, newUrl: string): Promise<void> {
    const fs = require('fs').promises;

    try {
      let content = await fs.readFile(filePath, 'utf-8');

      const escapedOldUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const regex = new RegExp(`"${escapedOldUrl}"`, 'g');
      content = content.replace(regex, `"${newUrl}"`);

      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      logger.error(`Error replacing URL in ${filePath}`, error);
      throw error;
    }
  }

  private async addVideoUrlToLocaleMap(
    filePath: string,
    originalUrl: string,
    targetLanguage: string,
    translatedUrl: string
  ): Promise<void> {
    const fs = require('fs').promises;

    let content = await fs.readFile(filePath, 'utf-8');
    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const escapedLang = targetLanguage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingAppendRegex = new RegExp(
      `"${escapedUrl}"\\s*/\\*\\s*-\\s*"[^"]*"\\s*\\(${escapedLang}\\)\\s*\\*/`,
      'g'
    );
    if (existingAppendRegex.test(content)) {
      content = content.replace(
        new RegExp(
          `("${escapedUrl}"\\s*/\\*\\s*-)\\s*"[^"]*"(\\s*\\(${escapedLang}\\)\\s*\\*/)`,
          'g'
        ),
        `$1 "${translatedUrl}"$2`
      );
    } else {
      const replacement = `"${originalUrl}" /* - "${translatedUrl}" (${targetLanguage}) */`;
      const urlRegex = new RegExp(`"${escapedUrl}"`, 'g');
      content = content.replace(urlRegex, replacement);
    }

    if (!content.includes(translatedUrl)) {
      throw new Error(`Could not find video URL in ${filePath}`);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  }

  private async applyHardcodedInFile(
    item: TextItem,
    translatedText: string,
    targetLanguage: string
  ): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');
    const absolutePath = path.resolve(this.config.projectRoot, item.source.file);
    if (
      !absolutePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
      absolutePath !== path.resolve(this.config.projectRoot)
    ) {
      throw new Error('Invalid path');
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const lines = content.split('\n');
    const lineIdx = item.source.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) {
      throw new Error('Invalid line');
    }

    let line = lines[lineIdx];
    const originalText = item.text;
    const plainNeedle = `>${originalText}<`;
    const inner = `{${JSON.stringify(originalText)} /* - ${JSON.stringify(translatedText)} (${targetLanguage}) */}`;
    const bracedReplacement = `>${inner}<`;

    if (line.includes(plainNeedle)) {
      lines[lineIdx] = line.replace(plainNeedle, bracedReplacement);
    } else {
      const startSearch = `>{${JSON.stringify(originalText)} /* - "`;
      const startIdx = line.indexOf(startSearch);
      if (startIdx !== -1) {
        const closeIdx = line.indexOf('}<', startIdx);
        if (closeIdx !== -1) {
          lines[lineIdx] = line.slice(0, startIdx) + `>${inner}<` + line.slice(closeIdx + 2);
        } else {
          throw new Error('Invalid hardcoded JSX closing');
        }
      } else {
        throw new Error('Could not find hardcoded text to update');
      }
    }

    await fs.writeFile(absolutePath, lines.join('\n'), 'utf-8');
  }

  async scanVideos(): Promise<VideoContent[]> {
    const detectionConfig = {
      includePaths: ['.'],
      excludePaths: this.config.detection.excludePaths,
      includePatterns: this.config.detection.includePatterns,
    };

    return this.videoDetector.detect(this.config.projectRoot, detectionConfig);
  }

  async scanImages(): Promise<ImageContent[]> {
    const detectionConfig = {
      includePaths: ['.'],
      excludePaths: this.config.detection.excludePaths,
      includePatterns: this.config.detection.includePatterns,
    };

    return this.imageDetector.detect(this.config.projectRoot, detectionConfig);
  }

  async scanAudios(): Promise<AudioContent[]> {
    const detectionConfig = {
      includePaths: ['.'],
      excludePaths: this.config.detection.excludePaths,
      includePatterns: this.config.detection.includePatterns,
    };

    return this.audioDetector.detect(this.config.projectRoot, detectionConfig);
  }

  async scanAll() {
    const [texts, videos, images, audios] = await Promise.all([
      this.scan(),
      this.scanVideos(),
      this.scanImages(),
      this.scanAudios(),
    ]);

    return {
      texts,
      videos,
      images,
      audios,
      total: texts.length + videos.length + images.length + audios.length,
    };
  }

  async translateVideo(
    video: VideoContent,
    targetLanguage: string,
    level: number = this.config.ollang.defaultLevel,
    folderName?: string,
    folderId?: string
  ): Promise<string> {
    const videoOrderType = (this.config.video?.translationType ||
      (typeof process !== 'undefined' && process.env?.VIDEO_TRANSLATION_TYPE) ||
      'aiDubbing') as 'aiDubbing' | 'subtitle';

    const isUrl = video.metadata?.isUrl || (video.url && !video.path);

    let videoFolderId = folderId;
    if (!videoFolderId && folderName) {
      try {
        const client = this.ollangClient.getClient();
        const folders =
          await client.get<Array<{ id: string; name: string; projectId?: string }>>(
            '/scans/folders'
          );
        const targetFolder = folders.find((f) => f.name === folderName);
        if (targetFolder?.id) {
          videoFolderId = targetFolder.id;
          logger.debug(`Resolved folderId ${videoFolderId} for video upload`);
        }
      } catch (error) {
        logger.warn(`Could not resolve folderId for video upload: ${error}`);
      }
    }

    let orderId: string;

    if (isUrl && video.url) {
      const getFilenameFromUrl = (url: string): string => {
        const urlWithoutQuery = url.split('?')[0];
        const parts = urlWithoutQuery.split('/');
        return parts[parts.length - 1] || 'video.mp4';
      };

      const filename = getFilenameFromUrl(video.url);

      const uploadParams: Record<string, unknown> = {
        url: video.url,
        originalname: filename,
        size: video.metadata?.size && video.metadata.size > 0 ? video.metadata.size : 1,
        sourceLanguage: this.config.sourceLanguage,
      };
      if (videoFolderId) {
        uploadParams.folderId = videoFolderId;
      }

      const uploadResponse = await this.ollangClient
        .getClient()
        .post<{ projectId: string }>('/integration/upload/direct-url', uploadParams);

      const projectId = uploadResponse.projectId;

      const orderParams = {
        orderType: videoOrderType,
        level,
        projectId,
        targetLanguageConfigs: [
          {
            language: targetLanguage,
            isRush: false,
          },
        ],
      };

      const order = await this.ollangClient.orders.create(orderParams);
      orderId = order.id;
    } else {
      const FormData = require('form-data');
      const fs = require('fs');
      const formData = new FormData();

      formData.append('file', fs.createReadStream(video.path));
      formData.append('name', `Video-Dubbing-${Date.now()}`);
      formData.append('sourceLanguage', this.config.sourceLanguage);
      if (videoFolderId) {
        formData.append('folderId', videoFolderId);
      }

      const uploadResponse = await this.ollangClient
        .getClient()
        .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);

      const projectId = uploadResponse.projectId;

      const orderParams = {
        orderType: videoOrderType,
        level,
        projectId,
        targetLanguageConfigs: [
          {
            language: targetLanguage,
            isRush: false,
          },
        ],
      };

      const order = await this.ollangClient.orders.create(orderParams);
      orderId = order.id;
    }

    const order = await this.pollVideoOrderStatus(orderId);
    const outputUrl = await this.pollUntilVideoOutput(orderId, order, videoOrderType);
    return outputUrl || `Order: ${orderId}`;
  }

  private async pollVideoOrderStatus(orderId: string): Promise<any> {
    const maxAttempts = 240; // 20 min at 5s interval
    let attempts = 0;

    while (attempts < maxAttempts) {
      const order = await this.ollangClient.orders.get(orderId);
      logger.debug(
        `Video order ${orderId} poll #${attempts + 1}/${maxAttempts}: status=${order.status}`
      );

      if (order.status === 'completed') {
        return order;
      }

      if (order.status === 'failed' || order.status === 'cancelled') {
        throw new Error(`Video order ${orderId} ${order.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error(`Video order ${orderId} timed out after ${maxAttempts * 5} seconds (20 min)`);
  }

  private async pollImageDocumentOrder(orderId: string): Promise<any> {
    const maxAttempts = 240;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const order = await this.ollangClient.orders.get(orderId);
      logger.debug(
        `Image document order ${orderId} poll #${attempts + 1}/${maxAttempts}: status=${order.status}`
      );

      if (order.status === 'completed') {
        return order;
      }

      if (order.status === 'failed' || order.status === 'cancelled') {
        throw new Error(`Image document order ${orderId} ${order.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error(
      `Image document order ${orderId} timed out after ${maxAttempts * 5} seconds (20 min)`
    );
  }

  private async pollUntilImageOutput(orderId: string, order: any): Promise<string | null> {
    let currentOrder = order;
    const maxRetries = 8;
    let retries = 0;

    while (retries <= maxRetries) {
      const url = await this.extractTranslatedImageUrl(currentOrder);
      logger.debug(
        `Image output poll for order ${orderId} (${retries + 1}/${maxRetries + 1}): ${url ? 'found' : 'not yet'}`
      );
      if (url) {
        return url;
      }
      if (retries < maxRetries) {
        logger.debug(
          `Translated image URL not yet available for order ${orderId}, retrying in 15s (${retries + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, 15000));
        currentOrder = await this.ollangClient.orders.get(orderId);
        retries++;
      } else {
        break;
      }
    }
    return null;
  }

  /** Resolves final image URL from a completed document (image-translation) order. */
  private async extractTranslatedImageUrl(order: any): Promise<string | null> {
    let documents =
      order?.documents || order?.targetDocuments || order?.orderDocs || order?.docs || [];

    if (!Array.isArray(documents) && order?.document) {
      documents = [order.document];
    }

    const isTranslatedImageDoc = (d: any): boolean => {
      const t = String(d?.type ?? '').toLowerCase();
      return t === 'translated_image' || t.endsWith('translated_image');
    };

    const isLikelyImageAssetName = (name: unknown): boolean =>
      typeof name === 'string' && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);

    if (documents.length > 0) {
      const doc =
        documents.find(isTranslatedImageDoc) ||
        documents.find(
          (d: any) => d?.type === 'translator_document' && isLikelyImageAssetName(d?.name)
        ) ||
        documents.find((d: any) => isLikelyImageAssetName(d?.name));
      const url = doc?.url ?? doc?.targetDocumentUrl ?? doc?.documentUrl;
      if (url && typeof url === 'string') {
        logger.debug(`Found translated image URL on order: ${url}`);
        return url;
      }
    }

    if (order?.projectId) {
      try {
        const project = await this.ollangClient.projects.get(order.projectId);
        const targetDocs =
          (project as any)?.targetDocuments ||
          (project as any)?.docs ||
          (project as any)?.projectDocs ||
          [];
        const doc =
          (Array.isArray(targetDocs) ? targetDocs : []).find(isTranslatedImageDoc) ||
          (Array.isArray(targetDocs) ? targetDocs : []).find(
            (d: any) => d?.type === 'translator_document' && isLikelyImageAssetName(d?.name)
          ) ||
          (Array.isArray(targetDocs) ? targetDocs : []).find((d: any) =>
            isLikelyImageAssetName(d?.name)
          );
        const url = doc?.url ?? doc?.targetDocumentUrl ?? doc?.documentUrl;
        if (url && typeof url === 'string') {
          logger.debug(`Found translated image URL on project: ${url}`);
          return url;
        }
      } catch (err: any) {
        logger.error('Error fetching translated image from project', err);
      }
    }

    return null;
  }

  private async pollUntilVideoOutput(
    orderId: string,
    order: any,
    videoOrderType: 'aiDubbing' | 'subtitle' = 'aiDubbing'
  ): Promise<string | null> {
    let currentOrder = order;
    const maxRetries = 5;
    let retries = 0;

    while (retries <= maxRetries) {
      const url = await this.extractVideoOutput(currentOrder, videoOrderType);
      logger.debug(
        `Video output poll for order ${orderId} (${retries + 1}/${maxRetries + 1}): ${url ? 'found' : 'not yet'}`
      );
      if (url) {
        return url;
      }
      if (retries < maxRetries) {
        logger.debug(
          `Video URL not yet available for order ${orderId}, retrying in 15s (${retries + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, 15000));
        currentOrder = await this.ollangClient.orders.get(orderId);
        retries++;
      } else {
        break;
      }
    }
    return null;
  }

  private async extractVideoOutput(
    order: any,
    videoOrderType: 'aiDubbing' | 'subtitle' = 'aiDubbing'
  ): Promise<string | null> {
    if (videoOrderType === 'subtitle') {
      const vttUrl = order?.vttUrl ?? order?.vttFileUrl;
      if (vttUrl) {
        logger.debug(`Found subtitle VTT URL in order: ${vttUrl}`);
        return vttUrl;
      }
    }

    let documents =
      order?.documents || order?.targetDocuments || order?.orderDocs || order?.docs || [];

    if (!Array.isArray(documents) && order?.document) {
      documents = [order.document];
    }

    if (documents.length > 0) {
      const doc =
        documents.find((d: any) => d?.type === 'created_embedded_video') ||
        documents.find((d: any) => d?.type === 'created_ai_dub_audio');
      const url = doc?.url ?? doc?.targetDocumentUrl ?? doc?.documentUrl;
      if (url) {
        logger.debug(`Found dubbed video URL in order: ${url}`);
        return url;
      }
    }

    if (order?.projectId) {
      try {
        const project = await this.ollangClient.projects.get(order.projectId);
        const targetDocs = (project as any)?.targetDocuments || (project as any)?.docs || [];
        const doc =
          targetDocs.find((d: any) => d?.type === 'created_embedded_video') ||
          targetDocs.find((d: any) => d?.type === 'created_ai_dub_audio');
        const url = doc?.url ?? doc?.targetDocumentUrl ?? doc?.documentUrl;
        if (url) {
          logger.debug(`Found dubbed video URL in project: ${url}`);
          return url;
        }
      } catch (err: any) {
        logger.error('Error fetching video from project', err);
      }
    }

    return null;
  }

  /**
   * Creates a `document` order with an image source (v3 image-translation / n8n path),
   * polls until the order completes, then returns the translated image URL (or `Order: {id}` if URL not yet on payload).
   */
  async translateImage(
    image: ImageContent,
    targetLanguage: string,
    level: number = this.config.ollang.defaultLevel,
    folderName?: string,
    folderId?: string
  ): Promise<string> {
    const path = require('path');
    const FormData = require('form-data');
    const fs = require('fs');

    let translatedPath: string;
    const isUrl = image.metadata?.isUrl || !!(image.url && !image.path);

    if (isUrl && image.url) {
      translatedPath = `${image.url}-${targetLanguage}`;
    } else {
      const ext = path.extname(image.path);
      const basePath = ext ? image.path.slice(0, -ext.length) : image.path;
      translatedPath = `${basePath}-${targetLanguage}${ext || ''}`;
    }

    if (!this.state.imageTranslations) {
      this.state.imageTranslations = new Map();
    }

    const mapKey = (image as any).textItemId || image.id;

    let imageFolderId = folderId;
    if (!imageFolderId && folderName) {
      try {
        const client = this.ollangClient.getClient();
        const folders =
          await client.get<Array<{ id: string; name: string; projectId?: string }>>(
            '/scans/folders'
          );
        const targetFolder = folders.find((f) => f.name === folderName);
        if (targetFolder?.id) {
          imageFolderId = targetFolder.id;
          logger.debug(`Resolved folderId ${imageFolderId} for image upload`);
        }
      } catch (error) {
        logger.warn(`Could not resolve folderId for image upload: ${error}`);
      }
    }

    const getFilenameFromUrl = (url: string): string => {
      const urlWithoutQuery = url.split('?')[0];
      const parts = urlWithoutQuery.split('/');
      return parts[parts.length - 1] || 'image.png';
    };

    const ensureImageFileNameForPipeline = (name: string): string => {
      const lower = name.toLowerCase();
      if (/\.(jpe?g|png)$/.test(lower)) {
        return name;
      }
      const base = name.replace(/\.[^/.]+$/, '');
      return `${base || 'image'}.png`;
    };

    let projectId: string;

    if (isUrl && image.url) {
      let filename = ensureImageFileNameForPipeline(getFilenameFromUrl(image.url));
      const uploadParams: Record<string, unknown> = {
        url: image.url,
        originalname: filename,
        size: image.metadata?.size && image.metadata.size > 0 ? image.metadata.size : 1,
        sourceLanguage: this.config.sourceLanguage,
      };
      if (imageFolderId) {
        uploadParams.folderId = imageFolderId;
      }

      const uploadResponse = await this.ollangClient
        .getClient()
        .post<{ projectId: string }>('/integration/upload/direct-url', uploadParams);
      projectId = uploadResponse.projectId;
    } else {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(image.path));
      formData.append('name', `Image-Translation-${Date.now()}`);
      formData.append('sourceLanguage', this.config.sourceLanguage);
      if (imageFolderId) {
        formData.append('folderId', imageFolderId);
      }

      const uploadResponse = await this.ollangClient
        .getClient()
        .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);
      projectId = uploadResponse.projectId;
    }

    const order = await this.ollangClient.orders.create({
      orderType: 'document',
      level,
      projectId,
      targetLanguageConfigs: [
        {
          language: targetLanguage,
          isRush: false,
        },
      ],
    });

    const orderId = order.id;

    this.state.imageTranslations.set(mapKey, {
      originalPath: isUrl ? image.url! : image.path,
      translatedPath,
      targetLanguage,
      isUrl,
      orderId,
    });

    const completedOrder = await this.pollImageDocumentOrder(orderId);
    const outputUrl = await this.pollUntilImageOutput(orderId, completedOrder);
    const resolvedPath = outputUrl || translatedPath;
    const result = outputUrl || `Order: ${orderId}`;

    this.state.imageTranslations.set(mapKey, {
      originalPath: isUrl ? image.url! : image.path,
      translatedPath: resolvedPath,
      targetLanguage,
      isUrl,
      orderId,
    });

    return result;
  }

  async translateAudio(
    audio: AudioContent,
    targetLanguage: string,
    level: number = this.config.ollang.defaultLevel
  ): Promise<string> {
    const FormData = require('form-data');
    const fs = require('fs');
    const formData = new FormData();

    formData.append('file', fs.createReadStream(audio.path));
    formData.append('name', `Audio-Dubbing-${Date.now()}`);
    formData.append('sourceLanguage', this.config.sourceLanguage);

    const uploadResponse = await this.ollangClient
      .getClient()
      .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);

    const projectId = uploadResponse.projectId;

    const orderParams = {
      orderType: 'aiDubbing' as const,
      level,
      projectId,
      targetLanguageConfigs: [
        {
          language: targetLanguage,
          isRush: false,
        },
      ],
    };

    const order = await this.ollangClient.orders.create(orderParams);

    return order.id;
  }

  private createInitialState(): TMSState {
    return {
      config: this.config,
      texts: [],
      i18nSetup: null,
      selectedTextIds: new Set(),
      currentOrder: null,
      translations: new Map(),
      editedTranslations: new Map(),
      panelVisible: false,
      panelMinimized: false,
      previewActive: false,
      searchQuery: '',
      activeFilters: [],
      isScanning: false,
      isTranslating: false,
      isApplying: false,
      lastError: null,
    };
  }
}
