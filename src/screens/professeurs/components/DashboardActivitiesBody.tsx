import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CreateActivityModal from "./CreateActivityModal";
import { activityFeedService, userService } from "../../../services/api";
import { classService } from "../../../services/classService";
import { Skeleton } from "../../../components/ui";
import { ActivityMediaGallery, ActivityMediaViewer, FeedMedia } from "../../../components/common/ActivityMediaGallery";
import { useUser } from "../../../context/UserContext";
import { useAuthStore } from "../../../store/useAuthStore";
import { useUiStore } from "../../../store/useUiStore";
import { useMountedRef } from "../../../hooks/useMountedRef";
import { translate } from "../../../i18n";
import { useThemeStore } from "../../../store/useThemeStore";
import { useThemeColors } from "../../../styles/theme";
import { ActivityEvent } from "../../../types";
import { formatDateTime, serverDateMs } from "../../../utils/dates";

/*
 * Port of scholchat_front's ActivitiesContent.jsx ("Fil d'actualité"), as web
 * shows it on a phone:
 *  - header bar: title, a filter button (current tab + chevron) that opens a
 *    "Filtrer le fil" sheet, and a "+" button for roles that can create
 *  - cards: avatar, author, role, date, then title, description, location,
 *    "du … au …" dates, class chips, the media grid, the like/participant/
 *    comment counts, four icon-only buttons, and comments that open in place
 *  - /evenements/pagines, 10 per page, loading more as you scroll, with a
 *    3-minute in-memory cache kept across tab switches
 */

const PAGE_SIZE = 10;
const CACHE_TTL = 3 * 60 * 1000;

/** Roles allowed to create, as in web's canCreateEvent. */
const CREATOR_ROLES = ["admin", "professor", "tutor", "gestionnaire"];

/** Kept in memory across unmount/remount (switching tabs and back), like web's module-level `_cache`. */
const _cache = {
  raw: [] as ActivityEvent[],
  page: 0,
  hasMore: true,
  totalElements: 0,
  timestamp: 0,
  userNames: {} as Record<string, { name: string; role: string }>,
  classNames: {} as Record<string, string | null>,
};

interface FeedComment {
  id: string;
  content: string;
  creationDate?: string;
  isCurrentUser: boolean;
}

interface FeedActivity {
  id: string;
  titre: string;
  description: string;
  timestamp: string;
  user: { name: string; role: string };
  status?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  heureDebut?: string;
  medias: FeedMedia[];
  likes: number;
  isLiked: boolean;
  comments: FeedComment[];
  participants: number;
  isParticipating: boolean;
  classNames: string[];
  classesIds: string[];
  createurId?: string;
}

const FR_DATE_TIME: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Formats an ISO string from the server in the phone's local time (fr-FR). Never slices the raw string. */
const fmt = (iso?: string, opts: Intl.DateTimeFormatOptions = FR_DATE_TIME) => formatDateTime(iso, opts);

/** Backend EtatEvenement shown in French. */
const STATUS_META: Record<string, { label: string; fg: string; bg: string; bgDark: string }> = {
  PLANIFIE: { label: "Planifié", fg: "#2563EB", bg: "#DBEAFE", bgDark: "rgba(37,99,235,0.2)" },
  A_VENIR: { label: "À venir", fg: "#2563EB", bg: "#DBEAFE", bgDark: "rgba(37,99,235,0.2)" },
  EN_COURS: { label: "En cours", fg: "#059669", bg: "#D1FAE5", bgDark: "rgba(5,150,105,0.2)" },
  PASSE: { label: "Terminé", fg: "#6B7280", bg: "#F3F4F6", bgDark: "rgba(107,114,128,0.25)" },
  TERMINE: { label: "Terminé", fg: "#6B7280", bg: "#F3F4F6", bgDark: "rgba(107,114,128,0.25)" },
  ANNULE: { label: "Annulé", fg: "#DC2626", bg: "#FEE2E2", bgDark: "rgba(220,38,38,0.2)" },
  COMPLET: { label: "Complet", fg: "#D97706", bg: "#FEF3C7", bgDark: "rgba(217,119,6,0.2)" },
  EN_ATTENTE_CONFIRMATION: { label: "En attente", fg: "#D97706", bg: "#FEF3C7", bgDark: "rgba(217,119,6,0.2)" },
};

const ROLE_LABELS: Record<string, string> = {
  professeur: "Professeur",
  eleve: "Eleve",
  parent: "Parent",
  gestionnaire: "Gestionnaire",
  repetiteur: "Repetiteur",
};

