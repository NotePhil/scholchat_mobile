import React, { useEffect, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useUser } from "../../../context/UserContext";
import { useAuthStore } from "../../../store/useAuthStore";
import { activityFeedService, mediaService } from "../../../services/api";
import { classService } from "../../../services/classService";
import { ActivityEvent, ActivityMedia as RawActivityMedia, ClassEntity } from "../../../types";

export interface ActivityMedia {
  id: string;
  /** The persisted Media entity's id — needed to lazily resolve a real loadable URL via mediaService.getDownloadUrl. Absent for freshly-picked, not-yet-uploaded local images. */
  mediaId?: string;
  uri: string;
  type: string;
  name: string;
}

export interface ActivityComment {
  id: string;
  content: string;
  createdById?: string;
  creationDate?: string;
  isCurrentUser: boolean;
}

export interface Activity {
  id: string | number;
  type: 'event' | 'publication';
  creator: string;
  role: string;
  date: string;
  status: string;
  title: string;
  eventDate?: string;
  /** Raw ISO heureDebut, kept separately from the display-formatted `date`/`eventDate` so lists can sort chronologically. */
  rawDate?: string;
  location?: string;
  participants?: string;
  participantsCount?: number;
  isParticipating?: boolean;
  isLiked?: boolean;
  description: string;
  likes: number;
  comments: number;
  commentsList?: ActivityComment[];
  medias?: ActivityMedia[];
  /** Needed for the edit/delete permission check on the feed screen. */
  createurId?: string;
}

/** A locally-picked, not-yet-uploaded file — carries the extra fields (real mime type, byte size) the create/edit payload needs but the display-oriented ActivityMedia doesn't. */
type PickedMedia = ActivityMedia & { mimeType?: string; fileSizeBytes?: number };

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB — matches web's ActivitiesContent.jsx limit
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

interface CreateActivityModalProps {
  onClose: () => void;
  /** Called with the raw backend event after a successful create. */
  onCreateActivity: (activity: ActivityEvent) => void;
  /** When set, the modal opens in edit mode, prefilled from this activity. */
  activityToEdit?: ActivityEvent | null;
  /** Called with the raw backend event after a successful edit. */
  onUpdateActivity?: (activity: ActivityEvent) => void;
}

interface DragEndEvent {
  nativeEvent: { translationY: number; velocityY: number };
}

interface DragEvent {
  nativeEvent: { translationY: number };
}

