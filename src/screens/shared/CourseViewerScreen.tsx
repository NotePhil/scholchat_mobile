import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../styles/theme";
import { useThemeStore } from "../../store/useThemeStore";
import { useUser } from "../../context/UserContext";
import { useT } from "../../i18n";
import { coursService, liveSessionService, mediaService } from "../../services/api";
import { Chapitre, Cours } from "../../types";
import CourseRichContent, {
  ChapterFile,
  ChapterFileType,
  extractChapterFiles,
  resolveChapterHtml,
} from "./CourseRichContent";
import { useFileOpener } from "../../hooks/useFileOpener";
import { extensionOf } from "../../services/fileOpener";

export interface CourseViewerParams {
  coursId: string;
  /** The scheduled occurrence the reader came from (informational). */
  coursProgrammeId?: string;
  /** Whose progress is shown — defaults to the signed-in user (a parent passes the child). */
  learnerId?: string;
  /** Progress is shown but chapters can't be marked done (parent viewing a child). */
  readOnlyProgress?: boolean;
}

interface Progression {
  pourcentage: number;
  chapitresCompletesIds: string[];
  chapitresCompletes?: number;
  totalChapitres?: number;
}

interface GeneralFile {
  id: string;
  fileName: string;
  url: string;
  mediaId?: string;
  contentType?: string;
  type: ChapterFileType;
  fileSize: number;
}

/** MIME hint for a file whose name carries no extension (so the viewer/chooser still knows its type). */
const contentTypeHint = (type: ChapterFileType, fileName: string, contentType?: string) => {
  if (contentType) return contentType;
  if (extensionOf(fileName)) return undefined;
  return type === "pdf" ? "application/pdf" : type === "image" ? "image/jpeg" : type === "video" ? "video/mp4" : undefined;
};

const fileTypeOf = (contentType?: string, fileName?: string): ChapterFileType => {
  if (contentType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName ?? "")) return "image";
  if (contentType?.startsWith("video/") || /\.(mp4|avi|mov|webm)$/i.test(fileName ?? "")) return "video";
  if (contentType?.includes("pdf") || /\.pdf$/i.test(fileName ?? "")) return "pdf";
  return "document";
};

const FILE_ICON: Record<ChapterFileType, string> = {
  image: "image",
  video: "video",
  pdf: "file-pdf",
  document: "file-alt",
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
};

/**
 * Full-screen course page — port of web's InterfaceCours/CourseDetailsView.jsx
 * (what a student/parent sees after opening a course from "Cours Programmés"):
 * hero (restriction/state badges, title, description, chapter & file counts),
 * course progress, expandable chapters with their rich HTML content, per-chapter
 * resources, "mark as done", and the course's general resources. A live-session
 * banner with "Rejoindre" appears whenever the course has an active session.
 */
