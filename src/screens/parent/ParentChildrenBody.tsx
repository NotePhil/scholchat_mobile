import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Avatar, Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography, useThemeColors } from "../../styles/theme";
import { parentService, studentService } from "../../services/api";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";

const ParentChildrenBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const { children, loading, selectedChildId, setSelectedChildId, loadChildren } = useSelectedChildStore();
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (user?.userId) loadChildren(user.userId);
  }, [user?.userId, loadChildren]);

  const handleRemove = (childId: string, name: string) => {
    const parentId = user?.userId;
    if (!parentId) return;
    Alert.alert("Retirer l'enfant", `Retirer ${name} de votre liste ? Cela ne supprime pas son compte.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          try {
            await parentService.removeChild(parentId, childId);
            loadChildren(parentId);
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du retrait.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes enfants</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAdd(true)}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : children.length === 0 ? (
          <EmptyState
            icon="child"
            title="Aucun enfant ajouté"
            message="Ajoutez le profil de votre enfant pour suivre ses classes et devoirs."
            actionLabel="Ajouter un enfant"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          children.map((child) => {
            const isSelected = selectedChildId === child.id;
            const isActive = (child.etat as string | undefined) !== "INACTIVE";
            return (
              <TouchableOpacity
                key={child.id}
                style={[styles.childCard, isSelected && styles.childCardActive]}
                onPress={() => setSelectedChildId(child.id)}
                activeOpacity={0.7}
              >
                <Avatar name={`${child.prenom ?? ""} ${child.nom ?? ""}`} size={48} />
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>
                    {child.prenom} {child.nom}
                  </Text>
                  <View style={styles.metaRow}>
                    {child.niveau ? <Text style={styles.childMeta}>Niveau: {child.niveau}</Text> : null}
                    <Badge label={isActive ? "Actif" : "Inactif"} tone={isActive ? "success" : "neutral"} />
                    {isSelected ? <Badge label="Sélectionné" tone="info" /> : null}
                  </View>
                </View>
                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemove(child.id, `${child.prenom} ${child.nom}`)}>
                  <FontAwesome5 name="trash" size={16} color={colors.danger} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <AddChildSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => user?.userId && loadChildren(user.userId)}
        parentId={user?.userId}
      />
    </View>
  );
};

interface AddChildSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  parentId?: string;
}

const AddChildSheet = ({ visible, onClose, onAdded, parentId }: AddChildSheetProps) => {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!parentId) {
      Alert.alert("Erreur", "Utilisateur non identifié.");
      return;
    }
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert("Erreur", "Le prénom et le nom sont obligatoires.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await studentService.create({ prenom: prenom.trim(), nom: nom.trim(), niveau: niveau.trim() });
      if (created.id) {
        await parentService.addChild(parentId, created.id);
      }
      setPrenom("");
      setNom("");
      setNiveau("");
      onAdded();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'ajout de l'enfant.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajouter un enfant">
      <Input label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Prénom de l'enfant" />
      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Nom de l'enfant" />
      <Input label="Niveau" value={niveau} onChangeText={setNiveau} placeholder="Ex: 3ème" />
      <Button label="Ajouter" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  list: { flex: 1, paddingHorizontal: 16 },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  childCardActive: { borderColor: colors.primary },
  childInfo: { marginLeft: spacing.md, flex: 1 },
  childName: { ...typography.bodyBold, color: colors.text, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs },
  childMeta: { ...typography.caption, color: colors.textMuted },
  removeButton: { padding: spacing.sm },
});

export default ParentChildrenBody;
