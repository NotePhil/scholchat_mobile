import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ActivityMediaImage from "../../components/common/ActivityMediaImage";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { useT } from "../../i18n";
import { QuestionMedia, isImageMedia } from "../../utils/devoirs";
import { useFileOpener } from "../../hooks/useFileOpener";
import { OpenableFile, fileKindOf } from "../../services/fileOpener";

const toOpenable = (media: QuestionMedia): OpenableFile => ({
  mediaId: media.id,
  filePath: media.filePath,
  presignedUrl: media.presignedUrl,
  fileName: media.fileName,
  contentType: media.contentType || (isImageMedia(media) ? "image/jpeg" : undefined),
});

const FILE_ICON: Record<string, string> = { pdf: "file-pdf", image: "file-image", video: "file-video", audio: "file-audio", other: "file-alt" };

/**
 * A question's attachments — mirrors web's QuestionMediaPreview in
 * StudentExerciseView.jsx: image thumbnails (through ActivityMediaImage) that
 * open the in-app zoomable viewer, PDFs that open the in-app PDF viewer, and
 * any other file downloaded and handed to the native "Open with" chooser.
 */
const QuestionMediaList = ({ medias }: { medias: QuestionMedia[] }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const opener = useFileOpener();

  if (medias.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {medias.map((media, i) => {
        const key = media.id ?? `media-${i}`;
        if (isImageMedia(media)) {
          return (
            <ActivityMediaImage
              key={key}
              mediaId={media.id}
              presignedUrl={media.presignedUrl}
              style={styles.thumb}
              onPress={() => opener.open(toOpenable(media), key)}
            />
          );
        }
        const kind = fileKindOf(toOpenable(media));
        return (
          <TouchableOpacity key={key} style={styles.fileChip} onPress={() => opener.open(toOpenable(media), key)} accessibilityLabel={t("devoirs.media.openFile")}>
            <FontAwesome5 name={FILE_ICON[kind]} size={14} color={kind === "pdf" ? colors.danger : colors.primary} />
            <Text style={styles.fileName} numberOfLines={1}>
              {media.fileName ?? t("devoirs.media.openFile")}
            </Text>
            {opener.openingKey === key ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <FontAwesome5 name={kind === "pdf" ? "eye" : "external-link-alt"} size={11} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        );
      })}
      {opener.host}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
    thumb: { width: 112, height: 112, borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
    fileChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: "100%",
    },
    fileName: { ...typography.caption, color: colors.text, maxWidth: 180 },
  });

export default QuestionMediaList;
