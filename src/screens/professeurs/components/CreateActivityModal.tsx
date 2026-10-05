import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../context/UserContext";
import { useAuthStore } from "../../../store/useAuthStore";
import { useThemeColors } from "../../../styles/theme";
import { useThemeStore } from "../../../store/useThemeStore";
import { activityFeedService, mediaService } from "../../../services/api";
import { classService } from "../../../services/classService";
import ActivityMediaImage from "../../../components/common/ActivityMediaImage";
import { ActivityEvent, ActivityMedia as RawActivityMedia, ClassEntity } from "../../../types";
import { formatDateTime, parseServerDate, serverDateMs, toServerDateTime } from "../../../utils/dates";

/** A picked file that hasn't been uploaded yet. */
interface PickedMedia {
  key: string;
  uri: string;
  type: "IMAGE" | "VIDEO";
  name: string;
  mimeType: string;
  fileSizeBytes?: number;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB, same limit as web
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

interface CreateActivityModalProps {
  onClose: () => void;
  /** Called after a successful create or edit. The parent reloads the feed from page 0, as web does. */
  onSaved: (mode: "create" | "edit") => void;
  /** Opens the modal in edit mode, prefilled from this event. */
  activityToEdit?: ActivityEvent | null;
}

const fmtDateTime = (iso?: string) =>
  formatDateTime(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Date + time field. iOS uses one combined picker; Android needs a date dialog, then a time dialog. Emits an ISO string. */
const DateTimeInput = ({
  label,
  value,
  onChange,
  styles,
  colors,
  clearable,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useThemeColors>;
  clearable?: boolean;
}) => {
  const [stage, setStage] = useState<"none" | "date" | "time">("none");
  const [pending, setPending] = useState<Date>(new Date());

  const open = () => {
    setPending(parseServerDate(value) ?? new Date());
    setStage("date");
  };

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateField} onPress={open} activeOpacity={0.8}>
        <FontAwesome5 name="calendar-alt" size={12} color={colors.textLight} />
        <Text style={[styles.dateText, !value && { color: colors.textLight }]} numberOfLines={1}>
          {value ? fmtDateTime(value) : "jj/mm/aaaa --:--"}
        </Text>
        {clearable && value ? (
          <TouchableOpacity onPress={() => onChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times-circle" size={12} color={colors.textLight} solid />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
      {stage === "date" && (
        <DateTimePicker
          value={pending}
          mode={Platform.OS === "ios" ? "datetime" : "date"}
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(event, selected) => {
            if (Platform.OS === "android") {
              setStage("none");
              if (event.type === "dismissed" || !selected) return;
              setPending(selected);
              setStage("time");
              return;
            }
            if (event.type === "dismissed" || !selected) {
              setStage("none");
              return;
            }
            onChange(selected.toISOString());
          }}
        />
      )}
      {stage === "time" && (
        <DateTimePicker
          value={pending}
          mode="time"
          is24Hour
          display="default"
          onChange={(event, selected) => {
            setStage("none");
            if (event.type === "dismissed" || !selected) return;
            const merged = new Date(pending);
            merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            onChange(merged.toISOString());
          }}
        />
      )}
      {Platform.OS === "ios" && stage === "date" ? (
        <TouchableOpacity style={styles.iosDone} onPress={() => setStage("none")}>
          <Text style={styles.iosDoneText}>OK</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

/**
 * Create / edit event sheet, ported from web's "Nouvel Événement" and
 * "Modifier l'événement" modals in ActivitiesContent.jsx: same fields, same
 * required fields (title, description, location, start), same check that the
 * end is after the start, same Public/Privé switch with a class picker, same
 * media rules (images up to 5 MB, videos up to 50 MB), and the same
 * POST/PUT /evenements payload.
 */
const CreateActivityModal = ({ onClose, onSaved, activityToEdit }: CreateActivityModalProps) => {
  const { user } = useUser();
  const role = useAuthStore((s) => s.role);
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode === "dark");
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const isEditMode = !!activityToEdit;

  const [form, setForm] = useState({
    titre: activityToEdit?.titre ?? "",
    description: activityToEdit?.description ?? "",
    lieu: activityToEdit?.lieu ?? "",
    heureDebut: toServerDateTime(activityToEdit?.heureDebut) ?? "",
    heureFin: toServerDateTime(activityToEdit?.heureFin) ?? "",
    visibility: (activityToEdit?.visibility ?? "PUBLIC") as "PUBLIC" | "PRIVATE",
    classesIds: (activityToEdit?.classesIds ?? []) as string[],
  });
  // Media already stored on the backend; their `id` is sent back so the backend keeps them.
  const [existingMedias, setExistingMedias] = useState<RawActivityMedia[]>(
    (activityToEdit?.medias ?? []).filter((m) => {
      const t = (m.mediaType || "").toUpperCase();
      return (t === "IMAGE" || t === "PHOTO" || t === "VIDEO") && m.id;
    })
  );
  const [picked, setPicked] = useState<PickedMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Web loads the role's class list only when "Privé" is selected.
  useEffect(() => {
    if (form.visibility !== "PRIVATE" || !user?.userId || classes.length > 0) return;
    setLoadingClasses(true);
    classService
      .getClassesForRole(role, user.userId)
      .then(setClasses)
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [form.visibility, user?.userId, role, classes.length]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((p) => ({ ...p, [key]: value }));

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l'accès à vos photos pour ajouter un média.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const accepted: PickedMedia[] = [];
    for (const asset of result.assets) {
      const isVideo = asset.type === "video";
      const max = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      const name = asset.fileName ?? `${isVideo ? "video" : "image"}_${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
      if (asset.fileSize && asset.fileSize > max) {
        Alert.alert(
          "Fichier trop volumineux",
          `${name} est trop volumineux (${(asset.fileSize / 1024 / 1024).toFixed(1)} Mo). Maximum: ${max / 1024 / 1024} Mo`
        );
        continue;
      }
      accepted.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        uri: asset.uri,
        type: isVideo ? "VIDEO" : "IMAGE",
        name,
        mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
        fileSizeBytes: asset.fileSize,
      });
    }
    setPicked((prev) => [...prev, ...accepted]);
  };

  const toggleClass = (id: string) =>
    set("classesIds", form.classesIds.includes(id) ? form.classesIds.filter((c) => c !== id) : [...form.classesIds, id]);

  const canSubmit =
    !submitting &&
    !uploading &&
    !!form.titre.trim() &&
    !!form.description.trim() &&
    !!form.lieu.trim() &&
    !!form.heureDebut &&
    !(form.visibility === "PRIVATE" && form.classesIds.length === 0);

  const handleSubmit = async () => {
    setError("");
    if (!form.titre.trim() || !form.description.trim() || !form.lieu.trim() || !form.heureDebut) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (form.heureFin && serverDateMs(form.heureFin) <= serverDateMs(form.heureDebut)) {
      setError("La date de fin doit être postérieure à la date de début.");
      return;
    }
    if (!user?.userId) {
      setError("Utilisateur non identifié.");
      return;
    }
    setSubmitting(true);
    try {
      // Upload new files one by one; a failed file is skipped, like on web.
      const uploaded: {
        fileName: string;
        filePath: string;
        fileType: string;
        contentType: string;
        fileSize: number;
        mediaType: string;
        bucketName: string;
      }[] = [];
      if (picked.length > 0) {
        setUploading(true);
        for (const media of picked) {
          try {
            const ref = await mediaService.uploadFileWithPath(
              { uri: media.uri, mimeType: media.mimeType, name: media.name },
              user.userId as string,
              media.type,
              "general"
            );
            uploaded.push({
              fileName: ref.fileName,
              filePath: ref.filePath,
              fileType: media.type,
              contentType: media.mimeType,
              fileSize: media.fileSizeBytes ?? 0,
              mediaType: media.type,
              bucketName: "scholchat",
            });
          } catch (e) {
            console.warn("Upload error:", media.name, e);
          }
        }
        setUploading(false);
      }

      const kept = existingMedias.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        filePath: m.filePath,
        fileType: m.fileType || m.mediaType || "IMAGE",
        contentType: m.contentType,
        fileSize: m.fileSize,
        mediaType: m.mediaType || "IMAGE",
        bucketName: m.bucketName || "scholchat",
      }));

      const classesIds = form.visibility === "PRIVATE" ? form.classesIds : [];
      const payload = {
        titre: form.titre.trim(),
        description: form.description.trim(),
        lieu: form.lieu.trim(),
        etat: "PLANIFIE",
        heureDebut: toServerDateTime(form.heureDebut) ?? undefined,
        heureFin: toServerDateTime(form.heureFin) ?? undefined,
        visibility: form.visibility,
        classesIds,
        medias: [...kept, ...uploaded],
      };

      if (isEditMode && activityToEdit) {
        await activityFeedService.update(String(activityToEdit.id), {
          ...payload,
          createurId: activityToEdit.createurId ?? user.userId,
          // Keep the current participants (web's edit form doesn't carry them and sends []).
          participantsIds: activityToEdit.participantsIds ?? [],
        });
        onSaved("edit");
      } else {
        await activityFeedService.create({
          ...payload,
          createurId: user.userId,
          participantsIds: [],
        });
        onSaved("create");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement de l'événement.");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{isEditMode ? "Modifier l'événement" : "Nouvel Événement"}</Text>
              {!isEditMode ? <Text style={styles.headerSub}>PARTAGEZ AVEC VOTRE COMMUNAUTÉ</Text> : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Titre de l'événement *</Text>
            <TextInput
              style={styles.input}
              value={form.titre}
              onChangeText={(t) => set("titre", t)}
              placeholder="Ex: Réunion parents-professeurs"
              placeholderTextColor={colors.textLight}
            />

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(t) => set("description", t)}
              placeholder="Décrivez votre événement..."
              placeholderTextColor={colors.textLight}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>Visibilité</Text>
            <View style={styles.visRow}>
              {(["PUBLIC", "PRIVATE"] as const).map((v) => {
                const active = form.visibility === v;
                const accent = v === "PUBLIC" ? "#3B82F6" : "#8B5CF6";
                return (
                  <TouchableOpacity
                    key={v}
                    style={[
                      styles.visBtn,
                      active && {
                        borderColor: accent,
                        backgroundColor: isDark ? (v === "PUBLIC" ? "rgba(59,130,246,0.18)" : "rgba(139,92,246,0.18)") : v === "PUBLIC" ? "#EFF6FF" : "#F5F3FF",
                      },
                    ]}
                    onPress={() => set("visibility", v)}
                  >
                    <FontAwesome5 name={v === "PUBLIC" ? "globe" : "lock"} size={13} color={active ? accent : colors.textLight} />
                    <Text style={[styles.visText, active && { color: accent }]}>{v === "PUBLIC" ? "PUBLIC" : "PRIVÉ"}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.visibility === "PRIVATE" && (
              <>
                <Text style={styles.label}>Classes concernées *</Text>
                {loadingClasses ? (
                  <View style={styles.inlineRow}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.helpText}>RECHERCHE DES CLASSES ...</Text>
                  </View>
                ) : classes.length === 0 ? (
                  <Text style={styles.helpText}>Aucune classe disponible</Text>
                ) : (
                  <ScrollView style={styles.classBox} nestedScrollEnabled>
                    <View style={styles.classGrid}>
                      {classes.map((cls) => {
                        const selected = form.classesIds.includes(cls.id);
                        return (
                          <TouchableOpacity
                            key={cls.id}
                            style={[styles.classItem, selected && styles.classItemActive]}
                            onPress={() => toggleClass(cls.id)}
                          >
                            <FontAwesome5
                              name={selected ? "check-square" : "square"}
                              solid={selected}
                              size={14}
                              color={selected ? "#7C3AED" : colors.textLight}
                            />
                            <Text style={styles.classText} numberOfLines={1}>
                              {cls.nom || cls.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </>
            )}

            <Text style={styles.label}>Lieu *</Text>
            <View style={styles.iconInputWrap}>
              <FontAwesome5 name="map-marker-alt" size={14} color={colors.textLight} style={styles.iconInputIcon} />
              <TextInput
                style={[styles.input, { paddingLeft: 40, marginBottom: 0 }]}
                value={form.lieu}
                onChangeText={(t) => set("lieu", t)}
                placeholder="Ex: Salle 101"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.dateRow}>
              <DateTimeInput
                label="Date & heure début *"
                value={form.heureDebut}
                onChange={(v) => set("heureDebut", v)}
                styles={styles}
                colors={colors}
              />
              <DateTimeInput
                label="Heure fin (optionnel)"
                value={form.heureFin}
                onChange={(v) => set("heureFin", v)}
                styles={styles}
                colors={colors}
                clearable
              />
            </View>

            {existingMedias.length > 0 && (
              <>
                <Text style={styles.label}>Médias actuels</Text>
                <View style={styles.thumbGrid}>
                  {existingMedias.map((m) => (
                    <View key={`existing-${m.id}`} style={styles.thumbCell}>
                      {(m.mediaType || "").toUpperCase() === "VIDEO" ? (
                        <View style={[styles.thumb, styles.videoThumb]}>
                          <FontAwesome5 name="video" size={18} color="#FFFFFF" />
                        </View>
                      ) : (
                        <ActivityMediaImage mediaId={m.id} presignedUrl={m.presignedUrl ?? null} style={styles.thumb} />
                      )}
                      <TouchableOpacity
                        style={styles.removeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => setExistingMedias((prev) => prev.filter((x) => x.id !== m.id))}
                      >
                        <FontAwesome5 name="trash-alt" size={10} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Photos & Vidéos</Text>
            <TouchableOpacity style={styles.dropzone} onPress={pickMedia} activeOpacity={0.8}>
              <View style={styles.dropIcon}>
                {uploading ? (
                  <ActivityIndicator color="#2563EB" />
                ) : (
                  <FontAwesome5 name="image" size={24} color="#2563EB" />
                )}
              </View>
              <Text style={styles.dropTitle}>AJOUTER DES MÉDIAS</Text>
              <Text style={styles.dropSub}>PHOTOS OU VIDÉOS (MAX 50MO)</Text>
            </TouchableOpacity>

            {picked.length > 0 && (
              <View style={[styles.thumbGrid, { marginTop: 12 }]}>
                {picked.map((m) => (
                  <View key={m.key} style={styles.thumbCell}>
                    {m.type === "VIDEO" ? (
                      <View style={[styles.thumb, styles.videoThumb]}>
                        <FontAwesome5 name="video" size={18} color="#FFFFFF" />
                      </View>
                    ) : (
                      <Image source={{ uri: m.uri }} style={styles.thumb} />
                    )}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setPicked((prev) => prev.filter((x) => x.key !== m.key))}
                    >
                      <FontAwesome5 name="trash-alt" size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            {error ? (
              <View style={styles.errorBox}>
                <FontAwesome5 name="times" size={12} color={isDark ? "#FCA5A5" : "#B91C1C"} style={{ marginTop: 2 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>ANNULER</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onPress={handleSubmit}>
                <LinearGradient
                  colors={canSubmit ? ["#2563EB", "#4F46E5"] : ["#9CA3AF", "#6B7280"]}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtn}
                >
                  {submitting || uploading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitText}>{uploading ? "UPLOAD..." : "ENVOI..."}</Text>
                    </>
                  ) : (
                    <Text style={styles.submitText}>{isEditMode ? "ENREGISTRER" : "PUBLIER L'ÉVÉNEMENT"}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) => {
  const inputBg = isDark ? "#0F172A" : "#F9FAFB"; // gray-50 / gray-900
  const inputBorder = isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6";
  const strong = isDark ? "#FFFFFF" : "#111827";
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      height: "92%",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : "#F3F4F6",
    },
    headerTitle: { fontSize: 20, fontWeight: "900", color: strong },
    headerSub: { fontSize: 10, fontWeight: "700", color: "#6B7280", letterSpacing: 1.5, marginTop: 2 },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceElevated : "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
    },
    body: { padding: 20, paddingBottom: 40 },
    label: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: strong,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      fontSize: 15,
      fontWeight: "500",
      color: colors.text,
    },
    textArea: { minHeight: 110 },
    visRow: { flexDirection: "row", gap: 8 },
    visBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: inputBorder,
      backgroundColor: inputBg,
    },
    visText: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: colors.textMuted },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
    helpText: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1 },
    classBox: { maxHeight: 208, borderWidth: 1, borderColor: inputBorder, borderRadius: 16, padding: 8 },
    classGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
    classItem: {
      width: "48.5%",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: inputBorder,
      backgroundColor: inputBg,
    },
    classItemActive: {
      backgroundColor: isDark ? "rgba(139,92,246,0.18)" : "#FAF5FF",
      borderColor: isDark ? "#6B21A8" : "#E9D5FF",
    },
    classText: { flex: 1, fontSize: 10, fontWeight: "900", textTransform: "uppercase", color: colors.text },
    iconInputWrap: { position: "relative", justifyContent: "center" },
    iconInputIcon: { position: "absolute", left: 16, zIndex: 1 },
    dateRow: { flexDirection: "row", gap: 12 },
    dateField: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 15,
    },
    dateText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.text },
    iosDone: { alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6 },
    iosDoneText: { color: "#2563EB", fontWeight: "700" },
    dropzone: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB",
      borderRadius: 16,
      paddingVertical: 28,
      alignItems: "center",
    },
    dropIcon: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    dropTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: isDark ? "#D1D5DB" : "#374151" },
    dropSub: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: "#9CA3AF", marginTop: 4 },
    thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    thumbCell: { width: "30%", aspectRatio: 1, position: "relative" },
    thumb: { width: "100%", height: "100%", borderRadius: 12 },
    videoThumb: { backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" },
    removeBtn: {
      position: "absolute",
      top: -8,
      right: -8,
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: "#EF4444",
      alignItems: "center",
      justifyContent: "center",
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
      backgroundColor: colors.surface,
      gap: 12,
    },
    errorBox: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: isDark ? "rgba(127,29,29,0.2)" : "#FEF2F2",
      borderColor: isDark ? "#991B1B" : "#FECACA",
    },
    errorText: { flex: 1, fontSize: 12, fontWeight: "500", color: isDark ? "#FCA5A5" : "#B91C1C" },
    footerRow: { flexDirection: "row", gap: 12 },
    cancelBtn: { flex: 1, paddingVertical: 15, alignItems: "center", justifyContent: "center", borderRadius: 16 },
    cancelText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textMuted },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
      borderRadius: 16,
    },
    submitText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  });
};

export default CreateActivityModal;
