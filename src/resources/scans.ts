import { OllangClient } from '../client';

export interface ScanSessionResponse {
  id: string;
  projectId: string;
  userId: string;
  isActive: boolean;
  scannedDocs?: ScannedDocResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ScannedDocResponse {
  id: string;
  sessionId: string;
  docId: string;
  originalUrl: string;
  processedUrl?: string;
  scanData: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface CreateScanInput {
  file?: Buffer | Blob;
  url?: string;
  scanData: any;
  originalFilename?: string;
  folderName?: string;
}

export class Scans {
  constructor(private client: OllangClient) {}

  async getOrCreateSession(projectId?: string, folderName?: string): Promise<ScanSessionResponse> {
    return this.client.post('/scans/session', { projectId, folderName });
  }

  async createScan(input: CreateScanInput): Promise<ScannedDocResponse> {
    const formData = new FormData();

    if (input.file) {
      if (Buffer.isBuffer(input.file)) {
        const blob = new Blob([input.file as any]);
        formData.append('file', blob, input.originalFilename || 'scan.jpg');
      } else {
        formData.append('file', input.file, input.originalFilename || 'scan.jpg');
      }
    }

    if (input.url) {
      formData.append('url', input.url);
    }

    formData.append('scanData', JSON.stringify(input.scanData));

    if (input.originalFilename) {
      formData.append('originalFilename', input.originalFilename);
    }

    if (input.folderName) {
      formData.append('folderName', input.folderName);
    }

    return this.client.postFormData('/scans', formData);
  }

  async listScans(): Promise<ScannedDocResponse[]> {
    return this.client.get('/scans');
  }

  async getScan(scanId: string): Promise<ScannedDocResponse> {
    return this.client.get(`/scans/${scanId}`);
  }

  async deleteScan(scanId: string): Promise<void> {
    return this.client.delete(`/scans/${scanId}`);
  }

  async updateScan(scanId: string, input: Partial<CreateScanInput>): Promise<ScannedDocResponse> {
    return this.client.patch(`/scans/${scanId}`, {
      scanData: input.scanData,
      url: input.url,
      originalFilename: input.originalFilename,
      folderName: input.folderName,
    });
  }
}
