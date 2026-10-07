import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Share,
  Animated,
  Easing,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ClassCard from "./ClassCard";
import AccessRequestModal, { AccessRequestRole } from "./AccessRequestModal";
import ClassDetails from "./ClassDetails";
import { classService } from "../../../../services/classService";
import {
  accederService,
  classAdminService,
  coursProgrammerService,
  establishmentService,
  offerService,
  publicationRightsService,
} from "../../../../services/api";
import { PaymentInfo } from "../../../../services/api/contratService";
import PaymentModal from "../../../../components/common/PaymentModal";
import { BottomSheet, LoadingSpinner } from "../../../../components/ui";
import { useUser } from "../../../../context/UserContext";
import { ClassEntity, ClassUser, Etablissement, Offre, Professor } from "../../../../types";
import { useUiStore } from "../../../../store/useUiStore";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { formatDate } from "../../../../utils/dates";
import { TranslationKey, translate, useT } from "../../../../i18n";

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

export interface FormattedStudent {
  id: string;
  name: string;
  email: string;
  niveau: string;
  dateCreation?: string;
  etat?: string;
}

export interface FormattedParent {
  id: string;
  name: string;
  phone: string;
  adresse?: string;
  dateCreation?: string;
  etat?: string;
}

export interface FormattedAccessRequest {
  id: string;
  name: string;
  role: string;
  date: string;
  status: string;
}

export interface UIClass {
  id: string;
  name: string;
  level: string;
  state: string;
  /** Raw backend etat (ACTIF / INACTIF / EN_ATTENTE_APPROBATION / ...) — `state` only keeps ACTIVE/INACTIVE. */
  etat?: string;
  matiere?: string;
  studentsCount: number;
  parentsCount: number;
  professeursCount?: number;
  othersCount?: number;
  creationDate: string;
  description: string;
  etablissement: string;
  moderator: string;
  teacherRights: string;
  /** Join/invite code shown to students & parents — the single most important field on this screen, easy to miss since it isn't part of the class name/level. */
  codeActivation?: string;
  /** Raw backend enum (TOUS/MODERATEUR_SEULEMENT/PARENTS_ET_MODERATEUR/PROFESSEURS_SEULEMENT) — mapped to a label in the UI, mirrors web's getPublicationRightsTag(). */
  droitPublication?: string;
  accesMajeur?: boolean;
  students: FormattedStudent[];
  parents: FormattedParent[];
  /** typeUtilisateur === PROFESSEUR/REPETITEUR — kept separate from `others` (misc UTILISATEUR accounts: gestionnaires/admins/plain), matching web's distinct "Professeurs" vs "Utilisateurs" tabs. */
  professeurs?: ClassUser[];
  others?: ClassUser[];
  accessRequests: FormattedAccessRequest[];
  etablissementDetails?: Etablissement;
  moderatorDetails?: Professor;
  /**
   * Caller's role on the class — same buckets as web's "Mes classes" (ManageClassContent/ManageClassList):
   * created (backend role CREATEUR), moderator (MODERATEUR: main or co-moderator), publication
   * (PUBLICATION: granted right), member (access only). Undefined outside the professor list.
   */
  classRole?: ClassRole;
  /** "Par : <name>" on classes the user didn't create — the class CREATOR's name (backend creatorNom). */
  grantedBy?: string;
  /** "Modérateur : <name>" when the main moderator is neither the creator nor the current user. */
  moderatorName?: string;
}

export type ClassRole = "created" | "moderator" | "publication" | "member";

/** Managers (created/moderator) may see the class's access requests; others get 403 from the server. */
export const isManagerRole = (r?: ClassRole) => r === "created" || r === "moderator";

/**
 * Fetches everything ClassDetails' Professeurs/Élèves/Parents/Utilisateurs/
 * Demandes tabs need (members, access requests, moderator, establishment)
 * for one class, on demand. Shared by every screen that opens ClassDetails
 * (this list, admin's AdminClassesBody and gestionnaire's
 * EstablishmentClassesBody).
 */
export const enrichClassForDetails = async (
  cls: ClassEntity,
  opts: { loadAccessRequests?: boolean } = {}
): Promise<UIClass> => {
  // GET /acceder/classes/{id}/demandes is reserved to class managers (403 otherwise): skip it for
  // publishers / members.
  const withRequests = opts.loadAccessRequests !== false;
  const [classDetails, accessRequests, classUsers] = await Promise.all([
    classService.getClassDetails(cls.id),
    withRequests ? classService.getClassAccessRequests(cls.id).catch(() => []) : Promise.resolve([]),
    classService.getClassUsers(cls.id).catch(() => []),
  ]);

  // GET /acceder/classes/{id}/utilisateurs returns UtilisateurSimpleDto — the
  // discriminator is `typeUtilisateur` (uppercase), not `type`/`admin` (neither
  // field exists on this endpoint's response).
  const students = classUsers.filter((u) => u.typeUtilisateur === "ELEVE");
  const parents = classUsers.filter((u) => u.typeUtilisateur === "PARENT");
  const professeurs = classUsers.filter((u) => u.typeUtilisateur === "PROFESSEUR" || u.typeUtilisateur === "REPETITEUR");
  const others = classUsers.filter((u) => u.typeUtilisateur === "UTILISATEUR" || !u.typeUtilisateur);

  const formattedAccessRequests: FormattedAccessRequest[] = (accessRequests || []).map((request: any) => ({
    id: request.id,
    name: `${request.utilisateurPrenom || ""} ${request.utilisateurNom || ""}`.trim(),
    role: translate("profClasses.fallback.user"),
    date: request.dateDemande ? formatDate(request.dateDemande) : "",
    status: request.etat || "EN_ATTENTE",
  }));

  const d = classDetails as any;
  return {
    id: cls.id,
    name: d.nom || cls.nom || translate("profClasses.fallback.unnamed"),
    level: d.niveau || cls.niveau || translate("profClasses.fallback.noLevel"),
    state: d.etat === "ACTIF" ? "ACTIVE" : "INACTIVE",
    etat: d.etat || cls.etat || d.statut || cls.statut,
    matiere: d.matiere || cls.matiere,
    studentsCount: students.length,
    parentsCount: parents.length,
    professeursCount: professeurs.length,
    othersCount: others.length,
    creationDate: d.dateCreation || cls.dateCreation || new Date().toISOString(),
    description: d.description || "",
    etablissement: d.etablissement?.nom || translate("profClasses.fallback.notSpecified"),
    moderator: d.moderator
      ? `${d.moderator.prenom || ""} ${d.moderator.nom || ""}`.trim()
      : translate("profClasses.fallback.notSpecified"),
    teacherRights: translate("profClasses.roles.publication"),
    codeActivation: d.codeActivation || cls.codeActivation,
    droitPublication: d.droitPublication || d.droit_publication || "PROFESSEURS_SEULEMENT",
    accesMajeur: !!d.accesMajeur,
    students: students.map((s) => ({
      id: s.id,
      name: `${s.prenom || ""} ${s.nom || ""}`.trim(),
      email: s.email || s.telephone || translate("profClasses.fallback.notSpecified"),
      niveau: (s as any).niveau || translate("profClasses.fallback.notSpecified"),
      dateCreation: (s as any).dateCreation || (s as any).creationDate,
      etat: (s as any).etat,
    })),
    parents: parents.map((p) => ({
      id: p.id,
      name: `${p.prenom || ""} ${p.nom || ""}`.trim(),
      phone: p.telephone || p.email || translate("profClasses.fallback.notSpecified"),
      adresse: (p as any).adresse,
      dateCreation: (p as any).dateCreation || (p as any).creationDate,
      etat: (p as any).etat,
    })),
    professeurs,
    others,
    accessRequests: formattedAccessRequests,
    etablissementDetails: d.etablissement,
    moderatorDetails: d.moderator,
  };
};

