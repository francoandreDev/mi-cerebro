export class TrashCoverUrlCache {
  private readonly byEntry = new Map<string, readonly string[]>();

  urlsFor(entryKey: string): readonly string[] {
    return this.byEntry.get(entryKey) ?? [];
  }

  set(entryKey: string, blobs: readonly Blob[]): readonly string[] {
    this.revoke(entryKey);
    const urls = blobs.map((b) => URL.createObjectURL(b));
    this.byEntry.set(entryKey, urls);
    return urls;
  }

  revoke(entryKey: string): void {
    const urls = this.byEntry.get(entryKey);
    if (!urls) return;
    for (const url of urls) URL.revokeObjectURL(url);
    this.byEntry.delete(entryKey);
  }

  revokeAll(): void {
    for (const urls of this.byEntry.values()) {
      for (const url of urls) URL.revokeObjectURL(url);
    }
    this.byEntry.clear();
  }
}
