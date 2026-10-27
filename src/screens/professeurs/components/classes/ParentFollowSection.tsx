import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { radius, spacing, typography, useThemeColors } from "../../../../styles/theme";
import { parentLinkName, parentLinkService, parentLinkStudentName } from "../../../../services/api";
import type { ParentLinkRequest } from "../../../../services/api";
import { formatDate } from "../../../../utils/dates";
import { translate, useT } from "../../../../i18n";
import KeyboardInsetView from "../../../../components/common/KeyboardInsetView";

interface Props {
  classId: string;
  /**
   * requests: pending parental follow requests of the class's students (Demandes tab) — Approuver / Refuser.
   * follows: active follow links of the class's adult students (Élèves tab) — Retirer le suivi.
   */
  mode: "requests" | "follows";
  /** Bumped by ClassDetails to reload (pull-to-refresh, after a mutation). */
  refreshKey?: number;
  /** Number of items once loaded (pending follow requests are added to the Demandes tab count). */
  onCount?: (n: number) => void;
  onSuccess?: (message: string) => void;
}

/**
 * Parental follow-up of adult students, decided by the class managers (moderator, creator, co-moderators,
 * establishment manager) or an admin — never by the student:
 *  - GET /classes/{id}/demandes-suivi → "Demande de suivi parental — <Parent> souhaite suivre <Élève>",
 *    POST /demandes-suivi/{id}/approuver | refuser?motif= (confirmed; 409 = already handled by someone else)
 *  - GET /classes/{id}/suivis-parentaux → "Retirer le suivi" (DELETE /demandes-suivi/{id}: this class only)
 * The follow-up is per class: everything here concerns THIS class.
 * Hidden when empty or not allowed (403).
 */
