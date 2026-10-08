import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { typography, useThemeColors } from "../../styles/theme";
import { accederService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";
import DevoirsBody from "../shared/DevoirsBody";
import { useT } from "../../i18n";

/**
 * "Mes devoirs" — mirrors web's StudentDevoirsContent.jsx: the class-scoped
 * DEVOIR-type programmed exercises, via the shared DevoirsBody. Attempts
 * open the full-screen ExerciseAttempt page.
 */
const StudentExercisesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const { t } = useT();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");

  const loadClasses = useCallback(async () => {
    if (!user?.userId) return;
    setClassesLoading(true);
    setClassesError("");
    try {
      setClasses(await accederService.getAccessibleClasses(user.userId));
    } catch (e) {
      setClasses([]);
      setClassesError(e instanceof Error && e.message ? e.message : t("classDetails.error.classes"));
    } finally {
      setClassesLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("devoirs.title")}</Text>
      </View>
      <DevoirsBody userId={user?.userId ?? null} classes={classes} classesLoading={classesLoading} classesError={classesError} onRefreshClasses={loadClasses} />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
  title: { ...typography.h1, color: colors.text },
});

export default StudentExercisesBody;
