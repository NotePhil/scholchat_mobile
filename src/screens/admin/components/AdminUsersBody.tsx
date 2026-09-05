import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import DocumentPreview from "../../../components/common/DocumentPreview";
import { colors, radius, spacing, typography } from "../../../styles/theme";
import {
  accederService,
  gestionnaireService,
  parentService,
  professorService,
  rejectionService,
  studentService,
  userService,
} from "../../../services/api";
import { ClassEntity, RejectionMotif } from "../../../types";

type RoleTab = "admins" | "professeurs" | "parents" | "eleves" | "autres" | "gestionnaires" | "pending";

// Same 6 items as web's Sidebar.jsx "Gérer Utilisateur" dropdown (Admin/Professeurs/
// Parents/Students/Others/Gestionnaires), plus "En attente" — a real, useful
// validation queue mobile already had that web only surfaces as a filter inside
// Professeurs, not as its own sidebar item.
const TABS: { id: RoleTab; label: string }[] = [
  { id: "admins", label: "Admins" },
  { id: "professeurs", label: "Professeurs" },
  { id: "parents", label: "Parents" },
  { id: "eleves", label: "Élèves" },
  { id: "autres", label: "Autres" },
  { id: "gestionnaires", label: "Gestionnaires" },
  { id: "pending", label: "En attente" },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  ACTIF: "Actif",
  INACTIVE: "Inactif",
  INACTIF: "Inactif",
  PENDING: "En attente",
  AWAITING_VALIDATION: "À valider",
};

interface SimpleClass {
  id: string;
  nom?: string;
  niveau?: string;
  etat?: string;
}

interface SimpleEstablishment {
  nom?: string;
  localisation?: string;
  pays?: string;
  codeUnique?: string;
}

interface SimpleChild {
  id: string;
  prenom?: string;
  nom?: string;
}

interface Row {
  id: string;
  prenom: string;
  nom: string;
  name: string;
  email: string;
  telephone?: string;
  adresse?: string;
  niveau?: string;
  matricule?: string;
  etat?: string;
  dateCreation?: string;
  classes?: SimpleClass[];
  etablissementsGeres?: SimpleEstablishment[];
  enfants?: SimpleChild[];
  cniUrlRecto?: string;
  cniUrlVerso?: string;
  selfieUrl?: string;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString("fr-FR") : undefined);

const toRow = (raw: Record<string, any>): Row => ({
  id: raw.id,
  prenom: raw.prenom ?? "",
  nom: raw.nom ?? "",
  name: `${raw.prenom ?? ""} ${raw.nom ?? ""}`.trim() || raw.username || "Sans nom",
  email: raw.email ?? "",
  telephone: raw.telephone,
  adresse: raw.adresse,
  niveau: raw.niveau,
  matricule: raw.matriculeProfesseur,
  etat: raw.etat,
  dateCreation: raw.dateCreation ?? raw.creationDate,
  // Already embedded on the professor object returned by /professeurs — web's
  // ProfessorsContent.jsx reads these straight off `prof.*` with no extra
  // fetch. Reusing them here means richer data with zero added network cost.
  classes: raw.moderatedClasses,
  etablissementsGeres: raw.etablissementsGeres,
  cniUrlRecto: raw.cniUrlRecto,
  cniUrlVerso: raw.cniUrlVerso,
  selfieUrl: raw.selfieUrl,
});

/**
 * Web only shows Valider/Rejeter/Renvoyer-l'email inside a professor's
 * detail view (opened via "Voir"), never on the compact list card itself —
 * confirmed directly against ProfessorsContent.jsx's `viewingProfessor` hero
 * banner ("Row 3: admin action buttons"), not its grid-card rendering. A row
 * counts as needing action whenever its status isn't unambiguously
 * "active" — the backend's exact spelling of "pending" has proven
 * unreliable, so anything else (missing, unrecognized, or an explicit
 * pending value) defaults to needing a decision rather than requiring a
 * precise string match.
 */
const getValidationState = (row: Row, activeTab: RoleTab) => {
  const etatUpper = row.etat?.toUpperCase() ?? "";
  const isClearlyActive = etatUpper === "ACTIVE" || etatUpper === "ACTIF";
  const isPendingProfessorRow = (activeTab === "professeurs" || activeTab === "pending") && !isClearlyActive;
  const awaitingEmail = isPendingProfessorRow && etatUpper === "PENDING";
  const awaitingValidation = isPendingProfessorRow && !awaitingEmail;
  return { awaitingEmail, awaitingValidation };
};

