import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Badge, Button, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { coursProgrammerService } from "../../services/api";
import { CoursProgramme } from "../../types";
import { useUser } from "../../context/UserContext";

/** A student's own scheduled courses + live-session join — mirrors web's "Cours" parent/student sidebar tab. */
const StudentCoursesBody = () => {
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [courses, setCourses] = useState<CoursProgramme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await coursProgrammerService.getAccessible(user.userId);
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des cours.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cours programmés</Text>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement des cours..." />
        ) : courses.length === 0 ? (
          <EmptyState icon="calendar" title="Aucun cours programmé" />
        ) : (
          courses.map((course) => (
            <View key={course.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <FontAwesome5 name="calendar-alt" size={16} color={colors.primary} />
                <Text style={styles.cardTitle}>
                  {course.dateCoursPrevue ? new Date(course.dateCoursPrevue).toLocaleString("fr-FR") : "Cours"}
                </Text>
              </View>
              {course.etatCoursProgramme ? <Badge label={course.etatCoursProgramme} tone="info" /> : null}
              {course.lieu ? <Text style={styles.cardMeta}>{course.lieu}</Text> : null}
              {course.coursId ? (
                <Button
                  label="Rejoindre la session"
                  variant="secondary"
                  onPress={() => navigation.navigate("LiveSession", { coursId: course.coursId, isHost: false })}
                  style={{ marginTop: spacing.sm }}
                />
              ) : null}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted },
});

export default StudentCoursesBody;
