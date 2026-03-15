import * as fs from 'fs/promises';
import * as path from 'path';
import { ContentDetector, DetectionConfig } from './content-type-detector.js';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma', '.opus'];

const AUDIO_URL_PATTERNS = [
  /https?:\/\/[^\s"']+\.mp3/gi,
  /https?:\/\/[^\s"']+\.wav/gi,
  /https?:\/\/[^\s"']+\.m4a/gi,
  /https?:\/\/[^\s"']+\.aac/gi,
  /https?:\/\/[^\s"']+\.ogg/gi,
  /https?:\/\/[^\s"']+\.flac/gi,
  /https?:\/\/[^\s"']*amazonaws\.com[^\s"']*\.(mp3|wav|m4a|aac|ogg|flac)/gi,
  /https?:\/\/[^\s"']*cloudfront\.net[^\s"']*\.(mp3|wav|m4a|aac|ogg|flac)/gi,
];

export interface AudioContent {
  id: string;
  type: 'audio';
  path: string;
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

export class AudioDetector implements ContentDetector<AudioContent> {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
  }

  async detect(projectRoot: string, config: DetectionConfig): Promise<AudioContent[]> {
    const audios: AudioContent[] = [];

    for (const includePath of config.includePaths) {
      const fullPath = path.join(projectRoot, includePath);

      const physicalAudios = await this.scanDirectory(fullPath, config.excludePaths);
      audios.push(...physicalAudios);

      const urlAudios = await this.scanForAudioUrls(fullPath, config.excludePaths);
      audios.push(...urlAudios);
    }

    return audios;
  }

  private async scanDirectory(dirPath: string, excludePaths: string[]): Promise<AudioContent[]> {
    const audios: AudioContent[] = [];

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (this.shouldExclude(fullPath, excludePaths)) {
        continue;
      }

      if (item.isDirectory()) {
        const subAudios = await this.scanDirectory(fullPath, excludePaths);
        audios.push(...subAudios);
      } else if (item.isFile() && this.supports(item.name)) {
        const audioContent = await this.analyzeAudio(fullPath);
        audios.push(audioContent);
      }
    }

    return audios;
  }

  private async analyzeAudio(filePath: string): Promise<AudioContent> {
    const stat = await fs.stat(filePath);
    const filename = path.basename(filePath);

    return {
      id: `audio-${filePath}`,
      type: 'audio',
      path: filePath,
      filename,
      metadata: {
        duration: 0,
        format: path.extname(filePath).substring(1),
        size: stat.size,
      },
    };
  }

  private shouldExclude(filePath: string, excludePaths: string[]): boolean {
    return excludePaths.some((exclude) => filePath.includes(exclude));
  }

  private async scanForAudioUrls(dirPath: string, excludePaths: string[]): Promise<AudioContent[]> {
    const audios: AudioContent[] = [];
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.html'];

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (this.shouldExclude(fullPath, excludePaths)) {
        continue;
      }

      if (item.isDirectory()) {
        const subAudios = await this.scanForAudioUrls(fullPath, excludePaths);
        audios.push(...subAudios);
      } else if (item.isFile() && codeExtensions.includes(path.extname(item.name).toLowerCase())) {
        const foundUrls = await this.extractAudioUrls(fullPath);
        audios.push(...foundUrls);
      }
    }

    return audios;
  }

  private async extractAudioUrls(filePath: string): Promise<AudioContent[]> {
    const audios: AudioContent[] = [];

    const content = await fs.readFile(filePath, 'utf-8');
    const foundUrls = new Set<string>();
    const lines = content.split('\n');

    for (const pattern of AUDIO_URL_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        foundUrls.add(match[0]);
      }
    }

    for (const url of foundUrls) {
      const format = this.getFormatFromUrl(url);

      let lineNumber = 0;
      let columnNumber = 0;
      for (let i = 0; i < lines.length; i++) {
        const index = lines[i].indexOf(url);
        if (index !== -1) {
          lineNumber = i + 1;
          columnNumber = index;
          break;
        }
      }

      audios.push({
        id: `audio-url-${url}`,
        type: 'audio',
        path: filePath,
        url,
        line: lineNumber,
        column: columnNumber,
        metadata: {
          duration: 0,
          format,
          isUrl: true,
          sourceFile: filePath,
        },
      });
    }

    return audios;
  }

  private getFormatFromUrl(url: string): string {
    const match = url.match(/\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i);
    return match ? match[1].toLowerCase() : 'mp3';
  }
}
