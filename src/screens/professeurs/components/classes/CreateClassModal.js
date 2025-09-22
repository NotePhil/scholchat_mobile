import React, { useState } from "react";
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

const CreateClassModal = ({ visible, onClose, onCreateClass }) => {
  const [className, setClassName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] = useState("");
  const [selectedModerator, setSelectedModerator] = useState("");
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showEstablishmentDropdown, setShowEstablishmentDropdown] =
    useState(false);
  const [showModeratorDropdown, setShowModeratorDropdown] = useState(false);

  const levels = [
    "CP (Cours Préparatoire)",
    "CE1 (Cours Élémentaire 1)",
    "CE2 (Cours Élémentaire 2)",
    "CM1 (Cours Moyen 1)",
    "CM2 (Cours Moyen 2)",
    "6ème",
    "5ème",
    "4ème",
    "3ème",
    "2nde (Seconde)",
    "1ère (Première)",
    "Terminale",
  ];

  const establishments = [
    "Aucun établissement (Optionnel)",
    "Etablissement A - Yaoundé",
    "Etablissement B - Douala",
  ];

  const moderators = [
    "Aucun modérateur (Optionnel)",
    "Marie Dupont",
    "Lucas Martin",
    "Isabelle Lefevre",
    "Test Professor",
  ];

  const generateActivationCode = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setActivationCode(randomCode);
  };

  const handleCreateClass = () => {
    if (!className.trim() || !selectedLevel || !activationCode.trim()) {
      Alert.alert(
        "Erreur",
        "Veuillez remplir tous les champs obligatoires (*)"
      );
      return;
    }

    const newClass = {
      id: Date.now().toString(),
      name: className,
      level: selectedLevel,
      state: "PENDING_APPROVAL",
      activationCode,
      establishment: selectedEstablishment || "Non spécifié",
      moderator: selectedModerator || "Non spécifié",
      studentsCount: 0,
      parentsCount: 0,
      creationDate: new Date().toISOString(),
      description: "",
      students: [],
      parents: [],
      accessRequests: [],
    };

    onCreateClass(newClass);
    onClose();
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
                  {levels.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedLevel(level);
                        setShowLevelDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{level}</Text>
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
              <Text style={styles.fieldLabel}>Établissement (Optionnel)</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() =>
                  setShowEstablishmentDropdown(!showEstablishmentDropdown)
                }
              >
                <Text style={styles.dropdownText}>
                  {selectedEstablishment || "Aucun établissement (Optionnel)"}
                </Text>
                <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              {showEstablishmentDropdown && (
                <View style={styles.dropdownOptions}>
                  {establishments.map((establishment) => (
                    <TouchableOpacity
                      key={establishment}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedEstablishment(establishment);
                        setShowEstablishmentDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>
                        {establishment}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Moderator Selection */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Modérateur (Optionnel)</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowModeratorDropdown(!showModeratorDropdown)}
              >
                <Text style={styles.dropdownText}>
                  {selectedModerator || "Aucun modérateur (Optionnel)"}
                </Text>
                <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              {showModeratorDropdown && (
                <View style={styles.dropdownOptions}>
                  {moderators.map((moderator) => (
                    <TouchableOpacity
                      key={moderator}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedModerator(moderator);
                        setShowModeratorDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{moderator}</Text>
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
              style={styles.createButton}
              onPress={handleCreateClass}
            >
              <Text style={styles.createButtonText}>Créer la classe</Text>
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