const CourseViewerScreen = () => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode) === "dark";
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useT();
  const { user } = useUser();
  const params = (route.params ?? {}) as CourseViewerParams;
  const coursId = params.coursId;
  const learnerId = params.learnerId ?? user?.userId;
  const canMark = !params.readOnlyProgress && !!learnerId;

  const [course, setCourse] = useState<Cours | null>(null);
  const [chapters, setChapters] = useState<Chapitre[]>([]);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [chapterFiles, setChapterFiles] = useState<Record<string, ChapterFile[]>>({});
  const [generalFiles, setGeneralFiles] = useState<GeneralFile[]>([]);
  const [progression, setProgression] = useState<Progression>({ pourcentage: 0, chapitresCompletesIds: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [contentsLoading, setContentsLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const fileOpener = useFileOpener();
  const opening = fileOpener.openingKey;
  const [liveActive, setLiveActive] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const chapterY = useRef<Record<string, number>>({});
  const listY = useRef(0);

  const chapterKey = (ch: Chapitre, idx: number) => ch.id || `ch_${idx + 1}`;

  const fetchProgression = useCallback(async () => {
    if (!coursId || !learnerId) return;
    try {
      const data = (await coursService.getProgression(coursId, learnerId)) as Partial<Progression>;
      setProgression({
        pourcentage: Math.round(Number(data?.pourcentage ?? 0)),
        chapitresCompletesIds: (data?.chapitresCompletesIds as string[]) ?? [],
        chapitresCompletes: data?.chapitresCompletes as number | undefined,
        totalChapitres: data?.totalChapitres as number | undefined,
      });
    } catch {
      /* web: progression is best-effort */
    }
  }, [coursId, learnerId]);

  const checkLive = useCallback(async () => {
    if (!coursId) return;
    try {
      const session = await liveSessionService.getActiveSession(coursId);
      setLiveActive(!!session?.sessionId);
    } catch {
      setLiveActive(false);
    }
  }, [coursId]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!coursId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const data = await coursService.getWithChapitres(coursId);
        const sorted = [...(data.chapitres ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
        setCourse(data);
        setChapters(sorted);
        fetchProgression();

        setContentsLoading(true);
        const cache = new Map<string, string>();
        const processed: Record<string, string> = {};
        const files: Record<string, ChapterFile[]> = {};
        await Promise.all(
          sorted.map(async (ch, idx) => {
            const key = chapterKey(ch, idx);
            if (!ch.contenu) return;
            try {
              processed[key] = await resolveChapterHtml(ch.contenu, data.redacteurId, cache);
            } catch {
              processed[key] = ch.contenu;
            }
            files[key] = extractChapterFiles(processed[key], key);
          })
        );
        setContents(processed);
        setChapterFiles(files);
        setContentsLoading(false);

        mediaService
          .getByCours(coursId)
          .then((media) => {
            setGeneralFiles(
              (Array.isArray(media) ? media : []).map((m: any, i: number) => {
                const fileName = m.fileName || m.originalFileName || `Fichier_${i}`;
                return {
                  id: String(m.id ?? `minio_${i}`),
                  fileName,
                  url: m.filePath || m.objectKey || "",
                  mediaId: m.id ? String(m.id) : undefined,
                  contentType: m.contentType ? String(m.contentType) : undefined,
                  type: fileTypeOf(m.contentType, fileName),
                  fileSize: Number(m.fileSize) || 0,
                };
              })
            );
          })
          .catch(() => setGeneralFiles([]));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("courseViewer.loadFailed"));
        setCourse(null);
        setChapters([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setContentsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coursId, fetchProgression]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Re-check the live session whenever the page regains focus (e.g. back from LiveSession).
  useFocusEffect(
    useCallback(() => {
      checkLive();
    }, [checkLive])
  );

  const completedIds = progression.chapitresCompletesIds ?? [];
  const totalChapters = progression.totalChapitres ?? chapters.length;
  const doneCount = progression.chapitresCompletes ?? chapters.filter((c) => c.id && completedIds.includes(c.id)).length;
  const fileCount = Object.values(chapterFiles).reduce((n, f) => n + f.length, 0) + generalFiles.length;
  const pct = Math.max(0, Math.min(100, progression.pourcentage || 0));

  const restrictionLabel = (r?: string) =>
    r === "PUBLIC" ? t("courseViewer.restrictionPublic") : r === "PRIVE" ? t("courseViewer.restrictionPrivate") : r || t("courseViewer.defaultBadge");
  const stateLabel = (e?: string) => (e === "PUBLIE" ? t("courseViewer.statePublished") : e || t("courseViewer.allLevels"));

  const handleMark = async (ch: Chapitre) => {
    if (!canMark || !ch.id || !coursId || !learnerId || marking) return;
    if (completedIds.includes(ch.id)) return; // the backend only exposes "mark complete"
    setMarking(ch.id);
    try {
      await coursService.markChapterComplete(coursId, ch.id, learnerId);
      await fetchProgression();
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("courseViewer.markFailed"));
    } finally {
      setMarking(null);
    }
  };

  /**
   * Course files open in-app (PDF viewer, zoomable image viewer) or, for any
   * other type, are downloaded and handed to the native "Open with" chooser.
   * Plain web links keep opening in the browser.
   */
  const openFile = (file: { id: string; fileName: string; url: string; type: ChapterFileType; mediaId?: string; contentType?: string }) => {
    const contentType = contentTypeHint(file.type, file.fileName, file.contentType);
    if (file.mediaId) {
      fileOpener.open({ mediaId: file.mediaId, filePath: file.url, fileName: file.fileName, contentType }, file.id);
    } else {
      fileOpener.openLink(file.url, { fileName: file.fileName, contentType }, file.id);
    }
  };

  /** A link tapped inside chapter HTML: reuse the name/type extracted for the resources list when known. */
  const openChapterLink = (url: string) => {
    const known = Object.values(chapterFiles)
      .flat()
      .find((f) => f.url === url);
    if (known) openFile(known);
    else fileOpener.openLink(url, {}, `link:${url}`);
  };

  const goToChapter = (key: string) => {
    setExpandedKey(key);
    requestAnimationFrame(() => {
      const y = chapterY.current[key];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, listY.current + y - 8), animated: true });
    });
  };

  const typeLabel = (type: ChapterFileType) =>
    type === "image"
      ? t("courseViewer.typeImage")
      : type === "video"
        ? t("courseViewer.typeVideo")
        : type === "pdf"
          ? t("courseViewer.typePdf")
          : t("courseViewer.typeDocument");

  const typeColor = (type: ChapterFileType) =>
    type === "image" ? colors.purple : type === "video" ? colors.primary : type === "pdf" ? colors.danger : colors.textMuted;

  const renderFileRow = (file: { id: string; fileName: string; url: string; type: ChapterFileType; mediaId?: string; contentType?: string; fileSize?: number }) => (
    <TouchableOpacity
      key={file.id}
      style={styles.fileRow}
      onPress={() => openFile(file)}
      activeOpacity={0.75}
      accessibilityLabel={`${t("courseViewer.open")} ${file.fileName}`}
    >
      <View style={[styles.fileIcon, { backgroundColor: `${typeColor(file.type)}1A` }]}>
        <FontAwesome5 name={FILE_ICON[file.type]} size={15} color={typeColor(file.type)} />
      </View>
      <View style={styles.fileText}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.fileName || t("courseViewer.unnamedFile")}
        </Text>
        <Text style={styles.fileMeta}>
          {typeLabel(file.type).toUpperCase()}
          {file.fileSize ? ` · ${formatFileSize(file.fileSize)}` : ""}
        </Text>
      </View>
      {opening === file.id ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <FontAwesome5
          name={file.type === "pdf" || file.type === "image" ? "eye" : "external-link-alt"}
          size={13}
          color={colors.primary}
        />
      )}
    </TouchableOpacity>
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel={t("common.back")}>
        <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {course?.titre || t("courseViewer.headerTitle")}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t("courseViewer.loading")}</Text>
        </View>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <FontAwesome5 name="exclamation-triangle" size={32} color={colors.danger} />
          <Text style={styles.centerTitle}>{t("courseViewer.notFound")}</Text>
          <Text style={styles.centerText}>{error || t("courseViewer.loadFailed")}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
            <FontAwesome5 name="redo" size={12} color={colors.white} />
            <Text style={styles.retryText}>{t("courseViewer.retry")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              load(true);
              checkLive();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Live session */}
        {liveActive ? (
          <View style={styles.liveBanner}>
            <View style={styles.liveIcon}>
              <FontAwesome5 name="broadcast-tower" size={15} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.liveTitle}>{t("courseViewer.liveTitle")}</Text>
              <Text style={styles.liveText}>{t("courseViewer.liveText")}</Text>
            </View>
            <TouchableOpacity
              style={styles.liveButton}
              onPress={() => navigation.navigate("LiveSession", { coursId, isHost: false })}
              activeOpacity={0.85}
            >
              <FontAwesome5 name="video" size={12} color={colors.successDark} />
              <Text style={styles.liveButtonText}>{t("courseViewer.join")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.badgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{restrictionLabel(course.restriction).toUpperCase()}</Text>
            </View>
            <View style={[styles.heroBadge, styles.heroBadgeAlt]}>
              <Text style={styles.heroBadgeText}>{stateLabel(course.etat).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{course.titre || t("studentCourses.untitled")}</Text>
          {course.description ? <Text style={styles.heroDescription}>{course.description}</Text> : null}
          <View style={styles.heroChips}>
            <View style={styles.heroChip}>
              <FontAwesome5 name="book-open" size={11} color={colors.white} />
              <Text style={styles.heroChipText}>{t("courseViewer.chapters", { count: chapters.length })}</Text>
            </View>
            <View style={styles.heroChip}>
              <FontAwesome5 name="file-alt" size={11} color={colors.white} />
              <Text style={styles.heroChipText}>{t("courseViewer.files", { count: fileCount })}</Text>
            </View>
          </View>
        </View>

        {/* Progress */}
        {learnerId ? (
          <View style={styles.card}>
            <View style={styles.progressHead}>
              <View style={styles.progressLabelRow}>
                <View style={styles.progressIcon}>
                  <FontAwesome5 name="chart-line" size={12} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>
                  {params.readOnlyProgress ? t("courseViewer.learnerProgress") : t("courseViewer.progressTitle")}
                </Text>
              </View>
              <View style={styles.progressPctRow}>
                <Text style={styles.progressPct}>{pct}%</Text>
                <Text style={styles.progressCompleted}>{t("courseViewer.completed").toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{t("courseViewer.itemsDone")}</Text>
              <Text style={styles.statValueGreen}>
                {doneCount}/{totalChapters}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{t("courseViewer.status")}</Text>
              <Text style={styles.statValue}>
                {pct === 0 ? t("courseViewer.notStarted") : pct >= 100 ? t("courseViewer.finished") : t("courseViewer.inProgress")}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Chapters */}
        <View onLayout={(e) => (listY.current = e.nativeEvent.layout.y)} style={styles.chapterList}>
          {chapters.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <FontAwesome5 name="book-open" size={36} color={colors.textLight} />
              <Text style={styles.centerTitle}>{t("courseViewer.noChaptersTitle")}</Text>
              <Text style={styles.centerText}>{t("courseViewer.noChaptersText")}</Text>
            </View>
          ) : (
            chapters.map((ch, idx) => {
              const key = chapterKey(ch, idx);
              const expanded = expandedKey === key;
              const done = !!ch.id && completedIds.includes(ch.id);
              const files = chapterFiles[key] ?? [];
              const html = contents[key] ?? ch.contenu ?? "";
              const prevKey = idx > 0 ? chapterKey(chapters[idx - 1], idx - 1) : null;
              const nextKey = idx < chapters.length - 1 ? chapterKey(chapters[idx + 1], idx + 1) : null;
              return (
                <View
                  key={key}
                  style={[styles.chapterCard, expanded && styles.chapterCardExpanded]}
                  onLayout={(e) => (chapterY.current[key] = e.nativeEvent.layout.y)}
                >
                  <TouchableOpacity
                    style={styles.chapterHead}
                    onPress={() => setExpandedKey(expanded ? null : key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.chapterNumber, done && styles.chapterNumberDone]}>
                      <Text style={styles.chapterNumberText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.chapterHeadText}>
                      <Text style={styles.chapterTitle}>
                        {t("courseViewer.chapterTitle", { n: idx + 1, title: ch.titre || t("courseViewer.chapterFallback", { n: idx + 1 }) })}
                      </Text>
                      {ch.description ? (
                        <Text style={styles.chapterDescription} numberOfLines={expanded ? undefined : 2}>
                          {ch.description}
                        </Text>
                      ) : null}
                      <View style={styles.chapterMetaRow}>
                        <FontAwesome5 name="file-alt" size={10} color={colors.textMuted} />
                        <Text style={styles.chapterMeta}>{t("courseViewer.elements")}</Text>
                        {done ? (
                          <>
                            <FontAwesome5 name="check-circle" solid size={10} color={colors.success} />
                            <Text style={styles.chapterDoneText}>{t("courseViewer.chapterDone")}</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                    {learnerId ? (
                      <TouchableOpacity
                        onPress={() => handleMark(ch)}
                        disabled={!canMark || done || !!marking}
                        style={styles.markButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={done ? t("courseViewer.chapterDone") : t("courseViewer.markDone")}
                      >
                        {marking === ch.id ? (
                          <ActivityIndicator size="small" color={colors.success} />
                        ) : (
                          <FontAwesome5
                            name={done ? "check-circle" : "circle"}
                            solid={done}
                            size={20}
                            color={done ? colors.success : colors.textLight}
                          />
                        )}
                      </TouchableOpacity>
                    ) : null}
                    <FontAwesome5 name={expanded ? "chevron-down" : "chevron-right"} size={13} color={colors.textLight} />
                  </TouchableOpacity>

                  {expanded ? (
                    <View style={styles.chapterBody}>
                      {ch.contenu ? (
                        <View style={styles.contentBox}>
                          {contentsLoading && !contents[key] ? (
                            <ActivityIndicator color={colors.primary} />
                          ) : (
                            <CourseRichContent html={html} onOpenLink={openChapterLink} />
                          )}
                        </View>
                      ) : (
                        <Text style={styles.noContent}>{t("courseViewer.noContent")}</Text>
                      )}

                      <View style={styles.resourcesBox}>
                        <View style={styles.resourcesHead}>
                          <FontAwesome5 name="paperclip" size={13} color={colors.success} />
                          <Text style={styles.resourcesTitle}>{t("courseViewer.resources")}</Text>
                        </View>
                        {files.length > 0 ? (
                          files.map((f) => renderFileRow(f))
                        ) : (
                          <View style={styles.noResources}>
                            <FontAwesome5 name="file-alt" size={18} color={colors.textLight} />
                            <Text style={styles.noResourcesText}>{t("courseViewer.noResources")}</Text>
                          </View>
                        )}
                      </View>

                      {canMark && ch.id && !done ? (
                        <TouchableOpacity style={styles.markWide} onPress={() => handleMark(ch)} disabled={!!marking} activeOpacity={0.85}>
                          {marking === ch.id ? (
                            <ActivityIndicator size="small" color={colors.white} />
                          ) : (
                            <FontAwesome5 name="check" size={12} color={colors.white} />
                          )}
                          <Text style={styles.markWideText}>{t("courseViewer.markDone")}</Text>
                        </TouchableOpacity>
                      ) : null}

                      <View style={styles.navRow}>
                        <TouchableOpacity
                          style={[styles.navButton, !prevKey && styles.navButtonDisabled]}
                          disabled={!prevKey}
                          onPress={() => prevKey && goToChapter(prevKey)}
                        >
                          <FontAwesome5 name="chevron-left" size={11} color={prevKey ? colors.primary : colors.textLight} />
                          <Text style={[styles.navText, !prevKey && styles.navTextDisabled]}>{t("courseViewer.prevChapter")}</Text>
                        </TouchableOpacity>
                        <Text style={styles.navCount}>
                          {idx + 1}/{chapters.length}
                        </Text>
                        <TouchableOpacity
                          style={[styles.navButton, !nextKey && styles.navButtonDisabled]}
                          disabled={!nextKey}
                          onPress={() => nextKey && goToChapter(nextKey)}
                        >
                          <Text style={[styles.navText, !nextKey && styles.navTextDisabled]}>{t("courseViewer.nextChapter")}</Text>
                          <FontAwesome5 name="chevron-right" size={11} color={nextKey ? colors.primary : colors.textLight} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* General resources (files uploaded for the whole course) */}
        {generalFiles.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.progressHead}>
              <Text style={styles.cardTitle}>{t("courseViewer.generalResources")}</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{generalFiles.length}</Text>
              </View>
            </View>
            <Text style={styles.hint}>{t("courseViewer.generalResourcesHint")}</Text>
            {generalFiles.map((f) => renderFileRow(f))}
          </View>
        ) : null}
      </ScrollView>
      {fileOpener.host}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      gap: 4,
    },
    iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
    centerTitle: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
    centerText: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 6,
    },
    retryText: { color: colors.white, fontWeight: "700", fontSize: 13 },
    scrollContent: { padding: 12, gap: 12 },
    liveBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.successDark,
      borderRadius: 14,
      padding: 12,
    },
    liveIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    liveTitle: { color: colors.white, fontWeight: "700", fontSize: 14 },
    liveText: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
    liveButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.white,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    liveButtonText: { color: colors.successDark, fontWeight: "800", fontSize: 13 },
    hero: {
      backgroundColor: isDark ? "#1E3A8A" : colors.primaryDark,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    heroBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
    },
    heroBadgeAlt: { backgroundColor: "rgba(139,92,246,0.35)" },
    heroBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
    heroTitle: { color: colors.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
    heroDescription: { color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 20 },
    heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    heroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    heroChipText: { color: colors.white, fontSize: 12, fontWeight: "600" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 8,
    },
    emptyCard: { alignItems: "center", paddingVertical: 32 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
    progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    progressIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: isDark ? "rgba(59,130,246,0.2)" : colors.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    },
    progressPctRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    progressPct: { fontSize: 22, fontWeight: "900", color: colors.primary },
    progressCompleted: { fontSize: 10, fontWeight: "700", color: colors.textLight, letterSpacing: 0.8 },
    progressTrack: { height: 10, borderRadius: 999, backgroundColor: colors.surfaceElevated, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary },
    statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statLabel: { fontSize: 13, color: colors.textMuted },
    statValue: { fontSize: 13, fontWeight: "700", color: colors.primary },
    statValueGreen: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.successDark,
      backgroundColor: isDark ? "rgba(16,185,129,0.18)" : colors.successLight,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: "hidden",
    },
    chapterList: { gap: 10 },
    chapterCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    chapterCardExpanded: { borderColor: colors.primary },
    chapterHead: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
    chapterNumber: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    chapterNumberDone: { backgroundColor: colors.success },
    chapterNumberText: { color: colors.white, fontWeight: "800", fontSize: 15 },
    chapterHeadText: { flex: 1, gap: 2 },
    chapterTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    chapterDescription: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    chapterMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
    chapterMeta: { fontSize: 11, color: colors.textMuted, marginRight: 6 },
    chapterDoneText: { fontSize: 11, color: colors.success, fontWeight: "700" },
    markButton: { padding: 2 },
    chapterBody: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
      gap: 12,
    },
    contentBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    noContent: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
    resourcesBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 8,
    },
    resourcesHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    resourcesTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    noResources: {
      alignItems: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
    },
    noResourcesText: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fileIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    fileText: { flex: 1 },
    fileName: { fontSize: 13, fontWeight: "600", color: colors.text },
    fileMeta: { fontSize: 10, fontWeight: "600", color: colors.textMuted, marginTop: 2 },
    markWide: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.successDark,
      borderRadius: 10,
      paddingVertical: 10,
    },
    markWideText: { color: colors.white, fontWeight: "700", fontSize: 13 },
    navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    navButtonDisabled: { opacity: 0.5 },
    navText: { fontSize: 12, fontWeight: "700", color: colors.primary },
    navTextDisabled: { color: colors.textLight },
    navCount: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    countPill: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
    countPillText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    hint: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },
  });

export default CourseViewerScreen;
