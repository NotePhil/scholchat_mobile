import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, Button, DropdownField, EmptyState, Input, LoadingSpinner } from "../../../components/ui";
import PaymentModal from "../../../components/common/PaymentModal";
import { colors, radius, shadow, spacing, typography, useThemeColors } from "../../../styles/theme";
import { establishmentService, offerService } from "../../../services/api";
import { Etablissement, Offre } from "../../../types";
import EstablishmentDetails from "../../establishment/EstablishmentDetails";
import { CreateEstablishmentSheet } from "./CreateEstablishmentSheet";

// LinearGradient with safe fallback
let LinearGradient: any;
try { LinearGradient = require("expo-linear-gradient").LinearGradient; } catch { LinearGradient = ({ children, style }: any) => <View style={style}>{children}</View>; }

/** Mirrors web's OfferService.calculerReduction() exactly. */
const calculerReduction = (offre: Offre | null): number | null => {
  if (!offre) return null;
  const o = offre as any;
  if (o.reductionAnnuellePourcentage != null) return o.reductionAnnuellePourcentage;
  if (!o.prixMensuel || !o.prixAnnuel || !o.dureeMensuelleMinutes || !o.dureeAnnuelleMinutes) return null;
  const moisEquivalents = o.dureeAnnuelleMinutes / o.dureeMensuelleMinutes;
  const prixMensualiseSurAnnee = o.prixMensuel * moisEquivalents;
  if (prixMensualiseSurAnnee <= 0) return null;
  return 1 - o.prixAnnuel / prixMensualiseSurAnnee;
};

type Segment = "etablissements" | "offres";

interface AdminSchoolsBodyProps {
  initialSegment?: Segment;
  autoCreate?: boolean;
}

