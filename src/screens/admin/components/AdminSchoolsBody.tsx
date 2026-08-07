import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button, EmptyState, Input, ListItem, LoadingSpinner } from "../../../components/ui";
import { colors, spacing, typography } from "../../../styles/theme";
import { establishmentService, matiereService, offerService, rejectionService } from "../../../services/api";
import { Etablissement, Matiere, Offre, RejectionMotif } from "../../../types";

type Segment = "etablissements" | "matieres" | "offres" | "motifs";

const AdminSchoolsBody = () => {
  const [segment, setSegment] = useState<Segment>("etablissements");
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [motifs, setMotifs] = useState<RejectionMotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (segment === "etablissements") setEstablishments(await establishmentService.getAll());
      else if (segment === "matieres") setMatieres(await matiereService.getAll());
      else if (segment === "offres") setOffres(await offerService.list(undefined, true));
      else setMotifs(await rejectionService.getAll());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Écoles & Configuration</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addButton}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.segmentRow}>
        {(
          [
            { id: "etablissements", label: "Établissements" },
            { id: "matieres", label: "Matières" },
            { id: "offres", label: "Offres" },
            { id: "motifs", label: "Motifs de rejet" },
          ] as { id: Segment; label: string }[]
        ).map((seg) => (
          <TouchableOpacity
            key={seg.id}
            style={[styles.segment, segment === seg.id && styles.segmentActive]}
            onPress={() => setSegment(seg.id)}
          >
            <Text style={[styles.segmentText, segment === seg.id && styles.segmentTextActive]}>{seg.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : segment === "etablissements" ? (
          establishments.length === 0 ? (
            <EmptyState icon="school" title="Aucun établissement" />
          ) : (
            establishments.map((e) => (
              <ListItem
                key={e.id}
                title={e.nom ?? "Établissement"}
                subtitle={e.localisation}
                showChevron={false}
                trailing={
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert("Supprimer", `Supprimer "${e.nom}" ?`, [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await establishmentService.remove(e.id);
                              setEstablishments((prev) => prev.filter((x) => x.id !== e.id));
                            } catch (err) {
                              Alert.alert("Erreur", err instanceof Error ? err.message : "Échec.");
                            }
                          },
                        },
                      ])
                    }
                  >
                    <FontAwesome5 name="trash" size={16} color={colors.danger} />
                  </TouchableOpacity>
                }
              />
            ))
          )
        ) : segment === "matieres" ? (
          matieres.length === 0 ? (
            <EmptyState icon="book" title="Aucune matière" />
          ) : (
            matieres.map((m) => (
              <ListItem
                key={m.id}
                title={m.nom}
                showChevron={false}
                trailing={
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert("Supprimer", `Supprimer "${m.nom}" ?`, [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await matiereService.remove(m.id);
                              setMatieres((prev) => prev.filter((x) => x.id !== m.id));
                            } catch (err) {
                              Alert.alert("Erreur", err instanceof Error ? err.message : "Échec.");
                            }
                          },
                        },
                      ])
                    }
                  >
                    <FontAwesome5 name="trash" size={16} color={colors.danger} />
                  </TouchableOpacity>
                }
              />
            ))
          )
        ) : segment === "offres" ? (
          offres.length === 0 ? (
            <EmptyState icon="tags" title="Aucune offre" />
          ) : (
            offres.map((o) => (
              <ListItem
                key={o.id}
                title={o.nom ?? "Offre"}
                subtitle={`${o.cible ?? ""} — ${o.prixMensuel ? `${o.prixMensuel} FCFA/mois` : ""}`}
                showChevron={false}
                trailing={
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await offerService.deactivate(o.id);
                        setOffres((prev) => prev.filter((x) => x.id !== o.id));
                      } catch (err) {
                        Alert.alert("Erreur", err instanceof Error ? err.message : "Échec.");
                      }
                    }}
                  >
                    <FontAwesome5 name="trash" size={16} color={colors.danger} />
                  </TouchableOpacity>
                }
              />
            ))
          )
        ) : motifs.length === 0 ? (
          <EmptyState icon="ban" title="Aucun motif de rejet" />
        ) : (
          motifs.map((m) => (
            <ListItem
              key={m.id}
              title={m.descriptif ?? m.code ?? "Motif"}
              subtitle={m.code}
              showChevron={false}
              trailing={
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Supprimer", `Supprimer "${m.descriptif}" ?`, [
                      { text: "Annuler", style: "cancel" },
                      {
                        text: "Supprimer",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await rejectionService.remove(m.id);
                            setMotifs((prev) => prev.filter((x) => x.id !== m.id));
                          } catch (err) {
                            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec.");
                          }
                        },
                      },
                    ])
                  }
                >
                  <FontAwesome5 name="trash" size={16} color={colors.danger} />
                </TouchableOpacity>
              }
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <CreateSheet
        segment={segment}
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
      />
    </View>
  );
};

interface CreateSheetProps {
  segment: Segment;
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateSheet = ({ segment, visible, onClose, onCreated }: CreateSheetProps) => {
  const [nom, setNom] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [prixMensuel, setPrixMensuel] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setNom("");
    setLocalisation("");
    setPrixMensuel("");
    setCode("");
  };

  const titles: Record<Segment, string> = {
    etablissements: "Nouvel établissement",
    matieres: "Nouvelle matière",
    offres: "Nouvelle offre",
    motifs: "Nouveau motif de rejet",
  };

  const handleSubmit = async () => {
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom est obligatoire.");
      return;
    }
    setSubmitting(true);
    try {
      if (segment === "etablissements") {
        await establishmentService.create({ nom: nom.trim(), localisation: localisation.trim() });
      } else if (segment === "matieres") {
        await matiereService.create(nom.trim());
      } else if (segment === "offres") {
        await offerService.create({ nom: nom.trim(), prixMensuel: Number(prixMensuel) || 0, cible: "CLASSE", actif: true });
      } else {
        await rejectionService.create({ descriptif: nom.trim(), code: code.trim() || nom.trim().toUpperCase().replace(/\s+/g, "_") });
      }
      reset();
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={titles[segment]}>
      <Input label={segment === "motifs" ? "Libellé" : "Nom"} value={nom} onChangeText={setNom} placeholder="Nom" />
      {segment === "etablissements" && (
        <Input label="Localisation" value={localisation} onChangeText={setLocalisation} placeholder="Ville, pays" />
      )}
      {segment === "offres" && (
        <Input
          label="Prix mensuel (FCFA)"
          value={prixMensuel}
          onChangeText={setPrixMensuel}
          placeholder="0"
          keyboardType="numeric"
        />
      )}
      {segment === "motifs" && (
        <Input label="Code (optionnel)" value={code} onChangeText={setCode} placeholder="Ex: DOCUMENT_INVALIDE" autoCapitalize="characters" />
      )}
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: spacing.sm, marginBottom: spacing.md },
  segment: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.grayLight, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  segmentTextActive: { color: colors.white },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
});

export default AdminSchoolsBody;
