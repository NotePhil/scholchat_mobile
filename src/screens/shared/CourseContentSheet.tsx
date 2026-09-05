import React, { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Badge, BottomSheet, Button, LoadingSpinner } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../styles/theme";
import { coursService } from "../../services/api";
import { Cours, CoursProgramme } from "../../types";

interface CourseContentSheetProps {
  visible: boolean;
  coursProgramme: CoursProgramme | null;
  onClose: () => void;
}

export const CourseContentSheet = ({
  visible,
  coursProgramme,
  onClose,
}: CourseContentSheetProps) => {
  const navigation = useNavigation<any>();
  const [courseDetails, setCourseDetails] = useState<Cours | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const coursId = coursProgramme?.coursId || (coursProgramme as any)?.cours?.id;

  useEffect(() => {
    if (!visible || !coursId) {
      setCourseDetails(null);
      return;
    }
    setLoading(true);
    setError("");
    coursService
      .getById(coursId)
      .then((data) => setCourseDetails(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les détails du cours."))
      .finally(() => setLoading(false));
  }, [visible, coursId]);

  if (!coursProgramme) return null;

  const etat = coursProgramme.etatCoursProgramme;
  const isLive = etat === "EN_COURS";

  const handleJoinLive = () => {
    onClose();
    navigation.navigate("LiveSession", {
      coursId: coursProgramme.coursId,
      isHost: false,
    });
  };

  const handleOpenFile = (fileUrl: string) => {
    if (fileUrl) {
      Linking.openURL(fileUrl).catch(() => {});
    }
  };

  const dateStr = coursProgramme.dateCoursPrevue
    ? new Date(coursProgramme.dateCoursPrevue).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={courseDetails?.titre || "Détails du cours"}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Live session banner if in progress */}
        {isLive && (
          <View style={styles.liveBanner}>
            <View style={styles.livePulse}>
              <FontAwesome5 name="broadcast-tower" size={16} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.liveBannerTitle}>Session en direct active</Text>
              <Text style={styles.liveBannerSub}>Le professeur a démarré ce cours.</Text>
            </View>
            <Button label="Rejoindre" variant="primary" onPress={handleJoinLive} />
          </View>
        )}

        {/* Course Header Info */}
        <View style={styles.headerCard}>
          <Text style={styles.courseTitle}>{courseDetails?.titre || "Cours"}</Text>
          <View style={styles.badgeRow}>
            {etat ? (
              <Badge
                label={etat}
                tone={isLive ? "success" : etat === "PLANIFIE" ? "info" : "neutral"}
              />
            ) : null}
            {courseDetails?.niveau ? <Badge label={courseDetails.niveau} tone="neutral" /> : null}
          </View>

          {dateStr && (
            <View style={styles.metaRow}>
              <FontAwesome5 name="calendar-alt" size={13} color={colors.primary} />
              <Text style={styles.metaText}>{dateStr}</Text>
            </View>
          )}

          {coursProgramme.lieu && (
            <View style={styles.metaRow}>
              <FontAwesome5
                name={
                  coursProgramme.lieu.toLowerCase().includes("zoom") ||
                  coursProgramme.lieu.toLowerCase().startsWith("http")
                    ? "video"
                    : "map-marker-alt"
                }
                size={13}
                color={colors.textMuted}
              />
              <Text style={styles.metaText}>{coursProgramme.lieu}</Text>
            </View>
          )}

          {coursProgramme.lieu &&
            (coursProgramme.lieu.toLowerCase().includes("zoom") ||
              coursProgramme.lieu.toLowerCase().startsWith("http")) && (
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  backgroundColor: "#2563EB",
                  paddingVertical: 10,
                  borderRadius: radius.sm,
                  marginTop: spacing.sm,
                }}
                onPress={() => {
                  const url = coursProgramme.lieu!.startsWith("http")
                    ? coursProgramme.lieu!
                    : `https://${coursProgramme.lieu}`;
                  Linking.openURL(url).catch(() => {});
                }}
              >
                <FontAwesome5 name="video" size={13} color={colors.white} />
                <Text style={{ ...typography.caption, color: colors.white, fontWeight: "700" }}>
                  Rejoindre la visioconférence (Zoom)
                </Text>
              </TouchableOpacity>
            )}
        </View>

        {loading ? (
          <LoadingSpinner label="Chargement du contenu..." />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            {/* Description */}
            {courseDetails?.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.bodyText}>{courseDetails.description}</Text>
              </View>
            ) : null}

            {/* Main Content */}
            {courseDetails?.contenu ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contenu & Notes</Text>
                <Text style={styles.bodyText}>{courseDetails.contenu.replace(/<[^>]*>?/gm, "")}</Text>
              </View>
            ) : null}

            {/* Attached Documents / Materials */}
            {Array.isArray((courseDetails as any)?.documents) && (courseDetails as any).documents.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Supports & Documents</Text>
                {(courseDetails as any).documents.map((doc: any, idx: number) => (
                  <TouchableOpacity
                    key={doc.id || idx}
                    style={styles.docItem}
                    onPress={() => handleOpenFile(doc.url || doc.path)}
                    activeOpacity={0.7}
                  >
                    <FontAwesome5 name="file-pdf" size={20} color={colors.danger} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName} numberOfLines={1}>
                        {doc.nom || doc.name || `Support ${idx + 1}`}
                      </Text>
                      {doc.taille ? <Text style={styles.docSize}>{doc.taille}</Text> : null}
                    </View>
                    <FontAwesome5 name="download" size={14} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* Action button if planned */}
            {!isLive && etat === "PLANIFIE" && (
              <View style={styles.infoBox}>
                <FontAwesome5 name="info-circle" size={14} color={colors.primary} />
                <Text style={styles.infoBoxText}>
                  La session vidéo démarrera automatiquement lorsque le professeur l'aura lancée.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingBottom: spacing.xl },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  livePulse: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBannerTitle: { ...typography.bodyBold, color: colors.white },
  liveBannerSub: { ...typography.caption, color: "rgba(255,255,255,0.8)" },
  headerCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  courseTitle: { ...typography.h2, color: colors.text },
  badgeRow: { flexDirection: "row", gap: spacing.xs, marginVertical: spacing.xs },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.text, marginBottom: 4 },
  bodyText: { ...typography.body, color: colors.text, lineHeight: 22 },
  docItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  docName: { ...typography.bodyBold, fontSize: 13, color: colors.text },
  docSize: { ...typography.caption, color: colors.textMuted },
  errorText: { color: colors.danger, textAlign: "center" },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  infoBoxText: { ...typography.caption, color: colors.primary, flex: 1 },
});

export default CourseContentSheet;
