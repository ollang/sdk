# Ollang UI (BETA)

Modern interface for Ollang Translation System.

> **Note:** This UI is currently in **BETA**. Features and APIs may change.

## Features

- 🎨 Modern UI with Shadcn components
- 📋 Kanban board with drag & drop
- 🔄 Four workflow stages: Scanned → Translating → Translated → Submitted
- 🎯 Real-time status updates
- 🌐 Multi-language support

## Development

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build
```

## Workflow Stages

1. **Scanned**: Newly discovered translatable texts
2. **Translating**: Texts currently being translated
3. **Translated**: Completed translations awaiting review
4. **Submitted**: Finalized and submitted translations

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Shadcn UI
- dnd-kit (drag & drop)
- Radix UI primitives
