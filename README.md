# @ollang-dev/sdk

Official TypeScript/Node.js SDK for the Ollang API.

## Other Languages

This repository also hosts the official Ollang API client libraries for other languages:

| Language   | Location                 | Install                                            |
| ---------- | ------------------------ | -------------------------------------------------- |
| TypeScript | this package             | `npm install @ollang-dev/sdk`                      |
| Python     | [`python/`](./python)    | `pip install ollang-sdk`                           |
| Java       | [`java/`](./java)        | `com.ollang:ollang-sdk` (Maven) — see [java/README](./java/README.md) |

## Installation

```bash
npm install @ollang-dev/sdk
```

## Quick Start

```typescript
import { readFile } from 'node:fs/promises';
import { Ollang } from '@ollang-dev/sdk';

const ollang = new Ollang({ apiKey: process.env.OLLANG_API_KEY! });

// Upload a source file. This creates the project for it.
const upload = await ollang.uploads.direct({
  file: new Blob([await readFile('./video.mp4')]),
  filename: 'video.mp4',
  name: 'My Video',
  sourceLanguage: 'en',
});

// Order translations off that project
const order = await ollang.orders.create({
  orderType: 'subtitle',
  level: 0,
  projectId: upload.projectId,
  targetLanguageConfigs: [
    { language: 'fr', isRush: false },
    { language: 'de', isRush: false },
  ],
});

// Check order status, and collect the deliverables once it completes
const status = await ollang.orders.get(order.id);
for (const doc of status.orderDocs ?? []) {
  console.log(doc.type, doc.name, doc.url);
}
```

`Ollang` is a named export. It is also the default export, so
`import Ollang from '@ollang-dev/sdk'` works too.

### Naming the uploaded file

`uploads.direct` sends the file under a real filename, and the platform takes
the stored file's extension from it. A `File` carries its own name; a bare
`Blob` does not, so pass `filename` alongside it.

`Blob` with `filename` is the portable form. `File` is only a global from Node
20 onwards, so `new File(...)` throws `ReferenceError: File is not defined` on
Node 18 — and `node:buffer`'s `File` is not a substitute here, as it does not
satisfy this parameter's type. A global `File` works fine where it exists, and
supplies the name when `filename` is omitted.

```typescript
await ollang.uploads.direct({
  file: new Blob([JSON.stringify(strings)]),
  filename: 'en.json',
  name: 'App strings',
  sourceLanguage: 'en',
});
```

Without a name the upload has no usable extension, and the API rejects it
rather than creating a project the document pipeline cannot process.

`name` is the display name for the project; it does not need an extension of
its own.

For files too large to hold in memory, register them by URL instead — the
platform fetches the bytes server-side:

```typescript
const upload = await ollang.uploads.directUrl({
  url: presignedS3Url,
  name: 'feature.mp4',
  size: bytes,
  sourceLanguage: 'en',
});
```

## Ollang SDK (BETA)

> **Note:** Ollang SDK is currently in **BETA**. Features and APIs may change.

Launch the built-in Ollang dashboard to scan and manage translatable content in your project:

```bash
npx @ollang-dev/sdk start
```

## Resources

| Resource                    | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `ollang.projects`           | Create, read and list projects                     |
| `ollang.uploads`            | Upload files, or register remote ones by URL       |
| `ollang.orders`             | Create, track, review and export orders            |
| `ollang.folders`            | Browse folders and act on all their orders at once |
| `ollang.revisions`          | Request revisions on completed orders              |
| `ollang.memories`           | Translation memories and their items               |
| `ollang.customInstructions` | Set custom translation instructions                |
| `ollang.content`            | Import and export translation units                |
| `ollang.billing`            | Credit wallet and consumption history              |
| `ollang.locales`            | Resolve and validate language codes                |
| `ollang.figma`              | Import Figma files and track their orders          |
| `ollang.scans`              | Scan content for translatable text                 |
| `ollang.cms`                | CMS integration                                    |

### Binary exports

The XLSX endpoints resolve to a `Buffer` rather than JSON. Each has a
`...ToFile` companion that writes the workbook to a path, creating parent
directories as needed:

```ts
const bytes = await ollang.orders.exportXlsx('ORDER_ID');

await ollang.orders.exportXlsxToFile('ORDER_ID', 'out/order.xlsx');
await ollang.folders.exportXlsxToFile(
  { folderIds: ['FOLDER_ID'], targetLanguages: ['fr', 'de'] },
  'out/folders.xlsx'
);
```

## Documentation

For comprehensive API documentation, guides, and examples visit:

**[https://api-docs.ollang.com](https://api-docs.ollang.com/)**

## License

MIT
