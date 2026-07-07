#!/usr/bin/env node
// Downloads a static ffmpeg build and stages it as a Tauri sidecar under
// src-tauri/binaries/, named per Rust target triple (same convention as
// scripts/fetch-yt-dlp.mjs — yt-dlp needs ffmpeg on PATH to transcode to mp3).
// Binaries are NOT committed to git (see src-tauri/binaries/.gitignore).
// Requires `tar` (linux archives) and `unzip` (windows/macOS archives) on PATH.
// Run with: node scripts/fetch-ffmpeg.mjs [--all]

import { mkdirSync, writeFileSync, chmodSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'src-tauri', 'binaries');

// Linux/Windows builds from yt-dlp's own FFmpeg-Builds releases (GPL static, includes libmp3lame).
// macOS build from evermeet.cx (x86_64 only — runs on Apple Silicon via Rosetta 2).
const FFMPEG_BUILDS_BASE =
  'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest';

const TARGETS = {
  'x86_64-unknown-linux-gnu': {
    url: `${FFMPEG_BUILDS_BASE}/ffmpeg-master-latest-linux64-gpl.tar.xz`,
    archive: 'tar.xz',
    member: 'ffmpeg-master-latest-linux64-gpl/bin/ffmpeg',
    ext: '',
  },
  'aarch64-unknown-linux-gnu': {
    url: `${FFMPEG_BUILDS_BASE}/ffmpeg-master-latest-linuxarm64-gpl.tar.xz`,
    archive: 'tar.xz',
    member: 'ffmpeg-master-latest-linuxarm64-gpl/bin/ffmpeg',
    ext: '',
  },
  'x86_64-pc-windows-msvc': {
    url: `${FFMPEG_BUILDS_BASE}/ffmpeg-master-latest-win64-gpl.zip`,
    archive: 'zip',
    member: 'ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe',
    ext: '.exe',
  },
  'x86_64-apple-darwin': {
    // resolved dynamically from evermeet.cx's release info endpoint, see resolveDarwinUrl()
    archive: 'zip-flat',
    member: 'ffmpeg',
    ext: '',
  },
  'aarch64-apple-darwin': {
    archive: 'zip-flat',
    member: 'ffmpeg',
    ext: '',
    note: 'x86_64 binary, runs under Rosetta 2 on Apple Silicon',
  },
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

async function resolveDarwinUrl() {
  const res = await fetch('https://evermeet.cx/ffmpeg/info/ffmpeg/release');
  if (!res.ok) throw new Error(`evermeet.cx info request failed: ${res.status}`);
  const info = await res.json();
  return info.download.zip.url;
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed for ${url}: ${res.status}`);
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

function extractMember(archivePath, archiveKind, member, destPath) {
  if (archiveKind === 'tar.xz') {
    const buf = execFileSync('tar', ['-xJf', archivePath, '-O', member], { maxBuffer: 1024 * 1024 * 1024 });
    writeFileSync(destPath, buf);
  } else if (archiveKind === 'zip') {
    const tmp = mkdtempSync(join(tmpdir(), 'ffmpeg-zip-'));
    execFileSync('unzip', ['-q', archivePath, member, '-d', tmp]);
    execFileSync('cp', [join(tmp, member), destPath]);
    rmSync(tmp, { recursive: true, force: true });
  } else if (archiveKind === 'zip-flat') {
    const tmp = mkdtempSync(join(tmpdir(), 'ffmpeg-zip-'));
    execFileSync('unzip', ['-q', archivePath, member, '-d', tmp]);
    execFileSync('cp', [join(tmp, member), destPath]);
    rmSync(tmp, { recursive: true, force: true });
  } else {
    throw new Error(`unknown archive kind: ${archiveKind}`);
  }
}

async function fetchTarget(target) {
  const spec = TARGETS[target];
  const url = spec.url ?? (await resolveDarwinUrl());
  const tmpArchive = join(tmpdir(), `ffmpeg-${target}-${Date.now()}`);
  console.log(`downloading ${url}`);
  await downloadToFile(url, tmpArchive);
  const dest = join(outDir, `ffmpeg-${target}${spec.ext}`);
  extractMember(tmpArchive, spec.archive, spec.member, dest);
  rmSync(tmpArchive, { force: true });
  if (process.platform !== 'win32') chmodSync(dest, 0o755);
  console.log(`wrote ${dest}${spec.note ? ` (${spec.note})` : ''}`);
}

async function main() {
  const all = process.argv.includes('--all');
  mkdirSync(outDir, { recursive: true });
  const targets = all ? Object.keys(TARGETS) : [currentTarget()];
  for (const target of targets) {
    await fetchTarget(target);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
