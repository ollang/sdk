import { Ollang } from '../index.js';
import { TextDetector } from './detector/text-detector.js';
import { VideoDetector } from './detector/video-detector.js';
import { ImageDetector } from './detector/image-detector.js';
import { ConfigManager } from './config.js';
import {
  AnyContentItem,
  ContentType,
  VideoContent,
  ImageContent,
  I18nContent,
} from './detector/content-type-detector.js';
import { TMSConfig } from './types.js';
import { OrderType, CreateOrderParams } from '../types/index.js';
import { logger } from '../logger.js';

export interface MultiContentScanResult {
  i18n: I18nContent[];
  videos: VideoContent[];
  images: ImageContent[];
  total: number;
}

export interface TranslationRequest {
  contentType: ContentType;
  items: AnyContentItem[];
  targetLanguage: string;
  level?: number;
}

export interface TranslationResult {
  orderId: string;
  orderType: OrderType;
  status: string;
  contentType: ContentType;
  itemCount: number;
}

export class MultiContentTMS {
  private config: TMSConfig;
  private configManager: ConfigManager;
  private ollangClient: Ollang;

  private textDetector: TextDetector;
  private videoDetector: VideoDetector;
  private imageDetector: ImageDetector;

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
  }

  async scanAll(): Promise<MultiContentScanResult> {
    logger.debug('Scanning project for all content types...');

    const detectionConfig = {
      includePaths: this.config.detection.includePaths.map(
        (p) => `${this.config.projectRoot}/${p}`
      ),
      excludePaths: this.config.detection.excludePaths,
      includePatterns: this.config.detection.includePatterns,
    };

    const [i18nTexts, videos, images] = await Promise.all([
      this.scanI18n(),
      this.videoDetector.detect(this.config.projectRoot, detectionConfig),
      this.imageDetector.detect(this.config.projectRoot, detectionConfig),
    ]);

    const i18nContent: I18nContent[] = i18nTexts.map((text) => ({
      id: text.id,
      type: 'i18n' as const,
      path: text.source.file,
      metadata: {
        key: text.i18nKey || text.id,
        namespace: text.i18nNamespace,
        text: text.text,
      },
    }));

    const result = {
      i18n: i18nContent,
      videos,
      images,
      total: i18nContent.length + videos.length + images.length,
    };

    return result;
  }

  private async scanI18n() {
    const scanConfig = {
      includePaths: this.config.detection.includePaths.map(
        (p) => `${this.config.projectRoot}/${p}`
      ),
      excludePaths: this.config.detection.excludePaths,
      includePatterns: this.config.detection.includePatterns,
      detectI18n: true,
      detectHardcoded: true,
      detectCMS: false,
      sourceLanguage: this.config.sourceLanguage,
    };

    return this.textDetector.scan(scanConfig);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const level = request.level || this.config.ollang.defaultLevel;

    switch (request.contentType) {
      case 'video':
        return this.translateVideos(request.items as VideoContent[], request.targetLanguage, level);

      case 'image':
        return this.translateImages(request.items as ImageContent[], request.targetLanguage, level);

      case 'i18n':
        return this.translateI18n(request.items as I18nContent[], request.targetLanguage, level);

      default:
        throw new Error(`Unsupported content type: ${request.contentType}`);
    }
  }

  private async translateVideos(
    videos: VideoContent[],
    targetLanguage: string,
    level: number
  ): Promise<TranslationResult> {
    logger.debug('Creating AI Dubbing orders for videos...');

    if (videos.length === 0) {
      throw new Error('No videos to translate');
    }

    const video = videos[0];

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

    const orderParams: CreateOrderParams = {
      orderType: 'aiDubbing',
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

    return {
      orderId: order.id,
      orderType: 'aiDubbing',
      status: 'pending',
      contentType: 'video',
      itemCount: videos.length,
    };
  }

  private async translateImages(
    images: ImageContent[],
    targetLanguage: string,
    level: number
  ): Promise<TranslationResult> {
    if (images.length === 0) {
      throw new Error('No images to translate');
    }

    const image = images[0];
    const isUrl = image.metadata?.isUrl || !!(image.url && !image.path);

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
      const uploadResponse = await this.ollangClient
        .getClient()
        .post<{ projectId: string }>('/integration/upload/direct-url', {
          url: image.url,
          originalname: filename,
          size: image.metadata?.size && image.metadata.size > 0 ? image.metadata.size : 1,
          sourceLanguage: this.config.sourceLanguage,
        });
      projectId = uploadResponse.projectId;
    } else {
      const FormData = require('form-data');
      const fs = require('fs');
      const formData = new FormData();

      formData.append('file', fs.createReadStream(image.path));
      formData.append('name', `Image-Translation-${Date.now()}`);
      formData.append('sourceLanguage', this.config.sourceLanguage);

      const uploadResponse = await this.ollangClient
        .getClient()
        .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);

      projectId = uploadResponse.projectId;
    }

    const orderParams: CreateOrderParams = {
      orderType: 'document',
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

    return {
      orderId: order.id,
      orderType: 'document',
      status: 'pending',
      contentType: 'image',
      itemCount: images.length,
    };
  }

  private async translateI18n(
    items: I18nContent[],
    targetLanguage: string,
    level: number
  ): Promise<TranslationResult> {
    const documentData = {
      metadata: {
        filename: `i18n-translation-${Date.now()}.json`,
        createdAt: new Date().toISOString(),
        type: 'i18n',
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage,
        totalTexts: items.length,
      },
      slides: [
        {
          id: 'i18n_content',
          index: 1,
          textElements: items.map((item) => ({
            id: item.id,
            text: item.metadata.text,
          })),
        },
      ],
    };

    const FormData = require('form-data');
    const formData = new FormData();

    const jsonContent = JSON.stringify(documentData, null, 2);
    const jsonBlob = Buffer.from(jsonContent, 'utf-8');

    formData.append('file', jsonBlob, {
      filename: `i18n-translation-${Date.now()}.json`,
      contentType: 'application/json',
    });
    formData.append('name', `I18n-Translation-${Date.now()}`);
    formData.append('sourceLanguage', this.config.sourceLanguage);

    const uploadResponse = await this.ollangClient
      .getClient()
      .uploadFile<{ projectId: string }>('/integration/upload/direct', formData);

    const projectId = uploadResponse.projectId;

    const orderParams: CreateOrderParams = {
      orderType: 'document',
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

    return {
      orderId: order.id,
      orderType: 'document',
      status: 'pending',
      contentType: 'i18n',
      itemCount: items.length,
    };
  }

  async getOrderStatus(orderId: string) {
    return this.ollangClient.orders.get(orderId);
  }

  async waitForCompletion(orderId: string, maxWaitSeconds: number = 1200): Promise<any> {
    const maxAttempts = Math.floor(maxWaitSeconds / 5); // 20 min default
    let attempts = 0;

    logger.debug(`Waiting for order ${orderId} to complete... (max ${maxWaitSeconds}s)`);

    while (attempts < maxAttempts) {
      const order = await this.ollangClient.orders.get(orderId);
      logger.debug(`Order ${orderId} poll #${attempts + 1}/${maxAttempts}: status=${order.status}`);

      if (order.status === 'completed') {
        logger.debug(`Order ${orderId} completed`);
        return order;
      }

      if (order.status === 'failed' || order.status === 'cancelled') {
        throw new Error(`Order ${orderId} ${order.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error(`Order ${orderId} timed out after ${maxWaitSeconds} seconds (20 min)`);
  }

  getSDK(): Ollang {
    return this.ollangClient;
  }

  getConfig(): TMSConfig {
    return { ...this.config };
  }
}
