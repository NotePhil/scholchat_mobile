import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, typography, useThemeColors } from "../../styles/theme";
import { useT } from "../../i18n";
import ParentLinkRequestsList from "./ParentLinkRequestsList";

/**
 * Full-screen "Suivi parental" (student, read-only): opened from a PARENT_LINK_ACCEPTED / _REMOVED notification,
 * the e-mailed link (/schoolchat/demandes-suivi-parental) or the profile.
 */
const ParentLinkRequestsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [reloadKey, setReloadKey] = useState(0);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("App"));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.iconButton} accessibilityLabel={t("common.back")}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {t("parentLinks.title")}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setReloadKey((k) => k + 1)} colors={[colors.primary]} />}
      >
        <ParentLinkRequestsList reloadKey={reloadKey} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    iconButton: { padding: spacing.sm },
    title: { ...typography.h2, color: colors.text, flex: 1 },
  });

export default ParentLinkRequestsScreen;
