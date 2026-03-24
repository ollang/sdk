import * as fs from 'fs';
import * as path from 'path';
import { TextItem, ScanConfig } from '../types.js';

export class HardcodedDetector {
  private readonly MIN_TEXT_LENGTH = 3;
  private readonly MAX_TEXT_LENGTH = 500;

  async detect(config: ScanConfig): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    for (const includePath of config.includePaths) {
      const hardcodedTexts = await this.scanDirectory(includePath, config.excludePaths);
      texts.push(...hardcodedTexts);
    }

    return texts;
  }

  private async scanDirectory(dirPath: string, excludePaths: string[]): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    if (!fs.existsSync(dirPath)) {
      return texts;
    }

    const stat = fs.statSync(dirPath);

    if (stat.isFile()) {
      if (this.isCodeFile(dirPath) && !this.shouldExclude(dirPath, excludePaths)) {
        const fileTexts = await this.scanFile(dirPath);
        texts.push(...fileTexts);
      }
      return texts;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (this.shouldExclude(fullPath, excludePaths)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subTexts = await this.scanDirectory(fullPath, excludePaths);
        texts.push(...subTexts);
      } else if (entry.isFile() && this.isCodeFile(entry.name)) {
        const fileTexts = await this.scanFile(fullPath);
        texts.push(...fileTexts);
      }
    }

    return texts;
  }

  private async scanFile(filePath: string): Promise<TextItem[]> {
    const texts: TextItem[] = [];

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const jsxTextRegex = />([^<>{}\n]+)</g;

    const ollangAppliedJsxRegex = new RegExp(
      '>\\{\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*\\/\\*\\s*-\\s*"[^"]*"\\s*\\([a-z]{2}\\)\\s*\\*\\/',
      'g'
    );

    lines.forEach((lineContent, lineIndex) => {
      const trimmedLine = lineContent.trim();
      if (
        trimmedLine.startsWith('//') ||
        trimmedLine.startsWith('/*') ||
        trimmedLine.startsWith('*') ||
        trimmedLine.startsWith('<!--')
      ) {
        return;
      }

      let match;
      const plainRegex = new RegExp(jsxTextRegex);
      while ((match = plainRegex.exec(lineContent)) !== null) {
        const text = match[1].trim();

        if (this.isValidText(text)) {
          texts.push({
            id: `hardcoded-${filePath}-${lineIndex}-${match.index}`,
            text,
            type: 'hardcoded',
            source: {
              file: filePath,
              line: lineIndex + 1,
              column: match.index,
              context: lineContent.trim(),
            },
            selected: false,
            status: 'scanned',
          });
        }
      }

      const ollangLineRegex = new RegExp(ollangAppliedJsxRegex.source, 'g');
      while ((match = ollangLineRegex.exec(lineContent)) !== null) {
        const raw = match[1];
        let text: string;
        try {
          const jsonFragment = '"' + raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
          text = JSON.parse(jsonFragment) as string;
        } catch {
          text = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        text = text.trim();

        if (this.isValidText(text)) {
          texts.push({
            id: `hardcoded-${filePath}-${lineIndex}-${match.index}`,
            text,
            type: 'hardcoded',
            source: {
              file: filePath,
              line: lineIndex + 1,
              column: match.index,
              context: lineContent.trim(),
            },
            selected: false,
            status: 'scanned',
          });
        }
      }
    });

    return texts;
  }

  private isCodeFile(fileName: string): boolean {
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.html'];
    return codeExtensions.some((ext) => fileName.endsWith(ext));
  }

  private isValidText(text: string): boolean {
    if (text.length < this.MIN_TEXT_LENGTH || text.length > this.MAX_TEXT_LENGTH) {
      return false;
    }

    if (!/[a-zA-Z]/.test(text)) {
      return false;
    }

    if (!text.trim()) {
      return false;
    }

    const skipPatterns = [
      /^[0-9]+$/,
      /^[a-z_]+$/i,
      /^[A-Z_]+$/,
      /^\$\{.*\}$/,
      /^https?:\/\//,
      /^\/[a-z0-9\-_/]+$/i,
      /^#[0-9a-f]{3,6}$/i,
      /^rgb\(/,
      /^\{.*\}$/,
      /^\[.*\]$/,
    ];

    return !skipPatterns.some((pattern) => pattern.test(text));
  }

  private shouldExclude(filePath: string, excludePaths: string[]): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return excludePaths.some((exclude) => {
      const normalizedExclude = exclude.replace(/\\/g, '/');
      return normalizedPath.includes(normalizedExclude);
    });
  }
}
