// why: pure RMS bucketing from a decoded AudioBuffer. No DOM, no audio APIs
// touched — easy to test and reuse if we ever persist peaks to disk.

export const DEFAULT_BUCKET_COUNT = 400;

export const computePeaks = (
  buffer: AudioBuffer,
  bucketCount: number = DEFAULT_BUCKET_COUNT,
): Float32Array => {
  const buckets = Math.max(1, Math.floor(bucketCount));
  const out = new Float32Array(buckets);
  const channelCount = buffer.numberOfChannels;
  if (channelCount === 0 || buffer.length === 0) return out;

  const samplesPerBucket = Math.max(1, Math.floor(buffer.length / buckets));
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) channels.push(buffer.getChannelData(c));

  let globalMax = 0;
  for (let b = 0; b < buckets; b++) {
    const start = b * samplesPerBucket;
    const end =
      b === buckets - 1 ? buffer.length : Math.min(buffer.length, start + samplesPerBucket);
    if (end <= start) continue;
    let sumSquares = 0;
    let count = 0;
    for (let c = 0; c < channelCount; c++) {
      const data = channels[c]!;
      for (let i = start; i < end; i++) {
        const s = data[i] ?? 0;
        sumSquares += s * s;
        count++;
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    out[b] = rms;
    if (rms > globalMax) globalMax = rms;
  }

  // why: normalize so quiet tracks still draw a readable waveform. We keep
  // relative dynamics within the track; comparing height across tracks isn't
  // meaningful, and pretending it is would be a UI lie.
  if (globalMax > 0) {
    for (let i = 0; i < buckets; i++) out[i] = out[i]! / globalMax;
  }
  return out;
};
