import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { parentLinkName, parentLinkService } from "../../services/api";
import type { ParentLinkRequest } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { formatDate } from "../../utils/dates";
import { translate, useT } from "../../i18n";

interface Props {
  /** Compact (profile card): list only, with a link to the full screen. */
  compact?: boolean;
  onOpenAll?: () => void;
  /** Bumped by the parent to reload (pull-to-refresh). */
  reloadKey?: number;
}

/** Follows of one parent (one item per class). */
interface ParentGroup {
  key: string;
  first: ParentLinkRequest;
  classes: ParentLinkRequest[];
}

/**
 * "Suivi parental" of an adult student (GET /eleves/{id}/suivi-parental, one item per parent and class):
 * READ-ONLY list grouped by parent (name, e-mail, followed classes with their "since" date). Follow requests are validated by his professors (or the
 * administration), who are also the only ones able to remove a follow — the student has no action here.
 */
const ParentLinkRequestsList = ({ compact = false, onOpenAll, reloadKey = 0 }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const eleveId = (user?.userId ?? user?.id) as string | undefined;
  const [items, setItems] = useState<ParentLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!eleveId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setItems(await parentLinkService.followers(String(eleveId)));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : translate("parentLinks.loadError"));
    } finally {
      setLoading(false);
    }
  }, [eleveId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const groups = useMemo(() => {
    const map = new Map<string, ParentGroup>();
    for (const r of items) {
      const key = r.parentId || r.parentEmail || r.id;
      const g = map.get(key);
      if (g) g.classes.push(r);
      else map.set(key, { key, first: r, classes: [r] });
    }
    return [...map.values()];
  }, [items]);

  const renderItem = (g: ParentGroup) => (
    <View key={g.key} style={styles.item}>
      <View style={styles.itemHead}>
        <FontAwesome5 name="user-friends" size={13} color={colors.primary} />
        <Text style={styles.itemTitle} numberOfLines={2}>
          {parentLinkName(g.first)}
        </Text>
        <FontAwesome5 name="eye" size={11} color={colors.textMuted} />
      </View>
      {g.first.parentEmail ? <Text style={styles.meta}>{g.first.parentEmail}</Text> : null}
      {g.classes.map((c) => {
        const since = formatDate(c.depuis);
        return (
          <View key={c.id} style={styles.classRow}>
            <FontAwesome5 name="chalkboard" size={11} color={colors.textMuted} />
            <Text style={styles.classText} numberOfLines={2}>
              {[c.classeNom || t("parentLinks.classFallback"), since ? t("parentLinks.since", { date: since }) : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        );
      })}
    </View>
  );

  if (loading && items.length === 0) {
    return <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />;
  }
  if (error && items.length === 0) {
    return (
      <TouchableOpacity onPress={load} activeOpacity={0.8}>
        <Text style={styles.error}>
          {error} {t("common.tapToRetry")}
        </Text>
      </TouchableOpacity>
    );
  }
  if (compact) {
    return (
      <View>
        {groups.length ? groups.map(renderItem) : <Text style={styles.meta}>{t("parentLinks.empty")}</Text>}
        {items.length && onOpenAll ? (
          <TouchableOpacity onPress={onOpenAll} style={styles.openAll} accessibilityRole="button">
            <Text style={styles.openAllText}>{t("parentLinks.open")}</Text>
            <FontAwesome5 name="chevron-right" size={10} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.subtitle}>{t("parentLinks.subtitle")}</Text>
      {groups.length === 0 ? <Text style={styles.meta}>{t("parentLinks.empty")}</Text> : groups.map(renderItem)}
      <Text style={[styles.meta, { marginTop: spacing.md }]}>{t("parentLinks.managedBy")}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
    item: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: 4,
    },
    itemHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    itemTitle: { ...typography.body, color: colors.text, fontWeight: "600", flex: 1 },
    meta: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
    classRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
    classText: { ...typography.caption, color: colors.text, flex: 1 },
    error: { ...typography.caption, color: colors.danger, paddingVertical: spacing.sm },
    openAll: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.sm },
    openAllText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  });

export default ParentLinkRequestsList;
