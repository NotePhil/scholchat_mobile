import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { classService } from "../../../../services/classService";
import { useUser } from "../../../../context/UserContext";

const CreateClassModal = ({ visible, onClose, onCreateClass }) => {
  const { user } = useUser();
  const [className, setClassName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] = useState(null);
  const [selectedModerator, setSelectedModerator] = useState(null);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showEstablishmentDropdown, setShowEstablishmentDropdown] = useState(false);
  const [showModeratorDropdown, setShowModeratorDropdown] = useState(false);
  const [etablissements, setEtablissements] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const niveaux = [
    "MATERNELLE",
    "PRIMAIRE",
    "COLLEGE",
    "LYCEE",
    "UNIVERSITE"
  ];

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    console.log('=== LOADING DATA FOR CREATE CLASS MODAL ===');
    console.log('User data:', user);
    
    setIsLoadingData(true);
    try {
      console.log('Starting to fetch etablissements and professors...');
      
      const etablissementsPromise = classService.getEtablissements();
      const professorsPromise = classService.getProfessors();
      
      const [etablissementsData, professorsData] = await Promise.all([
        etablissementsPromise,
        professorsPromise
      ]);
      
      console.log('=== ETABLISSEMENTS DATA RECEIVED ===');
      console.log('Raw etablissements data:', etablissementsData);
      console.log('Etablissements count:', etablissementsData?.length || 0);
      
      console.log('=== PROFESSORS DATA RECEIVED ===');
      console.log('Raw professors data:', professorsData);
      console.log('Professors count:', professorsData?.length || 0);
      
      setEtablissements(etablissementsData || []);
      setProfessors(professorsData || []);
      
      console.log('Data loaded successfully into state');
    } catch (error) {
      console.error('=== ERROR LOADING DATA ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setIsLoadingData(false);
      console.log('=== FINISHED LOADING DATA ===');
    }
  };

  const generateActivationCode = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setActivationCode(randomCode);
  };

  const handleCreateClass = async () => {
    console.log('=== STARTING CLASS CREATION ===');
    console.log('Form data:', {
      className,
      selectedLevel,
      activationCode,
      selectedEstablishment,
      selectedModerator,
      user
    });
    
    if (!className.trim() || !selectedLevel || !activationCode.trim()) {
      console.log('Validation failed - missing required fields');
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires (*)');
      return;
    }

    setIsLoading(true);
    try {
      const classData = {
        nom: className,
        niveau: selectedLevel,
        dateCreation: new Date().toISOString(),
        codeActivation: activationCode,
        etat: 'EN_ATTENTE_APPROBATION',
        etablissement: selectedEstablishment ? { id: selectedEstablishment.id } : null,
        moderator: user.userId,
        parents: [],
        eleves: []
      };
      
      console.log('Class data to be sent:', classData);
      console.log('Creating class...');

      const createdClass = await classService.createClass(classData);
      console.log('Class created successfully:', createdClass);
      
      // Grant publication rights to the creator
      console.log('Granting publication rights...');
      await classService.grantPublicationRights(user.userId, createdClass.id, true, true);
      console.log('Publication rights granted successfully');
      
      Alert.alert('Succès', 'Classe créée avec succès!');
      onCreateClass(createdClass);
      onClose();
    } catch (error) {
      console.error('=== CLASS CREATION FAILED ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      Alert.alert('Erreur', `Impossible de créer la classe: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Créer une Classe</Text>
            <Text style={styles.modalSubtitle}>
              Ajoutez une nouvelle classe à votre système
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome5 name="times" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Class Name */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Nom de la classe *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Terminale C1"
                value={className}
                onChangeText={setClassName}
              />
            </View>

            {/* Level Selection */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Niveau *</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowLevelDropdown(!showLevelDropdown)}
              >
                <Text style={styles.dropdownText}>
                  {selectedLevel || "Sélectionner un niveau"}
                </Text>
                <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              {showLevelDropdown && (
                <View style={styles.dropdownOptions}>
                  {niveaux.map((niveau) => (
                    <TouchableOpacity
                      key={niveau}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedLevel(niveau);
                        setShowLevelDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{niveau}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Activation Code */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Code d'activation *</Text>
              <View style={styles.codeContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Code d'activation"
                  value={activationCode}
                  onChangeText={setActivationCode}
                />
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateActivationCode}
                >
                  <Text style={styles.generateButtonText}>Générer</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Establishment Selection */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>
                Établissement (Optionnel) {isLoadingData && '(Chargement...)'}
              </Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowEstablishmentDropdown(!showEstablishmentDropdown)}
                disabled={isLoadingData}
              >
                <Text style={styles.dropdownText}>
                  {selectedEstablishment ? `${selectedEstablishment?.nom || 'Nom non défini'} - ${selectedEstablishment?.localisation || 'Localisation non définie'}` : "Aucun établissement (Optionnel)"}
                </Text>
                <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              {showEstablishmentDropdown && (
                <View style={styles.dropdownOptions}>
                  <TouchableOpacity
                    key="no-establishment"
                    style={styles.dropdownOption}
                    onPress={() => {
                      console.log('Selected establishment: None');
                      setSelectedEstablishment(null);
                      setShowEstablishmentDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>Aucun établissement</Text>
                  </TouchableOpacity>
                  {etablissements.map((etablissement) => (
                    <TouchableOpacity
                      key={etablissement?.id || etablissement?.nom || 'unknown'}
                      style={styles.dropdownOption}
                      onPress={() => {
                        console.log('Selected establishment:', etablissement);
                        setSelectedEstablissement(etablissement);
                        setShowEstablishmentDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>
                        {etablissement?.nom || 'Nom non défini'} - {etablissement?.localisation || 'Localisation non définie'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Moderator Selection */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>
                Modérateur (Optionnel) {isLoadingData && '(Chargement...)'}
              </Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowModeratorDropdown(!showModeratorDropdown)}
                disabled={isLoadingData}
              >
                <Text style={styles.dropdownText}>
                  {selectedModerator ? `${selectedModerator?.prenom || ''} ${selectedModerator?.nom || 'Nom non défini'}` : "Aucun modérateur (Optionnel)"}
                </Text>
                <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              {showModeratorDropdown && (
                <View style={styles.dropdownOptions}>
                  <TouchableOpacity
                    key="no-moderator"
                    style={styles.dropdownOption}
                    onPress={() => {
                      console.log('Selected moderator: None');
                      setSelectedModerator(null);
                      setShowModeratorDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>Aucun modérateur</Text>
                  </TouchableOpacity>
                  {professors.map((professor) => (
                    <TouchableOpacity
                      key={professor?.id || professor?.nom || 'unknown'}
                      style={styles.dropdownOption}
                      onPress={() => {
                        console.log('Selected moderator:', professor);
                        setSelectedModerator(professor);
                        setShowModeratorDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>
                        {professor?.prenom || ''} {professor?.nom || 'Nom non défini'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Important Information */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Information importante</Text>
              <Text style={styles.infoText}>
                • La classe sera créée avec le statut "En attente d'approbation"
              </Text>
              <Text style={styles.infoText}>
                • Le code d'activation permet aux utilisateurs de rejoindre la
                classe
              </Text>
              <Text style={styles.infoText}>
                • Vous pourrez ajouter des parents et élèves après la création
              </Text>
              <Text style={styles.infoText}>
                • Vous recevrez automatiquement les droits de publication pour
                cette classe
              </Text>
              <Text style={styles.infoText}>
                • Les champs marqués avec * sont obligatoires
              </Text>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, isLoading && { opacity: 0.7 }]}
              onPress={handleCreateClass}
              disabled={isLoading}
            >
              {isLoading ? (
                <FontAwesome5 name="spinner" size={16} color="#FFFFFF" />
              ) : null}
              <Text style={styles.createButtonText}>
                {isLoading ? 'Création...' : 'Créer la classe'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 20,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 8,
  },
  formContainer: {
    marginBottom: 20,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  dropdownButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownText: {
    fontSize: 16,
    color: "#6B7280",
  },
  dropdownOptions: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  dropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  dropdownOptionText: {
    fontSize: 16,
    color: "#111827",
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  generateButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  createButton: {
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CreateClassModal;
