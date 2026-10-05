import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { matiereService } from "../../../services/api";
import { useAuthStore } from "../../../store/useAuthStore";
import { useThemeStore } from "../../../store/useThemeStore";
import { Matiere } from "../../../types";
import { formatDate as formatServerDate } from "../../../utils/dates";

// LinearGradient with safe fallback
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

// Web's default colour scheme gradient (from-blue-500 to-blue-600)
const GRADIENT = ["#3B82F6", "#2563EB"];
const ITEMS_PER_PAGE = 10;

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return formatServerDate(dateString, { year: "numeric", month: "short", day: "numeric" }, "Date invalide");
  } catch {
    return "Date invalide";
  }
};

// Web's Tailwind gray palette, light vs dark
const makePalette = (isDark: boolean) => ({
  isDark,
  page: isDark ? "#111827" : "#F9FAFB", // gray-900 / gray-50
  card: isDark ? "#1F2937" : "#FFFFFF", // gray-800 / white
  border: isDark ? "#374151" : "#E5E7EB", // gray-700 / gray-200
  divider: isDark ? "#374151" : "#F3F4F6", // gray-100
  text: isDark ? "#FFFFFF" : "#111827", // white / gray-900
  sub: isDark ? "#D1D5DB" : "#4B5563", // gray-300 / gray-600
  input: isDark ? "#374151" : "#F9FAFB", // gray-700 / gray-50
  action: "#94A3B8", // slate-400
});
type Palette = ReturnType<typeof makePalette>;

type Message = { text: string; type: "" | "success" | "error" };

/**
 * Port of web's MatiereContent.jsx (mobile card view): header card, search +
 * refresh card, one list card with pagination, and centred create / edit /
 * delete dialogs. Admin + Gestionnaire can manage, Professor can only view,
 * everyone else has no access.
 */