const CreateActivityModal = ({ onClose, onCreateActivity, activityToEdit, onUpdateActivity }: CreateActivityModalProps) => {
  const { user } = useUser();
  const role = useAuthStore((s) => s.role);
  const isEditMode = !!activityToEdit;

  const [formData, setFormData] = useState({
    titre: activityToEdit?.titre ?? "",
    description: activityToEdit?.description ?? "",
    lieu: activityToEdit?.lieu ?? "",
    heureDebut: activityToEdit?.heureDebut ?? "",
    heureFin: activityToEdit?.heureFin ?? "",
    visibility: (activityToEdit?.visibility ?? "PUBLIC") as "PUBLIC" | "PRIVATE",
    classesIds: activityToEdit?.classesIds ?? [],
  });
  // Media already stored on the backend when editing — kept separately so
  // submission can preserve each entry's `id` (tells the backend "keep",
  // not "new"), matching web's editEvent payload building.
  const [existingMedias, setExistingMedias] = useState<RawActivityMedia[]>(activityToEdit?.medias ?? []);
  const [selectedImages, setSelectedImages] = useState<PickedMedia[]>([]);
  const [translateY] = useState(new Animated.Value(0));
  const [submitting, setSubmitting] = useState(false);

  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Lazily fetch the role-appropriate class list once PRIVATE is selected —
  // mirrors web's `useEffect` on `formData.visibility`.
  useEffect(() => {
    if (formData.visibility !== "PRIVATE" || !user?.userId || classes.length > 0) return;
    setLoadingClasses(true);
    classService
      .getClassesForRole(role, user.userId)
      .then(setClasses)
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [formData.visibility, user?.userId, role, classes.length]);

  const handleDragEnd = (event: DragEndEvent) => {
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

  const handleDrag = (event: DragEvent) => {
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
      heureDebut: "",
      heureFin: "",
      visibility: "PUBLIC",
      classesIds: [],
    });
    setSelectedImages([]);
    setExistingMedias([]);
  };

  const handleImagePicker = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l'accès à vos photos pour ajouter un média.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (asset.fileSize && asset.fileSize > maxSize) {
      Alert.alert(
        "Fichier trop volumineux",
        `Maximum ${(maxSize / 1024 / 1024).toFixed(0)} Mo pour ${isVideo ? "une vidéo" : "une image"}.`
      );
      return;
    }

    const picked: PickedMedia = {
      id: Date.now().toString(),
      uri: asset.uri,
      type: isVideo ? "VIDEO" : "IMAGE",
      name: asset.fileName ?? `${isVideo ? "video" : "image"}_${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
      mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
      fileSizeBytes: asset.fileSize,
    };
    setSelectedImages((prev) => [...prev, picked]);
  };

  const removeImage = (imageId: string) => {
    setSelectedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const removeExistingMedia = (mediaId?: string) => {
    setExistingMedias((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const toggleClasse = (classId: string) => {
    setFormData((prev) => ({
      ...prev,
      classesIds: prev.classesIds.includes(classId)
        ? prev.classesIds.filter((id) => id !== classId)
        : [...prev.classesIds, classId],
    }));
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
    if (formData.visibility === "PRIVATE" && formData.classesIds.length === 0) {
      Alert.alert("Erreur", "Sélectionnez au moins une classe pour une activité privée.");
      return false;
    }
    if (
      isEditMode &&
      formData.heureFin &&
      formData.heureDebut &&
      new Date(formData.heureFin) <= new Date(formData.heureDebut)
    ) {
      Alert.alert("Erreur", "La date de fin doit être postérieure à la date de début.");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user?.userId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }

    setSubmitting(true);
    try {
      // Upload any locally-picked files to MinIO before saving the activity.
      const uploadedMedias = await Promise.all(
        selectedImages
          .filter((img) => img.uri.startsWith("file:") || img.uri.startsWith("content:"))
          .map(async (img) => {
            const mediaType = img.type === "VIDEO" ? "VIDEO" : "IMAGE";
            const mimeType = img.mimeType ?? (mediaType === "VIDEO" ? "video/mp4" : "image/jpeg");
            const filePath = await mediaService.uploadFile(
              { uri: img.uri, mimeType, name: img.name },
              user.userId as string,
              mediaType
            );
            return {
              fileName: img.name,
              filePath,
              contentType: mimeType,
              fileSize: img.fileSizeBytes ?? 0,
              mediaType,
              bucketName: "scholchat",
            };
          })
      );

      // Existing media kept as-is: id preserved so the backend treats it as
      // "keep", not "new" — matches web's editEvent payload building.
      const keptExistingMedias = existingMedias.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        filePath: m.filePath,
        contentType: m.contentType,
        fileSize: m.fileSize,
        mediaType: m.mediaType,
        bucketName: m.bucketName || "scholchat",
      }));

      const payload = {
        titre: formData.titre,
        description: formData.description,
        createurId: user.userId,
        lieu: formData.lieu || undefined,
        etat: "PLANIFIE" as const,
        heureDebut: formData.heureDebut || undefined,
        heureFin: formData.heureFin || undefined,
        visibility: formData.visibility,
        classesIds: formData.visibility === "PRIVATE" ? formData.classesIds : [],
        medias: [...keptExistingMedias, ...uploadedMedias],
      };

      if (isEditMode && activityToEdit) {
        const updated = await activityFeedService.update(String(activityToEdit.id), payload);
        onUpdateActivity?.(updated);
        Alert.alert("Succès", "Activité modifiée avec succès!", [{ text: "OK", onPress: onClose }]);
      } else {
        const created = await activityFeedService.create(payload);
        onCreateActivity(created);
        resetForm();
        Alert.alert("Succès", "Activité créée avec succès!", [{ text: "OK", onPress: onClose }]);
      }
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'enregistrement de l'activité.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      isEditMode ? "Annuler la modification" : "Annuler la création",
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
        <Text style={modalStyles.headerTitle}>{isEditMode ? "Modifier l'activité" : "Créer une activité"}</Text>
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
          <Text style={modalStyles.fieldLabel}>Lieu</Text>
          <TextInput
            style={modalStyles.textInput}
            value={formData.lieu}
            onChangeText={(text) => setFormData({ ...formData, lieu: text })}
            placeholder="Lieu de l'activité (optionnel)"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Visibility Toggle */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Visibilité</Text>
          <View style={modalStyles.visibilityRow}>
            <TouchableOpacity
              style={[modalStyles.visibilityOption, formData.visibility === "PUBLIC" && modalStyles.visibilityOptionActivePublic]}
              onPress={() => setFormData({ ...formData, visibility: "PUBLIC" })}
            >
              <FontAwesome5 name="globe" size={14} color={formData.visibility === "PUBLIC" ? "#3B82F6" : "#6B7280"} />
              <Text style={[modalStyles.visibilityText, formData.visibility === "PUBLIC" && { color: "#3B82F6" }]}>Public</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.visibilityOption, formData.visibility === "PRIVATE" && modalStyles.visibilityOptionActivePrivate]}
              onPress={() => setFormData({ ...formData, visibility: "PRIVATE" })}
            >
              <FontAwesome5 name="lock" size={14} color={formData.visibility === "PRIVATE" ? "#7C3AED" : "#6B7280"} />
              <Text style={[modalStyles.visibilityText, formData.visibility === "PRIVATE" && { color: "#7C3AED" }]}>Privé</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Class picker — only for PRIVATE */}
        {formData.visibility === "PRIVATE" && (
          <View style={modalStyles.fieldContainer}>
            <Text style={modalStyles.fieldLabel}>Classes * (plusieurs possibles)</Text>
            {loadingClasses ? (
              <Text style={modalStyles.helpText}>Chargement des classes...</Text>
            ) : classes.length === 0 ? (
              <Text style={modalStyles.helpText}>Aucune classe disponible</Text>
            ) : (
              <View style={modalStyles.chipRow}>
                {classes.map((cls) => {
                  const selected = formData.classesIds.includes(cls.id);
                  return (
                    <TouchableOpacity
                      key={cls.id}
                      style={[modalStyles.chip, selected && modalStyles.chipActive]}
                      onPress={() => toggleClasse(cls.id)}
                    >
                      {selected && <FontAwesome5 name="check" size={10} color="#FFFFFF" style={{ marginRight: 4 }} />}
                      <Text style={[modalStyles.chipText, selected && modalStyles.chipTextActive]}>{cls.nom || cls.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Start Time */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Heure de début</Text>
          <TextInput
            style={modalStyles.textInput}
            value={formData.heureDebut}
            onChangeText={(text) => setFormData({ ...formData, heureDebut: text })}
            placeholder="DD/MM/YYYY HH:MM (optionnel — laissez vide pour une publication)"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* End Time */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Heure de fin</Text>
          <TextInput
            style={modalStyles.textInput}
            value={formData.heureFin}
            onChangeText={(text) => setFormData({ ...formData, heureFin: text })}
            placeholder="DD/MM/YYYY HH:MM (optionnel)"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Media Section */}
        <View style={modalStyles.fieldContainer}>
          <Text style={modalStyles.fieldLabel}>Médias</Text>

          <TouchableOpacity
            style={modalStyles.imagePickerButton}
            onPress={handleImagePicker}
          >
            <FontAwesome5 name="camera" size={20} color="#4F46E5" />
            <Text style={modalStyles.imagePickerText}>Ajouter une image ou une vidéo</Text>
          </TouchableOpacity>

          {(existingMedias.length > 0 || selectedImages.length > 0) && (
            <View style={modalStyles.imagesContainer}>
              {existingMedias.map((media) => (
                <View key={`existing-${media.id}`} style={modalStyles.imageContainer}>
                  {(media.mediaType || "IMAGE").toUpperCase() === "VIDEO" ? (
                    <View style={[modalStyles.image, modalStyles.videoPlaceholder]}>
                      <FontAwesome5 name="video" size={20} color="#FFFFFF" />
                    </View>
                  ) : media.presignedUrl ? (
                    <Image source={{ uri: media.presignedUrl }} style={modalStyles.image} />
                  ) : (
                    <View style={[modalStyles.image, modalStyles.videoPlaceholder]}>
                      <FontAwesome5 name="image" size={20} color="#FFFFFF" />
                    </View>
                  )}
                  <TouchableOpacity
                    style={modalStyles.removeImageButton}
                    onPress={() => removeExistingMedia(media.id)}
                  >
                    <FontAwesome5 name="times" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {selectedImages.map((image) => (
                <View key={image.id} style={modalStyles.imageContainer}>
                  {image.type === "VIDEO" ? (
                    <View style={[modalStyles.image, modalStyles.videoPlaceholder]}>
                      <FontAwesome5 name="video" size={20} color="#FFFFFF" />
                    </View>
                  ) : (
                    <Image source={{ uri: image.uri }} style={modalStyles.image} />
                  )}
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

      {/* Submit Button */}
      <View style={modalStyles.bottomContainer}>
        <TouchableOpacity
          style={[modalStyles.createButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <FontAwesome5
            name={submitting ? "spinner" : isEditMode ? "save" : "plus"}
            size={16}
            color="#FFFFFF"
            style={modalStyles.buttonIcon}
          />
          <Text style={modalStyles.createButtonText}>
            {submitting ? (isEditMode ? "Modification..." : "Création...") : isEditMode ? "Enregistrer" : "Créer l'activité"}
          </Text>
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
  visibilityRow: {
    flexDirection: "row",
    gap: 10,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  visibilityOptionActivePublic: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  visibilityOptionActivePrivate: {
    borderColor: "#0D9488",
    backgroundColor: "#CCFBF1",
  },
  visibilityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  chipActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#7C3AED",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  chipTextActive: {
    color: "#FFFFFF",
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
  videoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2937",
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
    height: 180,
  },
  bottomContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 95,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
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
