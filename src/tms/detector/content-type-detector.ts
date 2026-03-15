export type ContentType = 'i18n' | 'hardcoded' | 'video' | 'image' | 'audio' | 'document' | 'cms';

export interface ContentItem {
  id: string;
  type: ContentType;
  path: string;
  metadata: Record<string, any>;
}

export interface I18nContent extends ContentItem {
  type: 'i18n';
  metadata: {
    key: string;
    namespace?: string;
    text: string;
  };
}

export interface VideoContent extends ContentItem {
  type: 'video';
  filename?: string;
  url?: string;
  line?: number;
  column?: number;
  metadata: {
    duration: number;
    format: string;
    hasSubtitles: boolean;
    subtitlePath?: string;
    size?: number;
    isUrl?: boolean;
    sourceFile?: string;
  };
}

export interface ImageContent extends ContentItem {
  type: 'image';
  filename?: string;
  url?: string;
  line?: number;
  column?: number;
  metadata: {
    hasText: boolean;
    detectedText?: string[];
    format: string;
    size?: number;
    isUrl?: boolean;
    sourceFile?: string;
  };
}

export interface AudioContent extends ContentItem {
  type: 'audio';
  filename?: string;
  url?: string;
  line?: number;
  column?: number;
  metadata: {
    duration: number;
    format: string;
    size?: number;
    isUrl?: boolean;
    sourceFile?: string;
  };
}

export interface HardcodedTextContent extends ContentItem {
  type: 'hardcoded';
  metadata: {
    text: string;
    line: number;
    column: number;
    context: string;
  };
}

export type AnyContentItem =
  | I18nContent
  | VideoContent
  | ImageContent
  | AudioContent
  | HardcodedTextContent;

export interface ContentDetector<T extends ContentItem = ContentItem> {
  detect(projectRoot: string, config: DetectionConfig): Promise<T[]>;
  supports(filePath: string): boolean;
}

export interface DetectionConfig {
  includePaths: string[];
  excludePaths: string[];
  includePatterns: string[];
}
