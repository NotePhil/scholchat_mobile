import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../../styles/theme";
import { gestionnaireService } from "../../../services/api";
import { Gestionnaire } from "../../../types";

// LinearGradient with safe fallback
let LinearGradient: any;
try { LinearGradient = require("expo-linear-gradient").LinearGradient; } catch { LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>; }

const TEAL_GRADIENT = ["#0D9488", "#0F766E"];

interface GestionnairesBodyProps {
  autoCreate?: boolean;
}

export const GestionnairesBody = ({ autoCreate = false }: GestionnairesBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(autoCreate);
  const [selectedGestionnaire, setSelectedGestionnaire] = useState<Gestionnaire | null>(null);

  const loadGestionnaires = useCallback(async () => {
    setLoading(true); setError("");
    try { setGestionnaires(await gestionnaireService.getAll()); }
    catch (err) { setError(err instanceof Error ? err.message : "Erreur lors du chargement des gestionnaires."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGestionnaires(); }, [loadGestionnaires]);

  const handleRefresh = async () => { setRefreshing(true); await loadGestionnaires(); setRefreshing(false); };

  const handleDelete = (g: Gestionnaire) => {
    Alert.alert("Supprimer le gestionnaire", `Voulez-vous vraiment supprimer "${g.prenom} ${g.nom}" ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try { await gestionnaireService.remove(g.id); setGestionnaires((prev) => prev.filter((x) => x.id !== g.id)); }
        catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression."); }
      }},
    ]);
  };

  const filtered = gestionnaires.filter((g) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (g.nom ?? "").toLowerCase().includes(term) || (g.prenom ?? "").toLowerCase().includes(term) ||
      (g.email ?? "").toLowerCase().includes(term) || (g.telephone ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient colors={TEAL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Gestionnaires</Text>
          <View style={styles.headerMeta}>
            <View style={styles.countBadge}>
              <FontAwesome5 name="building" size={10} color="rgba(255,255,255,0.8)" />
              <Text style={styles.countBadgeText}>{filtered.length} gestionnaire{filtered.length !== 1 ? "s" : ""}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.addFab} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
          <FontAwesome5 name="plus" size={16} color={colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <FontAwesome5 name="search" size={13} color={colors.textMuted} />
          <Input placeholder="Rechercher par nom, email..." value={searchTerm} onChangeText={setSearchTerm} style={styles.searchInput} />
        </View>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.teal]} tintColor={colors.teal} />}
      >
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        {loading && !refreshing ? (
          <LoadingSpinner label="Chargement des gestionnaires..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="building"
            title={searchTerm ? "Aucun résultat" : "Aucun gestionnaire"}
            message={searchTerm ? "Aucun gestionnaire ne correspond à votre recherche." : "Ajoutez un premier gestionnaire d'établissement."}
          />
        ) : (
          filtered.map((g) => {
            const initial = (g.prenom || g.nom || "G").charAt(0).toUpperCase();
            return (
              <View key={g.id} style={styles.card}>
                {/* Teal top accent */}
                <LinearGradient colors={TEAL_GRADIENT} style={styles.cardTopAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

                <View style={styles.cardBody}>
                  {/* Header */}
                  <View style={styles.cardHeader}>
                    <LinearGradient colors={TEAL_GRADIENT} style={styles.avatar}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </LinearGradient>
                    <View style={styles.cardInfo}>
                      <Text style={styles.nameText}>{g.prenom} {g.nom}</Text>
                      <Text style={styles.emailText} numberOfLines={1}>{g.email}</Text>
                    </View>
                    <View style={styles.roleBadge}>
                      <FontAwesome5 name="building" size={9} color={colors.teal} />
                      <Text style={styles.roleBadgeText}>Gestionnaire</Text>
                    </View>
                  </View>

                  {/* Contact pills */}
                  {(g.telephone || g.adresse) ? (
                    <View style={styles.contactRow}>
                      {g.telephone ? (
                        <View style={styles.contactPill}>
                          <FontAwesome5 name="phone" size={9} color={colors.teal} />
                          <Text style={styles.contactPillText}>{g.telephone}</Text>
                        </View>
                      ) : null}
                      {g.adresse ? (
                        <View style={styles.contactPill}>
                          <FontAwesome5 name="map-marker-alt" size={9} color={colors.teal} />
                          <Text style={styles.contactPillText} numberOfLines={1}>{g.adresse}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.detailBtn} onPress={() => setSelectedGestionnaire(g)} activeOpacity={0.8}>
                      <LinearGradient colors={TEAL_GRADIENT} style={styles.detailBtnGrad}>
                        <FontAwesome5 name="eye" size={11} color={colors.white} />
                        <Text style={styles.detailBtnText}>Détails</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(g)} activeOpacity={0.8}>
                      <FontAwesome5 name="trash" size={11} color={colors.danger} />
                      <Text style={styles.deleteBtnText}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Create Sheet */}
      <CreateGestionnaireSheet visible={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={loadGestionnaires} />

      {/* Details Sheet */}
      {selectedGestionnaire && (
        <BottomSheet visible={!!selectedGestionnaire} onClose={() => setSelectedGestionnaire(null)} title="Fiche Gestionnaire">
          <View style={styles.detailsContent}>
            {/* Avatar */}
            <View style={styles.detailsAvatarWrap}>
              <LinearGradient colors={TEAL_GRADIENT} style={styles.detailsAvatar}>
                <Text style={styles.detailsAvatarText}>{(selectedGestionnaire.prenom || selectedGestionnaire.nom || "G").charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <Text style={styles.detailsName}>{selectedGestionnaire.prenom} {selectedGestionnaire.nom}</Text>
              <View style={styles.roleBadge}>
                <FontAwesome5 name="building" size={10} color={colors.teal} />
                <Text style={styles.roleBadgeText}>Gestionnaire d'établissement</Text>
              </View>
            </View>

            {/* Info rows */}
            <DetailRow icon="envelope" label="Email" value={selectedGestionnaire.email} />
            <DetailRow icon="phone" label="Téléphone" value={selectedGestionnaire.telephone} />
            <DetailRow icon="map-marker-alt" label="Adresse" value={selectedGestionnaire.adresse} />
          </View>
        </BottomSheet>
      )}
    </View>
  );
};

const DetailRow = ({ icon, label, value }: { icon: any; label: string; value?: string | null }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.detailRow}>
    <View style={styles.detailIconBox}>
      <FontAwesome5 name={icon} size={12} color={colors.teal} />
    </View>
    <View style={styles.detailTexts}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  </View>
  );
};

// ── CreateGestionnaireSheet ──────────────────────────────────────────────────
interface CreateGestionnaireSheetProps { visible: boolean; onClose: () => void; onCreated: () => void; }

const CreateGestionnaireSheet = ({ visible, onClose, onCreated }: CreateGestionnaireSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [nom, setNom] = useState(""); const [prenom, setPrenom] = useState(""); const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState(""); const [adresse, setAdresse] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  const reset = () => { setNom(""); setPrenom(""); setEmail(""); setTelephone(""); setAdresse(""); setPassword(""); setError(""); };

  const handleCreate = async () => {
    if (!nom.trim() || !prenom.trim() || !email.trim() || !password) { setError("Nom, prénom, email et mot de passe sont obligatoires."); return; }
    setLoading(true); setError("");
    try {
      await gestionnaireService.create({
        nom: nom.trim(), prenom: prenom.trim(), email: email.trim(),
        telephone: telephone.trim() ? (telephone.startsWith("+") ? telephone.trim() : `+237${telephone.trim()}`) : null,
        adresse: adresse.trim() || null, motDePasse: password, etat: "ACTIVE",
      });
      reset(); onCreated(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Échec de la création."); }
    finally { setLoading(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nouveau Gestionnaire">
      <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
        {error ? <View style={styles.sheetErrorBox}><FontAwesome5 name="exclamation-circle" size={13} color={colors.danger} /><Text style={styles.sheetError}>{error}</Text></View> : null}
        <Input label="Nom *" placeholder="Ex: Dupont" value={nom} onChangeText={setNom} />
        <Input label="Prénom *" placeholder="Ex: Jean" value={prenom} onChangeText={setPrenom} />
        <Input label="Email *" placeholder="gestionnaire@ecole.cm" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Téléphone" placeholder="Ex: 6XXXXXXXX" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
        <Input label="Adresse" placeholder="Ex: Douala, Cameroun" value={adresse} onChangeText={setAdresse} />
        <Input label="Mot de passe temporaire *" placeholder="Mot de passe d'accès" value={password} onChangeText={setPassword} secureTextEntry />
        <Button label="Créer le gestionnaire" onPress={handleCreate} loading={loading} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      </ScrollView>
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Header
  pageHeader: {
    // Fallback if LinearGradient ever fails — keeps the white header text
    // readable instead of white-on-white.
    backgroundColor: TEAL_GRADIENT[0],
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: spacing.lg,
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl,
    marginBottom: 16, ...shadow.hero,
  },
  headerLeft: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  headerMeta: { flexDirection: "row", marginTop: 8 },
  countBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  countBadgeText: { fontSize: 11, fontWeight: "700", color: colors.white },
  addFab: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", ...shadow.sm },
  // Search
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingLeft: 12, ...shadow.sm },
  searchInput: { flex: 1, borderWidth: 0, shadowOpacity: 0, backgroundColor: "transparent" },
  list: { flex: 1, paddingHorizontal: 16 },
  errorBox: { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  // Card
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: 12, overflow: "hidden", ...shadow.card },
  cardTopAccent: { height: 4 },
  cardBody: { padding: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: "800" },
  cardInfo: { flex: 1 },
  nameText: { ...typography.h4, color: colors.text },
  emailText: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.tealLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  roleBadgeText: { fontSize: 10, fontWeight: "700", color: colors.teal },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  contactPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.tealLight, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  contactPillText: { fontSize: 11, fontWeight: "600", color: colors.teal, maxWidth: 160 },
  cardActions: { flexDirection: "row", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  detailBtn: { flex: 1, borderRadius: radius.lg, overflow: "hidden" },
  detailBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 },
  detailBtnText: { fontSize: 12, fontWeight: "700", color: colors.white },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.danger}30`, backgroundColor: `${colors.danger}10` },
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  // Details sheet
  detailsContent: { paddingBottom: spacing.lg },
  detailsAvatarWrap: { alignItems: "center", gap: 10, marginBottom: 20 },
  detailsAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", ...shadow.hero },
  detailsAvatarText: { color: colors.white, fontSize: 28, fontWeight: "800" },
  detailsName: { ...typography.h2, color: colors.text },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" },
  detailTexts: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { ...typography.bodyBold, color: colors.text, marginTop: 1 },
  // Sheet
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.xl },
  sheetErrorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  sheetError: { color: colors.danger, fontSize: 13, flex: 1 },
});

export default GestionnairesBody;
