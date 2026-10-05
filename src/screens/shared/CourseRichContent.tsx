import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useThemeColors } from "../../styles/theme";
import { useThemeStore } from "../../store/useThemeStore";
import { storageService } from "../../services/storageService";
import { mediaService } from "../../services/api";
import { environment } from "../../environment/environment";

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
    const fileName = stripTags(m[1]) || href.split("/").pop()?.split("?")[0] || `File_${i}`;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    let type: ChapterFileType = "document";
    if (["mp4", "avi", "mov", "webm", "mkv"].includes(ext)) type = "video";
    else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) type = "image";
    else if (ext === "pdf") type = "pdf";
    else if (href.includes("/media/") && href.includes("/content")) type = "video";
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

const buildDocument = (body: string, token: string | null, c: { text: string; textMuted: string; border: string; primary: string; surfaceElevated: string }) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
html,body{margin:0;padding:0;background:transparent;}
body{font-family:-apple-system,Roboto,"Segoe UI",sans-serif;font-size:15px;line-height:1.6;color:${c.text};word-wrap:break-word;overflow-wrap:anywhere;}
img{max-width:100%!important;height:auto!important;}
video,iframe{max-width:100%!important;}
a{color:${c.primary};}
table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%;}
td,th{border:1px solid ${c.border};padding:4px 8px;}
pre,code{background:${c.surfaceElevated};border-radius:6px;white-space:pre-wrap;}
pre{padding:8px;}
blockquote{border-left:3px solid ${c.border};margin:8px 0;padding-left:10px;color:${c.textMuted};}
h1,h2,h3,h4{line-height:1.3;}
#sc-root>*:first-child{margin-top:0;}#sc-root>*:last-child{margin-bottom:0;}
</style></head><body><div id="sc-root">${body}</div>
<script>
(function(){
  var TOKEN=${JSON.stringify(token || "").replace(/</g, "\\u003c")};
  function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  var last=0;
  function report(){ var h=Math.ceil(document.getElementById('sc-root').getBoundingClientRect().height); if(h!==last){ last=h; post({type:'height',h:h}); } }
  function authBlob(url){
    return fetch(url,{headers:TOKEN?{Authorization:'Bearer '+TOKEN}:{}}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.blob(); }).then(function(b){ return URL.createObjectURL(b); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('img[data-sc-auth-src]'),function(img){
    authBlob(img.getAttribute('data-sc-auth-src')).then(function(u){ img.src=u; }).catch(function(){});
  });
  Array.prototype.forEach.call(document.querySelectorAll('video[data-sc-auth-src],source[data-sc-auth-src]'),function(el){
    var video=el.tagName==='VIDEO'?el:el.parentElement;
    function fallback(){ authBlob(el.getAttribute('data-sc-auth-src')).then(function(u){ el.src=u; if(video&&video.load) video.load(); }).catch(function(){}); }
    if(!el.getAttribute('src')) fallback(); else if(video) video.addEventListener('error',fallback,{once:true});
  });
  Array.prototype.forEach.call(document.querySelectorAll('video'),function(v){ v.setAttribute('playsinline',''); v.setAttribute('controls',''); v.addEventListener('loadedmetadata',report); });
  Array.prototype.forEach.call(document.images,function(img){ img.addEventListener('load',report); img.addEventListener('error',report); });
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(a){ e.preventDefault(); post({type:'link',url:a.getAttribute('href')}); }
  },true);
  if(window.ResizeObserver){ new ResizeObserver(report).observe(document.getElementById('sc-root')); }
  window.addEventListener('load',report);
  setTimeout(report,50); setTimeout(report,500); setTimeout(report,1500);
})();
</script></body></html>`;

interface CourseRichContentProps {
  /** Chapter HTML already passed through resolveChapterHtml. */
  html: string;
  /** Called when the reader taps a link inside the content. */
  onOpenLink: (url: string) => void;
}

/**
 * Renders a chapter's rich HTML (what the course editor stores) the way web's
 * `dangerouslySetInnerHTML` does: an auto-height, non-scrolling WebView whose
 * origin is the API base URL, so authenticated media fetches stay same-origin.
 */
const CourseRichContent = ({ html, onOpenLink }: CourseRichContentProps) => {
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
        : { html: buildDocument(body, token, colors), baseUrl: `${BASE}/` },
    // isDark drives `colors`; listed so a theme switch rebuilds the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, body, colors, isDark]
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "height" && typeof msg.h === "number" && msg.h > 0) setHeight(msg.h + 4);
      else if (msg?.type === "link" && typeof msg.url === "string" && msg.url) onOpenLink(msg.url);
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
