import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Share,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import CreateActivityModal, { Activity } from "./CreateActivityModal";
import { activityFeedService } from "../../../services/api";
import { BottomSheet, Button, Input, LoadingSpinner } from "../../../components/ui";

/**
 * Maps the backend's `Evenement` model to this screen's display shape.
 * `interactions` holds both likes and comments (distinguished by `type`),
 * there's no `shares` concept on the backend, and media URLs come from
 * `presignedUrl` (falling back to a constructed content URL by id).
 */
const mapApiActivity = (raw: Record<string, any>): Activity => {
  const interactions: any[] = Array.isArray(raw.interactions) ? raw.interactions : [];
  const likeCount = interactions.filter((i) => i.type === "LIKE").length;
  const commentCount = interactions.filter((i) => i.type === "COMMENT").length;

  return {
    id: raw.id,
    type: raw.heureDebut ? "event" : "publication",
    creator: `${raw.createurPrenom ?? ""} ${raw.createurNom ?? ""}`.trim() || "Utilisateur",
    role: raw.createurRole ?? "Membre",
    date: raw.heureDebut ? new Date(raw.heureDebut).toLocaleDateString("fr-FR") : "",
    rawDate: raw.heureDebut,
    status: raw.etat === "PASSE" ? "Completed" : raw.etat === "A_VENIR" || raw.etat === "PLANIFIE" ? "Scheduled" : "Published",
    title: raw.titre ?? "",
    eventDate: raw.heureDebut ? new Date(raw.heureDebut).toLocaleString("fr-FR") : undefined,
    location: raw.lieu,
    participants: Array.isArray(raw.participantsIds) ? `${raw.participantsIds.length} participant(s)` : undefined,
    description: raw.description ?? "",
    likes: likeCount,
    comments: commentCount,
    medias: Array.isArray(raw.medias)
      ? raw.medias.map((m: any, i: number) => ({
          id: m.id ?? String(i),
          uri: m.presignedUrl || m.filePath || "",
          type: m.mediaType ?? "IMAGE",
          name: m.fileName ?? "",
        }))
      : undefined,
  };
};

