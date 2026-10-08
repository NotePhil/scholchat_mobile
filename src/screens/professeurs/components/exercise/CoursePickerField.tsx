import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet } from "../../../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../../../styles/theme";
import type { CoursResume } from "../../../../services/api";
import { loadClassCourses } from "../../../../utils/classCourses";
import { useT } from "../../../../i18n";
import NoCourseNotice from "./NoCourseNotice";

/** Per-class choice: classeId → course id, or "" / missing (not chosen). */
export type CoursParClasseValue = Record<string, string>;

/** Payload field `coursParClasse` ({classeId: coursId}) for the selected classes only (a missing course → null, refused by the backend with 400 COURS_REQUIS). */
export const toCoursParClasse = (value: CoursParClasseValue, classeIds: string[]): Record<string, string | null> => {
  const out: Record<string, string | null> = {};
  classeIds.filter(Boolean).forEach((id) => {
    const v = value[id];
    out[id] = v || null;
  });
  return out;
};

/** Selected classes still without a course choice. */
export const classesWithoutCourse = (value: CoursParClasseValue, classeIds: string[]): string[] =>
  classeIds.filter((id) => !value[id]);

/** Number of programmations created by a programming POST response (several when courses differ per class). */
export const countProgrammations = (res: unknown): number => {
  const r = res as { nombreProgrammations?: number; programmations?: unknown[] } | null | undefined;
  return r?.nombreProgrammations || r?.programmations?.length || 1;
};

interface ClassRef {
  id: string;
  nom: string;
}

interface Props {
  /** Selected classes, in display order. */
  classes: ClassRef[];
  value: CoursParClasseValue;
  onChange: (classeId: string, value: string) => void;
  /** Shown under the rows of the classes still without a choice (after a submit attempt). */
  error?: string;
  /** Called before the "Programmer un cours" shortcut navigates (e.g. to close the hosting sheet). */
  onNavigate?: () => void;
}

type Status = "loading" | "ready" | "error";

/**
 * Required "Cours" part of the exercise programming forms: one picker per
 * selected class, listing the courses programmed in that class ("Cours — Classe").
 * There is no exercise / homework without a course: a class with no programmed
 * course shows a notice with a "Programmer un cours" shortcut. Classes mapped to
 * different courses get one programmation each on the backend.
 */
