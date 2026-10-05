import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { BottomSheet, LoadingSpinner } from "../../../../components/ui";
import { useThemeColors } from "../../../../styles/theme";
import { useThemeStore } from "../../../../store/useThemeStore";
import { exerciseService, matiereService, mediaService, questionService } from "../../../../services/api";
import { useUser } from "../../../../context/UserContext";
import { ChoixReponse, Exercise, Matiere } from "../../../../types";

// LinearGradient via expo-linear-gradient (safe fallback to View if unavailable)
let LinearGradient: any;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = ({ children, style, colors: c }: any) => (
    <View style={[style, { backgroundColor: c?.[0] }]}>{children}</View>
  );
}

/*
 * Port of scholchat_front's CreateExerciseForm.jsx + EditExerciseForm.jsx
 * (+ exerciseForm/QuestionBuilder.jsx and constants.js). Same sections,
 * fields, validation and the exact requests web sends:
 *   create: POST /exercises { nom, description, niveau, restriction, redacteurId, etat: "BROUILLON" }
 *           then POST /exercises/{id}/lier-matiere/{mId} per matière (sequential)
 *           then POST /questions/exercise/{id} per question (buildQuestionPayload)
 *   edit:   PUT /exercises/{id} { nom, description, niveau, restriction }
 *           lier/delier matières diff, DELETE removed questions,
 *           PUT /questions/{qid} (web's updateQuestion fields) / POST new ones.
 */

// ── Constants (web exerciseForm/constants.js) ────────────────────────────────

export const NIVEAU_OPTIONS: { label: string; value: string }[] = [
  { label: "Maternelle", value: "MATERNELLE" },
  { label: "Primaire", value: "PRIMAIRE" },
  { label: "Collège", value: "COLLEGE" },
  { label: "Lycée", value: "LYCEE" },
  { label: "Université", value: "UNIVERSITE" },
  { label: "Autre", value: "AUTRE" },
];

export const niveauLabel = (v?: string) => NIVEAU_OPTIONS.find((n) => n.value === v)?.label ?? v ?? "";

/** Web's constants/niveaux.js NIVEAUX (grade labels). */
export const NIVEAU_GRADES = [
  "CP", "CE1", "CE2", "CM1", "CM2",
  "6ème", "5ème", "4ème", "3ème",
  "2nde", "1ère", "Terminale",
  "Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2",
];

/** Web exerciseService.js mapNiveauToEnum. */
export const mapNiveauToEnum = (niveau: string): string => {
  const map: Record<string, string> = {
    "6ème": "COLLEGE", "5ème": "COLLEGE", "4ème": "COLLEGE", "3ème": "COLLEGE",
    "2nde": "LYCEE", "1ère": "LYCEE", Terminale: "LYCEE",
    "Licence 1": "UNIVERSITE", "Licence 2": "UNIVERSITE", "Licence 3": "UNIVERSITE",
    "Master 1": "UNIVERSITE", "Master 2": "UNIVERSITE",
    CP: "PRIMAIRE", CE1: "PRIMAIRE", CE2: "PRIMAIRE", CM1: "PRIMAIRE", CM2: "PRIMAIRE",
  };
  return map[niveau] || niveau;
};

type QuestionType =
  | "QCM"
  | "VRAI_FAUX"
  | "REPONSE_COURTE"
  | "REPONSE_LONGUE"
  | "DEVELOPPEMENT"
  | "ASSOCIATION"
  | "CLASSEMENT"
  | "TROU";

export const QUESTION_TYPES: { value: QuestionType; label: string; desc: string; icon: string }[] = [
  { value: "QCM", label: "QCM", desc: "Choix multiple", icon: "check-square" },
  { value: "VRAI_FAUX", label: "Vrai / Faux", desc: "Deux options", icon: "align-left" },
  { value: "REPONSE_COURTE", label: "Réponse courte", desc: "Texte court", icon: "font" },
  { value: "REPONSE_LONGUE", label: "Réponse longue", desc: "Texte développé", icon: "file-alt" },
  { value: "DEVELOPPEMENT", label: "Développement", desc: "Rédaction libre", icon: "edit" },
  { value: "ASSOCIATION", label: "Association", desc: "Relier les éléments", icon: "link" },
  { value: "CLASSEMENT", label: "Classement", desc: "Ordonner", icon: "list-ol" },
  { value: "TROU", label: "Texte à trous", desc: "Compléter", icon: "align-left" },
];

const TYPES_WITH_CHOICES = ["QCM", "VRAI_FAUX", "ASSOCIATION", "CLASSEMENT", "TROU"];
const TYPES_OPEN = ["REPONSE_COURTE", "REPONSE_LONGUE", "DEVELOPPEMENT"];

/** Media object exactly as web's minioS3Service.uploadFile returns it (+ previewUrl). */
interface QuestionMedia {
  id?: string;
  success?: boolean;
  fileName?: string;
  mediaType?: string;
  documentType?: string;
  ownerId?: string;
  fileSize?: number;
  contentType?: string;
  filePath?: string;
  presignedUrl?: string;
  previewUrl?: string | null;
  [key: string]: any;
}

interface QuestionDraft {
  id?: string;
  intitule: string;
  typeQuestion: QuestionType;
  points: number;
  choixReponses: ChoixReponse[];
  reponse: string;
  medias: QuestionMedia[];
  [key: string]: any;
}

const getDefaultChoix = (type: string): ChoixReponse[] => {
  if (type === "VRAI_FAUX")
    return [
      { texte: "Vrai", estCorrect: false, ordreAffichage: 1 },
      { texte: "Faux", estCorrect: false, ordreAffichage: 2 },
    ];
  const allCorrect = type === "ASSOCIATION" || type === "CLASSEMENT";
  return [
    { texte: "", estCorrect: allCorrect, ordreAffichage: 1 },
    { texte: "", estCorrect: allCorrect, ordreAffichage: 2 },
  ];
};

const emptyQuestion = (type: QuestionType = "QCM"): QuestionDraft => ({
  intitule: "",
  typeQuestion: type,
  points: 1,
  choixReponses: getDefaultChoix(type),
  reponse: "",
  medias: [],
});

