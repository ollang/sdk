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
import Ollang from '@ollang-dev/sdk';

const ollang = new Ollang({
  apiKey: 'your-api-key',
});

// Create a project
const project = await ollang.projects.create({ name: 'My Project' });

// Upload a file
const upload = await ollang.uploads.upload(project.id, './video.mp4');

// Create an order
const order = await ollang.orders.create({
  projectId: project.id,
  sourceLanguage: 'en',
  targetLanguages: ['fr', 'de', 'es'],
});

// Check order status
const status = await ollang.orders.get(order.id);
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
