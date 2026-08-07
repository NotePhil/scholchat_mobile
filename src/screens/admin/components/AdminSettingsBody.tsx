import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Avatar, Card } from "../../../components/ui";
import { colors, spacing, typography } from "../../../styles/theme";
import { useUser } from "../../../context/UserContext";

const AdminSettingsBody = ({ onLogout }: { onLogout: () => void }) => {
  const { user } = useUser();
  const name = `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim() || user?.username || "Administrateur";

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnecter", style: "destructive", onPress: onLogout },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <Card style={styles.profileCard}>
        <Avatar name={name} size={72} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>Administrateur</Text>
      </Card>

      <Card style={styles.section} padded={false}>
        <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
          <View style={styles.settingLeft}>
            <FontAwesome5 name="sign-out-alt" size={18} color={colors.danger} />
            <Text style={[styles.settingText, { color: colors.danger }]}>Déconnexion</Text>
          </View>
        </TouchableOpacity>
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  profileCard: { marginHorizontal: 16, alignItems: "center", marginBottom: spacing.lg },
  name: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  email: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  role: { ...typography.caption, color: colors.primary, fontWeight: "700", marginTop: spacing.sm },
  section: { marginHorizontal: 16 },
  settingItem: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  settingText: { ...typography.body, color: colors.text },
});

export default AdminSettingsBody;
