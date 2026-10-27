import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useThemeColors } from "../../styles/theme";
import { useThemeStore } from "../../store/useThemeStore";
import { storageService } from "../../services/storageService";
import { mediaService } from "../../services/api";
import { environment } from "../../environment/environment";
import { isLikelyStoredFile } from "../../hooks/useFileOpener";
import { buildViewerDocument } from "../../components/common/richContentHtml";

// ---------------------------------------------------------------------------
// Chapter HTML helpers — DOM-less ports of web's CourseDetailsView.jsx
// (processStorageUrls / processHtmlImages / extractFilesFromChapters).
// ---------------------------------------------------------------------------

const BASE = environment.baseUrl.replace(/\/+$/, "");

/** Web's toRelativePath: storage key out of a full Wasabi/MinIO URL. */
export const toRelativeStoragePath = (raw: string) => {
  if (!raw || !raw.startsWith("http")) return raw;
  const pathname = raw.replace(/^https?:\/\/[^/]+\/?/, "").split("?")[0];
  const idx = pathname.indexOf("users/");
  if (idx >= 0) return pathname.slice(idx);
  const parts = pathname.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : pathname;
};

/** Web's isStorageUrl: a direct storage URL that isn't already a backend proxy URL. */
const isStorageUrl = (url: string) => {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false;
  if (url.startsWith(BASE)) return false;
  return url.startsWith("http");
};

/** Media id out of a backend proxy URL (`<base>/media/{id}/content`). */
export const proxyMediaId = (url: string): string | null => {
  if (!url || !url.startsWith(BASE)) return null;
  const m = url.slice(BASE.length).match(/^\/media\/([^/?#]+)\/content/);
  return m ? m[1] : null;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

const attr = (tag: string, name: string): string => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i")) || tag.match(new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? decodeEntities(m[1]) : "";
};

const SRC_RE = /(<(?:img|video|source)\b[^>]*?\ssrc="|<a\b[^>]*?\shref=")([^"]*)"/gi;

/**
 * Makes stored chapter HTML loadable: relative `/media/...` paths become
 * absolute, direct storage URLs are swapped for fresh backend URLs (web's
 * processStorageUrls), and videos saved with a dead `blob:` src are looked up by
 * their caption file name. `cache` is shared across a course's chapters.
 */
export const resolveChapterHtml = async (
  html: string,
  redacteurId: string | undefined,
  cache: Map<string, string>
): Promise<string> => {
  if (!html) return html;
  let out = html.replace(SRC_RE, (full, prefix: string, url: string) =>
    url.startsWith("/media/") ? `${prefix}${BASE}${url}"` : full
  );

  const urls = new Set<string>();
  let m: RegExpExecArray | null;
  SRC_RE.lastIndex = 0;
  while ((m = SRC_RE.exec(out))) {
    if (isStorageUrl(m[2]) && !cache.has(m[2])) urls.add(m[2]);
  }
  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const fresh = await mediaService.getContentUrlByPath(toRelativeStoragePath(url));
        cache.set(url, fresh || url);
      } catch {
        cache.set(url, url);
      }
    })
  );
  out = out.replace(SRC_RE, (full, prefix: string, url: string) =>
    cache.has(url) ? `${prefix}${cache.get(url)}"` : full
  );

  // Videos saved with a blob: src — web resolves them through the caption div's file name.
  if (redacteurId && out.includes('src="blob:')) {
    const videoRe = /(<video\b[^>]*?\ssrc=")blob:[^"]*("[^>]*>[\s\S]*?<\/video>\s*<div\b[^>]*>)([\s\S]*?)(<\/div>)/gi;
    const found: { caption: string }[] = [];
    out.replace(videoRe, (full, _a, _b, caption: string) => {
      found.push({ caption: stripTags(caption) });
      return full;
    });
    const resolved = new Map<string, string>();
    await Promise.all(
      found.map(async ({ caption }) => {
        if (!caption || resolved.has(caption)) return;
        try {
          const media = (await mediaService.find(caption, redacteurId)) as { id?: string };
          if (media?.id) resolved.set(caption, mediaService.getContentUrl(media.id));
        } catch {
          /* leave unresolved */
        }
      })
    );
    out = out.replace(videoRe, (full, a: string, b: string, caption: string, close: string) => {
      const url = resolved.get(stripTags(caption));
      return url ? `${a}${url}${b}${caption}${close}` : full;
    });
  }
  return out;
};

export type ChapterFileType = "image" | "video" | "pdf" | "document";

export interface ChapterFile {
  id: string;
  fileName: string;
  url: string;
  type: ChapterFileType;
}

/** Web's extractFilesFromChapters for one chapter: images, videos and file links. */
export const extractChapterFiles = (html: string, keyPrefix: string): ChapterFile[] => {
  if (!html) return [];
  const files: ChapterFile[] = [];
  let i = 0;
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const src = attr(m[0], "src");
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) continue;
    const name = attr(m[0], "alt") || decodeURIComponent(src.split("/").pop()?.split("?")[0] || "") || `Image_${i}`;
    files.push({ id: `${keyPrefix}_img_${i++}`, fileName: name, url: src, type: "image" });
  }
  const vidRe = /<(?:video|source)\b[^>]*>/gi;
  while ((m = vidRe.exec(html))) {
    const src = attr(m[0], "src");
    if (!src || src.startsWith("blob:")) continue;
    if (m[0].toLowerCase().startsWith("<source") && !/video/i.test(html.slice(Math.max(0, m.index - 300), m.index))) continue;
    const name = decodeURIComponent(src.split("?")[0].split("/").pop() || "") || `Video_${i}`;
    files.push({ id: `${keyPrefix}_vid_${i++}`, fileName: name, url: src, type: "video" });
  }
  const linkRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = linkRe.exec(html))) {
    const href = attr(m[0], "href");
    if (!href || !href.startsWith("http")) continue;
    const declaredName = attr(m[0], "data-file-name");
    const fileName = declaredName || stripTags(m[1]) || href.split("/").pop()?.split("?")[0] || `File_${i}`;
    // Plain web links (articles, videos on other sites…) are not course resources.
    if (!declaredName && !isLikelyStoredFile(href, fileName)) continue;
    const declaredType = attr(m[0], "data-file-type").toLowerCase();
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    let type: ChapterFileType = "document";
    if (declaredType.startsWith("video/") || ["mp4", "avi", "mov", "webm", "mkv"].includes(ext)) type = "video";
    else if (declaredType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) type = "image";
    else if (declaredType === "application/pdf" || ext === "pdf") type = "pdf";
    else if (!declaredType && href.includes("/media/") && href.includes("/content")) type = "video";
    files.push({ id: `${keyPrefix}_link_${i++}`, fileName, url: href, type });
  }
  return files;
};