/** Same mapping as web's loadEvents(). */
const mapEvent = (event: ActivityEvent, currentUserId?: string): FeedActivity => {
  const medias: FeedMedia[] = (event.medias ?? [])
    .filter((m) => {
      const t = (m.mediaType || "").toUpperCase();
      return (t === "IMAGE" || t === "PHOTO" || t === "VIDEO") && !!m.id;
    })
    .map((m) => ({
      id: String(m.id),
      type: (m.mediaType || "").toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE",
      presignedUrl: m.presignedUrl || null,
    }));
  const interactions = event.interactions ?? [];
  const comments: FeedComment[] = interactions
    .filter((i) => i.type === "COMMENT")
    .map((c, idx) => ({
      id: String(c.id ?? `c-${idx}`),
      content: c.content ?? "",
      creationDate: c.creationDate,
      isCurrentUser: !!currentUserId && c.createdById === currentUserId,
    }));
  const participantsIds = event.participantsIds ?? [];

  let name = "";
  let role = event.createurRole || "";
  if (event.createurPrenom || event.createurNom) {
    name = `${event.createurPrenom || ""} ${event.createurNom || ""}`.trim();
  } else if (event.createurId && _cache.userNames[event.createurId]) {
    name = _cache.userNames[event.createurId].name;
    if (!role) role = _cache.userNames[event.createurId].role;
  }
  const classesIds = event.classesIds ?? [];

  return {
    id: String(event.id),
    titre: event.titre ?? "",
    description: event.description ?? "",
    timestamp: fmt(event.creationDate || event.heureDebut),
    user: { name: name || "Utilisateur", role },
    status: event.etat,
    location: event.lieu,
    startTime: event.heureDebut,
    endTime: event.heureFin,
    heureDebut: event.heureDebut,
    medias,
    likes: interactions.filter((i) => i.type === "LIKE").length,
    isLiked: interactions.some((i) => i.type === "LIKE" && i.createdById === currentUserId),
    comments,
    participants: participantsIds.length,
    isParticipating: !!currentUserId && participantsIds.includes(currentUserId),
    classNames: classesIds.map((id) => _cache.classNames[id]).filter((n): n is string => !!n),
    classesIds,
    createurId: event.createurId,
  };
};

/** Looks up missing author and class names, cached, as web does before mapping a page. */
const resolveNames = async (events: ActivityEvent[]) => {
  const users = new Set<string>();
  const classIds = new Set<string>();
  events.forEach((e) => {
    if (!e.createurPrenom && !e.createurNom && e.createurId && !_cache.userNames[e.createurId]) users.add(e.createurId);
    (e.classesIds ?? []).forEach((id) => {
      if (!(id in _cache.classNames)) classIds.add(id);
    });
  });
  await Promise.all([
    ...[...users].map(async (uid) => {
      try {
        const d = (await userService.getUserById(uid)) as Record<string, any>;
        const name = `${d.prenom || ""} ${d.nom || ""}`.trim() || d.email || "Utilisateur";
        const role = d.admin ? "Admin" : ROLE_LABELS[String(d.type || "").toLowerCase()] || "";
        _cache.userNames[uid] = { name, role };
      } catch {
        /* ignore */
      }
    }),
    ...[...classIds].map(async (cid) => {
      try {
        const cls = await classService.getClassDetails(cid);
        _cache.classNames[cid] = cls.nom || (cls as any).name || null;
      } catch {
        /* ignore */
      }
    }),
  ]);
};

type TabKey = "all" | "mine" | "upcoming" | "withMedia" | "participating" | "past";
interface TabDef {
  key: TabKey;
  label: string;
  labelMobile: string;
  icon: string;
  color: string;
  bg: string;
  bgDark: string;
}

const pluralize = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ─────────────────────────────────────────────────────────────────────────────

