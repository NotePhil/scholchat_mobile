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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chapitre, ChapitreImage, Cours } from "./DashboardCoursBody";
import { useUser } from "../../../../context/UserContext";
import { coursService, matiereService, mediaService } from "../../../../services/api";
import { LoadingSpinner } from "../../../../components/ui";
import ChapterRichEditor, {
  ChapterEditorScrollApi,
  ChapterEditorScrollContext,
  ChapterToolbarDock,
  PendingFile,
  UploadedFileInfo,
  isRichHtmlEmpty,
  updateContentWithUploadedFiles,
} from "./ChapterRichEditor";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { environment } from "../../../../environment/environment";
import { Matiere } from "../../../../types";
import { TranslationKey, translate, useT } from "../../../../i18n";

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
 * editor), so the mobile chapter editor (ChapterRichEditor) is a WebView
 * contentEditable producing web's exact markup.
 */

type RestrictionValue = "PRIVE" | "PUBLIC";

// Backend: PUBLIC courses show up in every user's accessible list
// (CoursRepository: restriction = 'PUBLIC' OR redacteur = user), PRIVE only
// in the author's.
// Labels/hints are i18n keys, translated at render time.
const RESTRICTION_OPTIONS: { value: RestrictionValue; labelKey: TranslationKey; hintKey: TranslationKey; icon: string }[] = [
  { value: "PRIVE", labelKey: "courseForm.restriction.priveLabel", hintKey: "courseForm.restriction.priveHint", icon: "lock" },
  { value: "PUBLIC", labelKey: "courseForm.restriction.publicLabel", hintKey: "courseForm.restriction.publicHint", icon: "globe-africa" },
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
}) => {
  const { t } = useT();
  return (
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
          <Text style={[styles.restrictionLabel, active && styles.restrictionLabelActive]}>{t(opt.labelKey)}</Text>
          <Text style={styles.restrictionHint}>{t(opt.hintKey)}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
  );
};

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