const statusTone = (etat?: string): "success" | "warning" | "neutral" => {
  if (!etat) return "neutral";
  const up = etat.toUpperCase();
  if (up.includes("ACTI")) return "success";
  if (up.includes("ATTENTE") || up === "PENDING" || up === "AWAITING_VALIDATION") return "warning";
  return "neutral";
};

interface AdminUsersBodyProps {
  /** Which user-type tab to land on — set when opened from the "Gérer Utilisateur" quick-action submenu (mirrors web's Sidebar dropdown: pick a user type first, then see that list). */
  initialTab?: RoleTab;
}

const AdminUsersBody = ({ initialTab }: AdminUsersBodyProps) => {
  const [activeTab, setActiveTab] = useState<RoleTab>(initialTab ?? "professeurs");
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingRow, setRejectingRow] = useState<Row | null>(null);
  const [viewingRow, setViewingRow] = useState<Row | null>(null);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // The screen instance persists across "Gérer Utilisateur" submenu picks
  // (same component, just a different `initialTab` prop each time) — without
  // this, picking a different user type after the first visit silently did
  // nothing, since useState's initial value only applies on mount.
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSearchTerm("");
    try {
      let data: Record<string, any>[] = [];
      if (activeTab === "admins") data = await userService.getAdmins();
      else if (activeTab === "professeurs") data = await professorService.getAll();
      else if (activeTab === "parents") data = await parentService.getAllSummary();
      else if (activeTab === "eleves") data = await studentService.getAll();
      else if (activeTab === "gestionnaires") data = await gestionnaireService.getAll();
      else if (activeTab === "pending") {
        const result = await userService.getPendingProfessors();
        data = Array.isArray(result) ? result : (result as any)?.content ?? [];
      }
      const baseRows = data.map(toRow);
      setRows(baseRows);

      // Secondary, non-blocking enrichment so the list still renders
      // immediately even if these lookups are slow/fail. Professeurs already
      // carry moderatedClasses/etablissementsGeres straight from toRow(), so
      // this only needs to fill in for the roles that don't: class access
      // for everyone else, and a parent's own children list (mirrors web's
      // ParentsContent.jsx enrichment loop).
      if (activeTab !== "pending" && activeTab !== "professeurs") {
        Promise.all(
          baseRows.map(async (row) => {
            const [classes, enfants] = await Promise.all([
              accederService.getAccessibleClasses(row.id).catch(() => [] as ClassEntity[]),
              activeTab === "parents" ? parentService.getChildren(row.id).catch(() => []) : Promise.resolve(undefined),
            ]);
            return { id: row.id, classes, enfants };
          })
        ).then((results) => {
          const byId = new Map(results.map((r) => [r.id, r]));
          setRows((prev) =>
            prev.map((r) => {
              const extra = byId.get(r.id);
              return extra ? { ...r, classes: extra.classes, enfants: extra.enfants } : r;
            })
          );
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Web validates a professor with no confirmation at all — a plain click.
  // That's fine with a mouse, but a stray tap on mobile is far easier, so a
  // confirmation here is a deliberate, requested improvement over web, not a
  // mismatch with it.
  const handleValidate = (row: Row) => {
    Alert.alert("Valider le professeur", `Êtes-vous sûr de vouloir valider ${row.name} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Valider",
        onPress: async () => {
          setActionLoadingId(row.id);
          try {
            await userService.validateProfessor(row.id);
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            setViewingRow((prev) => (prev?.id === row.id ? null : prev));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la validation.");
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  };

  const handleReject = (row: Row) => {
    setViewingRow(null);
    setRejectingRow(row);
  };

  /** codeErreur is a real motif code picked from the admin-managed rejection-reason catalog, matching web's radio-list reject modal — not a hardcoded "MANUAL_REJECTION" placeholder. */
  const handleConfirmReject = async (codeErreur: string, motifSupplementaire: string) => {
    if (!rejectingRow) return;
    try {
      await userService.rejectProfessor(rejectingRow.id, codeErreur, motifSupplementaire || undefined);
      setRows((prev) => prev.filter((r) => r.id !== rejectingRow.id));
      setRejectingRow(null);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du rejet.");
    }
  };

  const handleResendActivation = async (row: Row) => {
    if (!row.email) {
      Alert.alert("Erreur", "Cet utilisateur n'a pas d'adresse email.");
      return;
    }
    setActionLoadingId(row.id);
    try {
      await userService.resendActivationEmail(row.email);
      Alert.alert("Succès", "Email d'activation renvoyé.");
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = (row: Row) => {
    Alert.alert("Supprimer", `Voulez-vous vraiment supprimer ${row.name} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            if (activeTab === "professeurs") await professorService.remove(row.id);
            else if (activeTab === "parents") await parentService.remove(row.id);
            else if (activeTab === "eleves") await studentService.remove(row.id);
            else await userService.deleteUser(row.id);
            setRows((prev) => prev.filter((r) => r.id !== row.id));
          } catch (err) {
            Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression.");
          }
        },
      },
    ]);
  };

  const handleSaveEdit = async (patch: Partial<Row>) => {
    if (!editingRow) return;
    const payload = {
      prenom: patch.prenom,
      nom: patch.nom,
      email: patch.email,
      telephone: patch.telephone,
      adresse: patch.adresse,
      niveau: patch.niveau,
      matriculeProfesseur: patch.matricule,
    };
    try {
      if (activeTab === "professeurs") await professorService.update(editingRow.id, payload);
      else if (activeTab === "parents") await parentService.update(editingRow.id, payload);
      else if (activeTab === "eleves") await studentService.update(editingRow.id, payload);
      else await userService.updateUser(editingRow.id, payload);
      Alert.alert("Succès", "Utilisateur modifié avec succès.");
      setEditingRow(null);
      load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la modification.");
    }
  };

  const showClasses = activeTab !== "pending";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion des utilisateurs</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchWrap}>
        <Input placeholder="Rechercher..." value={searchTerm} onChangeText={setSearchTerm} />
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : filteredRows.length === 0 ? (
          <EmptyState icon="users" title="Aucun résultat" message="Aucun utilisateur dans cette catégorie." />
        ) : (
          filteredRows.map((row) => {
            const { awaitingEmail, awaitingValidation } = getValidationState(row, activeTab);
            const hasDocs = !!(row.cniUrlRecto || row.cniUrlVerso || row.selfieUrl);
            return (
              <View key={row.id} style={styles.card}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(row.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <View style={styles.headerMetaRow}>
                      {row.matricule ? <Text style={styles.headerMeta}>#{row.matricule}</Text> : null}
                      {row.email ? (
                        <Text style={styles.headerMeta} numberOfLines={1}>
                          {row.email}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {row.etat ? <Badge label={STATUS_LABELS[row.etat.toUpperCase()] ?? row.etat} tone={statusTone(row.etat)} /> : null}
                </View>

                {/* Prominent validation actions — matches web's centered admin-action row for a pending professor, not a small icon. */}
                {(awaitingValidation || awaitingEmail) && (
                  <View style={styles.validationRow}>
                    {awaitingValidation ? (
                      <>
                        <Button
                          label="Valider"
                          onPress={() => handleValidate(row)}
                          loading={actionLoadingId === row.id}
                          style={{ minWidth: 130, flexGrow: 1, backgroundColor: colors.success }}
                        />
                        <Button label="Rejeter" variant="danger" onPress={() => handleReject(row)} style={{ minWidth: 130, flexGrow: 1 }} />
                      </>
                    ) : (
                      <Button
                        label="Renvoyer l'email d'activation"
                        onPress={() => handleResendActivation(row)}
                        loading={actionLoadingId === row.id}
                        fullWidth
                      />
                    )}
                  </View>
                )}

                {/* Informations */}
                <View style={styles.sectionBox}>
                  <SectionHeader icon="address-card" label="Informations" />
                  {row.telephone ? <InfoLine icon="phone" text={row.telephone} /> : null}
                  {row.adresse ? <InfoLine icon="map-marker-alt" text={row.adresse} /> : null}
                  {row.niveau ? <InfoLine icon="layer-group" text={`Niveau: ${row.niveau}`} /> : null}
                  {formatDate(row.dateCreation) ? <InfoLine icon="calendar-alt" text={`Créé le ${formatDate(row.dateCreation)}`} /> : null}
                  {hasDocs ? (
                    <View style={styles.docBadgeRow}>
                      {row.cniUrlRecto || row.cniUrlVerso ? <Badge label="CNI ✓" tone="info" /> : null}
                      {row.selfieUrl ? <Badge label="Selfie ✓" tone="success" /> : null}
                    </View>
                  ) : null}
                </View>

                {activeTab === "professeurs" && row.etablissementsGeres && row.etablissementsGeres.length > 0 ? (
                  <View style={styles.sectionBox}>
                    <SectionHeader icon="school" label="Établissements" />
                    {row.etablissementsGeres.map((e, i) => (
                      <View key={i} style={styles.establishmentRow}>
                        <Text style={styles.establishmentName}>{e.nom}</Text>
                        {e.localisation || e.pays ? (
                          <Text style={styles.establishmentMeta}>
                            {[e.localisation, e.pays].filter(Boolean).join(", ")}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {activeTab === "parents" ? (
                  <View style={styles.sectionBox}>
                    <SectionHeader icon="child" label="Enfants" />
                    {row.enfants === undefined ? (
                      <Text style={styles.classesValue}>Chargement...</Text>
                    ) : row.enfants.length === 0 ? (
                      <Text style={styles.classesValue}>Aucun enfant associé</Text>
                    ) : (
                      <View style={styles.classChipsRow}>
                        {row.enfants.map((c) => (
                          <View key={c.id} style={styles.classChip}>
                            <Text style={styles.classChipText}>
                              {c.prenom} {c.nom}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}

                {showClasses && (
                  <View style={styles.sectionBox}>
                    <SectionHeader icon="chalkboard" label={activeTab === "professeurs" ? "Classes modérées" : "Classes"} />
                    {row.classes === undefined ? (
                      <Text style={styles.classesValue}>Chargement...</Text>
                    ) : row.classes.length === 0 ? (
                      <Text style={styles.classesValue}>Aucune</Text>
                    ) : (
                      <View style={styles.classChipsRow}>
                        {row.classes.map((cls) => (
                          <View key={cls.id} style={styles.classChip}>
                            <Text style={styles.classChipText}>
                              {cls.nom}
                              {cls.niveau ? ` · ${cls.niveau}` : ""}
                            </Text>
                            {cls.etat ? (
                              <View style={[styles.classDot, { backgroundColor: cls.etat.toUpperCase() === "ACTIF" ? colors.success : colors.warning }]} />
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Row actions — matches web's ProfessorsContent.jsx grid-card row: Voir/Modifier/Supprimer for everyone. */}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setViewingRow(row)}>
                    <FontAwesome5 name="eye" size={13} color={colors.textMuted} />
                    <Text style={styles.actionText}>Voir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setEditingRow(row)}>
                    <FontAwesome5 name="edit" size={13} color={colors.success} />
                    <Text style={[styles.actionText, { color: colors.success }]}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(row)}>
                    <FontAwesome5 name="trash" size={13} color={colors.danger} />
                    <Text style={[styles.actionText, { color: colors.danger }]}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <RejectMotifSheet row={rejectingRow} onCancel={() => setRejectingRow(null)} onSubmit={handleConfirmReject} />

      <BottomSheet visible={!!viewingRow} onClose={() => setViewingRow(null)} title={viewingRow?.name}>
        {viewingRow ? (
          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            <View style={styles.viewBadgeRow}>
              {viewingRow.etat ? <Badge label={STATUS_LABELS[viewingRow.etat.toUpperCase()] ?? viewingRow.etat} tone={statusTone(viewingRow.etat)} /> : null}
            </View>

            {/* Matches web's professor detail view exactly: Valider (green) / Rejeter
                (red) — or "Renvoyer l'email d'activation" — sits right at the top,
                before any other information, not buried below. */}
            {(() => {
              const { awaitingEmail, awaitingValidation } = getValidationState(viewingRow, activeTab);
              if (!awaitingEmail && !awaitingValidation) return null;
              return (
                <View style={styles.validationRow}>
                  {awaitingValidation ? (
                    <>
                      <Button
                        label="Valider"
                        onPress={() => handleValidate(viewingRow)}
                        loading={actionLoadingId === viewingRow.id}
                        style={{ minWidth: 130, flexGrow: 1, backgroundColor: colors.success }}
                      />
                      <Button label="Rejeter" variant="danger" onPress={() => handleReject(viewingRow)} style={{ minWidth: 130, flexGrow: 1 }} />
                    </>
                  ) : (
                    <Button
                      label="Renvoyer l'email d'activation"
                      onPress={() => handleResendActivation(viewingRow)}
                      loading={actionLoadingId === viewingRow.id}
                      fullWidth
                    />
                  )}
                </View>
              );
            })()}

            <ViewRow icon="envelope" label="Email" value={viewingRow.email} />
            <ViewRow icon="phone" label="Téléphone" value={viewingRow.telephone} />
            <ViewRow icon="map-marker-alt" label="Adresse" value={viewingRow.adresse} />
            <ViewRow icon="layer-group" label="Niveau" value={viewingRow.niveau} />
            <ViewRow icon="id-badge" label="Matricule" value={viewingRow.matricule} />
            <ViewRow icon="calendar-alt" label="Créé le" value={formatDate(viewingRow.dateCreation)} />

            {(viewingRow.cniUrlRecto || viewingRow.cniUrlVerso || viewingRow.selfieUrl) && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.classesLabel}>Documents d'identité</Text>
                <View style={styles.documentsRow}>
                  {viewingRow.cniUrlRecto ? <DocumentPreview path={viewingRow.cniUrlRecto} label="CNI Recto" /> : null}
                  {viewingRow.cniUrlVerso ? <DocumentPreview path={viewingRow.cniUrlVerso} label="CNI Verso" /> : null}
                  {viewingRow.selfieUrl ? <DocumentPreview path={viewingRow.selfieUrl} label="Selfie" /> : null}
                </View>
              </View>
            )}

            {viewingRow.etablissementsGeres && viewingRow.etablissementsGeres.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.classesLabel}>Établissements</Text>
                {viewingRow.etablissementsGeres.map((e, i) => (
                  <View key={i} style={styles.establishmentRow}>
                    <Text style={styles.establishmentName}>{e.nom}</Text>
                    {e.localisation || e.pays ? <Text style={styles.establishmentMeta}>{[e.localisation, e.pays].filter(Boolean).join(", ")}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {viewingRow.enfants && viewingRow.enfants.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.classesLabel}>Enfants</Text>
                <View style={styles.classChipsRow}>
                  {viewingRow.enfants.map((c) => (
                    <View key={c.id} style={styles.classChip}>
                      <Text style={styles.classChipText}>
                        {c.prenom} {c.nom}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {viewingRow.classes && viewingRow.classes.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.classesLabel}>Classes</Text>
                <View style={styles.classChipsRow}>
                  {viewingRow.classes.map((cls) => (
                    <View key={cls.id} style={styles.classChip}>
                      <Text style={styles.classChipText}>
                        {cls.nom}
                        {cls.niveau ? ` · ${cls.niveau}` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={{ height: spacing.lg }} />
          </ScrollView>
        ) : null}
      </BottomSheet>

      <EditUserSheet row={editingRow} activeTab={activeTab} onClose={() => setEditingRow(null)} onSave={handleSaveEdit} />
    </View>
  );
};

const SectionHeader = ({ icon, label }: { icon: React.ComponentProps<typeof FontAwesome5>["name"]; label: string }) => (
  <View style={styles.sectionHeaderRow}>
    <FontAwesome5 name={icon} size={11} color={colors.primary} />
    <Text style={styles.sectionHeaderText}>{label}</Text>
  </View>
);

const InfoLine = ({ icon, text }: { icon: React.ComponentProps<typeof FontAwesome5>["name"]; text: string }) => (
  <View style={styles.infoRow}>
    <FontAwesome5 name={icon} size={12} color={colors.textMuted} />
    <Text style={styles.infoText}>{text}</Text>
  </View>
);

const ViewRow = ({ icon, label, value }: { icon: React.ComponentProps<typeof FontAwesome5>["name"]; label: string; value?: string }) => {
  if (!value) return null;
  return (
    <View style={styles.viewRow}>
      <FontAwesome5 name={icon} size={13} color={colors.textMuted} style={{ width: 20 }} />
      <Text style={styles.viewLabel}>{label}</Text>
      <Text style={styles.viewValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
};

interface EditUserSheetProps {
  row: Row | null;
  activeTab: RoleTab;
  onClose: () => void;
  onSave: (patch: Partial<Row>) => void | Promise<void>;
}

const EditUserSheet = ({ row, activeTab, onClose, onSave }: EditUserSheetProps) => {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [niveau, setNiveau] = useState("");
  const [matricule, setMatricule] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row) return;
    setPrenom(row.prenom);
    setNom(row.nom);
    setEmail(row.email);
    setTelephone(row.telephone ?? "");
    setAdresse(row.adresse ?? "");
    setNiveau(row.niveau ?? "");
    setMatricule(row.matricule ?? "");
  }, [row]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSave({ prenom: prenom.trim(), nom: nom.trim(), email: email.trim(), telephone: telephone.trim(), adresse: adresse.trim(), niveau: niveau.trim(), matricule: matricule.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={!!row} onClose={onClose} title={`Modifier — ${row?.name ?? ""}`}>
      <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
        <Input label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Prénom" />
        <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Nom" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Téléphone" value={telephone} onChangeText={setTelephone} placeholder="Téléphone" keyboardType="phone-pad" />
        {activeTab === "eleves" ? <Input label="Niveau" value={niveau} onChangeText={setNiveau} placeholder="Ex: 3ème" /> : null}
        {activeTab === "professeurs" || activeTab === "pending" ? (
          <Input label="Matricule" value={matricule} onChangeText={setMatricule} placeholder="Matricule" />
        ) : null}
        {activeTab !== "eleves" && activeTab !== "professeurs" && activeTab !== "pending" ? (
          <Input label="Adresse" value={adresse} onChangeText={setAdresse} placeholder="Adresse" />
        ) : null}
        <Button label="Enregistrer" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      </ScrollView>
    </BottomSheet>
  );
};

interface RejectMotifSheetProps {
  row: Row | null;
  onCancel: () => void;
  onSubmit: (codeErreur: string, motifSupplementaire: string) => void | Promise<void>;
}

/**
 * Matches web's professor-reject modal exactly: a required radio list of the
 * admin-managed rejection-reason catalog (code + descriptif) plus an
 * optional free-text "Motif supplémentaire" — not a single free-text prompt.
 */
const RejectMotifSheet = ({ row, onCancel, onSubmit }: RejectMotifSheetProps) => {
  const [motifs, setMotifs] = useState<RejectionMotif[]>([]);
  const [loadingMotifs, setLoadingMotifs] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [supplement, setSupplement] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row) return;
    setSelectedCode(null);
    setSupplement("");
    setLoadingMotifs(true);
    rejectionService
      .getAll()
      .then(setMotifs)
      .catch(() => setMotifs([]))
      .finally(() => setLoadingMotifs(false));
  }, [row]);

  const handleSubmit = async () => {
    if (!selectedCode) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedCode, supplement.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={!!row} onClose={onCancel} title={`Rejeter — ${row?.name ?? ""}`}>
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>
          Motif de rejet <Text style={{ color: colors.danger }}>*</Text>
        </Text>
        {loadingMotifs ? (
          <LoadingSpinner label="Chargement des motifs..." />
        ) : motifs.length === 0 ? (
          <Text style={styles.classesValue}>Aucun motif disponible.</Text>
        ) : (
          motifs.map((m) => {
            const selected = selectedCode === m.code;
            return (
              <TouchableOpacity key={m.id} style={[styles.motifRow, selected && styles.motifRowActive]} onPress={() => setSelectedCode(m.code ?? null)}>
                <FontAwesome5 name={selected ? "dot-circle" : "circle"} solid={selected} size={16} color={selected ? colors.danger : colors.textMuted} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.motifCode}>{m.code}</Text>
                  {m.descriptif ? <Text style={styles.motifDescriptif}>{m.descriptif}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <Input
          label="Motif supplémentaire (optionnel)"
          value={supplement}
          onChangeText={setSupplement}
          placeholder="Précisez si nécessaire..."
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />

        <Button
          label="Rejeter"
          variant="danger"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!selectedCode}
          fullWidth
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  tabsScroll: { paddingHorizontal: 16, marginBottom: spacing.md, flexGrow: 0 },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
    marginRight: spacing.sm,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  tabTextActive: { color: colors.white },
  searchWrap: { paddingHorizontal: 16 },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  name: { ...typography.h3, color: colors.text },
  headerMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 },
  headerMeta: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  validationRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  sectionBox: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xs },
  sectionHeaderText: { ...typography.caption, color: colors.primary, fontWeight: "700", textTransform: "uppercase", fontSize: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
  infoText: { ...typography.caption, color: colors.text },
  docBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  establishmentRow: { marginTop: 4 },
  establishmentName: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  establishmentMeta: { ...typography.caption, color: colors.textMuted },
  classesLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 },
  classesValue: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  classChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  classChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.grayLight, borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  classChipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  classDot: { width: 6, height: 6, borderRadius: 3 },
  documentsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  viewBadgeRow: { flexDirection: "row", marginBottom: spacing.md },
  viewRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  viewLabel: { ...typography.caption, color: colors.textMuted, width: 90 },
  viewValue: { ...typography.body, color: colors.text, flex: 1 },
  motifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  motifRowActive: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  motifCode: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  motifDescriptif: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

export default AdminUsersBody;
