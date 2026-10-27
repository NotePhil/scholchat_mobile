import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { captureFromCamera } from "../../../../utils/cameraCapture";
import { translate, useT } from "../../../../i18n";
import { BottomSheet } from "../../../../components/ui";
import { useThemeColors } from "../../../../styles/theme";
import { storageService } from "../../../../services/storageService";
import { environment } from "../../../../environment/environment";
import { buildEditorDocument } from "../../../../components/common/richContentHtml";
import CourseRichContent from "../../../shared/CourseRichContent";

/*
 * Mobile port of web's components/richtext/RichTextEditor.jsx. Same toolbar
 * (paragraph style, size, bold/italic/underline/strike, colour, highlight,
 * alignment incl. justify, lists, indent, quote, code, link, table, rule,
 * files, undo/redo, clear) and — importantly — the SAME output: the editor is a
 * Chromium contentEditable driven by execCommand exactly like web, and files
 * are inserted with web's markup (div.rc-figure for images/videos,
 * div.rc-attachment chips for documents). A chapter written on mobile therefore
 * renders identically on web, and vice versa.
 */

const BASE = environment.baseUrl.replace(/\/+$/, "");

export type PendingKind = "image" | "video" | "document";

/** A file inserted in a chapter editor, uploaded only on final submit (like web). */
export interface PendingFile {
  id: string;
  uri: string;
  mimeType: string;
  name: string;
  kind: PendingKind;
  size?: number;
}

export const COURSE_FILE_LIMITS: Record<PendingKind, { max: number; label: string }> = {
  image: { max: 10 * 1024 * 1024, label: "10 Mo" },
  video: { max: 200 * 1024 * 1024, label: "200 Mo" },
  document: { max: 50 * 1024 * 1024, label: "50 Mo" },
};
const DOC_EXTENSIONS = /\.(pdf|doc|docx|txt|ppt|pptx|xls|xlsx|odt|ods|odp|csv|rtf)$/i;
const VIDEO_TYPES = /^video\/(mp4|webm|ogg|quicktime|3gpp)$/i;

export const formatFileSize = (bytes?: number) => {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
};

const extOf = (name: string) => ((name || "").split(".").pop() || "").toUpperCase();

/** Web's validateCourseFile: an error message, or null when the file can be attached. */
export const validateCourseFile = (f: Pick<PendingFile, "name" | "mimeType" | "kind" | "size">): string | null => {
  if (f.kind === "video" && !VIDEO_TYPES.test(f.mimeType) && !/\.(mp4|webm|ogg|mov|3gp)$/i.test(f.name)) {
    return translate("chapterEditor.fileErrors.videoFormat", { name: f.name });
  }
  if (f.kind === "document" && !DOC_EXTENSIONS.test(f.name)) {
    return translate("chapterEditor.fileErrors.documentType", { name: f.name });
  }
  if (f.size === 0) return translate("chapterEditor.fileErrors.empty", { name: f.name });
  const lim = COURSE_FILE_LIMITS[f.kind];
  if (f.size && f.size > lim.max) {
    return translate("chapterEditor.fileErrors.tooLarge", { name: f.name, size: formatFileSize(f.size), max: lim.label });
  }
  return null;
};

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Same markup web's RichTextEditor.buildAttachmentNode inserts for each kind of file. */
export const buildFileSnippet = (file: PendingFile, previewUri?: string) => {
  const name = escapeHtml(file.name);
  const id = escapeHtml(file.id);
  if (file.kind === "image") {
    return `<div class="rc-figure" data-file-id="${id}" style="text-align: center;"><img src="${escapeHtml(previewUri ?? "")}" alt="${name}" data-file-id="${id}"></div><p><br></p>`;
  }
  if (file.kind === "video") {
    return (
      `<div class="rc-figure" data-file-id="${id}" style="text-align: center;">` +
      `<video src="${escapeHtml(file.uri)}" controls="" preload="metadata" data-file-id="${id}" style="width: 100%;"></video>` +
      `<div class="rc-caption">${name}</div></div><p><br></p>`
    );
  }
  const icon = /\.pdf$/i.test(file.name) ? "📕" : "📄";
  const meta = [extOf(file.name), formatFileSize(file.size)].filter(Boolean).join(" · ");
  return (
    `<div class="rc-attachment" data-file-id="${id}" contenteditable="false">` +
    `<span class="rc-attachment-icon">${icon}</span>` +
    `<span class="rc-attachment-name" data-file-name="${name}" data-file-type="${escapeHtml(file.mimeType)}" data-file-size="${file.size ?? ""}">${name}</span>` +
    `<span class="rc-attachment-meta">${escapeHtml(meta)}</span></div>`
  );
};

