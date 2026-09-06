import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Chapitre, ChapitreImage, Cours } from "./DashboardCoursBody";
import { useUser } from "../../../../context/UserContext";
import { coursService, matiereService, mediaService } from "../../../../services/api";
import { LoadingSpinner } from "../../../../components/ui";
import PromptSheet from "../../../../components/common/PromptSheet";
import { Matiere } from "../../../../types";

// `etat` is intentionally never a user-facing field, on create OR edit — web
// forces it to "BROUILLON" on create and leaves it completely untouched on
// edit (CreateCourseComponent.jsx:1250: `editMode ? courseToEdit.etat :
// "BROUILLON"`, no `etat` form field exists at all). Mobile previously
// exposed it as a picker with a third value, "ARCHIVE", that doesn't exist
// anywhere in web's schema — a real risk of sending a state the backend
// doesn't expect.
type EtatValue = "BROUILLON" | "PUBLIE" | "ARCHIVE";
// Web's restriction select only ever offers PRIVE/PUBLIC — "LIMITE" isn't a
// real value here (CreateCourseComponent.jsx:1351-1357).
type RestrictionValue = "PUBLIC" | "PRIVE";

const restrictionOptions: Array<{ value: RestrictionValue; label: string; color: string }> = [
  { value: "PRIVE", label: "Privé", color: "#EF4444" },
  { value: "PUBLIC", label: "Public", color: "#10B981" },
];

interface CreateCoursBodyProps {
  onBack: () => void;
  onCreateCours: (cours: Cours) => void;
  editingCours?: Cours | null;
}

