import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { mediaService } from './api';
import { storageService } from './storageService';
import { environment } from '../environment/environment';

/**
 * One place that knows how to open a stored course/exercise file on the device.
 *
 * - PDF and images are shown inside the app (PdfViewerScreen / ImageViewerModal,
 *   driven by useFileOpener); both use `downloadToCache` from here.
 * - Anything else is downloaded to the app cache and handed to the OS:
 *   Android gets an ACTION_VIEW intent on the file's content:// URI (Android
 *   shows its "Open with" chooser), iOS gets the system share / "Open in…" sheet.
 *
 * A file may be described by any mix of a URL (presigned, backend proxy
 * `/media/{id}/content`, raw storage URL or relative path), a storage key
 * (`filePath`) and a media id; every candidate source is tried in turn, so a
 * presigned host the phone can't reach (dev `localhost:9000`) falls back to the
 * authenticated backend proxy.
 */

export interface OpenableFile {
  url?: string | null;
  /** Storage key (`users/...`) of the file. */
  filePath?: string | null;
  mediaId?: string | null;
  /** Presigned URL embedded in a list response, used as a last resort. */
  presignedUrl?: string | null;
  fileName?: string | null;
  contentType?: string | null;
}

export type FileKind = 'image' | 'pdf' | 'video' | 'audio' | 'other';

