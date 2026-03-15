import { TextItem } from '../types';
import { CapturedContent } from '../../browser';

export class CMSDetector {
  static convertToTextItems(contents: CapturedContent[]): TextItem[] {
    return contents.map((content) => this.convertToTextItem(content));
  }

  static convertToTextItem(content: CapturedContent): TextItem {
    const textItem: TextItem = {
      id: content.id,
      text: content.text,
      type: 'cms',
      source: {
        file: content.url,
        line: 0,
        column: 0,
        context: content.selector,
      },
      selected: false,
      cmsField: content.cmsField,
      cmsId: content.cmsId,
      category: content.cmsType || 'dynamic',
      tags: this.generateTags(content),
      strapiContentType: content.strapiContentType,
      strapiEntryId: content.strapiEntryId,
      strapiField: content.strapiField,
    };

    return textItem;
  }

  private static generateTags(content: CapturedContent): string[] {
    const tags: string[] = [];

    if (content.cmsType) {
      tags.push(`cms:${content.cmsType}`);
    }

    if (content.tagName) {
      tags.push(`tag:${content.tagName}`);
    }

    if (content.cmsField) {
      tags.push(`field:${content.cmsField}`);
    }

    Object.keys(content.attributes).forEach((key) => {
      if (key.startsWith('data-')) {
        tags.push(`attr:${key.replace('data-', '')}`);
      }
    });

    return tags;
  }

  static filterByCMSType(items: TextItem[], cmsType: string): TextItem[] {
    return items.filter((item) => item.category === cmsType);
  }

  static filterByCMSField(items: TextItem[], field: string): TextItem[] {
    return items.filter((item) => item.cmsField === field);
  }

  static groupByURL(items: TextItem[]): Map<string, TextItem[]> {
    const groups = new Map<string, TextItem[]>();

    items.forEach((item) => {
      const url = item.source.file;
      if (!groups.has(url)) {
        groups.set(url, []);
      }
      groups.get(url)!.push(item);
    });

    return groups;
  }

  static groupByCMSField(items: TextItem[]): Map<string, TextItem[]> {
    const groups = new Map<string, TextItem[]>();

    items.forEach((item) => {
      const field = item.cmsField || 'unknown';
      if (!groups.has(field)) {
        groups.set(field, []);
      }
      groups.get(field)!.push(item);
    });

    return groups;
  }

  static getStats(items: TextItem[]): {
    total: number;
    byType: Record<string, number>;
    byField: Record<string, number>;
    byURL: Record<string, number>;
  } {
    const stats = {
      total: items.length,
      byType: {} as Record<string, number>,
      byField: {} as Record<string, number>,
      byURL: {} as Record<string, number>,
    };

    items.forEach((item) => {
      const type = item.category || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      const field = item.cmsField || 'unknown';
      stats.byField[field] = (stats.byField[field] || 0) + 1;

      const url = item.source.file;
      stats.byURL[url] = (stats.byURL[url] || 0) + 1;
    });

    return stats;
  }
}
