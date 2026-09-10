import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography, useThemeColors } from "../../styles/theme";
import { parentService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import ChildSelectorRow from "./ChildSelectorRow";
import DevoirsBody from "../shared/DevoirsBody";

/** "Mes Devoirs" for the selected child — shares the exact same tracker/attempt flow as the student's own screen. */
const ParentExercisesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const { children, selectedChildId, loadChildren } = useSelectedChildStore();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  useEffect(() => {
    if (user?.userId) loadChildren(user.userId);
  }, [user?.userId, loadChildren]);

  const loadClasses = useCallback(async () => {
    if (!selectedChildId) {
      setClasses([]);
      setClassesLoading(false);
      return;
    }
    setClassesLoading(true);
    try {
      setClasses(await parentService.getChildClasses(selectedChildId));
    } catch {
      setClasses([]);
    } finally {
      setClassesLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Devoirs</Text>
      </View>
      <ChildSelectorRow />
      <DevoirsBody
        userId={selectedChildId}
        classes={classes}
        classesLoading={classesLoading}
        emptyMessage={children.length === 0 ? "Ajoutez un enfant depuis l'onglet 'Mes enfants'." : "Sélectionnez un enfant pour voir ses devoirs."}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  title: { ...typography.h1, color: colors.text },
});

export default ParentExercisesBody;
