import { Ollang } from '../src/index';

/**
 * These tests exercise the request each resource method builds — path, method,
 * query parameters and body — against a stubbed HTTP layer. No network is used.
 */

interface RecordedCall {
  method: string;
  path: string;
  params?: any;
  data?: any;
}

function makeClient(response: any = { ok: true }) {
  const ollang = new Ollang({ apiKey: 'test-key' });
  const calls: RecordedCall[] = [];
  const client: any = ollang.getClient();

  client.get = jest.fn(async (path: string, params?: any) => {
    calls.push({ method: 'GET', path, params });
    return response;
  });
  client.post = jest.fn(async (path: string, data?: any) => {
    calls.push({ method: 'POST', path, data });
    return response;
  });
  client.patch = jest.fn(async (path: string, data?: any) => {
    calls.push({ method: 'PATCH', path, data });
    return response;
  });
  client.delete = jest.fn(async (path: string) => {
    calls.push({ method: 'DELETE', path });
    return response;
  });
  client.getBuffer = jest.fn(async (path: string, params?: any) => {
    calls.push({ method: 'GET', path, params });
    return Buffer.from('xlsx-bytes');
  });
  client.postBuffer = jest.fn(async (path: string, data?: any) => {
    calls.push({ method: 'POST', path, data });
    return Buffer.from('xlsx-bytes');
  });

  return { ollang, calls };
}

describe('memories', () => {
  it('uses the right paths and verbs', async () => {
    const { ollang, calls } = makeClient();

    await ollang.memories.list();
    await ollang.memories.create('Brand terms');
    await ollang.memories.get('m1');
    await ollang.memories.update('m1', 'Renamed');
    await ollang.memories.delete('m1');

    expect(calls[0]).toMatchObject({ method: 'GET', path: '/integration/memories' });
    expect(calls[1]).toMatchObject({
      method: 'POST',
      path: '/integration/memories',
      data: { title: 'Brand terms' },
    });
    expect(calls[2].path).toBe('/integration/memories/m1');
    expect(calls[3]).toMatchObject({ method: 'PATCH', data: { title: 'Renamed' } });
    expect(calls[4].method).toBe('DELETE');
  });

  it('imports items and polls the job', async () => {
    const { ollang, calls } = makeClient();
    const items = [
      { sourceLanguage: 'en', targetLanguage: 'fr', sourceText: 'hi', targetText: 'salut' },
    ];

    await ollang.memories.importItems('m1', items);
    await ollang.memories.getImportJob('j1');

    expect(calls[0]).toMatchObject({
      path: '/integration/memories/m1/items/import',
      data: { items },
    });
    expect(calls[1].path).toBe('/integration/memories/import-jobs/j1');
  });
});

describe('folders', () => {
  it('lists with pagination and filters language pairs', async () => {
    const { ollang, calls } = makeClient();

    await ollang.folders.list({ pageOptions: { page: 2, take: 5, search: 'promo' } });
    await ollang.folders.orderLanguagePairs('f1', 'completed');

    expect(calls[0]).toMatchObject({
      path: '/integration/folder',
      params: { page: 2, take: 5, search: 'promo' },
    });
    expect(calls[1]).toMatchObject({
      path: '/integration/folder/f1/order-language-pairs',
      params: { status: 'completed' },
    });
  });

  it('assigns and unassigns translators', async () => {
    const { ollang, calls } = makeClient();

    await ollang.folders.assignTranslator('f1', {
      translatorId: 't1',
      deadline: '2026-01-01',
      targetLanguage: 'fr',
    });
    await ollang.folders.unassignTranslator('f1', { targetLanguage: 'fr' });

    expect(calls[0]).toMatchObject({
      path: '/integration/folder/f1/assign-translator-to-orders',
      data: { translatorId: 't1', deadline: '2026-01-01', targetLanguage: 'fr' },
    });
    expect(calls[1]).toMatchObject({
      path: '/integration/folder/f1/unassign-translator-from-orders',
      data: { targetLanguage: 'fr' },
    });
  });

  it('exports xlsx as a buffer and writes it to disk', async () => {
    const { ollang, calls } = makeClient();
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    const buffer = await ollang.folders.exportXlsx({
      folderIds: ['f1', 'f2'],
      targetLanguages: ['fr', 'de'],
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/integration/folder/export-xlsx',
      data: { folderIds: ['f1', 'f2'], targetLanguages: ['fr', 'de'] },
    });

    const target = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'ollang-')),
      'nested',
      'folders.xlsx'
    );
    const written = await ollang.folders.exportXlsxToFile(
      { folderIds: ['f1'], targetLanguages: ['fr'] },
      target
    );
    expect(written).toBe(target);
    expect(fs.readFileSync(target).toString()).toBe('xlsx-bytes');
  });
});

