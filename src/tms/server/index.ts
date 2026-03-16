import express from 'express';
import path from 'path';
import { TranslationManagementSystem } from '../tms.js';
import { TextItem } from '../types.js';
import { autoDetectI18nDirs } from '../detector/auto-detect.js';
import { StrapiPusher, StrapiPushResult, StrapiTranslationItem } from './strapi-pusher.js';
import { loadStrapiSchema, StrapiSchemaConfig } from './strapi-schema.js';
import { logger } from '../../logger.js';

const app = express();

const strapiSchemaCache = new Map<string, StrapiSchemaConfig>();
const PORT = process.env.TMS_PORT || 5972;
const PROJECT_ROOT = process.env.TMS_PROJECT_ROOT || process.cwd();

const LANG_REGEX = /^[a-zA-Z]{2,5}(-[a-zA-Z0-9]{2,8})?$/;
const VALID_VIDEO_TYPES = ['aiDubbing', 'subtitle'];

const ALLOWED_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:4200',
  'http://localhost:8000',
]);

// Allow additional origins via env var
const extraOrigins = (process.env.TMS_CORS_ORIGINS || '').split(',').filter(Boolean);
extraOrigins.forEach((o) => ALLOWED_ORIGINS.add(o.trim()));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, x-api-key, x-strapi-token'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

const UNPROTECTED_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'POST', path: '/api/config/apikey' },
  { method: 'GET', path: '/api/config' },
];

app.use('/api', (req, res, next) => {
  const isUnprotected = UNPROTECTED_ROUTES.some(
    (r) => r.method === req.method && req.path === r.path.replace('/api', '')
  );
  if (isUnprotected) return next();

  const configuredKey = process.env.OLLANG_API_KEY;
  if (!configuredKey) return next(); // first-time setup, no key configured yet

  const providedKey =
    (req.headers['x-api-key'] as string) ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '');

  if (providedKey !== configuredKey) {
    return res
      .status(401)
      .json({ success: false, error: 'Unauthorized: invalid or missing API key' });
  }
  next();
});

const uiDistPath = path.join(__dirname, '../ui-dist');
app.use(express.static(uiDistPath));

let tms: TranslationManagementSystem | null = null;

type FolderState = {
  currentScanId: string | null;
  texts: TextItem[];
  videos: any[];
  images: any[];
  audios: any[];
};

const folderStates = new Map<string, FolderState>();
const DEFAULT_FOLDER_KEY = '__default__';

function getFolderKey(folderName?: string | null): string {
  return folderName && folderName.trim().length > 0 ? folderName : DEFAULT_FOLDER_KEY;
}

function getOrCreateFolderState(folderName?: string | null): FolderState {
  const key = getFolderKey(folderName);
  let state = folderStates.get(key);
  if (!state) {
    state = {
      currentScanId: null,
      texts: [],
      videos: [],
      images: [],
      audios: [],
    };
    folderStates.set(key, state);
  }
  return state;
}

async function updateCurrentScan(folderName?: string) {
  const state = getOrCreateFolderState(folderName);
  const { currentScanId, texts, videos, images, audios } = state;

  if (!tms) {
    logger.warn('Cannot update scan: Ollang not initialized');
    return;
  }

  try {
    const sdk = tms.getSDK();
    if (!sdk) {
      logger.warn('SDK not available');
      return;
    }

    if (!currentScanId) {
      const session = await sdk.initializeScanSession(tms.getConfig().ollang.projectId);
      const previousScans = session.scannedDocs || [];

      if (previousScans.length > 0) {
        state.currentScanId = previousScans[0].id;
      } else {
        logger.warn('No existing scan found, cannot update');
        return;
      }
    }

    let existingScanData: any = {};
    try {
      const existingScan = await sdk.scans.getScan(state.currentScanId!);
      existingScanData =
        typeof existingScan.scanData === 'string'
          ? JSON.parse(existingScan.scanData)
          : existingScan.scanData || {};
    } catch (error: any) {
      logger.warn('Could not load existing scan data while updating scan');
      existingScanData = {};
    }

    const i18nSetup = tms.getI18nSetup();

    await sdk.scans.updateScan(state.currentScanId!, {
      scanData: {
        ...existingScanData,
        texts,
        videos,
        images,
        i18nSetup,
        timestamp: new Date().toISOString(),
        projectRoot: tms.getConfig().projectRoot,
        sourceLanguage: tms.getConfig().sourceLanguage,
        targetLanguages: tms.getConfig().targetLanguages,
      },
    });
  } catch (error: any) {
    logger.error('Failed to update scan', error);
  }
}

