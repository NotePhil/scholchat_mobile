import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../../styles/theme";
import { accederService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";
import DevoirsBody from "../shared/DevoirsBody";

/**
 * "Mes devoirs" — mirrors web's StudentDevoirsContent.jsx (shared verbatim
 * with the parent role there too). Used to list every "accessible" exercise
 * regardless of whether it was actually assigned as class homework, with no
 * due date/status/grade; now sources the same class-scoped DEVOIR-type
 * programmed exercises web does, via the shared DevoirsBody component.
 */
const StudentExercisesBody = () => {
  const { user } = useUser();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    if (!user?.userId) return;
    setClassesLoading(true);
    try {
      setClasses(await accederService.getAccessibleClasses(user.userId));
    } catch {
      setClasses([]);
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
        <Text style={styles.title}>Mes devoirs</Text>
      </View>
      <DevoirsBody userId={user?.userId ?? null} classes={classes} classesLoading={classesLoading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  title: { ...typography.h1, color: colors.text },
});

export default StudentExercisesBody;