/** Web buildQuestionPayload (used for POST /questions/exercise/{id}). */
const buildQuestionPayload = (q: QuestionDraft) => {
  const base = {
    intitule: q.intitule,
    typeQuestion: q.typeQuestion,
    points: q.points || 1,
    medias: q.medias || [],
  };
  if (TYPES_WITH_CHOICES.includes(q.typeQuestion)) return { ...base, choixReponses: q.choixReponses };
  return { ...base, reponse: q.reponse };
};

/** Web questionReponseService.updateQuestion keeps only these fields of buildQuestionPayload. */
const buildQuestionUpdatePayload = (q: QuestionDraft) => {
  const p: any = buildQuestionPayload(q);
  return {
    intitule: p.intitule,
    reponse: p.reponse,
    typeQuestion: p.typeQuestion,
    points: p.points,
    choixReponses: p.choixReponses,
    // Full current list: the backend keeps medias sent with an id, adds those
    // without one and deletes the rest.
    medias: p.medias,
  };
};

/** Web validateQuestion — returns the warning message, or null when valid. */
const validateQuestion = (q: QuestionDraft): string | null => {
  if (!q.intitule.trim()) return "L'intitulé de la question est requis";
  const type = q.typeQuestion;
  if (type === "VRAI_FAUX") {
    if (!q.choixReponses.some((c) => c.estCorrect)) return "Sélectionnez Vrai ou Faux";
  } else if (TYPES_WITH_CHOICES.includes(type)) {
    if (q.choixReponses.length < 2) return "Au moins 2 choix requis";
    if (q.choixReponses.some((c) => !c.texte.trim())) return "Tous les choix doivent avoir un texte";
    if (type === "QCM" && !q.choixReponses.some((c) => c.estCorrect)) return "Cochez au moins une bonne réponse";
  } else if (TYPES_OPEN.includes(type)) {
    if (!q.reponse.trim()) return "La réponse attendue est requise";
  }
  return null;
};

// ── Theme ───────────────────────────────────────────────────────────────────

const makePalette = (isDark: boolean) => ({
  title: isDark ? "#F8FAFC" : "#1F2937", // gray-800
  label: isDark ? "#CBD5E1" : "#4B5563", // gray-600
  body: isDark ? "#CBD5E1" : "#374151",
  sub: isDark ? "#94A3B8" : "#9CA3AF", // gray-400
  muted: isDark ? "#64748B" : "#9CA3AF",
  card: isDark ? "#1E293B" : "#FFFFFF",
  cardBorder: isDark ? "#334155" : "#E4EAF4",
  headDivider: isDark ? "#334155" : "#F0F4FB",
  input: isDark ? "#0F172A" : "#FFFFFF",
  inputBorder: isDark ? "#475569" : "#D9D9D9",
  builderBg: isDark ? "rgba(109,40,217,0.10)" : "#FAF9FF",
  builderBorder: isDark ? "rgba(196,181,253,0.45)" : "#C4B5FD",
  qListBorder: isDark ? "rgba(237,233,254,0.2)" : "#EDE9FE",
  qListHead: isDark ? "rgba(109,40,217,0.18)" : "#F5F3FF",
  qRowActive: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF",
  qNumBg: isDark ? "#334155" : "#E5E7EB",
  purpleText: isDark ? "#C4B5FD" : "#6D28D9",
  indigoText: isDark ? "#A5B4FC" : "#4338CA",
  blueSoft: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE",
  purpleSoft: isDark ? "rgba(109,40,217,0.2)" : "#EDE9FE",
  tipsBg: isDark ? "rgba(37,99,235,0.12)" : "#F0F7FF",
  tipsBorder: isDark ? "rgba(147,197,253,0.4)" : "#BFDBFE",
  tipsTitle: isDark ? "#93C5FD" : "#1D4ED8",
  tipsText: isDark ? "#BFDBFE" : "#1E40AF",
  actionBg: isDark ? "#0F172A" : "#F8FAFF",
  chipBg: isDark ? "#334155" : "#F5F5F5",
  chipBorder: isDark ? "#475569" : "#F0F0F0",
  errorBg: isDark ? "rgba(239,68,68,0.12)" : "#FFF2F0",
  errorBorder: isDark ? "rgba(239,68,68,0.45)" : "#FFCCC7",
  errorText: isDark ? "#F87171" : "#FF4D4F",
  green: isDark ? "#4ADE80" : "#15803D",
  greenBg: isDark ? "rgba(34,197,94,0.15)" : "#F0FDF4",
});

type Palette = ReturnType<typeof makePalette>;

// ── Small building blocks ───────────────────────────────────────────────────

const FormInput = ({
  error,
  styles,
  palette,
  style,
  ...props
}: TextInputProps & { error?: boolean; styles: Styles; palette: Palette }) => {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      placeholderTextColor={palette.muted}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.input, focused && styles.inputFocused, error && styles.inputError, style]}
    />
  );
};

const FieldError = ({ message, styles }: { message?: string; styles: Styles }) =>
  message ? <Text style={styles.fieldErrorText}>{message}</Text> : null;

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  desc?: string;
}

/** antd <Select> port: a field that opens a bottom sheet of options. */
const SelectField = ({
  value,
  options,
  onChange,
  title,
  placeholder,
  error,
  styles,
  palette,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  title: string;
  placeholder?: string;
  error?: boolean;
  styles: Styles;
  palette: Palette;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.selectField, error && styles.inputError]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.rowCenter}>
          {selected?.icon ? <FontAwesome5 name={selected.icon as any} size={12} color={palette.label} /> : null}
          <Text style={[styles.selectText, !selected && { color: palette.muted }]} numberOfLines={1}>
            {selected ? selected.label : value || placeholder || "Sélectionner"}
          </Text>
        </View>
        <FontAwesome5 name="chevron-down" size={10} color={palette.muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={styles.sheetOption}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <View style={[styles.rowCenter, { flex: 1 }]}>
                  {opt.icon ? (
                    <View style={{ width: 20, alignItems: "center" }}>
                      <FontAwesome5 name={opt.icon as any} size={13} color={active ? "#4F46E5" : palette.label} />
                    </View>
                  ) : null}
                  <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                    {opt.label}
                    {opt.desc ? <Text style={styles.sheetOptionDesc}>{`  — ${opt.desc}`}</Text> : null}
                  </Text>
                </View>
                {active ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </>
  );
};