async function initTMS() {
  const apiKey = process.env.OLLANG_API_KEY || '';
  const projectId = process.env.OLLANG_PROJECT_ID;

  let includePaths = process.env.TMS_INCLUDE_PATHS?.split(',') || [];

  if (includePaths.length === 0) {
    const i18nDirs = await autoDetectI18nDirs(PROJECT_ROOT);

    includePaths = ['.'];
  }

  let fileConfig: {
    projectRoot?: string;
    sourceLanguage?: string;
    targetLanguages?: string[];
    video?: { translationType?: string };
  } = {};

  try {
    const fs = require('fs') as typeof import('fs');
    const configPath = path.join(PROJECT_ROOT, 'ollang.config.ts');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');

      const srcMatch = raw.match(/sourceLanguage['": \s]+['"]([^'"]+)['"]/);
      if (srcMatch) {
        fileConfig.sourceLanguage = srcMatch[1];
      }

      const targetsMatch = raw.match(/targetLanguages['": \s]+(\[[^\]]*\])/);
      if (targetsMatch) {
        try {
          const jsonReady = targetsMatch[1].replace(/'/g, '"');
          const arr = JSON.parse(jsonReady);
          if (Array.isArray(arr)) {
            fileConfig.targetLanguages = arr.map((v: any) => String(v));
          }
        } catch {}
      }

      const videoMatch = raw.match(/translationType['": \s]+['"]([^'"]+)['"]/);
      if (videoMatch) {
        fileConfig.video = { translationType: videoMatch[1] };
      }
    }
  } catch (e) {
    logger.warn('Failed to read ollang.config.ts, falling back to env/defaults');
  }

  const sourceLanguage = fileConfig.sourceLanguage || process.env.TMS_SOURCE_LANGUAGE || 'en';
  const targetLanguages =
    fileConfig.targetLanguages ||
    (process.env.TMS_TARGET_LANGUAGES || 'tr,fr,es,de')
      .split(',')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

  tms = new TranslationManagementSystem({
    projectRoot: PROJECT_ROOT,
    sourceLanguage,
    targetLanguages,

    ollang: {
      apiKey,
      baseUrl: 'https://api-integration.ollang.com',
      projectId,
      defaultLevel: 0,
      mockMode: process.env.TMS_MOCK_MODE === 'true',
    },

    detection: {
      includePaths,
      excludePaths: ['node_modules', '.git', 'dist', 'build', '.next', 'out'],
      includePatterns: [
        '**/*.{ts,tsx,js,jsx,vue}',
        '**/i18n/**/*.json',
        '**/locales/**/*.json',
        '**/*.json',
        '**/*.{mp4,mov,avi,mkv,webm}',
        '**/*.{png,jpg,jpeg,gif,webp}',
        '**/*.{mp3,wav,m4a,aac,ogg,flac}',
      ],
      detectI18n: true,
      detectHardcoded: true,
      detectCMS: false,
    },
  });

  if (!apiKey) {
    logger.warn('OLLANG_API_KEY not set. Translation features will not work.');
  }

  return tms;
}

app.get('/api/config', async (req, res) => {
  if (!tms) {
    tms = await initTMS();
  }

  const config = tms.getConfig();

  res.json({
    projectRoot: config.projectRoot,
    sourceLanguage: config.sourceLanguage,
    targetLanguages: config.targetLanguages,
    hasApiKey: !!config.ollang.apiKey,
    hasProjectId: !!config.ollang.projectId,
  });
});

app.get('/api/projects', async (req, res) => {
  try {
    if (!tms) {
      tms = await initTMS();
    }

    const sdk = tms.getSDK();
    const config = tms.getConfig();

    if (!config.ollang.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key not configured',
      });
    }

    const response = await fetch(`${config.ollang.baseUrl}/integration/project?page=1&limit=100`, {
      method: 'GET',
      headers: {
        'x-api-key': config.ollang.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();

    res.json({
      success: true,
      projects: data.data || [],
      total: data.meta?.itemCount || 0,
    });
  } catch (error: any) {
    logger.error('Failed to load projects', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/api/config/apikey', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }
    if (apiKey.length > 500) {
      return res.status(400).json({ success: false, error: 'API key too long' });
    }

    const previousApiKey = process.env.OLLANG_API_KEY || '';

    process.env.OLLANG_API_KEY = apiKey;

    tms = await initTMS();

    try {
      const config = tms.getConfig();
      const baseUrl = (config.ollang.baseUrl || '').replace(/\/$/, '');

      if (!baseUrl) {
        throw new Error('Base URL is not configured');
      }

      logger.debug('Validating API key with base URL:', baseUrl);

      const response = await fetch(`${baseUrl}/scans/folders`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Invalid API key (status ${response.status})`);
      }

      const data = await response.json();
      const folders = Array.isArray(data) ? data : data.folders;

      if (!folders || !Array.isArray(folders)) {
        throw new Error('Invalid response from server while validating API key');
      }

      logger.debug(`API key validated successfully. Accessible folders: ${folders.length}`);

      res.json({
        success: true,
        message: 'API key validated and updated successfully',
      });
    } catch (validationError: any) {
      logger.error('Test API key validation failed', validationError);

      process.env.OLLANG_API_KEY = previousApiKey;
      tms = await initTMS();

      return res.status(401).json({
        success: false,
        error: 'Invalid Ollang API key. Please check your token and try again.',
      });
    }
  } catch (error: any) {
    logger.error('Failed to update API key', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/api/config/update', async (req, res) => {
  try {
    const { sourceLanguage, targetLanguages, videoTranslationType } = req.body;

    if (!sourceLanguage || !videoTranslationType) {
      return res.status(400).json({
        success: false,
        error: 'Source language and video translation type are required',
      });
    }

    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one target language is required',
      });
    }

    if (!LANG_REGEX.test(sourceLanguage)) {
      return res.status(400).json({ success: false, error: 'Invalid source language format' });
    }
    if (!targetLanguages.every((l: string) => LANG_REGEX.test(l))) {
      return res.status(400).json({ success: false, error: 'Invalid target language format' });
    }
    if (!VALID_VIDEO_TYPES.includes(videoTranslationType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid video translation type. Must be aiDubbing or subtitle.',
      });
    }

    process.env.TMS_SOURCE_LANGUAGE = sourceLanguage;
    process.env.TMS_TARGET_LANGUAGES = targetLanguages.join(',');
    process.env.VIDEO_TRANSLATION_TYPE = videoTranslationType;

    const fs = require('fs').promises;
    const path = require('path');
    const configPath = path.join(PROJECT_ROOT, 'ollang.config.ts');

    const configContent = `export default ${JSON.stringify(
      {
        projectRoot: PROJECT_ROOT,
        sourceLanguage,
        targetLanguages,
        video: { translationType: videoTranslationType },
      },
      null,
      2
    )};\n`;

    await fs.writeFile(configPath, configContent, 'utf-8');
    tms = await initTMS();

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      configPath,
    });
  } catch (error: any) {
    logger.error('Failed to update config', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/api/scan', async (req, res) => {
  try {
    if (!tms) {
      tms = await initTMS();
    }

    const { folderName } = req.body;

    if (!folderName) {
      return res.status(400).json({
        success: false,
        error: 'folderName is required',
      });
    }

    const scanResult = await tms.scanAll();
    const folderState = getOrCreateFolderState(folderName);
    folderState.videos = scanResult.videos;
    folderState.images = scanResult.images;
    folderState.audios = scanResult.audios;

    const videoItems: TextItem[] = scanResult.videos.map((video: any) => ({
      id: `video-${video.id}`,
      text: video.url || video.filename || 'Unknown video',
      type: 'cms' as const,
      source: {
        file: video.path,
        line: video.line || 0,
        column: video.column || 0,
        context: video.url ? 'Hardcoded video URL' : 'Physical video file',
      },
      selected: false,
      status: 'scanned' as const,
      category: 'video',
      tags: ['video'],
      _videoData: video,
    }));

    // Convert images to TextItem format
    const imageItems: TextItem[] = scanResult.images.map((image: any) => ({
      id: `image-${image.id}`,
      text: image.url || image.filename || 'Unknown image',
      type: 'cms' as const,
      source: {
        file: image.path,
        line: image.line || 0,
        column: image.column || 0,
        context: image.url ? 'Hardcoded image URL' : 'Physical image file',
      },
      selected: false,
      status: 'scanned' as const,
      category: 'image',
      tags: ['image'],
      _imageData: image,
    }));

    // Convert audios to TextItem format
    const audioItems: TextItem[] = scanResult.audios.map((audio: any) => ({
      id: `audio-${audio.id}`,
      text: audio.url || audio.filename || 'Unknown audio',
      type: 'cms' as const,
      source: {
        file: audio.path,
        line: audio.line || 0,
        column: audio.column || 0,
        context: audio.url ? 'Hardcoded audio URL' : 'Physical audio file',
      },
      selected: false,
      status: 'scanned' as const,
      category: 'audio',
      tags: ['audio'],
      _audioData: audio,
    }));

    folderState.texts = [...scanResult.texts, ...videoItems, ...imageItems, ...audioItems];

    const i18nSetup = tms.getI18nSetup();

    try {
      const sdk = tms.getSDK();
      if (sdk) {
        const projectIdToUse = folderName ? undefined : tms.getConfig().ollang.projectId;

        const session = await sdk.initializeScanSession(projectIdToUse, folderName);

        if (session.projectId) {
          (tms as any)['config'].ollang.projectId = session.projectId;
        }

        let latestScanData: any | null = null;

        try {
          const allScans = await sdk.scans.listScans();

          const matchingScans = allScans.filter((s: any) => {
            let data = s.scanData;
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data);
              } catch {
                return false;
              }
            }
            if (!data || typeof data !== 'object') return false;

            if (folderName && data.folderName !== folderName) return false;

            const currentRoot = tms ? tms.getConfig().projectRoot : undefined;
            if (currentRoot && data.projectRoot && data.projectRoot !== currentRoot) {
              return false;
            }

            return true;
          });

          if (matchingScans.length > 0) {
            const latestScan = matchingScans[0];
            folderState.currentScanId = latestScan.id;

            let data = latestScan.scanData;
            latestScanData = typeof data === 'string' ? JSON.parse(data) : data;
          }
        } catch (e: any) {
          logger.error('Could not load previous scans via listScans', e);
        }

        if (latestScanData && latestScanData.texts && folderState.currentScanId) {
          const previousTextsMap = new Map(latestScanData.texts.map((t: any) => [t.id, t]));

          folderState.texts = folderState.texts.map((t) => {
            const previousText = previousTextsMap.get(t.id) as any;
            if (previousText && previousText.status) {
              return {
                ...t,
                status: previousText.status,
                translations: previousText.translations || {},
                statusByLanguage:
                  previousText.statusByLanguage || (t as any).statusByLanguage || {},
              };
            }
            return { ...t, status: 'scanned' };
          });

          (tms as any)['state'].texts = folderState.texts;

          for (const targetLang of tms.getConfig().targetLanguages) {
            await tms.syncWithCodebase(targetLang);
          }

          const syncedTexts = (tms as any)['state'].texts;

          const syncedTextsMap = new Map(syncedTexts.map((t: any) => [t.id, t]));

          folderState.texts = folderState.texts.map((t: any) => {
            const syncedText = syncedTextsMap.get(t.id);

            if (syncedText) {
              return syncedText;
            }

            return t;
          });

          await sdk.scans.updateScan(folderState.currentScanId, {
            scanData: {
              texts: folderState.texts,
              videos: folderState.videos,
              images: folderState.images,
              audios: folderState.audios,
              i18nSetup,
              timestamp: new Date().toISOString(),
              projectRoot: tms.getConfig().projectRoot,
              sourceLanguage: tms.getConfig().sourceLanguage,
              targetLanguages: tms.getConfig().targetLanguages,
              projectId: tms.getConfig().ollang.projectId || 'unknown',
              folderName: folderName,
            },
          });
        } else {
          folderState.texts = folderState.texts.map((t) => ({ ...t, status: 'scanned' }));

          const createdScan = await sdk.scans.createScan({
            scanData: {
              texts: folderState.texts,
              videos: folderState.videos,
              images: folderState.images,
              audios: folderState.audios,
              i18nSetup,
              timestamp: new Date().toISOString(),
              projectRoot: tms.getConfig().projectRoot,
              sourceLanguage: tms.getConfig().sourceLanguage,
              targetLanguages: tms.getConfig().targetLanguages,
              projectId: tms.getConfig().ollang.projectId || 'unknown',
              folderName: folderName,
            },
          });

          folderState.currentScanId = createdScan.id;
        }
      }
    } catch (saveError: any) {
      logger.error('Failed to save scan results', saveError);
    }

    const scanTime = new Date().toISOString();

    res.json({
      success: true,
      texts: folderState.texts,
      i18nSetup,
      lastScanTime: scanTime,
      count: {
        i18n: scanResult.texts.length,
        videos: scanResult.videos.length,
        images: scanResult.images.length,
        audios: scanResult.audios.length,
        total: folderState.texts.length,
      },
    });
  } catch (error: any) {
    logger.error('Scan error', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    if (!tms) {
      return res.status(400).json({
        success: false,
        error: 'Ollang not initialized. Please scan first.',
      });
    }

    const { textIds, targetLanguage, targetLanguages, level, folderName } = req.body;

    if (!textIds || !Array.isArray(textIds) || textIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'textIds array is required',
      });
    }
    const languages: string[] =
      Array.isArray(targetLanguages) && targetLanguages.length > 0
        ? targetLanguages
        : targetLanguage
          ? [targetLanguage]
          : [];

    if (languages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'targetLanguage or targetLanguages is required',
      });
    }

    const folderState = getOrCreateFolderState(folderName);

    // If folderName provided, load the latest scan for that folder and get folderId
    let folderId: string | undefined;
    const sdk = tms.getSDK();
    if (sdk && folderName) {
      try {
        logger.debug(`Loading latest scan for folder: ${folderName}`);

        // Get folderId from Ollang server's /api/folders endpoint
        try {
          const axios = require('axios');
          const foldersResponse = await axios.get('http://localhost:5972/api/folders');
          const folders = foldersResponse.data.folders || [];
          const targetFolder = folders.find((f: any) => f.name === folderName);
          if (targetFolder && targetFolder.id) {
            folderId = targetFolder.id;
            logger.debug(`Found folderId: ${folderId} for folder: ${folderName}`);
          }
        } catch (folderError: any) {
          logger.warn('Could not get folders');
        }

        const scans = await sdk.scans.listScans();

        // Find the latest scan for this folder
        const folderScans = scans.filter((scan: any) => {
          const scanData =
            typeof scan.scanData === 'string' ? JSON.parse(scan.scanData) : scan.scanData;
          return scanData.folderName === folderName;
        });

        if (folderScans.length > 0) {
          const latestScan = folderScans[0];
          folderState.currentScanId = latestScan.id;
          const scanData =
            typeof latestScan.scanData === 'string'
              ? JSON.parse(latestScan.scanData)
              : latestScan.scanData;

          if (scanData.texts) {
            folderState.texts = scanData.texts;
            logger.debug(`Loaded ${folderState.texts.length} items from folder ${folderName}`);
          }
        }
      } catch (error: any) {
        logger.warn('Could not load folder scan');
      }
    } else if (sdk && folderState.currentScanId) {
      // Fallback: reload from currentScanId
      try {
        const scan = await sdk.scans.getScan(folderState.currentScanId);
        const scanData =
          typeof scan.scanData === 'string' ? JSON.parse(scan.scanData) : scan.scanData;
        if (scanData.texts) {
          folderState.texts = scanData.texts;
          logger.debug(
            `Reloaded ${folderState.texts.length} items from scan ${folderState.currentScanId}`
          );
        }
      } catch (error) {
        logger.warn('Could not reload scan data, using cached currentTexts');
      }
    }

    // Items are already grouped by entry (each entry = one item with cmsFields).
    // Direct lookup by textIds is sufficient.
    const selectedItems = folderState.texts.filter((t) => textIds.includes(t.id));

    if (selectedItems.length === 0) {
      logger.debug(`No items found. Requested IDs: ${textIds.slice(0, 3).join(', ')}...`);
      logger.debug(
        `Available IDs: ${folderState.texts
          .slice(0, 3)
          .map((t: TextItem) => t.id)
          .join(', ')}...`
      );
      return res.status(400).json({
        success: false,
        error: 'No items found with provided IDs',
      });
    }

    // Separate items by category
    const i18nItems = selectedItems.filter(
      (item) => item.category !== 'video' && item.category !== 'image' && item.category !== 'audio'
    );
    const videoItems = selectedItems.filter((item) => item.category === 'video');
    const imageItems = selectedItems.filter((item) => item.category === 'image');
    const audioItems = selectedItems.filter((item) => item.category === 'audio');

    logger.debug(`Translation breakdown: i18n=${i18nItems.length}, videos=${videoItems.length}, images=${imageItems.length}, audios=${audioItems.length}`);

    // Log cmsFields info for entry-based items
    for (const item of i18nItems) {
      if (item.cmsFields) {
        logger.debug(
          `Entry ${item.id}: ${Object.keys(item.cmsFields).length} fields [${Object.keys(item.cmsFields).join(', ')}]`
        );
      }
    }

    // Update all items to 'translating' status immediately (per language)
    textIds.forEach((textId: string) => {
      const textIndex = folderState.texts.findIndex((t) => t.id === textId);
      if (textIndex !== -1) {
        const existing: any = folderState.texts[textIndex];
        const statusByLanguage = { ...(existing.statusByLanguage || {}) };
        languages.forEach((lang) => {
          statusByLanguage[lang] = 'translating';
        });
        folderState.texts[textIndex] = {
          ...existing,
          status: 'translating',
          statusByLanguage,
        };
      }
    });

    // Save translating status
    try {
      await updateCurrentScan(folderName);
    } catch (saveError: any) {
      logger.error('Failed to save translating status', saveError);
    }

    // Return immediately with translating status
    res.json({
      success: true,
      message: 'Translation started',
      status: 'translating',
      itemsCount: selectedItems.length,
      breakdown: {
        i18n: i18nItems.length,
        videos: videoItems.length,
        images: imageItems.length,
        audios: audioItems.length,
      },
    });

    (async () => {
      try {
        const primaryLang = languages[0];

        if (i18nItems.length > 0) {
          for (const lang of languages) {
            logger.debug(`Translating ${i18nItems.length} i18n texts to ${lang}...`);
            try {
              const order = await tms.translate(i18nItems, lang, level || 0, folderName, folderId);

              const translations = tms.getTranslations();

              i18nItems.forEach((item) => {
                const textIndex = folderState.texts.findIndex((t) => t.id === item.id);
                if (textIndex === -1) return;

                const existing: any = folderState.texts[textIndex];

                if (item.cmsFields && Object.keys(item.cmsFields).length > 0) {
                  const translatedCmsFields: Record<string, string> = {
                    ...(existing.translatedCmsFields || {}),
                  };
                  let titleTranslation = '';
                  for (const field of Object.keys(item.cmsFields)) {
                    const subId = `${item.id}__${field}`;
                    const tr = Array.from(translations.values()).find((t) => t.textId === subId);
                    if (tr) {
                      translatedCmsFields[field] = tr.translatedText;
                      if (field.includes('title')) {
                        titleTranslation = tr.translatedText;
                      }
                    }
                  }

                  const mergedTranslations: Record<string, string> = {
                    ...(existing.translations || {}),
                    [lang]: titleTranslation || Object.values(translatedCmsFields)[0] || '',
                  };

                  const statusByLanguage = { ...(existing.statusByLanguage || {}) };
                  statusByLanguage[lang] = 'translated';

                  folderState.texts[textIndex] = {
                    ...existing,
                    status: 'translated',
                    translatedCmsFields,
                    translations: mergedTranslations,
                    statusByLanguage,
                  };
                } else {
                  const tr = Array.from(translations.values()).find((t) => t.textId === item.id);

                  const mergedTranslations: Record<string, string> = {
                    ...(existing.translations || {}),
                    ...(tr ? { [lang]: tr.translatedText } : {}),
                  };

                  const statusByLanguage = { ...(existing.statusByLanguage || {}) };
                  statusByLanguage[lang] = 'translated';

                  folderState.texts[textIndex] = {
                    ...existing,
                    status: 'translated',
                    translations: mergedTranslations,
                    statusByLanguage,
                  };
                }
              });
            } catch (error: any) {
              logger.error(`i18n translation error for lang ${lang}`, error);
            }
          }
        }

        if (videoItems.length > 0) {
          logger.debug(`Translating ${videoItems.length} videos to ${primaryLang}...`);
          for (const item of videoItems) {
            try {
              const videoData = (item as any)._videoData;
              if (videoData) {
                const orderId = await tms.translateVideo(videoData, primaryLang, level || 0);
                logger.debug(`Video translation order created: ${orderId}`);

                const textIndex = folderState.texts.findIndex((t) => t.id === item.id);
                if (textIndex !== -1) {
                  folderState.texts[textIndex] = {
                    ...folderState.texts[textIndex],
                    status: 'translated',
                    translations: { [targetLanguage]: `Order: ${orderId}` },
                  };
                }
              }
            } catch (error: any) {
              logger.error(`Video translation error for ${item.id}`, error);
              const textIndex = folderState.texts.findIndex((t) => t.id === item.id);
              if (textIndex !== -1) {
                folderState.texts[textIndex] = {
                  ...folderState.texts[textIndex],
                  status: 'scanned',
                };
              }
            }
          }
        }

        if (imageItems.length > 0) {
          logger.debug(`Translating ${imageItems.length} images to ${primaryLang}...`);
          for (const item of imageItems) {
            try {
              const imageData = (item as any)._imageData;
              if (imageData) {
                imageData.textItemId = item.id;
                const orderId = await tms.translateImage(imageData, primaryLang, level || 0);
                logger.debug(`Image translation order created: ${orderId}`);

                const textIndex = folderState.texts.findIndex((t) => t.id === item.id);
                if (textIndex !== -1) {
                  folderState.texts[textIndex] = {
                    ...folderState.texts[textIndex],
                    status: 'translated',
                    translations: { [targetLanguage]: `Order: ${orderId}` },
                  };
                }
              }
            } catch (error: any) {
              logger.error(`Image translation error for ${item.id}`, error);
              const textIndex = folderState.texts.findIndex((t) => t.id === item.id);
              if (textIndex !== -1) {
                folderState.texts[textIndex] = {
                  ...folderState.texts[textIndex],
                  status: 'scanned',
                };
              }
            }
          }
        }

        if (audioItems.length > 0) {
          logger.debug(`Translating ${audioItems.length} audios to ${primaryLang}...`);
          for (const item of audioItems) {
            try {
              const audioData = (item as any)._audioData;
              if (audioData) {
                const orderId = await tms.translateAudio(audioData, primaryLang, level || 0);

                const textIndex = folderState.texts.findIndex((t) => t.id === item.id);
                if (textIndex !== -1) {
                  folderState.texts[textIndex] = {
                    ...folderState.texts[textIndex],
                    status: 'translated',
                    translations: { [targetLanguage]: `Order: ${orderId}` },
                  };
                }
              }
            } catch (error: any) {
              logger.error(`Audio translation error for ${item.id}`, error);
              const textIndex = folderState.texts.findIndex((t) => t.id === item.id);
              if (textIndex !== -1) {
                folderState.texts[textIndex] = {
                  ...folderState.texts[textIndex],
                  status: 'scanned',
                };
              }
            }
          }
        }

        try {
          await updateCurrentScan(folderName);
          logger.debug('All translations completed and saved');
        } catch (saveError: any) {
          logger.warn('Failed to save translation statuses');
        }
      } catch (error: any) {
        logger.error('Translation error', error);
      }
    })();
  } catch (error: any) {
    logger.error('Translation error', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/api/apply', async (req, res) => {
  try {
    if (!tms) {
      return res.status(400).json({
        success: false,
        error: 'Ollang not initialized.',
      });
    }

    const {
      targetLanguage,
      textIds,
      folderName,
      strapiUrl: reqStrapiUrl,
      strapiToken: reqStrapiToken,
    } = req.body;

    const effectiveStrapiToken = (req.headers['x-strapi-token'] as string) || reqStrapiToken;

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'targetLanguage is required',
      });
    }

    const folderState = getOrCreateFolderState(folderName);

    const sdk = tms.getSDK();
    if (sdk && folderName) {
      try {
        const scans = await sdk.scans.listScans();

        const folderScans = scans.filter((scan: any) => {
          const scanData =
            typeof scan.scanData === 'string' ? JSON.parse(scan.scanData) : scan.scanData;
          return scanData.folderName === folderName;
        });

        if (folderScans.length > 0) {
          const latestScan = folderScans[0];
          folderState.currentScanId = latestScan.id;
          const scanData =
            typeof latestScan.scanData === 'string'
              ? JSON.parse(latestScan.scanData)
              : latestScan.scanData;

          if (scanData.texts) {
            folderState.texts = scanData.texts;
          }
        }
      } catch (error: any) {
        logger.error('Could not load folder scan', error);
      }
    }

    let translations = tms.getTranslations();

    const translatedTexts = folderState.texts.filter(
      (t) => t.status === 'translated' && t.translations && t.translations[targetLanguage]
    );

    let loadedCount = 0;
    translatedTexts.forEach((text) => {
      if (!translations.has(text.id)) {
        const translatedText = text.translations![targetLanguage];
        // @ts-ignore - accessing private state to sync translation
        tms['state'].translations.set(text.id, {
          textId: text.id,
          originalText: text.text,
          translatedText: translatedText,
        });
        loadedCount++;
      }
    });

    translations = tms.getTranslations();

    const hasTargetLangTranslation =
      targetLanguage && Array.from(translations.values()).some((t) => !!t && !!t.translatedText);

    if (!hasTargetLangTranslation) {
      return res.status(400).json({
        success: false,
        error: 'No translations available. Please translate first.',
      });
    }

    const appliedTextIds: string[] =
      textIds && textIds.length > 0
        ? textIds
        : Array.from(translations.values()).map((t) => t.textId);

    const cmsEntryItems: TextItem[] = [];
    const fileItems: string[] = [];

    for (const textId of appliedTextIds) {
      const item = folderState.texts.find((t) => t.id === textId);
      if (!item) {
        fileItems.push(textId);
        continue;
      }

      if (item.cmsFields && Object.keys(item.cmsFields).length > 0) {
        cmsEntryItems.push(item);
      } else if (item.strapiContentType && item.strapiEntryId && item.strapiField) {
        cmsEntryItems.push(item);
      } else {
        fileItems.push(textId);
      }
    }

    let updatedFiles = 0;
    let strapiResults: {
      pushed: number;
      failed: number;
      results?: StrapiPushResult[];
      errors?: StrapiPushResult[];
    } = { pushed: 0, failed: 0 };

    if (fileItems.length > 0) {
      logger.debug(`Applying ${fileItems.length} file-based translations...`);
      (tms as any)['state'].texts = folderState.texts;
      updatedFiles = await tms.applyTranslations(targetLanguage, fileItems);
      logger.debug(`Updated ${updatedFiles} files`);
    }

    if (cmsEntryItems.length > 0) {
      const strapiUrl = reqStrapiUrl || process.env.STRAPI_URL || process.env.STRAPI_BASE_URL || '';
      const strapiToken =
        effectiveStrapiToken || process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN || '';

      if (!strapiUrl || !strapiToken) {
        logger.warn('STRAPI_URL and STRAPI_TOKEN env vars required for CMS push. Skipping Strapi push.');
      } else {
        logger.debug(`Pushing ${cmsEntryItems.length} CMS entries to Strapi (${strapiUrl})...`);

        const pusher = new StrapiPusher({ strapiUrl, strapiToken });

        const strapiTranslations: StrapiTranslationItem[] = [];

        for (const item of cmsEntryItems) {
          const route = item.strapiRoute || (item as any).metadata?.strapiRoute;

          if (item.translatedCmsFields && Object.keys(item.translatedCmsFields).length > 0) {
            for (const [field, translatedText] of Object.entries(item.translatedCmsFields)) {
              const payload: StrapiTranslationItem = {
                contentType: item.strapiContentType!,
                entryId: item.strapiEntryId!,
                field,
                translatedText,
              };
              if (route) payload.route = route;
              strapiTranslations.push(payload);
            }
          } else {
            const translatedText =
              item.translations?.[targetLanguage] ||
              Array.from(translations.values()).find((tr) => tr.textId === item.id)?.translatedText;
            if (translatedText && item.strapiField) {
              const payload: StrapiTranslationItem = {
                contentType: item.strapiContentType!,
                entryId: item.strapiEntryId!,
                field: item.strapiField,
                translatedText,
              };
              if (route) payload.route = route;
              strapiTranslations.push(payload);
            }
          }
        }

        if (strapiTranslations.length > 0) {
          const result = await pusher.pushBatch(strapiTranslations, targetLanguage);
          strapiResults = {
            pushed: result.results.length,
            failed: result.errors.length,
            results: result.results,
            errors: result.errors,
          };

          if (result.errors.length > 0) {
            logger.error('Strapi push errors encountered');
          }
        }
      }
    }

    const successfulCmsKeys = new Set(
      (strapiResults.results || []).map((r) => `${r.contentType}:${r.entryId}:${r.field}`)
    );

    for (const textId of appliedTextIds) {
      const textIndex = folderState.texts.findIndex((t) => t.id === textId);
      if (textIndex === -1) continue;

      const item: any = folderState.texts[textIndex];

      if (item.cmsFields && item.strapiContentType && item.strapiEntryId) {
        const anySuccess = Object.keys(item.cmsFields).some((field) =>
          successfulCmsKeys.has(`${item.strapiContentType}:${item.strapiEntryId}:${field}`)
        );
        if (anySuccess) {
          const statusByLanguage = { ...(item.statusByLanguage || {}) };
          statusByLanguage[targetLanguage] = 'submitted';
          folderState.texts[textIndex] = { ...item, status: 'submitted', statusByLanguage };
        }
      } else {
        const statusByLanguage = { ...(item.statusByLanguage || {}) };
        statusByLanguage[targetLanguage] = 'submitted';
        folderState.texts[textIndex] = { ...item, status: 'submitted', statusByLanguage };
      }
    }

    try {
      await updateCurrentScan(folderName);
    } catch (saveError: any) {
      logger.error('Failed to save apply statuses', saveError);
    }

    const appliedCount = appliedTextIds.length;
    res.json({
      success: strapiResults.failed === 0,
      updatedFiles,
      translationsCount: appliedCount,
      strapiPushed: strapiResults.pushed,
      strapiFailed: strapiResults.failed,
      strapiResults,
      message: `Applied ${appliedCount} translations: ${updatedFiles} files updated, ${strapiResults.pushed} CMS items pushed to Strapi`,
    });
  } catch (error: any) {
    logger.error('Apply error', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/api/translations', (_req, res) => {
  if (!tms) {
    return res.json({
      success: true,
      translations: [],
    });
  }

  const translations = tms.getTranslations();

  res.json({
    success: true,
    translations: Array.from(translations.values()),
  });
});

function getOllangBackendBase(): string {
  let backendBase = process.env.OLLANG_BASE_URL || '';
  if (!backendBase && tms) {
    backendBase = tms.getConfig().ollang.baseUrl || '';
  }
  if (!backendBase) {
    backendBase = 'https://api-integration.ollang.com';
  }
  backendBase = backendBase.replace(/\/$/, '');

  try {
    const parsed = new URL(backendBase);
    const allowedHosts = new Set(['localhost', '127.0.0.1', 'api-integration.ollang.com']);
    const extraHosts = (process.env.OLLANG_ALLOWED_HOSTS || '').split(',').filter(Boolean);
    extraHosts.forEach((h) => allowedHosts.add(h.trim()));

    if (!allowedHosts.has(parsed.hostname)) {
      logger.warn(`Backend URL hostname "${parsed.hostname}" not in allowlist, using default`);
      return 'https://api-integration.ollang.com';
    }
  } catch {
    logger.warn('Invalid backend URL format, using default');
    return 'https://api-integration.ollang.com';
  }

  return backendBase;
}

app.get('/scans/folders', async (req, res) => {
  const apiKey = (req.headers['x-api-key'] as string) || '';
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'x-api-key required' });
  }
  try {
    const base = getOllangBackendBase();
    const response = await fetch(`${base}/scans/folders`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    logger.error('/scans/folders proxy error', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reach Ollang API',
    });
  }
});

app.get('/scans', async (req, res) => {
  const apiKey = (req.headers['x-api-key'] as string) || '';
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'x-api-key required' });
  }
  try {
    const base = getOllangBackendBase();
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = qs ? `${base}/scans?${qs}` : `${base}/scans`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    logger.error('GET /scans proxy error', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reach Ollang API',
    });
  }
});

app.post('/scans', async (req, res) => {
  const apiKey = (req.headers['x-api-key'] as string) || '';
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'x-api-key required' });
  }
  try {
    const base = getOllangBackendBase();
    const response = await fetch(`${base}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(req.body || {}),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    logger.error('POST /scans proxy error', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reach Ollang API',
    });
  }
});

app.patch('/scans/:id', async (req, res) => {
  const apiKey = (req.headers['x-api-key'] as string) || '';
  const scanId = req.params.id;
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'x-api-key required' });
  }
  if (!scanId) {
    return res.status(400).json({ success: false, error: 'scan id required' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(scanId)) {
    return res.status(400).json({ success: false, error: 'Invalid scan ID format' });
  }
  try {
    const base = getOllangBackendBase();
    const response = await fetch(`${base}/scans/${scanId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(req.body || {}),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    logger.error('PATCH /scans/:id proxy error', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reach Ollang API',
    });
  }
});

app.get('/api/folders', async (req, res) => {
  try {
    if (!tms) {
      tms = await initTMS();
    }

    const sdk = tms.getSDK();
    const config = tms.getConfig();

    if (!config.ollang.apiKey) {
      return res.json({
        success: true,
        folders: [],
      });
    }

    if (!sdk) {
      return res.status(500).json({
        success: false,
        error: 'SDK not available',
      });
    }

    const folders = await sdk
      .getClient()
      .get<
        Array<{ id: string; name: string; projectId?: string; isCms?: boolean }>
      >('/scans/folders');

    const normalizedFolders = folders.map((f) => ({
      ...f,
      isCms: !!f.isCms,
    }));

    res.json({
      success: true,
      folders: normalizedFolders,
    });
  } catch (error: any) {
    logger.error('Failed to load folders', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/api/scans', async (req, res) => {
  try {
    if (!tms) {
      tms = await initTMS();
    }

    const sdk = tms.getSDK();
    const projectId = req.query.projectId as string | undefined;
    const folderName = req.query.folderName as string | undefined;

    const scans = await sdk.scans.listScans();

    let foldersMap = new Map<string, string>();
    try {
      const folders = await sdk
        .getClient()
        .get<Array<{ id: string; name: string; projectId?: string }>>('/scans/folders');
      folders.forEach((folder) => {
        if (folder.projectId) {
          foldersMap.set(folder.projectId, folder.name);
        }
      });
    } catch (error) {
      logger.warn('Could not load folders for mapping');
    }

    const scansWithFolderName = scans.map((scan) => {
      const scanData =
        typeof scan.scanData === 'string' ? JSON.parse(scan.scanData) : scan.scanData;

      let scanFolderName = scanData.folderName;
      if (!scanFolderName && scanData.projectId) {
        scanFolderName = foldersMap.get(scanData.projectId);
      }

      return {
        id: scan.id,
        createdAt: scan.createdAt,
        scanData: {
          ...scanData,
          folderName: scanFolderName || 'Unknown',
        },
      };
    });

    let filteredScans = scansWithFolderName;

    if (folderName) {
      filteredScans = scansWithFolderName.filter((scan) => {
        return scan.scanData.folderName === folderName;
      });
    } else if (projectId) {
      filteredScans = scansWithFolderName.filter((scan) => {
        return scan.scanData.projectId === projectId;
      });
    }

    res.json({
      success: true,
      scans: filteredScans,
    });
  } catch (error: any) {
    logger.error('Failed to load scans', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/api/scans/:scanId', async (req, res) => {
  try {
    if (!tms) {
      tms = await initTMS();
    }

    const sdk = tms.getSDK();
    const { scanId } = req.params;

    const scan = await sdk.scans.getScan(scanId);
    const scanData = typeof scan.scanData === 'string' ? JSON.parse(scan.scanData) : scan.scanData;

    const folderState = getOrCreateFolderState(scanData.folderName);
    folderState.currentScanId = scan.id;

    if (scanData.texts) {
      folderState.texts = scanData.texts;
    }
    if (scanData.videos) {
      folderState.videos = scanData.videos;
    }
    if (scanData.images) {
      folderState.images = scanData.images;
    }
    if (scanData.audios) {
      folderState.audios = scanData.audios;
    }

    res.json({
      success: true,
      scan: {
        id: scan.id,
        createdAt: scan.createdAt,
        scanData,
      },
      texts: folderState.texts,
    });
  } catch (error: any) {
    logger.error('Failed to load scan', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/api/state', (_req, res) => {
  if (!tms) {
    return res.json({
      success: true,
      state: null,
    });
  }

  const state = tms.getState();

  res.json({
    success: true,
    state: {
      isScanning: state.isScanning,
      isTranslating: state.isTranslating,
      isApplying: state.isApplying,
      textsCount: state.texts.length,
      translationsCount: state.translations.size,
      currentOrder: state.currentOrder
        ? {
            id: state.currentOrder.id,
            status: state.currentOrder.status,
          }
        : null,
    },
  });
});

app.post('/api/strapi-schema', async (req, res) => {
  try {
    const { strapiUrl, strapiToken: bodyToken } = req.body || {};
    const strapiToken = (req.headers['x-strapi-token'] as string) || bodyToken;
    if (!strapiUrl || !strapiToken) {
      return res.status(400).json({
        success: false,
        error:
          'strapiUrl and strapiToken (Strapi API token) are required. This is not the Ollang API token.',
      });
    }
    const base = String(strapiUrl).replace(/\/$/, '');
    const config = await loadStrapiSchema(base, strapiToken);
    strapiSchemaCache.set(base, config);
    const contentTypes = Object.keys(config.fieldsByContentType);
    return res.json({
      success: true,
      strapiUrl: base,
      contentTypes,
      fieldsByContentType: config.fieldsByContentType,
    });
  } catch (error: any) {
    logger.error('Strapi schema fetch failed', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch Strapi schema',
    });
  }
});

app.get('/api/strapi-field-config', (req, res) => {
  const strapiUrl = req.query.strapiUrl as string;
  if (!strapiUrl) {
    return res.status(400).json({
      success: false,
      error: 'strapiUrl query parameter is required',
    });
  }
  const base = String(strapiUrl).replace(/\/$/, '');
  const config = strapiSchemaCache.get(base);
  if (!config) {
    return res.json({
      success: true,
      fieldsByContentType: {},
      message: 'No schema cached for this URL. Use Strapi dialog to fetch schema.',
    });
  }
  return res.json({
    success: true,
    fieldsByContentType: config.fieldsByContentType,
    fetchedAt: config.fetchedAt,
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../ui-dist/index.html'));
});

app.listen(PORT, () => {
  logger.info('🚀 Translation Management System starting...');
  logger.info(`📦 Project: ${PROJECT_ROOT}`);
  logger.info(`🌐 Control panel: http://localhost:${PORT}`);
  logger.info(`💡 Opening in your browser...`);
  logger.info(`   If not opened: http://localhost:${PORT}`);
  logger.info(`⌨️  To stop: Ctrl+C\n`);

  const open = require('open');
  open(`http://localhost:${PORT}`).catch(() => {});
});
