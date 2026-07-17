"use client";

import { useReducer, useCallback, useEffect } from "react";
import type {
  ScrapedAlbum,
  ScrapedImage,
  ImageTag,
  SaveAlbum,
} from "@/types/import";

type Phase = "input" | "scraping" | "tagging" | "saving" | "done";

interface State {
  phase: Phase;
  urls: string;
  albums: ScrapedAlbum[];
  errors: Array<{ url: string; error: string }>;
  created: string[];
}

type Action =
  | { type: "SET_URLS"; urls: string }
  | { type: "START_SCRAPE" }
  | {
      type: "SCRAPE_DONE";
      albums: ScrapedAlbum[];
      errors: Array<{ url: string; error: string }>;
    }
  | {
      type: "TAG_IMAGE";
      albumIdx: number;
      imageIdx: number;
      tag: ImageTag;
    }
  | { type: "UPDATE_ALBUM_FIELD"; albumIdx: number; field: string; value: string }
  | { type: "START_SAVE" }
  | { type: "SAVE_DONE"; created: string[] }
  | { type: "RESET" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_URLS":
      return { ...state, urls: action.urls };
    case "START_SCRAPE":
      return { ...state, phase: "scraping" };
    case "SCRAPE_DONE":
      return {
        ...state,
        phase: "tagging",
        albums: action.albums,
        errors: action.errors,
      };
    case "TAG_IMAGE": {
      const albums = [...state.albums];
      const album = { ...albums[action.albumIdx] };
      const images = [...album.images];
      const img = { ...images[action.imageIdx] };

      if (action.tag === "thumbnail") {
        images.forEach((im, i) => {
          if (im.tag === "thumbnail") {
            images[i] = { ...im, tag: "keep" };
          }
        });
      }

      img.tag = action.tag;
      images[action.imageIdx] = img;
      album.images = images;
      albums[action.albumIdx] = album;
      return { ...state, albums };
    }
    case "UPDATE_ALBUM_FIELD": {
      const albums = [...state.albums];
      const album = { ...albums[action.albumIdx] };
      (album as Record<string, unknown>)[action.field] = action.value;
      albums[action.albumIdx] = album;
      return { ...state, albums };
    }
    case "START_SAVE":
      return { ...state, phase: "saving" };
    case "SAVE_DONE":
      return { ...state, phase: "done", created: action.created };
    case "RESET":
      return { phase: "input", urls: "", albums: [], errors: [], created: [] };
    default:
      return state;
  }
}

const TAG_STYLES: Record<ImageTag, { bg: string; label: string; icon: string }> = {
  thumbnail: { bg: "bg-yellow-500", label: "Thumb", icon: "★" },
  keep: { bg: "bg-green-600", label: "Keep", icon: "✓" },
  "size-chart": { bg: "bg-blue-500", label: "Chart", icon: "📏" },
  skip: { bg: "bg-neutral-400", label: "Skip", icon: "✕" },
};

const SELECTABLE_TAGS: ImageTag[] = ["thumbnail", "keep", "size-chart"];

