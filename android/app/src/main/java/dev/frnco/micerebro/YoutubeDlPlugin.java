package dev.frnco.micerebro;

import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLException;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.mapper.VideoInfo;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.UUID;

// §19b addendum — native counterpart of the Tauri yt-dlp sidecar
// (youtube-download.service.ts), backed by youtubedl-android
// (bundles yt-dlp + ffmpeg for Android, no process spawn needed since
// Android forbids arbitrary sidecar binaries outside app sandbox).
@CapacitorPlugin(name = "YoutubeDl")
public class YoutubeDlPlugin extends Plugin {

  private static final String TAG = "YoutubeDlPlugin";

  // why: android client sidesteps YouTube's JS signature-cipher challenge,
  //      same reasoning documented next to YOUTUBE_EXTRACTOR_ARGS in
  //      youtube-download.service.ts — kept in sync by hand, no shared
  //      constant across the JS/native boundary.
  private static final String EXTRACTOR_ARGS = "youtube:player_client=android";

  private volatile boolean initialized = false;

  @Override
  public void load() {
    try {
      YoutubeDL.getInstance().init(getContext());
      FFmpeg.getInstance().init(getContext());
      initialized = true;
    } catch (YoutubeDLException e) {
      Log.e(TAG, "youtubedl-android init failed", e);
      initialized = false;
    }
  }

  @PluginMethod
  public void fetchTitle(PluginCall call) {
    if (!initialized) {
      call.reject("youtubedl-android failed to initialize");
      return;
    }
    String url = call.getString("url");
    if (url == null) {
      call.reject("missing url");
      return;
    }
    try {
      YoutubeDLRequest request = new YoutubeDLRequest(url);
      request.addOption("--extractor-args", EXTRACTOR_ARGS);
      VideoInfo info = YoutubeDL.getInstance().getInfo(request);
      JSObject ret = new JSObject();
      ret.put("title", info.getTitle());
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("fetchTitle failed: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void download(PluginCall call) {
    if (!initialized) {
      call.reject("youtubedl-android failed to initialize");
      return;
    }
    String url = call.getString("url");
    if (url == null) {
      call.reject("missing url");
      return;
    }
    File cacheDir = getContext().getCacheDir();
    String id = UUID.randomUUID().toString();
    File outputTemplate = new File(cacheDir, "mi-cerebro-yt-" + id + ".%(ext)s");
    File expected = new File(cacheDir, "mi-cerebro-yt-" + id + ".mp3");
    try {
      YoutubeDLRequest request = new YoutubeDLRequest(url);
      request.addOption("--extractor-args", EXTRACTOR_ARGS);
      // why: sin forzar el stream, el "SABR-only streaming experiment" de
      //      YouTube (github.com/yt-dlp/yt-dlp/issues/12482) puede dejar
      //      sin streams de solo-audio con URL usable, y yt-dlp cae al
      //      formato muxeado 18 (video+audio, cientos de MB) — la
      //      extraccion de audio termina re-codificando un video entero.
      request.addOption("-f", "bestaudio/best");
      request.addOption("-x");
      request.addOption("--audio-format", "mp3");
      request.addOption("--audio-quality", "0");
      request.addOption("-o", outputTemplate.getAbsolutePath());
      YoutubeDL.getInstance().execute(request, null);

      if (!expected.exists()) {
        call.reject("expected mp3 not found after download: " + expected.getAbsolutePath());
        return;
      }
      byte[] bytes = readAllBytes(expected);
      JSObject ret = new JSObject();
      ret.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("download failed: " + e.getMessage(), e);
    } finally {
      // why: mirrors the Tauri path's `remove(expectedPath)` — the bytes
      //      already made it into `ret.base64`, so the cache copy is scratch.
      //noinspection ResultOfMethodCallIgnored
      expected.delete();
    }
  }

  // why: java.nio.file.Files needs API 26+; minSdk here is 24.
  private static byte[] readAllBytes(File file) throws IOException {
    try (FileInputStream in = new FileInputStream(file)) {
      ByteArrayOutputStream out = new ByteArrayOutputStream((int) file.length());
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) != -1) {
        out.write(buf, 0, n);
      }
      return out.toByteArray();
    }
  }
}
