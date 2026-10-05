import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Chapitre, ChapitreImage, Cours } from "./DashboardCoursBody";
import { useUser } from "../../../../context/UserContext";
import { coursService, matiereService, mediaService } from "../../../../services/api";
import { BottomSheet, LoadingSpinner } from "../../../../components/ui";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { environment } from "../../../../environment/environment";
import { Matiere } from "../../../../types";

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

/*
 * Port of scholchat_front's CreateCourseComponent.jsx (used for both create
 * and edit). Same sections/fields/labels/validation and the exact payload
 * web's CoursService.js sends:
 *   POST /cours  and  PUT /cours/{id}
 *   { titre, description, etat, restriction, references, redacteurId,
 *     matieres: [{ id }], chapitres: [{ titre, description, ordre, contenu }] }
 * `etat` is never a form field: "BROUILLON" on create, the course's current
 * state on edit. Chapter `contenu` is HTML (web uses a contentEditable rich
 * editor), so the mobile chapter editor is a WebView contentEditable too.
 */

type RestrictionValue = "PRIVE" | "PUBLIC";

// Backend: PUBLIC courses show up in every user's accessible list
// (CoursRepository: restriction = 'PUBLIC' OR redacteur = user), PRIVE only
// in the author's.
const RESTRICTION_OPTIONS: { value: RestrictionValue; label: string; hint: string; icon: string }[] = [
  { value: "PRIVE", label: "Privé", hint: "Réservé à vous et à vos séances programmées", icon: "lock" },
  { value: "PUBLIC", label: "Public", hint: "Visible par tous les utilisateurs", icon: "globe-africa" },
];

