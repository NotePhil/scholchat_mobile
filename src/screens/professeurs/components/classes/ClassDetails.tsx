import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { classService } from "../../../../services/classService";
import {
  activityFeedService,
  classAdminService,
  coursProgrammerService,
  exerciseProgrammerService,
  parentService,
  professorService,
  publicationRightsService,
  studentService,
  userService,
} from "../../../../services/api";
import { Badge, LoadingSpinner } from "../../../../components/ui";
import OffreInfoPanel from "../../../../components/common/OffreInfoPanel";
import { Professor, ClassUser, CoursProgramme, ExerciseProgramme, ActivityEvent } from "../../../../types";
import { UIClass, FormattedAccessRequest } from "./DashboardClassesBody";

interface ProfileUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  niveau?: string;
  matricule?: string;
  type?: string;
}

type SystemUserType = "professeurs" | "eleves" | "parents" | "utilisateurs";

const formatShortDate = (dateString?: string) => (dateString ? new Date(dateString).toLocaleDateString("fr-FR") : "N/A");
const isActiveState = (etat?: string) => etat === "ACTIVE" || etat === "ACTIF";

interface ClassDetailsProps {
  selectedClass: UIClass;
  onBack: () => void;
  activeDetailTab: string;
  setActiveDetailTab: (tab: string) => void;
  onRefresh?: () => void | Promise<void>;
  /** Admin's "Gérer une Classe" hides Cours/Exercices tabs — matches ManageClassDetailsView.jsx's tab list exactly. */
  isAdmin?: boolean;
}

