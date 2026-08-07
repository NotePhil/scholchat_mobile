import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Avatar, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { parentService, studentService } from "../../services/api";
import { StudentProfile } from "../../types";
import { useUser } from "../../context/UserContext";

const ParentChildrenBody = () => {
  const { user } = useUser();
  const [children, setChildren] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await parentService.getChildren(user.userId);
      setChildren(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des enfants.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes enfants</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAdd(true)}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
          children.map((child) => (
            <View key={child.id} style={styles.childCard}>
              <Avatar name={`${child.prenom ?? ""} ${child.nom ?? ""}`} size={48} />
              <View style={styles.childInfo}>
                <Text style={styles.childName}>
                  {child.prenom} {child.nom}
                </Text>
                {child.niveau ? <Text style={styles.childMeta}>Niveau: {child.niveau}</Text> : null}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <AddChildSheet visible={showAdd} onClose={() => setShowAdd(false)} onAdded={load} parentId={user?.userId} />
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

const styles = StyleSheet.create({
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
  error: { color: colors.danger, marginBottom: spacing.md },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  childInfo: { marginLeft: spacing.md },
  childName: { ...typography.bodyBold, color: colors.text },
  childMeta: { ...typography.caption, color: colors.textMuted },
});

export default ParentChildrenBody;
