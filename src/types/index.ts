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