const MatieresBody = () => {
  const isDark = useThemeStore((s) => s.mode === "dark");
  const p = useMemo(() => makePalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(p), [p]);
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin" || role === "gestionnaire";
  const canView = canManage || role === "professor" || role === "tutor";

  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<Message>({ text: "", type: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [modal, setModal] = useState<"" | "create" | "edit" | "delete">("");
  const [selected, setSelected] = useState<Matiere | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await matiereService.getAll();
      setMatieres(Array.isArray(data) ? data : []);
      setMessage({ text: "", type: "" });
    } catch {
      setMessage({ text: "Erreur lors du chargement des matières", type: "error" });
      setMatieres([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const closeModals = () => {
    setModal("");
    setSelected(null);
    setNom("");
    setDescription("");
  };

  const openCreate = () => {
    closeModals();
    setModal("create");
  };

  const openEdit = (m: Matiere) => {
    setSelected(m);
    setNom(m.nom ?? "");
    setDescription(m.description ?? "");
    setModal("edit");
  };

  const openDelete = (m: Matiere) => {
    setSelected(m);
    setModal("delete");
  };

  const handleSave = async () => {
    if (!nom.trim()) {
      setMessage({ text: "Le nom de la matière est requis", type: "error" });
      return;
    }
    const isEdit = modal === "edit";
    setSaving(true);
    try {
      if (isEdit && selected) {
        await matiereService.update(selected.id, nom.trim(), description.trim() || undefined);
      } else {
        await matiereService.create(nom.trim(), description.trim() || undefined);
      }
      setMessage({ text: isEdit ? "Matière modifiée avec succès" : "Matière créée avec succès", type: "success" });
      closeModals();
      await load();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : isEdit ? "Erreur lors de la modification" : "Erreur lors de la création",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await matiereService.remove(selected.id);
      setMessage({ text: "Matière supprimée avec succès", type: "success" });
      closeModals();
      await load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Erreur lors de la suppression", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <View style={[styles.container, styles.centerFill]}>
        <View style={styles.restrictedCard}>
          <FontAwesome5 name="exclamation-circle" size={48} color="#EF4444" />
          <Text style={styles.restrictedTitle}>Accès Restreint</Text>
          <Text style={styles.restrictedText}>
            Vous n'avez pas les permissions nécessaires pour accéder à cette section.
          </Text>
        </View>
      </View>
    );
  }

  const q = searchTerm.toLowerCase();
  const filtered = matieres.filter(
    (m) => (m.nom ?? "").toLowerCase().includes(q) || (m.description ?? "").toLowerCase().includes(q)
  );
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const current = filtered.slice(startIndex, endIndex);
  const showPagination = filtered.length > ITEMS_PER_PAGE;

  // Same page-number list as web: first, last, current ±1, with "…" gaps
  const pageItems = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((pg) => pg === 1 || pg === totalPages || Math.abs(pg - currentPage) <= 1)
    .reduce<(number | "…")[]>((acc, pg, idx, arr) => {
      if (idx > 0 && pg - arr[idx - 1] > 1) acc.push("…");
      acc.push(pg);
      return acc;
    }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={[styles.card, styles.header]}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
              <FontAwesome5 name="book-open" size={18} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title}>Gestion des Matières</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                Gérez les matières scolaires de votre établissement
              </Text>
            </View>
          </View>
          {canManage && (
            <TouchableOpacity onPress={openCreate} activeOpacity={0.85}>
              <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.newBtn}>
                <FontAwesome5 name="plus" size={13} color="#FFFFFF" />
                <Text style={styles.newBtnText}>Nouveau</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Message ────────────────────────────────────────────── */}
        {message.text ? (
          <View style={[styles.message, message.type === "success" ? styles.messageSuccess : styles.messageError]}>
            <FontAwesome5
              name={message.type === "success" ? "check-circle" : "exclamation-circle"}
              size={14}
              color={message.type === "success" ? "#15803D" : "#B91C1C"}
            />
            <Text style={[styles.messageText, { color: message.type === "success" ? "#15803D" : "#B91C1C" }]}>
              {message.text}
            </Text>
            <TouchableOpacity onPress={() => setMessage({ text: "", type: "" })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={13} color={message.type === "success" ? "#15803D" : "#B91C1C"} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Search + Refresh ───────────────────────────────────── */}
        <View style={[styles.card, styles.searchCard]}>
          <View style={styles.searchBox}>
            <FontAwesome5 name="search" size={13} color={p.sub} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une matière..."
              placeholderTextColor="#9CA3AF"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={load} disabled={loading} accessibilityLabel="Actualiser">
            <FontAwesome5 name="sync-alt" size={14} color={p.text} />
          </TouchableOpacity>
        </View>

        {/* ── Content ────────────────────────────────────────────── */}
        <View style={[styles.card, styles.listCard]}>
          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.stateDesc}>Chargement...</Text>
            </View>
          ) : current.length === 0 ? (
            <View style={styles.stateBox}>
              <FontAwesome5 name="book-open" size={40} color={p.sub} />
              <Text style={styles.stateTitle}>{searchTerm ? "Aucune matière trouvée" : "Aucune matière"}</Text>
              <Text style={styles.stateDesc}>
                {searchTerm ? "Essayez de modifier vos critères de recherche" : "Commencez par créer votre première matière"}
              </Text>
            </View>
          ) : (
            current.map((m, i) => {
              const actif = (m.etat ?? "ACTIF") === "ACTIF";
              return (
                <View key={m.id ?? i} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{m.nom}</Text>
                      {m.description ? (
                        <Text style={styles.rowDesc} numberOfLines={2}>{m.description}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: actif ? "#DCFCE7" : "#FEE2E2" }]}>
                      <Text style={[styles.statusText, { color: actif ? "#15803D" : "#B91C1C" }]}>{m.etat || "ACTIF"}</Text>
                    </View>
                  </View>
                  <View style={styles.rowBottom}>
                    <View style={styles.dateRow}>
                      <FontAwesome5 name="calendar-alt" size={10} color={p.sub} />
                      <Text style={styles.dateText}>{formatDate(m.dateCreation)}</Text>
                    </View>
                    {canManage && (
                      <View style={styles.rowActions}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(m)} accessibilityLabel="Modifier">
                          <FontAwesome5 name="pencil-alt" size={14} color={p.action} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openDelete(m)} accessibilityLabel="Supprimer">
                          <FontAwesome5 name="trash-alt" size={14} color={p.action} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* Pagination */}
          {showPagination && !loading && current.length > 0 && (
            <View style={styles.pagination}>
              <Text style={styles.pageInfo}>
                {startIndex + 1}–{Math.min(endIndex, filtered.length)} / {filtered.length}
              </Text>
              <View style={styles.pageBtns}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage((c) => c - 1)}
                >
                  <FontAwesome5 name="chevron-left" size={11} color={p.text} />
                </TouchableOpacity>
                {pageItems.map((pg, idx) =>
                  pg === "…" ? (
                    <Text key={`e-${idx}`} style={styles.pageEllipsis}>…</Text>
                  ) : currentPage === pg ? (
                    <LinearGradient key={pg} colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pageNum}>
                      <Text style={[styles.pageNumText, { color: "#FFFFFF" }]}>{pg}</Text>
                    </LinearGradient>
                  ) : (
                    <TouchableOpacity key={pg} style={[styles.pageNum, styles.pageNumIdle]} onPress={() => setCurrentPage(pg)}>
                      <Text style={styles.pageNumText}>{pg}</Text>
                    </TouchableOpacity>
                  )
                )}
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage((c) => c + 1)}
                >
                  <FontAwesome5 name="chevron-right" size={11} color={p.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Create / Edit dialog ─────────────────────────────────── */}
      <Modal visible={modal === "create" || modal === "edit"} transparent animationType="fade" onRequestClose={closeModals}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{modal === "edit" ? "Modifier la Matière" : "Nouvelle Matière"}</Text>
              <TouchableOpacity onPress={closeModals} style={styles.dialogClose} accessibilityLabel="Fermer">
                <FontAwesome5 name="times" size={16} color={p.sub} />
              </TouchableOpacity>
            </View>
            <View style={styles.dialogBody}>
              <Text style={styles.label}>Nom de la matière *</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                placeholder="Ex: Mathématiques"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={[styles.label, { marginTop: 16 }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Description de la matière..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || !nom.trim()}
                style={(saving || !nom.trim()) && { opacity: 0.5 }}
                activeOpacity={0.85}
              >
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="save" size={13} color="#FFFFFF" />}
                  <Text style={styles.primaryText}>
                    {modal === "edit" ? (saving ? "Modification..." : "Modifier") : saving ? "Création..." : "Créer"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete dialog ────────────────────────────────────────── */}
      <Modal visible={modal === "delete"} transparent animationType="fade" onRequestClose={closeModals}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Confirmer la suppression</Text>
            </View>
            <View style={styles.dialogBody}>
              <Text style={styles.confirmText}>
                Êtes-vous sûr de vouloir supprimer la matière <Text style={{ fontWeight: "800" }}>{selected?.nom}</Text> ?
              </Text>
              <Text style={styles.confirmWarn}>Cette action est irréversible.</Text>
            </View>
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} disabled={saving} style={saving && { opacity: 0.5 }} activeOpacity={0.85}>
                <LinearGradient colors={["#EF4444", "#DC2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="trash-alt" size={13} color="#FFFFFF" />}
                  <Text style={styles.primaryText}>{saving ? "Suppression..." : "Supprimer"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: p.page },
    centerFill: { alignItems: "center", justifyContent: "center", padding: 24 },
    scrollContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 140, gap: 16 },

    card: {
      backgroundColor: p.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.border,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },

    // Header
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16 },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    title: { fontSize: 18, fontWeight: "800", color: p.text, lineHeight: 22 },
    subtitle: { fontSize: 12, color: p.sub },
    newBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    newBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

    // Message
    message: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    messageSuccess: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
    messageError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
    messageText: { flex: 1, fontSize: 13 },

    // Search
    searchCard: { flexDirection: "row", gap: 8, padding: 12 },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: p.input,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 40,
    },
    searchInput: { flex: 1, fontSize: 14, color: p.text, paddingVertical: 0 },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: "center",
      justifyContent: "center",
    },

    // List
    listCard: { overflow: "hidden" },
    stateBox: { padding: 40, alignItems: "center", gap: 8 },
    stateTitle: { fontSize: 16, fontWeight: "700", color: p.text, marginTop: 4 },
    stateDesc: { fontSize: 13, color: p.sub, textAlign: "center" },
    row: { padding: 16 },
    rowBorder: { borderTopWidth: 1, borderTopColor: p.divider },
    rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
    rowName: { fontSize: 14, fontWeight: "700", color: p.text },
    rowDesc: { fontSize: 12, color: p.sub, marginTop: 2 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    statusText: { fontSize: 11, fontWeight: "600" },
    rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    dateText: { fontSize: 12, color: p.sub },
    rowActions: { flexDirection: "row", gap: 4 },
    iconBtn: { padding: 6, borderRadius: 8 },

    // Pagination
    pagination: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    pageInfo: { fontSize: 12, color: p.sub },
    pageBtns: { flexDirection: "row", alignItems: "center", gap: 4 },
    pageBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: p.border, alignItems: "center", justifyContent: "center" },
    pageBtnDisabled: { opacity: 0.4 },
    pageNum: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    pageNumIdle: { borderWidth: 1, borderColor: p.border },
    pageNumText: { fontSize: 12, fontWeight: "600", color: p.text },
    pageEllipsis: { paddingHorizontal: 2, fontSize: 12, color: p.sub },

    // Dialogs
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
    dialog: { backgroundColor: p.card, borderRadius: 16, overflow: "hidden", maxHeight: "90%" },
    dialogHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    dialogTitle: { fontSize: 18, fontWeight: "800", color: p.text },
    dialogClose: { padding: 6, borderRadius: 8 },
    dialogBody: { padding: 20 },
    dialogFooter: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    label: { fontSize: 14, fontWeight: "700", color: p.text, marginBottom: 8 },
    input: {
      backgroundColor: p.input,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: p.text,
    },
    textarea: { height: 90, textAlignVertical: "top" },
    cancelBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: p.border, justifyContent: "center" },
    cancelText: { fontSize: 14, color: p.text },
    primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
    primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
    confirmText: { fontSize: 14, color: p.text, lineHeight: 20 },
    confirmWarn: { fontSize: 13, color: p.sub, marginTop: 8 },

    // Restricted
    restrictedCard: {
      backgroundColor: p.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.border,
      padding: 28,
      alignItems: "center",
      gap: 8,
      maxWidth: 420,
    },
    restrictedTitle: { fontSize: 22, fontWeight: "800", color: p.text, marginTop: 8 },
    restrictedText: { fontSize: 14, color: p.sub, textAlign: "center" },
  });

export default MatieresBody;