const ParentFollowSection = ({ classId, mode, refreshKey = 0, onCount, onSuccess }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [items, setItems] = useState<ParentLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<ParentLinkRequest | null>(null);
  const [motif, setMotif] = useState("");
  const [refuseError, setRefuseError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = mode === "requests" ? await parentLinkService.classRequests(classId) : await parentLinkService.classFollows(classId);
      setItems(list);
      onCount?.(list.length);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setItems([]);
      onCount?.(0);
      // Not a manager of this class (403) or class gone (404): nothing to show.
      if (status !== 403 && status !== 404) setError(translate("parentLinks.manager.loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, mode]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const fail = (e: unknown) => {
    Alert.alert(translate("common.error"), e instanceof Error && e.message ? e.message : translate("parentLinks.actionFailed"));
    load();
  };

  const approve = (r: ParentLinkRequest) =>
    Alert.alert(
      t("parentLinks.manager.approveTitle"),
      t("parentLinks.manager.approveMessage", { parent: parentLinkName(r), student: parentLinkStudentName(r) }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("parentLinks.manager.approve"),
          onPress: async () => {
            setBusyId(r.id);
            try {
              await parentLinkService.approve(r.id);
              onSuccess?.(translate("parentLinks.manager.approved", { parent: parentLinkName(r), student: parentLinkStudentName(r) }));
              load();
            } catch (e) {
              fail(e);
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );

  const openRefuse = (r: ParentLinkRequest) => {
    setRefusing(r);
    setMotif("");
    setRefuseError("");
  };

  const confirmRefuse = async () => {
    if (!refusing || busyId) return;
    setBusyId(refusing.id);
    setRefuseError("");
    try {
      await parentLinkService.refuse(refusing.id, motif);
      setRefusing(null);
      onSuccess?.(translate("parentLinks.manager.refused"));
      load();
    } catch (e) {
      setRefuseError(e instanceof Error && e.message ? e.message : translate("parentLinks.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = (r: ParentLinkRequest) =>
    Alert.alert(
      t("parentLinks.manager.removeTitle"),
      t("parentLinks.manager.removeMessage", { parent: parentLinkName(r), student: parentLinkStudentName(r) }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("parentLinks.manager.remove"),
          style: "destructive",
          onPress: async () => {
            setBusyId(r.id);
            try {
              await parentLinkService.removeFollow(r.id);
              onSuccess?.(translate("parentLinks.manager.removed"));
              load();
            } catch (e) {
              fail(e);
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );

  if (loading && items.length === 0) return null;
  if (error) {
    return (
      <TouchableOpacity onPress={load} activeOpacity={0.8} style={styles.card}>
        <Text style={styles.error}>
          {error} {t("common.tapToRetry")}
        </Text>
      </TouchableOpacity>
    );
  }
  if (items.length === 0) return null;

  const isReq = mode === "requests";
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <FontAwesome5 name="user-shield" size={13} color={colors.primary} />
        <Text style={styles.title}>{isReq ? t("parentLinks.manager.requestsTitle") : t("parentLinks.manager.followsTitle")}</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>
      <Text style={styles.hint}>{isReq ? t("parentLinks.manager.requestsHint") : t("parentLinks.manager.followsHint")}</Text>
      {items.map((r) => {
        const busy = busyId === r.id;
        const date = formatDate(isReq ? r.dateDemande : r.depuis);
        return (
          <View key={r.id} style={styles.item}>
            <Text style={styles.kind}>{t("parentLinks.manager.kind")}</Text>
            <Text style={styles.itemTitle}>
              {isReq
                ? t("parentLinks.manager.wantsToFollow", { parent: parentLinkName(r), student: parentLinkStudentName(r) })
                : t("parentLinks.manager.follows", { parent: parentLinkName(r), student: parentLinkStudentName(r) })}
            </Text>
            {r.parentEmail ? <Text style={styles.meta}>{r.parentEmail}</Text> : null}
            {date ? (
              <Text style={styles.meta}>
                {isReq ? t("parentLinks.manager.requestedOn", { date }) : t("parentLinks.since", { date })}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {isReq ? (
                <>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnOk, busy && { opacity: 0.6 }]}
                    onPress={() => approve(r)}
                    disabled={!!busyId}
                    accessibilityRole="button"
                  >
                    {busy ? <ActivityIndicator size="small" color={colors.white} /> : <FontAwesome5 name="check" size={11} color={colors.white} />}
                    <Text style={styles.btnOkText}>{t("parentLinks.manager.approve")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnDanger]}
                    onPress={() => openRefuse(r)}
                    disabled={!!busyId}
                    accessibilityRole="button"
                  >
                    <FontAwesome5 name="times" size={11} color={colors.danger} />
                    <Text style={styles.btnDangerText}>{t("parentLinks.manager.refuse")}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.btn, styles.btnDanger, busy && { opacity: 0.6 }]}
                  onPress={() => remove(r)}
                  disabled={!!busyId}
                  accessibilityRole="button"
                >
                  {busy ? <ActivityIndicator size="small" color={colors.danger} /> : <FontAwesome5 name="user-times" size={11} color={colors.danger} />}
                  <Text style={styles.btnDangerText}>{t("parentLinks.manager.remove")}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <Modal visible={!!refusing} transparent animationType="fade" onRequestClose={() => !busyId && setRefusing(null)}>
        {/* RN Modal = separate window: pad by the keyboard height on Android (edge-to-edge). */}
        <KeyboardInsetView>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t("parentLinks.manager.refuseTitle")}</Text>
            <Text style={styles.meta}>
              {refusing
                ? t("parentLinks.manager.refuseMessage", { parent: parentLinkName(refusing), student: parentLinkStudentName(refusing) })
                : ""}
            </Text>
            <TextInput
              style={styles.input}
              multiline
              value={motif}
              onChangeText={(v) => {
                setMotif(v);
                if (refuseError) setRefuseError("");
              }}
              maxLength={500}
              editable={!busyId}
              placeholder={t("parentLinks.manager.reasonPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
            {refuseError ? <Text style={styles.error}>{refuseError}</Text> : null}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnNeutral]} onPress={() => setRefusing(null)} disabled={!!busyId}>
                <Text style={styles.btnNeutralText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnDangerFill]} onPress={confirmRefuse} disabled={!!busyId}>
                {busyId ? <ActivityIndicator size="small" color={colors.white} /> : <FontAwesome5 name="times" size={11} color={colors.white} />}
                <Text style={styles.btnOkText}>{t("parentLinks.manager.refuse")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        </KeyboardInsetView>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    title: { ...typography.bodyBold, color: colors.text, flex: 1 },
    count: { ...typography.caption, color: colors.primary, fontWeight: "700" },
    hint: { ...typography.caption, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm, lineHeight: 17 },
    item: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.sm, gap: 3 },
    kind: { ...typography.caption, color: colors.primary, fontWeight: "700" },
    itemTitle: { ...typography.body, color: colors.text, fontWeight: "600" },
    meta: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
    error: { ...typography.caption, color: colors.danger, marginTop: 4 },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    btn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    btnOk: { backgroundColor: colors.success },
    btnOkText: { ...typography.caption, color: colors.white, fontWeight: "700" },
    btnDanger: { borderWidth: 1, borderColor: colors.danger },
    btnDangerText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
    btnDangerFill: { backgroundColor: colors.danger },
    btnNeutral: { borderWidth: 1, borderColor: colors.border },
    btnNeutralText: { ...typography.caption, color: colors.text, fontWeight: "700" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg },
    dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
    dialogTitle: { ...typography.h3, color: colors.text },
    input: {
      minHeight: 80,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm,
      color: colors.text,
      textAlignVertical: "top",
    },
  });

export default ParentFollowSection;
