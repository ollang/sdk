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

/**
 * The kind of file an {@link OrderDocument} holds.
 *
 * Source documents are what you uploaded; `created_*` documents are what the
 * pipeline produced and are the ones you normally download.
 *
 * The union is open: the listed values are what the platform documents today,
 * and any other string still type-checks so a new document type does not break
 * your build.
 */
export type DocType =
  | 'source_video'
  | 'source_accompaniment_audio'
  | 'source_srt'
  | 'source_document'
  | 'created_source_vocals_only_audio'
  | 'created_waveform'
  | 'created_accompaniment_audio'
  | 'created_ai_dub_audio'
  | 'created_ai_dub_vocals_only_audio'
  | 'created_embedded_video'
  | 'created_subtitle_embedded_video'
  | 'created_compressed_video'
  | 'created_thumbnail'
  | 'vendor_audio_with_background'
  | 'vendor_audio_without_background'
  | 'vendor_video'
  | 'translator_document'
  | 'invoice'
  | 'guideline'
  | 'character_list'
  | 'guideline_glossary'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/**
 * A file attached to an order — the source you uploaded, or a deliverable the
 * pipeline produced.
 *
 * `url` is a signed, time-limited download link, so fetch it rather than
 * storing it.
 */
export interface OrderDocument {
  id: string;
  name: string;
  url: string;
  type: DocType;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  size?: number;
  storageUrl?: string;
  wordCount?: number;
  /** Seconds, for audio and video documents. */
  duration?: number;
  sourceLanguage?: string;
  waveformUrl?: string;
  thumbnailUrl?: string;
  projectId?: string;
  orderId?: string;
  folderId?: string;
}

export interface OrderFinance {
  paymentAmount: number;
}

export interface OrderQcEvaluationScore {
  name: string;
  description: string;
  value: number;
}

export interface OrderQcSegmentEvaluation {
  id: string;
  explain: string;
  suggestedNewValue: string;
}

export interface OrderQcEvaluation {
  id: string;
  orderId: string;
  createdAt: string;
  textSummary?: string;
  scores?: OrderQcEvaluationScore[];
  segmentEvals?: OrderQcSegmentEvaluation[];
  isLoading?: boolean;
}

export interface OrderComment {
  id: string;
  createdAt: string;
  userId: string;
  userName: string;
  text: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  status: 'approved' | 'requestEdits' | (string & {});
}

/**
 * A milestone in an order's delivery history.
 *
 * Empty for orders that have not reached a milestone, and for orders created
 * before delivery-event tracking — the log is not backfilled. The same type can
 * appear more than once, for example on an LSP re-delivery or a rerun.
 */
export interface OrderDeliveryEvent {
  // eslint-disable-next-line @typescript-eslint/ban-types
  type: 'ai_delivered' | 'translator_delivered' | 'lsp_approved' | 'order_delivered' | (string & {});
  /** ISO 8601. */
  occurredAt: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  actorType: 'ai' | 'translator' | 'lsp' | 'system' | (string & {});
  /** Null for `ai` and `system` events, and when the actor could not be resolved. */
  actorId: string | null;
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

  // Fields the API fills in on `orders.get()` and `orders.list()`. They are
  // optional because `orders.create()` returns the order before the platform
  // has any of them.

  /**
   * The order type as the API reports it. `orderType` is the name
   * `orders.create()` takes and echoes back; responses use `type`.
   */
  type?: OrderType;
  name?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  rate?: number;
  folderId?: string;
  /** Signed download link for the order's subtitles, when it has any. */
  vttUrl?: string;
  /**
   * The order's files, including the finished deliverables. Each `url` is a
   * signed download link.
   */
  orderDocs?: OrderDocument[];
  finance?: OrderFinance;
  qcEvaluation?: OrderQcEvaluation;
  comments?: OrderComment[];
  /** The order's delivery milestones, oldest first. */
  deliveryEvents?: OrderDeliveryEvent[];
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
  /**
   * Display name for the created project. The platform appends the uploaded
   * file's extension to it, so it does not need one of its own.
   */
  name: string;
  /**
   * Filename to send in the multipart part, e.g. `'en.json'`. The platform
   * takes the stored file's extension from it.
   *
   * Only needed when `file` is a bare `Blob`, which carries no name of its
   * own; a `File` supplies it. Without either, the upload is stored without a
   * usable extension and the document pipeline rejects it.
   */
  filename?: string;
  sourceLanguage: string;
  notes?: OrderNote[];
}

export interface DirectUploadResponse {
  projectId: string;
}

export interface UploadVttParams {
  file: File | Blob;
  /** Filename to send in the multipart part. Defaults to `'subtitles.vtt'`. */
  filename?: string;
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
