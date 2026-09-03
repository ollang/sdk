import { OllangClient } from '../client';
import { Memory, MemoryImportJob, MemoryImportStarted, MemoryItemInput } from '../types';

/**
 * Translation memories and the items stored in them.
 *
 * A memory is a reusable store of source/target segment pairs that orders can
 * draw on. Pass memory IDs to `orders.create` via `selectedMemories`.
 */
export class Memories {
  constructor(private client: OllangClient) {}

  /** Lists all memories on the account. */
  async list(): Promise<Memory[]> {
    return this.client.get<Memory[]>('/integration/memories');
  }

  /** Creates an empty memory. */
  async create(title: string): Promise<Memory> {
    return this.client.post<Memory>('/integration/memories', { title });
  }

  /** Retrieves a single memory by ID. */
  async get(memoryId: string): Promise<Memory> {
    return this.client.get<Memory>(`/integration/memories/${memoryId}`);
  }

  /** Renames a memory. */
  async update(memoryId: string, title: string): Promise<Memory> {
    return this.client.patch<Memory>(`/integration/memories/${memoryId}`, { title });
  }

  /** Deletes a memory and everything stored in it. */
  async delete(memoryId: string): Promise<void> {
    return this.client.delete<void>(`/integration/memories/${memoryId}`);
  }

  /**
   * Imports segment pairs into a memory.
   *
   * Importing is asynchronous: the response carries a `jobId` you can poll with
   * {@link getImportJob}.
   */
  async importItems(memoryId: string, items: MemoryItemInput[]): Promise<MemoryImportStarted> {
    return this.client.post<MemoryImportStarted>(
      `/integration/memories/${memoryId}/items/import`,
      { items }
    );
  }

  /** Checks the progress of an import started by {@link importItems}. */
  async getImportJob(jobId: string): Promise<MemoryImportJob> {
    return this.client.get<MemoryImportJob>(`/integration/memories/import-jobs/${jobId}`);
  }
}
