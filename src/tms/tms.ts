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
        console.error(`   ❌ Error checking translation for ${text.id}:`, error);
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

    let changedCount = 0;
    let submittedCount = 0;

    for (const text of this.state.texts) {
      if (!text.id.startsWith('i18n-')) continue;

      const statusByLanguage = (text as any).statusByLanguage || {};
      const langStatus = statusByLanguage[targetLanguage];

      const isSubmittedGlobal = text.status === 'submitted';
      const isSubmittedLang = langStatus === 'submitted';

      if (!isSubmittedGlobal && !isSubmittedLang) continue;

      const hasTranslationForThisLanguage = text.translations && text.translations[targetLanguage];

      if (!hasTranslationForThisLanguage) {
        continue;
      }

      submittedCount++;

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
              changedCount++;
            } else if (existsInCodebase && hasTranslation) {
              if (text.status !== 'submitted') {
                text.status = 'submitted';
                changedCount++;
              }
              if (!(text as any).statusByLanguage) {
                (text as any).statusByLanguage = {};
              }
              if ((text as any).statusByLanguage[targetLanguage] !== 'submitted') {
                (text as any).statusByLanguage[targetLanguage] = 'submitted';
                changedCount++;
              }
            }
          }
        }
      } catch (error) {
        console.error(`   ❌ Error syncing ${text.id}:`, error);
      }
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
      console.error('❌ Translation Error Details:');
      console.error('   Error:', error);
      if (error instanceof Error) {
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
      }
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
      console.log(`📁 Using provided folderId: ${params.folderId}`);
      formData.append('folderId', params.folderId);
    } else if (params.folderName) {
      console.log(`📁 Getting folderId for folder: ${params.folderName}`);
      try {
        const axios = require('axios');
        const response = await axios.get('http://localhost:5972/api/folders');
        const folders = response.data.folders || [];
        const targetFolder = folders.find((f: any) => f.name === params.folderName);

        if (targetFolder && targetFolder.id) {
          console.log(`📁 Found folderId: ${targetFolder.id}`);
          formData.append('folderId', targetFolder.id);
        } else {
          console.warn(`⚠️  Folder "${params.folderName}" not found in folders list`);
        }
      } catch (error) {
        console.warn('⚠️  Could not get folder list:', error);
      }
    } else if (params.projectId) {
      console.log(`📌 Getting folder from project: ${params.projectId}`);
      try {
        const project = await this.ollangClient.projects.get(params.projectId);
        if (project.folderId) {
          console.log(`📁 Found folderId: ${project.folderId}`);
          formData.append('folderId', project.folderId);
        }
      } catch (error) {
        console.warn('⚠️  Could not get project folder:', error);
      }
    }

    console.log('📤 Uploading document...');
    const uploadResponse = await this.ollangClient
      .getClient()
      .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);

    const projectId = uploadResponse.projectId;
    console.log(`✅ Document uploaded, project: ${projectId}`);

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

    console.log('📤 Creating order with params:');
    console.log(JSON.stringify(orderParams, null, 2));

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
    const maxAttempts = 120;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const order = await this.ollangClient.orders.get(orderId);

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

    throw new Error(`Order ${orderId} timed out after ${maxAttempts * 5} seconds`);
  }

  private async extractTranslations(order: any): Promise<void> {
    try {
      let documents = order.documents || order.targetDocuments || order.orderDocs || [];

      if (!Array.isArray(documents) && order.document) {
        documents = [order.document];
      }

      if (documents.length > 0) {
        console.log(`Found ${documents.length} documents`);

        for (const doc of documents) {
          const documentUrl = doc.targetDocumentUrl || doc.url || doc.documentUrl;

          if (documentUrl) {
            console.log(`📥 Downloading translated document: ${documentUrl}`);

            const axios = require('axios');
            const response = await axios.get(documentUrl, {
              responseType: 'json',
            });

            const translatedData = response.data;
            console.log('📄 Translated document:', JSON.stringify(translatedData, null, 2));

            if (translatedData.slides && Array.isArray(translatedData.slides)) {
              for (const slide of translatedData.slides) {
                if (slide.textElements && Array.isArray(slide.textElements)) {
                  for (const element of slide.textElements) {
                    if (!element || !element.id || !element.text) continue;

                    const id: string = element.id;

                    const isCmsField = id.startsWith('cms-entry-') || id.includes('__');
                    const isKnownText = this.state.texts.some((t) => t.id === id);

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
            console.warn('⚠️  Document URL not found in document:', doc);
          }
        }

        console.log(`✅ Extracted ${this.state.translations.size} translations`);
      } else {
        console.log('⚠️  No documents found in order, trying alternative methods...');

        if (order.projectId) {
          console.log(`📥 Fetching documents from project: ${order.projectId}`);

          try {
            const project = await this.ollangClient.projects.get(order.projectId);
            console.log('📋 Project structure:', JSON.stringify(project, null, 2));

            if ((project as any).targetDocuments && (project as any).targetDocuments.length > 0) {
              const targetDoc = (project as any).targetDocuments[0];
              const documentUrl = targetDoc.url || targetDoc.documentUrl;

              if (documentUrl) {
                console.log(`📥 Downloading from project: ${documentUrl}`);
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
            console.error('❌ Error fetching from project:', error);
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
      console.error('❌ Error extracting translations:', error);
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
              if (!absoluteFilePath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
                  absoluteFilePath !== path.resolve(this.config.projectRoot)) {
                console.warn(`   ⚠️ Skipping path outside project root: ${filePath}`);
                continue;
              }

              const key = afterJson.substring(1);

              if (!fileGroups.has(filePath)) {
                fileGroups.set(filePath, new Map());
              }

              fileGroups.get(filePath)!.set(key, translation.translatedText);

              console.log(`   Mapped: ${key} -> ${filePath}`);
            }
          }
        }
      }

      console.log(`   Found ${fileGroups.size} files to update`);

      let updatedFiles = 0;

      for (const [originalFilePath, translations] of fileGroups) {
        try {
          const targetFilePath = originalFilePath.replace(
            `/${this.config.sourceLanguage}.json`,
            `/${targetLanguage}.json`
          );

          const absoluteTargetPath = path.resolve(this.config.projectRoot, targetFilePath);
          if (!absoluteTargetPath.startsWith(path.resolve(this.config.projectRoot) + path.sep) &&
              absoluteTargetPath !== path.resolve(this.config.projectRoot)) {
            console.warn(`   ⚠️ Skipping target path outside project root: ${targetFilePath}`);
            continue;
          }

          console.log(`   Processing: ${targetFilePath}`);

          const targetDir = path.dirname(absoluteTargetPath);
          await fs.mkdir(targetDir, { recursive: true });

          let existingContent: any = {};
          try {
            const content = await fs.readFile(absoluteTargetPath, 'utf-8');
            existingContent = JSON.parse(content);
          } catch (error) {
            console.log(`   Creating new file: ${targetFilePath}`);
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

          console.log(`   ✅ Updated: ${targetFilePath} (${translations.size} keys)`);
          updatedFiles++;
        } catch (error) {
          console.error(`   ❌ Error updating ${originalFilePath}:`, error);
        }
      }

      console.log(`✅ Applied translations to ${updatedFiles} files`);

      if (this.state.imageTranslations && this.state.imageTranslations.size > 0) {
        console.log(`\n🖼️  Applying ${this.state.imageTranslations.size} image translations...`);

        for (const [imageId, translation] of this.state.imageTranslations) {
          if (translation.targetLanguage !== targetLanguage) {
            continue;
          }

          if (translation.isUrl) {
            const sourceFile = this.findSourceFileForUrl(imageId);

            if (sourceFile) {
              await this.replaceUrlInFile(
                sourceFile,
                translation.originalPath,
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
      content = content.replace(regex, `"${oldUrl}","${newUrl}"`);

      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      console.error(`   ❌ Error replacing URL in ${filePath}:`, error);
      throw error;
    }
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
    level: number = this.config.ollang.defaultLevel
  ): Promise<string> {
    const isUrl = video.metadata?.isUrl || (video.url && !video.path);

    if (isUrl && video.url) {
      const getFilenameFromUrl = (url: string): string => {
        const urlWithoutQuery = url.split('?')[0];
        const parts = urlWithoutQuery.split('/');
        return parts[parts.length - 1] || 'video.mp4';
      };

      const filename = getFilenameFromUrl(video.url);

      const uploadParams = {
        url: video.url,
        originalname: filename,
        size: video.metadata?.size || 0,
        sourceLanguage: this.config.sourceLanguage,
      };

      const uploadResponse = await this.ollangClient
        .getClient()
        .post<{ projectId: string }>('/integration/upload/direct-url', uploadParams);

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
    } else {
      const FormData = require('form-data');
      const fs = require('fs');
      const formData = new FormData();

      formData.append('file', fs.createReadStream(video.path));
      formData.append('name', `Video-Dubbing-${Date.now()}`);
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
  }

  async translateImage(
    image: ImageContent,
    targetLanguage: string,
    level: number = this.config.ollang.defaultLevel
  ): Promise<string> {
    const path = require('path');

    let translatedPath: string;
    const isUrl = image.metadata.isUrl || false;

    if (isUrl && image.url) {
      translatedPath = `${image.url}-${targetLanguage}`;
    } else {
      const ext = path.extname(image.path);
      const basePath = image.path.slice(0, -ext.length);
      translatedPath = `${basePath}-${targetLanguage}${ext}`;
    }

    const mockOrderId = `mock-image-${Date.now()}`;

    if (!this.state.imageTranslations) {
      this.state.imageTranslations = new Map();
    }

    const mapKey = (image as any).textItemId || image.id;

    this.state.imageTranslations.set(mapKey, {
      originalPath: isUrl ? image.url! : image.path,
      translatedPath,
      targetLanguage,
      isUrl,
      orderId: mockOrderId,
    });

    return mockOrderId;
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
