#!/usr/bin/env node
// Downloads static ffmpeg + ffprobe builds and stages them as Tauri sidecars
// under src-tauri/binaries/, named per Rust target triple (same convention
// as scripts/fetch-yt-dlp.mjs). yt-dlp's -x/--audio-format postprocessing
// needs BOTH binaries — it derives ffprobe's path from --ffmpeg-location by
// looking for a sibling "ffprobe" in the same directory, which is exactly
// where Tauri stages every externalBin (see native-fs "sidecar_path" in
// src-tauri/src/lib.rs), so bundling both under the same directory is enough.
// Binaries are NOT committed to git (see src-tauri/binaries/.gitignore).
// Requires `tar` (linux archives) on PATH everywhere, plus either `unzip`
// (macOS/Linux) or PowerShell's Expand-Archive (native Windows, no unzip.exe
// by default) for the windows/macOS zip archives.
// Run with: node scripts/fetch-ffmpeg.mjs [--all]

import { mkdirSync, writeFileSync, chmodSync, rmSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'src-tauri', 'binaries');

// Linux/Windows builds from yt-dlp's own FFmpeg-Builds releases (GPL static, includes libmp3lame).
// macOS build from evermeet.cx (x86_64 only — runs on Apple Silicon via Rosetta 2).
const FFMPEG_BUILDS_BASE = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest';

const TARGETS = {
  'x86_64-unknown-linux-gnu': {
    url: `${FFMPEG_BUILDS_BASE}/ffmpeg-master-latest-linux64-gpl.tar.xz`,
    archive: 'tar.xz',
    members: {
      ffmpeg: 'ffmpeg-master-latest-linux64-gpl/bin/ffmpeg',
      ffprobe: 'ffmpeg-master-latest-linux64-gpl/bin/ffprobe',
    },
    ext: '',
  },
  'aarch64-unknown-linux-gnu': {
    url: `${FFMPEG_BUILDS_BASE}/ffmpeg-master-latest-linuxarm64-gpl.tar.xz`,
    archive: 'tar.xz',
    members: {
      ffmpeg: 'ffmpeg-master-latest-linuxarm64-gpl/bin/ffmpeg',
      ffprobe: 'ffmpeg-master-latest-linuxarm64-gpl/bin/ffprobe',
    },
    ext: '',
  },
  'x86_64-pc-windows-msvc': {
    url: `${FFMPEG_BUILDS_BASE}/ffmpeg-master-latest-win64-gpl.zip`,
    archive: 'zip',
    members: {
      ffmpeg: 'ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe',
      ffprobe: 'ffmpeg-master-latest-win64-gpl/bin/ffprobe.exe',
    },
    ext: '.exe',
  },
  'x86_64-apple-darwin': {
    // resolved dynamically per-binary from evermeet.cx's release info endpoint
    archive: 'zip-flat',
    members: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
    ext: '',
  },
  'aarch64-apple-darwin': {
    archive: 'zip-flat',
    members: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
    ext: '',
    note: 'x86_64 binaries, run under Rosetta 2 on Apple Silicon',
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

async function resolveDarwinUrl(binary) {
  const res = await fetch(`https://evermeet.cx/ffmpeg/info/${binary}/release`);
  if (!res.ok) throw new Error(`evermeet.cx info request failed for ${binary}: ${res.status}`);
  const info = await res.json();
  return info.download.zip.url;
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed for ${url}: ${res.status}`);
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

function extractZipMember(archivePath, member, destPath) {
  const tmp = mkdtempSync(join(tmpdir(), 'ffmpeg-zip-'));
  if (process.platform === 'win32') {
    // why: unzip.exe isn't shipped with Windows; Expand-Archive (PowerShell,
    // built in since Windows 10) is the zero-dependency equivalent, but it
    // only extracts the whole archive, not a single member — extract all,
    // then pick the member out below.
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${tmp}' -Force`,
    ]);
  } else {
    execFileSync('unzip', ['-q', archivePath, member, '-d', tmp]);
  }
  copyFileSync(join(tmp, member), destPath);
  rmSync(tmp, { recursive: true, force: true });
}

function extractMember(archivePath, archiveKind, member, destPath) {
  if (archiveKind === 'tar.xz') {
    const buf = execFileSync('tar', ['-xJf', archivePath, '-O', member], {
      maxBuffer: 1024 * 1024 * 1024,
    });
    writeFileSync(destPath, buf);
  } else if (archiveKind === 'zip' || archiveKind === 'zip-flat') {
    extractZipMember(archivePath, member, destPath);
  } else {
    throw new Error(`unknown archive kind: ${archiveKind}`);
  }
}

async function fetchBinary(target, binary) {
  const spec = TARGETS[target];
  const url = spec.url ?? (await resolveDarwinUrl(binary));
  const tmpArchive = join(tmpdir(), `${binary}-${target}-${Date.now()}`);
  console.log(`downloading ${binary} from ${url}`);
  await downloadToFile(url, tmpArchive);
  const dest = join(outDir, `${binary}-${target}${spec.ext}`);
  extractMember(tmpArchive, spec.archive, spec.members[binary], dest);
  rmSync(tmpArchive, { force: true });
  if (process.platform !== 'win32') chmodSync(dest, 0o755);
  console.log(`wrote ${dest}${spec.note ? ` (${spec.note})` : ''}`);
}

async function fetchTarget(target) {
  await fetchBinary(target, 'ffmpeg');
  await fetchBinary(target, 'ffprobe');
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
