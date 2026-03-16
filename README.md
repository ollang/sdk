# @ollang-dev/sdk

Official TypeScript/Node.js SDK for the Ollang API.

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

## Ollang Translation System

Launch the built-in Ollang dashboard to scan and manage translatable content in your project:

```bash
npx @ollang-dev/sdk start
```

## Resources

| Resource                    | Description                            |
| --------------------------- | -------------------------------------- |
| `ollang.projects`           | Create and manage projects             |
| `ollang.uploads`            | Upload files (video, audio, documents) |
| `ollang.orders`             | Create and track translation orders    |
| `ollang.revisions`          | Request revisions on completed orders  |
| `ollang.customInstructions` | Set custom translation instructions    |
| `ollang.scans`              | Scan content for translatable text     |
| `ollang.cms`                | CMS integration                        |

## Documentation

For comprehensive API documentation, guides, and examples visit:

**[https://api-docs.ollang.com](https://api-docs.ollang.com/)**

## License

MIT