const CoursePickerField = ({ classes, value, onChange, error, onNavigate }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [byClass, setByClass] = useState<Record<string, { status: Status; list: CoursResume[] }>>({});
  const requested = useRef<Record<string, boolean>>({});
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const load = (classeId: string) => {
    requested.current[classeId] = true;
    setByClass((prev) => ({ ...prev, [classeId]: { status: "loading", list: prev[classeId]?.list ?? [] } }));
    loadClassCourses(classeId)
      .then(({ courses }) => {
        if (!mounted.current) return;
        setByClass((prev) => ({ ...prev, [classeId]: { status: "ready", list: courses } }));
        const current = value[classeId];
        if (current && !courses.some((c) => c.coursId === current)) onChange(classeId, "");
      })
      .catch(() => mounted.current && setByClass((prev) => ({ ...prev, [classeId]: { status: "error", list: [] } })));
  };

  const key = classes.map((c) => c.id).join(",");
  useEffect(() => {
    key
      .split(",")
      .filter(Boolean)
      .forEach((id) => {
        if (!requested.current[id]) load(id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const courseLabel = (c: CoursResume, nom: string) => `${c.titre || t("learning.course")} — ${nom}`;
  const missing = classesWithoutCourse(value, classes.map((c) => c.id));
  const open = classes.find((c) => c.id === openId) || null;
  const openState = open ? byClass[open.id] : undefined;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={{ color: "#FF4D4F" }}>*</Text>
        <FontAwesome5 name="book" size={12} color={colors.textMuted} />
        <Text style={styles.label}>{t("learning.course")}</Text>
      </View>

      {classes.length === 0 ? (
        <View style={[styles.input, { opacity: 0.6 }]}>
          <FontAwesome5 name="book" size={13} color={colors.textMuted} />
          <Text style={[styles.inputText, { color: colors.textLight }]} numberOfLines={1}>
            {t("learning.schedule.pickClassFirst")}
          </Text>
        </View>
      ) : (
        classes.map((c) => {
          const v = value[c.id] || "";
          const st = byClass[c.id];
          const missingHere = !!error && missing.includes(c.id);
          const empty = st?.status === "ready" && st.list.length === 0;
          const text =
            v
              ? (() => {
                  const found = st?.list.find((x) => x.coursId === v);
                  return found ? courseLabel(found, c.nom) : `${t("learning.course")} — ${c.nom}`;
                })()
              : t("learning.schedule.pickCourseFor", { classe: c.nom });
          return (
            <View key={c.id} style={{ marginBottom: 8 }}>
              {classes.length > 1 ? <Text style={styles.classLabel}>{c.nom}</Text> : null}
              <TouchableOpacity
                style={[styles.input, missingHere && styles.inputError]}
                onPress={() => setOpenId(c.id)}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="book" size={13} color={colors.textMuted} />
                <Text style={[styles.inputText, !v && { color: colors.textLight }]} numberOfLines={1}>
                  {text}
                </Text>
                {st?.status === "loading" ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
                <FontAwesome5 name="chevron-down" size={12} color={colors.textMuted} />
              </TouchableOpacity>
              {empty ? <NoCourseNotice classeId={c.id} classeNom={classes.length > 1 ? c.nom : null} onNavigate={onNavigate} /> : null}
              {missingHere && !empty ? (
                <Text style={styles.error}>{t("learning.schedule.courseRequiredFor", { classe: c.nom })}</Text>
              ) : null}
            </View>
          );
        })
      )}
      {classes.length > 1 ? <Text style={styles.hint}>{t("learning.schedule.perClassHint")}</Text> : null}
      {error && classes.length === 0 ? <Text style={styles.error}>{error}</Text> : null}

      <BottomSheet
        visible={!!open}
        onClose={() => setOpenId(null)}
        title={open ? `${t("learning.course")} — ${open.nom}` : t("learning.course")}
      >
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {!open ? null : openState?.status === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.hint}>{t("learning.schedule.loadingCourses")}</Text>
            </View>
          ) : (
            <>
              {openState?.status === "error" ? (
                <TouchableOpacity style={styles.option} onPress={() => load(open.id)}>
                  <FontAwesome5 name="exclamation-triangle" size={13} color={colors.danger} />
                  <Text style={[styles.hint, { flex: 1 }]}>{t("learning.errors.courses")}</Text>
                  <Text style={styles.link}>{t("classDetails.retry")}</Text>
                </TouchableOpacity>
              ) : (openState?.list.length ?? 0) === 0 ? (
                <View style={{ paddingVertical: 10 }}>
                  <NoCourseNotice
                    classeId={open.id}
                    onNavigate={() => {
                      setOpenId(null);
                      onNavigate?.();
                    }}
                  />
                </View>
              ) : null}
              {(openState?.status === "ready"
                ? openState.list.map((c) => ({ id: c.coursId, label: courseLabel(c, open.nom), sub: c.matiere, icon: "book" }))
                : []
              ).map((o) => {
                const on = o.id === value[open.id];
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={styles.option}
                    onPress={() => {
                      onChange(open.id, o.id);
                      setOpenId(null);
                    }}
                  >
                    <FontAwesome5 name={o.icon} size={13} color={on ? colors.primary : colors.textMuted} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.optionText, on && { color: colors.primary, fontWeight: "700" }]} numberOfLines={2}>
                        {o.label}
                      </Text>
                      {o.sub ? <Text style={styles.hint} numberOfLines={1}>{o.sub}</Text> : null}
                    </View>
                    {on ? <FontAwesome5 name="check" size={13} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
          <View style={{ height: 12 }} />
        </ScrollView>
      </BottomSheet>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    field: { marginTop: 8, marginBottom: 4 },
    labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    label: { ...typography.captionBold, color: colors.text },
    classLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
    input: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
    },
    inputError: { borderColor: colors.danger },
    inputText: { ...typography.body, color: colors.text, flex: 1 },
    hint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    error: { ...typography.caption, color: colors.danger, marginTop: 4 },
    center: { alignItems: "center", gap: 8, paddingVertical: 24 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionText: { ...typography.body, color: colors.text },
    link: { ...typography.captionBold, color: colors.primary },
  });

export default CoursePickerField;
