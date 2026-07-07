#!/usr/bin/env node
// Downloads the yt-dlp binary release and stages it as a Tauri sidecar under
// src-tauri/binaries/, named per Rust target triple as `externalBin` requires.
// Binaries are NOT committed to git (see src-tauri/binaries/.gitignore) —
// run this before `bun tauri dev` / `bun tauri build`.
// Run with: node scripts/fetch-yt-dlp.mjs [--all]

import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'src-tauri', 'binaries');

// Maps a Rust target triple to the yt-dlp release asset that serves it.
// yt-dlp_macos is a universal2 binary, so both darwin triples share it.
const TARGETS = {
  'x86_64-pc-windows-msvc': { asset: 'yt-dlp.exe', ext: '.exe' },
  'x86_64-apple-darwin': { asset: 'yt-dlp_macos', ext: '' },
  'aarch64-apple-darwin': { asset: 'yt-dlp_macos', ext: '' },
  'x86_64-unknown-linux-gnu': { asset: 'yt-dlp_linux', ext: '' },
  'aarch64-unknown-linux-gnu': { asset: 'yt-dlp_linux_aarch64', ext: '' },
};

function currentTarget() {
  const { platform, arch } = process;
  if (platform === 'win32') return 'x86_64-pc-windows-msvc';
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  }
  if (platform === 'linux') {
    return arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu';
  }
  throw new Error(`unsupported platform: ${platform}/${arch}`);
}

async function fetchLatestRelease() {
  const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
  if (!res.ok) throw new Error(`GitHub API request failed: ${res.status}`);
  return res.json();
}

async function downloadAsset(release, assetName, destPath) {
  const asset = release.assets.find((a) => a.name === assetName);
  if (!asset) throw new Error(`asset not found in release: ${assetName}`);
  const res = await fetch(asset.browser_download_url);
  if (!res.ok) throw new Error(`download failed for ${assetName}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
  if (process.platform !== 'win32') chmodSync(destPath, 0o755);
  console.log(`wrote ${destPath} (${buf.length} bytes)`);
}

async function main() {
  const all = process.argv.includes('--all');
  mkdirSync(outDir, { recursive: true });
  const release = await fetchLatestRelease();
  const targets = all ? Object.keys(TARGETS) : [currentTarget()];
  for (const target of targets) {
    const { asset, ext } = TARGETS[target];
    const dest = join(outDir, `yt-dlp-${target}${ext}`);
    await downloadAsset(release, asset, dest);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
