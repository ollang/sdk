/**
 * Translation Management System - Public API
 */

export { TranslationManagementSystem } from './tms.js';
export { MultiContentTMS } from './multi-content-tms.js';
export { ConfigManager, createConfig, DEFAULT_TMS_CONFIG } from './config.js';
export { TextDetector } from './detector/text-detector.js';
export { VideoDetector } from './detector/video-detector.js';
export { ImageDetector } from './detector/image-detector.js';
export { CMSDetector } from './detector/cms-detector.js';
export * from './types.js';
export * from './detector/content-type-detector.js';
