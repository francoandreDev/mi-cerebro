export interface ImageRef {
  readonly id: string;
  readonly originalName: string;
  readonly mime: string;
  readonly ext: string;
}

export interface ImageRefGallery {
  readonly id: string;
  readonly title: string;
  readonly folder: string;
  readonly images: readonly ImageRef[];
}
