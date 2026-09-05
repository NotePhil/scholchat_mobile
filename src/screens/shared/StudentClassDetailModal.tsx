import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, BottomSheet, LoadingSpinner } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../styles/theme";
import { accederService, coursProgrammerService } from "../../services/api";
import { ClassEntity, ClassUser, CoursProgramme } from "../../types";

interface StudentClassDetailModalProps {
  visible: boolean;
  classe: ClassEntity | null;
  onClose: () => void;
  onOpenLiveSession?: (coursId: string) => void;
}

type TabType = "info" | "professeurs" | "eleves" | "cours";

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  maternelle: { bg: "#DBEAFE", text: "#1D4ED8" },
  primaire: { bg: "#DCFCE7", text: "#15803D" },
  collège: { bg: "#FEF3C7", text: "#B45309" },
  college: { bg: "#FEF3C7", text: "#B45309" },
  lycée: { bg: "#FEE2E2", text: "#B91C1C" },
  lycee: { bg: "#FEE2E2", text: "#B91C1C" },
  université: { bg: "#F3E8FF", text: "#7E22CE" },
  universite: { bg: "#F3E8FF", text: "#7E22CE" },
};

export const getLevelStyle = (niveau = "") => {
  const n = (niveau || "").toLowerCase();
  for (const [key, val] of Object.entries(LEVEL_COLORS)) {
    if (n.includes(key)) return val;
  }
  return { bg: "#F3F4F6", text: "#4B5563" };
};