/**
 * Proxy media (`/media/{id}/content`) needs the Bearer token, which an <img>
 * can't send. Images get their proxy URL moved to `data-sc-auth-src` and are
 * fetched with the token inside the WebView (web's processHtmlImages). Videos
 * get a presigned URL (streamable) when one resolves, keeping the proxy as an
 * authenticated fallback.
 */
const prepareForWebView = async (html: string): Promise<string> => {
  const videoIds = new Set<string>();
  html.replace(/<(?:video|source)\b[^>]*?\ssrc="([^"]*)"/gi, (full, url: string) => {
    const id = proxyMediaId(url);
    if (id) videoIds.add(id);
    return full;
  });
  const presigned = new Map<string, string>();
  await Promise.all(
    Array.from(videoIds).map(async (id) => {
      try {
        const u = await mediaService.getDownloadUrl(id);
        if (u) presigned.set(id, u);
      } catch {
        /* proxy fallback */
      }
    })
  );
  return html.replace(/<(img|video|source)\b([^>]*?)\ssrc="([^"]*)"/gi, (full, tag: string, before: string, url: string) => {
    const id = proxyMediaId(url);
    if (!id) return full;
    if (tag.toLowerCase() === "img") return `<${tag}${before} data-sc-auth-src="${url}"`;
    const p = presigned.get(id);
    return p ? `<${tag}${before} src="${p}" data-sc-auth-src="${url}"` : `<${tag}${before} data-sc-auth-src="${url}"`;
  });
};

interface CourseRichContentProps {
  /** Chapter HTML already passed through resolveChapterHtml. */
  html: string;
  /** Called when the reader taps a link, an attached file or an image inside the content. */
  onOpenLink: (url: string, meta?: { fileName?: string; contentType?: string }) => void;
  /** Accept local file:/content: sources (preview of files not uploaded yet). */
  allowLocal?: boolean;
}

/**
 * Renders a chapter's rich HTML (what the course editor stores) exactly like
 * web's RichContent: same allowlist sanitizer (run inside the WebView) and the
 * same typography (alignment, sizes, colours, lists, tables, figures, attachment
 * chips, dark mode). Auto-height, non-scrolling WebView whose origin is the API
 * base URL, so authenticated media fetches stay same-origin. Taps on links,
 * attached files and images are reported through onOpenLink (in-app viewers).
 */
const CourseRichContent = ({ html, onOpenLink, allowLocal = false }: CourseRichContentProps) => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode) === "dark";
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [body, setBody] = useState<string | null>(null);
  const [height, setHeight] = useState(40);

  useEffect(() => {
    let cancelled = false;
    storageService
      .getUserToken()
      .then((t) => !cancelled && setToken(t ?? null))
      .catch(() => !cancelled && setToken(null));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBody(null);
    prepareForWebView(html)
      .then((b) => !cancelled && setBody(b))
      .catch(() => !cancelled && setBody(html));
    return () => {
      cancelled = true;
    };
  }, [html]);

  const source = useMemo(
    () =>
      token === undefined || body === null
        ? null
        : { html: buildViewerDocument(BASE, body, token, colors, isDark, allowLocal), baseUrl: `${BASE}/` },
    // isDark drives `colors`; listed so a theme switch rebuilds the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, body, colors, isDark, allowLocal]
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "height" && typeof msg.h === "number" && msg.h > 0) setHeight(msg.h + 4);
      else if (msg?.type === "link" && typeof msg.url === "string" && msg.url) {
        onOpenLink(msg.url, {
          fileName: typeof msg.fileName === "string" && msg.fileName ? msg.fileName : undefined,
          contentType: typeof msg.contentType === "string" && msg.contentType ? msg.contentType : undefined,
        });
      }
    } catch {
      /* ignore */
    }
  };

  if (!source) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={["*"]}
      source={source}
      style={[styles.webview, { height }]}
      containerStyle={styles.container}
      scrollEnabled={false}
      nestedScrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction
      mixedContentMode="always"
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => {
        if (req.isTopFrame === false) return true;
        const url = req.url || "";
        if (url === "about:blank" || url.startsWith("data:") || url.startsWith("blob:") || url === `${BASE}/` || url === BASE) return true;
        onOpenLink(url);
        return false;
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: "transparent" },
  webview: { backgroundColor: "transparent", width: "100%" },
  loading: { paddingVertical: 16, alignItems: "center" },
});

export default CourseRichContent;
