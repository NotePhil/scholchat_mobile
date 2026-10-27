import React, { useCallback, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Avatar, Badge, EmptyState, LoadingSpinner } from "../../components/ui";
import type { BadgeTone } from "../../components/ui/Badge";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { parentLinkService, parentService } from "../../services/api";
import { isLinkedChild, type ChildClassStatus, type ChildStatus } from "../../services/api/parentService";
import { useUser } from "../../context/UserContext";
import { isAdultChild, useSelectedChildStore } from "../../store/useSelectedChildStore";
import { refreshParentAccess, useParentLimited } from "../../services/parentAccess";
import { formatDate } from "../../utils/dates";
import { translate, useT } from "../../i18n";
import AddChildSheet from "./AddChildSheet";
import JoinClassSheet from "../shared/JoinClassSheet";

/** Follow request of an adult child not active yet (awaiting the professor's validation, or refused). */
const LINK_BADGE: Record<string, { key: "pendingProfessor" | "refused"; tone: BadgeTone; icon: string }> = {
  EN_ATTENTE_VALIDATION_PROFESSEUR: { key: "pendingProfessor", tone: "warning", icon: "user-clock" },
  REFUSE: { key: "refused", tone: "danger", icon: "user-times" },
};

const STATUS_BADGE: Record<string, { key: "approved" | "pending" | "rejected"; tone: BadgeTone; icon: string }> = {
  APPROUVEE: { key: "approved", tone: "success", icon: "check" },
  EN_ATTENTE: { key: "pending", tone: "warning", icon: "clock" },
  REJETEE: { key: "rejected", tone: "danger", icon: "times" },
};

/**
 * "Mes enfants": every child of the parent with the state of each class request
 * (GET /parents/{id}/enfants/statuts — En attente / Acceptée / Refusée + motif), "Ajouter un enfant"
 * (prénom, nom, class code → POST /parents/{id}/enfants/inscription) and, per child, "Rejoindre une
 * autre classe" (POST /acceder/demandes estParent + eleveAssocieId). Refreshed on focus / pull, which
 * also re-reads parentAEnfantValide (limited mode lifted once a child is approved). Only a child
 * with an approved class can be selected for the other parent screens.
 */
const ParentChildrenBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const { user } = useUser();
  const parentId = user?.userId ? String(user.userId) : undefined;
  const { allChildren, children, statuses, statusesError, loading, loaded, selectedChildId, setSelectedChildId } =
    useSelectedChildStore();
  const limited = useParentLimited();
  const [showAdd, setShowAdd] = useState(false);
  const [joinChildId, setJoinChildId] = useState<string | null>(null);
  /** "Suivre une autre classe" of an adult child (e-mail known: only the class codes). */
  const [followAnother, setFollowAnother] = useState<{ email: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => refreshParentAccess(), []);

  // On arrival and each time the dashboard regains focus (back from notifications…).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onPull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const statusOf = (childId: string): ChildStatus | undefined => statuses?.find((s) => s.enfantId === childId);

  const classesOf = (childId: string): ChildClassStatus[] => {
    const st = statuses?.find((s) => s.enfantId === childId);
    return st ? [...st.classes].sort((a, b) => String(b.dateDemande ?? "").localeCompare(String(a.dateDemande ?? ""))) : [];
  };

  const handleRemove = (childId: string, name: string) => {
    if (!parentId) return;
    Alert.alert(t("parentChildren.remove.title"), t("parentChildren.remove.message", { name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("parentChildren.remove.confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await parentService.removeChild(parentId, childId);
            refresh();
          } catch (err) {
            Alert.alert(translate("common.error"), err instanceof Error && err.message ? err.message : translate("parentChildren.remove.failed"));
          }
        },
      },
    ]);
  };

  /** The parent cancels his own follow request of a class while it awaits the professor (POST /demandes-suivi/{id}/annuler). */
  const handleCancelRequest = (demandeId: string, name: string, classe: string) =>
    Alert.alert(t("adultChild.cancelRequest.title"), t("adultChild.cancelRequest.message", { name, classe }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("adultChild.cancelRequest.confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await parentLinkService.cancel(demandeId);
            refresh();
          } catch (err) {
            Alert.alert(translate("common.error"), err instanceof Error && err.message ? err.message : translate("parentLinks.actionFailed"));
            refresh();
          }
        },
      },
    ]);

  /** One class of a child. Adult child: the follow request of that class (validated by its professor). */
  const renderClass = (c: ChildClassStatus, i: number, adult = false, childName = "") => {
    const meta = STATUS_BADGE[String(c.statut).toUpperCase()] ?? STATUS_BADGE.EN_ATTENTE;
    const date = formatDate(c.dateDemande);
    return (
      <View key={`${c.classeId}-${i}`} style={[styles.classRow, i > 0 && styles.classRowBorder]}>
        <View style={styles.classTop}>
          <FontAwesome5 name="chalkboard" size={12} color={colors.textMuted} />
          <Text style={styles.className} numberOfLines={2}>
            {c.classeNom || t("parentClasses.classFallback")}
          </Text>
          <Badge label={t(`parentChildren.status.${meta.key}`)} tone={meta.tone} icon={meta.icon} />
        </View>
        {date ? <Text style={styles.classMeta}>{t("parentChildren.requestedOn", { date })}</Text> : null}
        {meta.key === "rejected" && c.motifRejet ? (
          <Text style={styles.reason}>{t("parentChildren.reason", { reason: c.motifRejet })}</Text>
        ) : null}
        {meta.key === "pending" ? (
          <Text style={styles.classMeta}>{adult ? t("adultChild.link.pendingProfessor") : t("parentChildren.pendingHint")}</Text>
        ) : null}
        {adult && meta.key === "pending" && c.demandeSuiviId ? (
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => handleCancelRequest(String(c.demandeSuiviId), childName, c.classeNom || "")}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <FontAwesome5 name="times-circle" size={12} color={colors.danger} />
            <Text style={[styles.joinText, { color: colors.danger }]}>{t("adultChild.cancelRequest.action")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const showSpinner = loading && !loaded && !refreshing;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("header.myChildren")}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          accessibilityLabel={t("parentClasses.addChild")}
        >
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} colors={[colors.primary]} />}
      >
        <Text style={styles.intro}>{limited ? t("parentChildren.introLimited") : t("parentChildren.intro")}</Text>

        {statusesError && loaded ? (
          <TouchableOpacity style={styles.errorBox} onPress={refresh} activeOpacity={0.8}>
            <FontAwesome5 name="exclamation-circle" size={13} color={colors.danger} />
            <Text style={styles.errorText}>
              {statusesError} {t("common.tapToRetry")}
            </Text>
          </TouchableOpacity>
        ) : null}

        {showSpinner ? (
          <LoadingSpinner label={t("common.loading")} />
        ) : allChildren.length === 0 ? (
          <EmptyState
            icon="child"
            title={t("parentChildren.emptyTitle")}
            message={t("parentChildren.emptyText")}
            actionLabel={t("parentClasses.addChild")}
            onAction={() => setShowAdd(true)}
          />
        ) : (
          allChildren.map((child) => {
            const name = `${child.prenom ?? ""} ${child.nom ?? ""}`.trim();
            const selectable = children.some((c) => c.id === child.id);
            const isSelected = selectable && selectedChildId === child.id;
            const classes = classesOf(child.id);
            const st = statusOf(child.id);
            const linked = isLinkedChild(st);
            const adult = isAdultChild(child, statuses);
            const link = !linked && st?.lienStatut ? LINK_BADGE[st.lienStatut] : undefined;
            const linkHintKey =
              link?.key === "pendingProfessor" ? "adultChild.link.pendingProfessorHint" : "adultChild.link.refusedHint";
            return (
              <View key={child.id} style={[styles.childCard, isSelected && styles.childCardActive]}>
                <TouchableOpacity
                  style={styles.childHead}
                  onPress={() => selectable && setSelectedChildId(child.id)}
                  activeOpacity={selectable ? 0.7 : 1}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !selectable }}
                >
                  <Avatar name={name || "?"} size={44} />
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{name || t("header.child")}</Text>
                    <View style={styles.metaRow}>
                      {child.niveau ? <Text style={styles.childMeta}>{child.niveau}</Text> : null}
                      {adult ? <Badge label={t("adultChild.badgeAdult")} tone="neutral" icon="user-graduate" /> : null}
                      {adult && linked ? <Badge label={t("adultChild.readOnly")} tone="neutral" icon="eye" /> : null}
                      {link ? <Badge label={t(`adultChild.link.${link.key}`)} tone={link.tone} icon={link.icon} /> : null}
                      {isSelected ? <Badge label={t("parentChildren.selected")} tone="info" /> : null}
                    </View>
                    {adult && (st?.email || child.email) ? (
                      <Text style={styles.childMeta} numberOfLines={1}>
                        {st?.email || child.email}
                      </Text>
                    ) : null}
                  </View>
                  {/* An adult child's follow link can only be removed by his professor or the administration. */}
                  {linked && !adult ? (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemove(child.id, name)}
                      accessibilityLabel={t("parentChildren.remove.title")}
                    >
                      <FontAwesome5 name="trash" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>

                {link ? <Text style={styles.linkHint}>{t(linkHintKey, { name: name || st?.email || "" })}</Text> : null}

                {/* Adult child: one entry per requested class (Acceptée / En attente / Refusée + motif). */}
                {link && !adult ? null : (
                  <View style={styles.classes}>
                    {classes.length ? (
                      classes.map((c, i) => renderClass(c, i, adult, name || st?.email || ""))
                    ) : (
                      <Text style={styles.classMeta}>{statuses ? t("parentChildren.noRequest") : t("parentChildren.statusUnavailable")}</Text>
                    )}
                  </View>
                )}

                {/* An adult child requests class access himself; the parent can't do it for him. */}
                {linked && !adult ? (
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => setJoinChildId(child.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <FontAwesome5 name="user-plus" size={12} color={colors.primary} />
                    <Text style={styles.joinText}>{t("parentChildren.joinAnother")}</Text>
                  </TouchableOpacity>
                ) : null}
                {linked && adult ? (
                  <Text style={styles.linkHint}>{t("adultChild.readOnlyHint", { name: child.prenom || name })}</Text>
                ) : null}
                {adult && (st?.email || child.email) ? (
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => setFollowAnother({ email: String(st?.email || child.email), name: name || String(st?.email || child.email) })}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <FontAwesome5 name="plus" size={12} color={colors.primary} />
                    <Text style={styles.joinText}>{t("adultChild.followAnother.action")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}

        {allChildren.length > 0 ? (
          <TouchableOpacity style={styles.addRow} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
            <FontAwesome5 name="plus-circle" size={14} color={colors.primary} />
            <Text style={styles.joinText}>{t("parentClasses.addChild")}</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ height: 110 }} />
      </ScrollView>

      <AddChildSheet visible={showAdd} onClose={() => setShowAdd(false)} onAdded={refresh} parentId={parentId} />
      <AddChildSheet
        visible={!!followAnother}
        onClose={() => setFollowAnother(null)}
        onAdded={refresh}
        parentId={parentId}
        adultEmail={followAnother?.email}
        adultName={followAnother?.name}
      />
      <JoinClassSheet
        visible={!!joinChildId}
        onClose={() => setJoinChildId(null)}
        onSubmitted={refresh}
        utilisateurId={joinChildId ?? undefined}
        estParent
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: spacing.sm,
    },
    title: { ...typography.h1, color: colors.text },
    addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    list: { flex: 1, paddingHorizontal: 16 },
    intro: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: `${colors.danger}14`,
      marginBottom: spacing.md,
    },
    errorText: { ...typography.caption, color: colors.danger, flex: 1 },
    childCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    childCardActive: { borderColor: colors.primary },
    childHead: { flexDirection: "row", alignItems: "center" },
    childInfo: { marginLeft: spacing.md, flex: 1 },
    childName: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs },
    childMeta: { ...typography.caption, color: colors.textMuted },
    removeButton: { padding: spacing.sm },
    classes: { marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.background, paddingHorizontal: spacing.sm },
    classRow: { paddingVertical: spacing.sm, gap: 3 },
    classRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    classTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    className: { ...typography.body, color: colors.text, fontWeight: "600", flex: 1 },
    classMeta: { ...typography.caption, color: colors.textMuted, paddingVertical: 2 },
    reason: { ...typography.caption, color: colors.danger },
    linkHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
    joinBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: spacing.sm, paddingVertical: 4 },
    joinText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
    addRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: spacing.md },
  });

export default ParentChildrenBody;
