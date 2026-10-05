import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FontAwesome5 } from "@expo/vector-icons";
import { mediaService, userService } from "../../services/api";
import { extractErrorMessage } from "../../services/api/client";
import { storageService } from "../../services/storageService";
import { useFileOpener } from "../../hooks/useFileOpener";
import { PROFESSOR_DOCS, ProfessorDocKey } from "../../hooks/useProfessorDocumentsUpload";
import { toRelativePath } from "../../components/common/DocumentPreview";
import { useAuthStore } from "../../store/useAuthStore";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { TranslationKey, translate, useT } from "../../i18n";
import { ProfessorVerificationStatus } from "../../types";

type DocField = (typeof PROFESSOR_DOCS)[number]["field"];

const LABELS: Record<ProfessorDocKey, TranslationKey> = {
  cniRecto: "settings.cniRecto",
  cniVerso: "settings.cniVerso",
  selfie: "settings.photo",
};

const STATUS_STYLE: Record<ProfessorVerificationStatus, { icon: string; color: string }> = {
  VALIDE: { icon: "check-circle", color: "#16A34A" },
  EN_ATTENTE_VALIDATION: { icon: "hourglass-half", color: "#D97706" },
  DOCUMENTS_MANQUANTS: { icon: "file-upload", color: "#2563EB" },
  REJETE: { icon: "times-circle", color: "#DC2626" },
};

const isPdf = (path: string) => /\.pdf($|\?)/i.test(path);
const fileNameOfPath = (path: string) => toRelativePath(path).split("?")[0].split("/").pop() || "document";

interface ProfessorDocumentsSectionProps {
  userId: string;
  /** Stored values of the professor's documents (storage keys or URLs). */
  docs: Partial<Record<DocField, string>>;
  /** professeurs.statut_verification as returned by GET /utilisateurs/{id}. */
  statut?: string;
  motifRejet?: string | null;
  /** Called after a document was replaced (re-read the profile). */
  onUpdated: () => Promise<void> | void;
}

/**
 * Professor identity documents on the profile page: verification status, a thumbnail per
 * document (tap → full-screen image viewer / PDF viewer through useFileOpener) and a
 * "Replace" action. Before replacing, the professor is warned that the profile goes back
 * to verification: the backend (PATCH /utilisateurs/{id}) sets statut_verification to
 * EN_ATTENTE_VALIDATION and notifies the admins; until then the professor rights are
 * suspended (ROLE_PROFESSOR_PENDING) and DashboardShell shows the verification screen.
 */
