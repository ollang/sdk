import * as fs from 'fs/promises';
import * as path from 'path';
import { ContentDetector, VideoContent, DetectionConfig } from './content-type-detector.js';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'];
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.ssa'];

const VIDEO_URL_PATTERNS = [
  /https?:\/\/[^\s"']+\.mp4/gi,
  /https?:\/\/[^\s"']+\.mov/gi,
  /https?:\/\/[^\s"']+\.webm/gi,
  /https?:\/\/[^\s"']+\.avi/gi,
  /https?:\/\/[^\s"']+\.mkv/gi,
  /https?:\/\/[^\s"']*amazonaws\.com[^\s"']*\.(mp4|mov|webm|avi)/gi,
  /https?:\/\/[^\s"']*cloudfront\.net[^\s"']*\.(mp4|mov|webm|avi)/gi,
];

export class VideoDetector implements ContentDetector<VideoContent> {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }

  async detect(projectRoot: string, config: DetectionConfig): Promise<VideoContent[]> {
    const videos: VideoContent[] = [];

    for (const includePath of config.includePaths) {
      const fullPath = path.join(projectRoot, includePath);
      const physicalVideos = await this.scanDirectory(fullPath, config.excludePaths);
      videos.push(...physicalVideos);
      const urlVideos = await this.scanForVideoUrls(fullPath, config.excludePaths);
      videos.push(...urlVideos);
    }

    return videos;
  }

  private async scanDirectory(dirPath: string, excludePaths: string[]): Promise<VideoContent[]> {
    const videos: VideoContent[] = [];

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (this.shouldExclude(fullPath, excludePaths)) {
        continue;
      }

      if (item.isDirectory()) {
        const subVideos = await this.scanDirectory(fullPath, excludePaths);
        videos.push(...subVideos);
      } else if (item.isFile() && this.supports(item.name)) {
        const videoContent = await this.analyzeVideo(fullPath);
        videos.push(videoContent);
      }
    }
    return videos;
  }

  private async analyzeVideo(filePath: string): Promise<VideoContent> {
    const stat = await fs.stat(filePath);
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const filename = path.basename(filePath);

    const subtitlePath = await this.findSubtitleFile(dir, basename);

    return {
      id: `video-${filePath}`,
      type: 'video',
      path: filePath,
      filename,
      metadata: {
        duration: 0,
        format: path.extname(filePath).substring(1),
        hasSubtitles: !!subtitlePath,
        subtitlePath,
        size: stat.size,
      },
    };
  }

  private async findSubtitleFile(dir: string, basename: string): Promise<string | undefined> {
    for (const ext of SUBTITLE_EXTENSIONS) {
      const subtitlePath = path.join(dir, `${basename}${ext}`);
      try {
        await fs.access(subtitlePath);
        return subtitlePath;
      } catch {}
    }
    return undefined;
  }

  private shouldExclude(filePath: string, excludePaths: string[]): boolean {
    return excludePaths.some((exclude) => filePath.includes(exclude));
  }

  private async scanForVideoUrls(dirPath: string, excludePaths: string[]): Promise<VideoContent[]> {
    const videos: VideoContent[] = [];
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.html'];

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (this.shouldExclude(fullPath, excludePaths)) {
        continue;
      }

      if (item.isDirectory()) {
        const subVideos = await this.scanForVideoUrls(fullPath, excludePaths);
        videos.push(...subVideos);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (codeExtensions.includes(ext)) {
          const foundUrls = await this.extractVideoUrls(fullPath);
          videos.push(...foundUrls);
        }
      }
    }
    return videos;
  }

  private async extractVideoUrls(filePath: string): Promise<VideoContent[]> {
    const videos: VideoContent[] = [];

    const content = await fs.readFile(filePath, 'utf-8');
    const foundUrls = new Set<string>();
    const lines = content.split('\n');

    for (const pattern of VIDEO_URL_PATTERNS) {
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

      videos.push({
        id: `video-url-${url}`,
        type: 'video',
        path: filePath,
        url,
        line: lineNumber,
        column: columnNumber,
        metadata: {
          duration: 0,
          format,
          hasSubtitles: false,
          isUrl: true,
          sourceFile: filePath,
        },
      });
    }

    return videos;
  }

  private getFormatFromUrl(url: string): string {
    const match = url.match(/\.(mp4|mov|webm|avi|mkv)(\?|$)/i);
    return match ? match[1].toLowerCase() : 'mp4';
  }
}
