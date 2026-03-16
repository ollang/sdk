#!/usr/bin/env node

/**
 * Ollang Translation System CLI
 *
 * Usage: npx @ollang-dev/sdk start
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Ollang Translation System starting...\n');

const serverPath = path.join(__dirname, '..', 'dist', 'tms', 'server', 'index.js');

if (!fs.existsSync(serverPath)) {
  console.error('❌  npm run build');
  process.exit(1);
}

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    TMS_PROJECT_ROOT: process.cwd(),
  },
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Ollang shutting down...');
  server.kill('SIGINT');
  process.exit(0);
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Server closed with error (code: ${code})`);
    process.exit(code);
  }
});
