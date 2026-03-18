export interface TranslatableText {
  id: string;
  text: string;
  type: string;
  source: {
    file: string;
    line: number;
    column: number;
  };
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  alt?: string;
  isMedia?: boolean;
  i18nKey?: string;
  selected: boolean;
  status: 'scanned' | 'translating' | 'translated' | 'submitted';
  translations?: Record<string, string>;
  statusByLanguage?: Record<string, 'none' | 'translating' | 'translated' | 'submitted'>;
  strapiContentType?: string;
  strapiEntryId?: number;
  category?: string;
  tags?: string[];
  folderName?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: TranslatableText['status'];
  color: string;
  icon: string;
}

export interface Config {
  projectRoot: string;
  sourceLanguage: string;
  targetLanguages: string[];
  videoTranslationType?: 'aiDubbing' | 'subtitle';
  hasApiKey: boolean;
}
