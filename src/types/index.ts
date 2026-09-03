export interface OllangConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface PageOptions {
  page?: number;
  take?: number;
  search?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  take: number;
  itemCount: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export type OrderType =
  | 'cc'
  | 'subtitle'
  | 'document'
  | 'aiDubbing'
  | 'studioDubbing'
  | 'proofreading'
  | 'other'
  | 'revision';
export type OrderSubType = 'closedCaption' | 'timecodedTranscription';
export type DubbingStyle = 'overdub' | 'lipsync' | 'audioDescription';

export interface TargetLanguageConfig {
  language: string;
  isRush: boolean;
}

export interface CreateOrderParams {
  orderType: OrderType;
  orderSubType?: OrderSubType;
  dubbingStyle?: DubbingStyle;
  level: number;
  projectId?: string;
  sourceLanguage?: string;
  content?: string;
  targetLanguageConfigs: TargetLanguageConfig[];
  /** Webhook called when the order finishes. */
  callbackUrl?: string;
  /** Runs QC automatically once the order completes. */
  autoQc?: boolean;
  /** Translation memory IDs from `memories.list()`. */
  selectedMemories?: string[];
}

export interface Order {
  id: string;
  orderType: OrderType;
  orderSubType?: OrderSubType;
  dubbingStyle?: DubbingStyle;
  level: number;
  projectId: string;
  targetLanguageConfigs: TargetLanguageConfig[];
  createdAt: string;
  updatedAt: string;
  status?: string;
}

export interface ListOrdersParams {
  pageOptions?: PageOptions;
  filter?: {
    status?: string;
    orderType?: OrderType;
    projectId?: string;
  };
}

export interface OrdersListResponse {
  data: Order[];
  meta: PaginationMeta;
}

export interface RunQcEvaluationParams {
  customPrompt?: string;
  accuracy?: boolean;
  fluency?: boolean;
  tone?: boolean;
  culturalFit?: boolean;
}

export interface EvaluationScore {
  name: string;
  score: number;
  details?: string;
}

export interface SegmentEvaluation {
  segmentId: string;
  scores?: EvaluationScore[];
  comments?: string;
}

export interface RunQcEvaluationResponse {
  success: boolean;
  message: string;
  evalId: string;
  creditsUsed: number;
  isProcessing?: boolean;
  textSummary?: string;
  scores?: EvaluationScore[];
  segmentEvals?: SegmentEvaluation[];
}

export interface RerunOrderParams {
  freeReRun?: boolean;
}

export interface RerunOrderResponse {
  success: boolean;
  message: string;
  orderId?: string;
}

export interface DocEntity {
  id: string;
  name: string;
  url?: string;
}

export interface Project {
  id: string;
  name: string;
  sourceLanguage: string;
  createdAt: string;
  folderId: string;
  projectDocs: DocEntity[];
  ordersCount?: number;
}

export interface ListProjectsParams {
  pageOptions?: PageOptions;
}

export interface ProjectsListResponse {
  data: Project[];
  meta: PaginationMeta;
}

export type RevisionType = 'timing' | 'translation' | 'formatting' | 'other';

export interface CreateRevisionParams {
  type: RevisionType;
  time: string;
  description?: string;
}

export interface Revision {
  id: string;
  type: RevisionType;
  time: string;
  description?: string;
  createdAt: string;
  orderId: string;
}

export interface OrderNote {
  details: string;
  timeStamp: string;
}

export interface DirectUploadParams {
  file: File | Blob;
  name: string;
  sourceLanguage: string;
  notes?: OrderNote[];
}

export interface DirectUploadResponse {
  projectId: string;
}

export interface UploadVttParams {
  file: File | Blob;
  orderId: string;
}

export interface UploadVttResponse {
  success: boolean;
  message?: string;
}

export interface CreateCustomInstructionParams {
  key: string;
  value: string;
  description?: string;
}

export interface UpdateCustomInstructionParams {
  key?: string;
  value?: string;
  description?: string;
}

export interface CustomInstruction {
  id: string;
  key: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomInstructionSuggestion {
  key: string;
  value: string;
  description?: string;
}

// --- Translation memories ---

export interface Memory {
  id: string;
  title: string;
  memoryItemsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryItemInput {
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  targetText: string;
}

export interface MemoryImportStarted {
  jobId: string;
  status: string;
}

export interface MemoryImportJob {
  jobId: string;
  status: string;
  progress: number;
  itemsCount: number | null;
  error: string | null;
  completedAt: string | null;
  vectorizationStatus: string | null;
  vectorizationProgress: number | null;
  vectorizationError: string | null;
  vectorizationCompletedAt: string | null;
}

// --- Folders ---

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  ordersCount?: number;
}

export interface ListFoldersParams {
  pageOptions?: PageOptions;
}

export interface FoldersListResponse {
  data: Folder[];
  meta: PaginationMeta;
}

export interface FolderOrderLanguagePair {
  sourceLanguage: string;
  targetLanguage: string;
  ordersCount?: number;
}

export interface AssignTranslatorParams {
  translatorId: string;
  /** ISO 8601 date. */
  deadline?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface UnassignTranslatorParams {
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface BulkExportFoldersParams {
  folderIds: string[];
  targetLanguages: string[];
}

// --- Content ---

export interface ContentTranslationInput {
  sourceText: string;
  targetText: string;
  elementId?: string;
  /** Defaults to `text`. */
  type?: string;
}

export interface ImportContentParams {
  targetLanguage: string;
  translations: ContentTranslationInput[];
}

export interface ImportContentResponse {
  success: boolean;
  imported: number;
}

export interface ExportContentParams {
  targetLanguage?: string;
  targetLanguages?: string[];
  tag?: string;
  tags?: string[];
  orderIds?: string[];
}

// --- Billing ---

export interface CreditWallet {
  balance: number;
  currency?: string;
}

export interface ListConsumptionParams {
  pageOptions?: PageOptions;
  filter?: {
    search?: string;
    /** ISO 8601 date. */
    from?: string;
    /** ISO 8601 date. */
    to?: string;
    provider?: string;
    orderType?: string;
    createdBy?: string;
    orderId?: string;
    tag?: string;
  };
}

export interface ConsumptionEntry {
  id: string;
  orderId?: string;
  provider?: string;
  orderType?: string;
  amount?: number;
  createdAt: string;
}

export interface ConsumptionListResponse {
  data: ConsumptionEntry[];
  meta: PaginationMeta;
}

// --- Locales ---

export interface Language {
  code: string;
  name: string;
  nativeName?: string;
  variants?: Language[];
}

export interface LanguageValidationResult {
  valid: boolean;
  code?: string;
  language?: string;
  region?: string;
  reasons?: string[];
}

// --- Figma ---

export interface CreateFigmaOrderParams {
  fileKey: string;
  fileUrl: string;
  sourceLanguage: string;
  targetLanguages: string[];
  folderId?: string;
}

export interface FigmaOrderSummary {
  orderId: string;
  targetLanguage: string;
  status: string;
}

export interface CreateFigmaOrderResponse {
  projectId: string;
  importId: string;
  orders: FigmaOrderSummary[];
}

// --- URL-based creation ---

export interface CreateProjectByUrlParams {
  url: string;
  name: string;
  sourceLanguage: string;
  folderId?: string;
  notes?: OrderNote[];
}

export interface DirectUrlUploadParams {
  url: string;
  name: string;
  /** File size in bytes. */
  size: number;
  sourceLanguage: string;
  folderId?: string;
}

// --- Order review gates ---

export interface OrderReviewInfo {
  inReview: boolean;
  tag?: string;
  reviewType?: string;
  enteredReviewAt?: string;
  reviewers?: string[];
}