const DashboardActivitiesBody = () => {
  const [activeFilter, setActiveFilter] = useState("tous");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentingActivity, setCommentingActivity] = useState<Activity | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await activityFeedService.getAll();
      setActivities(data.map(mapApiActivity));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des activités.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleLike = async (activity: Activity) => {
    setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, likes: a.likes + 1 } : a)));
    try {
      await activityFeedService.like(String(activity.id));
    } catch (err) {
      // revert on failure
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, likes: a.likes - 1 } : a)));
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du like.");
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
    // Add the new activity at the beginning of the list
    setActivities([newActivity, ...activities]);
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
                    <View style={activitiesStyles.eventHeader}>
                      <FontAwesome5
                        name="calendar-alt"
                        size={16}
                        color="#4F46E5"
                        style={activitiesStyles.eventIcon}
                      />
                      <Text style={activitiesStyles.eventTitle}>
                        {activity.title.split(":")[1]?.trim() || activity.title}
                      </Text>
                    </View>

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

                      <View style={activitiesStyles.eventInfoRow}>
                        <FontAwesome5 name="users" size={14} color="#6B7280" />
                        <Text style={activitiesStyles.eventInfoText}>
                          {activity.participants}
                        </Text>
                      </View>
                    </View>

                    <Text style={activitiesStyles.eventDescription}>
                      {activity.description}
                    </Text>

                    {/* Display Media Images */}
                    {activity.medias && activity.medias.length > 0 && (
                      <View style={activitiesStyles.mediaContainer}>
                        {activity.medias.slice(0, 3).map((media) => (
                          <Image
                            key={media.id}
                            source={{ uri: media.uri }}
                            style={[
                              activitiesStyles.mediaImage,
                              activity.medias!.length === 1 &&
                                activitiesStyles.singleImage,
                            ]}
                          />
                        ))}
                        {activity.medias.length > 3 && (
                          <View style={activitiesStyles.moreImagesOverlay}>
                            <Text style={activitiesStyles.moreImagesText}>
                              +{activity.medias.length - 3}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {activity.status.toLowerCase() === "scheduled" && (
                      <TouchableOpacity
                        style={activitiesStyles.participateButton}
                        onPress={async () => {
                          try {
                            await activityFeedService.join(String(activity.id));
                            Alert.alert("Inscrit", "Votre participation a été enregistrée.");
                          } catch (err) {
                            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'inscription.");
                          }
                        }}
                      >
                        <FontAwesome5
                          name="user-plus"
                          size={14}
                          color="#FFFFFF"
                        />
                        <Text style={activitiesStyles.participateButtonText}>
                          Participer
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Publication Content */}
                {activity.type === "publication" && (
                  <View>
                    <Text style={activitiesStyles.publicationDescription}>
                      {activity.description}
                    </Text>

                    {/* Display Media Images for Publications */}
                    {activity.medias && activity.medias.length > 0 && (
                      <View style={activitiesStyles.mediaContainer}>
                        {activity.medias.slice(0, 3).map((media) => (
                          <Image
                            key={media.id}
                            source={{ uri: media.uri }}
                            style={[
                              activitiesStyles.mediaImage,
                              activity.medias!.length === 1 &&
                                activitiesStyles.singleImage,
                            ]}
                          />
                        ))}
                        {activity.medias.length > 3 && (
                          <View style={activitiesStyles.moreImagesOverlay}>
                            <Text style={activitiesStyles.moreImagesText}>
                              +{activity.medias.length - 3}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Activity Actions */}
              <View style={activitiesStyles.activityActions}>
                <View style={activitiesStyles.activityStats}>
                  <View style={activitiesStyles.statItem}>
                    <FontAwesome5 name="heart" size={16} color="#EF4444" />
                    <Text style={activitiesStyles.statText}>
                      {activity.likes}
                    </Text>
                  </View>
                  <View style={activitiesStyles.statItem}>
                    <FontAwesome5 name="comment" size={14} color="#6B7280" />
                    <Text style={activitiesStyles.statText}>{activity.comments}</Text>
                  </View>
                </View>

                <View style={activitiesStyles.actionButtons}>
                  <TouchableOpacity style={activitiesStyles.actionButton} onPress={() => handleLike(activity)}>
                    <FontAwesome5 name="heart" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={activitiesStyles.actionButton}
                    onPress={() => {
                      setCommentText("");
                      setCommentingActivity(activity);
                    }}
                  >
                    <FontAwesome5 name="comment" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={activitiesStyles.actionButton}
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
              </View>
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

      <BottomSheet visible={!!commentingActivity} onClose={() => setCommentingActivity(null)} title="Commenter">
        <Input
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Votre commentaire"
          multiline
          numberOfLines={3}
        />
        <Button
          label="Envoyer"
          loading={submittingComment}
          onPress={async () => {
            if (!commentingActivity || !commentText.trim()) return;
            setSubmittingComment(true);
            try {
              await activityFeedService.comment(String(commentingActivity.id), commentText.trim());
              setActivities((prev) =>
                prev.map((a) => (a.id === commentingActivity.id ? { ...a, comments: a.comments + 1 } : a))
              );
              setCommentingActivity(null);
            } catch (err) {
              Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du commentaire.");
            } finally {
              setSubmittingComment(false);
            }
          }}
          fullWidth
          style={{ marginTop: 12, marginBottom: 24 }}
        />
      </BottomSheet>
    </View>
  );
};

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
    marginBottom: 16,
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
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  eventIcon: {
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  eventInfo: {
    marginBottom: 12,
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
    marginBottom: 12,
    lineHeight: 18,
  },
  participateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  participateButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  publicationDescription: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  mediaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  mediaImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  singleImage: {
    width: "100%",
    height: 200,
  },
  moreImagesOverlay: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 0,
  },
  moreImagesText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  activityActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  activityStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 4,
  },
  shareText: {
    fontSize: 14,
    color: "#6B7280",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
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
