import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, Card, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import { colors, radius, spacing, typography } from "../../../styles/theme";
import { gestionnaireService } from "../../../services/api";
import { Gestionnaire } from "../../../types";

interface GestionnairesBodyProps {
  autoCreate?: boolean;
}

export const GestionnairesBody = ({ autoCreate = false }: GestionnairesBodyProps) => {
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(autoCreate);
  const [selectedGestionnaire, setSelectedGestionnaire] = useState<Gestionnaire | null>(null);

  const loadGestionnaires = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await gestionnaireService.getAll();
      setGestionnaires(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement des gestionnaires.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGestionnaires();
  }, [loadGestionnaires]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGestionnaires();
    setRefreshing(false);
  };

  const handleDelete = (g: Gestionnaire) => {
    Alert.alert(
      "Supprimer le gestionnaire",
      `Voulez-vous vraiment supprimer "${g.prenom} ${g.nom}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await gestionnaireService.remove(g.id);
              setGestionnaires((prev) => prev.filter((x) => x.id !== g.id));
            } catch (err) {
              Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
            }
          },
        },
      ]
    );
  };

  const filtered = gestionnaires.filter((g) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (g.nom ?? "").toLowerCase().includes(term) ||
      (g.prenom ?? "").toLowerCase().includes(term) ||
      (g.email ?? "").toLowerCase().includes(term) ||
      (g.telephone ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestionnaires</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.7}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Input
          placeholder="Rechercher par nom, email..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading && !refreshing ? (
          <LoadingSpinner label="Chargement des gestionnaires..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="building"
            title={searchTerm ? "Aucun résultat" : "Aucun gestionnaire"}
            message={searchTerm ? "Aucun gestionnaire ne correspond à votre recherche." : "Ajoutez un premier gestionnaire d'établissement."}
          />
        ) : (
          filtered.map((g) => (
            <Card key={g.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(g.prenom || g.nom || "G").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.nameText}>{g.prenom} {g.nom}</Text>
                  <Text style={styles.emailText}>{g.email}</Text>
                </View>
                <Badge label="Gestionnaire" tone="success" />
              </View>

              {g.telephone ? (
                <View style={styles.metaRow}>
                  <FontAwesome5 name="phone" size={11} color={colors.textMuted} />
                  <Text style={styles.metaText}>{g.telephone}</Text>
                </View>
              ) : null}

              {g.adresse ? (
                <View style={styles.metaRow}>
                  <FontAwesome5 name="map-marker-alt" size={11} color={colors.textMuted} />
                  <Text style={styles.metaText}>{g.adresse}</Text>
                </View>
              ) : null}

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setSelectedGestionnaire(g)}>
                  <FontAwesome5 name="eye" size={12} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Détails</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(g)}>
                  <FontAwesome5 name="trash" size={12} color={colors.danger} />
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Modal */}
      <CreateGestionnaireSheet
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadGestionnaires}
      />

      {/* Details Modal */}
      {selectedGestionnaire && (
        <BottomSheet
          visible={!!selectedGestionnaire}
          onClose={() => setSelectedGestionnaire(null)}
          title="Fiche Gestionnaire"
        >
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsAvatarWrap}>
              <View style={styles.detailsAvatar}>
                <Text style={styles.detailsAvatarText}>
                  {(selectedGestionnaire.prenom || selectedGestionnaire.nom || "G").charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.detailsName}>{selectedGestionnaire.prenom} {selectedGestionnaire.nom}</Text>
              <Badge label="Gestionnaire d'établissement" tone="success" />
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Email</Text>
              <Text style={styles.detailsValue}>{selectedGestionnaire.email || "—"}</Text>
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Téléphone</Text>
              <Text style={styles.detailsValue}>{selectedGestionnaire.telephone || "—"}</Text>
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Adresse</Text>
              <Text style={styles.detailsValue}>{selectedGestionnaire.adresse || "—"}</Text>
            </View>
          </View>
        </BottomSheet>
      )}
    </View>
  );
};

interface CreateGestionnaireSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateGestionnaireSheet = ({ visible, onClose, onCreated }: CreateGestionnaireSheetProps) => {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setNom("");
    setPrenom("");
    setEmail("");
    setTelephone("");
    setAdresse("");
    setPassword("");
    setError("");
  };

  const handleCreate = async () => {
    if (!nom.trim() || !prenom.trim() || !email.trim() || !password) {
      setError("Nom, prénom, email et mot de passe sont obligatoires.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await gestionnaireService.create({
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim(),
        telephone: telephone.trim() ? (telephone.startsWith("+") ? telephone.trim() : `+237${telephone.trim()}`) : null,
        adresse: adresse.trim() || null,
        motDePasse: password,
        etat: "ACTIVE",
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nouveau Gestionnaire">
      <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.sheetError}>{error}</Text> : null}

        <Input label="Nom *" placeholder="Ex: Dupont" value={nom} onChangeText={setNom} />
        <Input label="Prénom *" placeholder="Ex: Jean" value={prenom} onChangeText={setPrenom} />
        <Input
          label="Email *"
          placeholder="gestionnaire@ecole.cm"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Téléphone"
          placeholder="Ex: 6XXXXXXXX"
          value={telephone}
          onChangeText={setTelephone}
          keyboardType="phone-pad"
        />
        <Input label="Adresse" placeholder="Ex: Douala, Cameroun" value={adresse} onChangeText={setAdresse} />
        <Input
          label="Mot de passe temporaire *"
          placeholder="Mot de passe d'accès"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          label="Créer le gestionnaire"
          onPress={handleCreate}
          loading={loading}
          fullWidth
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: 20,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h1, color: colors.text },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  list: { flex: 1, paddingHorizontal: spacing.lg },
  errorText: { color: colors.danger, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  card: { padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0D9488",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  cardInfo: { flex: 1, marginRight: spacing.xs },
  nameText: { ...typography.bodyBold, color: colors.text },
  emailText: { ...typography.caption, color: colors.textMuted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.text },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  actionBtnText: { ...typography.caption, fontWeight: "700" },
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.xl },
  sheetError: { color: colors.danger, marginBottom: spacing.xs },
  detailsModalContent: { gap: spacing.md, paddingBottom: spacing.lg },
  detailsAvatarWrap: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  detailsAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#0D9488",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsAvatarText: { color: colors.white, fontSize: 22, fontWeight: "700" },
  detailsName: { ...typography.h2, color: colors.text },
  detailsSection: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs },
  detailsLabel: { ...typography.caption, color: colors.textMuted },
  detailsValue: { ...typography.bodyBold, color: colors.text, marginTop: 2 },
});

export default GestionnairesBody;