interface CreateCoursBodyProps {
  onBack: () => void;
  onCreateCours: (cours: Cours) => void;
  editingCours?: Cours | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const newKey = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

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
  const { t } = useT();
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
        onChangeText={(text) => {
          setQuery(text);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setIsOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setIsOpen(false), 150);
        }}
        placeholder={selected.length === 0 ? placeholder : t("courseForm.matieres.addPlaceholder")}
      />

      {isOpen && (
        <View style={styles.dropdown}>
          {q === "" ? (
            <Text style={styles.dropdownHint}>{t("courseForm.matieres.searchHint")}</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.dropdownEmpty}>
              {options.length === 0 ? t("courseForm.matieres.noneAvailable") : t("courseForm.matieres.noResults")}
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
}) => {
  const { t } = useT();
  return (
  <View style={[styles.chapterCard, loading && { opacity: 0.5 }]} pointerEvents={loading ? "none" : "auto"}>
    <View style={styles.chapterCardRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.chapterBadge}>
          <Text style={styles.chapterBadgeText}>{t("courseForm.chapterCard.badge", { number: index + 1 })}</Text>
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
          <TouchableOpacity style={styles.iconBtn} onPress={onMoveUp} accessibilityLabel={t("courseForm.chapterCard.moveUp")}>
            <FontAwesome5 name="chevron-up" size={13} color={palette.muted} />
          </TouchableOpacity>
        )}
        {canMoveDown && (
          <TouchableOpacity style={styles.iconBtn} onPress={onMoveDown} accessibilityLabel={t("courseForm.chapterCard.moveDown")}>
            <FontAwesome5 name="chevron-down" size={13} color={palette.muted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconBtn} onPress={onEdit} accessibilityLabel={t("courseForm.chapterCard.edit")}>
          <FontAwesome5 name="pen" size={12} color={palette.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityLabel={t("courseForm.chapterCard.delete")}
          onPress={() =>
            Alert.alert(t("courseForm.chapterCard.deleteConfirmTitle"), t("courseForm.chapterCard.deleteConfirmMessage"), [
              { text: t("courseForm.chapterCard.cancel"), style: "cancel" },
              { text: t("courseForm.chapterCard.delete"), style: "destructive", onPress: onDelete },
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
};

const ChapterEditor = ({
  mode,
  initialData,
  totalChapters,
  onSave,
  onCancel,
  onFileAdd,
  pendingFiles,
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
  pendingFiles: Map<string, PendingFile>;
  styles: Styles;
  palette: Palette;
  isDark: boolean;
}) => {
  const { t } = useT();
  const [formData, setFormData] = useState<ChapterDraft>(() => ({
    titre: initialData?.titre ?? "",
    description: initialData?.description ?? "",
    contenu: initialData?.contenu ?? "",
    ordre: initialData?.ordre || (mode === "create" ? totalChapters + 1 : 0),
  }));
  const [errors, setErrors] = useState<{ titre?: string; contenu?: string }>({});

  const validateForm = () => {
    const next: { titre?: string; contenu?: string } = {};
    if (!formData.titre.trim()) next.titre = t("courseForm.validation.titleRequired");
    if (isRichHtmlEmpty(formData.contenu)) next.contenu = t("courseForm.validation.contentRequired");
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
            {mode === "create"
              ? t("courseForm.chapterEditor.titleCreate", { number: chapterNumber })
              : t("courseForm.chapterEditor.titleEdit", { number: chapterNumber })}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.iconBtn} accessibilityLabel={t("courseForm.chapterEditor.cancel")}>
          <FontAwesome5 name="times-circle" size={17} color={palette.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.labelMd}>{t("courseForm.chapterEditor.titleLabel")}</Text>
        <FormInput
          styles={styles}
          palette={palette}
          error={!!errors.titre}
          value={formData.titre}
          onChangeText={(text) => setFormData((p) => ({ ...p, titre: text }))}
          placeholder={t("courseForm.chapterEditor.titlePlaceholder")}
        />
        <FieldError message={errors.titre} styles={styles} color={palette.errorText} />
      </View>

      <View style={styles.field}>
        <Text style={styles.labelMd}>{t("courseForm.chapterEditor.descriptionLabel")}</Text>
        <FormInput
          styles={styles}
          palette={palette}
          value={formData.description}
          onChangeText={(text) => setFormData((p) => ({ ...p, description: text }))}
          placeholder={t("courseForm.chapterEditor.descriptionPlaceholder")}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          style={{ minHeight: 64 }}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.labelMd}>{t("courseForm.chapterEditor.contentLabel")}</Text>
        <ChapterRichEditor
          value={formData.contenu}
          onChange={(html) => setFormData((p) => ({ ...p, contenu: html }))}
          placeholder={t("courseForm.chapterEditor.contentPlaceholder")}
          onFileAdd={onFileAdd}
          pendingFiles={pendingFiles}
          isDark={isDark}
          error={!!errors.contenu}
        />
        <FieldError message={errors.contenu} styles={styles} color={palette.errorText} />
      </View>

      <View style={styles.chapterEditorActions}>
        <TouchableOpacity style={styles.editorCancelBtn} onPress={onCancel}>
          <Text style={styles.editorCancelText}>{t("courseForm.chapterEditor.cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editorSaveBtn} onPress={handleSave}>
          <FontAwesome5 name="save" size={14} color="#FFFFFF" />
          <Text style={styles.editorSaveText}>{mode === "create" ? t("courseForm.chapterEditor.add") : t("courseForm.chapterEditor.save")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Main screen ─────────────────────────────────────────────────────────────

const CreateCoursBody = ({ onBack, onCreateCours, editingCours }: CreateCoursBodyProps) => {
  const { user } = useUser();
  const { t } = useT();
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
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number; percent: number; name: string } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const pendingFiles = useRef(new Map<string, PendingFile>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Lets the chapter editor keep its caret visible above the docked toolbar.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const scrollTop = useRef(0);
  const scrollApi = useMemo<ChapterEditorScrollApi>(
    () => ({
      scrollBy: (dy) => {
        const y = Math.max(0, scrollY.current + dy);
        scrollY.current = y;
        scrollRef.current?.scrollTo({ y, animated: true });
      },
      getViewportTop: () => scrollTop.current,
    }),
    []
  );

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
        if (!cancelled) setSubmitError(err instanceof Error ? err.message : translate("courseForm.errors.loadFailed"));
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
    if (!titre.trim()) e.titre = t("courseForm.validation.titleRequired");
    if (!description.trim()) e.description = t("courseForm.validation.descriptionRequired");
    if (selectedMatiereIds.length === 0) e.matieres = t("courseForm.validation.matiereRequired");
    return e;
  }, [submitted, titre, description, selectedMatiereIds, t]);

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

  /**
   * Web's uploadPendingFiles — only the files still present in a chapter, in
   * parallel, through XMLHttpRequest (Expo's fetch can't send RN files) with a
   * byte-weighted overall progress.
   */
  const uploadPendingFiles = async (userId: string, contents: string[]) => {
    const fileMap = new Map<string, UploadedFileInfo>();
    const used = Array.from(pendingFiles.current.values()).filter((f) =>
      contents.some((c) => c.includes(`data-file-id="${f.id}"`))
    );
    if (used.length === 0) return fileMap;
    const sizeOf = (f: PendingFile) => (f.size && f.size > 0 ? f.size : 1);
    const totalBytes = used.reduce((n, f) => n + sizeOf(f), 0) || 1;
    const loaded = new Map<string, number>();
    let done = 0;
    const report = (name: string) =>
      setUploadProgress({
        done,
        total: used.length,
        name,
        percent: Math.min(100, Math.round((Array.from(loaded.values()).reduce((n, v) => n + v, 0) / totalBytes) * 100)),
      });
    report(used[0].name);
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
        try {
          const ref = await mediaService.uploadFileWithPath(
            { uri: file.uri, mimeType: file.mimeType, name: file.name },
            userId,
            mediaType,
            documentType,
            (fraction) => {
              loaded.set(file.id, fraction * sizeOf(file));
              report(file.name);
            }
          );
          loaded.set(file.id, sizeOf(file));
          done += 1;
          report(file.name);
          const filePath = ref.filePath || toRelativePath(ref.url);
          let url = "";
          try {
            url = await mediaService.getContentUrlByPath(filePath);
          } catch {
            url = "";
          }
          fileMap.set(file.id, { url: url || ref.url, name: file.name, type: file.mimeType, size: file.size });
        } catch (err) {
          throw new Error(
            t("courseForm.errors.uploadFailed", {
              name: file.name,
              reason: err instanceof Error && err.message ? err.message : t("courseForm.errors.networkError"),
            })
          );
        }
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
      if (savedChapters.length === 0) throw new Error(t("courseForm.validation.chapterRequired"));
      if (selectedMatiereIds.length === 0) throw new Error(t("courseForm.validation.matiereRequired"));
      const professorId = user?.userId;
      if (!professorId) throw new Error(t("courseForm.errors.professorNotFound"));

      // Upload all pending files first
      let fileUrlMap = new Map<string, UploadedFileInfo>();
      if (pendingFiles.current.size > 0) {
        fileUrlMap = await uploadPendingFiles(
          String(professorId),
          savedChapters.map((c) => c.contenu)
        );
      }

      const chapitres = savedChapters.map((chapitre, index) => ({
        // Keep the id so the backend updates the chapter in place (students' progress survives edits)
        id: chapitre.id ?? undefined,
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
      setSubmitError(err instanceof Error && err.message ? err.message : t("courseForm.errors.saveFailed"));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const submitDisabled = savedChapters.length === 0 || isSubmitting;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ChapterEditorScrollContext.Provider value={scrollApi}>
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
          onLayout={(e) => {
            const target = e.currentTarget as unknown as View;
            target?.measureInWindow?.((_x: number, y: number) => {
              scrollTop.current = y;
            });
          }}
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
              <Text style={styles.backBtnText}>{t("courseForm.header.back")}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.pageTitle}>{editMode ? t("courseForm.header.titleEdit") : t("courseForm.header.titleCreate")}</Text>
              <Text style={styles.pageSubtitle}>
                {editMode
                  ? t("courseForm.header.subtitleEdit")
                  : t("courseForm.header.subtitleCreate")}
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
            <LoadingSpinner label={t("courseForm.loading")} />
          ) : (
            <>
              {/* General Information */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <FontAwesome5 name="book-open" size={16} color="#4F46E5" />
                  <Text style={styles.cardTitle}>{t("courseForm.general.title")}</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t("courseForm.general.titleLabel")}</Text>
                  <FormInput
                    styles={styles}
                    palette={palette}
                    error={!!errors.titre}
                    value={titre}
                    onChangeText={setTitre}
                    placeholder={t("courseForm.general.titlePlaceholder")}
                  />
                  <FieldError message={errors.titre} styles={styles} color={palette.errorText} />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t("courseForm.general.visibilityLabel")}</Text>
                  <RestrictionPicker value={restriction} onChange={setRestriction} styles={styles} palette={palette} />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t("courseForm.general.descriptionLabel")}</Text>
                  <FormInput
                    styles={styles}
                    palette={palette}
                    error={!!errors.description}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t("courseForm.general.descriptionPlaceholder")}
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
                    <Text style={[styles.label, styles.labelInRow]}>{t("courseForm.general.matieresLabel")}</Text>
                  </View>
                  <MatieresMultiSelect
                    options={subjects}
                    selected={selectedMatiereIds}
                    onChange={setSelectedMatiereIds}
                    placeholder={t("courseForm.general.matieresPlaceholder")}
                    error={!!errors.matieres}
                    styles={styles}
                    palette={palette}
                  />
                  <FieldError message={errors.matieres} styles={styles} color={palette.errorText} />
                </View>

                <View style={[styles.field, { marginBottom: 0 }]}>
                  <View style={styles.labelRow}>
                    <FontAwesome5 name="file-alt" size={13} color="#4F46E5" />
                    <Text style={[styles.label, styles.labelInRow]}>{t("courseForm.general.referencesLabel")}</Text>
                  </View>
                  <FormInput
                    styles={styles}
                    palette={palette}
                    value={references}
                    onChangeText={setReferences}
                    placeholder={t("courseForm.general.referencesPlaceholder")}
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
                  <Text style={styles.cardTitle}>{t("courseForm.chapters.sectionTitle", { count: savedChapters.length })}</Text>
                </View>
                {!activeEditor && (
                  <TouchableOpacity style={styles.newChapterBtn} onPress={() => setActiveEditor("create")} activeOpacity={0.85}>
                    <FontAwesome5 name="plus" size={13} color="#FFFFFF" />
                    <Text style={styles.newChapterText}>{t("courseForm.chapters.newChapter")}</Text>
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
                    pendingFiles={pendingFiles.current}
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
                    <Text style={styles.emptyText}>{t("courseForm.chapters.empty")}</Text>
                    <TouchableOpacity onPress={() => setActiveEditor("create")}>
                      <Text style={styles.emptyLink}>{t("courseForm.chapters.createFirst")}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {uploadProgress && isSubmitting ? (
                <View style={styles.uploadBox} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: uploadProgress.percent }}>
                  <View style={styles.uploadHead}>
                    <Text style={styles.uploadText} numberOfLines={1}>
                      {t("courseForm.upload.progress", {
                        done: uploadProgress.done,
                        total: uploadProgress.total,
                        name: uploadProgress.name,
                      })}
                    </Text>
                    <Text style={styles.uploadPct}>{uploadProgress.percent}%</Text>
                  </View>
                  <View style={styles.uploadTrack}>
                    <View style={[styles.uploadFill, { width: `${uploadProgress.percent}%` }]} />
                  </View>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onBack} activeOpacity={0.85}>
                  <FontAwesome5 name="arrow-left" size={14} color={palette.indigoText} />
                  <Text style={styles.cancelBtnText}>{t("courseForm.actions.cancel")}</Text>
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
                        <Text style={styles.submitText}>
                          {uploadProgress && uploadProgress.done < uploadProgress.total ? t("courseForm.actions.sending", { percent: uploadProgress.percent }) : t("courseForm.actions.processing")}
                        </Text>
                      </>
                    ) : (
                      <>
                        <FontAwesome5 name="save" size={14} color="#FFFFFF" />
                        <Text style={styles.submitText}>{editMode ? t("courseForm.actions.submitEdit") : t("courseForm.actions.submitCreate")}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
        </ChapterEditorScrollContext.Provider>
        {/* Formatting bar of the focused chapter editor, pinned above the keyboard. */}
        <ChapterToolbarDock />
      </KeyboardAvoidingView>

      {/* Success toast (web's SuccessModal) */}
      {showSuccess && (
        <View style={styles.toast}>
          <View style={styles.toastDot} />
          <Text style={styles.toastText}>{editMode ? t("courseForm.toast.updated") : t("courseForm.toast.created")}</Text>
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

    // File upload progress (submit)
    uploadBox: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: p.indigoSoftBorder,
      backgroundColor: p.indigoSoft,
      gap: 8,
    },
    uploadHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    uploadText: { flex: 1, fontSize: 12, color: p.indigoText },
    uploadPct: { fontSize: 12, fontWeight: "700", color: p.indigoText },
    uploadTrack: { height: 6, borderRadius: 3, backgroundColor: p.cardBorder, overflow: "hidden" },
    uploadFill: { height: 6, borderRadius: 3, backgroundColor: "#4F46E5" },

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