const setSrc = (tag: string, url: string) => {
  const re = /\ssrc="[^"]*"/i;
  return re.test(tag) ? tag.replace(re, ` src="${url}"`) : tag.replace(/^<(\w+)/, `<$1 src="${url}"`);
};

export interface UploadedFileInfo {
  url: string;
  name: string;
  type: string;
  size?: number;
}

/**
 * Web's updateContentWithUploadedFiles (DOM-less): images/videos get their
 * stored URL, attachment chips get a real link carrying the file's name, type
 * and size (what the viewers use), legacy name spans become links.
 */
export const updateContentWithUploadedFiles = (content: string, fileMap: Map<string, UploadedFileInfo>) => {
  let html = content;
  fileMap.forEach((info, fileId) => {
    const url = escapeHtml(info.url);
    const id = escapeRe(escapeHtml(fileId));
    const link = (label: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" data-file-name="${escapeHtml(info.name)}" data-file-type="${escapeHtml(info.type || "")}" data-file-size="${info.size ?? ""}">${label}</a>`;
    html = html.replace(new RegExp(`<(?:img|video)\\b[^>]*data-file-id="${id}"[^>]*>`, "gi"), (tag) => setSrc(tag, url));
    html = html.replace(
      // Stay inside this file's own block: an image figure has no name span, and a plain lazy match
      // would run on into the NEXT attachment and give it this file's URL.
      new RegExp(
        `(<div\\b[^>]*data-file-id="${id}"[^>]*>(?:(?!data-file-id=)[\\s\\S])*?)<span\\b[^>]*class="rc-attachment-name"[^>]*>([\\s\\S]*?)<\\/span>`,
        "i"
      ),
      (_m, before: string, label: string) => `${before}${link(label)}`
    );
    html = html.replace(
      new RegExp(`<span\\b[^>]*data-file-name-for="${id}"[^>]*>([\\s\\S]*?)<\\/span>`, "gi"),
      (_m, label: string) => link(label)
    );
  });
  return html;
};

/** True when the HTML has no visible text and no media/table (web's isRichHtmlEmpty). */
export const isRichHtmlEmpty = (html: string) => {
  if (!html) return true;
  if (/<(img|video|audio|table|hr)\b/i.test(html) || /data-file-id=/i.test(html)) return false;
  return !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
};

const TEXT_COLORS = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0d9488", "#2563eb", "#7c3aed", "#db2777", "#64748b"];
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff"];
type BlockTag = "p" | "h1" | "h2" | "h3" | "blockquote" | "pre";
const BLOCKS: BlockTag[] = ["p", "h1", "h2", "h3", "blockquote", "pre"];
const SIZES: [string, "small" | "normal" | "large" | "huge"][] = [
  ["2", "small"],
  ["3", "normal"],
  ["5", "large"],
  ["6", "huge"],
];

const normalizeUrl = (raw: string) => {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // javascript:, data:… refused
  return `https://${v}`;
};

type Sheet = null | "files" | "block" | "size" | "color" | "highlight" | "link" | "table";

/*
 * Toolbar docked above the keyboard.
 *
 * The editor sits in the middle of a long form (ScrollView): when the keyboard
 * opens the form scrolls to the caret and the inline toolbar goes off screen.
 * While the editor has focus and the keyboard is open, the same tools are
 * therefore also rendered in a one-row bar by <ChapterToolbarDock/>, which the
 * screen places right under its ScrollView — i.e. right above the keyboard
 * (app-wide KeyboardInsetView on Android / KeyboardAvoidingView on iOS). It's
 * a small external store (not React state of the screen) so publishing the
 * bar on every editor render doesn't re-render the whole form.
 */
type DockState = { owner: string | null; node: React.ReactNode; top: number | null };
let dockState: DockState = { owner: null, node: null, top: null };
const dockListeners = new Set<() => void>();
const emitDock = () => dockListeners.forEach((l) => l());
const subscribeDock = (l: () => void) => {
  dockListeners.add(l);
  return () => {
    dockListeners.delete(l);
  };
};
const publishDock = (owner: string, node: React.ReactNode) => {
  dockState = { ...dockState, owner, node };
  emitDock();
};
const clearDock = (owner: string) => {
  if (dockState.owner !== owner) return;
  dockState = { owner: null, node: null, top: null };
  emitDock();
};

/** Place right below the ScrollView that contains ChapterRichEditor(s). */
export const ChapterToolbarDock = () => {
  const node = useSyncExternalStore(subscribeDock, () => dockState.node);
  const ref = useRef<View>(null);
  if (!node) return null;
  return (
    <View
      ref={ref}
      testID="chapter-toolbar-dock"
      onLayout={() =>
        ref.current?.measureInWindow((_x, y) => {
          dockState = { ...dockState, top: y };
        })
      }
    >
      {node}
    </View>
  );
};

/** Lets the editor scroll the surrounding form so the caret stays visible. */
export interface ChapterEditorScrollApi {
  /** Scrolls the form by `dy` px (positive = content moves up). */
  scrollBy: (dy: number) => void;
  /** Window Y of the top of the form's visible area. */
  getViewportTop: () => number;
}
export const ChapterEditorScrollContext = createContext<ChapterEditorScrollApi | null>(null);

interface EditorState {
  [cmd: string]: boolean | string | undefined;
  block?: string;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  /** Called for each validated file inserted in the content. */
  onFileAdd: (file: PendingFile) => void;
  /** Files added in this session, by id (to list the ones still in the content). */
  pendingFiles: Map<string, PendingFile>;
  isDark: boolean;
  error?: boolean;
}

const newFileId = () => `file_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
let editorSeq = 0;
/** Room kept between the caret and the docked toolbar / top of the form. */
const CARET_MARGIN = 16;

const ChapterRichEditor = ({ value, onChange, placeholder, onFileAdd, pendingFiles, isDark, error }: Props) => {
  const colors = useThemeColors();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const webRef = useRef<WebView>(null);
  const webWrapRef = useRef<View>(null);
  const editorId = useMemo(() => `chapter-editor-${++editorSeq}`, []);
  const scrollApi = useContext(ChapterEditorScrollContext);
  const [focused, setFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const docked = focused && keyboardOpen;
  const latestValue = useRef(value);
  latestValue.current = value;
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [preview, setPreview] = useState(false);
  const [state, setState] = useState<EditorState>({});
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [rows, setRows] = useState("3");
  const [cols, setCols] = useState("3");
  const [header, setHeader] = useState(true);

  useEffect(() => {
    let alive = true;
    storageService
      .getUserToken()
      .then((t) => alive && setToken(t ?? null))
      .catch(() => alive && setToken(null));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Once the bar is docked (and the layout settled), make sure the caret is
  // visible between the top of the form and the docked bar.
  useEffect(() => {
    if (!docked) return;
    const timers = [120, 350].map((ms) => setTimeout(() => js("window.__scCaret&&window.__scCaret()"), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docked]);

  useEffect(() => () => clearDock(editorId), [editorId]);

  /** Caret rect (WebView viewport coords) → scroll the form if it is hidden. */
  const keepCaretVisible = (top: number, bottom: number) => {
    if (!scrollApi || !webWrapRef.current) return;
    webWrapRef.current.measureInWindow((_x, y, _w, h) => {
      if (!h) return;
      const caretTop = y + Math.max(0, top);
      const caretBottom = y + Math.min(h, bottom);
      const visibleBottom = dockState.owner === editorId && dockState.top != null ? dockState.top : null;
      const visibleTop = scrollApi.getViewportTop();
      if (visibleBottom != null && caretBottom + CARET_MARGIN > visibleBottom) {
        scrollApi.scrollBy(caretBottom + CARET_MARGIN - visibleBottom);
      } else if (caretTop - CARET_MARGIN < visibleTop) {
        scrollApi.scrollBy(caretTop - CARET_MARGIN - visibleTop);
      }
    });
  };

  // Built once per theme: the editor owns its content afterwards and reports
  // every change back, so re-rendering must not reset it.
  const source = useMemo(
    () =>
      token === undefined
        ? null
        : { html: buildEditorDocument(BASE, latestValue.current, placeholder, isDark, token, colors), baseUrl: `${BASE}/` },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, token]
  );

  const js = (code: string) => webRef.current?.injectJavaScript(`${code};true;`);
  const exec = (command: string, val: string | null = null, css = false) =>
    js(`window.__scCmd(${JSON.stringify(command)},${JSON.stringify(val)},${css})`);

  const attached = Array.from(pendingFiles.values()).filter((f) => value.includes(`data-file-id="${f.id}"`));

  const insertFiles = (files: { file: PendingFile; preview?: string }[]) => {
    const errors: string[] = [];
    let html = "";
    files.forEach(({ file, preview: p }) => {
      const err = validateCourseFile(file);
      if (err) {
        errors.push(err);
        return;
      }
      html += buildFileSnippet(file, p);
      onFileAdd(file);
    });
    setFileErrors(errors);
    if (html) js(`window.__scInsert(${JSON.stringify(html)})`);
  };

  const removeFile = (fileId: string) => js(`window.__scRemove(${JSON.stringify(fileId)})`);

  const pickImages = async () => {
    setSheet(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("chapterEditor.permission.title"), t("chapterEditor.permission.photos"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    insertFiles(
      result.assets.map((asset) => {
        const mimeType = asset.mimeType ?? "image/jpeg";
        return {
          file: {
            id: newFileId(),
            uri: asset.uri,
            mimeType,
            name: asset.fileName ?? `image_${Date.now()}.jpg`,
            kind: "image" as const,
            size: asset.fileSize ?? undefined,
          },
          // data: preview so the WebView can show it before upload
          preview: asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri,
        };
      })
    );
  };

  const takePhoto = async () => {
    setSheet(null);
    const f = await captureFromCamera("photo", { quality: 0.7, base64: true });
    if (!f) return;
    insertFiles([
      {
        file: { id: newFileId(), uri: f.uri, mimeType: f.mimeType, name: f.name, kind: "image", size: f.size },
        preview: f.base64 ? `data:${f.mimeType};base64,${f.base64}` : f.uri,
      },
    ]);
  };

  const recordVideo = async () => {
    setSheet(null);
    const f = await captureFromCamera("video");
    if (!f) return;
    insertFiles([{ file: { id: newFileId(), uri: f.uri, mimeType: f.mimeType, name: f.name, kind: "video", size: f.size } }]);
  };

  const pickDocuments = async () => {
    setSheet(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "video/*",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/csv",
        "application/rtf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.presentation",
      ],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    insertFiles(
      result.assets.map((asset) => {
        const mimeType = asset.mimeType ?? "application/octet-stream";
        return {
          file: {
            id: newFileId(),
            uri: asset.uri,
            mimeType,
            name: asset.name,
            kind: mimeType.startsWith("video/") ? ("video" as const) : ("document" as const),
            size: asset.size ?? undefined,
          },
        };
      })
    );
  };

  const insertLink = () => {
    const url = normalizeUrl(linkUrl);
    if (!url) {
      Alert.alert(t("chapterEditor.link.invalidTitle"), t("chapterEditor.link.invalidMessage"));
      return;
    }
    const text = linkText.trim();
    // With selected text and no label typed, the selection itself becomes the link.
    const html = text ? `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>&nbsp;` : "";
    const fallback = `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>&nbsp;`;
    js(`window.__scLink(${JSON.stringify(url)},${JSON.stringify(html)},${JSON.stringify(fallback)})`);
    setSheet(null);
    setLinkUrl("");
    setLinkText("");
  };

  const insertTable = () => {
    const r = Math.min(Math.max(Number(rows) || 1, 1), 30);
    const c = Math.min(Math.max(Number(cols) || 1, 1), 10);
    let html = '<table style="border-collapse: collapse; width: 100%;"><tbody>';
    for (let i = 0; i < r; i += 1) {
      html += "<tr>";
      for (let j = 0; j < c; j += 1) {
        const tag = header && i === 0 ? "th" : "td";
        html += `<${tag}>${header && i === 0 ? escapeHtml(t("chapterEditor.table.headerCell", { n: j + 1 })) : "<br>"}</${tag}>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";
    js(`window.__scInsert(${JSON.stringify(html)})`);
    setSheet(null);
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "change" && typeof msg.html === "string") onChange(msg.html);
      else if (msg?.type === "state") setState(msg);
      else if (msg?.type === "focus") setFocused(true);
      else if (msg?.type === "blur") setFocused(false);
      else if (msg?.type === "caret" && typeof msg.top === "number") keepCaretVisible(msg.top, msg.bottom);
    } catch {
      // ignore non-JSON messages
    }
  };

  const Tool = ({
    icon,
    label,
    onPress,
    active,
    text,
    textStyle,
  }: {
    icon?: string;
    label: string;
    onPress: () => void;
    active?: boolean;
    text?: string;
    textStyle?: object;
  }) => (
    <TouchableOpacity
      style={[styles.toolBtn, active && styles.toolBtnActive, preview && styles.toolDisabled]}
      onPress={onPress}
      disabled={preview}
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: preview }}
    >
      {icon ? <FontAwesome5 name={icon} size={13} color={active ? "#4F46E5" : colors.textMuted} /> : null}
      {text ? <Text style={[styles.toolText, active && { color: "#4F46E5" }, textStyle]}>{text}</Text> : null}
    </TouchableOpacity>
  );
  const Sep = () => <View style={styles.toolDivider} />;
  const blockLabel = t(`chapterEditor.blocks.${BLOCKS.includes(state.block as BlockTag) ? (state.block as BlockTag) : "p"}`);

  // Same tools for the inline toolbar and the bar docked above the keyboard.
  const tools = () => (
    <>
      <Tool label={t("chapterEditor.tools.blockStyle")} text={`${blockLabel} ▾`} onPress={() => setSheet("block")} />
      <Tool label={t("chapterEditor.tools.textSize")} text={t("chapterEditor.tools.sizeButton")} onPress={() => setSheet("size")} />
      <Sep />
      <Tool label={t("chapterEditor.tools.bold")} text="B" textStyle={{ fontWeight: "800" }} active={!!state.bold} onPress={() => exec("bold")} />
      <Tool label={t("chapterEditor.tools.italic")} text="I" textStyle={{ fontStyle: "italic" }} active={!!state.italic} onPress={() => exec("italic")} />
      <Tool label={t("chapterEditor.tools.underline")} text="U" textStyle={{ textDecorationLine: "underline" }} active={!!state.underline} onPress={() => exec("underline")} />
      <Tool label={t("chapterEditor.tools.strike")} text="S" textStyle={{ textDecorationLine: "line-through" }} active={!!state.strikeThrough} onPress={() => exec("strikeThrough")} />
      <Tool label={t("chapterEditor.tools.textColor")} icon="palette" onPress={() => setSheet("color")} />
      <Tool label={t("chapterEditor.tools.highlight")} icon="highlighter" onPress={() => setSheet("highlight")} />
      <Sep />
      <Tool label={t("chapterEditor.tools.alignLeft")} icon="align-left" active={!!state.justifyLeft} onPress={() => exec("justifyLeft")} />
      <Tool label={t("chapterEditor.tools.alignCenter")} icon="align-center" active={!!state.justifyCenter} onPress={() => exec("justifyCenter")} />
      <Tool label={t("chapterEditor.tools.alignRight")} icon="align-right" active={!!state.justifyRight} onPress={() => exec("justifyRight")} />
      <Tool label={t("chapterEditor.tools.justify")} icon="align-justify" active={!!state.justifyFull} onPress={() => exec("justifyFull")} />
      <Sep />
      <Tool label={t("chapterEditor.tools.bulletList")} icon="list-ul" active={!!state.insertUnorderedList} onPress={() => exec("insertUnorderedList")} />
      <Tool label={t("chapterEditor.tools.numberedList")} icon="list-ol" active={!!state.insertOrderedList} onPress={() => exec("insertOrderedList")} />
      <Tool label={t("chapterEditor.tools.outdent")} icon="outdent" onPress={() => exec("outdent")} />
      <Tool label={t("chapterEditor.tools.indent")} icon="indent" onPress={() => exec("indent")} />
      <Sep />
      <Tool label={t("chapterEditor.tools.quote")} icon="quote-left" active={state.block === "blockquote"} onPress={() => exec("formatBlock", state.block === "blockquote" ? "<p>" : "<blockquote>")} />
      <Tool label={t("chapterEditor.tools.codeBlock")} icon="code" active={state.block === "pre"} onPress={() => exec("formatBlock", state.block === "pre" ? "<p>" : "<pre>")} />
      <Tool label={t("chapterEditor.tools.insertLink")} icon="link" onPress={() => setSheet("link")} />
      <Tool label={t("chapterEditor.tools.insertTable")} icon="table" onPress={() => setSheet("table")} />
      <Tool label={t("chapterEditor.tools.horizontalRule")} icon="minus" onPress={() => exec("insertHorizontalRule")} />
      <Tool label={t("chapterEditor.tools.attachFiles")} icon="paperclip" text={t("chapterEditor.tools.files")} onPress={() => setSheet("files")} />
      <Sep />
      <Tool label={t("chapterEditor.tools.undo")} icon="undo" onPress={() => exec("undo")} />
      <Tool label={t("chapterEditor.tools.redo")} icon="redo" onPress={() => exec("redo")} />
      <Tool label={t("chapterEditor.tools.clearFormat")} icon="eraser" onPress={() => exec("removeFormat")} />
    </>
  );

  // Publish / withdraw the docked bar (every render, so it reflects the
  // current state: active buttons, block label...).
  useEffect(() => {
    if (docked && !preview) {
      publishDock(
        editorId,
        <View style={styles.dockBar}>
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dockContent}
          >
            {tools()}
          </ScrollView>
          <TouchableOpacity
            style={styles.dockHide}
            onPress={() => {
              js("document.activeElement&&document.activeElement.blur()");
              Keyboard.dismiss();
            }}
            accessibilityLabel={t("chapterEditor.tools.hideKeyboard")}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <FontAwesome5 name="keyboard" size={14} color={colors.textMuted} />
            <FontAwesome5 name="chevron-down" size={9} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      );
    } else {
      clearDock(editorId);
    }
  });

  return (
    <View style={[styles.editorBox, error && { borderColor: "#F87171" }]}>
      <View style={styles.toolbar}>
        {tools()}
        <TouchableOpacity
          style={[styles.toolBtn, preview && styles.toolBtnActive]}
          onPress={() => setPreview((p) => !p)}
          accessibilityLabel={preview ? t("chapterEditor.tools.backToEdit") : t("chapterEditor.tools.preview")}
        >
          <FontAwesome5 name={preview ? "pen" : "eye"} size={13} color={preview ? "#4F46E5" : colors.textMuted} />
          <Text style={[styles.toolText, preview && { color: "#4F46E5" }]}>{preview ? t("chapterEditor.tools.edit") : t("chapterEditor.tools.preview")}</Text>
        </TouchableOpacity>
      </View>

      {preview ? (
        <View style={styles.previewBox}>
          <CourseRichContent
            html={value}
            allowLocal
            onOpenLink={(url) => {
              if (/^https?:/i.test(url)) Linking.openURL(url).catch(() => {});
            }}
          />
          {!value.replace(/<[^>]*>/g, "").trim() && !/<(img|video|table)/i.test(value) ? (
            <Text style={styles.previewEmpty}>{t("chapterEditor.previewEmpty")}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Kept mounted while previewing: the WebView owns the content being edited. */}
      <View ref={webWrapRef} collapsable={false} style={preview ? styles.hidden : undefined}>
        {source ? (
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={source}
            onMessage={onMessage}
            style={styles.webview}
            containerStyle={{ backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }}
            nestedScrollEnabled
            hideKeyboardAccessoryView
            keyboardDisplayRequiresUserAction={false}
            scrollEnabled
            javaScriptEnabled
            allowFileAccess
            allowsInlineMediaPlayback
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={(req) => {
              const url = req.url || "";
              return url === "about:blank" || url.startsWith("data:") || url.startsWith("blob:") || url === `${BASE}/` || url === BASE || req.isTopFrame === false;
            }}
          />
        ) : (
          <View style={styles.webview} />
        )}
      </View>

      {fileErrors.length > 0 && (
        <View style={styles.errorBox}>
          {fileErrors.map((m, i) => (
            <Text key={i} style={styles.errorText}>
              {m}
            </Text>
          ))}
        </View>
      )}

      {attached.length > 0 && (
        <View style={styles.pendingBox}>
          <View style={styles.pendingHeader}>
            <FontAwesome5 name="paperclip" size={12} color="#2563EB" />
            <Text style={styles.pendingTitle}>{t("chapterEditor.attached", { count: attached.length })}</Text>
          </View>
          {attached.map((f) => (
            <View key={f.id} style={styles.pendingRow}>
              <FontAwesome5
                name={f.kind === "image" ? "file-image" : f.kind === "video" ? "file-video" : /\.pdf$/i.test(f.name) ? "file-pdf" : "file-alt"}
                size={14}
                color={f.kind === "image" ? "#7C3AED" : f.kind === "video" ? "#2563EB" : /\.pdf$/i.test(f.name) ? "#DC2626" : colors.textMuted}
              />
              <Text style={styles.pendingName} numberOfLines={1}>
                {f.name}
              </Text>
              <Text style={styles.pendingMeta}>{[extOf(f.name), formatFileSize(f.size)].filter(Boolean).join(" · ")}</Text>
              <TouchableOpacity onPress={() => removeFile(f.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t("chapterEditor.removeFile", { name: f.name })}>
                <FontAwesome5 name="times" size={13} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <BottomSheet visible={sheet === "files"} onClose={() => setSheet(null)} title={t("chapterEditor.filesSheet.title")}>
        <TouchableOpacity style={styles.sheetOption} onPress={pickImages}>
          <FontAwesome5 name="image" size={15} color="#4F46E5" />
          <Text style={styles.sheetOptionText}>{t("chapterEditor.filesSheet.gallery")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetOption} onPress={takePhoto}>
          <FontAwesome5 name="camera" size={15} color="#4F46E5" />
          <Text style={styles.sheetOptionText}>{translate("camera.takePhoto")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetOption} onPress={recordVideo}>
          <FontAwesome5 name="video" size={15} color="#4F46E5" />
          <Text style={styles.sheetOptionText}>{translate("camera.recordVideo")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetOption} onPress={pickDocuments}>
          <FontAwesome5 name="file-alt" size={15} color="#4F46E5" />
          <Text style={styles.sheetOptionText}>{t("chapterEditor.filesSheet.videoOrDocument")}</Text>
        </TouchableOpacity>
        <Text style={styles.sheetHint}>
          {t("chapterEditor.filesSheet.limits", {
            image: COURSE_FILE_LIMITS.image.label,
            video: COURSE_FILE_LIMITS.video.label,
            document: COURSE_FILE_LIMITS.document.label,
          })}
        </Text>
      </BottomSheet>

      <BottomSheet visible={sheet === "block"} onClose={() => setSheet(null)} title={t("chapterEditor.tools.blockStyle")}>
        {BLOCKS.map((k) => (
          <TouchableOpacity
            key={k}
            style={styles.sheetOption}
            onPress={() => {
              setSheet(null);
              exec("formatBlock", `<${k}>`);
            }}
          >
            <Text style={[styles.sheetOptionText, state.block === k && styles.sheetOptionActive]}>{t(`chapterEditor.blocks.${k}`)}</Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === "size"} onClose={() => setSheet(null)} title={t("chapterEditor.tools.textSize")}>
        {SIZES.map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={styles.sheetOption}
            onPress={() => {
              setSheet(null);
              exec("fontSize", k, true);
            }}
          >
            <Text style={styles.sheetOptionText}>{t(`chapterEditor.sizes.${label}`)}</Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <BottomSheet
        visible={sheet === "color" || sheet === "highlight"}
        onClose={() => setSheet(null)}
        title={sheet === "highlight" ? t("chapterEditor.tools.highlight") : t("chapterEditor.tools.textColor")}
      >
        <View style={styles.swatches}>
          {(sheet === "highlight" ? HIGHLIGHTS : TEXT_COLORS).map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.swatch, { backgroundColor: c }]}
              accessibilityLabel={c}
              onPress={() => {
                js(`window.__scColor(${JSON.stringify(sheet === "highlight" ? "highlight" : "color")},${JSON.stringify(c)})`);
                setSheet(null);
              }}
            />
          ))}
        </View>
        <TouchableOpacity
          style={styles.sheetOption}
          onPress={() => {
            js(`window.__scColor(${JSON.stringify(sheet === "highlight" ? "highlight" : "color")},"")`);
            setSheet(null);
          }}
        >
          <FontAwesome5 name="ban" size={14} color={colors.textMuted} />
          <Text style={styles.sheetOptionText}>{sheet === "highlight" ? t("chapterEditor.colors.noHighlight") : t("chapterEditor.colors.autoColor")}</Text>
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={sheet === "link"} onClose={() => setSheet(null)} title={t("chapterEditor.link.sheetTitle")}>
        <TextInput
          style={styles.sheetInput}
          value={linkUrl}
          onChangeText={setLinkUrl}
          placeholder="https://…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TextInput
          style={styles.sheetInput}
          value={linkText}
          onChangeText={setLinkText}
          placeholder={t("chapterEditor.link.textPlaceholder")}
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity style={styles.sheetPrimary} onPress={insertLink}>
          <Text style={styles.sheetPrimaryText}>{t("chapterEditor.link.insert")}</Text>
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={sheet === "table"} onClose={() => setSheet(null)} title={t("chapterEditor.table.sheetTitle")}>
        <View style={styles.tableRow}>
          <Text style={styles.sheetOptionText}>{t("chapterEditor.table.rows")}</Text>
          <TextInput style={[styles.sheetInput, styles.numInput]} value={rows} onChangeText={setRows} keyboardType="number-pad" maxLength={2} />
          <Text style={styles.sheetOptionText}>{t("chapterEditor.table.columns")}</Text>
          <TextInput style={[styles.sheetInput, styles.numInput]} value={cols} onChangeText={setCols} keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={styles.tableRow}>
          <Switch value={header} onValueChange={setHeader} />
          <Text style={styles.sheetOptionText}>{t("chapterEditor.table.headerRow")}</Text>
        </View>
        <TouchableOpacity style={styles.sheetPrimary} onPress={insertTable}>
          <Text style={styles.sheetPrimaryText}>{t("chapterEditor.table.insert")}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) =>
  StyleSheet.create({
    editorBox: {
      borderWidth: 1,
      borderColor: isDark ? "#475569" : "#E2E8F0",
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
    },
    toolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 2,
      padding: 6,
      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#475569" : "#E2E8F0",
    },
    toolBtn: {
      minWidth: 32,
      height: 32,
      paddingHorizontal: 6,
      flexDirection: "row",
      gap: 4,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 6,
    },
    toolBtnActive: { backgroundColor: isDark ? "rgba(99,102,241,0.25)" : "#E0E7FF" },
    toolDisabled: { opacity: 0.4 },
    toolText: { fontSize: 13, color: colors.textMuted },
    dockBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
      borderTopWidth: 1,
      borderTopColor: isDark ? "#475569" : "#E2E8F0",
      paddingVertical: 4,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: -2 } },
        default: { elevation: 8 },
      }),
    },
    dockContent: { alignItems: "center", gap: 2, paddingHorizontal: 6 },
    dockHide: {
      height: 32,
      paddingHorizontal: 10,
      flexDirection: "row",
      gap: 3,
      alignItems: "center",
      justifyContent: "center",
      borderLeftWidth: 1,
      borderLeftColor: isDark ? "#334155" : "#CBD5E1",
    },
    toolDivider: { width: 1, height: 20, backgroundColor: isDark ? "#334155" : "#CBD5E1", marginHorizontal: 3 },
    webview: { height: 300, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
    hidden: { display: "none" },
    previewBox: { padding: 12, minHeight: 120 },
    previewEmpty: { fontSize: 13, fontStyle: "italic", color: colors.textMuted },
    errorBox: {
      backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2",
      borderTopWidth: 1,
      borderTopColor: isDark ? "rgba(239,68,68,0.45)" : "#FECACA",
      padding: 10,
      gap: 4,
    },
    errorText: { fontSize: 12, color: isDark ? "#F87171" : "#DC2626" },
    pendingBox: {
      backgroundColor: isDark ? "rgba(37,99,235,0.12)" : "#EFF6FF",
      borderTopWidth: 1,
      borderTopColor: isDark ? "rgba(37,99,235,0.4)" : "#BFDBFE",
      padding: 10,
      gap: 6,
    },
    pendingHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    pendingTitle: { flex: 1, fontSize: 12, fontWeight: "600", color: isDark ? "#93C5FD" : "#1E40AF" },
    pendingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "#E2E8F0",
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    pendingName: { flex: 1, fontSize: 13, color: colors.text },
    pendingMeta: { fontSize: 11, color: colors.textMuted },
    sheetOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 4 },
    sheetOptionText: { fontSize: 15, color: colors.text, flexShrink: 1 },
    sheetOptionActive: { color: "#4F46E5", fontWeight: "700" },
    sheetHint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
    swatches: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 8 },
    swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
    sheetInput: {
      borderWidth: 1,
      borderColor: isDark ? "#475569" : "#E2E8F0",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
      fontSize: 14,
      color: colors.text,
      marginBottom: 10,
    },
    numInput: { width: 56, marginBottom: 0, textAlign: "center" },
    tableRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    sheetPrimary: { backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    sheetPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  });

export default ChapterRichEditor;
