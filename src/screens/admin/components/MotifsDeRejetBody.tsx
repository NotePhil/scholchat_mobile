import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../../styles/theme";
import { rejectionClassService, rejectionService } from "../../../services/api";
import { RejectionMotif } from "../../../types";

// LinearGradient with safe fallback
let LinearGradient: any;
try { LinearGradient = require("expo-linear-gradient").LinearGradient; } catch { LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>; }

type MotifType = "prof" | "classe";

const TYPE_CONFIG: Record<MotifType, { label: string; icon: string; gradient: string[]; lightBg: string; textColor: string }> = {
  prof: { label: "Professeur", icon: "user-check", gradient: ["#6366F1", "#4338CA"], lightBg: colors.primaryLight, textColor: colors.primary },
  classe: { label: "Classe", icon: "users", gradient: ["#10B981", "#059669"], lightBg: colors.successLight, textColor: colors.success },
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "N/A"; }
};

/** Matches web's MotifsDeRejet.jsx exactly — Admin-only. */
const MotifsDeRejetBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    setLoading(true); setError("");
    try {
      const data = type === "prof" ? await rejectionService.getAll() : await rejectionClassService.getAll();
      setMotifs(Array.isArray(data) ? data : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Échec du chargement des motifs de rejet."); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setCode(""); setDescriptif(""); setCodeError(""); setDescError(""); setEditing(null); setShowForm(false); };
  const openCreate = () => { resetForm(); setShowForm(true); };
  const openEdit = (motif: RejectionMotif) => { setEditing(motif); setCode(motif.code ?? ""); setDescriptif(motif.descriptif ?? ""); setCodeError(""); setDescError(""); setShowForm(true); };

  const validate = () => {
    let ok = true;
    if (!code.trim()) { setCodeError("Le code est requis"); ok = false; }
    else if (!/^[A-Z0-9_]+$/.test(code)) { setCodeError("Majuscules, chiffres et underscores uniquement"); ok = false; }
    else setCodeError("");
    if (!descriptif.trim()) { setDescError("La description est requise"); ok = false; }
    else setDescError("");
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
        setMotifs((prev) => prev.map((m) => (m.id === editing.id ? { ...m, code, descriptif } : m)));
      } else if (type === "prof") {
        const created = await rejectionService.create({ code, descriptif });
        setMotifs((prev) => [...prev, created]);
      } else {
        const created = await rejectionClassService.create({ code, descriptif });
        setMotifs((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'enregistrement."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = (motif: RejectionMotif) => {
    Alert.alert("Supprimer", `Êtes-vous sûr de vouloir supprimer ce motif de rejet de ${type === "prof" ? "professeur" : "classe"} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try {
          if (type === "prof") await rejectionService.remove(motif.id);
          else await rejectionClassService.remove(motif.id);
          setMotifs((prev) => prev.filter((m) => m.id !== motif.id));
        } catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression."); }
      }},
    ]);
  };

  const cfg = TYPE_CONFIG[type];

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient colors={cfg.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Motifs de Rejet</Text>
          <Text style={styles.pageSubtitle}>{type === "prof" ? "Motifs de Rejet de Professeur" : "Motifs de Rejet de Classe"}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{motifs.length} motif{motifs.length !== 1 ? "s" : ""}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addFab}>
          <FontAwesome5 name="plus" size={16} color={colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Type switcher */}
      <View style={styles.typeRow}>
        {(["prof", "classe"] as MotifType[]).map((t) => {
          const tcfg = TYPE_CONFIG[t];
          const isActive = type === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.typeTab, isActive && { borderColor: tcfg.textColor }]}
              onPress={() => { setType(t); resetForm(); }}
            >
              {isActive ? (
                <LinearGradient colors={tcfg.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.typeTabGrad}>
                  <FontAwesome5 name={tcfg.icon as any} size={12} color={colors.white} />
                  <Text style={[styles.typeText, styles.typeTextActive]}>{tcfg.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.typeTabGrad}>
                  <FontAwesome5 name={tcfg.icon as any} size={12} color={tcfg.textColor} />
                  <Text style={[styles.typeText, { color: tcfg.textColor }]}>{tcfg.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : motifs.length === 0 ? (
          <EmptyState icon="ban" title={`Aucun motif de rejet ${type === "prof" ? "de professeur" : "de classe"}`} actionLabel="Ajouter Motif" onAction={openCreate} />
        ) : (
          motifs.map((m) => (
            <View key={m.id} style={styles.card}>
              {/* Colored accent */}
              <LinearGradient colors={cfg.gradient} style={styles.cardAccent} />
              <View style={styles.cardBody}>
                {/* Code chip */}
                <View style={styles.cardTop}>
                  <View style={[styles.codeBadge, { backgroundColor: cfg.lightBg }]}>
                    <Text style={[styles.codeText, { color: cfg.textColor }]}>{m.code}</Text>
                  </View>
                  {m.dateCreation ? (
                    <View style={styles.datePill}>
                      <FontAwesome5 name="calendar-alt" size={9} color={colors.textMuted} />
                      <Text style={styles.datePillText}>{formatDate(m.dateCreation)}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Description */}
                <Text style={styles.cardDesc}>{m.descriptif}</Text>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(m)}>
                    <LinearGradient colors={cfg.gradient} style={styles.editBtnGrad}>
                      <FontAwesome5 name="edit" size={11} color={colors.white} />
                      <Text style={styles.editBtnText}>Modifier</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(m)}>
                    <FontAwesome5 name="trash" size={11} color={colors.danger} />
                    <Text style={styles.deleteBtnText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Form Sheet */}
      <BottomSheet visible={showForm} onClose={resetForm} title={`${editing ? "Modifier" : "Ajouter"} Motif — ${type === "prof" ? "Professeur" : "Classe"}`}>
        <View style={styles.formHeader}>
          <LinearGradient colors={cfg.gradient} style={styles.formIcon}>
            <FontAwesome5 name="ban" size={16} color={colors.white} />
          </LinearGradient>
          <View>
            <Text style={styles.formTitle}>{editing ? "Modifier le motif" : "Nouveau motif"}</Text>
            <Text style={styles.formSubtitle}>{cfg.label}</Text>
          </View>
        </View>

        <Input
          label="Code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder={type === "prof" ? "Ex: PHOTO_FLOU_RECTO" : "Ex: ABSENCE_NON_JUSTIFIEE"}
          autoCapitalize="characters"
          error={codeError}
        />
        {codeError ? <Text style={styles.fieldError}>{codeError}</Text> : null}

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
        {descError ? <Text style={styles.fieldError}>{descError}</Text> : null}

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

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Header
  pageHeader: {
    // Fallback if LinearGradient ever fails — keeps the white header text
    // readable instead of white-on-white (doesn't need to match the active
    // tab's exact gradient, just needs to stay dark).
    backgroundColor: colors.heroStart,
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: spacing.lg,
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl,
    marginBottom: 16, ...shadow.hero,
  },
  headerLeft: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3, marginBottom: 10 },
  countBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  countBadgeText: { fontSize: 11, fontWeight: "700", color: colors.white },
  addFab: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", ...shadow.sm },
  // Type switcher
  typeRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  typeTab: { flex: 1, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1.5, borderColor: colors.border, ...shadow.sm },
  typeTabGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, backgroundColor: colors.surface },
  typeText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  typeTextActive: { color: colors.white },
  // List
  list: { flex: 1, paddingHorizontal: 16 },
  errorBox: { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  // Motif card
  card: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: 10, overflow: "hidden", ...shadow.card },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  codeBadge: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5 },
  codeText: { fontFamily: "monospace", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  datePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceDim, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  datePillText: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  cardDesc: { ...typography.body, color: colors.text, lineHeight: 20, marginBottom: 12 },
  cardActions: { flexDirection: "row", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  editBtn: { flex: 1, borderRadius: radius.lg, overflow: "hidden" },
  editBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  editBtnText: { fontSize: 12, fontWeight: "700", color: colors.white },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.danger}30`, backgroundColor: `${colors.danger}10` },
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  // Form
  formHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md },
  formIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  formTitle: { ...typography.h3, color: colors.text },
  formSubtitle: { ...typography.caption, color: colors.textMuted },
  fieldError: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm },
});

export default MotifsDeRejetBody;
