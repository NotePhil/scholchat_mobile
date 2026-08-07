import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { contratService, establishmentService, offerService } from "../../services/api";
import { PaymentInfo } from "../../services/api/contratService";
import PaymentModal from "../../components/common/PaymentModal";
import { Contrat, Etablissement, Offre } from "../../types";
import { useUser } from "../../context/UserContext";

const EstablishmentListBody = () => {
  const { user } = useUser();
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEst, setSelectedEst] = useState<Etablissement | null>(null);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await establishmentService.getByGestionnaire(user.userId);
      setEstablishments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des établissements.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (est: Etablissement) => {
    Alert.alert("Supprimer", `Voulez-vous vraiment supprimer "${est.nom}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await establishmentService.remove(est.id);
            setEstablishments((prev) => prev.filter((e) => e.id !== est.id));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes établissements</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : establishments.length === 0 ? (
          <EmptyState
            icon="school"
            title="Aucun établissement"
            actionLabel="Créer un établissement"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          establishments.map((est) => (
            <View key={est.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{est.nom}</Text>
                <TouchableOpacity onPress={() => handleDelete(est)}>
                  <FontAwesome5 name="trash" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
              {est.localisation ? <Text style={styles.cardMeta}>{est.localisation}</Text> : null}
              <Button
                label="Gérer l'abonnement"
                variant="secondary"
                onPress={() => setSelectedEst(est)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <CreateSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} gestionnaireId={user?.userId} />

      {selectedEst && <ContractSheet establishment={selectedEst} onClose={() => setSelectedEst(null)} />}
    </View>
  );
};

interface ContractSheetProps {
  establishment: Etablissement;
  onClose: () => void;
}

/** Offer/contract management for one establishment — prolonger current offer or change it, with real (simulated) payment. */
const ContractSheet = ({ establishment, onClose }: ContractSheetProps) => {
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"prolonger" | "changer">("prolonger");
  const [nouvelleOffreId, setNouvelleOffreId] = useState("");
  const [periodicite, setPeriodicite] = useState<"MENSUEL" | "ANNUEL">("MENSUEL");
  const [showPayment, setShowPayment] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [contratData, offresData] = await Promise.all([
          contratService.getForEstablishment(establishment.id).catch(() => null),
          offerService.list("ETABLISSEMENT"),
        ]);
        setContrat(contratData);
        setOffres(offresData);
        if (contratData?.periodicite) setPeriodicite(contratData.periodicite as "MENSUEL" | "ANNUEL");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Échec du chargement du contrat.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [establishment.id]);

  const offreCible = offres.find((o) => o.id === nouvelleOffreId) || null;
  const montant =
    action === "changer" && offreCible
      ? Number(periodicite === "ANNUEL" ? offreCible.prixAnnuel : offreCible.prixMensuel) || 0
      : contrat
      ? Number(periodicite === "ANNUEL" ? contrat.prixAnnuel : contrat.prixMensuel) || 0
      : 0;

  const handlePaymentSuccess = async (paymentInfo: PaymentInfo) => {
    try {
      if (action === "changer") {
        await contratService.changeEstablishmentOffer(establishment.id, nouvelleOffreId, { periodicite, paymentInfo });
      } else {
        await contratService.extendEstablishmentContract(establishment.id, { periodicite, paymentInfo });
      }
      setShowPayment(false);
      setSuccess(true);
    } catch (err) {
      setShowPayment(false);
      setError(err instanceof Error ? err.message : "Échec du renouvellement.");
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title={`Abonnement — ${establishment.nom}`}>
      {loading ? (
        <LoadingSpinner label="Chargement..." />
      ) : success ? (
        <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <FontAwesome5 name="check-circle" size={36} color={colors.success} />
          <Text style={{ ...typography.bodyBold, color: colors.text, marginTop: spacing.sm }}>Abonnement mis à jour !</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {contrat && (
            <View style={styles.contractBox}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardMeta}>Forfait actuel</Text>
                <Badge label={contrat.statut ?? "—"} tone={contrat.statut === "ACTIF" ? "success" : "danger"} />
              </View>
              <Text style={styles.cardTitle}>{contrat.offreNom ?? "—"}</Text>
              {contrat.dateFin ? (
                <Text style={styles.cardMeta}>Expire le {new Date(contrat.dateFin).toLocaleDateString("fr-FR")}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.toggleRow}>
            <Button
              label="Prolonger"
              variant={action === "prolonger" ? "primary" : "secondary"}
              onPress={() => {
                setAction("prolonger");
                setNouvelleOffreId("");
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Changer d'offre"
              variant={action === "changer" ? "primary" : "secondary"}
              onPress={() => {
                setAction("changer");
                setNouvelleOffreId("");
              }}
              style={{ flex: 1 }}
            />
          </View>

          {action === "changer" &&
            offres.map((offre) => (
              <Button
                key={offre.id}
                label={`${offre.nom}${offre.prixMensuel ? ` — ${Number(offre.prixMensuel).toLocaleString("fr-FR")} FCFA/mois` : ""}`}
                variant={nouvelleOffreId === offre.id ? "primary" : "secondary"}
                onPress={() => setNouvelleOffreId(offre.id)}
                fullWidth
                style={{ marginBottom: spacing.sm }}
              />
            ))}

          <View style={styles.toggleRow}>
            <Button label="Mensuel" variant={periodicite === "MENSUEL" ? "primary" : "secondary"} onPress={() => setPeriodicite("MENSUEL")} style={{ flex: 1 }} />
            <Button label="Annuel" variant={periodicite === "ANNUEL" ? "primary" : "secondary"} onPress={() => setPeriodicite("ANNUEL")} style={{ flex: 1 }} />
          </View>

          {montant > 0 ? (
            <Text style={[styles.cardMeta, { textAlign: "center", marginBottom: spacing.md }]}>
              Montant : <Text style={styles.cardTitle}>{montant.toLocaleString("fr-FR")} FCFA</Text>
            </Text>
          ) : null}

          <Button
            label="Procéder au paiement"
            onPress={() => {
              if (action === "changer" && !nouvelleOffreId) {
                setError("Veuillez sélectionner une offre.");
                return;
              }
              setError("");
              setShowPayment(true);
            }}
            disabled={montant <= 0}
            fullWidth
            style={{ marginBottom: spacing.lg }}
          />
        </ScrollView>
      )}

      <PaymentModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handlePaymentSuccess}
        montant={montant}
        label={action === "changer" ? offreCible?.nom || "Nouvelle offre" : contrat?.offreNom || "Renouvellement"}
        subLabel={periodicite === "ANNUEL" ? "Périodicité annuelle" : "Périodicité mensuelle"}
      />
    </BottomSheet>
  );
};

const CreateSheet = ({
  visible,
  onClose,
  onCreated,
  gestionnaireId,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  gestionnaireId?: string;
}) => {
  const [nom, setNom] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom est obligatoire.");
      return;
    }
    setSubmitting(true);
    try {
      await establishmentService.create({ nom: nom.trim(), localisation: localisation.trim(), gestionnaireId });
      setNom("");
      setLocalisation("");
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nouvel établissement">
      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Nom de l'établissement" />
      <Input label="Localisation" value={localisation} onChangeText={setLocalisation} placeholder="Ville, pays" />
      <Button label="Créer" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
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
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { ...typography.bodyBold, color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  contractBox: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, gap: 4 },
  toggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
});

export default EstablishmentListBody;
