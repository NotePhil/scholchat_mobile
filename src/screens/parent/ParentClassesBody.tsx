import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { EmptyState, LoadingSpinner } from "../../components/ui";
import JoinClassSheet from "../shared/JoinClassSheet";
import { colors, spacing, typography } from "../../styles/theme";
import { parentService } from "../../services/api";
import { ClassEntity, StudentProfile } from "../../types";
import { useUser } from "../../context/UserContext";

const ParentClassesBody = () => {
  const { user } = useUser();
  const [children, setChildren] = useState<StudentProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const loadClassesForSelectedChild = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      setClasses(await parentService.getChildClasses(selectedChildId));
    } catch {
      // handled by the main load effect's error state
    }
  }, [selectedChildId]);

  const loadChildren = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const data = await parentService.getChildren(user.userId);
      setChildren(data);
      if (data.length > 0) setSelectedChildId(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
    }
  }, [user?.userId]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    const loadClasses = async () => {
      if (!selectedChildId) {
        setClasses([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await parentService.getChildClasses(selectedChildId);
        setClasses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Échec du chargement des classes.");
      } finally {
        setLoading(false);
      }
    };
    loadClasses();
  }, [selectedChildId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        {selectedChildId ? (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowJoin(true)}>
            <FontAwesome5 name="plus" size={14} color={colors.white} />
          </TouchableOpacity>
        ) : null}
      </View>

      {children.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childRow}>
          {children.map((child) => (
            <TouchableOpacity
              key={child.id}
              style={[styles.childChip, selectedChildId === child.id && styles.childChipActive]}
              onPress={() => setSelectedChildId(child.id)}
            >
              <Text style={[styles.childChipText, selectedChildId === child.id && styles.childChipTextActive]}>
                {child.prenom} {child.nom}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!user || children.length === 0 ? (
          <EmptyState icon="child" title="Aucun enfant" message="Ajoutez un enfant depuis l'onglet 'Mes enfants'." />
        ) : loading ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : classes.length === 0 ? (
          <EmptyState icon="chalkboard" title="Aucune classe" message="Cet enfant n'est inscrit à aucune classe." />
        ) : (
          classes.map((cls) => (
            <View key={cls.id} style={styles.classCard}>
              <Text style={styles.className}>{cls.nom ?? "Classe"}</Text>
              {cls.niveau ? <Text style={styles.classMeta}>Niveau: {cls.niveau}</Text> : null}
              {cls.etablissement?.nom ? <Text style={styles.classMeta}>{cls.etablissement.nom}</Text> : null}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <JoinClassSheet
        visible={showJoin}
        onClose={() => setShowJoin(false)}
        onSubmitted={loadClassesForSelectedChild}
        utilisateurId={selectedChildId ?? undefined}
        estParent
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  childRow: { paddingHorizontal: 16, marginBottom: spacing.md, flexGrow: 0 },
  childChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight, marginRight: spacing.sm },
  childChipActive: { backgroundColor: colors.primary },
  childChipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  childChipTextActive: { color: colors.white },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  classCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  className: { ...typography.bodyBold, color: colors.text },
  classMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

export default ParentClassesBody;
