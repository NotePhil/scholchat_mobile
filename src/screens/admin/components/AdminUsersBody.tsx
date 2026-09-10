import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import DocumentPreview from "../../../components/common/DocumentPreview";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../../styles/theme";
import {
  accederService, gestionnaireService, parentService, professorService,
  rejectionService, studentService, userService,
} from "../../../services/api";
import { ClassEntity, RejectionMotif } from "../../../types";

// LinearGradient with safe fallback
let LinearGradient: any;
try { LinearGradient = require("expo-linear-gradient").LinearGradient; } catch { LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>; }

type RoleTab = "admins" | "professeurs" | "parents" | "eleves" | "autres" | "gestionnaires" | "pending";

const TABS: { id: RoleTab; label: string; icon: string; color: string }[] = [
  { id: "admins", label: "Admins", icon: "shield-alt", color: "#6366F1" },
  { id: "professeurs", label: "Profs", icon: "chalkboard-teacher", color: "#10B981" },
  { id: "parents", label: "Parents", icon: "users", color: "#3B82F6" },
  { id: "eleves", label: "Élèves", icon: "user-graduate", color: "#0284C7" },
  { id: "autres", label: "Autres", icon: "user", color: "#F59E0B" },
  { id: "gestionnaires", label: "Gestion.", icon: "building", color: "#0D9488" },
  { id: "pending", label: "En attente", icon: "clock", color: "#EF4444" },
];

const TAB_GRADIENT: Record<RoleTab, string[]> = {
  admins: ["#6366F1", "#4338CA"],
  professeurs: ["#10B981", "#059669"],
  parents: ["#3B82F6", "#2563EB"],
  eleves: ["#0284C7", "#0369A1"],
  autres: ["#F59E0B", "#D97706"],
  gestionnaires: ["#0D9488", "#0F766E"],
  pending: ["#EF4444", "#DC2626"],
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif", ACTIF: "Actif", INACTIVE: "Inactif", INACTIF: "Inactif",
  PENDING: "En attente", AWAITING_VALIDATION: "À valider",
};

interface SimpleClass { id: string; nom?: string; niveau?: string; etat?: string; }
interface SimpleEstablishment { nom?: string; localisation?: string; pays?: string; codeUnique?: string; }
interface SimpleChild { id: string; prenom?: string; nom?: string; }

interface Row {
  id: string; prenom: string; nom: string; name: string; email: string;
  telephone?: string; adresse?: string; niveau?: string; matricule?: string;
  etat?: string; dateCreation?: string;
  classes?: SimpleClass[]; etablissementsGeres?: SimpleEstablishment[];
  enfants?: SimpleChild[]; cniUrlRecto?: string; cniUrlVerso?: string; selfieUrl?: string;
}

const getInitials = (name: string) => name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString("fr-FR") : undefined);

const toRow = (raw: Record<string, any>): Row => ({
  id: raw.id, prenom: raw.prenom ?? "", nom: raw.nom ?? "",
  name: `${raw.prenom ?? ""} ${raw.nom ?? ""}`.trim() || raw.username || "Sans nom",
  email: raw.email ?? "", telephone: raw.telephone, adresse: raw.adresse, niveau: raw.niveau,
  matricule: raw.matriculeProfesseur, etat: raw.etat,
  dateCreation: raw.dateCreation ?? raw.creationDate,
  classes: raw.moderatedClasses, etablissementsGeres: raw.etablissementsGeres,
  cniUrlRecto: raw.cniUrlRecto, cniUrlVerso: raw.cniUrlVerso, selfieUrl: raw.selfieUrl,
});

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

interface AdminUsersBodyProps { initialTab?: RoleTab; }

