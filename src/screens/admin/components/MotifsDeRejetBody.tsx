import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import { colors, radius, spacing, typography } from "../../../styles/theme";
import { rejectionClassService, rejectionService } from "../../../services/api";
import { RejectionMotif } from "../../../types";

type MotifType = "prof" | "classe";

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

/** Matches web's MotifsDeRejet.jsx exactly — Admin-only (/motifsRejets/** is hasRole(ADMIN) server-side). */
const MotifsDeRejetBody = () => {
  const [type, setType] = useState<MotifType>("prof");
  const [motifs, setMotifs] = useState<RejectionMotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RejectionMotif | null>(null);
  const [code, setCode] = useState("");
  const [descriptif, setDescriptif] = useState("");
  const [codeError, setCodeError] = useState("");
  const [descError, setDescError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = type === "prof" ? await rejectionService.getAll() : await rejectionClassService.getAll();
      setMotifs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des motifs de rejet.");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setCode("");
    setDescriptif("");
    setCodeError("");
    setDescError("");
    setEditing(null);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (motif: RejectionMotif) => {
    setEditing(motif);
    setCode(motif.code ?? "");
    setDescriptif(motif.descriptif ?? "");
    setCodeError("");
    setDescError("");
    setShowForm(true);
  };

  const validate = () => {
    let ok = true;
    if (!code.trim()) {
      setCodeError("Le code est requis");
      ok = false;
    } else if (!/^[A-Z0-9_]+$/.test(code)) {
      setCodeError("Majuscules, chiffres et underscores uniquement");
      ok = false;
    } else {
      setCodeError("");
    }
    if (!descriptif.trim()) {
      setDescError("La description est requise");
      ok = false;
    } else {
      setDescError("");
    }
    return ok;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (editing && type === "prof") {
        const updated = await rejectionService.update(editing.id, { code, descriptif });
        setMotifs((prev) => prev.map((m) => (m.id === editing.id ? updated : m)));
      } else if (editing) {
        // Class motifs have no update endpoint server-side (no PUT/PATCH on
        // /motifsRejetClasses) — matches web's updateMotif() exactly: the
        // edit form is still shown, "Mettre à jour" just applies locally.
        setMotifs((prev) => prev.map((m) => (m.id === editing.id ? { ...m, code, descriptif } : m)));
      } else if (type === "prof") {
        const created = await rejectionService.create({ code, descriptif });
        setMotifs((prev) => [...prev, created]);
      } else {
        const created = await rejectionClassService.create({ code, descriptif });
        setMotifs((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (motif: RejectionMotif) => {
    Alert.alert(
      "Supprimer",
      `Êtes-vous sûr de vouloir supprimer ce motif de rejet de ${type === "prof" ? "professeur" : "classe"} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              if (type === "prof") await rejectionService.remove(motif.id);
              else await rejectionClassService.remove(motif.id);
              setMotifs((prev) => prev.filter((m) => m.id !== motif.id));
            } catch (err) {
              Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Motifs de Rejet</Text>
          <Text style={styles.subtitle}>{type === "prof" ? "Motifs de Rejet de Professeur" : "Motifs de Rejet de Classe"}</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeButton, type === "prof" && styles.typeButtonActive]}
          onPress={() => {
            setType("prof");
            resetForm();
          }}
        >
          <FontAwesome5 name="user-check" size={12} color={type === "prof" ? colors.white : colors.text} />
          <Text style={[styles.typeText, type === "prof" && styles.typeTextActive]}>Professeur</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, type === "classe" && styles.typeButtonActive]}
          onPress={() => {
            setType("classe");
            resetForm();
          }}
        >
          <FontAwesome5 name="users" size={12} color={type === "classe" ? colors.white : colors.text} />
          <Text style={[styles.typeText, type === "classe" && styles.typeTextActive]}>Classe</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : motifs.length === 0 ? (
          <EmptyState
            icon="ban"
            title={`Aucun motif de rejet ${type === "prof" ? "de professeur" : "de classe"}`}
            actionLabel="Ajouter Motif"
            onAction={openCreate}
          />
        ) : (
          motifs.map((m) => (
            <View key={m.id} style={styles.card}>
              <Text style={styles.cardCode}>{m.code}</Text>
              <Text style={styles.cardDesc}>{m.descriptif}</Text>
              <View style={styles.cardBottom}>
                <View style={styles.dateRow}>
                  <FontAwesome5 name="calendar-alt" size={11} color={colors.textMuted} />
                  <Text style={styles.dateText}>{formatDate(m.dateCreation)}</Text>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => openEdit(m)} style={styles.iconButton}>
                    <FontAwesome5 name="edit" size={15} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(m)} style={styles.iconButton}>
                    <FontAwesome5 name="trash" size={15} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomSheet
        visible={showForm}
        onClose={resetForm}
        title={`${editing ? "Modifier" : "Ajouter"} Motif - ${type === "prof" ? "Professeur" : "Classe"}`}
      >
        <Input
          label="Code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder={type === "prof" ? "Ex: PHOTO_FLOU_RECTO" : "Ex: ABSENCE_NON_JUSTIFIEE"}
          autoCapitalize="characters"
          error={codeError}
        />
        <Input
          label="Description"
          value={descriptif}
          onChangeText={setDescriptif}
          placeholder={type === "prof" ? "Ex: Photo recto de la CNI floue ou illisible" : "Ex: Absence non justifiée sans document valable"}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
          error={descError}
        />
        <Button
          label={editing ? "Mettre à jour" : "Enregistrer"}
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  typeRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: spacing.md, gap: spacing.sm },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.grayLight,
  },
  typeButtonActive: { backgroundColor: colors.primary },
  typeText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  typeTextActive: { color: colors.white },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardCode: { ...typography.bodyBold, color: colors.text, fontFamily: "monospace" },
  cardDesc: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { ...typography.caption, color: colors.textMuted },
  actionsRow: { flexDirection: "row", gap: spacing.md },
  iconButton: { padding: 4 },
});

export default MotifsDeRejetBody;