const ClassDetails = ({
  selectedClass,
  onBack,
  activeDetailTab,
  setActiveDetailTab,
  onRefresh,
  isAdmin,
}: ClassDetailsProps) => {
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileUser | null>(null);
  const [showModeratorModal, setShowModeratorModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Professor[]>([]);
  const [selectedModerator, setSelectedModerator] = useState<Professor | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FormattedAccessRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showModeratorsModal, setShowModeratorsModal] = useState(false);
  const [showRightsModal, setShowRightsModal] = useState(false);
  const [rightsTargetUser, setRightsTargetUser] = useState<ProfileUser | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [history, setHistory] = useState<Record<string, any>[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [courses, setCourses] = useState<CoursProgramme[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [exercises, setExercises] = useState<ExerciseProgramme[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (activeDetailTab !== "courses") return;
    setLoadingCourses(true);
    coursProgrammerService
      .getByClasse(selectedClass.id)
      .then(setCourses)
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false));
  }, [activeDetailTab, selectedClass.id]);

  useEffect(() => {
    if (activeDetailTab !== "exercises") return;
    setLoadingExercises(true);
    exerciseProgrammerService
      .getByClasse(selectedClass.id)
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoadingExercises(false));
  }, [activeDetailTab, selectedClass.id]);

  useEffect(() => {
    if (activeDetailTab !== "events") return;
    setLoadingEvents(true);
    activityFeedService
      .getAll()
      .then((all) => setEvents(all.filter((e) => (e.classesIds ?? []).includes(selectedClass.id))))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [activeDetailTab, selectedClass.id]);

  useEffect(() => {
    if (activeDetailTab !== "history") return;
    setLoadingHistory(true);
    setHistoryError("");
    classAdminService
      .getActivationHistory(selectedClass.id)
      .then(setHistory)
      .catch((err) => setHistoryError(err instanceof Error ? err.message : "Échec du chargement de l'historique."))
      .finally(() => setLoadingHistory(false));
  }, [activeDetailTab, selectedClass.id]);
  const [isSavingRights, setIsSavingRights] = useState(false);
  const [moderators, setModerators] = useState<ClassUser[]>([]);
  const [isLoadingModerators, setIsLoadingModerators] = useState(false);

  const getStateColor = (state: string) => {
    return state === "ACTIVE" ? "#10B981" : "#6B7280";
  };

  const getStateBackground = (state: string) => {
    return state === "ACTIVE" ? "#D1FAE5" : "#F3F4F6";
  };

  const getStateText = (state: string) => {
    return state === "ACTIVE" ? "Active" : "Inactive";
  };

  // Mirrors web's getPublicationRightsTag() label map exactly.
  const PUBLICATION_RIGHTS_LABELS: Record<string, string> = {
    TOUS: "Tous peuvent publier",
    MODERATEUR_SEULEMENT: "Modérateur seulement",
    PARENTS_ET_MODERATEUR: "Parents et modérateur",
    PROFESSEURS_SEULEMENT: "Professeurs seulement",
  };
  const getPublicationRightsLabel = (droit?: string) =>
    (droit && PUBLICATION_RIGHTS_LABELS[droit]) || droit || "Non défini";

  const handleViewProfile = (user: ProfileUser) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleRemoveAccess = (user: ProfileUser) => {
    Alert.alert(
      "Confirmer la suppression",
      `Êtes-vous sûr de vouloir retirer l'accès à ${user.name} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => removeUserAccess(user.id),
        },
      ]
    );
  };

  const removeUserAccess = async (userId: string) => {
    try {
      await classService.removeUserAccess(userId, selectedClass.id);
      Alert.alert("Succès", "L'accès a été retiré avec succès");
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error removing user access:', error);
      Alert.alert("Erreur", "Impossible de retirer l'accès");
    }
  };

  /** Admin-only, matches web's UserTables handleDeleteUser — removes the user from the whole system, not just this class's access list. Irreversible. */
  const handleDeleteFromSystem = (user: ProfileUser, userType: SystemUserType) => {
    Alert.alert(
      "Supprimer définitivement",
      `Supprimer complètement ${user.name} du système ? Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              if (userType === "professeurs") await professorService.remove(user.id);
              else if (userType === "eleves") await studentService.remove(user.id);
              else if (userType === "parents") await parentService.remove(user.id);
              else await userService.deleteUser(user.id);
              Alert.alert("Succès", "Utilisateur supprimé du système.");
              if (onRefresh) onRefresh();
            } catch (error) {
              Alert.alert("Erreur", error instanceof Error ? error.message : "Impossible de supprimer cet utilisateur.");
            }
          },
        },
      ]
    );
  };

  const handleOpenRights = (user: ProfileUser) => {
    setRightsTargetUser(user);
    setCanPublish(false);
    setCanModerate(false);
    setShowRightsModal(true);
    publicationRightsService
      .get(selectedClass.id, user.id)
      .then((right) => {
        setCanPublish(!!right?.peutPublier);
        setCanModerate(!!right?.peutModerer);
      })
      .catch(() => {
        // No existing right record — leave both switches off (defaults for a new grant).
      });
  };

  const handleSaveRights = async () => {
    if (!rightsTargetUser) return;
    setIsSavingRights(true);
    try {
      await publicationRightsService.assign(rightsTargetUser.id, selectedClass.id, canPublish, canModerate);
      Alert.alert('Succès', 'Droits de publication mis à jour.');
      setShowRightsModal(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      Alert.alert('Erreur', "Impossible de mettre à jour les droits.");
    } finally {
      setIsSavingRights(false);
    }
  };

  const handleSearchProfessors = async (term: string) => {
    setSearchTerm(term);
    if (term.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await classService.searchProfessors(term);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching professors:', error);
      Alert.alert('Erreur', 'Impossible de rechercher les professeurs');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectModerator = (professor: Professor) => {
    setSelectedModerator(professor);
  };

  const handleAssignModerator = async () => {
    if (!selectedModerator) {
      Alert.alert('Erreur', 'Veuillez sélectionner un modérateur');
      return;
    }

    setIsAssigning(true);
    try {
      await classService.assignModerator(selectedClass.id, selectedModerator.id);
      setShowModeratorModal(false);
      setSelectedModerator(null);
      setSearchTerm('');
      setSearchResults([]);
      setShowSuccessModal(true);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error assigning moderator:', error);
      Alert.alert('Erreur', 'Impossible d\'assigner le modérateur');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCancelModeratorAssignment = () => {
    setShowModeratorModal(false);
    setSelectedModerator(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleViewRequestDetails = (request: FormattedAccessRequest) => {
    setSelectedRequest(request);
    setShowRequestDetails(true);
  };

  const handleApproveRequest = (request: FormattedAccessRequest) => {
    Alert.alert(
      'Confirmer l\'approbation',
      `Êtes-vous sûr de vouloir approuver la demande de ${request.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver',
          onPress: () => approveRequest(request.id),
        },
      ]
    );
  };

  const handleRejectRequest = (request: FormattedAccessRequest) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const approveRequest = async (requestId: string) => {
    try {
      await classService.approveAccessRequest(requestId);
      Alert.alert('Succès', 'Demande approuvée avec succès');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error approving request:', error);
      let errorMessage = 'Impossible d\'approuver la demande';
      if (error?.message?.includes('EN_ATTENTE')) {
        errorMessage = 'Cette demande a déjà été traitée ou n\'est plus en attente';
      }
      Alert.alert('Erreur', errorMessage);
    }
  };

  const rejectRequest = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un motif de rejet');
      return;
    }
    if (!selectedRequest) return;

    try {
      await classService.rejectAccessRequest(selectedRequest.id, rejectionReason);
      Alert.alert('Succès', 'Demande rejetée avec succès');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      let errorMessage = 'Impossible de rejeter la demande';
      if (error?.message?.includes('EN_ATTENTE')) {
        errorMessage = 'Cette demande a déjà été traitée ou n\'est plus en attente';
      }
      Alert.alert('Erreur', errorMessage);
    }
  };

  const handleViewModerators = async () => {
    setIsLoadingModerators(true);
    setShowModeratorsModal(true);
    try {
      const moderatorsData = await classService.getClassModerators(selectedClass.id);
      setModerators(moderatorsData);
    } catch (error) {
      console.error('Error fetching moderators:', error);
      Alert.alert('Erreur', 'Impossible de charger les modérateurs');
    } finally {
      setIsLoadingModerators(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Détails de la classe</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.content}>
        {/* Class Info Card */}
        <View style={styles.classInfoCard}>
          <View style={styles.classIcon}>
            <Text style={styles.classIconText}>
              {selectedClass.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.classInfoContent}>
            <Text style={styles.className} numberOfLines={2}>
              {selectedClass.name}
            </Text>
            <Text style={styles.classLevel} numberOfLines={1}>
              Niveau: {selectedClass.level}
            </Text>
            <View style={styles.classMetaRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStateBackground(selectedClass.state) },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStateColor(selectedClass.state) },
                  ]}
                >
                  {getStateText(selectedClass.state)}
                </Text>
              </View>
              <Text style={styles.classDate} numberOfLines={1}>
                Créée le{" "}
                {new Date(selectedClass.creationDate).toLocaleDateString(
                  "fr-FR"
                )}
              </Text>
            </View>
          </View>
        </View>
        {/* Detail Tabs — matches web's ManageClassDetailsView.jsx TabScrollBar exactly:
            Aperçu, Professeurs, Élèves, Parents, Utilisateurs, Demandes, [Cours, Exercices — hidden for Admin], Événements. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={{ flexDirection: "row" }}>
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "info" && styles.activeTab]}
            onPress={() => setActiveDetailTab("info")}
          >
            <Text
              style={[
                styles.tabText,
                activeDetailTab === "info" && styles.activeTabText,
              ]}
            >
              Aperçu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "professeurs" && styles.activeTab]}
            onPress={() => setActiveDetailTab("professeurs")}
          >
            <Text style={[styles.tabText, activeDetailTab === "professeurs" && styles.activeTabText]}>
              Professeurs ({selectedClass.professeurs?.length ?? 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "eleves" && styles.activeTab]}
            onPress={() => setActiveDetailTab("eleves")}
          >
            <Text style={[styles.tabText, activeDetailTab === "eleves" && styles.activeTabText]}>
              Élèves ({selectedClass.students.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "parents" && styles.activeTab]}
            onPress={() => setActiveDetailTab("parents")}
          >
            <Text style={[styles.tabText, activeDetailTab === "parents" && styles.activeTabText]}>
              Parents ({selectedClass.parents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "utilisateurs" && styles.activeTab]}
            onPress={() => setActiveDetailTab("utilisateurs")}
          >
            <Text style={[styles.tabText, activeDetailTab === "utilisateurs" && styles.activeTabText]}>
              Utilisateurs ({selectedClass.others?.length ?? 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "access-requests" && styles.activeTab]}
            onPress={() => setActiveDetailTab("access-requests")}
          >
            <Text style={[styles.tabText, activeDetailTab === "access-requests" && styles.activeTabText]}>
              Demandes ({selectedClass.accessRequests.length})
            </Text>
          </TouchableOpacity>
          {!isAdmin && (
            <TouchableOpacity
              style={[styles.tab, activeDetailTab === "courses" && styles.activeTab]}
              onPress={() => setActiveDetailTab("courses")}
            >
              <Text style={[styles.tabText, activeDetailTab === "courses" && styles.activeTabText]}>
                Cours ({courses.length})
              </Text>
            </TouchableOpacity>
          )}
          {!isAdmin && (
            <TouchableOpacity
              style={[styles.tab, activeDetailTab === "exercises" && styles.activeTab]}
              onPress={() => setActiveDetailTab("exercises")}
            >
              <Text style={[styles.tabText, activeDetailTab === "exercises" && styles.activeTabText]}>
                Exercices ({exercises.length})
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.tab, activeDetailTab === "events" && styles.activeTab]}
            onPress={() => setActiveDetailTab("events")}
          >
            <Text style={[styles.tabText, activeDetailTab === "events" && styles.activeTabText]}>
              Événements ({events.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeDetailTab === "history" && styles.activeTab,
            ]}
            onPress={() => setActiveDetailTab("history")}
          >
            <Text
              style={[
                styles.tabText,
                activeDetailTab === "history" && styles.activeTabText,
              ]}
            >
              Historique
            </Text>
          </TouchableOpacity>
        </ScrollView>
        {/* Tab Content */}
        {activeDetailTab === "info" && (
          <View style={styles.tabContent}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Informations générales</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>ID:</Text>
                <Text style={styles.infoValue} selectable numberOfLines={1}>
                  {selectedClass.id}
                </Text>
              </View>
              {/* Code d'activation — the invite code students/parents need to join; was previously not shown at all. */}
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Code d'activation:</Text>
                <Text style={[styles.infoValue, styles.codeValue]} selectable>
                  {selectedClass.codeActivation || "Non défini"}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Modérateur:</Text>
                <Text style={styles.infoValue}>{selectedClass.moderator}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Droits de publication:</Text>
                <Text style={styles.infoValue}>
                  {getPublicationRightsLabel(selectedClass.droitPublication)}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Accès majeur:</Text>
                <View
                  style={[
                    styles.accesMajeurBadge,
                    selectedClass.accesMajeur ? styles.accesMajeurBadgeOn : styles.accesMajeurBadgeOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.accesMajeurBadgeText,
                      { color: selectedClass.accesMajeur ? "#7C3AED" : "#94A3B8" },
                    ]}
                  >
                    {selectedClass.accesMajeur ? "Classe Majeure — email" : "Accès standard"}
                  </Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Établissement:</Text>
                <Text style={styles.infoValue}>
                  {selectedClass.etablissement}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Description:</Text>
                <Text style={styles.infoValue}>
                  {selectedClass.description || "Aucune description"}
                </Text>
              </View>
            </View>
            <View style={styles.moderatorButtonsContainer}>
              <TouchableOpacity
                style={styles.viewModeratorsButton}
                onPress={handleViewModerators}
              >
                <FontAwesome5 name="users" size={16} color="#4F46E5" />
                <Text style={styles.viewModeratorsButtonText}>Voir les modérateurs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addModeratorButton}
                onPress={() => setShowModeratorModal(true)}
              >
                <FontAwesome5 name="user-plus" size={16} color="#FFFFFF" />
                <Text style={styles.addModeratorButtonText}>Ajouter un modérateur</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 16 }}>
              <OffreInfoPanel type="CLASSE" entityId={selectedClass.id} />
            </View>
          </View>
        )}
        {activeDetailTab === "eleves" && (
          <View style={styles.tabContent}>
            <View style={styles.manageSection}>
              {selectedClass.students.length > 0 ? (
                selectedClass.students.map((student) => (
                  <View key={student.id} style={styles.listItem}>
                    <View style={styles.listItemAvatar}>
                      <FontAwesome5
                        name="user-graduate"
                        size={14}
                        color="#4F46E5"
                      />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{student.name}</Text>
                      <Text style={styles.listItemEmail}>{student.email}</Text>
                      <Text style={styles.listItemMeta}>
                        Niveau: {student.niveau} · Inscrit le {formatShortDate(student.dateCreation)}
                      </Text>
                      {student.etat ? (
                        <Badge label={isActiveState(student.etat) ? "Actif" : "Inactif"} tone={isActiveState(student.etat) ? "success" : "danger"} />
                      ) : null}
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => handleViewProfile(student)}
                      >
                        <FontAwesome5 name="eye" size={12} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => handleOpenRights(student)}
                      >
                        <FontAwesome5 name="user-shield" size={12} color="#8B5CF6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveAccess(student)}
                      >
                        <FontAwesome5 name="times" size={12} color="#EF4444" />
                      </TouchableOpacity>
                      {isAdmin ? (
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleDeleteFromSystem(student, "eleves")}
                        >
                          <FontAwesome5 name="trash" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucun élève trouvé</Text>
              )}
            </View>
          </View>
        )}
        {activeDetailTab === "parents" && (
          <View style={styles.tabContent}>
            <View style={styles.manageSection}>
              {selectedClass.parents.length > 0 ? (
                selectedClass.parents.map((parent) => (
                  <View key={parent.id} style={styles.listItem}>
                    <View style={styles.listItemAvatar}>
                      <FontAwesome5 name="user" size={14} color="#10B981" />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{parent.name}</Text>
                      <Text style={styles.listItemEmail}>{parent.phone}</Text>
                      <Text style={styles.listItemMeta}>
                        {parent.adresse ? `${parent.adresse} · ` : ""}Inscrit le {formatShortDate(parent.dateCreation)}
                      </Text>
                      {parent.etat ? (
                        <Badge label={isActiveState(parent.etat) ? "Actif" : "Inactif"} tone={isActiveState(parent.etat) ? "success" : "danger"} />
                      ) : null}
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => handleViewProfile(parent)}
                      >
                        <FontAwesome5 name="eye" size={12} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => handleOpenRights(parent)}
                      >
                        <FontAwesome5 name="user-shield" size={12} color="#8B5CF6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveAccess(parent)}
                      >
                        <FontAwesome5 name="times" size={12} color="#EF4444" />
                      </TouchableOpacity>
                      {isAdmin ? (
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleDeleteFromSystem(parent, "parents")}
                        >
                          <FontAwesome5 name="trash" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucun parent trouvé</Text>
              )}
            </View>
          </View>
        )}
        {activeDetailTab === "professeurs" && (
          <View style={styles.tabContent}>
            <View style={styles.manageSection}>
              {selectedClass.professeurs && selectedClass.professeurs.length > 0 ? (
                selectedClass.professeurs.map((prof) => {
                  const profProfile: ProfileUser = {
                    id: prof.id,
                    name: `${prof.prenom ?? ""} ${prof.nom ?? ""}`.trim() || "Professeur",
                    email: prof.email,
                    type: prof.typeUtilisateur,
                  };
                  const nomEtablissement = (prof as any).nomEtablissement;
                  const matricule = (prof as any).matriculeProfesseur;
                  const dateCreation = (prof as any).dateCreation || (prof as any).creationDate;
                  const etat = (prof as any).etat;
                  return (
                    <View key={prof.id} style={styles.listItem}>
                      <View style={styles.listItemAvatar}>
                        <FontAwesome5 name="chalkboard-teacher" size={14} color="#8B5CF6" />
                      </View>
                      <View style={styles.listItemInfo}>
                        <Text style={styles.listItemName}>{profProfile.name}</Text>
                        <Text style={styles.listItemEmail}>{prof.email ?? ""}</Text>
                        <Text style={styles.listItemMeta}>
                          {nomEtablissement ? `${nomEtablissement} · ` : ""}
                          {matricule ? `Matricule: ${matricule} · ` : ""}
                          Depuis le {formatShortDate(dateCreation)}
                        </Text>
                        {etat ? (
                          <Badge label={isActiveState(etat) ? "Actif" : "Inactif"} tone={isActiveState(etat) ? "success" : "danger"} />
                        ) : null}
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.eyeButton} onPress={() => handleViewProfile(profProfile)}>
                          <FontAwesome5 name="eye" size={12} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.eyeButton} onPress={() => handleOpenRights(profProfile)}>
                          <FontAwesome5 name="user-shield" size={12} color="#8B5CF6" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveAccess(profProfile)}>
                          <FontAwesome5 name="times" size={12} color="#EF4444" />
                        </TouchableOpacity>
                        {isAdmin ? (
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleDeleteFromSystem(profProfile, "professeurs")}
                          >
                            <FontAwesome5 name="trash" size={12} color="#EF4444" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Aucun professeur trouvé</Text>
              )}
            </View>
          </View>
        )}
        {activeDetailTab === "utilisateurs" && (
          <View style={styles.tabContent}>
            <View style={styles.manageSection}>
              {selectedClass.others && selectedClass.others.length > 0 ? (
                selectedClass.others.map((other) => {
                  const otherProfile: ProfileUser = {
                    id: other.id,
                    name: `${other.prenom ?? ""} ${other.nom ?? ""}`.trim() || "Utilisateur",
                    email: other.email,
                    type: other.typeUtilisateur,
                  };
                  const adresse = (other as any).adresse;
                  const userTypeLabel = (other as any).type === "utilisateur" ? "Utilisateur" : (other as any).type;
                  const isSystemAdmin = !!(other as any).admin;
                  const dateCreation = (other as any).dateCreation || (other as any).creationDate;
                  const etat = (other as any).etat;
                  return (
                    <View key={other.id} style={styles.listItem}>
                      <View style={styles.listItemAvatar}>
                        <FontAwesome5 name="user-circle" size={14} color="#6B7280" />
                      </View>
                      <View style={styles.listItemInfo}>
                        <Text style={styles.listItemName}>{otherProfile.name}</Text>
                        <Text style={styles.listItemEmail}>{other.email ?? ""}</Text>
                        <Text style={styles.listItemMeta}>
                          {adresse ? `${adresse} · ` : ""}Depuis le {formatShortDate(dateCreation)}
                        </Text>
                        <View style={styles.metaBadgeRow}>
                          {userTypeLabel ? <Badge label={userTypeLabel} tone="neutral" /> : null}
                          <Badge label={isSystemAdmin ? "Admin" : "Non admin"} tone={isSystemAdmin ? "warning" : "neutral"} />
                          {etat ? <Badge label={isActiveState(etat) ? "Actif" : "Inactif"} tone={isActiveState(etat) ? "success" : "danger"} /> : null}
                        </View>
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.eyeButton} onPress={() => handleViewProfile(otherProfile)}>
                          <FontAwesome5 name="eye" size={12} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.eyeButton} onPress={() => handleOpenRights(otherProfile)}>
                          <FontAwesome5 name="user-shield" size={12} color="#8B5CF6" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveAccess(otherProfile)}>
                          <FontAwesome5 name="times" size={12} color="#EF4444" />
                        </TouchableOpacity>
                        {isAdmin ? (
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleDeleteFromSystem(otherProfile, "utilisateurs")}
                          >
                            <FontAwesome5 name="trash" size={12} color="#EF4444" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
              )}
            </View>
          </View>
        )}
        {activeDetailTab === "access-requests" && (
          <View style={styles.tabContent}>
            <View style={styles.manageSection}>
              {selectedClass.accessRequests.length > 0 ? (
                selectedClass.accessRequests.map((request) => (
                  <View key={request.id} style={styles.requestItem}>
                    <View style={styles.listItemAvatar}>
                      <FontAwesome5
                        name="user-clock"
                        size={14}
                        color="#F59E0B"
                      />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{request.name}</Text>
                      <Text style={styles.listItemEmail}>
                        {request.role} • {request.date}
                      </Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => handleViewRequestDetails(request)}
                      >
                        <FontAwesome5 name="eye" size={12} color="#6B7280" />
                      </TouchableOpacity>
                      {request.status === 'EN_ATTENTE' && (
                        <>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleApproveRequest(request)}
                          >
                            <FontAwesome5 name="check" size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() => handleRejectRequest(request)}
                          >
                            <FontAwesome5 name="times" size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucune demande d'accès</Text>
              )}
            </View>
          </View>
        )}
        {activeDetailTab === "courses" && !isAdmin && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Cours programmés</Text>
            {loadingCourses ? (
              <LoadingSpinner label="Chargement des cours..." />
            ) : courses.length === 0 ? (
              <Text style={styles.emptyText}>Aucun cours programmé pour cette classe.</Text>
            ) : (
              courses.map((c) => (
                <View key={c.id} style={styles.historyItem}>
                  <FontAwesome5 name="book-open" size={16} color="#0EA5E9" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.infoValue}>{c.description ?? "Cours"}</Text>
                    <Text style={styles.infoLabel}>
                      {c.dateCoursPrevue ? new Date(c.dateCoursPrevue).toLocaleString("fr-FR") : ""}
                      {c.etatCoursProgramme ? ` • ${c.etatCoursProgramme}` : ""}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        {activeDetailTab === "exercises" && !isAdmin && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Exercices programmés</Text>
            {loadingExercises ? (
              <LoadingSpinner label="Chargement des exercices..." />
            ) : exercises.length === 0 ? (
              <Text style={styles.emptyText}>Aucun exercice programmé pour cette classe.</Text>
            ) : (
              exercises.map((ex) => (
                <View key={ex.id} style={styles.historyItem}>
                  <FontAwesome5 name={ex.typeAssignation === "DEVOIR" ? "file-alt" : "clipboard-list"} size={16} color="#7C3AED" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.infoValue}>{ex.nom ?? "Exercice"}</Text>
                    <Text style={styles.infoLabel}>
                      {ex.dateExoPrevue ? new Date(ex.dateExoPrevue).toLocaleString("fr-FR") : ""}
                      {ex.typeAssignation ? ` • ${ex.typeAssignation}` : ""}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        {activeDetailTab === "events" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Événements</Text>
            {loadingEvents ? (
              <LoadingSpinner label="Chargement des événements..." />
            ) : events.length === 0 ? (
              <Text style={styles.emptyText}>Aucun événement pour cette classe.</Text>
            ) : (
              events.map((ev) => (
                <View key={ev.id} style={styles.historyItem}>
                  <FontAwesome5 name="calendar-alt" size={16} color="#F97316" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.infoValue}>{ev.titre ?? "Événement"}</Text>
                    <Text style={styles.infoLabel}>
                      {ev.heureDebut ? new Date(ev.heureDebut).toLocaleString("fr-FR") : ""}
                      {ev.etat ? ` • ${ev.etat}` : ""}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        {activeDetailTab === "history" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Historique d'activation</Text>
            {historyError ? <Text style={styles.emptyText}>{historyError}</Text> : null}
            {loadingHistory ? (
              <LoadingSpinner label="Chargement de l'historique..." />
            ) : history.length === 0 && !historyError ? (
              <Text style={styles.emptyText}>Aucun événement enregistré.</Text>
            ) : (
              history.map((entry, index) => (
                <View key={entry.id ?? index} style={styles.historyItem}>
                  <FontAwesome5
                    name={String(entry.action ?? entry.type ?? "").toUpperCase().includes("DESACTIV") ? "toggle-off" : "toggle-on"}
                    size={16}
                    color={String(entry.action ?? entry.type ?? "").toUpperCase().includes("DESACTIV") ? "#EF4444" : "#10B981"}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.infoValue}>{entry.action ?? entry.type ?? entry.evenement ?? "Événement"}</Text>
                    {entry.date || entry.dateEvenement || entry.dateCreation ? (
                      <Text style={styles.infoLabel}>
                        {new Date(entry.date ?? entry.dateEvenement ?? entry.dateCreation).toLocaleString("fr-FR")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* User Profile Modal */}
      <Modal
        visible={showUserProfile}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUserProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModal}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileTitle}>Profil utilisateur</Text>
              <TouchableOpacity
                onPress={() => setShowUserProfile(false)}
                style={styles.closeButton}
              >
                <FontAwesome5 name="times" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {selectedUser && (
              <View style={styles.profileContent}>
                <View style={styles.profileAvatar}>
                  <FontAwesome5
                    name={selectedUser.niveau ? "user-graduate" : "user"}
                    size={24}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.profileName}>{selectedUser.name}</Text>
                <View style={styles.profileDetails}>
                  <View style={styles.profileDetailItem}>
                    <Text style={styles.profileDetailLabel}>Email/Téléphone:</Text>
                    <Text style={styles.profileDetailValue}>
                      {selectedUser.email || selectedUser.phone || 'Non spécifié'}
                    </Text>
                  </View>
                  {selectedUser.niveau && (
                    <View style={styles.profileDetailItem}>
                      <Text style={styles.profileDetailLabel}>Niveau:</Text>
                      <Text style={styles.profileDetailValue}>{selectedUser.niveau}</Text>
                    </View>
                  )}
                  <View style={styles.profileDetailItem}>
                    <Text style={styles.profileDetailLabel}>Type:</Text>
                    <Text style={styles.profileDetailValue}>
                      {selectedUser.niveau ? 'Étudiant' : 'Parent'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Moderator Assignment Modal */}
      <Modal
        visible={showModeratorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelModeratorAssignment}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.moderatorModal}>
            <View style={styles.moderatorHeader}>
              <Text style={styles.moderatorTitle}>Ajouter un modérateur</Text>
              <TouchableOpacity
                onPress={handleCancelModeratorAssignment}
                style={styles.closeButton}
              >
                <FontAwesome5 name="times" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <FontAwesome5 name="search" size={16} color="#6B7280" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher par nom ou email..."
                value={searchTerm}
                onChangeText={handleSearchProfessors}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {isSearching && (
              <View style={styles.loadingContainer}>
                <FontAwesome5 name="spinner" size={16} color="#4F46E5" />
                <Text style={styles.loadingText}>Recherche...</Text>
              </View>
            )}

            <ScrollView style={styles.resultsContainer}>
              {searchResults.map((professor) => (
                <TouchableOpacity
                  key={professor.id}
                  style={[
                    styles.professorItem,
                    selectedModerator?.id === professor.id && styles.selectedProfessorItem
                  ]}
                  onPress={() => handleSelectModerator(professor)}
                >
                  <View style={styles.professorInfo}>
                    <Text style={styles.professorName}>
                      {professor.prenom} {professor.nom}
                    </Text>
                    <Text style={styles.professorEmail}>{professor.email}</Text>
                    <Text style={styles.professorMatricule}>
                      Matricule: {professor.matriculeProfesseur || 'Non défini'}
                    </Text>
                  </View>
                  <Text style={styles.selectText}>Sélectionner</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedModerator && (
              <View style={styles.selectedModeratorContainer}>
                <Text style={styles.selectedModeratorLabel}>Modérateur sélectionné:</Text>
                <View style={styles.selectedModeratorInfo}>
                  <Text style={styles.selectedModeratorName}>
                    {selectedModerator.prenom} {selectedModerator.nom}
                  </Text>
                  <Text style={styles.selectedModeratorEmail}>{selectedModerator.email}</Text>
                  <Text style={styles.selectedModeratorMatricule}>
                    Matricule: {selectedModerator.matriculeProfesseur || 'Non défini'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelModeratorAssignment}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.assignButton, (!selectedModerator || isAssigning) && styles.disabledButton]}
                onPress={handleAssignModerator}
                disabled={!selectedModerator || isAssigning}
              >
                {isAssigning ? (
                  <FontAwesome5 name="spinner" size={16} color="#FFFFFF" />
                ) : (
                  <Text style={styles.assignButtonText}>Assigner</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIcon}>
              <FontAwesome5 name="check" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Succès!</Text>
            <Text style={styles.successMessage}>Modérateur assigné avec succès</Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Request Details Modal */}
      <Modal
        visible={showRequestDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequestDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestDetailsModal}>
            <View style={styles.requestDetailsHeader}>
              <Text style={styles.requestDetailsTitle}>Détails de la demande</Text>
              <TouchableOpacity
                onPress={() => setShowRequestDetails(false)}
                style={styles.closeButton}
              >
                <FontAwesome5 name="times" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {selectedRequest && (
              <View style={styles.requestDetailsContent}>
                <View style={styles.requestDetailsAvatar}>
                  <FontAwesome5 name="user" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.requestDetailsName}>{selectedRequest.name}</Text>
                <View style={styles.requestDetailsInfo}>
                  <View style={styles.requestDetailItem}>
                    <Text style={styles.requestDetailLabel}>Rôle:</Text>
                    <Text style={styles.requestDetailValue}>{selectedRequest.role}</Text>
                  </View>
                  <View style={styles.requestDetailItem}>
                    <Text style={styles.requestDetailLabel}>Date de demande:</Text>
                    <Text style={styles.requestDetailValue}>{selectedRequest.date}</Text>
                  </View>
                  <View style={styles.requestDetailItem}>
                    <Text style={styles.requestDetailLabel}>Statut:</Text>
                    <Text style={styles.requestDetailValue}>{selectedRequest.status}</Text>
                  </View>
                </View>
                {selectedRequest.status === 'EN_ATTENTE' && (
                  <View style={styles.requestDetailsActions}>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => {
                        setShowRequestDetails(false);
                        handleApproveRequest(selectedRequest);
                      }}
                    >
                      <FontAwesome5 name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.approveButtonText}>Approuver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButtonLarge}
                      onPress={() => {
                        setShowRequestDetails(false);
                        handleRejectRequest(selectedRequest);
                      }}
                    >
                      <FontAwesome5 name="times" size={16} color="#FFFFFF" />
                      <Text style={styles.rejectButtonText}>Rejeter</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModal}>
            <View style={styles.rejectHeader}>
              <Text style={styles.rejectTitle}>Rejeter la demande</Text>
              <TouchableOpacity
                onPress={() => setShowRejectModal(false)}
                style={styles.closeButton}
              >
                <FontAwesome5 name="times" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.rejectLabel}>Motif du rejet:</Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Saisissez le motif du rejet..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.rejectActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmRejectButton}
                onPress={rejectRequest}
              >
                <Text style={styles.confirmRejectButtonText}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Moderators List Modal */}
      <Modal
        visible={showModeratorsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModeratorsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.moderatorsListModal}>
            <View style={styles.moderatorsListHeader}>
              <Text style={styles.moderatorsListTitle}>Modérateurs de la classe</Text>
              <TouchableOpacity
                onPress={() => setShowModeratorsModal(false)}
                style={styles.closeButton}
              >
                <FontAwesome5 name="times" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {isLoadingModerators ? (
              <View style={styles.loadingContainer}>
                <FontAwesome5 name="spinner" size={24} color="#4F46E5" />
                <Text style={styles.loadingText}>Chargement des modérateurs...</Text>
              </View>
            ) : (
              <ScrollView style={styles.moderatorsListContainer}>
                {moderators.length > 0 ? (
                  moderators.map((moderator) => (
                    <TouchableOpacity
                      key={moderator.id}
                      style={styles.moderatorItem}
                      onPress={() => {
                        setSelectedUser({
                          id: moderator.id,
                          name: `${moderator.prenom} ${moderator.nom}`,
                          email: moderator.email,
                          phone: moderator.telephone,
                          matricule: moderator.matriculeProfesseur,
                          type: 'Modérateur'
                        });
                        setShowModeratorsModal(false);
                        setShowUserProfile(true);
                      }}
                    >
                      <View style={styles.moderatorAvatar}>
                        <FontAwesome5 name="user-tie" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.moderatorInfo}>
                        <Text style={styles.moderatorName}>
                          {moderator.prenom} {moderator.nom}
                        </Text>
                        <Text style={styles.moderatorEmail}>{moderator.email}</Text>
                        <Text style={styles.moderatorMatricule}>
                          Matricule: {moderator.matriculeProfesseur || 'Non défini'}
                        </Text>
                      </View>
                      <FontAwesome5 name="eye" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyModeratorsText}>Aucun modérateur trouvé</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Publication Rights Modal */}
      <Modal
        visible={showRightsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRightsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModal}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileTitle}>Droits de publication</Text>
              <TouchableOpacity onPress={() => setShowRightsModal(false)} style={styles.closeButton}>
                <FontAwesome5 name="times" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {rightsTargetUser && (
              <View style={styles.profileContent}>
                <Text style={styles.profileName}>{rightsTargetUser.name}</Text>
                <TouchableOpacity
                  style={rightsStyles.rightRow}
                  onPress={() => setCanPublish((v) => !v)}
                >
                  <FontAwesome5
                    name={canPublish ? 'check-square' : 'square'}
                    size={18}
                    color={canPublish ? '#4F46E5' : '#9CA3AF'}
                  />
                  <Text style={rightsStyles.rightLabel}>Peut publier du contenu</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={rightsStyles.rightRow}
                  onPress={() => setCanModerate((v) => !v)}
                >
                  <FontAwesome5
                    name={canModerate ? 'check-square' : 'square'}
                    size={18}
                    color={canModerate ? '#4F46E5' : '#9CA3AF'}
                  />
                  <Text style={rightsStyles.rightLabel}>Peut modérer la classe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rightsStyles.saveButton, isSavingRights && { opacity: 0.7 }]}
                  onPress={handleSaveRights}
                  disabled={isSavingRights}
                >
                  <Text style={rightsStyles.saveButtonText}>
                    {isSavingRights ? 'Enregistrement...' : 'Enregistrer'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const rightsStyles = StyleSheet.create({
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  rightLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: '#111827',
  },
  saveButton: {
    marginTop: 16,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingTop: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  classInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  classIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  classIconText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  classInfoContent: {
    flex: 1,
    minWidth: 0,
  },
  className: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  classLevel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  classMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 4,
  },
  classDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  tabsContainer: {
    flexGrow: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 2,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#4F46E5",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  tabContent: {
    marginBottom: 20,
  },
  infoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
  },
  codeValue: {
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#4F46E5",
  },
  accesMajeurBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  accesMajeurBadgeOn: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  accesMajeurBadgeOff: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  accesMajeurBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  manageSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  listItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  listItemEmail: {
    fontSize: 12,
    color: "#6B7280",
  },
  listItemMeta: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  metaBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  rejectButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 16,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  profileModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileContent: {
    alignItems: "center",
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20,
    textAlign: "center",
  },
  profileDetails: {
    width: "100%",
  },
  profileDetailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  profileDetailLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  profileDetailValue: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
    textAlign: "right",
  },
  addModeratorButton: {
    flex: 1,
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addModeratorButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  moderatorModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
  },
  moderatorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  moderatorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#6B7280",
  },
  resultsContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  professorItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedProfessorItem: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
  },
  professorInfo: {
    flex: 1,
  },
  professorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  professorEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  professorMatricule: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  selectText: {
    fontSize: 14,
    color: "#4F46E5",
    fontWeight: "500",
  },
  selectedModeratorContainer: {
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  selectedModeratorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  selectedModeratorInfo: {
    paddingLeft: 8,
  },
  selectedModeratorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  selectedModeratorEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  selectedModeratorMatricule: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  assignButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    alignItems: "center",
  },
  assignButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  disabledButton: {
    opacity: 0.5,
  },
  successModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    width: 280,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: "#10B981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  successButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  requestDetailsModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  requestDetailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  requestDetailsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  requestDetailsContent: {
    alignItems: "center",
  },
  requestDetailsAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  requestDetailsName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20,
  },
  requestDetailsInfo: {
    width: "100%",
    marginBottom: 24,
  },
  requestDetailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  requestDetailLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  requestDetailValue: {
    fontSize: 14,
    color: "#111827",
  },
  requestDetailsActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 8,
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  rejectButtonLarge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  rejectModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  rejectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  rejectTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  rejectLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  rejectInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    textAlignVertical: "top",
    marginBottom: 20,
    minHeight: 100,
  },
  rejectActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmRejectButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmRejectButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  moderatorButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  viewModeratorsButton: {
    flex: 1,
    backgroundColor: "#EEF2FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4F46E5",
  },
  viewModeratorsButtonText: {
    color: "#4F46E5",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  moderatorsListModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
  },
  moderatorsListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  moderatorsListTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  moderatorsListContainer: {
    maxHeight: 400,
  },
  moderatorItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  moderatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  moderatorInfo: {
    flex: 1,
  },
  moderatorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  moderatorEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  moderatorMatricule: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  emptyModeratorsText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 32,
  },
});

export default ClassDetails;
