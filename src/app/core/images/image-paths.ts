// why: the on-disk layout of `images/<folder>/<slug>/{_gallery.json,original/,thumbs/}`
//      is needed in two places: the feature that owns galleries, and any
//      consumer that wants to read an image referenced from elsewhere (TipTap
//      image-ref nodes embedded in notes/writings). Centralised here so the
//      convention has a single source of truth.
export const IMAGES_DIR = 'images';
export const GALLERY_META_FILE = '_gallery.json';
export const ORIGINAL_DIR = 'original';
export const THUMBS_DIR = 'thumbs';
export const THUMB_EXT = 'webp';
