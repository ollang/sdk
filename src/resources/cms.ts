import { OllangClient } from '../client';
import { CapturedContent } from '../browser';

export interface CMSCaptureRequest {
  projectId?: string;
  contents: CapturedContent[];
}

export interface CMSCaptureResponse {
  success: boolean;
  capturedCount: number;
  sessionId: string;
  contents: CapturedContent[];
}

export interface CMSSessionResponse {
  id: string;
  projectId?: string;
  createdAt: string;
  contentCount: number;
  contents: CapturedContent[];
}

export class CMS {
  constructor(private client: OllangClient) {}

  async capture(request: CMSCaptureRequest): Promise<CMSCaptureResponse> {
    return this.client.post('/v1/cms/capture', request);
  }

  async getSession(sessionId: string): Promise<CMSSessionResponse> {
    return this.client.get(`/v1/cms/sessions/${sessionId}`);
  }

  async listSessions(projectId?: string): Promise<CMSSessionResponse[]> {
    const params = projectId ? { projectId } : {};
    return this.client.get('/v1/cms/sessions', { params });
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.client.delete(`/v1/cms/sessions/${sessionId}`);
  }

  async getContentByURL(url: string, sessionId?: string): Promise<CapturedContent[]> {
    const params: any = { url };
    if (sessionId) params.sessionId = sessionId;

    return this.client.get('/v1/cms/content', { params });
  }

  async getContentByField(field: string, sessionId?: string): Promise<CapturedContent[]> {
    const params: any = { field };
    if (sessionId) params.sessionId = sessionId;

    return this.client.get('/v1/cms/content', { params });
  }
}
