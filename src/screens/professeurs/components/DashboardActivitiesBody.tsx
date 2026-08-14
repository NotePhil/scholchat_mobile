import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Modal,
  Dimensions,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import CreateActivityModal, { Activity, ActivityComment, ActivityMedia } from "./CreateActivityModal";
import { activityFeedService } from "../../../services/api";
import { LoadingSpinner } from "../../../components/ui";
import ActivityMediaImage from "../../../components/common/ActivityMediaImage";
import ActivityMediaVideo from "../../../components/common/ActivityMediaVideo";
import { useUser } from "../../../context/UserContext";

/**
 * Maps the backend's `Evenement` model to this screen's display shape.
 * `interactions` holds likes/comments/joins (distinguished by `type`) —
 * mirrors scholchat_front's ActivitiesContent.jsx loadEvents() mapping.
 */
const mapApiActivity = (raw: Record<string, any>, currentUserId?: string): Activity => {
  const interactions: any[] = Array.isArray(raw.interactions) ? raw.interactions : [];
  const likeCount = interactions.filter((i) => i.type === "LIKE").length;
  const commentsList: ActivityComment[] = interactions
    .filter((i) => i.type === "COMMENT")
    .map((c) => ({
      id: c.id,
      content: c.content,
      createdById: c.createdById,
      creationDate: c.creationDate,
      isCurrentUser: c.createdById === currentUserId,
    }));
  const commentCount = commentsList.length;
  const isLiked = interactions.some((i) => i.type === "LIKE" && i.createdById === currentUserId);
  const participantsIds: string[] = Array.isArray(raw.participantsIds) ? raw.participantsIds : [];

  return {
    id: raw.id,
    type: raw.heureDebut ? "event" : "publication",
    creator: `${raw.createurPrenom ?? ""} ${raw.createurNom ?? ""}`.trim() || "Utilisateur",
    role: raw.createurRole ?? "Membre",
    date: raw.heureDebut ? new Date(raw.heureDebut).toLocaleDateString("fr-FR") : "",
    // Mirrors web's sort key exactly (heureDebut ?? creationDate) — without
    // this fallback, publications (which have no heureDebut) always got
    // `undefined` here, which every date sort treated as epoch zero, sinking
    // every publication to the very bottom regardless of how recent it was.
    rawDate: raw.heureDebut || raw.creationDate,
    status: raw.etat === "PASSE" ? "Completed" : raw.etat === "A_VENIR" || raw.etat === "PLANIFIE" ? "Scheduled" : "Published",
    title: raw.titre ?? "",
    eventDate: raw.heureDebut ? new Date(raw.heureDebut).toLocaleString("fr-FR") : undefined,
    location: raw.lieu,
    participants: `${participantsIds.length} participant(s)`,
    participantsCount: participantsIds.length,
    isParticipating: currentUserId ? participantsIds.includes(currentUserId) : false,
    isLiked,
    description: raw.description ?? "",
    likes: likeCount,
    comments: commentCount,
    commentsList,
    medias: Array.isArray(raw.medias)
      ? raw.medias.map((m: any, i: number) => ({
          id: m.id ?? String(i),
          mediaId: m.id,
          uri: m.presignedUrl || "",
          type: m.mediaType ?? "IMAGE",
          name: m.fileName ?? "",
        }))
      : undefined,
  };
};

/**
 * Mirrors web's ActivitiesContent.jsx sort exactly: non-admin activities
 * first, admin activities last (as two separate groups, not interleaved by
 * date across that boundary), each group sorted newest-first by rawDate.
 * This is the feed's actual base order on web — there's no separate
 * "Récents" concept there, recency-first IS the default.
 */
const sortActivitiesLikeWeb = (list: Activity[]): Activity[] =>
  [...list].sort((a, b) => {
    const aIsAdmin = (a.role || "").toLowerCase() === "admin";
    const bIsAdmin = (b.role || "").toLowerCase() === "admin";
    if (aIsAdmin !== bIsAdmin) return aIsAdmin ? 1 : -1;
    const da = a.rawDate ? new Date(a.rawDate).getTime() : 0;
    const db = b.rawDate ? new Date(b.rawDate).getTime() : 0;
    return db - da;
  });

/**
 * Facebook-style responsive media grid — mirrors web's ActivitiesContent.jsx
 * exactly: the 1/2/3/4+ layout math runs over the FULL `medias` array
 * (images and videos mixed, in their original order), not images-only. Each
 * cell (MediaItem there, here inline) picks image vs video rendering per
 * item; only image cells open the lightbox — tapping a video cell activates
 * its own inline lazy player instead (see ActivityMediaVideo).
 */