export const StudentClassDetailModal = ({
  visible,
  classe,
  onClose,
  onOpenLiveSession,
}: StudentClassDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [users, setUsers] = useState<ClassUser[]>([]);
  const [courses, setCourses] = useState<CoursProgramme[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !classe?.id) {
      setUsers([]);
      setCourses([]);
      setActiveTab("info");
      return;
    }

    setLoading(true);
    Promise.all([
      accederService.getUsersWithAccess(classe.id).catch(() => [] as ClassUser[]),
      coursProgrammerService.getByClasse(classe.id).catch(() => [] as CoursProgramme[]),
    ])
      .then(([userData, courseData]) => {
        setUsers(userData);
        setCourses(courseData);
      })
      .finally(() => setLoading(false));
  }, [visible, classe?.id]);

  if (!classe) return null;

  const levelStyle = getLevelStyle(classe.niveau);
  const professors = users.filter((u) => u.typeUtilisateur === "PROFESSEUR" || u.typeUtilisateur === "REPETITEUR");
  const students = users.filter((u) => u.typeUtilisateur === "ELEVE");

  return (
    <BottomSheet visible={visible} onClose={onClose} title={classe.nom || "Détails de la classe"}>
      <View style={styles.tabRow}>
        {(
          [
            { id: "info", label: "Infos", icon: "info-circle" },
            { id: "professeurs", label: `Profs (${professors.length})`, icon: "chalkboard-teacher" },
            { id: "eleves", label: `Élèves (${students.length})`, icon: "user-graduate" },
            { id: "cours", label: `Cours (${courses.length})`, icon: "book-open" },
          ] as { id: TabType; label: string; icon: React.ComponentProps<typeof FontAwesome5>["name"] }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.id)}
            activeOpacity={0.7}
          >
            <FontAwesome5
              name={t.icon}
              size={12}
              color={activeTab === t.id ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingSpinner label="Chargement des données de la classe..." />
        ) : activeTab === "info" ? (
          <>
            {/* Header info */}
            <View style={styles.sectionCard}>
              <View style={styles.topInfo}>
                <View style={styles.classIconWrap}>
                  <FontAwesome5 name="graduation-cap" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.className}>{classe.nom}</Text>
                  {classe.niveau && (
                    <View style={[styles.levelBadge, { backgroundColor: levelStyle.bg }]}>
                      <Text style={[styles.levelBadgeText, { color: levelStyle.text }]}>{classe.niveau}</Text>
                    </View>
                  )}
                </View>
              </View>

              {classe.description ? (
                <Text style={styles.descText}>{classe.description}</Text>
              ) : null}
            </View>

            {/* School / Establishment info */}
            {classe.etablissement && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="school" size={14} color="#0D9488" />
                  <Text style={styles.sectionTitle}>Établissement</Text>
                </View>
                <Text style={styles.estName}>{classe.etablissement.nom}</Text>
                {classe.etablissement.localisation && (
                  <View style={styles.row}>
                    <FontAwesome5 name="map-marker-alt" size={12} color={colors.textMuted} />
                    <Text style={styles.rowText}>{classe.etablissement.localisation}</Text>
                  </View>
                )}
                {classe.etablissement.email && (
                  <View style={styles.row}>
                    <FontAwesome5 name="envelope" size={12} color={colors.textMuted} />
                    <Text style={styles.rowText}>{classe.etablissement.email}</Text>
                  </View>
                )}
                {classe.etablissement.telephone && (
                  <View style={styles.row}>
                    <FontAwesome5 name="phone" size={12} color={colors.textMuted} />
                    <Text style={styles.rowText}>{classe.etablissement.telephone}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Quick stats grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{professors.length}</Text>
                <Text style={styles.statLabel}>Professeurs</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{students.length}</Text>
                <Text style={styles.statLabel}>Élèves inscrits</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{courses.length}</Text>
                <Text style={styles.statLabel}>Cours programmés</Text>
              </View>
            </View>
          </>
        ) : activeTab === "professeurs" ? (
          professors.length === 0 ? (
            <Text style={styles.emptyText}>Aucun professeur assigné pour le moment.</Text>
          ) : (
            professors.map((p) => (
              <View key={p.id} style={styles.userCard}>
                <View style={[styles.avatar, { backgroundColor: "#DBEAFE" }]}>
                  <Text style={[styles.avatarText, { color: "#1D4ED8" }]}>
                    {(p.prenom || p.nom || "P").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{p.prenom} {p.nom}</Text>
                  <Text style={styles.userEmail}>{p.email || p.telephone || "Professeur"}</Text>
                </View>
                <Badge label="Professeur" tone="info" />
              </View>
            ))
          )
        ) : activeTab === "eleves" ? (
          students.length === 0 ? (
            <Text style={styles.emptyText}>Aucun autre élève dans cette classe.</Text>
          ) : (
            students.map((s) => (
              <View key={s.id} style={styles.userCard}>
                <View style={[styles.avatar, { backgroundColor: "#DCFCE7" }]}>
                  <Text style={[styles.avatarText, { color: "#15803D" }]}>
                    {(s.prenom || s.nom || "E").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{s.prenom} {s.nom}</Text>
                  <Text style={styles.userEmail}>{s.email || "Élève"}</Text>
                </View>
                <Badge label="Élève" tone="success" />
              </View>
            ))
          )
        ) : (
          courses.length === 0 ? (
            <Text style={styles.emptyText}>Aucun cours programmé pour cette classe.</Text>
          ) : (
            courses.map((crs) => {
              const isLive = crs.etatCoursProgramme === "EN_COURS";
              return (
                <View key={crs.id} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <FontAwesome5 name="book-open" size={14} color={colors.primary} />
                    <Text style={styles.courseDate}>
                      {crs.dateCoursPrevue
                        ? new Date(crs.dateCoursPrevue).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Cours"}
                    </Text>
                    {crs.etatCoursProgramme && (
                      <Badge
                        label={crs.etatCoursProgramme}
                        tone={isLive ? "success" : crs.etatCoursProgramme === "PLANIFIE" ? "info" : "neutral"}
                      />
                    )}
                  </View>
                  {crs.lieu ? <Text style={styles.courseMeta}>{crs.lieu}</Text> : null}
                  {isLive && crs.coursId && onOpenLiveSession && (
                    <TouchableOpacity
                      style={styles.joinBtn}
                      onPress={() => {
                        onClose();
                        onOpenLiveSession(crs.coursId as string);
                      }}
                    >
                      <FontAwesome5 name="video" size={12} color={colors.white} />
                      <Text style={styles.joinBtnText}>Rejoindre la session en direct</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  tabBtnActive: {
    backgroundColor: "#EFF6FF",
  },
  tabText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  topInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  classIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  className: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  descText: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 2,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  estName: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  rowText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statNum: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
  },
  userName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  userEmail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  courseCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  courseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  courseDate: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  courseMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: "#059669",
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  joinBtnText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
});

export default StudentClassDetailModal;