export interface CachedFile {
  uri: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export type FileOpenErrorCode = 'unavailable' | 'download' | 'cancelled' | 'noApp';

export class FileOpenError extends Error {
  code: FileOpenErrorCode;
  constructor(code: FileOpenErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const BASE = environment.baseUrl.replace(/\/+$/, '');

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  svg: 'image/svg+xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pps: 'application/vnd.ms-powerpoint',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  odp: 'application/vnd.oasis.opendocument.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  json: 'application/json',
  xml: 'text/xml',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  epub: 'application/epub+zip',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  apk: 'application/vnd.android.package-archive',
};

/** iOS Uniform Type Identifiers for the share sheet, where they matter most. */
const UTI_BY_EXT: Record<string, string> = {
  pdf: 'com.adobe.pdf',
  doc: 'com.microsoft.word.doc',
  docx: 'org.openxmlformats.wordprocessingml.document',
  ppt: 'com.microsoft.powerpoint.ppt',
  pptx: 'org.openxmlformats.presentationml.presentation',
  xls: 'com.microsoft.excel.xls',
  xlsx: 'org.openxmlformats.spreadsheetml.sheet',
  txt: 'public.plain-text',
  csv: 'public.comma-separated-values-text',
  zip: 'public.zip-archive',
  jpg: 'public.jpeg',
  jpeg: 'public.jpeg',
  png: 'public.png',
  mp3: 'public.mp3',
  mp4: 'public.mpeg-4',
  mov: 'com.apple.quicktime-movie',
};

const GENERIC_MIME = ['application/octet-stream', 'binary/octet-stream', 'application/x-download', 'application/force-download'];

const cleanName = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Last path segment of a URL / storage key, without the query string. */
const nameFromPath = (p?: string | null) => (p ? cleanName(p.split('?')[0].split('#')[0].split('/').pop() || '') : '');

export const extensionOf = (name?: string | null) => {
  const n = (name ?? '').split('?')[0].toLowerCase();
  const dot = n.lastIndexOf('.');
  return dot >= 0 && dot < n.length - 1 ? n.slice(dot + 1) : '';
};

/** Display name for a file: explicit name, else the last segment of its path/URL. */
export const fileNameOf = (file: OpenableFile) =>
  (file.fileName && file.fileName.trim()) || nameFromPath(file.filePath) || nameFromPath(file.url) || 'fichier';

/** The best MIME type: a specific `contentType` wins, otherwise guessed from the extension. */
export const mimeTypeOf = (file: OpenableFile) => {
  const ct = (file.contentType ?? '').split(';')[0].trim().toLowerCase();
  if (ct && !GENERIC_MIME.includes(ct) && ct.includes('/')) return ct;
  const ext = extensionOf(fileNameOf(file)) || extensionOf(file.filePath) || extensionOf(file.url);
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
};

export const fileKindOf = (file: OpenableFile): FileKind => {
  const mime = mimeTypeOf(file);
  if (mime === 'application/pdf') return 'pdf';
  // SVG/HEIC can't be decoded reliably by <Image>; let a native app handle them.
  if (mime.startsWith('image/') && mime !== 'image/svg+xml' && mime !== 'image/heic') return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'other';
};

// ── Source resolution ───────────────────────────────────────────────────────

/** Media id out of a backend proxy URL (`<base>/media/{id}/content`). */
const proxyMediaId = (url: string): string | null => {
  if (!url || !url.startsWith(BASE)) return null;
  const m = url.slice(BASE.length).match(/^\/media\/([^/?#]+)\/content/);
  return m ? m[1] : null;
};

/** Storage key out of a full Wasabi/MinIO URL (web's toRelativePath). */
const toStorageKey = (raw: string) => {
  if (!raw || !raw.startsWith('http')) return raw;
  const pathname = raw.replace(/^https?:\/\/[^/]+\/?/, '').split('?')[0];
  const idx = pathname.indexOf('users/');
  if (idx >= 0) return pathname.slice(idx);
  const parts = pathname.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : pathname;
};

const isStorageUrl = (url: string) => !!url && url.startsWith('http') && !url.startsWith(BASE);

interface Source {
  url: string;
  /** Backend URLs need the Bearer token; presigned URLs must NOT get it (it breaks the signature). */
  auth: boolean;
}

/**
 * Every plausible download source for a file, best first. Each entry is a thunk,
 * so the backend is only asked for a URL when the previous source failed.
 */
const sourcesOf = (file: OpenableFile): (() => Promise<Source | null>)[] => {
  const raw = (file.url ?? '').trim();
  const absolute = raw && !raw.startsWith('http') && raw.startsWith('/') ? `${BASE}${raw}` : raw;
  const mediaId = file.mediaId || (absolute ? proxyMediaId(absolute) : null);
  const filePath =
    file.filePath ||
    (absolute && isStorageUrl(absolute) ? toStorageKey(absolute) : null) ||
    (raw && !raw.startsWith('http') && !raw.startsWith('/') ? raw : null);
  const unsigned = (url: string | null | undefined): Source | null => (url ? { url, auth: false } : null);
  const list: (() => Promise<Source | null>)[] = [];

  if (mediaId) list.push(async () => unsigned(await mediaService.getDownloadUrl(mediaId)));
  if (filePath) list.push(async () => unsigned(await mediaService.getDownloadUrlByPath(filePath)));
  if (file.presignedUrl) list.push(async () => unsigned(file.presignedUrl));
  if (absolute && absolute.startsWith('http')) list.push(async () => ({ url: absolute, auth: absolute.startsWith(BASE) }));
  if (mediaId) list.push(async () => ({ url: mediaService.getContentUrl(mediaId), auth: true }));
  if (filePath)
    list.push(async () => {
      const proxy = await mediaService.getContentUrlByPath(filePath);
      return proxy ? { url: proxy, auth: proxy.startsWith(BASE) } : null;
    });
  return list;
};

// ── Download ────────────────────────────────────────────────────────────────

const CACHE_DIR_NAME = 'opened-files';

const cacheDir = () => {
  const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

/** Small stable hash, so the same stored file maps to the same cache entry. */
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const safeFileName = (name: string, mime: string) => {
  let n = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'fichier';
  if (!extensionOf(n)) {
    const ext = Object.keys(MIME_BY_EXT).find((k) => MIME_BY_EXT[k] === mime);
    if (ext) n = `${n}.${ext}`;
  }
  return n.length > 120 ? n.slice(n.length - 120) : n;
};

const identityOf = (file: OpenableFile) =>
  file.mediaId || file.filePath || (file.url ?? '').split('?')[0] || (file.presignedUrl ?? '').split('?')[0] || fileNameOf(file);

export interface DownloadOptions {
  /** 0..1, or null when the server doesn't send a length. */
  onProgress?: (fraction: number | null) => void;
  signal?: AbortSignal;
}

/**
 * Downloads a file into the app cache (reusing a previous download of the same
 * stored file) and returns its local `file://` URI.
 */
export const downloadToCache = async (file: OpenableFile, opts: DownloadOptions = {}): Promise<CachedFile> => {
  const mimeType = mimeTypeOf(file);
  const fileName = safeFileName(fileNameOf(file), mimeType);
  const dir = new Directory(cacheDir(), hash(identityOf(file)));
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, fileName);
  if (target.exists && (target.size ?? 0) > 0) {
    return { uri: target.uri, fileName, mimeType, size: target.size ?? 0 };
  }

  let token: string | null | undefined;
  let tried = false;
  const seen = new Set<string>();
  for (const next of sourcesOf(file)) {
    if (opts.signal?.aborted) throw new FileOpenError('cancelled');
    let source: Source | null = null;
    try {
      source = await next();
    } catch {
      source = null;
    }
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    tried = true;
    const headers: Record<string, string> = {};
    if (source.auth) {
      if (token === undefined) token = await storageService.getUserToken().catch(() => null);
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const part = new File(dir, `${fileName}.part`);
    try {
      if (part.exists) part.delete();
      opts.onProgress?.(0);
      await File.downloadFileAsync(source.url, part, {
        headers,
        idempotent: true,
        signal: opts.signal,
        onProgress: ({ bytesWritten, totalBytes }) =>
          opts.onProgress?.(totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : null),
      });
      if (!part.exists || (part.size ?? 0) === 0) throw new Error('empty');
      if (target.exists) target.delete();
      part.moveSync(target);
      return { uri: target.uri, fileName, mimeType, size: target.size ?? 0 };
    } catch (e) {
      try {
        if (part.exists) part.delete();
      } catch {
        /* ignore */
      }
      if (opts.signal?.aborted || (e as Error)?.name === 'AbortError') throw new FileOpenError('cancelled');
      // try the next source
    }
  }
  throw new FileOpenError(tried ? 'download' : 'unavailable');
};

/** Base64 content of a cached file (for the in-app PDF viewer). */
export const readCachedBase64 = (cached: CachedFile) => new File(cached.uri).base64();

// ── Hand-off to other apps ──────────────────────────────────────────────────

const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;

/** System share sheet for a cached file (iOS "Open in…", Android share targets). */
export const shareCachedFile = async (cached: CachedFile, dialogTitle?: string) => {
  if (!(await Sharing.isAvailableAsync())) throw new FileOpenError('noApp');
  await Sharing.shareAsync(cached.uri, {
    mimeType: cached.mimeType,
    UTI: UTI_BY_EXT[extensionOf(cached.fileName)],
    dialogTitle,
  });
};

/**
 * Opens a cached file in another app. Android: ACTION_VIEW on the content://
 * URI with the MIME type and read permission — Android lists every installed
 * app that can handle it (or opens the default one). Throws `noApp` when no app
 * matches. iOS: the share sheet, whose "Open in…" row lists capable apps.
 */
export const openCachedWithNativeApp = async (cached: CachedFile, dialogTitle?: string) => {
  if (Platform.OS === 'android') {
    const contentUri = new File(cached.uri).contentUri;
    // startActivityAsync only settles when the user comes back to the app; an
    // unresolvable intent (ActivityNotFoundException) rejects right away.
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        resolve();
      }, 1200);
      IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: cached.mimeType,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      })
        .then(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        })
        .catch((e: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          // Almost always ActivityNotFoundException: no installed app handles this type.
          reject(new FileOpenError('noApp', String((e as Error)?.message ?? e)));
        });
    });
    return;
  }
  await shareCachedFile(cached, dialogTitle);
};
