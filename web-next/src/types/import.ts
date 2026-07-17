export type ImageTag = "thumbnail" | "keep" | "size-chart" | "skip";

export interface ScrapedImage {
  url: string;
  thumbUrl: string;
  tag: ImageTag;
  autoDetected?: ImageTag;
}

export interface ScrapedAlbum {
  sourceUrl: string;
  title: string | null;
  description: string | null;
  seller: string | null;
  weidianUrl: string | null;
  taobaoUrl: string | null;
  price: string | null;
  suggestedSlug: string;
  images: ScrapedImage[];
}

export interface AlbumMeta {
  slug: string;
  userLabel: string;
  brand: string;
  category: string;
  sizing: string;
}

export interface SaveAlbum {
  sourceUrl: string;
  slug: string;
  userLabel: string;
  brand: string;
  category: string;
  description: string | null;
  weidianUrl: string | null;
  taobaoUrl: string | null;
  price: string | null;
  images: Array<{ url: string; tag: ImageTag }>;
}
