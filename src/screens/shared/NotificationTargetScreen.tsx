import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, LoadingSpinner } from "../../components/ui";
import { useThemeColors } from "../../styles/theme";
import { exerciseProgrammerService, parentService, participationService } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import { useUiStore } from "../../store/useUiStore";
import { ExerciseAttemptParams, ExerciseResultParams, isSubmittedEtat } from "../../utils/devoirs";
import type { ExerciseProgramme, Participation, StudentProfile } from "../../types";
import type { NotificationTargetParams } from "../../services/notificationNavigation";
import { useT } from "../../i18n";

/** Class ids an exercise programmation was distributed to (both payload shapes). */
const programmeClassIds = (p: ExerciseProgramme): string[] => {
  const ids = new Set<string>();
  (p.classeIds ?? []).forEach((id) => id && ids.add(String(id)));
  (p.classesDiffusees ?? []).forEach((c: any) => c?.id && ids.add(String(c.id)));
  return Array.from(ids);
};

/**
 * Opens the devoir a notification is about (ASSIGNMENT_GIVEN, DEVOIR_SOUMIS, CORRECTION_DISPONIBLE):
 * loads the programmation and the learner's participation first (spinner meanwhile), then
 * REPLACES itself with the attempt page (not submitted yet) or the copy / result page. For a
 * parent, the concerned child is found (participation, else class membership) and selected.
 * A programmation that no longer exists / isn't accessible shows a message instead.
 */
const NotificationTargetScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as NotificationTargetParams;
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors.background), [colors.background]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const { exerciseProgrammerId, result } = params;
    const auth = useAuthStore.getState();
    const role = auth.role;
    const selfId = (auth.user?.userId as string | undefined) ?? null;

    (async () => {
      let programme: ExerciseProgramme;
      try {
        programme = await exerciseProgrammerService.getById(exerciseProgrammerId);
        if (!programme?.id) throw new Error("not found");
      } catch {
        if (mountedRef.current) setError(t("notifications.devoirUnavailable"));
        return;
      }

      // Whose devoir: the student himself, or (parent) the concerned child.
      let learnerId = selfId;
      let child: StudentProfile | undefined;
      let participation: Participation | null = null;
      if (role === "parent") {
        const childStore = useSelectedChildStore.getState();
        if (!childStore.loaded && selfId) await childStore.loadChildren(selfId);
        const { children, selectedChildId } = useSelectedChildStore.getState();
        const ordered = [...children].sort((a, b) => (a.id === selectedChildId ? -1 : b.id === selectedChildId ? 1 : 0));
        const classIds = programmeClassIds(programme);
        for (const c of ordered) {
          const parts = await participationService.getByUser(c.id).catch(() => [] as Participation[]);
          const own = parts.find((p) => p.exerciseProgrammerId === exerciseProgrammerId) ?? null;
          if (own) {
            child = c;
            participation = own;
            break;
          }
        }
        if (!child && classIds.length > 0) {
          for (const c of ordered) {
            const classes = await parentService.getChildClasses(c.id).catch(() => []);
            if (classes.some((cl) => classIds.includes(String(cl.id)))) {
              child = c;
              break;
            }
          }
        }
        if (!child) {
          if (mountedRef.current) setError(t("notifications.noChildForItem"));
          return;
        }
        learnerId = child.id;
        if (child.id !== selectedChildId) useSelectedChildStore.getState().setSelectedChildId(child.id);
      } else if (learnerId) {
        const parts = await participationService.getByUser(learnerId).catch(() => [] as Participation[]);
        participation =
          parts.find((p) => p.exerciseProgrammerId === exerciseProgrammerId) ??
          (programme.participations ?? []).find((p) => p.utilisateurId === learnerId) ??
          null;
      }
      if (!mountedRef.current || !learnerId) return;

      const etat = participation?.etatSoumission;
      if (result || isSubmittedEtat(etat)) {
        const resultParams: ExerciseResultParams = {
          exerciseProgrammerId,
          exerciseId: programme.exerciseId,
          title: programme.nom,
          userId: learnerId,
          etat: etat ?? undefined,
          note: participation?.note,
          appreciation: participation?.appreciation,
        };
        navigation.replace("ExerciseResult", resultParams);
        return;
      }
      // A parent can only answer for a minor child (no login of his own); otherwise the devoirs list.
      if (child && child.email) {
        useUiStore.getState().requestTab("exercises");
        navigation.navigate("App");
        return;
      }
      const attemptParams: ExerciseAttemptParams = {
        exerciseProgrammerId,
        exerciseId: programme.exerciseId,
        title: programme.nom,
        description: programme.description,
        hasParticipation: !!participation,
        ...(child ? { learnerId: child.id, learnerName: child.prenom || child.nom || "" } : {}),
      };
      navigation.replace("ExerciseAttempt", attemptParams);
    })();
    return () => {
      mountedRef.current = false;
    };
    // Resolved once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {error ? (
        <EmptyState
          icon="exclamation-circle"
          title={t("notifications.unavailableTitle")}
          message={error}
          actionLabel={t("common.back")}
          onAction={() => navigation.goBack()}
        />
      ) : (
        <LoadingSpinner label={t("notifications.opening")} fullScreen />
      )}
    </View>
  );
};

const createStyles = (background: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: background, justifyContent: "center" },
  });

export default NotificationTargetScreen;
