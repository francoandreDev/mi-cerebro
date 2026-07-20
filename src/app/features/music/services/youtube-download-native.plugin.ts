import { registerPlugin } from '@capacitor/core';

// Bridge to android/app/src/main/java/dev/frnco/micerebro/YoutubeDlPlugin.java
// (youtubedl-android — native yt-dlp+ffmpeg for Capacitor, see §19b addendum
// in docs/proyecto/roadmap-19-21.md). No iOS/web implementation: registerPlugin
// throws if called outside Capacitor, which YoutubeDownloadService already
// guards against via PlatformService before touching this.
export interface YoutubeDlNativePlugin {
  fetchTitle(options: { url: string }): Promise<{ title: string }>;
  download(options: { url: string }): Promise<{ base64: string }>;
}

export const YoutubeDlNative = registerPlugin<YoutubeDlNativePlugin>('YoutubeDl');
