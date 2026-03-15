import axios, { AxiosInstance } from 'axios';
import { OllangConfig } from './types';

export class OllangClient {
  private client: AxiosInstance;
  private apiKey: string;
  private encryptedApiKey: string;

  constructor(config: OllangConfig) {
    this.apiKey = config.apiKey;
    this.encryptedApiKey = this.apiKey;

    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api-integration.ollang.com',
      headers: {
        'X-Api-Key': this.encryptedApiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async get<T>(path: string, params?: any): Promise<T> {
    const response = await this.client.get(path, { params });
    return response.data;
  }

  async post<T>(path: string, data?: any): Promise<T> {
    const response = await this.client.post(path, data);
    return response.data;
  }

  async patch<T>(path: string, data?: any): Promise<T> {
    const response = await this.client.patch(path, data);
    return response.data;
  }

  async delete<T>(path: string): Promise<T> {
    const response = await this.client.delete(path);
    return response.data;
  }

  async uploadFile<T>(path: string, formData: any): Promise<T> {
    const headers = formData.getHeaders
      ? formData.getHeaders()
      : {
          'Content-Type': 'multipart/form-data',
        };

    const response = await this.client.post(path, formData, {
      headers: {
        ...headers,
        'X-Api-Key': this.encryptedApiKey,
      },
    });
    return response.data;
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const response = await this.client.post(path, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Api-Key': this.encryptedApiKey,
      },
    });
    return response.data;
  }
}