export function ImportClient() {
  const [state, dispatch] = useReducer(reducer, {
    phase: "input",
    urls: "",
    albums: [],
    errors: [],
    created: [],
  });

  useEffect(() => {
    fetch("/api/import/preload")
      .then((r) => r.json())
      .then((data) => {
        if (data.albums?.length && state.phase === "input") {
          dispatch({
            type: "SCRAPE_DONE",
            albums: data.albums,
            errors: data.errors ?? [],
          });
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrape = useCallback(async () => {
    const urls = state.urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (!urls.length) return;

    dispatch({ type: "START_SCRAPE" });

    const res = await fetch("/api/import/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    const data = await res.json();

    const albums: ScrapedAlbum[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    for (const r of data.results) {
      if (r.ok) albums.push(r.album);
      else errors.push({ url: r.url, error: r.error });
    }

    dispatch({ type: "SCRAPE_DONE", albums, errors });
  }, [state.urls]);

  const handleSave = useCallback(async () => {
    dispatch({ type: "START_SAVE" });

    const payload: SaveAlbum[] = state.albums.map((album) => ({
      sourceUrl: album.sourceUrl,
      slug: album.suggestedSlug,
      userLabel: album.title ?? album.suggestedSlug,
      brand: "",
      category: "",
      description: album.description,
      weidianUrl: album.weidianUrl,
      taobaoUrl: album.taobaoUrl,
      price: album.price,
      images: album.images.map((img) => ({
        url: img.url,
        tag: img.tag,
      })),
    }));

    const res = await fetch("/api/import/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albums: payload }),
    });
    const data = await res.json();
    dispatch({ type: "SAVE_DONE", created: data.created ?? [] });
  }, [state.albums]);

  if (state.phase === "input" || state.phase === "scraping") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-medium tracking-tight">Import from Yupoo</h1>
        <textarea
          value={state.urls}
          onChange={(e) =>
            dispatch({ type: "SET_URLS", urls: e.target.value })
          }
          placeholder="Paste Yupoo album URLs (one per line)"
          rows={8}
          className="w-full rounded border border-(--color-border) bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:border-(--color-fg)"
        />
        <button
          onClick={handleScrape}
          disabled={state.phase === "scraping"}
          className="self-start border border-(--color-fg) bg-(--color-fg) px-6 py-2 text-xs uppercase tracking-widest text-white hover:opacity-80 disabled:opacity-40"
        >
          {state.phase === "scraping" ? "Scraping..." : "Scrape Albums"}
        </button>
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-medium tracking-tight">Import Complete</h1>
        <p className="text-sm text-(--color-muted)">
          Created {state.created.length} favorites:{" "}
          {state.created.join(", ")}
        </p>
        <div className="flex gap-2">
          <a
            href="/"
            className="border border-(--color-fg) bg-(--color-fg) px-6 py-2 text-xs uppercase tracking-widest text-white hover:opacity-80"
          >
            Browse
          </a>
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="border border-(--color-border) px-6 py-2 text-xs uppercase tracking-widest text-(--color-muted) hover:text-(--color-fg)"
          >
            Import More
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium tracking-tight">
          Tag Images ({state.albums.length} album
          {state.albums.length > 1 ? "s" : ""})
        </h1>
        <button
          onClick={handleSave}
          disabled={state.phase === "saving"}
          className="border border-(--color-fg) bg-(--color-fg) px-6 py-2 text-xs uppercase tracking-widest text-white hover:opacity-80 disabled:opacity-40"
        >
          {state.phase === "saving"
            ? "Saving..."
            : `Import ${state.albums.length} items`}
        </button>
      </div>

      {state.errors.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
          {state.errors.map((e, i) => (
            <div key={i}>
              Failed: {e.url} — {e.error}
            </div>
          ))}
        </div>
      )}

      {state.albums.map((album, albumIdx) => (
        <div
          key={album.sourceUrl}
          className="rounded border border-(--color-border) p-4"
        >
          <div className="mb-3 flex flex-col gap-1">
            <input
              value={album.title ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_ALBUM_FIELD",
                  albumIdx,
                  field: "title",
                  value: e.target.value,
                })
              }
              className="text-sm font-medium bg-transparent border-b border-(--color-border) pb-1 focus:outline-none focus:border-(--color-fg)"
            />
            <div className="flex gap-3 text-[10px] text-(--color-muted)">
              <span>{album.seller}</span>
              {album.price && <span>{album.price}</span>}
              <span>{album.images.length} images</span>
              {album.weidianUrl && <span>Weidian</span>}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {album.images.map((img, imgIdx) => (
              <ImageCard
                key={img.url}
                image={img}
                onTag={(tag) =>
                  dispatch({
                    type: "TAG_IMAGE",
                    albumIdx,
                    imageIdx: imgIdx,
                    tag,
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={state.phase === "saving"}
        className="self-center border border-(--color-fg) bg-(--color-fg) px-8 py-3 text-xs uppercase tracking-widest text-white hover:opacity-80 disabled:opacity-40"
      >
        {state.phase === "saving"
          ? "Saving..."
          : `Import ${state.albums.length} items`}
      </button>
    </div>
  );
}

function ImageCard({
  image,
  onTag,
}: {
  image: ScrapedImage;
  onTag: (tag: ImageTag) => void;
}) {
  const isSelected = image.tag !== "skip";
  const style = isSelected ? TAG_STYLES[image.tag] : null;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative aspect-square overflow-hidden rounded bg-neutral-100 cursor-pointer"
        onClick={() => onTag(isSelected ? "skip" : "keep")}
      >
        <img
          src={image.thumbUrl}
          alt=""
          className={[
            "h-full w-full object-cover transition-opacity",
            !isSelected ? "opacity-80" : "",
          ].join(" ")}
          loading="lazy"
        />
        {style && (
          <span
            className={`absolute top-1 right-1 rounded px-2 py-1 text-[11px] font-medium text-white ${style.bg}`}
          >
            {style.icon} {style.label}
          </span>
        )}
        {image.autoDetected && (
          <span className="absolute bottom-1 left-1 rounded bg-blue-500/80 px-1.5 py-0.5 text-[9px] text-white">
            {TAG_STYLES[image.autoDetected].icon} Auto
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {SELECTABLE_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={(e) => {
              e.stopPropagation();
              onTag(image.tag === tag ? "skip" : tag);
            }}
            className={[
              "py-1.5 text-[11px] font-medium rounded transition-colors",
              image.tag === tag
                ? `${TAG_STYLES[tag].bg} text-white`
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
            ].join(" ")}
            title={TAG_STYLES[tag].label}
          >
            {TAG_STYLES[tag].icon}
          </button>
        ))}
      </div>
    </div>
  );
}
