import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Animated,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const etatOptions = [
  { value: "PLANIFIE", label: "Planifié", color: "#3B82F6" },
  { value: "EN_COURS", label: "En cours", color: "#F59E0B" },
  { value: "TERMINE", label: "Terminé", color: "#10B981" },
  { value: "ANNULE", label: "Annulé", color: "#EF4444" },
];

const CreateActivityModal = ({ onClose, onCreateActivity }) => {
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    lieu: "",
    etat: "PLANIFIE",
    heureDebut: "",
    heureFin: "",
    createurId: "current_user_id",
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [participantsInput, setParticipantsInput] = useState("");
  const [translateY] = useState(new Animated.Value(0));

  const handleDragEnd = (event) => {
    const { translationY, velocityY } = event.nativeEvent;

    if (translationY > 100 || velocityY > 500) {
      onClose();
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleDrag = (event) => {
    const { translationY } = event.nativeEvent;
    if (translationY >= 0) {
      translateY.setValue(translationY);
    }
  };

  const resetForm = () => {
    setFormData({
      titre: "",
      description: "",
      lieu: "",
      etat: "PLANIFIE",
      heureDebut: "",
      heureFin: "",
      createurId: "current_user_id",
    });
    setSelectedImages([]);
    setParticipantsInput("");
  };

  const handleImagePicker = () => {
    const mockImage = {
      id: Date.now().toString(),
      uri: `https://picsum.photos/300/200?random=${Date.now()}`,
      type: "image",
      name: `image_${Date.now()}.jpg`,
    };
    setSelectedImages([...selectedImages, mockImage]);
  };

  const removeImage = (imageId) => {
    setSelectedImages(selectedImages.filter((img) => img.id !== imageId));
  };

  const handleDateTimeInput = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const validateForm = () => {
    if (!formData.titre.trim()) {
      Alert.alert("Erreur", "Le titre est obligatoire");
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert("Erreur", "La description est obligatoire");
      return false;
    }
    if (!formData.lieu.trim()) {
      Alert.alert("Erreur", "Le lieu est obligatoire");
      return false;
    }
    if (!formData.heureDebut) {
      Alert.alert("Erreur", "L'heure de début est obligatoire");
      return false;
    }
    if (!formData.heureFin) {
      Alert.alert("Erreur", "L'heure de fin est obligatoire");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const participantsIds = participantsInput
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const newActivity = {
      id: Date.now().toString(),
      titre: formData.titre,
      description: formData.description,
      lieu: formData.lieu,
      etat: formData.etat,
      heureDebut: formData.heureDebut,
      heureFin: formData.heureFin,
      createurId: formData.createurId,
      participantsIds: participantsIds,
      medias: selectedImages,
      creator: "Vous",
      role: "Professeur",
      date: new Date().toLocaleDateString("fr-FR"),
      status:
        formData.etat === "PLANIFIE"
          ? "Scheduled"
          : formData.etat === "EN_COURS"
            ? "In Progress"
            : formData.etat === "TERMINE"
              ? "Completed"
              : "Cancelled",
      likes: 0,
      shares: 0,
      type: "event",
    };

    onCreateActivity(newActivity);
    resetForm();
    Alert.alert("Succès", "Activité créée avec succès!", [
      { text: "OK", onPress: onClose },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(
      "Annuler la création",
      "Êtes-vous sûr de vouloir annuler? Toutes les données saisies seront perdues.",
      [
        { text: "Continuer", style: "cancel" },
        {
          text: "Annuler",
          style: "destructive",
          onPress: () => {
            resetForm();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Animated.View
      style={[
        modalStyles.container,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Drag Handle */}
      <TouchableOpacity
        style={modalStyles.dragHandle}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <View style={modalStyles.handle} />
      </TouchableOpacity>

      {/* Header */}
      <View style={modalStyles.header}>
        <TouchableOpacity onPress={onClose} style={modalStyles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={modalStyles.headerTitle}>Créer une activité</Text>
        <TouchableOpacity
          onPress={handleCancel}
          style={modalStyles.cancelButton}
        >
          <Text style={modalStyles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={modalStyles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={modalStyles.contentContainer}
      >
        {/* Title Field */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Titre *</Text>
          <TextInput
            style={modalStyles.textInput}
            value={formData.titre}
            onChangeText={(text) => setFormData({ ...formData, titre: text })}
            placeholder="Entrez le titre de l'activité"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Description Field */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Description *</Text>
          <TextInput
            style={[modalStyles.textInput, modalStyles.textArea]}
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
            placeholder="Décrivez l'activité"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Location Field */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Lieu *</Text>
          <TextInput
            style={modalStyles.textInput}
            value={formData.lieu}
            onChangeText={(text) => setFormData({ ...formData, lieu: text })}
            placeholder="Lieu de l'activité"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* State Selection */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>État</Text>
          <View style={modalStyles.stateContainer}>
            {etatOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  modalStyles.stateOption,
                  formData.etat === option.value && {
                    backgroundColor: option.color + "20",
                    borderColor: option.color,
                  },
                ]}
                onPress={() => setFormData({ ...formData, etat: option.value })}
              >
                <View
                  style={[
                    modalStyles.stateIndicator,
                    { backgroundColor: option.color },
                  ]}
                />
                <Text
                  style={[
                    modalStyles.stateText,
                    formData.etat === option.value && { color: option.color },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Start Time */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Heure de début *</Text>
          <TextInput
            style={modalStyles.textInput}
            value={formData.heureDebut}
            onChangeText={(text) => handleDateTimeInput("heureDebut", text)}
            placeholder="DD/MM/YYYY HH:MM"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* End Time */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Heure de fin *</Text>
          <TextInput
            style={modalStyles.textInput}
            value={formData.heureFin}
            onChangeText={(text) => handleDateTimeInput("heureFin", text)}
            placeholder="DD/MM/YYYY HH:MM"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Participants */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>IDs des participants</Text>
          <TextInput
            style={modalStyles.textInput}
            value={participantsInput}
            onChangeText={setParticipantsInput}
            placeholder="ID1, ID2, ID3... (séparés par des virgules)"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={modalStyles.helpText}>
            Entrez les IDs des participants séparés par des virgules
          </Text>
        </View>

        {/* Media Section */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Images</Text>

          {/* Image Picker Button */}
          <TouchableOpacity
            style={modalStyles.imagePickerButton}
            onPress={handleImagePicker}
          >
            <FontAwesome5 name="camera" size={20} color="#4F46E5" />
            <Text style={modalStyles.imagePickerText}>Ajouter une image</Text>
          </TouchableOpacity>

          {/* Selected Images */}
          {selectedImages.length > 0 && (
            <View style={modalStyles.imagesContainer}>
              {selectedImages.map((image) => (
                <View key={image.id} style={modalStyles.imageContainer}>
                  <Image
                    source={{ uri: image.uri }}
                    style={modalStyles.image}
                  />
                  <TouchableOpacity
                    style={modalStyles.removeImageButton}
                    onPress={() => removeImage(image.id)}
                  >
                    <FontAwesome5 name="times" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={modalStyles.bottomSpacing} />
      </ScrollView>

      {/* Create Button */}
      <View style={modalStyles.bottomContainer}>
        <TouchableOpacity
          style={modalStyles.createButton}
          onPress={handleSubmit}
        >
          <FontAwesome5
            name="plus"
            size={16}
            color="#FFFFFF"
            style={modalStyles.buttonIcon}
          />
          <Text style={modalStyles.createButtonText}>Créer l'activité</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const modalStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 102,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dragHandle: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  stateContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stateOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stateIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  stateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  helpText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 6,
    fontStyle: "italic",
    paddingHorizontal: 4,
  },
  imagePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#4F46E5",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 24,
    marginBottom: 16,
  },
  imagePickerText: {
    fontSize: 16,
    color: "#4F46E5",
    fontWeight: "600",
    marginLeft: 10,
  },
  imagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomSpacing: {
    height: 20,
  },
  bottomContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default CreateActivityModal;