const MediaGallery = ({ medias, onImagePress }: { medias: ActivityMedia[]; onImagePress: (images: ActivityMedia[], index: number) => void }) => {
  if (medias.length === 0) return null;
  const images = medias.filter((m) => (m.type ?? "IMAGE").toUpperCase() !== "VIDEO");

  const renderItem = (media: ActivityMedia, style: object, overlay?: string) => {
    const isVideo = (media.type ?? "IMAGE").toUpperCase() === "VIDEO";
    return (
      <View key={media.id} style={[galleryStyles.item, style]}>
        {isVideo ? (
          <ActivityMediaVideo mediaId={media.mediaId} presignedUrl={media.uri || null} style={galleryStyles.image} />
        ) : (
          <ActivityMediaImage
            mediaId={media.mediaId}
            presignedUrl={media.uri || null}
            style={galleryStyles.image}
            onPress={() => onImagePress(images, images.indexOf(media))}
          />
        )}
        {overlay ? (
          <View style={galleryStyles.overlay} pointerEvents="none">
            <Text style={galleryStyles.overlayText}>{overlay}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (medias.length === 1) {
    return <View style={galleryStyles.container}>{renderItem(medias[0], galleryStyles.single)}</View>;
  }
  if (medias.length === 2) {
    return (
      <View style={[galleryStyles.container, galleryStyles.row, { height: 220 }]}>
        {renderItem(medias[0], { flex: 1 })}
        {renderItem(medias[1], { flex: 1 })}
      </View>
    );
  }
  if (medias.length === 3) {
    return (
      <View style={[galleryStyles.container, galleryStyles.row, { height: 220 }]}>
        {renderItem(medias[0], { flex: 2 })}
        <View style={{ flex: 1, gap: 2 }}>
          {renderItem(medias[1], { flex: 1 })}
          {renderItem(medias[2], { flex: 1 })}
        </View>
      </View>
    );
  }
  const shown = medias.slice(0, 4);
  const remaining = medias.length - 4;
  return (
    <View style={[galleryStyles.container, { gap: 2 }]}>
      <View style={[galleryStyles.row, { height: 150 }]}>
        {renderItem(shown[0], { flex: 1 })}
        {renderItem(shown[1], { flex: 1 })}
      </View>
      <View style={[galleryStyles.row, { height: 150 }]}>
        {renderItem(shown[2], { flex: 1 })}
        {renderItem(shown[3], { flex: 1 }, remaining > 0 ? `+${remaining}` : undefined)}
      </View>
    </View>
  );
};

/** Full-screen tap-to-view image viewer — matches web's LightboxImage/imagePreview pattern (swipe through every image in the same activity). */
const ImageLightbox = ({
  images,
  initialIndex,
  onClose,
}: {
  images: ActivityMedia[];
  initialIndex: number;
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(initialIndex);
  const screenWidth = Dimensions.get("window").width;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={lightboxStyles.overlay}>
        <TouchableOpacity style={lightboxStyles.closeButton} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <FontAwesome5 name="times" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        {images.length > 1 && (
          <View style={lightboxStyles.counter}>
            <Text style={lightboxStyles.counterText}>{index + 1} / {images.length}</Text>
          </View>
        )}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth))}
        >
          {images.map((media) => (
            <View key={media.id} style={{ width: screenWidth, justifyContent: "center", alignItems: "center" }}>
              <ActivityMediaImage
                mediaId={media.mediaId}
                presignedUrl={media.uri || null}
                style={lightboxStyles.image}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const lightboxStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" },
  closeButton: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
  counter: { position: "absolute", top: 54, alignSelf: "center", zIndex: 10 },
  counterText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  image: { width: "100%", height: "80%" },
});

const commentStyles = StyleSheet.create({
  list: { maxHeight: 320, marginTop: 8 },
  empty: { textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingVertical: 24 },
  row: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, gap: 8 },
  rowMine: { flexDirection: "row-reverse" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6B7280",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMine: { backgroundColor: "#4F46E5" },
  avatarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  bubble: {
    maxWidth: "75%",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: { backgroundColor: "#4F46E5", borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: "#111827" },
  bubbleTextMine: { color: "#FFFFFF" },
  time: { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  // Inline (Facebook-style) comment thread, expanded in place below a post
  // instead of a separate modal sheet.
  inlineSection: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  inputPillWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingLeft: 14,
    paddingRight: 4,
  },
  inputPill: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 9,
  },
  inputSendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

const DashboardActivitiesBody = () => {
  const { user } = useUser();
  const [activeFilter, setActiveFilter] = useState("tous");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Facebook-style inline comments — a post's thread expands in place below
  // it (matching web's `activity.showComments` toggle), not a separate
  // modal. Tracked as a Set of activity ids rather than one global boolean
  // so multiple posts can stay expanded independently, same as web.
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: ActivityMedia[]; index: number } | null>(null);

  const toggleComments = (activityId: string | number) => {
    const key = String(activityId);
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submitComment = async (activity: Activity) => {
    const key = String(activity.id);
    const content = (commentDrafts[key] ?? "").trim();
    if (!content) return;
    setSubmittingCommentId(key);
    try {
      const created = await activityFeedService.comment(key, content);
      const newComment: ActivityComment = {
        id: created?.id ?? `temp-${Date.now()}`,
        content,
        createdById: user?.userId,
        creationDate: created?.creationDate ?? new Date().toISOString(),
        isCurrentUser: true,
      };
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activity.id
            ? { ...a, comments: a.comments + 1, commentsList: [...(a.commentsList ?? []), newComment] }
            : a
        )
      );
      setCommentDrafts((prev) => ({ ...prev, [key]: "" }));
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du commentaire.");
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await activityFeedService.getAll();
      setActivities(sortActivitiesLikeWeb(data.map((raw) => mapApiActivity(raw, user?.userId))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des activités.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleLike = async (activity: Activity) => {
    const wasLiked = !!activity.isLiked;
    setActivities((prev) =>
      prev.map((a) => (a.id === activity.id ? { ...a, likes: wasLiked ? a.likes - 1 : a.likes + 1, isLiked: !wasLiked } : a))
    );
    try {
      await activityFeedService.like(String(activity.id));
    } catch (err) {
      setActivities((prev) =>
        prev.map((a) => (a.id === activity.id ? { ...a, likes: wasLiked ? a.likes + 1 : a.likes - 1, isLiked: wasLiked } : a))
      );
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du like.");
    }
  };

  const handleParticipate = async (activity: Activity) => {
    const wasParticipating = !!activity.isParticipating;
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activity.id
          ? {
              ...a,
              isParticipating: !wasParticipating,
              participantsCount: (a.participantsCount ?? 0) + (wasParticipating ? -1 : 1),
            }
          : a
      )
    );
    try {
      if (wasParticipating) {
        await activityFeedService.unjoin(String(activity.id));
      } else {
        await activityFeedService.join(String(activity.id));
      }
    } catch (err) {
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activity.id
            ? {
                ...a,
                isParticipating: wasParticipating,
                participantsCount: (a.participantsCount ?? 0) + (wasParticipating ? 1 : -1),
              }
            : a
        )
      );
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la participation.");
    }
  };

  const filters = [
    { id: "tous", label: "Tous" },
    { id: "evenements", label: "Événements" },
    { id: "publications", label: "Publications" },
    { id: "populaires", label: "Populaires" },
    { id: "recents", label: "Récents" },
  ];

  const filteredActivities = (() => {
    switch (activeFilter) {
      case "evenements":
        return activities.filter((a) => a.type === "event");
      case "publications":
        return activities.filter((a) => a.type === "publication");
      case "populaires":
        return [...activities].sort((a, b) => b.likes - a.likes);
      case "recents":
        return [...activities].sort((a, b) => {
          const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
          const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
          return dateB - dateA;
        });
      default:
        return activities;
    }
  })();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "#3B82F6";
      case "published":
        return "#10B981";
      case "completed":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusBackground = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "#DBEAFE";
      case "published":
        return "#D1FAE5";
      case "completed":
        return "#F3F4F6";
      default:
        return "#F3F4F6";
    }
  };

  const getCreatorInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleAddActivity = () => {
    setShowCreateModal(true);
  };

  const handleCreateActivity = (newActivity: Activity) => {
    setActivities(sortActivitiesLikeWeb([newActivity, ...activities]));
    setShowCreateModal(false);
  };

  return (
    <View style={activitiesStyles.container}>
      <ScrollView style={activitiesStyles.content}>
        {/* Header Section */}
        <View style={activitiesStyles.pageHeader}>
          <Text style={activitiesStyles.pageTitle}>Fil d'activité</Text>
          <Text style={activitiesStyles.pageSubtitle}>
            Découvrez les dernières activités et événements
          </Text>
        </View>

        {/* Filter Tabs */}
        <View style={activitiesStyles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  activitiesStyles.filterTab,
                  activeFilter === filter.id &&
                    activitiesStyles.activeFilterTab,
                ]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <Text
                  style={[
                    activitiesStyles.filterTabText,
                    activeFilter === filter.id &&
                      activitiesStyles.activeFilterTabText,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={{ color: "#EF4444", marginBottom: 12 }}>{error}</Text> : null}
        {loading ? <LoadingSpinner label="Chargement des activités..." /> : null}

        {/* Activities List */}
        <View style={activitiesStyles.activitiesList}>
          {!loading && filteredActivities.map((activity) => (
            <View key={activity.id} style={activitiesStyles.activityCard}>
              {/* Creator Info */}
              <View style={activitiesStyles.creatorSection}>
                <View style={activitiesStyles.creatorAvatar}>
                  <Text style={activitiesStyles.creatorInitials}>
                    {getCreatorInitials(activity.creator)}
                  </Text>
                </View>
                <View style={activitiesStyles.creatorInfo}>
                  <Text style={activitiesStyles.creatorName}>
                    {activity.creator}
                  </Text>
                  <View style={activitiesStyles.creatorMeta}>
                    <Text style={activitiesStyles.creatorRole}>
                      {activity.role}
                    </Text>
                    <Text style={activitiesStyles.creatorDate}>
                      • {activity.date} •
                    </Text>
                    <View
                      style={[
                        activitiesStyles.statusBadge,
                        {
                          backgroundColor: getStatusBackground(activity.status),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          activitiesStyles.statusText,
                          { color: getStatusColor(activity.status) },
                        ]}
                      >
                        {activity.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Activity Content */}
              <View style={activitiesStyles.activityContent}>
                <Text style={activitiesStyles.activityTitle}>
                  {activity.title}
                </Text>

                {/* Event Details (if it's an event) */}
                {activity.type === "event" && (
                  <View style={activitiesStyles.eventDetails}>
                    <View style={activitiesStyles.eventInfo}>
                      <View style={activitiesStyles.eventInfoRow}>
                        <FontAwesome5 name="clock" size={14} color="#6B7280" />
                        <Text style={activitiesStyles.eventInfoText}>
                          {activity.eventDate}
                        </Text>
                      </View>

                      <View style={activitiesStyles.eventInfoRow}>
                        <FontAwesome5
                          name="map-marker-alt"
                          size={14}
                          color="#6B7280"
                        />
                        <Text style={activitiesStyles.eventInfoText}>
                          {activity.location}
                        </Text>
                      </View>
                    </View>

                    <Text style={activitiesStyles.eventDescription}>
                      {activity.description}
                    </Text>
                  </View>
                )}

                {/* Publication Content */}
                {activity.type === "publication" && (
                  <Text style={activitiesStyles.publicationDescription}>
                    {activity.description}
                  </Text>
                )}
              </View>

              {/* Media Gallery (events + publications alike) — images and videos in one grid, matching web */}
              {activity.medias && activity.medias.length > 0 && (
                <MediaGallery medias={activity.medias} onImagePress={(images, index) => setLightbox({ images, index })} />
              )}

              {/* Engagement Stats */}
              {(activity.likes > 0 || (activity.participantsCount ?? 0) > 0 || activity.comments > 0) && (
                <View style={activitiesStyles.statsRow}>
                  <View style={activitiesStyles.activityStats}>
                    {activity.likes > 0 && (
                      <View style={activitiesStyles.statItem}>
                        <FontAwesome5 name="heart" size={14} color="#EF4444" solid />
                        <Text style={activitiesStyles.statText}>{activity.likes}</Text>
                      </View>
                    )}
                    {(activity.participantsCount ?? 0) > 0 && (
                      <View style={activitiesStyles.statItem}>
                        <FontAwesome5 name="user-plus" size={13} color="#10B981" />
                        <Text style={activitiesStyles.statText}>{activity.participantsCount}</Text>
                      </View>
                    )}
                  </View>
                  {activity.comments > 0 && (
                    <TouchableOpacity onPress={() => toggleComments(activity.id)}>
                      <Text style={activitiesStyles.statText}>
                        {activity.comments} commentaire{activity.comments > 1 ? "s" : ""}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Footer action bar: Like / Comment / Participate / Share */}
              <View style={activitiesStyles.footerActions}>
                <TouchableOpacity
                  style={[activitiesStyles.footerButton, activity.isLiked && activitiesStyles.footerButtonActive]}
                  onPress={() => handleLike(activity)}
                >
                  <FontAwesome5 name="heart" size={16} solid={!!activity.isLiked} color={activity.isLiked ? "#EF4444" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={activitiesStyles.footerButton}
                  onPress={() => toggleComments(activity.id)}
                >
                  <FontAwesome5 name="comment" size={16} color="#6B7280" />
                </TouchableOpacity>
                {activity.type === "event" && (
                  <TouchableOpacity
                    style={[activitiesStyles.footerButton, activity.isParticipating && activitiesStyles.footerButtonParticipating]}
                    onPress={() => handleParticipate(activity)}
                  >
                    <FontAwesome5 name="user-plus" size={16} color={activity.isParticipating ? "#10B981" : "#6B7280"} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={activitiesStyles.footerButton}
                  onPress={() => {
                    Share.share({
                      title: activity.title,
                      message: `${activity.title}\n\n${activity.description ?? ""}`,
                    }).catch(() => {});
                  }}
                >
                  <FontAwesome5 name="share" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Facebook-style inline comment thread — expands in place, matches web's activity.showComments exactly instead of a separate modal. */}
              {expandedComments.has(String(activity.id)) && (
                <View style={commentStyles.inlineSection}>
                  {(activity.commentsList?.length ?? 0) > 0 && (
                    <View style={commentStyles.list}>
                      {activity.commentsList!.map((c) => (
                        <View key={c.id} style={[commentStyles.row, c.isCurrentUser && commentStyles.rowMine]}>
                          <View style={[commentStyles.avatar, c.isCurrentUser && commentStyles.avatarMine]}>
                            <Text style={commentStyles.avatarText}>{c.isCurrentUser ? "V" : "U"}</Text>
                          </View>
                          <View style={{ flex: 1, alignItems: c.isCurrentUser ? "flex-end" : "flex-start" }}>
                            <View style={[commentStyles.bubble, c.isCurrentUser && commentStyles.bubbleMine]}>
                              <Text style={[commentStyles.bubbleText, c.isCurrentUser && commentStyles.bubbleTextMine]}>{c.content}</Text>
                            </View>
                            {c.creationDate ? (
                              <Text style={commentStyles.time}>
                                {new Date(c.creationDate).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={commentStyles.inputRow}>
                    <View style={commentStyles.avatarSmall}>
                      <Text style={commentStyles.avatarText}>V</Text>
                    </View>
                    <View style={commentStyles.inputPillWrap}>
                      <TextInput
                        style={commentStyles.inputPill}
                        value={commentDrafts[String(activity.id)] ?? ""}
                        onChangeText={(text) => setCommentDrafts((prev) => ({ ...prev, [String(activity.id)]: text }))}
                        placeholder="Écrire un commentaire..."
                        placeholderTextColor="#9CA3AF"
                        onSubmitEditing={() => submitComment(activity)}
                      />
                      <TouchableOpacity
                        style={commentStyles.inputSendButton}
                        disabled={submittingCommentId === String(activity.id) || !(commentDrafts[String(activity.id)] ?? "").trim()}
                        onPress={() => submitComment(activity)}
                      >
                        {submittingCommentId === String(activity.id) ? (
                          <FontAwesome5 name="spinner" size={13} color="#4F46E5" />
                        ) : (
                          <FontAwesome5 name="paper-plane" size={13} color="#4F46E5" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Extra space for bottom navigation */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={activitiesStyles.floatingButton}
        onPress={handleAddActivity}
      >
        <FontAwesome5 name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Activity Modal Overlay */}
      {showCreateModal && (
        <CreateActivityModal
          onClose={() => setShowCreateModal(false)}
          onCreateActivity={handleCreateActivity}
        />
      )}

      {lightbox && (
        <ImageLightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </View>
  );
};

const galleryStyles = StyleSheet.create({
  container: { marginTop: 12, borderRadius: 8, overflow: "hidden" },
  row: { flexDirection: "row", gap: 2 },
  item: { position: "relative", overflow: "hidden" },
  single: { width: "100%", height: 220 },
  image: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayText: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
});

const activitiesStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pageHeader: {
    marginTop: 20,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
  },
  activeFilterTab: {
    backgroundColor: "#4F46E5",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeFilterTabText: {
    color: "#FFFFFF",
  },
  activitiesList: {
    marginBottom: 20,
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  creatorSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  creatorInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  creatorMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  creatorRole: {
    fontSize: 12,
    color: "#6B7280",
    marginRight: 8,
  },
  creatorDate: {
    fontSize: 12,
    color: "#6B7280",
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  activityContent: {
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  eventDetails: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#4F46E5",
  },
  eventInfo: {
    marginBottom: 8,
  },
  eventInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  eventInfoText: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 8,
  },
  eventDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  publicationDescription: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  activityStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: "#6B7280",
  },
  footerActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  footerButtonActive: {
    backgroundColor: "#FEF2F2",
  },
  footerButtonParticipating: {
    backgroundColor: "#ECFDF5",
  },
  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default DashboardActivitiesBody;