/** Two side-by-side option cards with a radio dot, instead of a dropdown. */
const RestrictionPicker = ({
  value,
  onChange,
  styles,
  palette,
}: {
  value: RestrictionValue;
  onChange: (v: RestrictionValue) => void;
  styles: ReturnType<typeof createStyles>;
  palette: Palette;
}) => (
  <View style={styles.restrictionRow}>
    {RESTRICTION_OPTIONS.map((opt) => {
      const active = value === opt.value;
      return (
        <TouchableOpacity
          key={opt.value}
          style={[styles.restrictionCard, active && styles.restrictionCardActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.85}
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
        >
          <View style={styles.restrictionTop}>
            <View style={[styles.restrictionIcon, active && styles.restrictionIconActive]}>
              <FontAwesome5 name={opt.icon as any} size={14} color={active ? "#FFFFFF" : palette.sub} />
            </View>
            <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
              {active ? <View style={styles.radioInner} /> : null}
            </View>
          </View>
          <Text style={[styles.restrictionLabel, active && styles.restrictionLabelActive]}>{opt.label}</Text>
          <Text style={styles.restrictionHint}>{opt.hint}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/** Chapter as held in the form (web's savedChapters entries). */
interface FormChapter {
  key: string;
  id: string | null;
  titre: string;
  description: string;
  contenu: string;
  ordre: number;
}

type ChapterDraft = Omit<FormChapter, "key" | "id">;

type PendingKind = "image" | "video" | "document";

/** A file inserted in a chapter editor, uploaded only on final submit (like web). */
interface PendingFile {
  id: string;
  uri: string;
  mimeType: string;
  name: string;
  kind: PendingKind;
}

interface CreateCoursBodyProps {
  onBack: () => void;
  onCreateCours: (cours: Cours) => void;
  editingCours?: Cours | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const newKey = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const newFileId = () => `file_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** Web's ChapterCard getPlainText. */
const getPlainText = (html: string) =>
  decodeEntities((html || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const truncateText = (text: string, length: number) =>
  text.length <= length ? text : text.substring(0, length) + "...";

/** Older mobile-created chapters stored plain text — show it as HTML in the editor. */
const toEditorHtml = (content: string) => {
  if (!content) return "";
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return escapeHtml(content).replace(/\n/g, "<br>");
};

/** Web's toRelativePath: storage key out of a full Wasabi/MinIO URL. */
const toRelativePath = (raw: string) => {
  if (!raw || !raw.startsWith("http")) return raw;
  const pathname = raw.replace(/^https?:\/\/[^/]+\/?/, "").split("?")[0];
  const idx = pathname.indexOf("users/");
  if (idx >= 0) return pathname.slice(idx);
  const parts = pathname.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : pathname;
};

/** Web's isStorageUrl: stored media URL that isn't already a backend proxy URL. */
const isStorageUrl = (url: string) => {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false;
  if (environment.baseUrl && url.startsWith(environment.baseUrl)) return false;
  return url.startsWith("http");
};

/** Web's refreshChapterContentUrls (img/video/source src, a href) without a DOM. */
const refreshChapterContentUrls = async (html: string): Promise<string> => {
  if (!html) return html;
  const re = /(<(?:img|video|source)\b[^>]*?\ssrc="|<a\b[^>]*?\shref=")([^"]*)"/gi;
  const urls = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (isStorageUrl(m[2])) urls.add(m[2]);
  }
  if (urls.size === 0) return html;
  const refreshed = new Map<string, string>();
  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const fresh = await mediaService.getContentUrlByPath(toRelativePath(url));
        refreshed.set(url, fresh || url);
      } catch {
        refreshed.set(url, url);
      }
    })
  );
  return html.replace(re, (full, prefix: string, url: string) =>
    refreshed.has(url) ? `${prefix}${refreshed.get(url)}"` : full
  );
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const setSrc = (tag: string, url: string) => {
  const re = /\ssrc="[^"]*"/i;
  return re.test(tag) ? tag.replace(re, ` src="${url}"`) : tag.replace(/^<(\w+)/, `<$1 src="${url}"`);
};

/** Web's updateContentWithUploadedFiles: swap local previews for uploaded URLs. */
const updateContentWithUploadedFiles = (content: string, fileUrlMap: Map<string, string>) => {
  let html = content;
  fileUrlMap.forEach((rawUrl, fileId) => {
    const url = escapeHtml(rawUrl);
    const id = escapeRe(fileId);
    html = html.replace(new RegExp(`<(?:img|video)\\b[^>]*data-file-id="${id}"[^>]*>`, "gi"), (tag) => setSrc(tag, url));
    html = html.replace(
      new RegExp(`<span\\b[^>]*data-file-name-for="${id}"[^>]*>([\\s\\S]*?)</span>`, "gi"),
      (_m, name: string) =>
        `<a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: 500;">${name}</a>`
    );
  });
  return html;
};

/** Same inline markup web's RichTextEditor inserts for each kind of file. */
const buildFileSnippet = (file: PendingFile, previewUri?: string) => {
  const name = escapeHtml(file.name);
  if (file.kind === "image") {
    return (
      `<div data-file-id="${file.id}" style="position: relative; display: inline-block; margin: 8px;">` +
      `<img src="${previewUri ?? ""}" alt="${name}" data-file-id="${file.id}" style="max-width: 250px; max-height: 200px; width: auto; height: auto; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); display: block;">` +
      `</div><br>`
    );
  }
  if (file.kind === "video") {
    return (
      `<div data-file-id="${file.id}" style="margin: 8px 0; display: inline-block; max-width: 100%;">` +
      `<video controls data-file-id="${file.id}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #e2e8f0; display: block;"></video>` +
      `<div style="font-size: 11px; color: #6b7280; margin-top: 4px; text-align: center;">${name}</div>` +
      `</div><br>`
    );
  }
  return (
    `<div data-file-id="${file.id}" style="margin: 8px 0; padding: 8px 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; align-items: center; gap: 8px;">` +
    `<span style="font-size: 16px;">📄</span>` +
    `<span data-file-name-for="${file.id}" style="color: #3b82f6; font-weight: 500;">${name}</span>` +
    `</div><br>`
  );
};

const buildEditorHtml = (initial: string, placeholder: string, isDark: boolean) => {
  const bg = isDark ? "#0F172A" : "#FFFFFF";
  const text = isDark ? "#F1F5F9" : "#0F172A";
  const border = isDark ? "#334155" : "#E2E8F0";
  const initialJs = JSON.stringify(initial || "").replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
html,body{margin:0;padding:0;background:${bg};}
#editor{min-height:100vh;box-sizing:border-box;padding:12px;outline:none;color:${text};font-family:-apple-system,Roboto,"Segoe UI",sans-serif;font-size:15px;line-height:1.6;word-wrap:break-word;overflow-wrap:break-word;}
#editor:empty:before{content:attr(data-placeholder);color:#9ca3af;font-style:italic;}
#editor p{margin:0.5em 0;}#editor div{margin:0.25em 0;}
#editor ul,#editor ol{margin:0.5em 0;padding-left:2em;}#editor li{margin:0.25em 0;}
#editor img{max-width:min(250px,100%);max-height:200px;width:auto;height:auto;object-fit:contain;border-radius:8px;border:1px solid ${border};display:block;}
#editor video{width:100%;max-width:100%;min-height:120px;max-height:300px;background:#000;border-radius:8px;display:block;}
#editor a{color:#3b82f6;text-decoration:underline;}
</style></head><body>
<div id="editor" contenteditable="true" data-placeholder="${escapeHtml(placeholder)}"></div>
<script>
(function(){
  var ed = document.getElementById('editor');
  ed.innerHTML = ${initialJs};
  var saved = null;
  function post(o){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  function emit(){ post({ type: 'change', html: ed.innerHTML }); }
  document.addEventListener('selectionchange', function(){
    var s = window.getSelection();
    if (s && s.rangeCount > 0) {
      var r = s.getRangeAt(0);
      if (ed.contains(r.commonAncestorContainer)) saved = r.cloneRange();
    }
  });
  function restore(){
    ed.focus();
    if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); return true; }
    return false;
  }
  window.__scCmd = function(c){ restore(); document.execCommand(c, false, null); emit(); };
  window.__scInsert = function(html){
    if (restore()) { document.execCommand('insertHTML', false, html); }
    else { ed.insertAdjacentHTML('beforeend', html); }
    emit();
  };
  window.__scRemove = function(id){
    var els = ed.querySelectorAll('[data-file-id="' + id + '"]');
    for (var i = 0; i < els.length; i++) { els[i].parentNode && els[i].parentNode.removeChild(els[i]); }
    emit();
  };
  ed.addEventListener('input', emit);
  ed.addEventListener('blur', emit);
  ed.addEventListener('paste', function(e){
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    var h = t.split('\\n').map(function(l){ return l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }).join('<br>');
    document.execCommand('insertHTML', false, h);
    setTimeout(emit, 10);
  });
})();
true;
</script></body></html>`;
};

// ── Theme ───────────────────────────────────────────────────────────────────

const makePalette = (isDark: boolean) => ({
  title: isDark ? "#F8FAFC" : "#0F172A", // slate-900
  label: isDark ? "#CBD5E1" : "#334155", // slate-700
  body: isDark ? "#CBD5E1" : "#475569", // slate-600
  sub: isDark ? "#94A3B8" : "#64748B", // slate-500
  muted: isDark ? "#64748B" : "#94A3B8", // slate-400
  card: isDark ? "#1E293B" : "#FFFFFF",
  cardBorder: isDark ? "#334155" : "#E2E8F0",
  input: isDark ? "#0F172A" : "#FFFFFF",
  inputBorder: isDark ? "#475569" : "#E2E8F0", // slate-200
  toolbar: isDark ? "#0F172A" : "#F8FAFC", // slate-50
  divider: isDark ? "#334155" : "#CBD5E1", // slate-300
  indigoSoft: isDark ? "rgba(99,102,241,0.15)" : "#EEF2FF", // indigo-50
  indigoSoftBorder: isDark ? "rgba(99,102,241,0.4)" : "#C7D2FE", // indigo-200
  indigoText: isDark ? "#A5B4FC" : "#4338CA", // indigo-700
  chipBg: isDark ? "rgba(99,102,241,0.25)" : "#E0E7FF", // indigo-100
  chipText: isDark ? "#C7D2FE" : "#3730A3", // indigo-800
  errorBg: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2", // red-50
  errorBorder: isDark ? "rgba(239,68,68,0.45)" : "#FECACA", // red-200
  errorInputBorder: isDark ? "#F87171" : "#FCA5A5", // red-300
  errorText: isDark ? "#F87171" : "#DC2626", // red-600
});

type Palette = ReturnType<typeof makePalette>;

// ── Small building blocks ───────────────────────────────────────────────────

const FieldError = ({ message, styles, color }: { message?: string; styles: Styles; color: string }) =>
  message ? (
    <View style={styles.fieldError}>
      <FontAwesome5 name="exclamation-circle" size={12} color={color} />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  ) : null;

/** Input with web's focus ring (indigo border) and error state (red border/bg). */
const FormInput = ({
  error,
  styles,
  palette,
  style,
  ...props
}: TextInputProps & { error?: boolean; styles: Styles; palette: Palette }) => {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      placeholderTextColor={palette.muted}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.input, focused && styles.inputFocused, error && styles.inputError, style]}
    />
  );
};

/** Port of web's MultiSelectDropdown (type-to-search, chips below). */
const MatieresMultiSelect = ({
  options,
  selected,
  onChange,
  placeholder,
  error,
  styles,
  palette,
}: {
  options: Matiere[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  error?: boolean;
  styles: Styles;
  palette: Palette;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const handleSelect = (optionId: string) => {
    const next = selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId];
    onChange(next);
    setQuery("");
  };

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => (o.nom ?? "").toLowerCase().includes(q));

  return (
    <View>
      <FormInput
        styles={styles}
        palette={palette}
        error={error}
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setIsOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setIsOpen(false), 150);
        }}
        placeholder={selected.length === 0 ? placeholder : "Ajouter une matière..."}
      />

      {isOpen && (
        <View style={styles.dropdown}>
          {q === "" ? (
            <Text style={styles.dropdownHint}>Tapez pour rechercher une matière...</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.dropdownEmpty}>
              {options.length === 0 ? "Aucune matière disponible" : "Aucun résultat"}
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filtered.map((option) => {
                const id = String(option.id);
                const isSel = selected.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.dropdownItem, isSel && styles.dropdownItemSelected]}
                    onPress={() => handleSelect(id)}
                  >
                    <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSelected]}>{option.nom}</Text>
                    {isSel ? <FontAwesome5 name="check-circle" solid size={15} color="#4F46E5" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {selected.length > 0 && (
        <View style={styles.chips}>
          {options
            .filter((o) => selected.includes(String(o.id)))
            .map((o) => (
              <View key={String(o.id)} style={styles.chip}>
                <Text style={styles.chipText}>{o.nom}</Text>
                <TouchableOpacity
                  onPress={() => handleSelect(String(o.id))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 8 }}
                >
                  <FontAwesome5 name="times" size={11} color={palette.chipText} />
                </TouchableOpacity>
              </View>
            ))}
        </View>
      )}
    </View>
  );
};

// ── Rich text editor (web's RichTextEditor) ─────────────────────────────────

const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  onFileAdd,
  styles,
  palette,
  isDark,
  error,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  onFileAdd: (file: PendingFile) => void;
  styles: Styles;
  palette: Palette;
  isDark: boolean;
  error?: boolean;
}) => {
  const webRef = useRef<WebView>(null);
  const latestValue = useRef(value);
  latestValue.current = value;
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Built once per theme: the editor owns its content afterwards and reports
  // every change back, so re-rendering must not reset it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => ({ html: buildEditorHtml(latestValue.current, placeholder, isDark) }), [isDark]);

  const exec = (command: string) => webRef.current?.injectJavaScript(`window.__scCmd(${JSON.stringify(command)});true;`);

  const insertFile = (file: PendingFile, previewUri?: string) => {
    const html = buildFileSnippet(file, previewUri);
    webRef.current?.injectJavaScript(`window.__scInsert(${JSON.stringify(html)});true;`);
    setPendingFiles((prev) => [...prev, file]);
    onFileAdd(file);
  };

  const removePendingFile = (fileId: string) => {
    webRef.current?.injectJavaScript(`window.__scRemove(${JSON.stringify(fileId)});true;`);
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const pickImages = async () => {
    setShowPicker(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l'accès à vos photos pour ajouter une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    result.assets.forEach((asset) => {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const file: PendingFile = {
        id: newFileId(),
        uri: asset.uri,
        mimeType,
        name: asset.fileName ?? `image_${Date.now()}.jpg`,
        kind: "image",
      };
      insertFile(file, asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri);
    });
  };

  const pickDocuments = async () => {
    setShowPicker(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "video/*",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    result.assets.forEach((asset) => {
      const mimeType = asset.mimeType ?? "application/octet-stream";
      insertFile({
        id: newFileId(),
        uri: asset.uri,
        mimeType,
        name: asset.name,
        kind: mimeType.startsWith("video/") ? "video" : "document",
      });
    });
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "change" && typeof msg.html === "string") onChange(msg.html);
    } catch {
      // ignore non-JSON messages
    }
  };

  const ToolBtn = ({ onPress, children, label }: { onPress: () => void; children: React.ReactNode; label: string }) => (
    <TouchableOpacity style={styles.toolBtn} onPress={onPress} accessibilityLabel={label}>
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.editorBox, error && { borderColor: palette.errorInputBorder }]}>
      {pendingFiles.length > 0 && (
        <View style={styles.pendingBox}>
          <View style={styles.pendingHeader}>
            <FontAwesome5 name="paperclip" size={13} color="#2563EB" />
            <Text style={styles.pendingTitle}>Fichiers en attente:</Text>
          </View>
          {pendingFiles.map((f) => (
            <View key={f.id} style={styles.pendingRow}>
              <View style={styles.pendingNameRow}>
                <FontAwesome5 name={f.kind === "image" ? "image" : "file-alt"} size={12} color={palette.sub} />
                <Text style={styles.pendingName} numberOfLines={1}>{f.name}</Text>
              </View>
              <TouchableOpacity onPress={() => removePendingFile(f.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome5 name="times" size={13} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.toolbar}>
        <ToolBtn label="Gras" onPress={() => exec("bold")}>
          <Text style={[styles.toolText, { fontWeight: "800" }]}>B</Text>
        </ToolBtn>
        <ToolBtn label="Italique" onPress={() => exec("italic")}>
          <Text style={[styles.toolText, { fontStyle: "italic" }]}>I</Text>
        </ToolBtn>
        <ToolBtn label="Souligné" onPress={() => exec("underline")}>
          <Text style={[styles.toolText, { textDecorationLine: "underline" }]}>U</Text>
        </ToolBtn>
        <View style={styles.toolDivider} />
        <ToolBtn label="Liste à puces" onPress={() => exec("insertUnorderedList")}>
          <FontAwesome5 name="list-ul" size={13} color={palette.body} />
        </ToolBtn>
        <ToolBtn label="Liste numérotée" onPress={() => exec("insertOrderedList")}>
          <FontAwesome5 name="list-ol" size={13} color={palette.body} />
        </ToolBtn>
        <View style={styles.toolDivider} />
        <ToolBtn label="Aligner à gauche" onPress={() => exec("justifyLeft")}>
          <FontAwesome5 name="align-left" size={13} color={palette.body} />
        </ToolBtn>
        <ToolBtn label="Centrer" onPress={() => exec("justifyCenter")}>
          <FontAwesome5 name="align-center" size={13} color={palette.body} />
        </ToolBtn>
        <ToolBtn label="Aligner à droite" onPress={() => exec("justifyRight")}>
          <FontAwesome5 name="align-right" size={13} color={palette.body} />
        </ToolBtn>
        <View style={styles.toolDivider} />
        <ToolBtn label="Insérer fichier/image" onPress={() => setShowPicker(true)}>
          <View style={styles.toolRow}>
            <FontAwesome5 name="paperclip" size={13} color={palette.body} />
            <Text style={styles.toolSmall}>Fichiers</Text>
          </View>
        </ToolBtn>
        <ToolBtn label="Supprimer le formatage" onPress={() => exec("removeFormat")}>
          <Text style={styles.toolSmall}>Clear</Text>
        </ToolBtn>
      </View>

      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={source}
        onMessage={onMessage}
        style={styles.webview}
        containerStyle={{ backgroundColor: palette.input }}
        nestedScrollEnabled
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        scrollEnabled
        javaScriptEnabled
        setSupportMultipleWindows={false}
      />

      <BottomSheet visible={showPicker} onClose={() => setShowPicker(false)} title="Insérer un fichier">
        <TouchableOpacity style={styles.sheetOption} onPress={pickImages}>
          <View style={styles.toolRow}>
            <FontAwesome5 name="image" size={15} color="#4F46E5" />
            <Text style={styles.sheetOptionText}>Image(s) de la galerie</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetOption} onPress={pickDocuments}>
          <View style={styles.toolRow}>
            <FontAwesome5 name="file-alt" size={15} color="#4F46E5" />
            <Text style={styles.sheetOptionText}>Vidéo ou document (PDF, Word, PowerPoint...)</Text>
          </View>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
};

// ── Chapter card / editor ───────────────────────────────────────────────────

const ChapterCard = ({
  chapter,
  index,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  loading,
  styles,
  palette,
}: {
  chapter: FormChapter;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  loading: boolean;
  styles: Styles;
  palette: Palette;
}) => (
  <View style={[styles.chapterCard, loading && { opacity: 0.5 }]} pointerEvents={loading ? "none" : "auto"}>
    <View style={styles.chapterCardRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.chapterBadge}>
          <Text style={styles.chapterBadgeText}>Chapitre {index + 1}</Text>
        </View>
        <Text style={styles.chapterTitle} numberOfLines={1}>
          {truncateText(chapter.titre, 40)}
        </Text>
        {chapter.description ? (
          <Text style={styles.chapterDesc}>{truncateText(chapter.description, 60)}</Text>
        ) : null}
        <Text style={styles.chapterPreview} numberOfLines={2}>
          {truncateText(getPlainText(chapter.contenu), 80)}
        </Text>
      </View>
      <View style={styles.chapterActions}>
        {canMoveUp && (
          <TouchableOpacity style={styles.iconBtn} onPress={onMoveUp} accessibilityLabel="Déplacer vers le haut">
            <FontAwesome5 name="chevron-up" size={13} color={palette.muted} />
          </TouchableOpacity>
        )}
        {canMoveDown && (
          <TouchableOpacity style={styles.iconBtn} onPress={onMoveDown} accessibilityLabel="Déplacer vers le bas">
            <FontAwesome5 name="chevron-down" size={13} color={palette.muted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconBtn} onPress={onEdit} accessibilityLabel="Modifier">
          <FontAwesome5 name="pen" size={12} color={palette.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityLabel="Supprimer"
          onPress={() =>
            Alert.alert("Supprimer", "Êtes-vous sûr de vouloir supprimer ce chapitre ?", [
              { text: "Annuler", style: "cancel" },
              { text: "Supprimer", style: "destructive", onPress: onDelete },
            ])
          }
        >
          <FontAwesome5 name="trash-alt" size={12} color={palette.muted} />
        </TouchableOpacity>
      </View>
    </View>
    {loading && (
      <View style={styles.chapterLoading}>
        <ActivityIndicator color="#4F46E5" />
      </View>
    )}
  </View>
);

const ChapterEditor = ({
  mode,
  initialData,
  totalChapters,
  onSave,
  onCancel,
  onFileAdd,
  styles,
  palette,
  isDark,
}: {
  mode: "create" | "edit";
  initialData: FormChapter | null;
  totalChapters: number;
  onSave: (data: ChapterDraft) => void;
  onCancel: () => void;
  onFileAdd: (file: PendingFile) => void;
  styles: Styles;
  palette: Palette;
  isDark: boolean;
}) => {
  const [formData, setFormData] = useState<ChapterDraft>(() => ({
    titre: initialData?.titre ?? "",
    description: initialData?.description ?? "",
    contenu: initialData?.contenu ?? "",
    ordre: initialData?.ordre || (mode === "create" ? totalChapters + 1 : 0),
  }));
  const [errors, setErrors] = useState<{ titre?: string; contenu?: string }>({});

  const validateForm = () => {
    const next: { titre?: string; contenu?: string } = {};
    if (!formData.titre.trim()) next.titre = "Le titre est requis";
    if (!formData.contenu.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim()) next.contenu = "Le contenu est requis";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    onSave({ ...formData, ordre: mode === "create" ? totalChapters + 1 : formData.ordre });
  };

  const chapterNumber = mode === "create" ? totalChapters + 1 : formData.ordre;

  return (
    <View style={styles.chapterEditor}>
      <View style={styles.chapterEditorHeader}>
        <View style={styles.rowCenter}>
          <FontAwesome5 name="file-alt" size={17} color="#4F46E5" />
          <Text style={styles.chapterEditorTitle}>
            {mode === "create" ? `Nouveau Chapitre ${chapterNumber}` : `Modifier Chapitre ${chapterNumber}`}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.iconBtn} accessibilityLabel="Annuler">
          <FontAwesome5 name="times-circle" size={17} color={palette.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.labelMd}>Titre du chapitre *</Text>
        <FormInput
          styles={styles}
          palette={palette}
          error={!!errors.titre}
          value={formData.titre}
          onChangeText={(t) => setFormData((p) => ({ ...p, titre: t }))}
          placeholder="Titre du chapitre"
        />
        <FieldError message={errors.titre} styles={styles} color={palette.errorText} />
      </View>

      <View style={styles.field}>
        <Text style={styles.labelMd}>Description du chapitre</Text>
        <FormInput
          styles={styles}
          palette={palette}
          value={formData.description}
          onChangeText={(t) => setFormData((p) => ({ ...p, description: t }))}
          placeholder="Description du chapitre"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          style={{ minHeight: 64 }}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.labelMd}>Contenu du chapitre *</Text>
        <RichTextEditor
          value={formData.contenu}
          onChange={(html) => setFormData((p) => ({ ...p, contenu: html }))}
          placeholder="Contenu détaillé du chapitre..."
          onFileAdd={onFileAdd}
          styles={styles}
          palette={palette}
          isDark={isDark}
          error={!!errors.contenu}
        />
        <FieldError message={errors.contenu} styles={styles} color={palette.errorText} />
      </View>

      <View style={styles.chapterEditorActions}>
        <TouchableOpacity style={styles.editorCancelBtn} onPress={onCancel}>
          <Text style={styles.editorCancelText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editorSaveBtn} onPress={handleSave}>
          <FontAwesome5 name="save" size={14} color="#FFFFFF" />
          <Text style={styles.editorSaveText}>{mode === "create" ? "Ajouter" : "Sauvegarder"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Main screen ─────────────────────────────────────────────────────────────

const CreateCoursBody = ({ onBack, onCreateCours, editingCours }: CreateCoursBodyProps) => {
  const { user } = useUser();
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const palette = useMemo(() => makePalette(isDark), [isDark]);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, palette), [colors, palette]);
  const editMode = !!editingCours;

  // Course fields (web's react-hook-form values)
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [restriction, setRestriction] = useState<RestrictionValue>("PRIVE");
  const [references, setReferences] = useState("");
  const [selectedMatiereIds, setSelectedMatiereIds] = useState<string[]>([]);
  const [etat, setEtat] = useState("BROUILLON");
  const [submitted, setSubmitted] = useState(false);

  const [subjects, setSubjects] = useState<Matiere[]>([]);
  const [savedChapters, setSavedChapters] = useState<FormChapter[]>([]);
  const [activeEditor, setActiveEditor] = useState<"create" | "edit" | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const pendingFiles = useRef(new Map<string, PendingFile>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    matiereService
      .getAll()
      .then((data) => setSubjects((prev) => mergeMatieres(data ?? [], prev)))
      .catch(() => {});
  }, []);

  // Initialize form with existing course data in edit mode
  useEffect(() => {
    if (!editingCours) return;
    let cancelled = false;
    setTitre(editingCours.titre ?? "");
    setDescription(editingCours.description ?? "");
    setRestriction(editingCours.restriction === "PUBLIC" ? "PUBLIC" : "PRIVE");
    setReferences(editingCours.references ?? "");
    setEtat(editingCours.etat || "BROUILLON");
    setLoadingExisting(true);
    coursService
      .getWithChapitres(editingCours.id)
      .then(async (full) => {
        if (cancelled) return;
        setTitre(full.titre ?? editingCours.titre ?? "");
        setDescription(full.description ?? editingCours.description ?? "");
        setRestriction(full.restriction === "PUBLIC" ? "PUBLIC" : full.restriction === "PRIVE" ? "PRIVE" : editingCours.restriction === "PUBLIC" ? "PUBLIC" : "PRIVE");
        setReferences(full.references ?? editingCours.references ?? "");
        setEtat(full.etat || editingCours.etat || "BROUILLON");
        const matieres = full.matieres ?? [];
        setSelectedMatiereIds(matieres.map((m) => String(m.id)));
        setSubjects((prev) => mergeMatieres(prev, matieres));
        const sorted = [...(full.chapitres ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
        // Refresh presigned URLs in chapter content before displaying (web does the same)
        const chapters = await Promise.all(
          sorted.map(async (ch, i) => ({
            key: newKey(),
            id: ch.id ? String(ch.id) : null,
            titre: ch.titre ?? "",
            description: (ch.description as string) ?? "",
            contenu: await refreshChapterContentUrls(toEditorHtml(ch.contenu ?? "")),
            ordre: ch.ordre ?? i + 1,
          }))
        );
        if (!cancelled) setSavedChapters(chapters);
      })
      .catch((err) => {
        if (!cancelled) setSubmitError(err instanceof Error ? err.message : "Échec du chargement du cours.");
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingCours]);

  // Web's yup courseSchema — shown after the first submit attempt, then live.
  const errors = useMemo(() => {
    if (!submitted) return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!titre.trim()) e.titre = "Le titre est requis";
    if (!description.trim()) e.description = "La description est requise";
    if (selectedMatiereIds.length === 0) e.matieres = "Au moins une matière est requise";
    return e;
  }, [submitted, titre, description, selectedMatiereIds]);

  const handleFileAdd = useCallback((file: PendingFile) => {
    pendingFiles.current.set(file.id, file);
  }, []);

  const handleSaveChapter = (data: ChapterDraft) => {
    if (activeEditor === "edit" && editingIndex !== null) {
      setSavedChapters((prev) => prev.map((ch, i) => (i === editingIndex ? { ...ch, ...data } : ch)));
    } else {
      setSavedChapters((prev) => [...prev, { key: newKey(), id: null, ...data, ordre: prev.length + 1 }]);
    }
    setActiveEditor(null);
    setEditingIndex(null);
  };

  const handleEditChapter = (index: number) => {
    setActiveEditor("edit");
    setEditingIndex(index);
  };

  const handleDeleteChapter = (index: number) => {
    setSavedChapters((prev) => prev.filter((_, i) => i !== index).map((ch, i) => ({ ...ch, ordre: i + 1 })));
  };

  const moveChapter = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    setSavedChapters((prev) => {
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next.map((ch, i) => ({ ...ch, ordre: i + 1 }));
    });
  };

  const handleCancelEditor = () => {
    setActiveEditor(null);
    setEditingIndex(null);
  };

  /** Web's uploadPendingFiles — only for files still present in a chapter. */
  const uploadPendingFiles = async (userId: string, contents: string[]) => {
    const fileMap = new Map<string, string>();
    const used = Array.from(pendingFiles.current.values()).filter((f) =>
      contents.some((c) => c.includes(`data-file-id="${f.id}"`))
    );
    await Promise.all(
      used.map(async (file) => {
        let documentType = "documents";
        let mediaType: "DOCUMENT" | "IMAGE" | "VIDEO" = "DOCUMENT";
        if (file.mimeType.startsWith("image/")) {
          documentType = "images";
          mediaType = "IMAGE";
        } else if (file.mimeType.startsWith("video/")) {
          documentType = "videos";
          mediaType = "VIDEO";
        }
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const uniqueFileName = `${Date.now()}_${cleanFileName}`;
        const storedUrl = await mediaService.uploadFile(
          { uri: file.uri, mimeType: file.mimeType, name: uniqueFileName },
          userId,
          mediaType,
          documentType
        );
        const relative = toRelativePath(storedUrl);
        const filePath =
          relative && relative.startsWith("users/")
            ? relative
            : `users/${userId}/${mediaType.toLowerCase()}/${documentType}/${uniqueFileName}`;
        let url = "";
        try {
          url = await mediaService.getContentUrlByPath(filePath);
        } catch {
          url = "";
        }
        fileMap.set(file.id, url || storedUrl);
      })
    );
    return fileMap;
  };

  const onSubmit = async () => {
    setSubmitted(true);
    setSubmitError("");
    if (!titre.trim() || !description.trim() || selectedMatiereIds.length === 0) return;

    setIsSubmitting(true);
    try {
      if (savedChapters.length === 0) throw new Error("Au moins un chapitre est requis");
      if (selectedMatiereIds.length === 0) throw new Error("Au moins une matière est requise");
      const professorId = user?.userId;
      if (!professorId) throw new Error("ID du professeur non trouvé");

      // Upload all pending files first
      let fileUrlMap = new Map<string, string>();
      if (pendingFiles.current.size > 0) {
        fileUrlMap = await uploadPendingFiles(
          String(professorId),
          savedChapters.map((c) => c.contenu)
        );
      }

      const chapitres = savedChapters.map((chapitre, index) => ({
        titre: chapitre.titre,
        description: chapitre.description || "",
        ordre: index + 1,
        contenu: fileUrlMap.size > 0 ? updateContentWithUploadedFiles(chapitre.contenu, fileUrlMap) : chapitre.contenu,
      }));

      const courseData = {
        titre,
        description,
        etat: editMode ? etat || "BROUILLON" : "BROUILLON",
        restriction: restriction || "PRIVE",
        references: references || "",
        redacteurId: String(professorId),
        matieres: selectedMatiereIds.map((id) => ({ id: String(id) })),
        chapitres,
      };

      const saved =
        editMode && editingCours
          ? await coursService.update(editingCours.id, courseData)
          : await coursService.create(courseData);

      pendingFiles.current.clear();
      setShowSuccess(true);

      const uiCours: Cours = {
        id: saved?.id ?? editingCours?.id ?? "",
        titre: saved?.titre ?? titre,
        description: saved?.description ?? description,
        dateCreation: saved?.dateCreation ?? editingCours?.dateCreation ?? new Date().toISOString(),
        etat: saved?.etat ?? courseData.etat,
        references: courseData.references,
        restriction: courseData.restriction,
        chapitres: chapitres.map((c) => c.titre),
        chapitresDetailles: chapitres.map(
          (c, i): Chapitre => ({
            id: savedChapters[i].id ?? savedChapters[i].key,
            title: c.titre,
            description: c.description,
            content: c.contenu,
            images: [] as ChapitreImage[],
            links: [],
            isExpanded: false,
          })
        ),
        matieres: subjects.filter((s) => selectedMatiereIds.includes(String(s.id))).map((s) => s.nom ?? ""),
        redacteurId: String(professorId),
      };
      timers.current.push(setTimeout(() => onCreateCours(uiCours), 2000));
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const submitDisabled = savedChapters.length === 0 || isSubmitting;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.flex}
          // The footer nav floats over the page (≈70px bar + raised centre
          // button + the system nav inset), so clear it plus some breathing room.
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
              <FontAwesome5 name="arrow-left" size={13} color={palette.indigoText} />
              <Text style={styles.backBtnText}>Retour</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.pageTitle}>{editMode ? "Modifier le cours" : "Créer un nouveau cours"}</Text>
              <Text style={styles.pageSubtitle}>
                {editMode
                  ? "Modifiez et organisez votre contenu pédagogique"
                  : "Créez et organisez votre contenu pédagogique"}
              </Text>
            </View>
          </View>

          {submitError ? (
            <View style={styles.errorBox}>
              <FontAwesome5 name="exclamation-circle" size={14} color={palette.errorText} style={{ marginTop: 2 }} />
              <Text style={styles.errorBoxText}>{submitError}</Text>
            </View>
          ) : null}

          {loadingExisting ? (
            <LoadingSpinner label="Chargement du cours..." />
          ) : (
            <>
              {/* General Information */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <FontAwesome5 name="book-open" size={16} color="#4F46E5" />
                  <Text style={styles.cardTitle}>Informations générales</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Titre du cours *</Text>
                  <FormInput
                    styles={styles}
                    palette={palette}
                    error={!!errors.titre}
                    value={titre}
                    onChangeText={setTitre}
                    placeholder="Introduction à la programmation"
                  />
                  <FieldError message={errors.titre} styles={styles} color={palette.errorText} />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Visibilité *</Text>
                  <RestrictionPicker value={restriction} onChange={setRestriction} styles={styles} palette={palette} />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Description du cours *</Text>
                  <FormInput
                    styles={styles}
                    palette={palette}
                    error={!!errors.description}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Décrivez le contenu général de ce cours..."
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={{ minHeight: 88 }}
                  />
                  <FieldError message={errors.description} styles={styles} color={palette.errorText} />
                </View>

                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <FontAwesome5 name="user-friends" size={13} color="#4F46E5" />
                    <Text style={[styles.label, styles.labelInRow]}>Matières associées *</Text>
                  </View>
                  <MatieresMultiSelect
                    options={subjects}
                    selected={selectedMatiereIds}
                    onChange={setSelectedMatiereIds}
                    placeholder="Sélectionnez les matières..."
                    error={!!errors.matieres}
                    styles={styles}
                    palette={palette}
                  />
                  <FieldError message={errors.matieres} styles={styles} color={palette.errorText} />
                </View>

                <View style={[styles.field, { marginBottom: 0 }]}>
                  <View style={styles.labelRow}>
                    <FontAwesome5 name="file-alt" size={13} color="#4F46E5" />
                    <Text style={[styles.label, styles.labelInRow]}>Références</Text>
                  </View>
                  <FormInput
                    styles={styles}
                    palette={palette}
                    value={references}
                    onChangeText={setReferences}
                    placeholder="Livres, articles, liens utiles..."
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    style={{ minHeight: 64 }}
                  />
                </View>
              </View>

              {/* Chapters Section */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <FontAwesome5 name="file-alt" size={16} color="#4F46E5" />
                  <Text style={styles.cardTitle}>Chapitres du cours * ({savedChapters.length})</Text>
                </View>
                {!activeEditor && (
                  <TouchableOpacity style={styles.newChapterBtn} onPress={() => setActiveEditor("create")} activeOpacity={0.85}>
                    <FontAwesome5 name="plus" size={13} color="#FFFFFF" />
                    <Text style={styles.newChapterText}>Nouveau chapitre</Text>
                  </TouchableOpacity>
                )}

                {activeEditor && (
                  <ChapterEditor
                    key={activeEditor === "edit" ? `edit-${editingIndex}` : "create"}
                    mode={activeEditor}
                    initialData={activeEditor === "edit" && editingIndex !== null ? savedChapters[editingIndex] : null}
                    totalChapters={savedChapters.length}
                    onSave={handleSaveChapter}
                    onCancel={handleCancelEditor}
                    onFileAdd={handleFileAdd}
                    styles={styles}
                    palette={palette}
                    isDark={isDark}
                  />
                )}

                <View style={{ gap: 12 }}>
                  {savedChapters.map((chapter, index) => (
                    <ChapterCard
                      key={chapter.key}
                      chapter={chapter}
                      index={index}
                      onEdit={() => handleEditChapter(index)}
                      onDelete={() => handleDeleteChapter(index)}
                      onMoveUp={() => moveChapter(index, "up")}
                      onMoveDown={() => moveChapter(index, "down")}
                      canMoveUp={index > 0}
                      canMoveDown={index < savedChapters.length - 1}
                      loading={isSubmitting}
                      styles={styles}
                      palette={palette}
                    />
                  ))}
                </View>

                {savedChapters.length === 0 && !activeEditor && (
                  <View style={styles.emptyChapters}>
                    <FontAwesome5 name="file-alt" size={44} color={palette.muted} />
                    <Text style={styles.emptyText}>Aucun chapitre ajouté</Text>
                    <TouchableOpacity onPress={() => setActiveEditor("create")}>
                      <Text style={styles.emptyLink}>Créer votre premier chapitre</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onBack} activeOpacity={0.85}>
                  <FontAwesome5 name="arrow-left" size={14} color={palette.indigoText} />
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onSubmit}
                  disabled={submitDisabled}
                  activeOpacity={0.85}
                  style={[styles.submitWrap, submitDisabled && { opacity: 0.7 }]}
                >
                  <LinearGradient colors={["#4F46E5", "#9333EA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                    {isSubmitting ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.submitText}>Traitement...</Text>
                      </>
                    ) : (
                      <>
                        <FontAwesome5 name="save" size={14} color="#FFFFFF" />
                        <Text style={styles.submitText}>{editMode ? "Modifier le cours" : "Créer le cours"}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success toast (web's SuccessModal) */}
      {showSuccess && (
        <View style={styles.toast}>
          <View style={styles.toastDot} />
          <Text style={styles.toastText}>{editMode ? "Cours modifié avec succès !" : "Cours créé avec succès !"}</Text>
          <TouchableOpacity onPress={() => setShowSuccess(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/** Union by id, keeping `base` order — so edit-mode matières always have a chip. */
const mergeMatieres = (base: Matiere[], extra: Matiere[]) => {
  const ids = new Set(base.map((m) => String(m.id)));
  return [...base, ...extra.filter((m) => m && !ids.has(String(m.id)))];
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    // Rendered under AppHeader (which owns the status bar) — normal top spacing only.
    scrollContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 180 },
    rowCenter: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },

    // Header
    header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: p.indigoSoft,
      borderWidth: 1,
      borderColor: p.indigoSoftBorder,
    },
    backBtnText: { fontSize: 13, fontWeight: "700", color: p.indigoText },
    pageTitle: { fontSize: 20, fontWeight: "800", color: p.title, lineHeight: 25 },
    pageSubtitle: { fontSize: 13, color: p.body, marginTop: 2 },

    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: p.errorBg,
      borderWidth: 1,
      borderColor: p.errorBorder,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorBoxText: { flex: 1, fontSize: 13, color: p.errorText },

    // Cards
    card: {
      backgroundColor: p.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.cardBorder,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 },
    cardTitle: { fontSize: 17, fontWeight: "700", color: p.title, flexShrink: 1 },

    // Fields
    field: { marginBottom: 18 },
    label: { fontSize: 14, fontWeight: "700", color: p.label, marginBottom: 8 },
    labelMd: { fontSize: 14, fontWeight: "600", color: p.label, marginBottom: 8 },
    labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    labelInRow: { marginBottom: 0 },
    input: {
      backgroundColor: p.input,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 15,
      color: p.title,
    },
    inputFocused: { borderColor: "#6366F1", borderWidth: 1.5 },
    inputError: { borderColor: p.errorInputBorder, backgroundColor: p.errorBg },
    fieldError: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    fieldErrorText: { fontSize: 13, color: p.errorText, flexShrink: 1 },

    selectField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    selectFieldText: { fontSize: 15, color: p.title },
    sheetOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.cardBorder,
    },
    sheetOptionText: { fontSize: 15, color: p.title, flexShrink: 1 },
    sheetOptionTextActive: { color: "#4F46E5", fontWeight: "700" },

    // Matières multi-select
    dropdown: {
      marginTop: 4,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 12,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    dropdownHint: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, color: p.muted, textAlign: "center" },
    dropdownEmpty: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: p.sub, textAlign: "center" },
    dropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    dropdownItemSelected: { backgroundColor: p.indigoSoft },
    dropdownItemText: { fontSize: 15, color: p.label, flexShrink: 1 },
    dropdownItemTextSelected: { color: p.chipText, fontWeight: "600" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: p.chipBg,
    },
    chipText: { fontSize: 13, color: p.chipText },

    // Chapters
    newChapterBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#4F46E5",
      borderRadius: 10,
      paddingVertical: 11,
      marginTop: -6,
      marginBottom: 16,
    },
    newChapterText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
    chapterCard: {
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.cardBorder,
      borderRadius: 10,
      padding: 12,
    },
    chapterCardRow: { flexDirection: "row", alignItems: "flex-start" },
    chapterBadge: {
      alignSelf: "flex-start",
      backgroundColor: p.chipBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 8,
    },
    chapterBadgeText: { fontSize: 11, fontWeight: "600", color: p.chipText },
    chapterTitle: { fontSize: 14, fontWeight: "700", color: p.title, marginBottom: 4 },
    chapterDesc: { fontSize: 12, color: p.body, marginBottom: 6 },
    chapterPreview: { fontSize: 12, color: p.sub },
    chapterActions: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 8 },
    iconBtn: { padding: 7, borderRadius: 6 },
    chapterLoading: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyChapters: { alignItems: "center", paddingVertical: 28 },
    emptyText: { fontSize: 14, color: p.sub, marginTop: 14, marginBottom: 12 },
    emptyLink: { fontSize: 14, fontWeight: "600", color: "#4F46E5" },

    // Chapter editor
    chapterEditor: {
      backgroundColor: p.card,
      borderWidth: 2,
      borderColor: p.indigoSoftBorder,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    chapterEditorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    chapterEditorTitle: { fontSize: 16, fontWeight: "700", color: p.title, flexShrink: 1 },
    chapterEditorActions: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 4 },
    editorCancelBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 10,
    },
    editorCancelText: { fontSize: 14, fontWeight: "600", color: p.body },
    editorSaveBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: "#4F46E5",
    },
    editorSaveText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

    // Rich text editor
    editorBox: { borderWidth: 1, borderColor: p.inputBorder, borderRadius: 10, overflow: "hidden", backgroundColor: p.input },
    pendingBox: {
      backgroundColor: "#EFF6FF",
      borderBottomWidth: 1,
      borderBottomColor: "#BFDBFE",
      padding: 10,
      gap: 6,
    },
    pendingHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    pendingTitle: { fontSize: 13, fontWeight: "600", color: "#1E40AF" },
    pendingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    pendingNameRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
    pendingName: { flex: 1, fontSize: 13, color: "#334155" },
    toolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 2,
      padding: 6,
      backgroundColor: p.toolbar,
      borderBottomWidth: 1,
      borderBottomColor: p.inputBorder,
    },
    toolBtn: { minWidth: 32, height: 32, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", borderRadius: 6 },
    toolText: { fontSize: 15, color: p.body },
    toolSmall: { fontSize: 12, color: p.body },
    toolRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    toolDivider: { width: 1, height: 20, backgroundColor: p.divider, marginHorizontal: 3 },
    webview: { height: 220, backgroundColor: p.input },

    // Restriction picker
    restrictionRow: { flexDirection: "row", gap: 10 },
    restrictionCard: {
      flex: 1,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: p.inputBorder,
      backgroundColor: p.input,
    },
    restrictionCardActive: { borderColor: "#6366F1", backgroundColor: p.indigoSoft },
    restrictionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    restrictionIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.toolbar,
    },
    restrictionIconActive: { backgroundColor: "#4F46E5" },
    radioOuter: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: p.divider,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOuterActive: { borderColor: "#4F46E5" },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4F46E5" },
    restrictionLabel: { fontSize: 14, fontWeight: "700", color: p.title },
    restrictionLabelActive: { color: p.indigoText },
    restrictionHint: { fontSize: 11, color: p.sub, marginTop: 2, lineHeight: 15 },

    // Actions
    actions: { gap: 12, paddingTop: 8 },
    cancelBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: p.indigoSoft,
      borderWidth: 1,
      borderColor: p.indigoSoftBorder,
    },
    cancelBtnText: { fontSize: 15, fontWeight: "700", color: p.indigoText },
    submitWrap: {
      borderRadius: 12,
      shadowColor: "#4F46E5",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    submitText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

    // Toast
    toast: {
      position: "absolute",
      top: 12,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "#22C55E",
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
    toastText: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  });

type Styles = ReturnType<typeof createStyles>;

export default CreateCoursBody;
