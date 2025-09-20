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
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const etatOptions = [
  { value: "BROUILLON", label: "Brouillon", color: "#F59E0B" },
  { value: "PUBLIE", label: "Publié", color: "#10B981" },
  { value: "ARCHIVE", label: "Archivé", color: "#6B7280" },
];

const restrictionOptions = [
  { value: "PUBLIC", label: "Public", color: "#10B981" },
  { value: "PRIVE", label: "Privé", color: "#EF4444" },
  { value: "LIMITE", label: "Limité", color: "#F59E0B" },
];

const matiereOptions = [
  "Mathématiques",
  "Physique",
  "Chimie",
  "Histoire",
  "Géographie",
  "Français",
  "Anglais",
  "Informatique",
  "Biologie",
  "Philosophie",
];

const CreateCoursBody = ({ onBack, onCreateCours }) => {
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    etat: "BROUILLON",
    references: "",
    restriction: "PUBLIC",
    redacteurId: "current_user_id",
  });

  const [selectedMatieres, setSelectedMatieres] = useState([]);
  const [showMatieresDropdown, setShowMatieresDropdown] = useState(false);
  const [chapitres, setChapitres] = useState([
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

  const resetForm = () => {
    setFormData({
      titre: "",
      description: "",
      etat: "BROUILLON",
      references: "",
      restriction: "PUBLIC",
      redacteurId: "current_user_id",
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
    const newChapitre = {
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

  const removeChapitre = (id) => {
    if (chapitres.length > 1) {
      setChapitres(chapitres.filter((ch) => ch.id !== id));
    } else {
      Alert.alert("Information", "Au moins un chapitre doit être présent");
    }
  };

  const updateChapitre = (id, field, value) => {
    setChapitres(
      chapitres.map((ch) => (ch.id === id ? { ...ch, [field]: value } : ch))
    );
  };

  const toggleChapitreExpansion = (id) => {
    setChapitres(
      chapitres.map((ch) =>
        ch.id === id ? { ...ch, isExpanded: !ch.isExpanded } : ch
      )
    );
  };

  const addImageToChapitre = (chapitreId) => {
    const mockImage = {
      id: Date.now().toString(),
      uri: `https://picsum.photos/400/300?random=${Date.now()}`,
      name: `image_${Date.now()}.jpg`,
    };

    updateChapitre(chapitreId, "images", [
      ...chapitres.find((ch) => ch.id === chapitreId).images,
      mockImage,
    ]);
  };

  const removeImageFromChapitre = (chapitreId, imageId) => {
    const chapitre = chapitres.find((ch) => ch.id === chapitreId);
    updateChapitre(
      chapitreId,
      "images",
      chapitre.images.filter((img) => img.id !== imageId)
    );
  };

  const addLinkToChapitre = (chapitreId) => {
    Alert.prompt(
      "Ajouter un lien",
      "Entrez l'URL du lien:",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Ajouter",
          onPress: (url) => {
            if (url && url.trim()) {
              const newLink = {
                id: Date.now().toString(),
                url: url.trim(),
                title: url.trim(),
              };
              updateChapitre(chapitreId, "links", [
                ...chapitres.find((ch) => ch.id === chapitreId).links,
                newLink,
              ]);
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const removeLinkFromChapitre = (chapitreId, linkId) => {
    const chapitre = chapitres.find((ch) => ch.id === chapitreId);
    updateChapitre(
      chapitreId,
      "links",
      chapitre.links.filter((link) => link.id !== linkId)
    );
  };

  const formatText = (chapitreId, format) => {
    const chapitre = chapitres.find((ch) => ch.id === chapitreId);
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

  const toggleMatiere = (matiere) => {
    if (selectedMatieres.includes(matiere)) {
      setSelectedMatieres(selectedMatieres.filter((m) => m !== matiere));
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

  const handleSubmit = () => {
    if (!validateForm()) return;

    const validChapitres = chapitres.filter((ch) => ch.title.trim().length > 0);

    const newCours = {
      id: Date.now().toString(),
      titre: formData.titre,
      description: formData.description,
      dateCreation: new Date().toISOString().split("T")[0],
      etat: formData.etat,
      references: formData.references || "Aucune référence spécifiée",
      restriction: formData.restriction,
      chapitres: validChapitres.map((ch) => ch.title), // For backward compatibility
      chapitresDetailles: validChapitres, // Full chapter data
      matieres: selectedMatieres,
      redacteurId: formData.redacteurId,
    };

    onCreateCours(newCours);
    resetForm();
    Alert.alert("Succès", "Cours créé avec succès!", [
      { text: "OK", onPress: onBack },
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
        <Text style={createStyles.headerTitle}>Créer un cours</Text>
        <TouchableOpacity
          onPress={handleCancel}
          style={createStyles.cancelButton}
        >
          <Text style={createStyles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>

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

        {/* État Selection */}
        <View style={createStyles.fieldContainer}>
          <Text style={createStyles.fieldLabel}>État du cours</Text>
          <View style={createStyles.optionsContainer}>
            {etatOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  createStyles.option,
                  formData.etat === option.value && {
                    backgroundColor: option.color + "20",
                    borderColor: option.color,
                  },
                ]}
                onPress={() => setFormData({ ...formData, etat: option.value })}
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
                    formData.etat === option.value && { color: option.color },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
              {matiereOptions.map((matiere) => (
                <TouchableOpacity
                  key={matiere}
                  style={[
                    createStyles.dropdownItem,
                    selectedMatieres.includes(matiere) &&
                      createStyles.dropdownItemSelected,
                  ]}
                  onPress={() => toggleMatiere(matiere)}
                >
                  <Text
                    style={[
                      createStyles.dropdownItemText,
                      selectedMatieres.includes(matiere) &&
                        createStyles.dropdownItemTextSelected,
                    ]}
                  >
                    {matiere}
                  </Text>
                  {selectedMatieres.includes(matiere) && (
                    <FontAwesome5 name="check" size={14} color="#4F46E5" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedMatieres.length > 0 && (
            <View style={createStyles.selectedMatieresContainer}>
              {selectedMatieres.map((matiere) => (
                <View key={matiere} style={createStyles.selectedMatiereTag}>
                  <Text style={createStyles.selectedMatiereText}>
                    {matiere}
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
          style={createStyles.createButton}
          onPress={handleSubmit}
        >
          <FontAwesome5
            name="book"
            size={16}
            color="#FFFFFF"
            style={createStyles.buttonIcon}
          />
          <Text style={createStyles.createButtonText}>Créer le cours</Text>
        </TouchableOpacity>
      </View>
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
    height: 100,
  },
  bottomContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
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

export default CreateCoursBody;
