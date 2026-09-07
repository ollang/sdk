# Ollang SDKs

Public TypeScript/Node/browser, Python, and Java clients for the Ollang integration API. Treat request and response compatibility across all three implementations as one contract.

## Architecture

- `src/resources/` implements TypeScript resources; `src/types/` defines public shapes; `src/index.ts` and `src/browser/` expose package entrypoints.
- `src/tms/` includes runtime translation tooling and its UI. `src/tms/ui-react/` has its own manifest; `src/tms/ui-dist/` is bundled output.
- `python/` and `java/` are separate SDK implementations with their own release metadata and tests.
- `RELEASING.md` and `.github/workflows/` describe CI and publication. Do not infer published versions from the working tree.

## Commands

| Purpose | Command |
| --- | --- |
| Node dependencies | `npm ci` |
| Node typecheck | `npx --no-install tsc --noEmit` |
| Node tests | `npm test -- --runInBand` |
| Node build | `npm run build:node` |
| Node lint | `npm run lint` |
| Python tests, from python/ | `python -m unittest discover tests -v` |
| Java tests, from java/ | `mvn -B test` |

- CI uses Node 24, Python 3.11, and Java 17. Install the Python package in a virtual environment before its tests; package minimums are in each manifest.
- `npm run build` also installs/builds the React UI and bundles the browser package. Use the narrow build unless those surfaces changed.
- `copy:browser` and `dev:browser` assume a sibling checkout path. Check the destination explicitly in a worktree before running them.

## Contract and release rules

- Check public endpoint changes against the integration DTOs and downstream ollang-v3 implementation. Update corresponding TypeScript, Python, Java, tests, and docs together when affected.
- Preserve multipart field names, `projectId` versus `orderId`, nullable responses, pagination, error shape, and stream/file semantics. Avoid sending optional fields as an unintended string `undefined` or `null`.
- A TypeScript export does not prove native consumption works. After export/entrypoint changes, build and verify both CommonJS and native ESM imports, including named exports and the browser entrypoint where affected.
- Keep browser code free of Node-only imports. Test packaging of TMS UI assets when changing build/copy behavior.
- Add mocked HTTP regressions for success, failure, and request serialization. Local tests may bind a socket; distinguish a sandbox bind failure from an assertion failure.
- Publication is separate from validation. Coordinate package versions and release notes across affected languages; do not run publish workflows as a routine test.

## Working agreement

- Inspect the current diff and nearby implementation before editing; preserve unrelated work. Keep changes focused on the requested behavior.
- Treat manifests, source, and CI configuration as the authority when this guide drifts. Update guidance alongside changes to commands or architecture.
- Keep credentials, customer data, generated caches, and local environment files out of diffs and logs.
- Run checks appropriate to the change, then `git diff --check`. Report what passed, existing failures, environment blockers, and any unverified runtime behavior separately.
- Maintain shared instructions here; `CLAUDE.md` imports this file.