const CreateCoursBody = ({ onBack, onCreateCours, editingCours }: CreateCoursBodyProps) => {
  const { user } = useUser();
  const isEditing = !!editingCours;
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [linkPromptChapitreId, setLinkPromptChapitreId] = useState<number | string | null>(null);
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    etat: "BROUILLON" as EtatValue,
    references: "",
    restriction: "PRIVE" as RestrictionValue,
    redacteurId: user?.userId ?? "",
  });

  const [matiereOptions, setMatiereOptions] = useState<Matiere[]>([]);
  const [selectedMatieres, setSelectedMatieres] = useState<Matiere[]>([]);
  const [showMatieresDropdown, setShowMatieresDropdown] = useState(false);

  useEffect(() => {
    matiereService
      .getAll()
      .then(setMatiereOptions)
      .catch(() => setMatiereOptions([]));
  }, []);
  const [chapitres, setChapitres] = useState<Chapitre[]>([
    {
      id: Date.now(),
      title: "",
      description: "",
      content: "",
      images: [],
      links: [],
      isExpanded: true,
    },
  ]);

  useEffect(() => {
    if (!editingCours) return;
    setFormData({
      titre: editingCours.titre ?? "",
      description: editingCours.description ?? "",
      etat: (editingCours.etat as EtatValue) ?? "BROUILLON",
      references: editingCours.references ?? "",
      restriction: (editingCours.restriction as RestrictionValue) ?? "PRIVE",
      redacteurId: editingCours.redacteurId ?? user?.userId ?? "",
    });
    setLoadingExisting(true);
    coursService
      .getWithChapitres(editingCours.id)
      .then((full) => {
        const apiChapitres = full.chapitres ?? [];
        setChapitres(
          apiChapitres.length > 0
            ? apiChapitres.map((ch, index) => ({
                id: ch.id ?? Date.now() + index,
                title: ch.titre ?? "",
                description: (ch.description as string) ?? "",
                content: ch.contenu ?? "",
                images: ch.imageUrl
                  ? [{ id: (ch.id as string) ?? String(index), uri: ch.imageUrl as string, name: "image.jpg" }]
                  : [],
                links: [],
                isExpanded: index === 0,
              }))
            : [
                {
                  id: Date.now(),
                  title: "",
                  description: "",
                  content: "",
                  images: [],
                  links: [],
                  isExpanded: true,
                },
              ]
        );
        setSelectedMatieres(full.matieres ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, [editingCours]);

  const resetForm = () => {
    setFormData({
      titre: "",
      description: "",
      etat: "BROUILLON",
      references: "",
      restriction: "PRIVE",
      redacteurId: user?.userId ?? "",
    });
    setSelectedMatieres([]);
    setShowMatieresDropdown(false);
    setChapitres([
      {
        id: Date.now(),
        title: "",
        description: "",
        content: "",
        images: [],
        links: [],
        isExpanded: true,
      },
    ]);
  };

  const addChapitre = () => {
    const newChapitre: Chapitre = {
      id: Date.now(),
      title: "",
      description: "",
      content: "",
      images: [],
      links: [],
      isExpanded: true,
    };

    // Collapse all other chapters and expand the new one
    const updatedChapitres = chapitres.map((ch) => ({
      ...ch,
      isExpanded: false,
    }));
    setChapitres([...updatedChapitres, newChapitre]);
  };

  const removeChapitre = (id: number | string) => {
    if (chapitres.length > 1) {
      setChapitres(chapitres.filter((ch) => ch.id !== id));
    } else {
      Alert.alert("Information", "Au moins un chapitre doit être présent");
    }
  };

  const updateChapitre = <K extends keyof Chapitre>(id: number | string, field: K, value: Chapitre[K]) => {
    setChapitres(
      chapitres.map((ch) => (ch.id === id ? { ...ch, [field]: value } : ch))
    );
  };

  const toggleChapitreExpansion = (id: number | string) => {
    setChapitres(
      chapitres.map((ch) =>
        ch.id === id ? { ...ch, isExpanded: !ch.isExpanded } : ch
      )
    );
  };

  const addImageToChapitre = async (chapitreId: number | string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l'accès à vos photos pour ajouter une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    // The backend's Chapitre model only stores a single imageUrl, so a newly
    // picked image replaces any previous one instead of accumulating.
    const picked: ChapitreImage = {
      id: Date.now().toString(),
      uri: asset.uri,
      name: asset.fileName ?? `image_${Date.now()}.jpg`,
    };
    updateChapitre(chapitreId, "images", [picked]);
  };

  const removeImageFromChapitre = (chapitreId: number | string, imageId: string) => {
    const chapitre = chapitres.find((ch) => ch.id === chapitreId);
    if (!chapitre) return;
    updateChapitre(
      chapitreId,
      "images",
      chapitre.images.filter((img) => img.id !== imageId)
    );
  };

  const addLinkToChapitre = (chapitreId: number | string) => {
    setLinkPromptChapitreId(chapitreId);
  };

  const handleConfirmAddLink = (url: string) => {
    if (!linkPromptChapitreId) return;
    const newLink = { id: Date.now().toString(), url, title: url };
    const chapitre = chapitres.find((ch) => ch.id === linkPromptChapitreId);
    if (chapitre) {
      updateChapitre(linkPromptChapitreId, "links", [...chapitre.links, newLink]);
    }
    setLinkPromptChapitreId(null);
  };

  const removeLinkFromChapitre = (chapitreId: number | string, linkId: string) => {
    const chapitre = chapitres.find((ch) => ch.id === chapitreId);
    if (!chapitre) return;
    updateChapitre(
      chapitreId,
      "links",
      chapitre.links.filter((link) => link.id !== linkId)
    );
  };

  const formatText = (chapitreId: number | string, format: string) => {
    const chapitre = chapitres.find((ch) => ch.id === chapitreId);
    if (!chapitre) return;
    let formattedText = chapitre.content;

    switch (format) {
      case "bold":
        formattedText += " **Texte en gras** ";
        break;
      case "italic":
        formattedText += " *Texte en italique* ";
        break;
      case "underline":
        formattedText += " __Texte souligné__ ";
        break;
      case "list":
        formattedText += "\n• Élément de liste\n";
        break;
      case "heading":
        formattedText += "\n# Titre de section\n";
        break;
    }

    updateChapitre(chapitreId, "content", formattedText);
  };

  const toggleMatiere = (matiere: Matiere) => {
    if (selectedMatieres.some((m) => m.id === matiere.id)) {
      setSelectedMatieres(selectedMatieres.filter((m) => m.id !== matiere.id));
    } else {
      setSelectedMatieres([...selectedMatieres, matiere]);
    }
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
    if (selectedMatieres.length === 0) {
      Alert.alert("Erreur", "Au moins une matière doit être sélectionnée");
      return false;
    }

    const validChapitres = chapitres.filter((ch) => ch.title.trim().length > 0);
    if (validChapitres.length === 0) {
      Alert.alert(
        "Erreur",
        "Au moins un chapitre avec un titre doit être défini"
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user?.userId) {
      Alert.alert("Erreur", "Utilisateur non identifié. Veuillez vous reconnecter.");
      return;
    }

    const validChapitres = chapitres.filter((ch) => ch.title.trim().length > 0);

    setSubmitting(true);
    try {
      const chapitresPayload = await Promise.all(
        validChapitres.map(async (ch, index) => {
          const image = ch.images[0];
          let imageUrl: string | undefined;
          if (image) {
            const isLocal = image.uri.startsWith("file:") || image.uri.startsWith("content:");
            imageUrl = isLocal
              ? await mediaService.uploadFile(
                  { uri: image.uri, mimeType: "image/jpeg", name: image.name },
                  user.userId as string,
                  "IMAGE"
                )
              : image.uri;
          }
          // The backend's Chapitre model has no dedicated `links` field, so
          // links are folded into `contenu` as markdown to actually persist
          // instead of being silently dropped on save.
          const linksMarkdown = ch.links.map((link) => `\n[${link.title}](${link.url})`).join("");
          const payload: Record<string, unknown> = {
            titre: ch.title,
            contenu: ch.content + linksMarkdown,
            description: ch.description,
            ordre: index,
            imageUrl,
          };
          if (typeof ch.id === "string") payload.id = ch.id;
          return payload;
        })
      );

      const coursPayload = {
        titre: formData.titre,
        description: formData.description,
        etat: formData.etat,
        references: formData.references || "Aucune référence spécifiée",
        restriction: formData.restriction,
        redacteurId: formData.redacteurId || user.userId,
        // Web's CoursService.js sends only { id } per matiere — matching backend schema.
        matieres: selectedMatieres.map((m) => ({ id: m.id })),
        chapitres: chapitresPayload,
      };

      const created = isEditing
        ? await coursService.update(editingCours!.id, coursPayload)
        : await coursService.create(coursPayload);

      const newCours: Cours = {
        id: created.id ?? editingCours?.id ?? Date.now().toString(),
        titre: created.titre ?? formData.titre,
        description: created.description ?? formData.description,
        dateCreation: created.dateCreation ?? editingCours?.dateCreation ?? new Date().toISOString().split("T")[0],
        etat: created.etat ?? formData.etat,
        references: formData.references || "Aucune référence spécifiée",
        restriction: formData.restriction,
        chapitres: validChapitres.map((ch) => ch.title),
        chapitresDetailles: validChapitres,
        matieres: selectedMatieres.map((m) => m.nom ?? ""),
        redacteurId: user.userId,
      };

      onCreateCours(newCours);
      resetForm();
      Alert.alert("Succès", isEditing ? "Cours mis à jour avec succès!" : "Cours créé avec succès!", [
        { text: "OK", onPress: onBack },
      ]);
    } catch (err) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Échec de l'enregistrement du cours."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Annuler",
      "Êtes-vous sûr de vouloir annuler? Toutes les données saisies seront perdues.",
      [
        { text: "Continuer", style: "cancel" },
        {
          text: "Annuler",
          style: "destructive",
          onPress: () => {
            resetForm();
            onBack();
          },
        },
      ]
    );
  };

  return (
    <View style={createStyles.container}>
      {/* Header */}
      <View style={createStyles.header}>
        <TouchableOpacity onPress={onBack} style={createStyles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={createStyles.headerTitle}>{isEditing ? "Modifier le cours" : "Créer un cours"}</Text>
        <TouchableOpacity
          onPress={handleCancel}
          style={createStyles.cancelButton}
        >
          <Text style={createStyles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {loadingExisting ? (
        <LoadingSpinner label="Chargement du cours..." />
      ) : (
      <>
      {/* Content */}
      <ScrollView
        style={createStyles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={createStyles.contentContainer}
      >
        {/* Title Field */}
        <View style={createStyles.fieldContainer}>
          <Text style={createStyles.fieldLabel}>Titre du cours *</Text>
          <TextInput
            style={createStyles.textInput}
            value={formData.titre}
            onChangeText={(text) => setFormData({ ...formData, titre: text })}
            placeholder="Entrez le titre du cours"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Description Field */}
        <View style={createStyles.fieldContainer}>
          <Text style={createStyles.fieldLabel}>Description *</Text>
          <TextInput
            style={[createStyles.textInput, createStyles.textArea]}
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
            placeholder="Décrivez le contenu et les objectifs du cours"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Restriction Selection */}
        <View style={createStyles.fieldContainer}>
          <Text style={createStyles.fieldLabel}>Restriction d'accès</Text>
          <View style={createStyles.optionsContainer}>
            {restrictionOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  createStyles.option,
                  formData.restriction === option.value && {
                    backgroundColor: option.color + "20",
                    borderColor: option.color,
                  },
                ]}
                onPress={() =>
                  setFormData({ ...formData, restriction: option.value })
                }
              >
                <View
                  style={[
                    createStyles.optionIndicator,
                    { backgroundColor: option.color },
                  ]}
                />
                <Text
                  style={[
                    createStyles.optionText,
                    formData.restriction === option.value && {
                      color: option.color,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Matières Selection */}
        <View style={createStyles.fieldContainer}>
          <Text style={createStyles.fieldLabel}>Matières *</Text>
          <TouchableOpacity
            style={createStyles.dropdownButton}
            onPress={() => setShowMatieresDropdown(!showMatieresDropdown)}
          >
            <Text style={createStyles.dropdownButtonText}>
              {selectedMatieres.length > 0
                ? `${selectedMatieres.length} matière(s) sélectionnée(s)`
                : "Sélectionner les matières"}
            </Text>
            <FontAwesome5
              name={showMatieresDropdown ? "chevron-up" : "chevron-down"}
              size={14}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showMatieresDropdown && (
            <View style={createStyles.dropdownContainer}>
              {matiereOptions.length === 0 ? (
                <View style={createStyles.dropdownItem}>
                  <Text style={createStyles.dropdownItemText}>Aucune matière disponible</Text>
                </View>
              ) : (
                matiereOptions.map((matiere) => {
                  const isSelected = selectedMatieres.some((m) => m.id === matiere.id);
                  return (
                    <TouchableOpacity
                      key={matiere.id}
                      style={[createStyles.dropdownItem, isSelected && createStyles.dropdownItemSelected]}
                      onPress={() => toggleMatiere(matiere)}
                    >
                      <Text
                        style={[createStyles.dropdownItemText, isSelected && createStyles.dropdownItemTextSelected]}
                      >
                        {matiere.nom}
                      </Text>
                      {isSelected && <FontAwesome5 name="check" size={14} color="#4F46E5" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {selectedMatieres.length > 0 && (
            <View style={createStyles.selectedMatieresContainer}>
              {selectedMatieres.map((matiere) => (
                <View key={matiere.id} style={createStyles.selectedMatiereTag}>
                  <Text style={createStyles.selectedMatiereText}>
                    {matiere.nom}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleMatiere(matiere)}
                    style={createStyles.removeTagButton}
                  >
                    <FontAwesome5 name="times" size={12} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* References Field */}
        <View style={createStyles.fieldContainer}>
          <Text style={createStyles.fieldLabel}>Références</Text>
          <TextInput
            style={[createStyles.textInput, createStyles.textArea]}
            value={formData.references}
            onChangeText={(text) =>
              setFormData({ ...formData, references: text })
            }
            placeholder="Livres, articles, ressources en ligne, etc."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={createStyles.helpText}>
            Listez les références bibliographiques et ressources du cours
          </Text>
        </View>

        {/* Chapitres - Rich Text Editor */}
        <View style={createStyles.fieldContainer}>
          <View style={createStyles.chapitresHeader}>
            <Text style={createStyles.fieldLabel}>Chapitres du cours *</Text>
            <TouchableOpacity
              style={createStyles.addChapterButton}
              onPress={addChapitre}
            >
              <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
              <Text style={createStyles.addChapterButtonText}>
                Nouveau chapitre
              </Text>
            </TouchableOpacity>
          </View>

          {chapitres.map((chapitre, index) => (
            <View key={chapitre.id} style={createStyles.chapitreCard}>
              {/* Chapter Header */}
              <View style={createStyles.chapitreHeader}>
                <TouchableOpacity
                  style={createStyles.chapitreToggle}
                  onPress={() => toggleChapitreExpansion(chapitre.id)}
                >
                  <FontAwesome5
                    name={
                      chapitre.isExpanded ? "chevron-down" : "chevron-right"
                    }
                    size={14}
                    color="#6B7280"
                  />
                  <Text style={createStyles.chapitreNumber}>
                    Chapitre {index + 1}
                  </Text>
                </TouchableOpacity>

                {chapitres.length > 1 && (
                  <TouchableOpacity
                    style={createStyles.removeChapterButton}
                    onPress={() => removeChapitre(chapitre.id)}
                  >
                    <FontAwesome5 name="trash" size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Chapter Content - Expanded */}
              {chapitre.isExpanded && (
                <View style={createStyles.chapitreContent}>
                  {/* Chapter Title */}
                  <View style={createStyles.chapitreFieldContainer}>
                    <Text style={createStyles.chapitreFieldLabel}>
                      Titre du chapitre *
                    </Text>
                    <TextInput
                      style={createStyles.chapitreInput}
                      value={chapitre.title}
                      onChangeText={(text) =>
                        updateChapitre(chapitre.id, "title", text)
                      }
                      placeholder={`Titre du chapitre ${index + 1}`}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  {/* Chapter Description */}
                  <View style={createStyles.chapitreFieldContainer}>
                    <Text style={createStyles.chapitreFieldLabel}>
                      Description
                    </Text>
                    <TextInput
                      style={[
                        createStyles.chapitreInput,
                        createStyles.chapitreTextArea,
                      ]}
                      value={chapitre.description}
                      onChangeText={(text) =>
                        updateChapitre(chapitre.id, "description", text)
                      }
                      placeholder="Description du chapitre"
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Rich Text Editor Toolbar */}
                  <View style={createStyles.editorToolbar}>
                    <Text style={createStyles.chapitreFieldLabel}>
                      Contenu du chapitre
                    </Text>
                    <View style={createStyles.toolbarButtons}>
                      <TouchableOpacity
                        style={createStyles.toolbarButton}
                        onPress={() => formatText(chapitre.id, "bold")}
                      >
                        <FontAwesome5 name="bold" size={14} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={createStyles.toolbarButton}
                        onPress={() => formatText(chapitre.id, "italic")}
                      >
                        <FontAwesome5 name="italic" size={14} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={createStyles.toolbarButton}
                        onPress={() => formatText(chapitre.id, "underline")}
                      >
                        <FontAwesome5
                          name="underline"
                          size={14}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={createStyles.toolbarButton}
                        onPress={() => formatText(chapitre.id, "list")}
                      >
                        <FontAwesome5
                          name="list-ul"
                          size={14}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={createStyles.toolbarButton}
                        onPress={() => formatText(chapitre.id, "heading")}
                      >
                        <FontAwesome5
                          name="heading"
                          size={14}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={createStyles.toolbarButton}
                        onPress={() => addImageToChapitre(chapitre.id)}
                      >
                        <FontAwesome5 name="image" size={14} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={createStyles.toolbarButton}
                        onPress={() => addLinkToChapitre(chapitre.id)}
                      >
                        <FontAwesome5 name="link" size={14} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Content Text Area */}
                  <TextInput
                    style={[
                      createStyles.chapitreInput,
                      createStyles.contentTextArea,
                    ]}
                    value={chapitre.content}
                    onChangeText={(text) =>
                      updateChapitre(chapitre.id, "content", text)
                    }
                    placeholder="Rédigez le contenu du chapitre ici..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                  />

                  {/* Chapter Images */}
                  {chapitre.images.length > 0 && (
                    <View style={createStyles.mediaContainer}>
                      <Text style={createStyles.mediaLabel}>
                        Images du chapitre
                      </Text>
                      <View style={createStyles.imagesGrid}>
                        {chapitre.images.map((image) => (
                          <View
                            key={image.id}
                            style={createStyles.imageContainer}
                          >
                            <Image
                              source={{ uri: image.uri }}
                              style={createStyles.chapterImage}
                            />
                            <TouchableOpacity
                              style={createStyles.removeMediaButton}
                              onPress={() =>
                                removeImageFromChapitre(chapitre.id, image.id)
                              }
                            >
                              <FontAwesome5
                                name="times"
                                size={10}
                                color="#FFFFFF"
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Chapter Links */}
                  {chapitre.links.length > 0 && (
                    <View style={createStyles.linksContainer}>
                      <Text style={createStyles.mediaLabel}>
                        Liens du chapitre
                      </Text>
                      {chapitre.links.map((link) => (
                        <View key={link.id} style={createStyles.linkItem}>
                          <FontAwesome5 name="link" size={12} color="#4F46E5" />
                          <Text style={createStyles.linkText} numberOfLines={1}>
                            {link.title}
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              removeLinkFromChapitre(chapitre.id, link.id)
                            }
                            style={createStyles.removeLinkButton}
                          >
                            <FontAwesome5
                              name="times"
                              size={10}
                              color="#EF4444"
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={createStyles.bottomSpacing} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={createStyles.bottomContainer}>
        <TouchableOpacity
          style={[createStyles.createButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <FontAwesome5
            name={submitting ? "spinner" : "book"}
            size={16}
            color="#FFFFFF"
            style={createStyles.buttonIcon}
          />
          <Text style={createStyles.createButtonText}>
            {submitting ? "Enregistrement..." : isEditing ? "Enregistrer les modifications" : "Créer le cours"}
          </Text>
        </TouchableOpacity>
      </View>
      </>
      )}

      <PromptSheet
        visible={!!linkPromptChapitreId}
        title="Ajouter un lien"
        placeholder="https://..."
        submitLabel="Ajouter"
        onCancel={() => setLinkPromptChapitreId(null)}
        onSubmit={handleConfirmAddLink}
      />
    </View>
  );
};

const createStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
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
  },
  contentContainer: {
    paddingHorizontal: 16,
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
    backgroundColor: "#FFFFFF",
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
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  option: {
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
  optionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#111827",
  },
  dropdownContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dropdownItemSelected: {
    backgroundColor: "#EEF2FF",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#111827",
  },
  dropdownItemTextSelected: {
    color: "#4F46E5",
    fontWeight: "600",
  },
  selectedMatieresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  selectedMatiereTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedMatiereText: {
    fontSize: 12,
    color: "#4F46E5",
    fontWeight: "500",
    marginRight: 6,
  },
  removeTagButton: {
    padding: 2,
  },
  helpText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 6,
    fontStyle: "italic",
    paddingHorizontal: 4,
  },

  // Chapter Styles
  chapitresHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addChapterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addChapterButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  chapitreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chapitreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  chapitreToggle: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  chapitreNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  removeChapterButton: {
    padding: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
  },
  chapitreContent: {
    padding: 16,
  },
  chapitreFieldContainer: {
    marginBottom: 16,
  },
  chapitreFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  chapitreInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  chapitreTextArea: {
    height: 80,
    textAlignVertical: "top",
  },
  contentTextArea: {
    height: 150,
    textAlignVertical: "top",
    fontFamily: "monospace",
  },

  // Rich Text Editor Toolbar
  editorToolbar: {
    marginBottom: 12,
  },
  toolbarButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    gap: 8,
  },
  toolbarButton: {
    width: 36,
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Media Styles
  mediaContainer: {
    marginTop: 16,
  },
  mediaLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageContainer: {
    position: "relative",
  },
  chapterImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  removeMediaButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  linksContainer: {
    marginTop: 16,
  },
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#4F46E5",
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: "#4F46E5",
    marginLeft: 8,
    marginRight: 8,
  },
  removeLinkButton: {
    padding: 4,
  },

  bottomSpacing: {
    height: 180,
  },
  bottomContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
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

export default CreateCoursBody;
