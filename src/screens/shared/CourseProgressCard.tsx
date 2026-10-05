import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Card } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { coursProgrammerService, coursService, participationService } from "../../services/api";
import { Participation } from "../../types";
import { useT } from "../../i18n";

interface Row {
  id: string;
  titre: string;
  done: number;
  total: number;
  pct: number;
}

interface Homework {
  submitted: number;
  graded: number;
  pending: number;
  average: number | null;
}

interface Props {
  /** The student himself, or the parent's selected child (minor or adult). */
  learnerId: string | null;
  /** Parent view: the child's first name. */
  learnerName?: string;
  onOpenCourses?: () => void;
  onOpenDevoirs?: () => void;
}

/** "16/20" → 16 ; "7/10" → 14 ; "15" → 15 (already on 20). */
const markOn20 = (note?: string) => {
  if (!note) return null;
  const [a, b] = String(note).replace(",", ".").split("/");
  const earned = parseFloat(a);
  const max = b !== undefined ? parseFloat(b) : 20;
  if (Number.isNaN(earned) || !max) return null;
  return (earned / max) * 20;
};

/**
 * Dashboard "Progression par cours" — same as web's CourseProgressPanel.jsx:
 * each course scheduled for the learner with chapters read / total and %,
 * plus a homework summary (handed in, corrected, pending, average on 20).
 */
const CourseProgressCard = ({ learnerId, learnerName, onOpenCourses, onOpenDevoirs }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [rows, setRows] = useState<Row[]>([]);
  const [homework, setHomework] = useState<Homework | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!learnerId) return;
    setLoading(true);
    setError(false);
    try {
      const [scheduled, details, parts] = await Promise.all([
        coursProgrammerService.getAccessible(learnerId).catch(() => []),
        coursService.getAccessible(learnerId).catch(() => []),
        participationService.getByUser(learnerId).catch(() => [] as Participation[]),
      ]);
      const titles = new Map(details.map((c) => [c.id, c.titre]));
      const ids = [...new Set(scheduled.map((s) => s.coursId).filter((x): x is string => !!x))];
      const progress = await Promise.all(
        ids.map((id) =>
          coursService
            .getProgression(id, learnerId)
            .then((p) => ({ id, p: p as { chapitresCompletes?: number; totalChapitres?: number; pourcentage?: number } }))
            .catch(() => ({ id, p: null }))
        )
      );
      setRows(
        progress
          .map(({ id, p }) => ({
            id,
            titre: titles.get(id) || t("dashboardProgress.untitled"),
            done: p?.chapitresCompletes ?? 0,
            total: p?.totalChapitres ?? 0,
            pct: Math.round(p?.pourcentage ?? 0),
          }))
          .sort((a, b) => b.pct - a.pct || a.titre.localeCompare(b.titre))
      );
      const submitted = parts.filter((p) => ["SOUMIS", "EN_ATTENTE_CORRECTION", "CORRIGE", "VALIDE"].includes(p.etatSoumission ?? ""));
      const graded = parts.filter((p) => ["CORRIGE", "VALIDE"].includes(p.etatSoumission ?? ""));
      const marks = graded.map((p) => markOn20(p.note)).filter((m): m is number => m !== null);
      setHomework({
        submitted: submitted.length,
        graded: graded.length,
        pending: submitted.length - graded.length,
        average: marks.length ? Math.round((marks.reduce((s, m) => s + m, 0) / marks.length) * 10) / 10 : null,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!learnerId) return null;

  const barColor = (pct: number) => (pct >= 100 ? colors.success : pct >= 50 ? colors.primary : pct > 0 ? colors.warning : colors.border);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.head}>
          <FontAwesome5 name="chart-line" size={14} color={colors.primary} />
          <Text style={styles.title}>
            {learnerName ? t("dashboardProgress.childTitle", { name: learnerName }) : t("dashboardProgress.title")}
          </Text>
          {rows.length > 0 ? <Text style={styles.avgPill}>{t("dashboardProgress.average", { pct: avg })}</Text> : null}
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>{t("dashboardProgress.loading")}</Text>
          </View>
        ) : error ? (
          <TouchableOpacity onPress={load}>
            <Text style={styles.error}>
              {t("dashboardProgress.loadFailed")} {t("common.tapToRetry")}
            </Text>
          </TouchableOpacity>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <FontAwesome5 name="book-open" size={26} color={colors.textLight} />
            <Text style={styles.muted}>{t("dashboardProgress.empty")}</Text>
            {onOpenCourses ? (
              <TouchableOpacity onPress={onOpenCourses}>
                <Text style={styles.link}>{t("dashboardProgress.viewCourses")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          rows.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {r.titre}
                </Text>
                <Text style={styles.muted}>
                  {r.total > 0 ? `${t("dashboardProgress.chapters", { done: r.done, total: r.total })} · ` : ""}
                  <Text style={[styles.pct, { color: barColor(r.pct) }]}>{r.pct}%</Text>
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(100, r.pct)}%`, backgroundColor: barColor(r.pct) }]} />
              </View>
              {r.total === 0 ? <Text style={styles.tiny}>{t("dashboardProgress.noChapters")}</Text> : null}
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.head}>
          <FontAwesome5 name="file-alt" size={14} color={colors.purple} />
          <Text style={styles.title}>{t("dashboardProgress.homework")}</Text>
        </View>
        {loading || !homework ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <View style={styles.avgBox}>
              <FontAwesome5 name="trophy" size={16} color={colors.purple} />
              <View>
                <Text style={styles.avgLabel}>{t("dashboardProgress.homeworkAverage")}</Text>
                <Text style={styles.avgValue}>{homework.average !== null ? `${homework.average}/20` : "—"}</Text>
              </View>
            </View>
            {[
              { label: t("dashboardProgress.submitted"), value: homework.submitted, color: colors.text },
              { label: t("dashboardProgress.graded"), value: homework.graded, color: colors.successDark },
              { label: t("dashboardProgress.pending"), value: homework.pending, color: colors.warningDark },
            ].map((x) => (
              <View key={x.label} style={styles.kv}>
                <Text style={styles.muted}>{x.label}</Text>
                <Text style={[styles.kvValue, { color: x.color }]}>{x.value}</Text>
              </View>
            ))}
            {onOpenDevoirs ? (
              <TouchableOpacity style={styles.button} onPress={onOpenDevoirs}>
                <Text style={styles.buttonText}>{t("dashboardProgress.viewDevoirs")}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: { marginHorizontal: 16, marginBottom: spacing.md, gap: spacing.sm },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
    title: { ...typography.bodyBold, color: colors.text, flex: 1 },
    avgPill: { ...typography.tiny, color: colors.primaryDark, backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, overflow: "hidden" },
    center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
    muted: { ...typography.caption, color: colors.textMuted },
    tiny: { ...typography.tiny, color: colors.textLight },
    error: { ...typography.caption, color: colors.danger },
    link: { ...typography.captionBold, color: colors.primary },
    row: { gap: 4, marginBottom: spacing.sm },
    rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    rowTitle: { ...typography.captionBold, color: colors.text, flex: 1 },
    pct: { ...typography.captionBold },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.grayLight, overflow: "hidden" },
    fill: { height: 8, borderRadius: 4 },
    avgBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceElevated },
    avgLabel: { ...typography.caption, color: colors.purple },
    avgValue: { ...typography.h3, color: colors.purple },
    kv: { flexDirection: "row", justifyContent: "space-between" },
    kvValue: { ...typography.bodyBold },
    button: { marginTop: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary, alignItems: "center" },
    buttonText: { ...typography.captionBold, color: colors.primary },
  });

export default CourseProgressCard;
