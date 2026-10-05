import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { typography, useThemeColors } from "../../styles/theme";
import { parentService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import ChildSelectorRow from "./ChildSelectorRow";
import DevoirsBody from "../shared/DevoirsBody";
import { useT } from "../../i18n";

/**
 * Homework of the selected child — same tracker as the student's (web:
 * StudentDevoirsContent with the parent's selectedChildId). A minor child has
 * no account of their own, so the parent hands the homework in for them; an
 * adult child (own login) answers himself and the parent only follows the
 * copies and per-question marks.
 */
const ParentExercisesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const { t } = useT();
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

  const child = children.find((c) => c.id === selectedChildId);
  const childName = child?.prenom || child?.nom || "";
  // Adult = has their own login (email); a minor's profile has none.
  const childHasAccount = !!child?.email;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{childName ? t("devoirs.childTitleNamed", { name: childName }) : t("devoirs.childTitle")}</Text>
      </View>
      <ChildSelectorRow />
      <DevoirsBody
        userId={selectedChildId}
        classes={classes}
        classesLoading={classesLoading}
        readOnly={childHasAccount}
        learnerName={childName || undefined}
        hint={child ? t(childHasAccount ? "devoirs.childAdultHint" : "devoirs.childMinorHint", { name: childName }) : undefined}
        onRefreshClasses={loadClasses}
        emptyMessage={children.length === 0 ? t("devoirs.noChildAdd") : t("devoirs.noChild")}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
  title: { ...typography.h1, color: colors.text },
});

export default ParentExercisesBody;
