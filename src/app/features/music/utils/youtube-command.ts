// why: browsers can't spawn processes (§4.14 — no red/proceso fuera del
//      sandbox), so /music en la versión web no puede correr yt-dlp como
//      hace Tauri/Capacitor (ver youtube-download.service.ts). En vez de
//      dejar el input deshabilitado sin salida, se genera un script listo
//      para pegar en la terminal del usuario que hace lo mismo a mano.
export type YoutubeMediaFormat = 'audio' | 'video';
export type ScriptShell = 'powershell' | 'bash';

export interface YoutubeCommandOptions {
  readonly url: string;
  readonly format: YoutubeMediaFormat;
  readonly destFolder: string;
  readonly filename: string;
}

// why: el cliente "web" por defecto de YouTube exige resolver un desafio de
//      cifrado de firma (necesita un runtime JS que yt-dlp no trae acá);
//      forzar el cliente "android" evita el desafio y devuelve URLs sin
//      firmar. Sin este flag, yt-dlp tira "HTTP Error 403: Forbidden" al
//      intentar bajar el video — mismo flag que usa el sidecar de Tauri
//      (youtube-download.service.ts), verificado ahí contra un video real.
const EXTRACTOR_ARGS = '--extractor-args "youtube:player_client=android"';

// why: el "SABR-only streaming experiment" de YouTube (github.com/yt-dlp/
//      yt-dlp/issues/12482) hace que el cliente android a veces no traiga
//      streams de solo-audio con URL usable, y yt-dlp cae de fallback al
//      formato muxeado 18 (video+audio en baja calidad, pero igual pesa
//      cientos de MB) — la extraccion de audio termina re-codificando un
//      video entero por nada. Forzar "-f bestaudio/best" evita ese
//      fallback: le pide a yt-dlp elegir explicitamente un stream de solo
//      audio, sin arrastrar video.
function ytDlpArgs(format: YoutubeMediaFormat): string {
  const formatArgs =
    format === 'audio'
      ? '-f bestaudio/best -x --audio-format mp3 --audio-quality 0'
      : '-f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4';
  return `${EXTRACTOR_ARGS} ${formatArgs}`;
}

function outputTemplate(filename: string): string {
  const name = filename.trim();
  return name === '' ? '%(title)s.%(ext)s' : `${name}.%(ext)s`;
}

function escapeDouble(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function buildYoutubeScript(shell: ScriptShell, opts: YoutubeCommandOptions): string {
  const url = escapeDouble(opts.url.trim());
  const folder = escapeDouble(opts.destFolder.trim() || '.');
  const args = ytDlpArgs(opts.format);
  const output = escapeDouble(outputTemplate(opts.filename));

  return shell === 'powershell'
    ? buildPowerShellScript(url, folder, args, output)
    : buildBashScript(url, folder, args, output);
}

function buildPowerShellScript(url: string, folder: string, args: string, output: string): string {
  return `# Requiere yt-dlp + ffmpeg. Metodo alternativo si algo falla: bajar
# yt-dlp.exe directo de https://github.com/yt-dlp/yt-dlp/releases y
# ejecutarlo con la misma ruta completa en vez del comando "yt-dlp".
if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {
  Write-Host "yt-dlp no esta instalado. Instalalo con una de estas opciones:"
  Write-Host "  winget install yt-dlp.yt-dlp"
  Write-Host "  scoop install yt-dlp"
  Write-Host "  pip install -U yt-dlp"
  exit 1
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "ffmpeg no esta instalado (yt-dlp lo necesita para convertir/unir el archivo). Instalalo con:"
  Write-Host "  winget install Gyan.FFmpeg"
  Write-Host "  scoop install ffmpeg"
  Write-Host "  choco install ffmpeg"
  exit 1
}
New-Item -ItemType Directory -Force -Path "${folder}" | Out-Null
yt-dlp ${args} -P "${folder}" -o "${output}" "${url}"
`;
}

function buildBashScript(url: string, folder: string, args: string, output: string): string {
  return `#!/usr/bin/env bash
# Requiere yt-dlp + ffmpeg. Metodo alternativo si algo falla: bajar el
# binario estatico directo de https://github.com/yt-dlp/yt-dlp/releases,
# darle permiso de ejecucion (chmod +x yt-dlp) y correrlo con ./yt-dlp
# en vez del comando "yt-dlp".
set -e
if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp no esta instalado. Instalalo con una de estas opciones:"
  echo "  Linux (apt):  sudo apt install yt-dlp   (si tu distro tiene una version vieja: pip install -U yt-dlp)"
  echo "  macOS (brew): brew install yt-dlp"
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg no esta instalado (yt-dlp lo necesita para convertir/unir el archivo). Instalalo con:"
  echo "  Linux (apt):  sudo apt install ffmpeg"
  echo "  macOS (brew): brew install ffmpeg"
  exit 1
fi
mkdir -p "${folder}"
yt-dlp ${args} -P "${folder}" -o "${output}" "${url}"
`;
}
