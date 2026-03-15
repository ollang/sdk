import * as fs from 'fs/promises';
import * as path from 'path';

const I18N_PATTERNS = [
  // Next.js
  'public/locales',
  'messages',
  'locales',

  // React
  'src/locales',
  'src/i18n',
  'src/messages',
  'locales',
  'i18n',

  // Angular
  'src/assets/i18n',
  'src/assets/locales',
  'assets/i18n',

  // Vue
  'src/locales',
  'locales',

  // General
  'translations',
  'lang',
  'languages',
];

export async function autoDetectI18nDirs(projectRoot: string): Promise<string[]> {
  const foundDirs: string[] = [];

  for (const pattern of I18N_PATTERNS) {
    const fullPath = path.join(projectRoot, pattern);

    if (await dirExists(fullPath)) {
      if (await hasI18nFiles(fullPath)) {
        foundDirs.push(pattern);
      }
    }
  }

  if (foundDirs.length === 0) {
    const shallowDirs = await shallowSearch(projectRoot);
    foundDirs.push(...shallowDirs);
  }

  return foundDirs;
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function hasI18nFiles(dirPath: string): Promise<boolean> {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    const hasFiles = items.some(
      (item) =>
        item.isFile() &&
        (item.name.endsWith('.json') || item.name.endsWith('.yaml') || item.name.endsWith('.yml'))
    );

    if (hasFiles) return true;

    const hasLangDirs = items.some((item) => {
      if (!item.isDirectory()) return false;

      const langCodes = ['en', 'tr', 'fr', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'ru'];
      return langCodes.includes(item.name.toLowerCase());
    });

    return hasLangDirs;
  } catch {
    return false;
  }
}

async function shallowSearch(
  dirPath: string,
  depth: number = 0,
  maxDepth: number = 3
): Promise<string[]> {
  if (depth >= maxDepth) return [];

  const foundDirs: string[] = [];

  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    if (shouldSkip(item.name)) continue;

    if (item.isDirectory()) {
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      if (looksLikeI18nDir(item.name) && (await hasI18nFiles(fullPath))) {
        foundDirs.push(relativePath);
      }

      const subDirs = await shallowSearch(fullPath, depth + 1, maxDepth);
      foundDirs.push(...subDirs);
    }
  }

  return foundDirs;
}

function looksLikeI18nDir(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes('i18n') ||
    lowerName.includes('locale') ||
    lowerName.includes('translation') ||
    lowerName.includes('lang') ||
    lowerName.includes('message') ||
    lowerName === 'translations' ||
    lowerName === 'messages'
  );
}

function shouldSkip(name: string): boolean {
  const skipDirs = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'out',
    '.angular',
    'coverage',
    '.vscode',
    '.idea',
    'tmp',
    'temp',
  ];

  return skipDirs.includes(name) || name.startsWith('.');
}
