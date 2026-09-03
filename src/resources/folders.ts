import { OllangClient } from '../client';
import {
  AssignTranslatorParams,
  BulkExportFoldersParams,
  FolderOrderLanguagePair,
  FoldersListResponse,
  ListFoldersParams,
  UnassignTranslatorParams,
} from '../types';
import { saveBuffer } from './_files';

/** Browse folders and act on every order inside them at once. */
export class Folders {
  constructor(private client: OllangClient) {}

  /** Lists folders, with optional pagination and search. */
  async list(params?: ListFoldersParams): Promise<FoldersListResponse> {
    const queryParams: any = {};

    if (params?.pageOptions) {
      const { page, take, search, orderBy, orderDirection } = params.pageOptions;
      if (page !== undefined) queryParams.page = page;
      if (take !== undefined) queryParams.take = take;
      if (search) queryParams.search = search;
      if (orderBy) queryParams.orderBy = orderBy;
      if (orderDirection) queryParams.orderDirection = orderDirection;
    }

    return this.client.get<FoldersListResponse>('/integration/folder', queryParams);
  }

  /** Lists the source/target language pairs of a folder's orders. */
  async orderLanguagePairs(
    folderId: string,
    status?: string
  ): Promise<FolderOrderLanguagePair[]> {
    return this.client.get<FolderOrderLanguagePair[]>(
      `/integration/folder/${folderId}/order-language-pairs`,
      status ? { status } : undefined
    );
  }

  /**
   * Assigns a translator to the folder's orders.
   *
   * Narrow the assignment with `sourceLanguage` / `targetLanguage`; omit both to
   * cover every order in the folder.
   */
  async assignTranslator(folderId: string, params: AssignTranslatorParams): Promise<any> {
    return this.client.post<any>(
      `/integration/folder/${folderId}/assign-translator-to-orders`,
      params
    );
  }

  /** Removes translator assignments from the folder's orders. */
  async unassignTranslator(
    folderId: string,
    params: UnassignTranslatorParams = {}
  ): Promise<any> {
    return this.client.post<any>(
      `/integration/folder/${folderId}/unassign-translator-from-orders`,
      params
    );
  }

  /**
   * Exports several folders as one multi-sheet XLSX workbook.
   *
   * Resolves to the raw file bytes. Use {@link exportXlsxToFile} to write them
   * straight to disk.
   */
  async exportXlsx(params: BulkExportFoldersParams): Promise<Buffer> {
    return this.client.postBuffer('/integration/folder/export-xlsx', params);
  }

  /** Exports folders as XLSX and saves the workbook to `filePath`. */
  async exportXlsxToFile(params: BulkExportFoldersParams, filePath: string): Promise<string> {
    return saveBuffer(await this.exportXlsx(params), filePath);
  }
}