const AdminSchoolsBody = ({ initialSegment = "etablissements", autoCreate }: AdminSchoolsBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(!!autoCreate);
  const [managedEstId, setManagedEstId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingEstablishment, setEditingEstablishment] = useState<Etablissement | null>(null);
  const [editingOffre, setEditingOffre] = useState<Offre | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (segment === "etablissements") setEstablishments(await establishmentService.getAll());
      else setOffres(await offerService.list(undefined, true));
    } catch (err) { setError(err instanceof Error ? err.message : "Échec du chargement."); }
    finally { setLoading(false); }
  }, [segment]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSegment(initialSegment); }, [initialSegment]);
  useEffect(() => { if (autoCreate) setShowCreate(true); }, [autoCreate]);

  if (managedEstId) return <EstablishmentDetails establishmentId={managedEstId} onBack={() => setManagedEstId(null)} />;

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient colors={[colors.heroStart, colors.heroMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Écoles & Config</Text>
          <Text style={styles.pageSubtitle}>
            {segment === "etablissements" ? `${establishments.length} établissements` : `${offres.length} offres`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addFab}>
          <FontAwesome5 name="plus" size={16} color={colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Segment Tabs */}
      <View style={styles.segmentRow}>
        {([
          { id: "etablissements", label: "Établissements", icon: "school" },
          { id: "offres", label: "Offres", icon: "tags" },
        ] as { id: Segment; label: string; icon: any }[]).map((seg) => (
          <TouchableOpacity key={seg.id} style={[styles.segmentTab, segment === seg.id && styles.segmentTabActive]} onPress={() => setSegment(seg.id)}>
            {segment === seg.id ? (
              <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.segmentGradient}>
                <FontAwesome5 name={seg.icon} size={12} color={colors.white} />
                <Text style={[styles.segmentText, styles.segmentTextActive]}>{seg.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.segmentGradient}>
                <FontAwesome5 name={seg.icon} size={12} color={colors.textMuted} />
                <Text style={styles.segmentText}>{seg.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {segment === "etablissements" && (
        <View style={styles.searchWrap}>
          <View style={styles.searchRow}>
            <FontAwesome5 name="search" size={13} color={colors.textMuted} />
            <Input placeholder="Rechercher un établissement..." value={searchTerm} onChangeText={setSearchTerm} style={styles.searchInput} />
          </View>
        </View>
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : segment === "etablissements" ? (
          (() => {
            const term = searchTerm.trim().toLowerCase();
            const filtered = term
              ? establishments.filter((e) =>
                  (e.nom ?? "").toLowerCase().includes(term) ||
                  (e.localisation ?? "").toLowerCase().includes(term) ||
                  (e.pays ?? "").toLowerCase().includes(term) ||
                  (e.email ?? "").toLowerCase().includes(term)
                )
              : establishments;
            return filtered.length === 0 ? (
              <EmptyState icon="school" title={term ? "Aucun résultat" : "Aucun établissement"} />
            ) : (
              filtered.map((e) => (
                <TouchableOpacity key={e.id} activeOpacity={0.85} onPress={() => setManagedEstId(e.id)} style={styles.estCard}>
                  {/* Left accent */}
                  <LinearGradient colors={["#6366F1", "#4338CA"]} style={styles.estCardAccent} />

                  <View style={styles.estCardBody}>
                    {/* Icon + name */}
                    <View style={styles.estCardHeader}>
                      <LinearGradient colors={["#6366F1", "#4338CA"]} style={styles.estIcon}>
                        <FontAwesome5 name="school" size={14} color={colors.white} />
                      </LinearGradient>
                      <View style={styles.estNameWrap}>
                        <Text style={styles.estCardTitle} numberOfLines={1}>{e.nom ?? "Établissement"}</Text>
                        {(e as any).expireParOffre ? <Badge label="Offre expirée" tone="danger" /> : null}
                      </View>
                    </View>

                    {/* Info rows */}
                    <View style={styles.estInfoGrid}>
                      {e.localisation ? <EstInfoPill icon="map-marker-alt" text={e.localisation} /> : null}
                      {e.pays ? <EstInfoPill icon="globe" text={e.pays} /> : null}
                      {e.email ? <EstInfoPill icon="envelope" text={e.email} /> : null}
                      {e.telephone ? <EstInfoPill icon="phone" text={e.telephone} /> : null}
                    </View>

                    {/* Feature badges */}
                    {(e.optionEnvoiMailNewClasse || e.optionTokenGeneral) && (
                      <View style={styles.estBadgeRow}>
                        {e.optionEnvoiMailNewClasse ? <Badge label="Email Classes" tone="success" /> : null}
                        {e.optionTokenGeneral ? <Badge label="Code Unique" tone="info" /> : null}
                      </View>
                    )}

                    {/* Actions */}
                    <View style={styles.estActions}>
                      <ActionChip icon="eye" label="Voir" color={colors.primary} onPress={() => setManagedEstId(e.id)} />
                      <ActionChip icon="edit" label="Modifier" color={colors.success} onPress={() => setEditingEstablishment(e)} />
                      <ActionChip icon="trash" label="Supprimer" color={colors.danger} onPress={() =>
                        Alert.alert("Supprimer", `Supprimer "${e.nom}" ?`, [
                          { text: "Annuler", style: "cancel" },
                          { text: "Supprimer", style: "destructive", onPress: async () => {
                            try { await establishmentService.remove(e.id); setEstablishments((prev) => prev.filter((x) => x.id !== e.id)); }
                            catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec."); }
                          }},
                        ])
                      } />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            );
          })()
        ) : offres.length === 0 ? (
          <EmptyState icon="tags" title="Aucune offre" />
        ) : (
          offres.map((o) => {
            const isEtab = o.cible === "ETABLISSEMENT";
            const reduction = calculerReduction(o);
            return (
              <View key={o.id} style={styles.offreCard}>
                <LinearGradient colors={isEtab ? ["#6366F1", "#4338CA"] : ["#10B981", "#059669"]} style={styles.offreAccent} />
                <View style={styles.offreBody}>
                  {/* Header */}
                  <View style={styles.offreHeader}>
                    <LinearGradient colors={isEtab ? ["#6366F1", "#4338CA"] : ["#10B981", "#059669"]} style={styles.offreIcon}>
                      <FontAwesome5 name={isEtab ? "school" : "chalkboard"} size={13} color={colors.white} />
                    </LinearGradient>
                    <View style={styles.offreNameWrap}>
                      <Text style={styles.offreTitle} numberOfLines={1}>{o.nom ?? "Offre"}</Text>
                      <Text style={styles.offreCible}>{isEtab ? "Établissement" : "Classe indépendante"}</Text>
                    </View>
                    <View style={styles.offreBadges}>
                      {(o as any).estTest ? <Badge label="TEST" tone="warning" /> : null}
                      <Badge label={o.actif ? "Active" : "Désactivée"} tone={o.actif ? "success" : "neutral"} />
                    </View>
                  </View>

                  {/* Pricing */}
                  <View style={styles.pricingRow}>
                    <PricingBlock label="Mensuel" price={o.prixMensuel} duration={(o as any).dureeMensuelleMinutes} />
                    <View style={styles.pricingDivider} />
                    <PricingBlock label="Annuel" price={o.prixAnnuel} duration={(o as any).dureeAnnuelleMinutes} />
                    {reduction != null && reduction > 0 ? (
                      <View style={styles.reductionBadge}>
                        <Text style={styles.reductionText}>-{Math.round(reduction * 100)}%</Text>
                      </View>
                    ) : null}
                  </View>

                  {isEtab && (o as any).nombreClassesInclues != null ? (
                    <View style={styles.quotaRow}>
                      <FontAwesome5 name="layer-group" size={11} color={colors.primary} />
                      <Text style={styles.quotaText}>
                        Quota: {(o as any).nombreClassesInclues}{(o as any).classesBonus ? ` +${(o as any).classesBonus} bonus` : ""} classes
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.estActions}>
                    <ActionChip icon="edit" label="Modifier" color={colors.success} onPress={() => setEditingOffre(o)} />
                    {o.actif ? (
                      <ActionChip icon="ban" label="Désactiver" color={colors.danger} onPress={() =>
                        Alert.alert("Désactiver", `Désactiver l'offre "${o.nom}" ?`, [
                          { text: "Annuler", style: "cancel" },
                          { text: "Désactiver", style: "destructive", onPress: async () => {
                            try { await offerService.deactivate(o.id); load(); }
                            catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : "Échec."); }
                          }},
                        ])
                      } />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      {segment === "etablissements" ? (
        <CreateEstablishmentSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      ) : (
        <CreateOfferSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      <CreateEstablishmentSheet visible={!!editingEstablishment} onClose={() => setEditingEstablishment(null)} onCreated={load} editingEstablishment={editingEstablishment} />
      <CreateOfferSheet visible={!!editingOffre} onClose={() => setEditingOffre(null)} onCreated={load} editingOffre={editingOffre} />
    </View>
  );
};

const EstInfoPill = ({ icon, text }: { icon: any; text: string }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.infoPill}>
    <FontAwesome5 name={icon} size={9} color={colors.primary} />
    <Text style={styles.infoPillText} numberOfLines={1}>{text}</Text>
  </View>
  );
};

const PricingBlock = ({ label, price, duration }: { label: string; price?: any; duration?: any }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.pricingBlock}>
    <Text style={styles.pricingLabel}>{label}</Text>
    <Text style={styles.pricingPrice}>
      {price != null ? `${Number(price).toLocaleString("fr-FR")} FCFA` : "—"}
    </Text>
    {duration ? <Text style={styles.pricingDuration}>{duration} min</Text> : null}
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

// ── CreateOfferSheet (unchanged logic, refreshed styles) ────────────────────
export interface CreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  editingOffre?: Offre | null;
}

const DUREE_PRESETS = [{ label: "1 mois", minutes: 30 * 24 * 60 }, { label: "1 an", minutes: 365 * 24 * 60 }, { label: "2 ans", minutes: 2 * 365 * 24 * 60 }, { label: "Test 3min", minutes: 3 }];
const DELAI_RAPPEL_PRESETS = [{ label: "2 jours", minutes: 2 * 24 * 60 }, { label: "7 jours", minutes: 7 * 24 * 60 }, { label: "Test 1min", minutes: 1 }];
const DELAI_SUPPRESSION_PRESETS = [{ label: "3 jours", minutes: 3 * 24 * 60 }, { label: "14 jours", minutes: 14 * 24 * 60 }, { label: "Test 2min", minutes: 2 }];
const toNumOrUndef = (v: string) => (v.trim() === "" ? undefined : Number(v));

const CreateOfferSheet = ({ visible, onClose, onCreated, editingOffre }: CreateSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEditMode = !!editingOffre;
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [cible, setCible] = useState<"CLASSE" | "ETABLISSEMENT">("CLASSE");
  const [estTest, setEstTest] = useState(false);
  const [actif, setActif] = useState(true);
  const [prixMensuel, setPrixMensuel] = useState("");
  const [dureeMensuelleMinutes, setDureeMensuelleMinutes] = useState("");
  const [prixAnnuel, setPrixAnnuel] = useState("");
  const [dureeAnnuelleMinutes, setDureeAnnuelleMinutes] = useState("");
  const [delaiRappelSuppressionMinutes, setDelaiRappelSuppressionMinutes] = useState("");
  const [delaiSuppressionMinutes, setDelaiSuppressionMinutes] = useState("");
  const [elevesMax, setElevesMax] = useState("");
  const [stockageMaxGo, setStockageMaxGo] = useState("");
  const [messagerieIncluse, setMessagerieIncluse] = useState(false);
  const [nombreClassesInclues, setNombreClassesInclues] = useState("");
  const [classesBonus, setClassesBonus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const o = editingOffre as any;
    setNom(o?.nom ?? ""); setDescription(o?.description ?? ""); setCible(o?.cible === "ETABLISSEMENT" ? "ETABLISSEMENT" : "CLASSE");
    setEstTest(!!o?.estTest); setActif(o ? !!o.actif : true);
    setPrixMensuel(o?.prixMensuel != null ? String(o.prixMensuel) : "");
    setDureeMensuelleMinutes(o?.dureeMensuelleMinutes != null ? String(o.dureeMensuelleMinutes) : "");
    setPrixAnnuel(o?.prixAnnuel != null ? String(o.prixAnnuel) : "");
    setDureeAnnuelleMinutes(o?.dureeAnnuelleMinutes != null ? String(o.dureeAnnuelleMinutes) : "");
    setDelaiRappelSuppressionMinutes(o?.delaiRappelSuppressionMinutes != null ? String(o.delaiRappelSuppressionMinutes) : "");
    setDelaiSuppressionMinutes(o?.delaiSuppressionMinutes != null ? String(o.delaiSuppressionMinutes) : "");
    setElevesMax(o?.elevesMax != null ? String(o.elevesMax) : "");
    setStockageMaxGo(o?.stockageMaxGo != null ? String(o.stockageMaxGo) : "");
    setMessagerieIncluse(!!o?.messagerieIncluse);
    setNombreClassesInclues(o?.nombreClassesInclues != null ? String(o.nombreClassesInclues) : "");
    setClassesBonus(o?.classesBonus != null ? String(o.classesBonus) : "");
  }, [visible, editingOffre]);

  const reduction = (() => {
    if (!prixMensuel || !prixAnnuel || !dureeMensuelleMinutes || !dureeAnnuelleMinutes) return null;
    const pm = Number(prixMensuel), pa = Number(prixAnnuel), dm = Number(dureeMensuelleMinutes), da = Number(dureeAnnuelleMinutes);
    if (!pm || !pa || !dm || !da) return null;
    const moisEquivalents = da / dm;
    const prixMensualiseSurAnnee = pm * moisEquivalents;
    if (prixMensualiseSurAnnee <= 0) return null;
    return 1 - pa / prixMensualiseSurAnnee;
  })();

  const handleSubmit = async () => {
    if (!nom.trim()) { Alert.alert("Erreur", "Le nom est obligatoire."); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nom: nom.trim(), description: description.trim() || undefined, cible,
        prixMensuel: toNumOrUndef(prixMensuel), dureeMensuelleMinutes: toNumOrUndef(dureeMensuelleMinutes),
        prixAnnuel: toNumOrUndef(prixAnnuel), dureeAnnuelleMinutes: toNumOrUndef(dureeAnnuelleMinutes),
        nombreClassesInclues: cible === "ETABLISSEMENT" ? toNumOrUndef(nombreClassesInclues) : undefined,
        classesBonus: cible === "ETABLISSEMENT" ? toNumOrUndef(classesBonus) : undefined,
        estTest, actif,
        delaiRappelSuppressionMinutes: toNumOrUndef(delaiRappelSuppressionMinutes),
        delaiSuppressionMinutes: toNumOrUndef(delaiSuppressionMinutes),
        elevesMax: toNumOrUndef(elevesMax), stockageMaxGo: toNumOrUndef(stockageMaxGo), messagerieIncluse,
      };
      if (isEditMode && editingOffre) { await offerService.update(editingOffre.id, payload); Alert.alert("Succès", "Offre modifiée avec succès."); }
      else { await offerService.create(payload); Alert.alert("Succès", "Offre créée avec succès."); }
      onCreated(); onClose();
    } catch (err) { Alert.alert("Erreur", err instanceof Error ? err.message : `Échec de ${isEditMode ? "la modification" : "la création"}.`); }
    finally { setSubmitting(false); }
  };

  const PresetRow = ({ presets, onPick }: { presets: { label: string; minutes: number }[]; onPick: (m: string) => void }) => (
    <View style={styles.chipRow}>
      {presets.map((p) => (
        <TouchableOpacity key={p.label} style={styles.presetChip} onPress={() => onPick(String(p.minutes))}>
          <Text style={styles.presetChipText}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const ToggleRow = ({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) => (
    <TouchableOpacity style={styles.optionRow} onPress={onToggle}>
      <View style={[styles.toggleBox, checked && styles.toggleBoxActive]}>
        {checked && <FontAwesome5 name="check" size={10} color={colors.white} />}
      </View>
      <Text style={styles.optionText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEditMode ? "Modifier l'offre" : "Nouvelle offre"}>
      <ScrollView style={{ maxHeight: 580 }} showsVerticalScrollIndicator={false}>
        <Input label="Nom de l'offre *" value={nom} onChangeText={setNom} placeholder="Nom de l'offre" />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Description" multiline numberOfLines={2} style={{ height: 60, textAlignVertical: "top" }} />
        <DropdownField label="Cible" value={cible} options={[{ label: "Classe indépendante", value: "CLASSE" }, { label: "Établissement", value: "ETABLISSEMENT" }]} onChange={(v) => setCible(v as "CLASSE" | "ETABLISSEMENT")} />
        <View style={styles.optionsBox}>
          <ToggleRow checked={estTest} onToggle={() => setEstTest((v) => !v)} label='Offre de test (badge "TEST")' />
          <ToggleRow checked={actif} onToggle={() => setActif((v) => !v)} label="Active" />
        </View>
        <Text style={styles.sectionTitle}>Périodicité mensuelle</Text>
        <Input label="Prix mensuel (FCFA)" value={prixMensuel} onChangeText={setPrixMensuel} placeholder="0" keyboardType="numeric" />
        <Input label="Durée (minutes)" value={dureeMensuelleMinutes} onChangeText={setDureeMensuelleMinutes} placeholder="0" keyboardType="numeric" />
        <PresetRow presets={DUREE_PRESETS} onPick={setDureeMensuelleMinutes} />
        <Text style={styles.sectionTitle}>Périodicité annuelle (optionnelle)</Text>
        <Input label="Prix annuel (FCFA)" value={prixAnnuel} onChangeText={setPrixAnnuel} placeholder="0" keyboardType="numeric" />
        <Input label="Durée (minutes)" value={dureeAnnuelleMinutes} onChangeText={setDureeAnnuelleMinutes} placeholder="0" keyboardType="numeric" />
        <PresetRow presets={DUREE_PRESETS} onPick={setDureeAnnuelleMinutes} />
        {reduction != null && reduction > 0 && (
          <View style={styles.reductionBox}>
            <FontAwesome5 name="tag" size={13} color={colors.success} />
            <Text style={styles.reductionBoxText}>Réduction annuelle : {Math.round(reduction * 100)}%</Text>
          </View>
        )}
        <Text style={styles.sectionTitle}>Purge automatique après expiration</Text>
        <Text style={styles.offreHint}>Laissez vide pour désactiver la purge automatique sur cette offre.</Text>
        <Input label="Rappel de suppression (min après expiration)" value={delaiRappelSuppressionMinutes} onChangeText={setDelaiRappelSuppressionMinutes} placeholder="0" keyboardType="numeric" />
        <PresetRow presets={DELAI_RAPPEL_PRESETS} onPick={setDelaiRappelSuppressionMinutes} />
        <Input label="Suppression définitive (min après expiration)" value={delaiSuppressionMinutes} onChangeText={setDelaiSuppressionMinutes} placeholder="0" keyboardType="numeric" />
        <PresetRow presets={DELAI_SUPPRESSION_PRESETS} onPick={setDelaiSuppressionMinutes} />
        <Text style={styles.sectionTitle}>Restrictions (informatif)</Text>
        <Input label="Élèves max" value={elevesMax} onChangeText={setElevesMax} placeholder="0" keyboardType="numeric" />
        <Input label="Stockage max (Go)" value={stockageMaxGo} onChangeText={setStockageMaxGo} placeholder="0" keyboardType="numeric" />
        <ToggleRow checked={messagerieIncluse} onToggle={() => setMessagerieIncluse((v) => !v)} label="Messagerie incluse" />
        {cible === "ETABLISSEMENT" && (
          <>
            <Text style={styles.sectionTitle}>Quota de classes (établissement)</Text>
            <Input label="Nombre de classes incluses" value={nombreClassesInclues} onChangeText={setNombreClassesInclues} placeholder="0" keyboardType="numeric" />
            <Input label="Classes bonus offertes" value={classesBonus} onChangeText={setClassesBonus} placeholder="0" keyboardType="numeric" />
          </>
        )}
        <Button label={isEditMode ? "Enregistrer" : "Créer l'offre"} onPress={handleSubmit} loading={submitting} fullWidth style={{ marginTop: spacing.md, marginBottom: spacing.lg }} />
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
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl,
    marginBottom: 16, ...shadow.hero,
  },
  headerLeft: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  addFab: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", ...shadow.sm },
  // Segment
  segmentRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  segmentTab: { flex: 1, borderRadius: radius.lg, overflow: "hidden", ...shadow.sm },
  segmentTabActive: { ...shadow.card },
  segmentGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surface },
  segmentText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  segmentTextActive: { color: colors.white },
  // Search
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingLeft: 12, gap: 8, ...shadow.sm },
  searchInput: { flex: 1, borderWidth: 0, shadowOpacity: 0, backgroundColor: "transparent" },
  list: { flex: 1, paddingHorizontal: 16 },
  errorBox: { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  // Establishment card
  estCard: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: 12, overflow: "hidden", ...shadow.card },
  estCardAccent: { width: 4 },
  estCardBody: { flex: 1, padding: spacing.md },
  estCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  estIcon: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  estNameWrap: { flex: 1, gap: 3 },
  estCardTitle: { ...typography.h4, color: colors.text },
  estInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  infoPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  infoPillText: { fontSize: 10, fontWeight: "600", color: colors.primary, maxWidth: 130 },
  estBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  estActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  actionChipText: { fontSize: 11, fontWeight: "700" },
  // Offer card
  offreCard: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: 12, overflow: "hidden", ...shadow.card },
  offreAccent: { width: 4 },
  offreBody: { flex: 1, padding: spacing.md },
  offreHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  offreIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  offreNameWrap: { flex: 1 },
  offreTitle: { ...typography.h4, color: colors.text },
  offreCible: { fontSize: 10, color: colors.textMuted, fontWeight: "600", marginTop: 1 },
  offreBadges: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  pricingRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: spacing.sm, marginBottom: 10 },
  pricingBlock: { flex: 1, alignItems: "center" },
  pricingLabel: { fontSize: 9, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  pricingPrice: { fontSize: 13, fontWeight: "800", color: colors.text, marginTop: 2 },
  pricingDuration: { fontSize: 10, color: colors.textMuted },
  pricingDivider: { width: 1, height: 36, backgroundColor: colors.border },
  reductionBadge: { backgroundColor: colors.successLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  reductionText: { fontSize: 11, fontWeight: "800", color: colors.successDark },
  quotaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  quotaText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  // Sheet internals
  optionsBox: { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: 4 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  toggleBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  toggleBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  sectionTitle: { ...typography.bodyBold, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  presetChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.primaryLight },
  presetChipText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  offreHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  reductionBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm },
  reductionBoxText: { fontSize: 13, fontWeight: "700", color: colors.successDark },
});

export default AdminSchoolsBody;