/** Minimal UIClass when the per-class enrichment calls fail — the card still renders from the list row. */
const fallbackUIClass = (cls: ClassEntity): UIClass => ({
  id: cls.id,
  name: cls.nom || translate("profClasses.fallback.unnamed"),
  level: cls.niveau || translate("profClasses.fallback.noLevel"),
  state: cls.etat === "ACTIF" ? "ACTIVE" : "INACTIVE",
  etat: cls.etat || cls.statut,
  matiere: cls.matiere,
  studentsCount: Array.isArray(cls.eleves) ? cls.eleves.length : 0,
  parentsCount: 0,
  creationDate: cls.dateCreation || new Date().toISOString(),
  description: cls.description || "",
  etablissement: cls.etablissement?.nom || translate("profClasses.fallback.notSpecified"),
  moderator: translate("profClasses.fallback.notSpecified"),
  teacherRights: translate("profClasses.roles.publication"),
  codeActivation: cls.codeActivation,
  droitPublication: cls.droitPublication || "PROFESSEURS_SEULEMENT",
  accesMajeur: !!cls.accesMajeur,
  students: [],
  parents: [],
  accessRequests: [],
  etablissementDetails: cls.etablissement,
});

// Web's constants/niveaux.js — single source of truth for class levels.
const NIVEAUX = [
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "6ème",
  "5ème",
  "4ème",
  "3ème",
  "2nde",
  "1ère",
  "Terminale",
  "Licence 1",
  "Licence 2",
  "Licence 3",
  "Master 1",
  "Master 2",
];

// Web OfferService.calculerReduction()
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

type StatusTab = "all" | "active" | "pending";

// Web ManageClassList role filter ("Tous les rôles" / "Créée par moi" / …).
type RoleFilter = "all" | ClassRole;
const ROLE_FILTERS: { id: RoleFilter; label: TranslationKey }[] = [
  { id: "all", label: "profClasses.roles.all" },
  { id: "created", label: "profClasses.roles.created" },
  { id: "moderator", label: "profClasses.roles.moderator" },
  { id: "publication", label: "profClasses.roles.publication" },
  { id: "member", label: "profClasses.roles.member" },
];

// Web ClassesContentMobile tabs (All / Active / Pending), default "active".
const STATUS_TABS: { id: StatusTab; label: TranslationKey }[] = [
  { id: "all", label: "profClasses.statusTabs.all" },
  { id: "active", label: "profClasses.statusTabs.active" },
  { id: "pending", label: "profClasses.statusTabs.pending" },
];

