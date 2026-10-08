import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { ProgressBar, StatTile, scoreColor } from "../../components/common/LearningUI";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { fmtNote, pct } from "../../services/api";
import type { EleveProgression } from "../../services/api";
import { formatDate } from "../../utils/dates";
import { useT } from "../../i18n";

const fmtDay = (d?: string | null) => (d ? formatDate(d, { day: "2-digit", month: "short" }, "—") : "—");

interface Props {
  data: EleveProgression;
  /** Tap on a course row (e.g. open its page). */
  onOpenCourse?: (coursId: string) => void;
  onOpenDevoirs?: () => void;
}

/**
 * Learner progression: global cards (course progress, homework handed in,
 * average, last activity), one row per course (progress bar, chapters,
 * exercises done, average) and the overdue homework.
 */
const ProgressionContent = ({ data, onOpenCourse, onOpenDevoirs }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const g = data.global;
  const progress = pct(g.progressionCours);
  const devoirsRatio = g.devoirsTotal > 0 ? g.devoirsRendus / g.devoirsTotal : null;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.tiles}>
        <StatTile icon="chart-line" value={`${progress}%`} label={t("learning.progress.courses")} color={colors.primary} />
        <StatTile
          icon="file-alt"
          value={`${g.devoirsRendus}/${g.devoirsTotal}`}
          label={t("learning.progress.devoirs")}
          color={devoirsRatio == null ? colors.purple : scoreColor(devoirsRatio, colors)}
        />
        <StatTile
          icon="trophy"
          value={g.moyenne == null ? "—" : `${fmtNote(g.moyenne)}/20`}
          label={t("learning.progress.average")}
          color={g.moyenne == null ? colors.textMuted : scoreColor(g.moyenne / 20, colors)}
        />
        <StatTile icon="history" value={fmtDay(g.dernierActivite)} label={t("learning.progress.lastActivity")} color={colors.teal} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t("learning.progress.byCourse")}</Text>
        {data.cours.length === 0 ? (
          <Text style={styles.muted}>{t("dashboardProgress.empty")}</Text>
        ) : (
          data.cours.map((c) => {
            const p = pct(c.pourcentage);
            const color = p >= 100 ? colors.success : p >= 50 ? colors.primary : p > 0 ? colors.warning : colors.grayMid;
            return (
              <TouchableOpacity
                key={c.coursId}
                style={styles.row}
                disabled={!onOpenCourse}
                onPress={() => onOpenCourse?.(c.coursId)}
                activeOpacity={0.75}
              >
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.titre || t("dashboardProgress.untitled")}
                  </Text>
                  <Text style={[styles.pct, { color }]}>{p}%</Text>
                </View>
                <ProgressBar value={p} color={color} />
                <View style={styles.meta}>
                  <Text style={styles.muted}>
                    {c.chapitresTotal > 0
                      ? t("dashboardProgress.chapters", { done: c.chapitresLus, total: c.chapitresTotal })
                      : t("dashboardProgress.noChapters")}
                  </Text>
                  <Text style={styles.muted}>{t("learning.progress.exercisesDone", { done: c.exercicesFaits, total: c.exercicesTotal })}</Text>
                  <Text style={[styles.muted, c.moyenne != null && { color: scoreColor(c.moyenne / 20, colors), fontWeight: "700" }]}>
                    {t("learning.prof.average", { avg: c.moyenne == null ? "—" : `${fmtNote(c.moyenne)}/20` })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {data.devoirsEnRetard.length > 0 ? (
        <View style={[styles.card, { borderColor: colors.danger }]}>
          <View style={styles.rowHead}>
            <FontAwesome5 name="exclamation-circle" size={13} color={colors.danger} />
            <Text style={[styles.title, { flex: 1, color: colors.danger }]}>
              {t("learning.progress.overdue", { count: data.devoirsEnRetard.length })}
            </Text>
          </View>
          {data.devoirsEnRetard.slice(0, 5).map((d, i) => (
            <View key={d.exerciseProgrammerId ?? i} style={styles.lateRow}>
              <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>
                {d.titre || t("devoirs.fallbackTitle")}
              </Text>
              {d.coursTitre ? (
                <Text style={styles.muted} numberOfLines={1}>
                  {d.coursTitre}
                </Text>
              ) : null}
              <Text style={[styles.muted, { color: colors.danger }]}>{fmtDay(d.dateFin ?? d.dateFinExoEffectif)}</Text>
            </View>
          ))}
          {onOpenDevoirs ? (
            <TouchableOpacity style={styles.button} onPress={onOpenDevoirs}>
              <Text style={styles.buttonText}>{t("dashboardProgress.viewDevoirs")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
    title: { ...typography.bodyBold, color: colors.text },
    muted: { ...typography.caption, color: colors.textMuted },
    row: { gap: 6, paddingVertical: 6 },
    rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    rowTitle: { ...typography.captionBold, color: colors.text, flex: 1 },
    pct: { ...typography.captionBold },
    meta: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md },
    lateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
    button: { marginTop: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary, alignItems: "center" },
    buttonText: { ...typography.captionBold, color: colors.primary },
  });

export default ProgressionContent;
