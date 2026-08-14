import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, LoadingSpinner } from "../../components/ui";
import OffreInfoPanel from "../../components/common/OffreInfoPanel";
import { colors, radius, spacing, typography } from "../../styles/theme";
import { classAdminService, establishmentService } from "../../services/api";
import { ClassEntity, Etablissement, Gestionnaire } from "../../types";

type Tab = "classes" | "professeurs" | "info";

interface EstablishmentDetailsProps {
  establishmentId: string;
  onBack: () => void;
}

/**
 * Mirrors scholchat_front's real ManageEstablishmentDetailsView.jsx exactly:
 * info card + Gestionnaire block + inline OffreInfoPanel ("Forfait"), then a
 * 3-tab section — Classes / Professeurs / Informations Système. (Not the
 * "Membres" tab some docs describe — the actual component has no such tab;
 * verified directly against the source, not assumed.)
 */
const EstablishmentDetails = ({ establishmentId, onBack }: EstablishmentDetailsProps) => {
  const [establishment, setEstablishment] = useState<Etablissement | null>(null);
  const [gestionnaire, setGestionnaire] = useState<Gestionnaire | null>(null);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("classes");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [est, allClasses] = await Promise.all([
        establishmentService.getById(establishmentId),
        classAdminService.getAll().catch(() => []),
      ]);
      setEstablishment(est);
      setClasses(allClasses.filter((c) => c.etablissement?.id === establishmentId));
      establishmentService
        .getGestionnaire(establishmentId)
        .then(setGestionnaire)
        .catch(() => setGestionnaire(null));
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const professeurs = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; nom?: string; prenom?: string; email?: string; telephone?: string; etat?: string; count: number }
    >();
    classes.forEach((c) => {
      const mod = (c as any).moderator;
      if (!mod?.id) return;
      const existing = seen.get(mod.id);
      if (existing) existing.count += 1;
      else
        seen.set(mod.id, {
          id: mod.id,
          nom: mod.nom,
          prenom: mod.prenom,
          email: mod.email,
          telephone: mod.telephone,
          etat: mod.etat,
          count: 1,
        });
    });
    return Array.from(seen.values());
  }, [classes]);

  if (loading || !establishment) {
    return <LoadingSpinner label="Chargement de l'établissement..." fullScreen />;
  }

  const classesActives = classes.filter((c) => c.etat === "ACTIF").length;
  const classesEnAttente = classes.filter((c) => c.etat === "EN_ATTENTE_APPROBATION").length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {establishment.nom}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Row icon="school" label="Nom" value={establishment.nom} />
          <Row icon="map-marker-alt" label="Localisation" value={establishment.localisation || "N/A"} />
          <Row icon="globe" label="Pays" value={establishment.pays || "N/A"} />
          <Row icon="envelope" label="Email" value={establishment.email || "N/A"} />
          <Row icon="phone" label="Téléphone" value={establishment.telephone || "N/A"} />
          {establishment.codeUnique ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Code Unique</Text>
              <Text style={styles.codeValue}>{establishment.codeUnique}</Text>
            </View>
          ) : null}
        </View>

        {gestionnaire ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Gestionnaire</Text>
            <Row icon="user" label="Nom" value={`${gestionnaire.prenom ?? ""} ${gestionnaire.nom ?? ""}`.trim()} />
            <Row icon="envelope" label="Email" value={gestionnaire.email || "N/A"} />
            <Row icon="phone" label="Téléphone" value={gestionnaire.telephone || "N/A"} />
          </View>
        ) : null}

        <View style={{ marginBottom: spacing.md }}>
          <OffreInfoPanel type="ETABLISSEMENT" entityId={establishmentId} />
        </View>

        <View style={styles.tabsRow}>
          <TabButton active={tab === "classes"} label={`Classes (${classes.length})`} onPress={() => setTab("classes")} />
          <TabButton active={tab === "professeurs"} label={`Professeurs (${professeurs.length})`} onPress={() => setTab("professeurs")} />
          <TabButton active={tab === "info"} label="Infos" onPress={() => setTab("info")} />
        </View>

        {tab === "classes" && (
          <View style={styles.card}>
            {classes.length === 0 ? (
              <Text style={styles.emptyText}>Aucune classe dans cet établissement</Text>
            ) : (
              classes.map((c) => (
                <View key={c.id} style={styles.listItem}>
                  <View style={styles.listItemAvatar}>
                    <FontAwesome5 name="chalkboard" size={13} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemName}>{c.nom}</Text>
                    <Text style={styles.listItemMeta}>
                      {c.niveau ?? ""}
                      {(c as any).codeActivation ? ` • Code: ${(c as any).codeActivation}` : ""}
                      {(c as any).dateCreation
                        ? ` • ${new Date((c as any).dateCreation).toLocaleDateString("fr-FR")}`
                        : ""}
                    </Text>
                    {c.etat ? (
                      <View style={{ marginTop: 4 }}>
                        <Badge label={c.etat === "ACTIF" ? "Actif" : c.etat === "EN_ATTENTE_APPROBATION" ? "En attente" : c.etat} tone={c.etat === "ACTIF" ? "success" : c.etat === "EN_ATTENTE_APPROBATION" ? "warning" : "danger"} />
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "professeurs" && (
          <View style={styles.card}>
            {professeurs.length === 0 ? (
              <Text style={styles.emptyText}>Aucun professeur dans cet établissement</Text>
            ) : (
              professeurs.map((p) => (
                <View key={p.id} style={styles.listItem}>
                  <View style={styles.listItemAvatar}>
                    <FontAwesome5 name="chalkboard-teacher" size={13} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemName}>{`${p.prenom ?? ""} ${p.nom ?? ""}`.trim()}</Text>
                    <Text style={styles.listItemMeta}>
                      {p.email ?? ""}
                      {p.telephone ? ` • ${p.telephone}` : ""} • {p.count} classe{p.count > 1 ? "s" : ""} modérée{p.count > 1 ? "s" : ""}
                    </Text>
                    {p.etat ? (
                      <View style={{ marginTop: 4 }}>
                        <Badge label={p.etat === "ACTIF" || p.etat === "ACTIVE" ? "Actif" : "Inactif"} tone={p.etat === "ACTIF" || p.etat === "ACTIVE" ? "success" : "danger"} />
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "info" && (
          <View style={styles.card}>
            <Row icon="fingerprint" label="ID" value={establishment.id} mono />
            <Row
              icon="calendar-alt"
              label="Date de création"
              value={establishment.dateCreation ? new Date(establishment.dateCreation).toLocaleDateString("fr-FR") : "N/A"}
            />
            <Row icon="key" label="Code Unique" value={establishment.codeUnique || "Non défini"} mono />
            <Row icon="chalkboard" label="Total Classes" value={String(classes.length)} />
            <Row icon="check-circle" label="Classes Actives" value={String(classesActives)} />
            <Row icon="clock" label="Classes en Attente" value={String(classesEnAttente)} />
            <Row icon="chalkboard-teacher" label="Total Professeurs" value={String(professeurs.length)} />
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const Row = ({ icon, label, value, mono }: { icon: React.ComponentProps<typeof FontAwesome5>["name"]; label: string; value?: string; mono?: boolean }) => (
  <View style={styles.row}>
    <View style={styles.rowIcon}>
      <FontAwesome5 name={icon} size={12} color={colors.textMuted} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, mono && { fontFamily: "monospace" }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const TabButton = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
  <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
    <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", ...typography.h3, color: colors.text },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: spacing.sm },
  rowIcon: { width: 20, alignItems: "center" },
  rowLabel: { ...typography.caption, color: colors.textMuted, width: 100 },
  rowValue: { ...typography.caption, color: colors.text, fontWeight: "600", flex: 1, textAlign: "right" },
  codeBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeLabel: { ...typography.caption, color: colors.primary },
  codeValue: { ...typography.bodyBold, color: colors.primary, fontFamily: "monospace" },
  tabsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tabButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  tabButtonTextActive: { color: colors.white },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
  listItem: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  listItemAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  listItemName: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  listItemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
});

export default EstablishmentDetails;