/** antd <Select mode="multiple" showSearch allowClear> port. */
const MultiSelectField = ({
  values,
  options,
  onChange,
  loading,
  placeholder,
  title,
  styles,
  palette,
}: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (v: string[]) => void;
  loading?: boolean;
  placeholder: string;
  title: string;
  styles: Styles;
  palette: Palette;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const selected = values.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v });
  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.multiField]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.multiChips}>
          {selected.length === 0 ? (
            <Text style={[styles.selectText, { color: palette.muted }]}>{placeholder}</Text>
          ) : (
            selected.map((o) => (
              <View key={o.value} style={styles.multiChip}>
                <Text style={styles.multiChipText} numberOfLines={1}>{o.label}</Text>
                <TouchableOpacity onPress={() => toggle(o.value)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                  <FontAwesome5 name="times" size={9} color={palette.sub} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#4F46E5" />
        ) : values.length > 0 ? (
          <TouchableOpacity onPress={() => onChange([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times-circle" size={13} color={palette.muted} solid />
          </TouchableOpacity>
        ) : (
          <FontAwesome5 name="chevron-down" size={10} color={palette.muted} />
        )}
      </TouchableOpacity>
      <BottomSheet
        visible={open}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        title={title}
      >
        <View style={[styles.input, styles.sheetSearch]}>
          <FontAwesome5 name="search" size={12} color={palette.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher..."
            placeholderTextColor={palette.muted}
            style={styles.sheetSearchInput}
          />
        </View>
        <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color="#4F46E5" />
          ) : filtered.length === 0 ? (
            <Text style={styles.sheetEmpty}>Aucune matière</Text>
          ) : (
            filtered.map((opt) => {
              const active = values.includes(opt.value);
              return (
                <TouchableOpacity key={opt.value} style={styles.sheetOption} onPress={() => toggle(opt.value)}>
                  <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>{opt.label}</Text>
                  {active ? <FontAwesome5 name="check" size={13} color="#4F46E5" /> : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </BottomSheet>
    </>
  );
};

// ── Answer builder (web AnswerBuilder) ──────────────────────────────────────

const AnswerBuilder = ({
  question,
  onChange,
  styles,
  palette,
}: {
  question: QuestionDraft;
  onChange: (q: QuestionDraft) => void;
  styles: Styles;
  palette: Palette;
}) => {
  const type = question.typeQuestion;
  const choix = question.choixReponses || [];
  const setChoix = (updated: ChoixReponse[]) =>
    onChange({ ...question, choixReponses: updated.map((c, i) => ({ ...c, ordreAffichage: i + 1 })) });
  const updateChoix = (index: number, field: "texte" | "estCorrect", value: any) => {
    const updated = [...choix];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...question, choixReponses: updated });
  };
  const moveChoix = (index: number, dir: number) => {
    const updated = [...choix];
    const target = index + dir;
    if (target < 0 || target >= updated.length) return;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setChoix(updated);
  };
  const addChoix = () => {
    const allCorrect = type === "ASSOCIATION" || type === "CLASSEMENT";
    setChoix([...choix, { texte: "", estCorrect: allCorrect, ordreAffichage: choix.length + 1 }]);
  };
  const removeChoix = (index: number) => setChoix(choix.filter((_, i) => i !== index));

  if (type === "VRAI_FAUX") {
    return (
      <View>
        <Text style={styles.hint}>Cliquez sur la bonne réponse</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {choix.map((c, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.vfBtn, c.estCorrect && styles.vfBtnActive]}
              onPress={() => onChange({ ...question, choixReponses: choix.map((x, j) => ({ ...x, estCorrect: j === i })) })}
              activeOpacity={0.85}
            >
              <Text style={[styles.vfText, c.estCorrect && styles.vfTextActive]}>{c.texte}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  if (TYPES_WITH_CHOICES.includes(type)) {
    const placeholder = (i: number) =>
      type === "QCM"
        ? `Option ${i + 1}`
        : type === "ASSOCIATION"
          ? "Ex: France → Paris"
          : type === "CLASSEMENT"
            ? `Élément ${i + 1}`
            : type === "TROU"
              ? "Mot à compléter"
              : `Choix ${i + 1}`;
    return (
      <View>
        <Text style={styles.hint}>
          {type === "QCM"
            ? "Cochez la/les bonne(s) réponse(s)"
            : type === "ASSOCIATION"
              ? "Saisissez les paires à associer"
              : type === "TROU"
                ? "Mots/expressions à compléter"
                : "Éléments dans l'ordre correct"}
        </Text>
        <View style={{ gap: 8 }}>
          {choix.map((c, i) => (
            <View key={i} style={styles.choiceRow}>
              <View style={{ gap: 2 }}>
                <TouchableOpacity
                  onPress={() => moveChoix(i, -1)}
                  disabled={i === 0}
                  style={[styles.moveBtn, i === 0 && { opacity: 0.3 }]}
                  hitSlop={{ top: 4, bottom: 2, left: 6, right: 6 }}
                >
                  <FontAwesome5 name="arrow-up" size={10} color={palette.sub} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveChoix(i, 1)}
                  disabled={i === choix.length - 1}
                  style={[styles.moveBtn, i === choix.length - 1 && { opacity: 0.3 }]}
                  hitSlop={{ top: 2, bottom: 4, left: 6, right: 6 }}
                >
                  <FontAwesome5 name="arrow-down" size={10} color={palette.sub} />
                </TouchableOpacity>
              </View>
              {type === "QCM" && (
                <TouchableOpacity
                  onPress={() => updateChoix(i, "estCorrect", !c.estCorrect)}
                  style={[styles.checkbox, c.estCorrect && styles.checkboxOn]}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  {c.estCorrect ? <FontAwesome5 name="check" size={10} color="#FFFFFF" /> : null}
                </TouchableOpacity>
              )}
              {(type === "CLASSEMENT" || type === "TROU") && <Text style={styles.choiceIndex}>{i + 1}</Text>}
              <FormInput
                styles={styles}
                palette={palette}
                value={c.texte}
                onChangeText={(t) => updateChoix(i, "texte", t)}
                placeholder={placeholder(i)}
                style={{ flex: 1, paddingVertical: 8 }}
              />
              {choix.length > 2 && (
                <TouchableOpacity onPress={() => removeChoix(i)} style={styles.iconBtn}>
                  <FontAwesome5 name="trash" size={13} color="#F87171" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.addChoiceBtn} onPress={addChoix} activeOpacity={0.8}>
          <FontAwesome5 name="plus" size={10} color="#4F46E5" />
          <Text style={styles.addChoiceText}>Ajouter un choix</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (TYPES_OPEN.includes(type)) {
    return (
      <View>
        <Text style={styles.hint}>Réponse modèle (pour la correction)</Text>
        {type === "REPONSE_COURTE" ? (
          <FormInput
            styles={styles}
            palette={palette}
            value={question.reponse}
            onChangeText={(t) => onChange({ ...question, reponse: t })}
            placeholder="Ex: H₂O"
          />
        ) : (
          <FormInput
            styles={styles}
            palette={palette}
            value={question.reponse}
            onChangeText={(t) => onChange({ ...question, reponse: t })}
            placeholder="Décrivez la réponse attendue..."
            multiline
            textAlignVertical="top"
            style={{ minHeight: 76 }}
          />
        )}
      </View>
    );
  }
  return null;
};

// ── Media attachments (web QuestionMediaAttachments) ────────────────────────

const isImageMedia = (m: QuestionMedia) => m.mediaType === "IMAGE" || (m.contentType || "").startsWith("image/");

const QuestionMediaAttachments = ({
  medias,
  onChange,
  ownerId,
  onWarn,
  styles,
  palette,
}: {
  medias: QuestionMedia[];
  onChange: (m: QuestionMedia[]) => void;
  ownerId?: string;
  onWarn: (msg: string, kind?: "warning" | "error") => void;
  styles: Styles;
  palette: Palette;
}) => {
  const [uploading, setUploading] = useState(false);
  const list = medias || [];

  const pick = async () => {
    if (uploading) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const files = result.assets;
    const valid = files.filter((f) => (f.mimeType ?? "").startsWith("image/") || f.mimeType === "application/pdf");
    if (valid.length < files.length) onWarn("Seules les images et les fichiers PDF sont acceptés");
    if (valid.length === 0) return;
    if (!ownerId) {
      onWarn("Utilisateur non connecté.", "error");
      return;
    }
    setUploading(true);
    let next = [...list];
    try {
      for (const file of valid) {
        const mimeType = file.mimeType ?? "application/octet-stream";
        const isImage = mimeType.startsWith("image/");
        const mediaType = isImage ? "IMAGE" : "DOCUMENT";
        try {
          // Same presigned flow as web's minioS3Service.uploadFile(file, mediaType, "question_attachments")
          const presigned: any = await mediaService.getPresignedUploadUrl(
            file.name,
            mimeType,
            ownerId,
            mediaType,
            "question_attachments"
          );
          await mediaService.putToPresignedUrl(presigned.url, { uri: file.uri, mimeType, name: file.name });
          const resOwner = presigned.ownerId ?? ownerId;
          const resMediaType = presigned.mediaType ?? mediaType;
          const media: QuestionMedia = {
            success: true,
            fileName: presigned.fileName,
            mediaType: resMediaType,
            documentType: presigned.documentType ?? "question_attachments",
            ownerId: resOwner,
            fileSize: file.size,
            contentType: mimeType,
            filePath: `users/${resOwner}/${String(mediaType).toLowerCase()}/question_attachments/${presigned.fileName}`,
            previewUrl: isImage ? file.uri : null,
          };
          next = [...next, media];
          onChange(next);
        } catch (err) {
          onWarn(`${file.name}: ${err instanceof Error ? err.message : "échec de l'envoi"}`, "error");
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (index: number) => onChange(list.filter((_, i) => i !== index));

  return (
    <View>
      <Text style={styles.smallLabel}>Pièces jointes (images ou PDF)</Text>
      <TouchableOpacity
        style={[styles.dropzone, uploading && styles.dropzoneBusy]}
        onPress={pick}
        activeOpacity={0.8}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : (
          <FontAwesome5 name="paperclip" size={20} color="#6366F1" />
        )}
        <Text style={styles.dropzoneText}>
          {uploading ? "Envoi en cours…" : "Touchez pour joindre une image ou un PDF"}
        </Text>
        <Text style={styles.dropzoneSub}>Vous pouvez ajouter plusieurs fichiers</Text>
      </TouchableOpacity>

      {list.length > 0 && (
        <View style={styles.mediaGrid}>
          {list.map((m, i) => {
            const src = m.previewUrl || m.presignedUrl;
            return (
              <View key={i} style={styles.mediaCell}>
                {isImageMedia(m) && src ? (
                  <Image source={{ uri: src }} style={styles.mediaImage} />
                ) : (
                  <View style={styles.mediaDoc}>
                    <FontAwesome5 name="file-pdf" size={18} color="#EF4444" />
                    <Text style={styles.mediaDocName} numberOfLines={2}>{m.fileName}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.mediaRemove} onPress={() => removeMedia(i)}>
                  <FontAwesome5 name="trash" size={9} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ── Main view ───────────────────────────────────────────────────────────────

export interface CreateExerciseViewProps {
  onBack: () => void;
  /** Called after a successful create; `message` is the banner to show on the list. */
  onCreated: (message?: string, isError?: boolean) => void;
  /** Called after a successful update (web returns to the details view). */
  onUpdated?: (exerciseId: string, message?: string, isError?: boolean) => void;
  editingExercise?: Exercise | null;
}

type Toast = { kind: "success" | "warning" | "error"; text: string } | null;

export const CreateExerciseView = ({ onBack, onCreated, onUpdated, editingExercise }: CreateExerciseViewProps) => {
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const palette = useMemo(() => makePalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(colors, palette), [colors, palette]);
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const exerciseId = editingExercise?.id ?? null;
  const editMode = !!exerciseId;

  // Form values (web antd Form fields)
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [restriction, setRestriction] = useState("PRIVE");
  const [matiereIds, setMatiereIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loadingMatieres, setLoadingMatieres] = useState(false);
  const [originalMatiereIds, setOriginalMatiereIds] = useState<string[]>([]);

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDraft>(emptyQuestion());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(editMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const showToast = (text: string, kind: "success" | "warning" | "error" = "warning") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    setLoadingMatieres(true);
    matiereService
      .getAll()
      .then((d) => setMatieres(d || []))
      .catch(() => showToast("Impossible de charger les matières"))
      .finally(() => setLoadingMatieres(false));
  }, []);

  // Edit mode: load exercise + questions (web loadExercise)
  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([exerciseService.getById(exerciseId), questionService.getByExercise(exerciseId)])
      .then(([exo, qs]) => {
        if (cancelled) return;
        const ids = (exo.matieres || []).map((m) => String(m.id));
        setOriginalMatiereIds(ids);
        setNom(exo.nom || "");
        setDescription(exo.description || "");
        setNiveau(exo.niveau || "");
        setRestriction(exo.restriction || "PRIVE");
        setMatiereIds(ids);
        // Make sure linked matières always have a label even if not in getAll()
        setMatieres((prev) => {
          const known = new Set(prev.map((m) => String(m.id)));
          return [...prev, ...(exo.matieres || []).filter((m) => !known.has(String(m.id)))];
        });
        setQuestions(
          (qs || []).map((q) => ({
            ...q,
            id: q.id,
            intitule: q.intitule || "",
            typeQuestion: (q.typeQuestion as QuestionType) || "QCM",
            points: q.points ?? 1,
            medias: (q as any).medias || [],
            choixReponses: q.choixReponses
              ? [...q.choixReponses].sort((a, b) => (a.ordreAffichage ?? 0) - (b.ordreAffichage ?? 0))
              : [],
            reponse: q.reponse || "",
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setError("Erreur lors du chargement de l'exercice");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  // antd rules (shown after the first submit, then live)
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!submitted) return e;
    const n = nom.trim();
    if (!n) e.nom = "Le titre est requis";
    else if (nom.length < 3) e.nom = "Le titre doit contenir au moins 3 caractères";
    if (!niveau) e.niveau = "Requis";
    if (!description.trim()) e.description = "La description est requise";
    else if (description.length < 10) e.description = "La description doit contenir au moins 10 caractères";
    return e;
  }, [submitted, nom, niveau, description]);

  // ── Question actions ──────────────────────────────────────────────────────
  const handleAddQuestion = () => {
    const warn = validateQuestion(currentQuestion);
    if (warn) {
      showToast(warn, "warning");
      return;
    }
    if (editingIndex !== null) {
      setQuestions((prev) => prev.map((q, i) => (i === editingIndex ? { ...currentQuestion } : q)));
      setEditingIndex(null);
    } else {
      setQuestions((prev) => [...prev, { ...currentQuestion }]);
    }
    setCurrentQuestion(emptyQuestion(currentQuestion.typeQuestion));
    showToast(editingIndex !== null ? "Question mise à jour" : "Question ajoutée", "success");
  };
  const handleEditQuestion = (index: number) => {
    setCurrentQuestion({ ...questions[index] });
    setEditingIndex(index);
  };
  const handleRemoveQuestion = (index: number) => {
    const q = questions[index];
    if (editMode && q.id) setRemovedIds((prev) => [...prev, q.id as string]);
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setCurrentQuestion(emptyQuestion());
      setEditingIndex(null);
    }
  };
  const handleCancelEdit = () => {
    setCurrentQuestion(emptyQuestion(currentQuestion.typeQuestion));
    setEditingIndex(null);
  };
  const handleTypeChange = (value: string) =>
    setCurrentQuestion({
      ...currentQuestion,
      typeQuestion: value as QuestionType,
      choixReponses: getDefaultChoix(value),
      reponse: "",
    });

  const stepPoints = (dir: number) => {
    const next = Math.round(((currentQuestion.points || 0) + dir * 0.5) * 2) / 2;
    setCurrentQuestion({ ...currentQuestion, points: Math.min(100, Math.max(0.5, next)) });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const isValid = () =>
    nom.trim().length > 0 && nom.length >= 3 && !!niveau && description.trim().length > 0 && description.length >= 10;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!isValid()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!editMode) {
        const userId = user?.userId;
        if (!userId) throw new Error("Utilisateur non connecté.");
        const created = await exerciseService.create({
          nom,
          description,
          niveau: mapNiveauToEnum(niveau),
          restriction: restriction || "PRIVE",
          redacteurId: userId,
          etat: "BROUILLON",
        });
        let failedQuestions = 0;
        if (created?.id) {
          for (const mId of matiereIds) {
            try {
              await exerciseService.linkToMatiere(created.id, mId);
            } catch {
              // ignored, like web
            }
          }
          for (const q of questions) {
            try {
              await questionService.create(created.id, buildQuestionPayload(q));
            } catch (qErr) {
              failedQuestions += 1;
              console.error("[CreateExerciseView] failed to save question:", q, qErr);
            }
          }
        }
        if (failedQuestions > 0) {
          onCreated(
            `Exercice créé, mais ${failedQuestions} question${failedQuestions > 1 ? "s n'ont" : " n'a"} pas pu être enregistrée${failedQuestions > 1 ? "s" : ""}. Modifiez l'exercice pour les ajouter à nouveau.`,
            true
          );
        } else {
          onCreated("Exercice créé avec succès");
        }
      } else {
        const id = exerciseId as string;
        // 1. Update exercise metadata
        await exerciseService.update(id, {
          nom,
          description,
          niveau: niveau ? mapNiveauToEnum(niveau) : undefined,
          restriction: restriction || "PRIVE",
        });
        // 2. Sync matières — add new, remove old
        const toAdd = matiereIds.filter((m) => !originalMatiereIds.includes(m));
        const toRemove = originalMatiereIds.filter((m) => !matiereIds.includes(m));
        await Promise.allSettled([
          ...toAdd.map((m) => exerciseService.linkToMatiere(id, m)),
          ...toRemove.map((m) => exerciseService.unlinkFromMatiere(id, m)),
        ]);
        // 3. Delete removed questions
        await Promise.allSettled(removedIds.map((qid) => questionService.remove(qid)));
        // 4. Update existing questions / create new ones
        const results = await Promise.allSettled(
          questions.map((q) =>
            q.id
              ? questionService.update(q.id, buildQuestionUpdatePayload(q))
              : questionService.create(id, buildQuestionPayload(q))
          )
        );
        const failed = results.filter((r) => r.status === "rejected");
        const msg =
          failed.length > 0
            ? `Exercice mis à jour, mais ${failed.length} question${failed.length > 1 ? "s n'ont" : " n'a"} pas pu être enregistrée${failed.length > 1 ? "s" : ""}.`
            : "Exercice mis à jour avec succès";
        if (onUpdated) onUpdated(id, msg, failed.length > 0);
        else onCreated(msg, failed.length > 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : editMode ? "Erreur lors de la mise à jour" : "Erreur lors de la création";
      setError(msg);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <LoadingSpinner label="Chargement de l'exercice..." />
      </View>
    );
  }

  const typeOptions: SelectOption[] = QUESTION_TYPES.map((t) => ({ value: t.value, label: t.label, icon: t.icon, desc: t.desc }));
  const niveauOptions: SelectOption[] =
    niveau && !NIVEAU_OPTIONS.some((n) => n.value === niveau)
      ? [...NIVEAU_OPTIONS, { value: niveau, label: niveau }]
      : NIVEAU_OPTIONS;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header band */}
          <LinearGradient colors={["#1A3A5C", "#2D6A9F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <TouchableOpacity style={styles.heroBack} onPress={onBack} accessibilityLabel="Retour">
              <FontAwesome5 name="arrow-left" size={15} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.heroIcon}>
              <FontAwesome5 name="book" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle}>{editMode ? "Modifier l'exercice" : "Créer un exercice"}</Text>
              <Text style={styles.heroSub}>
                {editMode ? "Modifiez les informations et les questions" : "Renseignez les informations et ajoutez vos questions"}
              </Text>
            </View>
            {editMode && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{questions.length} Q</Text>
              </View>
            )}
          </LinearGradient>

          {error ? (
            <View style={styles.errorBox}>
              <FontAwesome5 name="times-circle" size={14} color={palette.errorText} solid style={{ marginTop: 2 }} />
              <Text style={styles.errorBoxText}>{error}</Text>
              <TouchableOpacity onPress={() => setError("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome5 name="times" size={12} color={palette.sub} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Informations générales ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.cardHeadIcon, { backgroundColor: palette.blueSoft }]}>
                <FontAwesome5 name="info-circle" size={14} color="#2D6A9F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeadTitle}>Informations générales</Text>
                <Text style={styles.cardHeadSub}>Titre, niveau et visibilité</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                <Text style={styles.required}>* </Text>Titre de l'exercice
              </Text>
              <FormInput
                styles={styles}
                palette={palette}
                error={!!errors.nom}
                value={nom}
                onChangeText={setNom}
                placeholder="Ex : Équations du 2ᵉ degré"
                maxLength={200}
              />
              <View style={styles.counterRow}>
                <FieldError message={errors.nom} styles={styles} />
                <Text style={styles.counter}>{nom.length} / 200</Text>
              </View>
            </View>

            <View style={styles.twoCols}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>
                  <Text style={styles.required}>* </Text>Niveau
                </Text>
                <SelectField
                  value={niveau}
                  options={niveauOptions}
                  onChange={setNiveau}
                  title="Niveau"
                  placeholder="Sélectionner"
                  error={!!errors.niveau}
                  styles={styles}
                  palette={palette}
                />
                <FieldError message={errors.niveau} styles={styles} />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>
                  <Text style={styles.required}>* </Text>Visibilité
                </Text>
                <SelectField
                  value={restriction}
                  options={[
                    { value: "PUBLIC", label: "Public", icon: "eye" },
                    { value: "PRIVE", label: "Privé", icon: "lock" },
                  ]}
                  onChange={setRestriction}
                  title="Visibilité"
                  styles={styles}
                  palette={palette}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Matières associées</Text>
              <MultiSelectField
                values={matiereIds}
                options={matieres.map((m) => ({ value: String(m.id), label: m.nom }))}
                onChange={setMatiereIds}
                loading={loadingMatieres}
                placeholder="Sélectionner les matières"
                title="Matières associées"
                styles={styles}
                palette={palette}
              />
            </View>

            <View style={[styles.field, { marginBottom: 0 }]}>
              <Text style={styles.label}>
                <Text style={styles.required}>* </Text>Description
              </Text>
              <FormInput
                styles={styles}
                palette={palette}
                error={!!errors.description}
                value={description}
                onChangeText={setDescription}
                placeholder="Objectifs pédagogiques, consignes..."
                maxLength={1000}
                multiline
                textAlignVertical="top"
                style={{ minHeight: 132 }}
              />
              <View style={styles.counterRow}>
                <FieldError message={errors.description} styles={styles} />
                <Text style={styles.counter}>{description.length} / 1000</Text>
              </View>
            </View>
          </View>

          {/* ── Questions ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.cardHeadIcon, { backgroundColor: palette.purpleSoft }]}>
                <Text style={{ color: palette.purpleText, fontSize: 15, fontWeight: "700" }}>Q</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowCenter}>
                  <Text style={styles.cardHeadTitle}>Questions</Text>
                  {questions.length > 0 && (
                    <View style={[styles.countPill, { backgroundColor: palette.purpleSoft }]}>
                      <Text style={[styles.countPillText, { color: palette.purpleText }]}>{questions.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardHeadSub}>
                  {editMode ? "Modifiez, ajoutez ou supprimez des questions" : "Construisez les questions de votre exercice"}
                </Text>
              </View>
            </View>

            {/* Added questions list */}
            {questions.length > 0 && (
              <View style={styles.qList}>
                <View style={styles.qListHead}>
                  <Text style={styles.qListHeadText}>
                    {questions.length} question{questions.length > 1 ? "s" : ""} ajoutée{questions.length > 1 ? "s" : ""}
                  </Text>
                </View>
                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {questions.map((q, i) => {
                    const t = QUESTION_TYPES.find((x) => x.value === q.typeQuestion);
                    const isEditing = editingIndex === i;
                    return (
                      <TouchableOpacity
                        key={q.id ?? `new-${i}`}
                        style={[styles.qRow, isEditing && { backgroundColor: palette.qRowActive }, i < questions.length - 1 && styles.qRowBorder]}
                        onPress={() => handleEditQuestion(i)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.qNum, { backgroundColor: isEditing ? "#6D28D9" : palette.qNumBg }]}>
                          <Text style={[styles.qNumText, { color: isEditing ? "#FFFFFF" : "#6B7280" }]}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          {q.intitule ? (
                            <Text style={styles.qTitle} numberOfLines={1}>{q.intitule}</Text>
                          ) : (
                            <Text style={[styles.qTitle, { color: palette.sub, fontStyle: "italic" }]}>Sans intitulé</Text>
                          )}
                          <View style={styles.rowCenter}>
                            {t ? <FontAwesome5 name={t.icon as any} size={10} color={palette.sub} /> : null}
                            <Text style={styles.qMeta}>
                              {t?.label} · {q.points} pt{q.points > 1 ? "s" : ""}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveQuestion(i)} style={styles.iconBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <FontAwesome5 name="trash" size={12} color="#F87171" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Builder */}
            <View style={styles.builder}>
              <Text style={styles.builderTitle}>
                {editingIndex !== null ? `MODIFIER LA QUESTION ${editingIndex + 1}` : "NOUVELLE QUESTION"}
              </Text>

              {/* Type + Points (stacked at phone width like web's grid-cols-1) */}
              <View style={styles.builderField}>
                <Text style={styles.smallLabel}>Type de question</Text>
                <SelectField
                  value={currentQuestion.typeQuestion}
                  options={typeOptions}
                  onChange={handleTypeChange}
                  title="Type de question"
                  styles={styles}
                  palette={palette}
                />
              </View>
              <View style={styles.builderField}>
                <Text style={styles.smallLabel}>Points</Text>
                <View style={styles.pointsRow}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepPoints(-1)}>
                    <FontAwesome5 name="minus" size={10} color={palette.label} />
                  </TouchableOpacity>
                  <FormInput
                    styles={styles}
                    palette={palette}
                    value={String(currentQuestion.points ?? "")}
                    onChangeText={(t) => {
                      const v = parseFloat(t.replace(",", "."));
                      setCurrentQuestion({ ...currentQuestion, points: isNaN(v) ? (0 as number) : Math.min(100, v) });
                    }}
                    onBlur={() => {
                      if (!currentQuestion.points || currentQuestion.points < 0.5)
                        setCurrentQuestion({ ...currentQuestion, points: 0.5 });
                    }}
                    keyboardType="decimal-pad"
                    style={{ flex: 1, textAlign: "center", paddingVertical: 8 }}
                  />
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepPoints(1)}>
                    <FontAwesome5 name="plus" size={10} color={palette.label} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.builderField}>
                <Text style={styles.smallLabel}>Intitulé de la question</Text>
                <FormInput
                  styles={styles}
                  palette={palette}
                  value={currentQuestion.intitule}
                  onChangeText={(t) => setCurrentQuestion({ ...currentQuestion, intitule: t })}
                  placeholder="Posez votre question ici…"
                  multiline
                  textAlignVertical="top"
                  style={{ minHeight: 56 }}
                />
              </View>

              <View style={[styles.builderField, { marginBottom: 16 }]}>
                <AnswerBuilder question={currentQuestion} onChange={setCurrentQuestion} styles={styles} palette={palette} />
              </View>

              <View style={[styles.builderField, { marginBottom: 16 }]}>
                <QuestionMediaAttachments
                  medias={currentQuestion.medias}
                  onChange={(medias) => setCurrentQuestion((prev) => ({ ...prev, medias }))}
                  ownerId={user?.userId}
                  onWarn={(m, kind) => showToast(m, kind ?? "warning")}
                  styles={styles}
                  palette={palette}
                />
              </View>

              <View style={styles.builderActions}>
                {editingIndex !== null && (
                  <TouchableOpacity style={styles.builderCancel} onPress={handleCancelEdit} activeOpacity={0.85}>
                    <Text style={styles.builderCancelText}>Annuler</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.builderAdd} onPress={handleAddQuestion} activeOpacity={0.85}>
                  <FontAwesome5 name={editingIndex !== null ? "save" : "plus"} size={12} color="#FFFFFF" />
                  <Text style={styles.builderAddText}>{editingIndex !== null ? "Mettre à jour" : "Ajouter la question"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Tips (create only, like web) */}
          {!editMode && (
            <View style={styles.tips}>
              <View style={styles.rowCenter}>
                <FontAwesome5 name="info-circle" size={13} color="#2563EB" />
                <Text style={styles.tipsTitle}>Conseils</Text>
              </View>
              <Text style={styles.tipsText}>
                ① Choisissez le <Text style={styles.bold}>niveau</Text> correspondant à l'enum backend (Collège, Lycée…).
              </Text>
              <Text style={styles.tipsText}>
                ② Dans le constructeur : sélectionnez le <Text style={styles.bold}>type</Text>, définissez les{" "}
                <Text style={styles.bold}>points</Text>, rédigez l'<Text style={styles.bold}>intitulé</Text> et les réponses, puis
                touchez <Text style={styles.bold}>Ajouter</Text>.
              </Text>
              <Text style={styles.tipsText}>
                ③ L'exercice est créé en état <Text style={styles.bold}>Brouillon</Text> — programmez-le ensuite pour le diffuser.
              </Text>
            </View>
          )}

          {/* Action bar */}
          <View style={[styles.actionBar, editMode && { flexDirection: "column", alignItems: "stretch" }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, !editMode && { flex: 1 }]}
              onPress={onBack}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, !editMode && { flex: 1.4 }, saving && { opacity: 0.75 }]}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="save" size={14} color="#FFFFFF" />}
              <Text style={styles.submitBtnText}>{editMode ? "Enregistrer" : "Créer l'exercice"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {toast && (
        <View
          style={[
            styles.toast,
            toast.kind === "success" ? styles.toastSuccess : toast.kind === "error" ? styles.toastError : styles.toastWarning,
          ]}
          pointerEvents="box-none"
        >
          <FontAwesome5
            name={toast.kind === "success" ? "check-circle" : toast.kind === "error" ? "times-circle" : "exclamation-circle"}
            size={14}
            color={toast.kind === "success" ? "#52C41A" : toast.kind === "error" ? "#FF4D4F" : "#FAAD14"}
            solid
          />
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    // Rendered under the shared app header — normal top spacing only.
    scrollContent: { paddingHorizontal: 12, paddingTop: 12 },
    rowCenter: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    bold: { fontWeight: "700" },

    // Header band
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 16,
      marginBottom: 16,
    },
    heroBack: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 17, lineHeight: 21 },
    heroSub: { color: "#DBEAFE", fontSize: 12, opacity: 0.9, marginTop: 1 },
    heroBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    heroBadgeText: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },

    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: p.errorBg,
      borderWidth: 1,
      borderColor: p.errorBorder,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorBoxText: { flex: 1, fontSize: 13, color: p.body },

    // Cards
    card: {
      backgroundColor: p.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.cardBorder,
      padding: 16,
      marginBottom: 16,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingBottom: 12,
      marginBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: p.headDivider,
    },
    cardHeadIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    cardHeadTitle: { fontSize: 14, fontWeight: "700", color: p.title },
    cardHeadSub: { fontSize: 12, color: p.sub, marginTop: 1 },
    countPill: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, marginLeft: 4 },
    countPillText: { fontSize: 12, fontWeight: "800" },

    // Fields
    field: { marginBottom: 18 },
    twoCols: { flexDirection: "row", gap: 12 },
    label: { fontSize: 14, color: p.body, marginBottom: 8 },
    required: { color: "#FF4D4F" },
    smallLabel: { fontSize: 12, fontWeight: "600", color: p.label, marginBottom: 5 },
    hint: { fontSize: 12, color: p.sub, marginBottom: 8 },
    input: {
      backgroundColor: p.input,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 11,
      paddingVertical: 9,
      fontSize: 14,
      color: p.title,
    },
    inputFocused: { borderColor: "#4096FF" },
    inputError: { borderColor: "#FF4D4F" },
    fieldErrorText: { fontSize: 13, color: p.errorText, flex: 1, marginTop: 4 },
    counterRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-end", gap: 8 },
    counter: { fontSize: 12, color: p.sub, marginTop: 4 },

    selectField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 40 },
    selectText: { fontSize: 14, color: p.title, flexShrink: 1 },
    multiField: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingVertical: 5 },
    multiChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" },
    multiChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: p.chipBg,
      borderWidth: 1,
      borderColor: p.chipBorder,
      borderRadius: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      maxWidth: "100%",
    },
    multiChipText: { fontSize: 13, color: p.title, flexShrink: 1 },
    sheetSearch: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingVertical: 0, height: 40 },
    sheetSearchInput: { flex: 1, fontSize: 14, color: p.title, paddingVertical: 0 },
    sheetEmpty: { textAlign: "center", color: p.sub, paddingVertical: 20, fontSize: 14 },
    sheetOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      gap: 8,
    },
    sheetOptionText: { fontSize: 15, color: colors.text, flexShrink: 1 },
    sheetOptionTextActive: { color: "#4F46E5", fontWeight: "700" },
    sheetOptionDesc: { fontSize: 12, color: p.sub, fontWeight: "400" },

    // Question list
    qList: {
      borderWidth: 1,
      borderColor: p.qListBorder,
      backgroundColor: p.builderBg,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    },
    qListHead: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: p.qListHead,
      borderBottomWidth: 1,
      borderBottomColor: p.qListBorder,
    },
    qListHeadText: { fontSize: 11, fontWeight: "700", color: p.purpleText, letterSpacing: 0.5, textTransform: "uppercase" },
    qRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
    qRowBorder: { borderBottomWidth: 1, borderBottomColor: p.headDivider },
    qNum: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    qNumText: { fontSize: 12, fontWeight: "800" },
    qTitle: { fontSize: 14, fontWeight: "500", color: p.title },
    qMeta: { fontSize: 12, color: p.sub },
    iconBtn: { padding: 6, borderRadius: 6 },

    // Builder
    builder: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: p.builderBorder,
      backgroundColor: p.builderBg,
      borderRadius: 12,
      padding: 14,
    },
    builderTitle: { fontSize: 11, fontWeight: "700", color: p.indigoText, letterSpacing: 0.5, marginBottom: 12 },
    builderField: { marginBottom: 12 },
    pointsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepBtn: {
      width: 38,
      height: 38,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.inputBorder,
      backgroundColor: p.input,
      alignItems: "center",
      justifyContent: "center",
    },
    vfBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.borderLight,
      backgroundColor: p.input,
      alignItems: "center",
    },
    vfBtnActive: { borderColor: "#22C55E", backgroundColor: p.greenBg },
    vfText: { fontSize: 14, fontWeight: "700", color: p.sub },
    vfTextActive: { color: p.green },
    choiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    moveBtn: { padding: 2 },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: p.inputBorder,
      backgroundColor: p.input,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
    choiceIndex: { width: 18, textAlign: "center", fontSize: 12, fontWeight: "800", color: p.sub },
    addChoiceBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "#A5B4FC",
    },
    addChoiceText: { fontSize: 12, fontWeight: "600", color: "#4F46E5" },

    // Media
    dropzone: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: "#C7D2FE",
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      gap: 6,
    },
    dropzoneBusy: { borderColor: colors.borderLight },
    dropzoneText: { fontSize: 12, fontWeight: "600", color: p.label, textAlign: "center" },
    dropzoneSub: { fontSize: 10, color: p.sub },
    mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    mediaCell: { width: "31%", aspectRatio: 1 },
    mediaImage: { width: "100%", height: "100%", borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight },
    mediaDoc: {
      width: "100%",
      height: "100%",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: p.actionBg,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      padding: 4,
    },
    mediaDocName: { fontSize: 9, color: p.sub, textAlign: "center" },
    mediaRemove: {
      position: "absolute",
      top: -6,
      right: -6,
      backgroundColor: "#EF4444",
      borderRadius: 999,
      padding: 5,
    },

    builderActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
    builderCancel: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.inputBorder,
      backgroundColor: p.input,
    },
    builderCancelText: { fontSize: 14, color: p.body },
    builderAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: "#6D28D9",
    },
    builderAddText: { fontSize: 14, color: "#FFFFFF", fontWeight: "500" },

    // Tips
    tips: {
      backgroundColor: p.tipsBg,
      borderWidth: 1,
      borderColor: p.tipsBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
      gap: 3,
    },
    tipsTitle: { fontSize: 14, fontWeight: "700", color: p.tipsTitle, marginBottom: 3 },
    tipsText: { fontSize: 12, color: p.tipsText, lineHeight: 17 },

    // Action bar
    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: p.actionBg,
      borderWidth: 1,
      borderColor: p.cardBorder,
    },
    cancelBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: p.inputBorder,
      backgroundColor: p.input,
    },
    cancelBtnText: { fontSize: 15, color: p.body },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: "#1A3A5C",
    },
    submitBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

    // Toast (antd message)
    toast: {
      position: "absolute",
      top: 12,
      alignSelf: "center",
      maxWidth: "92%",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: p.card,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastSuccess: { borderColor: "#B7EB8F" },
    toastWarning: { borderColor: "#FFE58F" },
    toastError: { borderColor: "#FFCCC7" },
    toastText: { fontSize: 14, color: p.title, flexShrink: 1 },
  });

type Styles = ReturnType<typeof createStyles>;

export default CreateExerciseView;
