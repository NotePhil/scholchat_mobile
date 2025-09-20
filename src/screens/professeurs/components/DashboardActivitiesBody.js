import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import CreateActivityModal from "./CreateActivityModal";

const DashboardActivitiesBody = () => {
  const [activeFilter, setActiveFilter] = useState("tous");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activities, setActivities] = useState([
    {
      id: 1,
      type: "event",
      creator: "Event Creator",
      role: "Professeur",
      date: "12/20/2024",
      status: "Scheduled",
      title: "Sortie pédagogique: Visite du musée national",
      eventDate: "20/12/2024 09:00:00",
      location: "Musée National",
      participants: "9 participant(s)",
      description: "Visite du musée national",
      likes: 1,
      shares: 15,
    },
    {
      id: 2,
      type: "publication",
      creator: "Marie Dupont",
      role: "Professeur",
      date: "12/19/2024",
      status: "Published",
      title: "Nouveau cours de mathématiques disponible",
      description:
        "Un nouveau cours sur les équations du second degré est maintenant disponible dans la section cours.",
      likes: 8,
      shares: 3,
    },
    {
      id: 3,
      type: "event",
      creator: "Pierre Martin",
      role: "Directeur",
      date: "12/18/2024",
      status: "Completed",
      title: "Réunion parents-professeurs",
      eventDate: "18/12/2024 14:30:00",
      location: "Salle de conférence",
      participants: "25 participant(s)",
      description: "Réunion trimestrielle avec les parents d'élèves",
      likes: 12,
      shares: 7,
    },
    {
      id: 4,
      type: "publication",
      creator: "Sophie Bernard",
      role: "Professeur",
      date: "12/17/2024",
      status: "Published",
      title: "Résultats du concours de sciences",
      description:
        "Félicitations aux gagnants du concours de sciences naturelles. Les résultats sont affichés.",
      likes: 15,
      shares: 20,
    },
  ]);

  const filters = [
    { id: "tous", label: "Tous" },
    { id: "evenements", label: "Événements" },
    { id: "publications", label: "Publications" },
    { id: "populaires", label: "Populaires" },
    { id: "recents", label: "Récents" },
  ];

  const getStatusColor = (status) => {
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

  const getStatusBackground = (status) => {
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

  const getCreatorInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleAddActivity = () => {
    setShowCreateModal(true);
  };

  const handleCreateActivity = (newActivity) => {
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

        {/* Activities List */}
        <View style={activitiesStyles.activitiesList}>
          {activities.map((activity) => (
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
                        {activity.medias.slice(0, 3).map((media, index) => (
                          <Image
                            key={media.id}
                            source={{ uri: media.uri }}
                            style={[
                              activitiesStyles.mediaImage,
                              activity.medias.length === 1 &&
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
                        {activity.medias.slice(0, 3).map((media, index) => (
                          <Image
                            key={media.id}
                            source={{ uri: media.uri }}
                            style={[
                              activitiesStyles.mediaImage,
                              activity.medias.length === 1 &&
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
                    <Text style={activitiesStyles.shareText}>
                      {activity.shares} partages
                    </Text>
                  </View>
                </View>

                <View style={activitiesStyles.actionButtons}>
                  <TouchableOpacity style={activitiesStyles.actionButton}>
                    <FontAwesome5 name="heart" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity style={activitiesStyles.actionButton}>
                    <FontAwesome5 name="comment" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity style={activitiesStyles.actionButton}>
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