const usePalette = () => {
  const isDark = useThemeStore((s) => s.mode === "dark");
  return useMemo(
    () => ({
      isDark,
      card: isDark ? "#1E293B" : "#FFFFFF",
      border: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
      inputBorder: isDark ? "#475569" : "#D1D5DB", // gray-300
      inputBg: isDark ? "#0F172A" : "#FFFFFF",
      title: isDark ? "#FFFFFF" : "#111827",
      body: isDark ? "#CBD5E1" : "#374151", // gray-700
      sub: isDark ? "#94A3B8" : "#6B7280", // gray-500
      muted: "#9CA3AF", // gray-400
    }),
    [isDark]
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Create class page — port of CreateClassContent.jsx
// ─────────────────────────────────────────────────────────────────────────────

const SelectField = ({
  icon,
  value,
  options,
  placeholder,
  onChange,
  title,
  disabled,
  hasError,
  styles,
  muted,
}: {
  icon?: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (v: string) => void;
  title: string;
  disabled?: boolean;
  hasError?: boolean;
  styles: ReturnType<typeof createStyles>;
  muted: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <TouchableOpacity
        style={[styles.inputWrap, hasError && styles.inputError, disabled && styles.inputDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {icon ? <FontAwesome5 name={icon as any} size={16} color={muted} style={styles.inputIcon} /> : null}
        <Text style={[styles.selectText, !selected && { color: muted }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <FontAwesome5 name="chevron-down" size={11} color={muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {[{ value: "", label: placeholder }, ...options].map((opt) => (
            <TouchableOpacity
              key={opt.value || "__none"}
              style={styles.sheetOption}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <Text style={[styles.sheetOptionText, opt.value === value && styles.sheetOptionTextActive]}>{opt.label}</Text>
              {opt.value === value ? <FontAwesome5 name="check" size={13} color="#2563EB" /> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
};

const FieldError = ({ message, styles }: { message?: string | null; styles: ReturnType<typeof createStyles> }) =>
  message ? (
    <View style={styles.fieldErrorRow}>
      <FontAwesome5 name="exclamation-circle" size={12} color="#DC2626" />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  ) : null;

interface CreateClassViewProps {
  userId?: string;
  onBack: () => void;
  onDone: () => void;
}

const CreateClassView = ({ userId, onBack, onDone }: CreateClassViewProps) => {
  const { t, locale } = useT();
  const colors = useThemeColors();
  const p = usePalette();
  const styles = useMemo(() => createStyles(colors, p), [colors, p]);
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({ nom: "", niveau: "", etablissement: "", codeUnique: "", accesMajeur: false });
  const [establishments, setEstablishments] = useState<Etablissement[]>([]);
  const [loadingEstablishments, setLoadingEstablishments] = useState(true);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [loadingOffres, setLoadingOffres] = useState(true);
  const [selectedOffreId, setSelectedOffreId] = useState("");
  const [periodicite, setPeriodicite] = useState<"MENSUEL" | "ANNUEL">("MENSUEL");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const selectedEstablishment = establishments.find((e) => e.id === formData.etablissement) || null;
  const selectedOffre = offres.find((o) => o.id === selectedOffreId) || null;
  const offreReduction = calculerReduction(selectedOffre);
  const montantSelectionne = selectedOffre
    ? Number(periodicite === "ANNUEL" ? selectedOffre.prixAnnuel : selectedOffre.prixMensuel) || 0
    : 0;

  useEffect(() => {
    establishmentService
      .getAll()
      .then((d) => setEstablishments(d || []))
      .catch(() => setEstablishments([]))
      .finally(() => setLoadingEstablishments(false));
    // Web: offerService.obtenirOffresActives(TypeCibleOffre.CLASSE) → GET /offres?cible=CLASSE&toutes=false
    offerService
      .list("CLASSE")
      .then((d) => setOffres(Array.isArray(d) ? d : []))
      .catch(() => setOffres([]))
      .finally(() => setLoadingOffres(false));
  }, []);

  // 5s countdown then redirect, like web's success screen.
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, onDone]);

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!success) return;
    Animated.timing(progress, {
      toValue: (5 - countdown) / 5,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [success, countdown, progress]);

  const setField = (name: keyof typeof formData, value: string | boolean) => {
    if (name === "etablissement") {
      setFormData((prev) => ({ ...prev, etablissement: value as string, codeUnique: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleOffreChange = (offreId: string) => {
    setSelectedOffreId(offreId);
    const offre = offres.find((o) => o.id === offreId);
    // Si l'offre choisie ne propose pas l'annuel, on retombe sur le mensuel.
    if (offre && periodicite === "ANNUEL" && offre.prixAnnuel == null) setPeriodicite("MENSUEL");
    if (errors.offre) setErrors((prev) => ({ ...prev, offre: null }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nom.trim()) newErrors.nom = t("profClasses.create.errors.nameRequired");
    else if (formData.nom.trim().length < 2) newErrors.nom = t("profClasses.create.errors.nameMin");
    if (!formData.niveau.trim()) newErrors.niveau = t("profClasses.create.errors.levelRequired");
    if (formData.etablissement && selectedEstablishment?.optionTokenGeneral && !formData.codeUnique.trim()) {
      newErrors.codeUnique = t("profClasses.create.errors.codeRequired");
    }
    if (!formData.etablissement && !selectedOffreId) newErrors.offre = t("profClasses.create.errors.offerRequired");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createClass = async (paymentInfo: PaymentInfo | null = null) => {
    setLoading(true);
    try {
      // Same payload as web CreateClassContent.createClass() → POST /classes/nouvelle
      const classData: Parameters<typeof classService.createNewClass>[0] = {
        nom: formData.nom.trim(),
        niveau: formData.niveau.trim(),
        creatorId: userId as string,
        moderatorId: userId,
        accesMajeur: formData.accesMajeur,
      };
      if (formData.etablissement) {
        classData.etablissementId = formData.etablissement;
        if (selectedEstablishment?.optionTokenGeneral && formData.codeUnique) {
          classData.codeUnique = formData.codeUnique;
        }
      } else if (paymentInfo) {
        classData.paymentInfo = paymentInfo;
        classData.offreId = selectedOffreId;
        classData.periodicite = periodicite;
      }
      await classService.createNewClass(classData);
      setSuccess(true);
      setCountdown(5);
    } catch (error: any) {
      setErrors({ submit: error?.message || t("profClasses.create.errors.createFailed") });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (formData.etablissement) await createClass();
    else setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentInfo: PaymentInfo) => {
    setIsProcessingPayment(true);
    setShowPaymentModal(false);
    await createClass(paymentInfo);
    setIsProcessingPayment(false);
  };

  const busy = loading || isProcessingPayment;

  if (success) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.successScroll, { paddingBottom: insets.bottom + 150 }]}
      >
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <FontAwesome5 name="check-circle" size={40} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>{t("profClasses.create.successTitle")}</Text>
          <Text style={styles.successText}>
            {formData.etablissement
              ? t("profClasses.create.successPending")
              : t("profClasses.create.successApproved")}
          </Text>
          {userId ? (
            <Text style={styles.successRights}>{t("profClasses.create.successRights")}</Text>
          ) : null}
          <Text style={styles.successText}>
            {t("profClasses.create.redirect", { count: countdown })}
          </Text>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
              ]}
            />
          </View>
          <TouchableOpacity onPress={onDone} activeOpacity={0.85}>
            <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.successBtn}>
              <Text style={styles.successBtnText}>{t("profClasses.create.goToManagement")}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 16 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.createScroll, { paddingBottom: insets.bottom + 150 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formCard}>
          {/* Header */}
          <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.formHeader}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel={t("profClasses.create.back")} disabled={busy}>
              <FontAwesome5 name="arrow-left" size={14} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.formHeaderIcon}>
              <FontAwesome5 name="graduation-cap" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.formHeaderTitle}>{t("profClasses.create.title")}</Text>
              <Text style={styles.formHeaderSubtitle}>{t("profClasses.create.subtitle")}</Text>
            </View>
          </LinearGradient>

          <View style={styles.formBody}>
            {/* Nom */}
            <View style={styles.field}>
              <Text style={styles.label}>{t("profClasses.create.nameLabel")}</Text>
              <View style={[styles.inputWrap, !!errors.nom && styles.inputError]}>
                <FontAwesome5 name="book-open" size={16} color={p.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.nom}
                  onChangeText={(v) => setField("nom", v)}
                  placeholder={t("profClasses.create.namePlaceholder")}
                  placeholderTextColor={p.muted}
                />
              </View>
              <FieldError message={errors.nom} styles={styles} />
            </View>

            {/* Niveau */}
            <View style={styles.field}>
              <Text style={styles.label}>{t("profClasses.create.levelLabel")}</Text>
              <SelectField
                icon="graduation-cap"
                value={formData.niveau}
                options={NIVEAUX.map((n) => ({ value: n, label: n }))}
                placeholder={t("profClasses.create.levelPlaceholder")}
                onChange={(v) => setField("niveau", v)}
                title={t("profClasses.create.levelTitle")}
                hasError={!!errors.niveau}
                styles={styles}
                muted={p.muted}
              />
              <FieldError message={errors.niveau} styles={styles} />
            </View>

            {/* accesMajeur */}
            <TouchableOpacity
              style={styles.majeurBox}
              onPress={() => setField("accesMajeur", !formData.accesMajeur)}
              activeOpacity={0.85}
            >
              <View style={[styles.checkbox, formData.accesMajeur && styles.checkboxOn]}>
                {formData.accesMajeur ? <FontAwesome5 name="check" size={10} color="#FFFFFF" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.majeurTitle}>{t("profClasses.create.majeurTitle")}</Text>
                <Text style={styles.majeurText}>{t("profClasses.create.majeurText")}</Text>
              </View>
            </TouchableOpacity>

            {/* Établissement */}
            <View style={styles.field}>
              <Text style={styles.label}>{t("profClasses.create.etabLabel")}</Text>
              <SelectField
                icon="school"
                value={formData.etablissement}
                options={establishments.map((e) => ({ value: e.id, label: e.nom || "—" }))}
                placeholder={
                  loadingEstablishments ? t("profClasses.create.etabLoading") : t("profClasses.create.etabNone")
                }
                onChange={(v) => setField("etablissement", v)}
                title={t("profClasses.create.etabTitle")}
                disabled={loadingEstablishments}
                styles={styles}
                muted={p.muted}
              />
              {loadingEstablishments ? (
                <Text style={styles.helpText}>{t("profClasses.create.etabLoadingHelp")}</Text>
              ) : null}
            </View>

            {/* Code unique */}
            {formData.etablissement && selectedEstablishment?.optionTokenGeneral ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t("profClasses.create.codeLabel")}</Text>
                <View style={[styles.inputWrap, !!errors.codeUnique && styles.inputError]}>
                  <FontAwesome5 name="key" size={16} color={p.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.codeUnique}
                    onChangeText={(v) => setField("codeUnique", v)}
                    placeholder="ABC123"
                    placeholderTextColor={p.muted}
                    autoCapitalize="characters"
                  />
                </View>
                <FieldError message={errors.codeUnique} styles={styles} />
              </View>
            ) : null}

            {/* Information panel */}
            <View style={styles.infoBox}>
              <FontAwesome5 name="exclamation-circle" size={16} color="#2563EB" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{t("profClasses.create.infoTitle")}</Text>
                <Text style={styles.infoText}>{t("profClasses.create.infoRequired")}</Text>
                {selectedEstablishment?.optionEnvoiMailVersClasse ? (
                  <View style={styles.infoLine}>
                    <FontAwesome5 name="envelope" size={11} color="#1D4ED8" />
                    <Text style={styles.infoText}>{t("profClasses.create.infoMail")}</Text>
                  </View>
                ) : null}
                {selectedEstablishment?.optionTokenGeneral ? (
                  <View style={styles.infoLine}>
                    <FontAwesome5 name="key" size={11} color="#1D4ED8" />
                    <Text style={styles.infoText}>{t("profClasses.create.infoToken")}</Text>
                  </View>
                ) : null}
                {selectedEstablishment?.codeUnique ? (
                  <View style={styles.infoLine}>
                    <FontAwesome5 name="bullseye" size={11} color="#1D4ED8" />
                    <Text style={styles.infoText}>{t("profClasses.create.infoCode")}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Offre / Forfait (classe sans établissement) */}
            {!formData.etablissement ? (
              <View style={styles.offreBox}>
                <View>
                  <Text style={styles.label}>{t("profClasses.create.offerLabel")}</Text>
                  <SelectField
                    value={selectedOffreId}
                    options={offres.map((o) => ({ value: o.id, label: `${o.nom || "—"}${o.estTest ? " (TEST)" : ""}` }))}
                    placeholder={loadingOffres ? t("profClasses.create.offerLoading") : t("profClasses.create.offerPlaceholder")}
                    onChange={handleOffreChange}
                    title={t("profClasses.create.offerTitle")}
                    disabled={loadingOffres}
                    hasError={!!errors.offre}
                    styles={styles}
                    muted={p.muted}
                  />
                  <FieldError message={errors.offre} styles={styles} />
                </View>

                {selectedOffre ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.label}>{t("profClasses.create.periodicity")}</Text>
                    <View style={styles.periodRow}>
                      {(["MENSUEL", "ANNUEL"] as const).map((per) => {
                        const disabled = per === "MENSUEL" ? selectedOffre.prixMensuel == null : selectedOffre.prixAnnuel == null;
                        const active = periodicite === per;
                        return (
                          <TouchableOpacity
                            key={per}
                            style={[styles.periodBtn, active && styles.periodBtnActive, disabled && { opacity: 0.4 }]}
                            onPress={() => setPeriodicite(per)}
                            disabled={disabled}
                          >
                            <Text style={[styles.periodText, active && styles.periodTextActive]}>
                              {per === "MENSUEL" ? t("profClasses.create.monthly") : t("profClasses.create.yearly")}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.priceText}>
                      {t("profClasses.create.price")}{" "}
                      <Text style={{ fontWeight: "800" }}>{montantSelectionne.toLocaleString(locale)} FCFA</Text>{" "}
                      {periodicite === "ANNUEL" ? t("profClasses.create.perYear") : t("profClasses.create.perMonth")}
                    </Text>
                    {periodicite === "ANNUEL" && offreReduction != null && offreReduction > 0 ? (
                      <View style={styles.reductionBox}>
                        <FontAwesome5 name="tags" size={12} color="#15803D" />
                        <Text style={styles.reductionText}>
                          {t("profClasses.create.reduction", {
                            pct: offreReduction > 1 ? Math.round(offreReduction) : Math.round(offreReduction * 100),
                          })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Submit error */}
            {errors.submit ? (
              <View style={styles.submitError}>
                <FontAwesome5 name="exclamation-circle" size={16} color="#DC2626" />
                <Text style={styles.submitErrorText}>{errors.submit}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={busy || loadingEstablishments}
              style={[{ marginTop: 24 }, (busy || loadingEstablishments) && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome5 name={!formData.etablissement ? "credit-card" : "check"} size={14} color="#FFFFFF" />
                )}
                <Text style={styles.submitText}>
                  {busy
                    ? t("profClasses.create.processing")
                    : !formData.etablissement
                      ? t("profClasses.create.proceedPayment")
                      : t("profClasses.create.submit")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <PaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        montant={montantSelectionne}
        label={selectedOffre?.nom || t("profClasses.create.paymentLabel")}
        subLabel={
          selectedOffre
            ? periodicite === "ANNUEL"
              ? t("profClasses.create.periodYearly")
              : t("profClasses.create.periodMonthly")
            : ""
        }
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Classes list — port of ClassesContent.jsx (phone layout: ClassesContentMobile)
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardClassesBodyProps {
  /** Open straight on the create form (DashboardShell's "create-class" tab, like web's CreateClassContent route). */
  autoCreate?: boolean;
}

const DashboardClassesBody = ({ autoCreate }: DashboardClassesBodyProps = {}) => {
  const { user } = useUser();
  const { t } = useT();
  const colors = useThemeColors();
  const p = usePalette();
  const styles = useMemo(() => createStyles(colors, p), [colors, p]);
  const insets = useSafeAreaInsets();

  const [currentView, setCurrentView] = useState<"list" | "details" | "create">(autoCreate ? "create" : "list");
  const [classes, setClasses] = useState<UIClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTab, setCurrentTab] = useState<StatusTab>("active");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [programmationCounts, setProgrammationCounts] = useState<Record<string, number>>({});

  const [selectedClass, setSelectedClass] = useState<UIClass | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("info");
  const [menuClass, setMenuClass] = useState<UIClass | null>(null);

  // Join by token
  const [accessToken, setAccessToken] = useState("");
  const [joining, setJoining] = useState(false);
  const [foundClass, setFoundClass] = useState<ClassEntity | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [requestRole, setRequestRole] = useState<AccessRequestRole>("eleve");
  const [submittingAccess, setSubmittingAccess] = useState(false);

  const userId = user?.userId as string | undefined;

  const loadProgrammationCounts = useCallback(
    async (list: UIClass[]) => {
      if (!userId) return;
      const counts: Record<string, number> = {};
      try {
        const accessible = await coursProgrammerService.getAccessible(userId);
        list.forEach((c) => {
          counts[c.id] = (accessible || []).filter((prog) => prog.classesIds && prog.classesIds.includes(c.id)).length;
        });
      } catch {
        list.forEach((c) => {
          counts[c.id] = 0;
        });
      }
      setProgrammationCounts(counts);
    },
    [userId]
  );

  const loadClasses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Same sources as web's "Mes classes" (ManageClassContent.fetchUserClasses):
      // 1. /droits-publication/utilisateurs/{id}/classes-avec-droits → created / moderator / publication
      // 2. /acceder/utilisateurs/{id}/classes → classes the user merely has access to (member)
      const [detailRes, accRes] = await Promise.allSettled([
        publicationRightsService.getClassesWithRightsDetail(userId),
        accederService.getAccessibleClasses(userId),
      ]);
      if (detailRes.status === "rejected" && accRes.status === "rejected") {
        throw detailRes.reason;
      }
      const detailList = detailRes.status === "fulfilled" ? detailRes.value : [];
      const accList = accRes.status === "fulfilled" && Array.isArray(accRes.value) ? accRes.value : [];
      // Backend role (CREATEUR / MODERATEUR / PUBLICATION, strongest one, deduplicated); legacy flags as fallback.
      const ROLE_MAP: Record<string, ClassRole> = { CREATEUR: "created", MODERATEUR: "moderator", PUBLICATION: "publication" };
      type Row = { cls: ClassEntity; role: ClassRole; creatorNom?: string | null; moderateurNom?: string | null };
      const rows: Row[] = [];
      const seen = new Set<string>();
      detailList.forEach((d) => {
        if (!d?.classe?.id || seen.has(d.classe.id)) return;
        seen.add(d.classe.id);
        const role: ClassRole =
          (d.role && ROLE_MAP[d.role]) || (d.peutModerer ? (d.estCreateur ? "created" : "moderator") : "publication");
        rows.push({ cls: d.classe, role, creatorNom: d.creatorNom, moderateurNom: d.moderateurNom });
      });
      accList.forEach((c) => {
        if (!c?.id || seen.has(c.id)) return;
        seen.add(c.id);
        rows.push({ cls: c, role: "member" });
      });
      const nameOf = (m: any) => (m && typeof m === "object" ? `${m.prenom || ""} ${m.nom || ""}`.trim() : "");
      const enriched = await Promise.all(
        rows.map(async ({ cls, role, creatorNom, moderateurNom }) => {
          const ui = await enrichClassForDetails(cls, { loadAccessRequests: isManagerRole(role) }).catch(() =>
            fallbackUIClass(cls)
          );
          const mod = ui.moderatorDetails || cls.moderator;
          const modName = moderateurNom || nameOf(mod);
          // "Par :" = the creator (not the moderator); legacy backend without creatorId → moderator.
          const by =
            role === "publication" || role === "moderator" ? creatorNom || (!cls.creatorId ? modName : "") : "";
          // "Modérateur :" when the main moderator is someone else than the creator and me.
          const modId = mod?.id || cls.moderatorId;
          const showMod = role !== "member" && !!modName && !!modId && modId !== userId && modId !== cls.creatorId;
          return { ...ui, classRole: role, grantedBy: by || undefined, moderatorName: showMod ? modName : undefined };
        })
      );
      setClasses(enriched);
      loadProgrammationCounts(enriched);
    } catch (e: any) {
      setError(e?.message || t("profClasses.list.loadError"));
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [userId, loadProgrammationCounts, t]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  const pendingCount = (c: UIClass) => (c.accessRequests || []).filter((r) => r.status === "EN_ATTENTE").length;

  const filteredClasses = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return classes.filter((cls) => {
      const matchesSearch =
        (cls.name || "").toLowerCase().includes(q) ||
        (cls.matiere || "").toLowerCase().includes(q) ||
        (cls.codeActivation || "").toLowerCase().includes(q) ||
        (cls.level || "").toLowerCase().includes(q) ||
        (cls.etablissementDetails?.nom || "").toLowerCase().includes(q);
      const status = cls.etat;
      if (roleFilter !== "all" && cls.classRole !== roleFilter) return false;
      if (currentTab === "active") return matchesSearch && status === "ACTIF";
      if (currentTab === "pending") return matchesSearch && (status === "EN_ATTENTE_APPROBATION" || status === "EN_ATTENTE");
      return matchesSearch;
    });
  }, [classes, searchTerm, currentTab, roleFilter]);

  const handleManageClass = (cls: UIClass) => {
    setMenuClass(null);
    setSelectedClass(cls);
    setActiveDetailTab("info");
    setCurrentView("details");
  };

  // Opened from a notification tap (useUiStore.requestClass): jump straight
  // into that class, on the requested ClassDetails tab.
  const pendingClass = useUiStore((st) => st.pendingClass);
  useEffect(() => {
    if (!pendingClass) return;
    const { classId, tab } = pendingClass;
    useUiStore.getState().clearPendingClass();
    let cancelled = false;
    (async () => {
      const known = classes.find((c) => String(c.id) === classId);
      const cls =
        known ??
        (await enrichClassForDetails({ id: classId } as ClassEntity, { loadAccessRequests: tab === "access-requests" }).catch(
          () => null
        ));
      if (cancelled || !cls) return;
      setMenuClass(null);
      setSelectedClass(cls);
      setActiveDetailTab(tab);
      setCurrentView("details");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClass]);

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedClass(null);
    setActiveDetailTab("info");
  };

  const refreshSelectedClass = async () => {
    if (!selectedClass) return;
    try {
      const fresh = await enrichClassForDetails(
        { id: selectedClass.id, nom: selectedClass.name, niveau: selectedClass.level },
        { loadAccessRequests: selectedClass.classRole === undefined || isManagerRole(selectedClass.classRole) }
      );
      const updated = {
        ...fresh,
        classRole: selectedClass.classRole,
        grantedBy: selectedClass.grantedBy,
        moderatorName: selectedClass.moderatorName,
      };
      setSelectedClass(updated);
      setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e) {
      console.error("Error refreshing class data:", e);
    }
  };

  // Web handleTokenAccess(): GET /classes/by-code/{token} then open the request dialog.
  const handleTokenAccess = async () => {
    if (!accessToken.trim()) {
      setError(t("profClasses.list.invalidToken"));
      return;
    }
    setJoining(true);
    setError("");
    try {
      const cls = await classAdminService.getByCode(accessToken.trim());
      if (!cls) throw new Error(t("profClasses.list.notFound"));
      setFoundClass(cls);
      setRequestRole("eleve");
      setShowAccessModal(true);
    } catch (e: any) {
      setError(e?.message || t("profClasses.list.notFound"));
    } finally {
      setJoining(false);
    }
  };

  // Web submitAccessRequest(): POST /acceder/demandes?utilisateurId&classeId&codeActivation&estParent
  const submitAccessRequest = async () => {
    if (!foundClass || !userId) return;
    setSubmittingAccess(true);
    try {
      await accederService.demanderAcces({
        utilisateurId: userId,
        classeId: foundClass.id,
        codeActivation: accessToken.trim(),
        estParent: requestRole === "parent",
      });
      setShowAccessModal(false);
      setAccessToken("");
      setFoundClass(null);
      Alert.alert(t("profClasses.list.successTitle"), t("profClasses.list.requestSent"));
      loadClasses();
    } catch (e: any) {
      setShowAccessModal(false);
      setError(e?.message || t("profClasses.list.requestFailed"));
    } finally {
      setSubmittingAccess(false);
    }
  };

  const handleShareCode = async (cls: UIClass) => {
    if (!cls.codeActivation) return;
    try {
      await Share.share({ message: t("profClasses.list.shareMessage", { name: cls.name, code: cls.codeActivation }) });
    } catch {
      /* dismissed */
    }
  };

  const handleCreateDone = useCallback(() => {
    setCurrentView("list");
    loadClasses();
  }, [loadClasses]);

  if (currentView === "details" && selectedClass) {
    return (
      <ClassDetails
        selectedClass={selectedClass}
        onBack={handleBackToList}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
        onRefresh={refreshSelectedClass}
      />
    );
  }

  if (currentView === "create") {
    return <CreateClassView userId={userId} onBack={() => setCurrentView("list")} onDone={handleCreateDone} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 150 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" />}
      >
        {/* Header */}
        <Text style={styles.pageTitle}>{t("profClasses.list.title")}</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={18} color={p.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("profClasses.list.searchPlaceholder")}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={p.muted}
          />
          {searchTerm.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchTerm("")} accessibilityLabel={t("profClasses.list.clear")}>
              <FontAwesome5 name="times-circle" size={16} color={p.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError("")} accessibilityLabel={t("profClasses.list.close")}>
              <FontAwesome5 name="times" size={12} color="#F87171" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Access a class (token) */}
        <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.tokenCard}>
          <View style={styles.tokenWatermark} pointerEvents="none">
            <FontAwesome5 name="key" size={120} color="rgba(255,255,255,0.1)" />
          </View>
          <Text style={styles.tokenTitle}>{t("profClasses.list.tokenTitle")}</Text>
          <Text style={styles.tokenSubtitle}>{t("profClasses.list.tokenSubtitle")}</Text>
          <View style={styles.tokenRow}>
            <TextInput
              style={styles.tokenInput}
              placeholder={t("profClasses.list.tokenPlaceholder")}
              placeholderTextColor="#BFDBFE"
              value={accessToken}
              onChangeText={setAccessToken}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={handleTokenAccess}
              returnKeyType="go"
            />
            <TouchableOpacity style={styles.joinBtn} onPress={handleTokenAccess} disabled={joining} activeOpacity={0.85}>
              {joining ? <ActivityIndicator size="small" color="#2563EB" /> : <Text style={styles.joinText}>{t("profClasses.list.join")}</Text>}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Status tabs */}
        <View style={styles.tabsRow}>
          {STATUS_TABS.map((tab) => {
            const active = currentTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => setCurrentTab(tab.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{t(tab.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Role filter (web: "Tous les rôles" select) — only roles present in the list */}
        {classes.some((c) => c.classRole) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
            {ROLE_FILTERS.filter((r) => r.id === "all" || classes.some((c) => c.classRole === r.id)).map((r) => {
              const active = roleFilter === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.rolePill, active && styles.rolePillActive]}
                  onPress={() => setRoleFilter(r.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>{t(r.label)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* List */}
        {loading && classes.length === 0 ? (
          <LoadingSpinner label={t("profClasses.list.loading")} />
        ) : (
          <View style={styles.cardsList}>
            {filteredClasses.map((cls) => (
              <ClassCard
                key={cls.id}
                classItem={cls}
                pendingRequestsCount={pendingCount(cls)}
                programmationsCount={programmationCounts[cls.id] || 0}
                onManageClass={handleManageClass}
                onMore={setMenuClass}
              />
            ))}

            {filteredClasses.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <FontAwesome5 name="graduation-cap" size={40} color={p.muted} />
                </View>
                <Text style={styles.emptyTitle}>{t("profClasses.list.emptyTitle")}</Text>
                <Text style={styles.emptyText}>{t("profClasses.list.emptyText")}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* FAB → create class (web: setActiveTab("create-class")) */}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <TouchableOpacity onPress={() => setCurrentView("create")} activeOpacity={0.85} accessibilityLabel={t("profClasses.list.createClass")}>
          <LinearGradient colors={["#2563EB", "#4F46E5"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.fab}>
            <FontAwesome5 name="plus" size={26} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Ellipsis menu — mounted only while open */}
      {menuClass ? (
        <BottomSheet visible={!!menuClass} onClose={() => setMenuClass(null)} title={menuClass.name}>
          <View style={{ gap: 10 }}>
            <View style={styles.menuInfoRow}>
              <Text style={styles.menuInfoLabel}>{t("profClasses.menu.level")}</Text>
              <Text style={styles.menuInfoValue}>{menuClass.level}</Text>
            </View>
            <View style={styles.menuInfoRow}>
              <Text style={styles.menuInfoLabel}>{t("profClasses.menu.status")}</Text>
              <Text style={styles.menuInfoValue}>
                {menuClass.etat === "ACTIF"
                  ? t("profClasses.menu.statusActive")
                  : menuClass.etat === "EN_ATTENTE_APPROBATION" || menuClass.etat === "EN_ATTENTE"
                    ? t("profClasses.menu.statusPending")
                    : t("profClasses.menu.statusInactive")}
              </Text>
            </View>
            <View style={styles.menuInfoRow}>
              <Text style={styles.menuInfoLabel}>{t("profClasses.menu.createdOn")}</Text>
              <Text style={styles.menuInfoValue}>{formatDate(menuClass.creationDate)}</Text>
            </View>
            {menuClass.codeActivation ? (
              <TouchableOpacity style={styles.menuAction} onPress={() => handleShareCode(menuClass)}>
                <FontAwesome5 name="key" size={14} color="#2563EB" />
                <Text style={styles.menuActionText}>{t("profClasses.menu.code", { code: menuClass.codeActivation })}</Text>
                <FontAwesome5 name="share-alt" size={13} color={p.muted} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.menuAction} onPress={() => handleManageClass(menuClass)}>
              <FontAwesome5 name="sign-in-alt" size={14} color="#2563EB" />
              <Text style={styles.menuActionText}>{t("profClasses.menu.enter")}</Text>
              <FontAwesome5 name="chevron-right" size={11} color={p.muted} />
            </TouchableOpacity>
          </View>
        </BottomSheet>
      ) : null}

      <AccessRequestModal
        visible={showAccessModal}
        foundClass={foundClass}
        requestRole={requestRole}
        setRequestRole={setRequestRole}
        submitting={submittingAccess}
        onCancel={() => setShowAccessModal(false)}
        onSubmit={submitAccessRequest}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, p: ReturnType<typeof usePalette>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // ── List page ───────────────────────────────────────────────────────
    listScroll: { paddingHorizontal: 16, paddingTop: 12 },
    pageTitle: { fontSize: 28, fontWeight: "900", color: p.title, marginBottom: 20 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: p.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.border,
      paddingHorizontal: 16,
      paddingVertical: 4,
      marginBottom: 20,
      shadowColor: "#3B82F6",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 15, color: p.title, paddingVertical: 12 },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: p.isDark ? "rgba(127,29,29,0.25)" : "#FEF2F2",
      borderWidth: 1,
      borderColor: p.isDark ? "rgba(248,113,113,0.3)" : "#FECACA",
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    errorText: { flex: 1, color: p.isDark ? "#FCA5A5" : "#B91C1C", fontSize: 13 },
    tokenCard: {
      padding: 24,
      borderRadius: 28,
      marginBottom: 24,
      overflow: "hidden",
    },
    tokenWatermark: { position: "absolute", right: -16, bottom: -16 },
    tokenTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginBottom: 2 },
    tokenSubtitle: {
      color: "rgba(219,234,254,0.8)",
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 16,
    },
    tokenRow: { flexDirection: "row", gap: 8 },
    tokenInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },
    joinBtn: {
      backgroundColor: "#FFFFFF",
      paddingHorizontal: 16,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      minWidth: 96,
    },
    joinText: { color: "#2563EB", fontSize: 12, fontWeight: "900" },
    tabsRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
    tabPill: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.border,
    },
    tabPillActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    roleRow: { gap: 8, paddingBottom: 16 },
    rolePill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: p.card,
    },
    rolePillActive: { backgroundColor: p.isDark ? "rgba(79,70,229,0.25)" : "#EEF2FF", borderColor: "#4F46E5" },
    rolePillText: { fontSize: 11, fontWeight: "700", color: p.sub },
    rolePillTextActive: { color: p.isDark ? "#A5B4FC" : "#4F46E5" },
    tabPillText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5, color: p.sub },
    tabPillTextActive: { color: "#FFFFFF" },
    cardsList: { gap: 16 },
    emptyState: { alignItems: "center", paddingVertical: 64 },
    emptyIcon: {
      padding: 24,
      borderRadius: 999,
      backgroundColor: p.isDark ? "#1E293B" : "#F3F4F6",
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: p.title },
    emptyText: { fontSize: 12, color: p.sub, marginTop: 2, textAlign: "center" },
    fabWrap: { position: "absolute", right: 24, bottom: 112, zIndex: 30 },
    fab: {
      width: 64,
      height: 64,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    menuInfoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    menuInfoLabel: { fontSize: 13, color: p.sub },
    menuInfoValue: { fontSize: 13, fontWeight: "700", color: p.title, flexShrink: 1, textAlign: "right" },
    menuAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.isDark ? "#334155" : "#E5E7EB",
    },
    menuActionText: { flex: 1, fontSize: 14, fontWeight: "600", color: p.title },

    // ── Create page ─────────────────────────────────────────────────────
    createScroll: { paddingHorizontal: 16, paddingTop: 12 },
    formCard: {
      backgroundColor: p.isDark ? "#1F2937" : "#FFFFFF", // gray-800 / white
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
    formHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 20 },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    formHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    formHeaderTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
    formHeaderSubtitle: { color: "#DBEAFE", fontSize: 13 },
    formBody: { padding: 20, gap: 20 },
    field: {},
    label: { fontSize: 14, fontWeight: "500", color: p.isDark ? "#D1D5DB" : "#374151", marginBottom: 8 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 8,
      backgroundColor: p.inputBg,
      paddingHorizontal: 12,
      minHeight: 48,
    },
    inputError: { borderColor: "#EF4444" },
    inputDisabled: { backgroundColor: p.isDark ? "#1E293B" : "#F9FAFB" },
    inputIcon: { marginRight: 12, width: 18, textAlign: "center" },
    input: { flex: 1, fontSize: 15, color: p.title, paddingVertical: 12 },
    selectText: { flex: 1, fontSize: 15, color: p.title, paddingVertical: 12 },
    helpText: { marginTop: 4, fontSize: 13, color: p.sub },
    fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    fieldErrorText: { fontSize: 13, color: "#DC2626", flex: 1 },
    sheetOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: p.isDark ? "#334155" : "#F1F5F9",
    },
    sheetOptionText: { fontSize: 15, color: p.body, flex: 1 },
    sheetOptionTextActive: { color: "#2563EB", fontWeight: "700" },
    majeurBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 16,
      backgroundColor: p.isDark ? "rgba(88,28,135,0.25)" : "#FAF5FF", // purple-50
      borderWidth: 1,
      borderColor: p.isDark ? "rgba(168,85,247,0.35)" : "#E9D5FF", // purple-200
      borderRadius: 8,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: "#D1D5DB",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    checkboxOn: { backgroundColor: "#9333EA", borderColor: "#9333EA" },
    majeurTitle: { fontSize: 14, fontWeight: "700", color: p.isDark ? "#E9D5FF" : "#6B21A8" },
    majeurText: { fontSize: 14, color: p.isDark ? "#C084FC" : "#9333EA" },
    infoBox: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: p.isDark ? "rgba(30,58,138,0.3)" : "#EFF6FF", // blue-50
      borderWidth: 1,
      borderColor: p.isDark ? "rgba(96,165,250,0.35)" : "#BFDBFE", // blue-200
      borderRadius: 8,
      padding: 16,
    },
    infoTitle: { fontSize: 14, fontWeight: "700", color: p.isDark ? "#BFDBFE" : "#1D4ED8", marginBottom: 4 },
    infoText: { fontSize: 14, color: p.isDark ? "#93C5FD" : "#1D4ED8", flexShrink: 1 },
    infoLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    offreBox: {
      backgroundColor: p.isDark ? "rgba(120,53,15,0.25)" : "#FFFBEB", // amber-50
      borderWidth: 1,
      borderColor: p.isDark ? "rgba(251,191,36,0.35)" : "#FDE68A", // amber-200
      borderRadius: 8,
      padding: 16,
    },
    periodRow: { flexDirection: "row", gap: 8 },
    periodBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.inputBorder,
    },
    periodBtnActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    periodText: { fontSize: 14, fontWeight: "500", color: p.body },
    periodTextActive: { color: "#FFFFFF" },
    priceText: { marginTop: 8, fontSize: 14, fontWeight: "500", color: p.isDark ? "#E5E7EB" : "#1F2937" },
    reductionBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      backgroundColor: "#F0FDF4",
      borderWidth: 1,
      borderColor: "#BBF7D0",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    reductionText: { flex: 1, fontSize: 14, color: "#15803D" },
    submitError: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 16,
      backgroundColor: "#FEF2F2",
      borderWidth: 1,
      borderColor: "#FECACA",
      borderRadius: 8,
    },
    submitErrorText: { flex: 1, color: "#B91C1C", fontSize: 14 },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 8,
    },
    submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

    // ── Success ─────────────────────────────────────────────────────────
    successScroll: { paddingHorizontal: 16, paddingTop: 40, alignItems: "stretch" },
    successCard: {
      backgroundColor: p.isDark ? "#1F2937" : "#FFFFFF",
      borderRadius: 16,
      padding: 28,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
    successIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#DCFCE7",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    successTitle: { fontSize: 22, fontWeight: "800", color: p.title, marginBottom: 16, textAlign: "center" },
    successText: { fontSize: 15, color: p.isDark ? "#D1D5DB" : "#4B5563", textAlign: "center", marginBottom: 8 },
    successRights: { fontSize: 13, color: "#16A34A", textAlign: "center", marginBottom: 8 },
    progressTrack: {
      width: "100%",
      height: 8,
      borderRadius: 4,
      backgroundColor: "#E5E7EB",
      overflow: "hidden",
      marginTop: 16,
      marginBottom: 24,
    },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: "#2563EB" },
    successBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
    successBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600", textAlign: "center" },
  });

export default DashboardClassesBody;
