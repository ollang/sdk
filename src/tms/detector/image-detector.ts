import * as fs from 'fs/promises';
import * as path from 'path';
import { ContentDetector, ImageContent, DetectionConfig } from './content-type-detector.js';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

const IMAGE_URL_PATTERNS = [
  /https?:\/\/[^\s"']+\.png/gi,
  /https?:\/\/[^\s"']+\.jpg/gi,
  /https?:\/\/[^\s"']+\.jpeg/gi,
  /https?:\/\/[^\s"']+\.gif/gi,
  /https?:\/\/[^\s"']+\.webp/gi,
  /https?:\/\/[^\s"']*amazonaws\.com[^\s"']*\.(png|jpg|jpeg|gif|webp)/gi,
  /https?:\/\/[^\s"']*cloudfront\.net[^\s"']*\.(png|jpg|jpeg|gif|webp)/gi,
];

export class ImageDetector implements ContentDetector<ImageContent> {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  async detect(projectRoot: string, config: DetectionConfig): Promise<ImageContent[]> {
    const images: ImageContent[] = [];

    for (const includePath of config.includePaths) {
      const fullPath = path.join(projectRoot, includePath);
      const physicalImages = await this.scanDirectory(fullPath, config.excludePaths);
      images.push(...physicalImages);

      const urlImages = await this.scanForImageUrls(fullPath, config.excludePaths);
      images.push(...urlImages);
    }

    return images;
  }

  private async scanDirectory(dirPath: string, excludePaths: string[]): Promise<ImageContent[]> {
    const images: ImageContent[] = [];

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (this.shouldExclude(fullPath, excludePaths)) {
        continue;
      }

      if (item.isDirectory()) {
        const subImages = await this.scanDirectory(fullPath, excludePaths);
        images.push(...subImages);
      } else if (item.isFile() && this.supports(item.name)) {
        const imageContent = await this.analyzeImage(fullPath);
        images.push(imageContent);
      }
    }
    return images;
  }

  private async analyzeImage(filePath: string): Promise<ImageContent> {
    const stat = await fs.stat(filePath);
    const filename = path.basename(filePath);

    return {
      id: `image-${filePath}`,
      type: 'image',
      path: filePath,
      filename,
      metadata: {
        hasText: true,
        format: path.extname(filePath).substring(1),
        size: stat.size,
      },
    };
  }

  private shouldExclude(filePath: string, excludePaths: string[]): boolean {
    return excludePaths.some((exclude) => filePath.includes(exclude));
  }

  private async scanForImageUrls(dirPath: string, excludePaths: string[]): Promise<ImageContent[]> {
    const images: ImageContent[] = [];
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.html'];

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (this.shouldExclude(fullPath, excludePaths)) {
        continue;
      }

      if (item.isDirectory()) {
        const subImages = await this.scanForImageUrls(fullPath, excludePaths);
        images.push(...subImages);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (codeExtensions.includes(ext)) {
          const foundUrls = await this.extractImageUrls(fullPath);
          images.push(...foundUrls);
        }
      }
    }
    return images;
  }

  private async extractImageUrls(filePath: string): Promise<ImageContent[]> {
    const images: ImageContent[] = [];

    const content = await fs.readFile(filePath, 'utf-8');
    const foundUrls = new Set<string>();
    const lines = content.split('\n');

    for (const pattern of IMAGE_URL_PATTERNS) {
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

      images.push({
        id: `image-url-${url}`,
        type: 'image',
        path: filePath,
        url,
        line: lineNumber,
        column: columnNumber,
        metadata: {
          hasText: true,
          format,
          isUrl: true,
          sourceFile: filePath,
        },
      });
    }

    return images;
  }

  private getFormatFromUrl(url: string): string {
    const match = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
    return match ? match[1].toLowerCase() : 'png';
  }
}
