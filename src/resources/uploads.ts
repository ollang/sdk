import { OllangClient } from '../client';
import {
  DirectUploadParams,
  DirectUploadResponse,
  DirectUrlUploadParams,
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

  /**
   * Registers a remote file, which the platform fetches server-side.
   *
   * Unlike {@link direct}, the bytes never pass through your process, so this
   * has no practical file-size ceiling. `url` must be a direct link such as an
   * S3 presigned URL.
   */
  async directUrl(params: DirectUrlUploadParams): Promise<DirectUploadResponse> {
    const { name, ...rest } = params;
    return this.client.post<DirectUploadResponse>('/integration/upload/direct-url', {
      ...rest,
      originalname: name,
    });
  }
}