const DashboardActivitiesBody = () => {
  const { user } = useUser();
  const role = useAuthStore((s) => s.role);
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const currentUserId = user?.userId;
  const canCreateEvent = CREATOR_ROLES.includes(role);

  const isFresh = _cache.raw.length > 0 && Date.now() - _cache.timestamp < CACHE_TTL;
  const [rawActivities, setRawActivities] = useState<ActivityEvent[]>(isFresh ? _cache.raw : []);
  const [loading, setLoading] = useState(!isFresh);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(isFresh ? _cache.page : 0);
  const [hasMore, setHasMore] = useState(isFresh ? _cache.hasMore : true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [namesVersion, setNamesVersion] = useState(0);

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ActivityEvent | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [liking, setLiking] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ medias: FeedMedia[]; index: number } | null>(null);

  // Keep the module cache in sync so switching tabs and back restores the feed instantly.
  useEffect(() => {
    _cache.raw = rawActivities;
    _cache.page = page;
    _cache.hasMore = hasMore;
  }, [rawActivities, page, hasMore]);

  const loadEvents = useCallback(async (pageToLoad: number) => {
    if (pageToLoad === 0) setError("");
    try {
      const result = await activityFeedService.getPaged(pageToLoad, PAGE_SIZE);
      const content = result.content ?? [];
      await resolveNames(content);
      setRawActivities((prev) => {
        if (pageToLoad === 0) return content;
        const seen = new Set(prev.map((r) => String(r.id)));
        return [...prev, ...content.filter((r) => !seen.has(String(r.id)))];
      });
      setPage(pageToLoad);
      setHasMore(!result.last);
      _cache.totalElements = result.totalElements ?? 0;
      _cache.timestamp = Date.now();
      setNamesVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des activités.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!isFresh) loadEvents(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activities = useMemo(
    () => rawActivities.map((r) => mapEvent(r, currentUserId)),
    // namesVersion: remap once author/class names have been looked up
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawActivities, currentUserId, namesVersion]
  );

  // Tabs depend on role, as on web: creators get "Mes publications", others get "Passés" at the end.
  const tabs = useMemo<TabDef[]>(() => {
    const base: TabDef[] = [
      { key: "all", label: "Fil d'actualité", labelMobile: "Tout", icon: "home", color: "#4B5563", bg: "#F3F4F6", bgDark: "#374151" },
      { key: "upcoming", label: "À venir", labelMobile: "À venir", icon: "calendar-alt", color: "#16A34A", bg: "#F0FDF4", bgDark: "rgba(20,83,45,0.3)" },
      { key: "withMedia", label: "Avec médias", labelMobile: "Médias", icon: "image", color: "#DB2777", bg: "#FDF2F8", bgDark: "rgba(131,24,67,0.3)" },
      { key: "participating", label: "Participations", labelMobile: "Participations", icon: "user-plus", color: "#2563EB", bg: "#EFF6FF", bgDark: "rgba(30,58,138,0.3)" },
    ];
    if (canCreateEvent) {
      base.splice(1, 0, { key: "mine", label: "Mes publications", labelMobile: "Mes posts", icon: "pencil-alt", color: "#4F46E5", bg: "#EEF2FF", bgDark: "rgba(49,46,129,0.3)" });
    } else {
      base.push({ key: "past", label: "Passés", labelMobile: "Passés", icon: "clock", color: "#D97706", bg: "#FFFBEB", bgDark: "rgba(120,53,15,0.3)" });
    }
    return base;
  }, [canCreateEvent]);

  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab)) setActiveTab("all");
  }, [tabs, activeTab]);

  const filtered = useMemo(() => {
    const now = Date.now();
    switch (activeTab) {
      case "mine":
        return activities.filter((a) => a.createurId === currentUserId);
      case "upcoming":
        return activities.filter((a) => a.heureDebut && serverDateMs(a.heureDebut, NaN) > now);
      case "withMedia":
        return activities.filter((a) => a.medias.length > 0);
      case "participating":
        return activities.filter((a) => a.isParticipating);
      case "past":
        return activities.filter((a) => a.heureDebut && serverDateMs(a.heureDebut, NaN) <= now);
      default:
        return activities;
    }
  }, [activities, activeTab, currentUserId]);

  const currentTab = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  // Opened from a notification tap (useUiStore.requestActivity): show that activity — fetched and
  // put on top when it isn't in the loaded pages — scrolled to and briefly highlighted.
  const pendingActivity = useUiStore((s) => s.pendingActivity);
  const mountedRef = useMountedRef();
  const listRef = useRef<FlatList<FeedActivity>>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [openingActivity, setOpeningActivity] = useState(false);
  useEffect(() => {
    if (!pendingActivity || loading) return;
    const eventId = pendingActivity;
    useUiStore.getState().clearPendingActivity();
    setActiveTab("all");
    (async () => {
      if (!rawActivities.some((r) => String(r.id) === eventId)) {
        setOpeningActivity(true);
        try {
          const ev = await activityFeedService.getById(eventId);
          if (!ev?.id) throw new Error("not found");
          await resolveNames([ev]);
          if (!mountedRef.current) return;
          setRawActivities((prev) => (prev.some((r) => String(r.id) === eventId) ? prev : [ev, ...prev]));
          setNamesVersion((v) => v + 1);
        } catch {
          if (mountedRef.current) Alert.alert(translate("notifications.unavailableTitle"), translate("notifications.activityUnavailable"));
          return;
        } finally {
          if (mountedRef.current) setOpeningActivity(false);
        }
      }
      if (mountedRef.current) setHighlightId(eventId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingActivity, loading]);
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  useEffect(() => {
    if (!highlightId) return;
    const scroll = setTimeout(() => {
      const index = filteredRef.current.findIndex((a) => a.id === highlightId);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    }, 300);
    const clear = setTimeout(() => setHighlightId(null), 5000);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [highlightId]);

  const patchRaw = (id: string, updater: (r: ActivityEvent) => ActivityEvent) =>
    setRawActivities((prev) => prev.map((r) => (String(r.id) === id ? updater(r) : r)));

  // Same rule the backend enforces on PUT/DELETE /evenements: author or admin.
  // (Web also allowed anyone sharing a class, which let students/parents see
  // edit/delete buttons the server would refuse.)
  const canEdit = (a: FeedActivity) =>
    role === "admin" || (!!currentUserId && a.createurId === currentUserId);

  const handleLike = async (a: FeedActivity) => {
    if (liking[a.id]) return;
    setLiking((p) => ({ ...p, [a.id]: true }));
    const wasLiked = a.isLiked;
    const toggle = (liked: boolean) =>
      patchRaw(a.id, (r) => {
        const list = r.interactions ?? [];
        return {
          ...r,
          interactions: liked
            ? list.filter((i) => !(i.type === "LIKE" && i.createdById === currentUserId))
            : [...list, { type: "LIKE", createdById: currentUserId }],
        };
      });
    toggle(wasLiked);
    try {
      await activityFeedService.like(a.id);
    } catch {
      toggle(!wasLiked);
    } finally {
      setLiking((p) => ({ ...p, [a.id]: false }));
    }
  };

  const handleParticipate = async (a: FeedActivity) => {
    const was = a.isParticipating;
    const toggle = (participating: boolean) =>
      patchRaw(a.id, (r) => {
        const ids = r.participantsIds ?? [];
        return {
          ...r,
          participantsIds: participating ? ids.filter((x) => x !== currentUserId) : [...ids, currentUserId as string],
        };
      });
    toggle(was);
    try {
      if (was) await activityFeedService.unjoin(a.id);
      else await activityFeedService.join(a.id);
    } catch (err) {
      toggle(!was);
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la participation.");
    }
  };

  const handleComment = async (a: FeedActivity, content: string) => {
    const tempId = `temp-${Date.now()}`;
    patchRaw(a.id, (r) => ({
      ...r,
      interactions: [
        ...(r.interactions ?? []),
        { id: tempId, type: "COMMENT", content, createdById: currentUserId, creationDate: new Date().toISOString() },
      ],
    }));
    try {
      const created = await activityFeedService.comment(a.id, content);
      if (created?.id) {
        patchRaw(a.id, (r) => ({
          ...r,
          interactions: (r.interactions ?? []).map((i) => (i.id === tempId ? { ...i, id: created.id, creationDate: created.creationDate ?? i.creationDate } : i)),
        }));
      }
    } catch (err) {
      patchRaw(a.id, (r) => ({ ...r, interactions: (r.interactions ?? []).filter((i) => i.id !== tempId) }));
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du commentaire.");
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await activityFeedService.remove(id);
      setRawActivities((prev) => prev.filter((r) => String(r.id) !== id));
    } catch (err) {
      Alert.alert("Erreur", `Échec de la suppression: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = async (mode: "create" | "edit") => {
    setShowCreate(false);
    setEditing(null);
    setLoading(true);
    // Like web: wait briefly after a create so the backend has saved the media rows.
    if (mode === "create") await new Promise((r) => setTimeout(r, 800));
    await loadEvents(0);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEvents(0);
    setRefreshing(false);
  };

  const handleEndReached = () => {
    if (loading || loadingMore || !hasMore || rawActivities.length === 0) return;
    setLoadingMore(true);
    loadEvents(page + 1);
  };

  const openCreate = () => {
    setEditing(null);
    setShowCreate(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const header = (
    <View style={styles.headerBar}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        Fil d'actualité
      </Text>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterSheet(true)} activeOpacity={0.8}>
          <FontAwesome5 name={currentTab.icon} size={12} color={colors.textMuted} />
          <Text style={styles.filterBtnText} numberOfLines={1}>
            {currentTab.labelMobile}
          </Text>
          <FontAwesome5 name="chevron-down" size={11} color={colors.textMuted} />
        </TouchableOpacity>
        {canCreateEvent ? (
          <TouchableOpacity style={styles.plusBtn} onPress={openCreate} activeOpacity={0.85}>
            <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const empty = loading || openingActivity ? (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, { padding: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Skeleton width="50%" height={12} style={{ marginBottom: 6 }} />
              <Skeleton width="30%" height={9} />
            </View>
          </View>
          <Skeleton width="70%" height={12} style={{ marginBottom: 8 }} />
          <Skeleton width="95%" height={10} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={180} borderRadius={8} />
        </View>
      ))}
    </View>
  ) : (
    <View style={[styles.card, styles.emptyCard]}>
      <View style={styles.emptyIcon}>
        <FontAwesome5 name="calendar-alt" size={28} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === "all" ? "Aucune activité disponible" : `Aucun contenu dans "${currentTab.label}"`}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === "all"
          ? "Soyez le premier à créer un événement et à partager vos activités avec la communauté."
          : "Essayez de changer de filtre ou créez du contenu"}
      </Text>
      {canCreateEvent && activeTab === "all" ? (
        <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
          <FontAwesome5 name="plus" size={14} color="#FFFFFF" />
          <Text style={styles.emptyBtnText}>Créer le premier événement</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const footer =
    loading || filtered.length === 0 ? null : hasMore ? (
      <View style={styles.footerLoader}>{loadingMore ? <ActivityIndicator color="#2563EB" /> : null}</View>
    ) : (
      <View style={styles.upToDate}>
        <View style={styles.upToDateLine} />
        <Text style={styles.upToDateText}>Vous êtes à jour</Text>
        <View style={styles.upToDateLine} />
      </View>
    );

  return (
    <View style={styles.container}>
      {header}

      <FlatList
        ref={listRef}
        data={loading || openingActivity ? [] : filtered}
        keyExtractor={(a) => a.id}
        onScrollToIndexFailed={(info) => {
          // Variable-height cards: jump near it, then retry once it is laid out.
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0 }), 300);
        }}
        renderItem={({ item }) => (
          <View style={item.id === highlightId ? styles.highlighted : undefined}>
          <ActivityCard
            activity={item}
            styles={styles}
            colors={colors}
            isDark={isDark}
            canEdit={canEdit(item)}
            deleting={deletingId === item.id}
            liking={!!liking[item.id]}
            onLike={handleLike}
            onParticipate={handleParticipate}
            onComment={handleComment}
            onEdit={() => {
              const raw = rawActivities.find((r) => String(r.id) === item.id) ?? null;
              setEditing(raw);
            }}
            onDelete={() => setConfirmDeleteId(item.id)}
            onOpenMedia={(index) => setViewer({ medias: item.medias, index })}
          />
          </View>
        )}
        ListHeaderComponent={error ? <Text style={styles.errorText}>{error}</Text> : null}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 150 }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" colors={["#2563EB"]} />}
      />

      {/* "Filtrer le fil" sheet */}
      <Modal visible={showFilterSheet} transparent animationType="slide" onRequestClose={() => setShowFilterSheet(false)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowFilterSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filtrer le fil</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowFilterSheet(false)}>
                <FontAwesome5 name="times" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {tabs.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.sheetItem, active && styles.sheetItemActive]}
                  onPress={() => {
                    setActiveTab(tab.key);
                    setShowFilterSheet(false);
                  }}
                >
                  <View
                    style={[
                      styles.sheetItemIcon,
                      { backgroundColor: active ? (isDark ? "#1E40AF" : "#DBEAFE") : isDark ? tab.bgDark : tab.bg },
                    ]}
                  >
                    <FontAwesome5 name={tab.icon} size={13} color={active ? "#2563EB" : tab.color} />
                  </View>
                  <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <View style={styles.dialogBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setConfirmDeleteId(null)} />
          <View style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <FontAwesome5 name="trash-alt" size={20} color={isDark ? "#F87171" : "#DC2626"} />
            </View>
            <Text style={styles.dialogTitle}>Supprimer l'événement</Text>
            <Text style={styles.dialogText}>Cette action est irréversible. L'événement sera définitivement supprimé.</Text>
            <View style={styles.dialogRow}>
              <TouchableOpacity style={[styles.dialogBtn, styles.dialogCancel]} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.dialogCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogDelete]}
                disabled={!!deletingId}
                onPress={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              >
                <Text style={styles.dialogDeleteText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {(showCreate || editing) && (
        <CreateActivityModal
          activityToEdit={editing}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {viewer && <ActivityMediaViewer medias={viewer.medias} initialIndex={viewer.index} onClose={() => setViewer(null)} />}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  activity: FeedActivity;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useThemeColors>;
  isDark: boolean;
  canEdit: boolean;
  deleting: boolean;
  liking: boolean;
  onLike: (a: FeedActivity) => void;
  onParticipate: (a: FeedActivity) => void;
  onComment: (a: FeedActivity, content: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenMedia: (index: number) => void;
}

const ActivityCard = memo(
  ({ activity: a, styles, colors, isDark, canEdit, deleting, liking, onLike, onParticipate, onComment, onEdit, onDelete, onOpenMedia }: CardProps) => {
    const [showComments, setShowComments] = useState(false);
    const [draft, setDraft] = useState("");
    const status = a.status ? STATUS_META[a.status] : undefined;
    const statusLabel =
      status?.label ?? (a.status ? a.status.charAt(0) + a.status.slice(1).toLowerCase().replace(/_/g, " ") : "");

    const send = () => {
      const text = draft.trim();
      if (!text) return;
      setDraft("");
      onComment(a, text);
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardBody}>
          {/* Header: avatar, author, role, date, status, edit/delete */}
          <View style={styles.authorRow}>
            <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={styles.avatarText}>{a.user.name.charAt(0).toUpperCase() || "U"}</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {a.user.name}
                </Text>
                {a.user.role ? (
                  <View style={styles.roleChip}>
                    <Text style={styles.roleChipText}>{a.user.role}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.metaRow}>
                {a.timestamp ? <Text style={styles.timestamp}>{a.timestamp}</Text> : null}
                {statusLabel ? (
                  <View style={[styles.statusChip, { backgroundColor: status ? (isDark ? status.bgDark : status.bg) : colors.surfaceElevated }]}>
                    <Text style={[styles.statusText, { color: status?.fg ?? colors.textMuted }]}>{statusLabel}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {canEdit ? (
              <View style={styles.ownerActions}>
                <TouchableOpacity style={styles.ownerBtn} onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <FontAwesome5 name="pencil-alt" size={14} color={colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.ownerBtn} onPress={onDelete} disabled={deleting} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  {deleting ? <ActivityIndicator size="small" color={colors.textLight} /> : <FontAwesome5 name="trash-alt" size={14} color={colors.textLight} />}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Title and description */}
          {a.titre ? <Text style={styles.title}>{a.titre}</Text> : null}
          {a.description ? (
            <Text style={styles.description} numberOfLines={4}>
              {a.description}
            </Text>
          ) : null}

          {/* Event details: location, then "du … au …" */}
          {a.location || a.startTime || a.endTime ? (
            <View style={styles.details}>
              {a.location ? (
                <View style={styles.detailRow}>
                  <FontAwesome5 name="map-marker-alt" size={11} color={colors.textLight} style={styles.detailIcon} />
                  <Text style={styles.detailText}>{a.location}</Text>
                </View>
              ) : null}
              {a.startTime || a.endTime ? (
                <View style={[styles.detailRow, { flexWrap: "wrap" }]}>
                  {a.startTime ? (
                    <>
                      <FontAwesome5 name="calendar-alt" size={11} color="#3B82F6" style={styles.detailIcon} />
                      <Text style={styles.detailStrong}>du {fmt(a.startTime)}</Text>
                    </>
                  ) : null}
                  {a.endTime ? (
                    <>
                      <FontAwesome5 name="clock" size={11} color="#FB923C" style={[styles.detailIcon, a.startTime ? { marginLeft: 8 } : null]} />
                      <Text style={styles.detailStrong}>au {fmt(a.endTime)}</Text>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {a.classNames.length > 0 ? (
            <View style={styles.classRow}>
              {a.classNames.map((n, i) => (
                <View key={`${n}-${i}`} style={styles.classChip}>
                  <Text style={styles.classChipText}>{n}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Media grid, only when the activity has media */}
        {a.medias.length > 0 ? <ActivityMediaGallery medias={a.medias} onOpen={onOpenMedia} /> : null}

        {/* Counts */}
        {a.likes > 0 || a.participants > 0 || a.comments.length > 0 ? (
          <View style={styles.statsRow}>
            <View style={styles.statsLeft}>
              {a.likes > 0 ? (
                <View style={styles.statItem}>
                  <FontAwesome5 name="heart" solid size={13} color="#EF4444" />
                  <Text style={styles.statText}>{a.likes}</Text>
                </View>
              ) : null}
              {a.participants > 0 ? (
                <View style={styles.statItem}>
                  <FontAwesome5 name="user-plus" size={12} color="#22C55E" />
                  <Text style={styles.statText}>{pluralize(a.participants, "participant", "participants")}</Text>
                </View>
              ) : null}
            </View>
            {a.comments.length > 0 ? (
              <TouchableOpacity onPress={() => setShowComments((v) => !v)}>
                <Text style={styles.statText}>{pluralize(a.comments.length, "commentaire", "commentaires")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Like / Comment / Participate / Share */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, a.isLiked && { backgroundColor: isDark ? "rgba(127,29,29,0.25)" : "#FEF2F2" }]}
            onPress={() => onLike(a)}
            disabled={liking}
          >
            {liking ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <FontAwesome5 name="heart" solid={a.isLiked} size={16} color={a.isLiked ? "#DC2626" : colors.textMuted} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments((v) => !v)}>
            <FontAwesome5 name="comment" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, a.isParticipating && { backgroundColor: isDark ? "rgba(20,83,45,0.25)" : "#F0FDF4" }]}
            onPress={() => onParticipate(a)}
          >
            <FontAwesome5 name="user-plus" size={15} color={a.isParticipating ? "#16A34A" : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => Share.share({ title: a.titre, message: `${a.titre}\n\n${a.description}` }).catch(() => {})}
          >
            <FontAwesome5 name="share-alt" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Comments, opened in place */}
        {showComments ? (
          <View style={styles.commentsBox}>
            {a.comments.length > 0 ? (
              <View style={styles.commentsList}>
                {a.comments.map((c) => (
                  <View key={c.id} style={[styles.commentRow, c.isCurrentUser && { flexDirection: "row-reverse" }]}>
                    <LinearGradient colors={["#3B82F6", "#6366F1"]} style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{c.isCurrentUser ? "V" : "U"}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1, maxWidth: "75%", alignItems: c.isCurrentUser ? "flex-end" : "flex-start" }}>
                      <View style={[styles.bubble, c.isCurrentUser ? styles.bubbleMine : styles.bubbleOther]}>
                        <Text style={[styles.bubbleText, c.isCurrentUser && { color: "#FFFFFF" }]}>{c.content}</Text>
                      </View>
                      <Text style={[styles.commentTime, c.isCurrentUser ? { marginRight: 12 } : { marginLeft: 12 }]}>
                        {c.creationDate ? fmt(c.creationDate, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "À l'instant"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.commentInputRow}>
              <LinearGradient colors={["#2563EB", "#4F46E5"]} style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>V</Text>
              </LinearGradient>
              <View style={styles.commentInputWrap}>
                <TextInput
                  style={styles.commentInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Écrivez un commentaire..."
                  placeholderTextColor={colors.textLight}
                  onSubmitEditing={send}
                  returnKeyType="send"
                />
                <TouchableOpacity onPress={send} disabled={!draft.trim()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <FontAwesome5 name="paper-plane" size={14} color={draft.trim() ? "#3B82F6" : colors.textLight} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  // Web's gray scale for the feed (gray-900/700/600/500/400 and gray-100/700 borders).
  const strong = isDark ? "#FFFFFF" : "#111827";
  const body = isDark ? "#D1D5DB" : "#374151";
  const sub = isDark ? "#9CA3AF" : "#6B7280";
  const subStrong = isDark ? "#D1D5DB" : "#4B5563";
  const divider = isDark ? "#374151" : "#F3F4F6";
  return StyleSheet.create({
    /** Activity opened from a notification (briefly outlined). */
    highlighted: { backgroundColor: colors.primaryLight, paddingTop: 10, borderRadius: 16, marginHorizontal: 2 },
    container: { flex: 1, backgroundColor: colors.background },

    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#E5E7EB",
    },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: strong },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    filterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? "#374151" : "#F3F4F6",
    },
    filterBtnText: { maxWidth: 96, fontSize: 12, fontWeight: "600", color: isDark ? "#E5E7EB" : "#374151" },
    plusBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },

    errorText: { color: "#EF4444", marginHorizontal: 12, marginBottom: 12, fontSize: 13 },

    card: {
      backgroundColor: colors.surface,
      marginHorizontal: 12,
      marginBottom: 16,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? "#334155" : "transparent",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 2,
      elevation: isDark ? 0 : 1,
    },
    cardBody: { padding: 12 },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    authorName: { flexShrink: 1, fontSize: 14, fontWeight: "600", color: strong },
    roleChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(30,58,138,0.4)" : "#DBEAFE",
    },
    roleChipText: { fontSize: 10, fontWeight: "500", color: isDark ? "#93C5FD" : "#1D4ED8" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
    timestamp: { fontSize: 10, color: sub },
    statusChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
    statusText: { fontSize: 10, fontWeight: "600" },
    ownerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
    ownerBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },

    title: { fontSize: 14, fontWeight: "700", color: strong, marginBottom: 4 },
    description: { fontSize: 12, lineHeight: 17, color: body, marginBottom: 8 },

    details: { gap: 4, marginBottom: 4 },
    detailRow: { flexDirection: "row", alignItems: "center" },
    detailIcon: { marginRight: 4, width: 12, textAlign: "center" },
    detailText: { flexShrink: 1, fontSize: 12, color: sub },
    detailStrong: { fontSize: 12, fontWeight: "500", color: subStrong },

    classRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    classChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: isDark ? "rgba(20,83,45,0.4)" : "#DCFCE7" },
    classChipText: { fontSize: 11, fontWeight: "500", color: isDark ? "#86EFAC" : "#15803D" },

    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: divider,
    },
    statsLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    statText: { fontSize: 13, color: sub },

    actionsRow: {
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 4,
      paddingVertical: 4,
      borderTopWidth: 1,
      borderTopColor: divider,
    },
    actionBtn: { flex: 1, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },

    commentsBox: { borderTopWidth: 1, borderTopColor: divider, backgroundColor: isDark ? "rgba(17,24,39,0.5)" : "#F9FAFB" },
    commentsList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
    commentRow: { flexDirection: "row", gap: 8 },
    commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    commentAvatarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
    bubbleMine: { backgroundColor: "#2563EB" },
    bubbleOther: { backgroundColor: isDark ? "#374151" : "#F3F4F6" },
    bubbleText: { fontSize: 14, color: isDark ? "#F3F4F6" : "#111827" },
    commentTime: { fontSize: 11, color: sub, marginTop: 4 },
    commentInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#374151" : "#E5E7EB",
    },
    commentInputWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#374151" : "#F3F4F6",
      borderRadius: 999,
      paddingLeft: 16,
      paddingRight: 12,
    },
    commentInput: { flex: 1, fontSize: 14, paddingVertical: 9, color: isDark ? "#FFFFFF" : "#111827" },

    emptyCard: { padding: 32, alignItems: "center" },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? "#374151" : "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 17, fontWeight: "600", color: strong, textAlign: "center", marginBottom: 8 },
    emptyText: { fontSize: 14, color: sub, textAlign: "center", marginBottom: 20 },
    emptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#2563EB",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },

    footerLoader: { paddingVertical: 16, alignItems: "center" },
    upToDate: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 20 },
    upToDateLine: { flex: 1, height: 1, backgroundColor: isDark ? "#374151" : "#E5E7EB" },
    upToDateText: { fontSize: 12, fontWeight: "500", color: isDark ? "#6B7280" : "#9CA3AF" },

    sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 6 },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    sheetTitle: { fontSize: 16, fontWeight: "700", color: strong },
    sheetClose: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: isDark ? "#374151" : "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
    },
    sheetItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
    sheetItemActive: { backgroundColor: isDark ? "rgba(30,58,138,0.3)" : "#EFF6FF" },
    sheetItemIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    sheetItemText: { flex: 1, fontSize: 14, color: isDark ? "#D1D5DB" : "#374151" },
    sheetItemTextActive: { fontWeight: "600", color: isDark ? "#93C5FD" : "#1D4ED8" },

    dialogBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.6)" },
    dialog: { width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderRadius: 16, padding: 24 },
    dialogIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      backgroundColor: isDark ? "rgba(127,29,29,0.3)" : "#FEE2E2",
    },
    dialogTitle: { fontSize: 18, fontWeight: "900", color: strong, textAlign: "center", marginBottom: 8 },
    dialogText: { fontSize: 14, color: sub, textAlign: "center", marginBottom: 24 },
    dialogRow: { flexDirection: "row", gap: 12 },
    dialogBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
    dialogCancel: { backgroundColor: isDark ? "#374151" : "#F3F4F6" },
    dialogCancelText: { fontWeight: "700", fontSize: 14, color: isDark ? "#D1D5DB" : "#4B5563" },
    dialogDelete: { backgroundColor: "#DC2626" },
    dialogDeleteText: { fontWeight: "700", fontSize: 14, color: "#FFFFFF" },
  });
};

export default DashboardActivitiesBody;
