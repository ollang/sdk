import { OllangClient } from '../client';
import { ExportContentParams, ImportContentParams, ImportContentResponse } from '../types';

/** Import and export translation units held in your content database. */
export class Content {
  constructor(private client: OllangClient) {}

  /** Imports translation units. */
  async import(params: ImportContentParams): Promise<ImportContentResponse> {
    return this.client.post<ImportContentResponse>('/integration/content/import', params);
  }

  /**
   * Exports content translations as JSON, filtered by language, tag or order.
   *
   * List filters are sent as repeated bracket-suffixed query parameters
   * (`targetLanguages[]=fr&targetLanguages[]=de`), which is the encoding the API
   * expects.
   */
  async export(params?: ExportContentParams): Promise<any> {
    const queryParams: any = {};

    if (params?.targetLanguage) queryParams.targetLanguage = params.targetLanguage;
    if (params?.targetLanguages?.length) queryParams.targetLanguages = params.targetLanguages;
    if (params?.tag) queryParams.tag = params.tag;
    if (params?.tags?.length) queryParams.tags = params.tags;
    if (params?.orderIds?.length) queryParams.orderIds = params.orderIds;

    return this.client.get<any>('/integration/content/export', queryParams);
  }
}