const AdminUsersBody = ({ initialTab }: AdminUsersBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<RoleTab>(initialTab ?? "professeurs");
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingRow, setRejectingRow] = useState<Row | null>(null);
  const [viewingRow, setViewingRow] = useState<Row | null>(null);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setSearchTerm("");
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
      if (activeTab !== "pending" && activeTab !== "professeurs") {
        Promise.all(baseRows.map(async (row) => {
          const [classes, enfants] = await Promise.all([
            accederService.getAccessibleClasses(row.id).catch(() => [] as ClassEntity[]),
            activeTab === "parents" ? parentService.getChildren(row.id).catch(() => []) : Promise.resolve(undefined),
          ]);
          return { id: row.id, classes, enfants };
        })).then((results) => {
          const byId = new Map(results.map((r) => [r.id, r]));
          setRows((prev) => prev.map((r) => { const extra = byId.get(r.id); return extra ? { ...r, classes: extra.classes, enfants: extra.enfants } : r; }));
        });
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Échec du chargement."); }
    finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = rows.filter((r) => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.email.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleValidate = (row: Row) => {
    Alert.alert("Valider le professeur", `Êtes-vous sûr de vouloir valider ${row.name} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Valider", onPress: async () => {
        setActionLoadingId(row.id);
        try { await userService.validateProfessor(row.id); setRows((prev) => prev.filter((r) => r.id !== row.id)); setViewingRow((prev) => (prev?.id === row.id ? null : prev)); }
        catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la validation."); }
        finally { setActionLoadingId(null); }
      }},
    ]);
  };

  const handleReject = (row: Row) => { setViewingRow(null); setRejectingRow(row); };

  const handleConfirmReject = async (codeErreur: string, motifSupplementaire: string) => {
    if (!rejectingRow) return;
    try { await userService.rejectProfessor(rejectingRow.id, codeErreur, motifSupplementaire || undefined); setRows((prev) => prev.filter((r) => r.id !== rejectingRow.id)); setRejectingRow(null); }
    catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du rejet."); }
  };

  const handleResendActivation = async (row: Row) => {
    if (!row.email) { Alert.alert("Erreur", "Cet utilisateur n'a pas d'adresse email."); return; }
    setActionLoadingId(row.id);
    try { await userService.resendActivationEmail(row.email); Alert.alert("Succès", "Email d'activation renvoyé."); }
    catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de l'envoi."); }
    finally { setActionLoadingId(null); }
  };

  const handleDelete = (row: Row) => {
    Alert.alert("Supprimer", `Voulez-vous vraiment supprimer ${row.name} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try {
          if (activeTab === "professeurs") await professorService.remove(row.id);
          else if (activeTab === "parents") await parentService.remove(row.id);
          else if (activeTab === "eleves") await studentService.remove(row.id);
          else await userService.deleteUser(row.id);
          setRows((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la suppression."); }
      }},
    ]);
  };

  const handleSaveEdit = async (patch: Partial<Row>) => {
    if (!editingRow) return;
    const payload = { prenom: patch.prenom, nom: patch.nom, email: patch.email, telephone: patch.telephone, adresse: patch.adresse, niveau: patch.niveau, matriculeProfesseur: patch.matricule };
    try {
      if (activeTab === "professeurs") await professorService.update(editingRow.id, payload);
      else if (activeTab === "parents") await parentService.update(editingRow.id, payload);
      else if (activeTab === "eleves") await studentService.update(editingRow.id, payload);
      else await userService.updateUser(editingRow.id, payload);
      Alert.alert("Succès", "Utilisateur modifié avec succès."); setEditingRow(null); load();
    } catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la modification."); }
  };

  const showClasses = activeTab !== "pending";
  const activeTabDef = TABS.find((t) => t.id === activeTab);
  const activeGradient = TAB_GRADIENT[activeTab];

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient colors={[colors.heroStart, colors.heroMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Utilisateurs</Text>
          <View style={styles.pageHeaderMeta}>
            <LinearGradient colors={activeGradient} style={styles.tabIndicatorPill}>
              <FontAwesome5 name={activeTabDef?.icon as any} size={10} color={colors.white} />
              <Text style={styles.tabIndicatorText}>{activeTabDef?.label}</Text>
            </LinearGradient>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filteredRows.length}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Horizontal Role Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, isActive && { borderColor: tab.color, borderWidth: 1.5 }]}>
              {isActive ? (
                <LinearGradient colors={TAB_GRADIENT[tab.id]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabGradient}>
                  <FontAwesome5 name={tab.icon as any} size={11} color={colors.white} />
                  <Text style={[styles.tabText, styles.tabTextActive]}>{tab.label}</Text>
                  {tab.id === "pending" && rows.length > 0 ? (
                    <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{rows.length}</Text></View>
                  ) : null}
                </LinearGradient>
              ) : (
                <View style={styles.tabGradient}>
                  <FontAwesome5 name={tab.icon as any} size={11} color={tab.color} />
                  <Text style={styles.tabText}>{tab.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <FontAwesome5 name="search" size={13} color={colors.textMuted} />
          <Input placeholder="Rechercher..." value={searchTerm} onChangeText={setSearchTerm} style={styles.searchInput} />
        </View>
      </View>

      {/* List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
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
                {/* Card top accent */}
                <LinearGradient colors={activeGradient} style={styles.cardTopAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

                {/* Header row */}
                <View style={styles.cardHeader}>
                  <LinearGradient colors={activeGradient} style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(row.name)}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                    <View style={styles.headerMetaRow}>
                      {row.matricule ? <Text style={styles.headerMeta}>#{row.matricule}</Text> : null}
                      {row.email ? <Text style={styles.headerMeta} numberOfLines={1}>{row.email}</Text> : null}
                    </View>
                  </View>
                  {row.etat ? <Badge label={STATUS_LABELS[row.etat.toUpperCase()] ?? row.etat} tone={statusTone(row.etat)} /> : null}
                </View>

                {/* Validation actions */}
                {(awaitingValidation || awaitingEmail) && (
                  <View style={styles.validationRow}>
                    {awaitingValidation ? (
                      <>
                        <Button label="✓ Valider" onPress={() => handleValidate(row)} loading={actionLoadingId === row.id} style={{ flexGrow: 1, backgroundColor: colors.success }} />
                        <Button label="✕ Rejeter" variant="danger" onPress={() => handleReject(row)} style={{ flexGrow: 1 }} />
                      </>
                    ) : (
                      <Button label="Renvoyer l'email d'activation" onPress={() => handleResendActivation(row)} loading={actionLoadingId === row.id} fullWidth />
                    )}
                  </View>
                )}

                {/* Info section */}
                <View style={styles.sectionBox}>
                  <UserSectionHeader icon="address-card" label="Informations" color={activeTabDef?.color ?? colors.primary} />
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
                    <UserSectionHeader icon="school" label="Établissements" color={activeTabDef?.color ?? colors.primary} />
                    {row.etablissementsGeres.map((e, i) => (
                      <View key={i} style={styles.establishmentRow}>
                        <Text style={styles.establishmentName}>{e.nom}</Text>
                        {e.localisation || e.pays ? <Text style={styles.establishmentMeta}>{[e.localisation, e.pays].filter(Boolean).join(", ")}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {activeTab === "parents" ? (
                  <View style={styles.sectionBox}>
                    <UserSectionHeader icon="child" label="Enfants" color={activeTabDef?.color ?? colors.primary} />
                    {row.enfants === undefined ? (
                      <Text style={styles.dimText}>Chargement...</Text>
                    ) : row.enfants.length === 0 ? (
                      <Text style={styles.dimText}>Aucun enfant associé</Text>
                    ) : (
                      <View style={styles.chipRow}>
                        {row.enfants.map((c) => (
                          <View key={c.id} style={styles.classChip}>
                            <Text style={styles.classChipText}>{c.prenom} {c.nom}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}

                {showClasses && (
                  <View style={styles.sectionBox}>
                    <UserSectionHeader icon="chalkboard" label={activeTab === "professeurs" ? "Classes modérées" : "Classes"} color={activeTabDef?.color ?? colors.primary} />
                    {row.classes === undefined ? (
                      <Text style={styles.dimText}>Chargement...</Text>
                    ) : row.classes.length === 0 ? (
                      <Text style={styles.dimText}>Aucune</Text>
                    ) : (
                      <View style={styles.chipRow}>
                        {row.classes.map((cls) => (
                          <View key={cls.id} style={styles.classChip}>
                            <View style={[styles.classDot, { backgroundColor: cls.etat?.toUpperCase() === "ACTIF" ? colors.success : colors.warning }]} />
                            <Text style={styles.classChipText}>{cls.nom}{cls.niveau ? ` · ${cls.niveau}` : ""}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Card actions */}
                <View style={styles.cardActions}>
                  <ActionChip icon="eye" label="Voir" color={colors.primary} onPress={() => setViewingRow(row)} />
                  <ActionChip icon="edit" label="Modifier" color={colors.success} onPress={() => setEditingRow(row)} />
                  <ActionChip icon="trash" label="Supprimer" color={colors.danger} onPress={() => handleDelete(row)} />
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Modals */}
      <RejectMotifSheet row={rejectingRow} onCancel={() => setRejectingRow(null)} onSubmit={handleConfirmReject} />

      <BottomSheet visible={!!viewingRow} onClose={() => setViewingRow(null)} title={viewingRow?.name}>
        {viewingRow ? (
          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            <View style={styles.viewBadgeRow}>
              {viewingRow.etat ? <Badge label={STATUS_LABELS[viewingRow.etat.toUpperCase()] ?? viewingRow.etat} tone={statusTone(viewingRow.etat)} /> : null}
            </View>
            {(() => {
              const { awaitingEmail, awaitingValidation } = getValidationState(viewingRow, activeTab);
              if (!awaitingEmail && !awaitingValidation) return null;
              return (
                <View style={styles.validationRow}>
                  {awaitingValidation ? (
                    <>
                      <Button label="Valider" onPress={() => handleValidate(viewingRow)} loading={actionLoadingId === viewingRow.id} style={{ flexGrow: 1, backgroundColor: colors.success }} />
                      <Button label="Rejeter" variant="danger" onPress={() => handleReject(viewingRow)} style={{ flexGrow: 1 }} />
                    </>
                  ) : (
                    <Button label="Renvoyer l'email d'activation" onPress={() => handleResendActivation(viewingRow)} loading={actionLoadingId === viewingRow.id} fullWidth />
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
                <Text style={styles.viewSectionLabel}>Documents d'identité</Text>
                <View style={styles.documentsRow}>
                  {viewingRow.cniUrlRecto ? <DocumentPreview path={viewingRow.cniUrlRecto} label="CNI Recto" /> : null}
                  {viewingRow.cniUrlVerso ? <DocumentPreview path={viewingRow.cniUrlVerso} label="CNI Verso" /> : null}
                  {viewingRow.selfieUrl ? <DocumentPreview path={viewingRow.selfieUrl} label="Selfie" /> : null}
                </View>
              </View>
            )}
            {viewingRow.etablissementsGeres && viewingRow.etablissementsGeres.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.viewSectionLabel}>Établissements</Text>
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
                <Text style={styles.viewSectionLabel}>Enfants</Text>
                <View style={styles.chipRow}>
                  {viewingRow.enfants.map((c) => (
                    <View key={c.id} style={styles.classChip}>
                      <Text style={styles.classChipText}>{c.prenom} {c.nom}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {viewingRow.classes && viewingRow.classes.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.viewSectionLabel}>Classes</Text>
                <View style={styles.chipRow}>
                  {viewingRow.classes.map((cls) => (
                    <View key={cls.id} style={styles.classChip}>
                      <Text style={styles.classChipText}>{cls.nom}{cls.niveau ? ` · ${cls.niveau}` : ""}</Text>
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

// ── Sub-components ────────────────────────────────────────────────────────────
const UserSectionHeader = ({ icon, label, color }: { icon: any; label: string; color: string }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.sectionHeaderRow}>
    <View style={[styles.sectionHeaderIcon, { backgroundColor: `${color}18` }]}>
      <FontAwesome5 name={icon} size={9} color={color} />
    </View>
    <Text style={[styles.sectionHeaderText, { color }]}>{label}</Text>
  </View>
  );
};

const InfoLine = ({ icon, text }: { icon: any; text: string }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.infoRow}>
    <FontAwesome5 name={icon} size={11} color={colors.textMuted} />
    <Text style={styles.infoText}>{text}</Text>
  </View>
  );
};

const ViewRow = ({ icon, label, value }: { icon: any; label: string; value?: string }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!value) return null;
  return (
    <View style={styles.viewRow}>
      <FontAwesome5 name={icon} size={13} color={colors.textMuted} style={{ width: 20 }} />
      <Text style={styles.viewLabel}>{label}</Text>
      <Text style={styles.viewValue} numberOfLines={2}>{value}</Text>
    </View>
  );
};

const ActionChip = ({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <TouchableOpacity style={[styles.actionChip, { borderColor: `${color}30`, backgroundColor: `${color}10` }]} onPress={onPress} activeOpacity={0.7}>
    <FontAwesome5 name={icon} size={11} color={color} />
    <Text style={[styles.actionChipText, { color }]}>{label}</Text>
  </TouchableOpacity>
  );
};

// ── EditUserSheet ─────────────────────────────────────────────────────────────
interface EditUserSheetProps { row: Row | null; activeTab: RoleTab; onClose: () => void; onSave: (patch: Partial<Row>) => void | Promise<void>; }

const EditUserSheet = ({ row, activeTab, onClose, onSave }: EditUserSheetProps) => {
  const [prenom, setPrenom] = useState(""); const [nom, setNom] = useState(""); const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState(""); const [adresse, setAdresse] = useState("");
  const [niveau, setNiveau] = useState(""); const [matricule, setMatricule] = useState(""); const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row) return;
    setPrenom(row.prenom); setNom(row.nom); setEmail(row.email);
    setTelephone(row.telephone ?? ""); setAdresse(row.adresse ?? "");
    setNiveau(row.niveau ?? ""); setMatricule(row.matricule ?? "");
  }, [row]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await onSave({ prenom: prenom.trim(), nom: nom.trim(), email: email.trim(), telephone: telephone.trim(), adresse: adresse.trim(), niveau: niveau.trim(), matricule: matricule.trim() }); }
    finally { setSubmitting(false); }
  };

  return (
    <BottomSheet visible={!!row} onClose={onClose} title={`Modifier — ${row?.name ?? ""}`}>
      <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
        <Input label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Prénom" />
        <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Nom" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Téléphone" value={telephone} onChangeText={setTelephone} placeholder="Téléphone" keyboardType="phone-pad" />
        {activeTab === "eleves" ? <Input label="Niveau" value={niveau} onChangeText={setNiveau} placeholder="Ex: 3ème" /> : null}
        {activeTab === "professeurs" || activeTab === "pending" ? <Input label="Matricule" value={matricule} onChangeText={setMatricule} placeholder="Matricule" /> : null}
        {activeTab !== "eleves" && activeTab !== "professeurs" && activeTab !== "pending" ? <Input label="Adresse" value={adresse} onChangeText={setAdresse} placeholder="Adresse" /> : null}
        <Button label="Enregistrer" onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
      </ScrollView>
    </BottomSheet>
  );
};

// ── RejectMotifSheet ──────────────────────────────────────────────────────────
interface RejectMotifSheetProps { row: Row | null; onCancel: () => void; onSubmit: (codeErreur: string, motifSupplementaire: string) => void | Promise<void>; }

const RejectMotifSheet = ({ row, onCancel, onSubmit }: RejectMotifSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [motifs, setMotifs] = useState<RejectionMotif[]>([]); const [loadingMotifs, setLoadingMotifs] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null); const [supplement, setSupplement] = useState(""); const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row) return; setSelectedCode(null); setSupplement(""); setLoadingMotifs(true);
    rejectionService.getAll().then(setMotifs).catch(() => setMotifs([])).finally(() => setLoadingMotifs(false));
  }, [row]);

  const handleSubmit = async () => {
    if (!selectedCode) return; setSubmitting(true);
    try { await onSubmit(selectedCode, supplement.trim()); } finally { setSubmitting(false); }
  };

  return (
    <BottomSheet visible={!!row} onClose={onCancel} title={`Rejeter — ${row?.name ?? ""}`}>
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>Motif de rejet <Text style={{ color: colors.danger }}>*</Text></Text>
        {loadingMotifs ? <LoadingSpinner label="Chargement des motifs..." /> : motifs.length === 0 ? (
          <Text style={styles.dimText}>Aucun motif disponible.</Text>
        ) : (
          motifs.map((m) => {
            const selected = selectedCode === m.code;
            return (
              <TouchableOpacity key={m.id} style={[styles.motifRow, selected && styles.motifRowActive]} onPress={() => setSelectedCode(m.code ?? null)}>
                <View style={[styles.motifRadio, selected && styles.motifRadioActive]}>
                  {selected && <View style={styles.motifRadioDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.motifCode, selected && { color: colors.danger }]}>{m.code}</Text>
                  {m.descriptif ? <Text style={styles.motifDescriptif}>{m.descriptif}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <Input label="Motif supplémentaire (optionnel)" value={supplement} onChangeText={setSupplement} placeholder="Précisez si nécessaire..." multiline numberOfLines={3} style={{ height: 80, textAlignVertical: "top" }} />
        <Button label="Rejeter" variant="danger" onPress={handleSubmit} loading={submitting} disabled={!selectedCode} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
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
    backgroundColor: colors.heroStart,
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl,
    marginBottom: 14, ...shadow.hero,
  },
  headerLeft: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  pageHeaderMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  tabIndicatorPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  tabIndicatorText: { fontSize: 11, fontWeight: "700", color: colors.white },
  countBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeText: { fontSize: 12, fontWeight: "700", color: colors.white },
  // Tabs
  tabsScroll: { flexGrow: 0, marginBottom: 10 },
  tab: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  tabGradient: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surface },
  tabText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  tabTextActive: { color: colors.white },
  tabBadge: { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center" },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: colors.white },
  // Search
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingLeft: 12, ...shadow.sm },
  searchInput: { flex: 1, borderWidth: 0, shadowOpacity: 0, backgroundColor: "transparent" },
  list: { flex: 1, paddingHorizontal: 16 },
  errorBox: { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  // User card
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: 14, overflow: "hidden", ...shadow.card },
  cardTopAccent: { height: 4 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, paddingBottom: 0 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "800", fontSize: 18 },
  name: { ...typography.h3, color: colors.text },
  headerMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 },
  headerMeta: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  validationRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, margin: spacing.md, marginTop: spacing.md },
  // Sections
  sectionBox: { marginHorizontal: spacing.md, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xs },
  sectionHeaderIcon: { width: 18, height: 18, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  sectionHeaderText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
  infoText: { ...typography.caption, color: colors.text },
  docBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  dimText: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", paddingTop: 4 },
  establishmentRow: { marginTop: 4 },
  establishmentName: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  establishmentMeta: { ...typography.caption, color: colors.textMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingTop: 2 },
  classChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceElevated, borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  classDot: { width: 6, height: 6, borderRadius: 3 },
  classChipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  // Card actions
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, margin: spacing.md, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  actionChipText: { fontSize: 11, fontWeight: "700" },
  // View modal
  viewBadgeRow: { flexDirection: "row", marginBottom: spacing.md },
  viewRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: spacing.sm },
  viewLabel: { ...typography.caption, color: colors.textMuted, width: 90 },
  viewValue: { ...typography.body, color: colors.text, flex: 1 },
  viewSectionLabel: { ...typography.captionBold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  documentsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  // Reject modal
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  motifRow: { flexDirection: "row", alignItems: "flex-start", padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  motifRowActive: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  motifRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
  motifRadioActive: { borderColor: colors.danger },
  motifRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  motifCode: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  motifDescriptif: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

export default AdminUsersBody;
