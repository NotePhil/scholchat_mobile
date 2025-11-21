import React, { useState } from "react";
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

const ClassDetails = ({
  selectedClass,
  onBack,
  activeDetailTab,
  setActiveDetailTab,
  onRefresh,
}) => {
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModeratorModal, setShowModeratorModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedModerator, setSelectedModerator] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showModeratorsModal, setShowModeratorsModal] = useState(false);
  const [moderators, setModerators] = useState([]);
  const [isLoadingModerators, setIsLoadingModerators] = useState(false);
  const getStateColor = (state) => {
    return state === "ACTIVE" ? "#10B981" : "#6B7280";
  };

  const getStateBackground = (state) => {
    return state === "ACTIVE" ? "#D1FAE5" : "#F3F4F6";
  };

  const getStateText = (state) => {
    return state === "ACTIVE" ? "Active" : "Inactive";
  };

  const handleViewProfile = (user) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleRemoveAccess = (user) => {
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

  const removeUserAccess = async (userId) => {
    try {
      await classService.removeUserAccess(userId, selectedClass.id);
      Alert.alert("Succès", "L'accès a été retiré avec succès");
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error removing user access:', error);
      Alert.alert("Erreur", "Impossible de retirer l'accès");
    }
  };

  const handleSearchProfessors = async (term) => {
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

  const handleSelectModerator = (professor) => {
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

  const handleViewRequestDetails = (request) => {
    setSelectedRequest(request);
    setShowRequestDetails(true);
  };

  const handleApproveRequest = (request) => {
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

  const handleRejectRequest = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const approveRequest = async (requestId) => {
    try {
      await classService.approveAccessRequest(requestId);
      Alert.alert('Succès', 'Demande approuvée avec succès');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error approving request:', error);
      let errorMessage = 'Impossible d\'approuver la demande';
      if (error.message.includes('EN_ATTENTE')) {
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

    try {
      await classService.rejectAccessRequest(selectedRequest.id, rejectionReason);
      Alert.alert('Succès', 'Demande rejetée avec succès');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error rejecting request:', error);
      let errorMessage = 'Impossible de rejeter la demande';
      if (error.message.includes('EN_ATTENTE')) {
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
            <Text style={styles.className}>{selectedClass.name}</Text>
            <Text style={styles.classLevel}>Niveau: {selectedClass.level}</Text>
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
              <Text style={styles.classDate}>
                Créée le{" "}
                {new Date(selectedClass.creationDate).toLocaleDateString(
                  "fr-FR"
                )}
              </Text>
            </View>
          </View>
        </View>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <FontAwesome5 name="user-graduate" size={24} color="#4F46E5" />
            <Text style={styles.statNumber}>{selectedClass.studentsCount}</Text>
            <Text style={styles.statLabel}>Étudiants</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome5 name="users" size={24} color="#10B981" />
            <Text style={styles.statNumber}>{selectedClass.parentsCount}</Text>
            <Text style={styles.statLabel}>Parents</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome5 name="clock" size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>
              {selectedClass.accessRequests.length}
            </Text>
            <Text style={styles.statLabel}>Demandes</Text>
          </View>
        </View>
        {/* Detail Tabs */}
        <View style={styles.tabsContainer}>
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
              Informations
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeDetailTab === "manage" && styles.activeTab,
            ]}
            onPress={() => setActiveDetailTab("manage")}
          >
            <Text
              style={[
                styles.tabText,
                activeDetailTab === "manage" && styles.activeTabText,
              ]}
            >
              Gestion
            </Text>
          </TouchableOpacity>
        </View>
        {/* Tab Content */}
        {activeDetailTab === "info" && (
          <View style={styles.tabContent}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Informations générales</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Modérateur:</Text>
                <Text style={styles.infoValue}>{selectedClass.moderator}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Droits:</Text>
                <Text style={styles.infoValue}>
                  {selectedClass.teacherRights}
                </Text>
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
                  {selectedClass.description}
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
          </View>
        )}
        {activeDetailTab === "manage" && (
          <View style={styles.tabContent}>
            {/* Students Section */}
            <View style={styles.manageSection}>
              <View style={styles.manageSectionHeader}>
                <FontAwesome5 name="user-graduate" size={16} color="#4F46E5" />
                <Text style={styles.manageSectionTitle}>
                  Étudiants ({selectedClass.students.length})
                </Text>
              </View>
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
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => handleViewProfile(student)}
                      >
                        <FontAwesome5 name="eye" size={12} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveAccess(student)}
                      >
                        <FontAwesome5 name="times" size={12} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucun étudiant trouvé</Text>
              )}
            </View>
            {/* Parents Section */}
            <View style={styles.manageSection}>
              <View style={styles.manageSectionHeader}>
                <FontAwesome5 name="users" size={16} color="#10B981" />
                <Text style={styles.manageSectionTitle}>
                  Parents ({selectedClass.parents.length})
                </Text>
              </View>
              {selectedClass.parents.length > 0 ? (
                selectedClass.parents.map((parent) => (
                  <View key={parent.id} style={styles.listItem}>
                    <View style={styles.listItemAvatar}>
                      <FontAwesome5 name="user" size={14} color="#10B981" />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>{parent.name}</Text>
                      <Text style={styles.listItemEmail}>{parent.phone}</Text>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => handleViewProfile(parent)}
                      >
                        <FontAwesome5 name="eye" size={12} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveAccess(parent)}
                      >
                        <FontAwesome5 name="times" size={12} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aucun parent trouvé</Text>
              )}
            </View>
            {/* Access Requests Section */}
            <View style={styles.manageSection}>
              <View style={styles.manageSectionHeader}>
                <FontAwesome5 name="user-plus" size={16} color="#F59E0B" />
                <Text style={styles.manageSectionTitle}>
                  Demandes d'accès ({selectedClass.accessRequests.length})
                </Text>
              </View>
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
    </View>
  );
};

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
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
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
  manageSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  manageSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
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