describe('order extras', () => {
  it('hits the review and embedding endpoints', async () => {
    const { ollang, calls } = makeClient();

    await ollang.orders.cancelHumanReview('o1');
    await ollang.orders.requestSubtitleEmbedding('o1');
    await ollang.orders.reviewInfo('o1');

    expect(calls[0].path).toBe('/integration/orders/o1/cancel-human-review');
    expect(calls[1].path).toBe('/integration/orders/o1/subtitle-embedding');
    expect(calls[2]).toMatchObject({
      method: 'GET',
      path: '/integration/orders/o1/review/info',
    });
  });

  it('exports an order as xlsx', async () => {
    const { ollang, calls } = makeClient();

    const buffer = await ollang.orders.exportXlsx('o1');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(calls[0]).toMatchObject({
      method: 'GET',
      path: '/integration/orders/o1/export-xlsx',
    });
  });
});

describe('content, billing, locales and figma', () => {
  it('imports and exports content', async () => {
    const { ollang, calls } = makeClient();
    const translations = [{ sourceText: 'hi', targetText: 'salut' }];

    await ollang.content.import({ targetLanguage: 'fr', translations });
    await ollang.content.export({ targetLanguages: ['fr', 'de'], tags: ['ui'] });

    expect(calls[0]).toMatchObject({
      path: '/integration/content/import',
      data: { targetLanguage: 'fr', translations },
    });
    expect(calls[1]).toMatchObject({
      path: '/integration/content/export',
      params: { targetLanguages: ['fr', 'de'], tags: ['ui'] },
    });
  });

  it('sends bracketed billing query parameters', async () => {
    const { ollang, calls } = makeClient();

    await ollang.billing.credits();
    await ollang.billing.consumption({
      pageOptions: { page: 2 },
      filter: { from: '2026-01-01', provider: 'deepl' },
    });

    expect(calls[0].path).toBe('/integration/credits');
    expect(calls[1]).toMatchObject({
      path: '/integration/consumption',
      params: {
        'pageOptions[page]': 2,
        'filter[from]': '2026-01-01',
        'filter[provider]': 'deepl',
      },
    });
  });

  it('resolves locales and escapes the validated tag', async () => {
    const { ollang, calls } = makeClient();

    await ollang.locales.languages();
    await ollang.locales.search('portu');
    await ollang.locales.validate('pt-PT');
    await ollang.locales.validate('pt/PT');

    expect(calls[0].path).toBe('/integration/locales/languages');
    expect(calls[1].params).toEqual({ q: 'portu' });
    expect(calls[2].path).toBe('/integration/locales/validate/pt-PT');
    expect(calls[3].path).toBe('/integration/locales/validate/pt%2FPT');
  });

  it('creates and tracks figma orders', async () => {
    const { ollang, calls } = makeClient();

    await ollang.figma.createOrder({
      fileKey: 'abc',
      fileUrl: 'https://figma.com/file/abc',
      sourceLanguage: 'en',
      targetLanguages: ['fr'],
      folderId: 'f1',
    });
    await ollang.figma.listOrders('abc');
    await ollang.figma.orderStatus('o1');

    expect(calls[0]).toMatchObject({
      path: '/integration/orders/figma/create',
      data: { fileKey: 'abc', folderId: 'f1' },
    });
    expect(calls[1].params).toEqual({ fileKey: 'abc' });
    expect(calls[2].path).toBe('/integration/orders/figma/o1/status');
  });
});

describe('url-based creation', () => {
  it('creates a project from a url', async () => {
    const { ollang, calls } = makeClient();

    await ollang.projects.createByUrl({
      url: 'https://example.com/a.mp4',
      name: 'a.mp4',
      sourceLanguage: 'en',
      notes: [{ details: 'intro', timeStamp: '00:00:01' }],
    });

    expect(calls[0]).toMatchObject({
      path: '/integration/project/create-by-url',
      data: { url: 'https://example.com/a.mp4', name: 'a.mp4' },
    });
  });

  it('registers a remote upload as originalname', async () => {
    const { ollang, calls } = makeClient();

    await ollang.uploads.directUrl({
      url: 'https://example.com/a.mp4',
      name: 'a.mp4',
      size: 1234,
      sourceLanguage: 'en',
    });

    expect(calls[0]).toMatchObject({
      path: '/integration/upload/direct-url',
      data: {
        url: 'https://example.com/a.mp4',
        originalname: 'a.mp4',
        size: 1234,
        sourceLanguage: 'en',
      },
    });
    expect(calls[0].data.name).toBeUndefined();
  });
});