const ProfessorDocumentsSection = ({ userId, docs, statut, motifRejet, onUpdated }: ProfessorDocumentsSectionProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const updateUser = useAuthStore((s) => s.updateUser);
  const { open, host } = useFileOpener();
  const [uploading, setUploading] = useState<ProfessorDocKey | null>(null);

  const status = (statut && statut in STATUS_STYLE ? statut : undefined) as ProfessorVerificationStatus | undefined;

  const replace = async (doc: (typeof PROFESSOR_DOCS)[number]) => {
    let picked: DocumentPicker.DocumentPickerAsset | undefined;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      picked = result.assets[0];
    } catch {
      Alert.alert(t("common.error"), t("profVerification.docs.pickFailed"));
      return;
    }
    setUploading(doc.key);
    try {
      const name = picked.name || `${doc.docType}.jpg`;
      const ext = name.includes(".") ? name.split(".").pop() : "jpg";
      const url = await mediaService.uploadFile(
        { uri: picked.uri, mimeType: picked.mimeType || "image/jpeg", name: `${userId}_${doc.docType}_${Date.now()}.${ext}` },
        userId,
        "IMAGE",
        doc.docType
      );
      const updated = (await userService.updateUser(userId, { type: "professeur", [doc.field]: url })) as Record<string, unknown>;
      const next = typeof updated?.statutVerification === "string" ? (updated.statutVerification as ProfessorVerificationStatus) : undefined;
      await onUpdated();
      const pending = next && next !== "VALIDE";
      Alert.alert(
        translate("settings.docsSection.updatedTitle"),
        translate(pending ? "settings.docsSection.updatedPending" : "settings.docsSection.updatedMessage")
      );
      if (next) {
        // Leaving VALIDE locks the professor dashboard (DashboardShell → verification screen).
        updateUser({
          professeurStatutVerification: next,
          professeurMotifRejet: next === "REJETE" ? ((updated?.motifRejetVerification as string | null) ?? null) : null,
        });
      }
    } catch (err) {
      Alert.alert(t("common.error"), extractErrorMessage(err, translate("settings.docsSection.uploadFailed")));
    } finally {
      setUploading(null);
    }
  };

  const confirmReplace = (doc: (typeof PROFESSOR_DOCS)[number]) => {
    Alert.alert(t("settings.docsSection.confirmTitle"), t("settings.docsSection.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.docsSection.continue"), onPress: () => replace(doc) },
    ]);
  };

  return (
    <View>
      {status ? (
        <View style={[styles.statusBox, { borderColor: `${STATUS_STYLE[status].color}55`, backgroundColor: `${STATUS_STYLE[status].color}14` }]}>
          <FontAwesome5 name={STATUS_STYLE[status].icon} size={14} color={STATUS_STYLE[status].color} solid />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>{t("settings.docsSection.verificationStatus")}</Text>
            <Text style={[styles.statusValue, { color: STATUS_STYLE[status].color }]}>{t(`profVerification.statuses.${status}`)}</Text>
            {status === "REJETE" && motifRejet ? (
              <Text style={styles.motif}>
                {t("settings.docsSection.rejectedReason")} : {motifRejet}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={styles.hint}>{t("settings.docsSection.tapToPreview")}</Text>

      <View style={styles.grid}>
        {PROFESSOR_DOCS.map((doc) => {
          const path = docs[doc.field] || "";
          const label = t(LABELS[doc.key]);
          const busy = uploading === doc.key;
          return (
            <View key={doc.key} style={styles.tile}>
              <DocThumb
                path={path}
                label={label}
                styles={styles}
                colors={colors}
                onOpen={(resolved) =>
                  open({ url: resolved ?? path, filePath: toRelativePath(path), fileName: fileNameOfPath(path) }, doc.key)
                }
              />
              <Text style={styles.tileLabel} numberOfLines={1}>
                {label}
              </Text>
              <TouchableOpacity
                style={[styles.replaceBtn, !!uploading && { opacity: 0.5 }]}
                onPress={() => confirmReplace(doc)}
                disabled={!!uploading}
                activeOpacity={0.75}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <FontAwesome5 name={path ? "sync-alt" : "upload"} size={10} color={colors.primary} />
                )}
                <Text style={styles.replaceText} numberOfLines={1}>
                  {busy ? t("settings.docsSection.uploading") : path ? t("settings.docsSection.replace") : t("settings.docsSection.add")}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      {host}
    </View>
  );
};

type Styles = ReturnType<typeof createStyles>;

/** Thumbnail of one stored document; resolves the storage key to a viewable URL. */
const DocThumb = ({
  path,
  label,
  styles,
  colors,
  onOpen,
}: {
  path: string;
  label: string;
  styles: Styles;
  colors: ReturnType<typeof useThemeColors>;
  onOpen: (resolved: string | null) => void;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [headers, setHeaders] = useState<Record<string, string> | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    if (!path) return;
    mediaService
      .getDownloadUrlByPath(toRelativePath(path))
      .then((resolved) => {
        if (cancelled) return;
        if (resolved) setUrl(resolved);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    storageService.getUserToken().then((token) => {
      if (!cancelled && token) setHeaders({ Authorization: `Bearer ${token}` });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return (
      <View style={[styles.thumb, styles.thumbEmpty]}>
        <FontAwesome5 name="image" size={20} color={colors.textMuted} />
        <Text style={styles.thumbEmptyText}>{translate("settings.docsSection.missing")}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.thumb} onPress={() => onOpen(url)} activeOpacity={0.8} accessibilityLabel={label}>
      {isPdf(path) ? (
        <FontAwesome5 name="file-pdf" size={26} color="#DC2626" />
      ) : !url && !failed ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : failed ? (
        <FontAwesome5 name="file-alt" size={22} color={colors.textMuted} />
      ) : (
        <Image source={{ uri: url ?? undefined, headers }} style={styles.thumbImage} resizeMode="cover" onError={() => setFailed(true)} />
      )}
      <View style={styles.zoomBadge}>
        <FontAwesome5 name="expand" size={9} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    statusBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    statusLabel: { ...typography.caption, color: colors.textMuted },
    statusValue: { ...typography.bodyBold },
    motif: { ...typography.caption, color: colors.text, marginTop: 4 },
    hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
    grid: { flexDirection: "row", gap: spacing.sm },
    tile: { flex: 1, minWidth: 0, alignItems: "stretch" },
    thumb: {
      height: 92,
      borderRadius: radius.sm,
      backgroundColor: colors.grayLight,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    thumbEmpty: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, gap: 4 },
    thumbEmptyText: { ...typography.caption, fontSize: 10, color: colors.textMuted },
    thumbImage: { width: "100%", height: "100%" },
    zoomBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "rgba(17,24,39,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    tileLabel: { ...typography.caption, color: colors.text, fontWeight: "600", marginTop: 4, textAlign: "center" },
    replaceBtn: {
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: `${colors.primary}1A`,
    },
    replaceText: { ...typography.caption, fontSize: 11, fontWeight: "700", color: colors.primary },
  });

export default ProfessorDocumentsSection;
