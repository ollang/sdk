import { OllangClient } from '../client';
import {
  DirectUploadParams,
  DirectUploadResponse,
  DirectUrlUploadParams,
  UploadVttParams,
  UploadVttResponse,
} from '../types';

/**
 * Picks the filename to send in the multipart part.
 *
 * The platform derives the stored file's extension from this name, so a part
 * sent without one is stored extension-less and the document pipeline cannot
 * process it. A `File` carries its own name; a bare `Blob` does not, which is
 * why `filename` can be passed explicitly and why the display name is the last
 * resort.
 */
function resolveFilename(file: File | Blob, explicit: string | undefined, fallback: string): string {
  if (explicit) {
    return explicit;
  }

  const name = (file as File).name;
  if (typeof name === 'string' && name.length > 0) {
    return name;
  }

  return fallback;
}

export class Uploads {
  constructor(private client: OllangClient) {}

  async direct(params: DirectUploadParams): Promise<DirectUploadResponse> {
    const formData = new FormData();
    formData.append('file', params.file, resolveFilename(params.file, params.filename, params.name));
    formData.append('name', params.name);
    formData.append('sourceLanguage', params.sourceLanguage);

    if (params.notes) {
      formData.append('notes', JSON.stringify(params.notes));
    }

    return this.client.uploadFile<DirectUploadResponse>('/integration/upload/direct', formData);
  }

  async vtt(params: UploadVttParams): Promise<UploadVttResponse> {
    const formData = new FormData();
    formData.append(
      'file',
      params.file,
      resolveFilename(params.file, params.filename, 'subtitles.vtt')
    );
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
