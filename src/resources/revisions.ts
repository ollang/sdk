import { OllangClient } from '../client';
import { Revision, CreateRevisionParams } from '../types';

export class Revisions {
  constructor(private client: OllangClient) {}

  async create(orderId: string, params: CreateRevisionParams): Promise<Revision> {
    return this.client.post<Revision>(`/integration/revision/${orderId}`, params);
  }

  async delete(orderId: string, revisionId: string): Promise<void> {
    return this.client.delete<void>(`/integration/revision/${orderId}/${revisionId}`);
  }

  async list(orderId: string): Promise<Revision[]> {
    return this.client.get<Revision[]>(`/integration/revision/${orderId}`);
  }
}
