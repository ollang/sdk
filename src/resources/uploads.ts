import { OllangClient } from '../client';
import {
  DirectUploadParams,
  DirectUploadResponse,
  UploadVttParams,
  UploadVttResponse,
} from '../types';

export class Uploads {
  constructor(private client: OllangClient) {}

  async direct(params: DirectUploadParams): Promise<DirectUploadResponse> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('name', params.name);
    formData.append('sourceLanguage', params.sourceLanguage);

    if (params.notes) {
      formData.append('notes', JSON.stringify(params.notes));
    }

    return this.client.uploadFile<DirectUploadResponse>('/integration/upload/direct', formData);
  }

  async vtt(params: UploadVttParams): Promise<UploadVttResponse> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('orderId', params.orderId);

    return this.client.uploadFile<UploadVttResponse>('/integration/upload/vtt', formData);
  }
}
