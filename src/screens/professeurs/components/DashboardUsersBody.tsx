import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useUser } from "../../../context/UserContext";
import { parentService, professorService, studentService } from "../../../services/api";
import { Badge, BottomSheet, Card, EmptyState, LoadingSpinner } from "../../../components/ui";
import { colors, spacing, typography } from "../../../styles/theme";

type Role = "eleve" | "parent" | "professeur";

interface RosterUser {
  id: string;
  name: string;
  role: Role;
  status: "active" | "inactive";
  email: string;
  telephone?: string;
  adresse?: string;
  niveau?: string;
  matricule?: string;
  enfantsCount?: number;
}

const ROLE_META: Record<Role, { label: string; icon: React.ComponentProps<typeof FontAwesome5>["name"]; color: string }> = {
  eleve: { label: "Élève", icon: "graduation-cap", color: colors.info },
  parent: { label: "Parent", icon: "user-friends", color: colors.warning },
  professeur: { label: "Professeur", icon: "chalkboard-teacher", color: colors.success },
};

/**
 * Professor's "Mes élèves, parents & collaborateurs" — the mobile-native
 * merge of web's three separate sidebar tabs (Élèves/Parents/Professeurs,
 * all rendered by the same shared *Content components admin uses). Web
 * gates Create/Edit/Delete on those pages behind `isAdmin` — a professor
 * only ever gets a read-only "Voir" action there — so this screen must stay
 * view-only too, never exposing a destructive delete for a role that has
 * none on web.
 */
const DashboardUsersBody = () => {
  const { user: currentUser } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | Role>("all");
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RosterUser | null>(null);

  const loadUsers = useCallback(async () => {
    if (!currentUser?.userId) return;
    setLoading(true);
    setError("");
    try {
      const [students, parents, collaborateurs] = await Promise.all([
        studentService.getByProfessor(currentUser.userId).catch(() => []),
        parentService.getByProfessor(currentUser.userId).catch(() => []),
        professorService.getCollaborateurs(currentUser.userId).catch(() => []),
      ]);

      const mapped: RosterUser[] = [
        ...students.map((s) => ({
          id: s.id,
          name: `${s.prenom ?? ""} ${s.nom ?? ""}`.trim() || "Élève",
          role: "eleve" as const,
          status: (s.etat === "INACTIVE" ? "inactive" : "active") as "active" | "inactive",
          email: s.email ?? "",
          niveau: (s as any).niveau,
          adresse: (s as any).adresse,
        })),
        ...parents.map((p) => ({
          id: p.id,
          name: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || "Parent",
          role: "parent" as const,
          status: (p.etat === "INACTIVE" ? "inactive" : "active") as "active" | "inactive",
          email: p.email ?? "",
          telephone: (p as any).telephone,
          adresse: (p as any).adresse,
          enfantsCount: Array.isArray((p as any).enfants) ? (p as any).enfants.length : undefined,
        })),
        ...collaborateurs.map((c) => ({
          id: c.id,
          name: `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || "Professeur",
          role: "professeur" as const,
          status: (c.etat === "INACTIVE" ? "inactive" : "active") as "active" | "inactive",
          email: c.email ?? "",
          telephone: c.telephone,
          matricule: c.matriculeProfesseur,
        })),
      ];
      setUsers(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filters = useMemo(
    () => [
      { id: "all" as const, label: "Tous", count: users.length },
      { id: "eleve" as const, label: "Élèves", count: users.filter((u) => u.role === "eleve").length },
      { id: "parent" as const, label: "Parents", count: users.filter((u) => u.role === "parent").length },
      { id: "professeur" as const, label: "Professeurs", count: users.filter((u) => u.role === "professeur").length },
    ],
    [users]
  );

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "all" || activeFilter === u.role;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Mes élèves, parents & collaborateurs</Text>
        </View>

        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterTab, activeFilter === filter.id && styles.activeFilterTab]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text style={[styles.filterTabText, activeFilter === filter.id && styles.activeFilterTabText]}>
                {filter.label} ({filter.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement..." />
        ) : filteredUsers.length === 0 ? (
          <EmptyState icon="users" title="Aucun utilisateur" message="Personne ne correspond à ce filtre pour le moment." />
        ) : (
          <View style={styles.usersList}>
            {filteredUsers.map((u) => {
              const meta = ROLE_META[u.role];
              return (
                <TouchableOpacity key={`${u.role}-${u.id}`} onPress={() => setSelected(u)} activeOpacity={0.7}>
                  <Card style={styles.userCard}>
                    <View style={[styles.userAvatar, { backgroundColor: meta.color + "20" }]}>
                      <FontAwesome5 name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>{u.name}</Text>
                      {u.email ? <Text style={styles.userEmail}>{u.email}</Text> : null}
                      <View style={styles.userMeta}>
                        <Text style={[styles.userRole, { color: meta.color }]}>{meta.label}</Text>
                        <Badge label={u.status === "active" ? "Actif" : "Inactif"} tone={u.status === "active" ? "success" : "danger"} />
                      </View>
                    </View>
                    <FontAwesome5 name="chevron-right" size={14} color={colors.grayLight} />
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected ? (
          <View style={styles.detailBody}>
            <View style={styles.detailBadgeRow}>
              <Badge label={ROLE_META[selected.role].label} tone="info" />
              <Badge label={selected.status === "active" ? "Actif" : "Inactif"} tone={selected.status === "active" ? "success" : "danger"} />
            </View>
            {selected.email ? (
              <View style={styles.detailRow}>
                <FontAwesome5 name="envelope" size={14} color={colors.textMuted} />
                <Text style={styles.detailText}>{selected.email}</Text>
              </View>
            ) : null}
            {selected.telephone ? (
              <View style={styles.detailRow}>
                <FontAwesome5 name="phone" size={14} color={colors.textMuted} />
                <Text style={styles.detailText}>{selected.telephone}</Text>
              </View>
            ) : null}
            {selected.adresse ? (
              <View style={styles.detailRow}>
                <FontAwesome5 name="map-marker-alt" size={14} color={colors.textMuted} />
                <Text style={styles.detailText}>{selected.adresse}</Text>
              </View>
            ) : null}
            {selected.niveau ? (
              <View style={styles.detailRow}>
                <FontAwesome5 name="layer-group" size={14} color={colors.textMuted} />
                <Text style={styles.detailText}>Niveau : {selected.niveau}</Text>
              </View>
            ) : null}
            {selected.matricule ? (
              <View style={styles.detailRow}>
                <FontAwesome5 name="id-badge" size={14} color={colors.textMuted} />
                <Text style={styles.detailText}>Matricule : {selected.matricule}</Text>
              </View>
            ) : null}
            {selected.enfantsCount !== undefined ? (
              <View style={styles.detailRow}>
                <FontAwesome5 name="child" size={14} color={colors.textMuted} />
                <Text style={styles.detailText}>{selected.enfantsCount} enfant(s)</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  pageHeader: { marginTop: 20, marginBottom: spacing.lg },
  pageTitle: { ...typography.h1, color: colors.text },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  searchIcon: { marginRight: spacing.md },
  searchInput: { flex: 1, fontSize: 16, color: colors.text },
  filterContainer: { marginBottom: spacing.lg },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.sm,
    backgroundColor: colors.grayLight,
  },
  activeFilterTab: { backgroundColor: colors.primary },
  filterTabText: { fontSize: 14, fontWeight: "500", color: colors.textMuted },
  activeFilterTabText: { color: colors.white },
  error: { color: colors.danger, marginBottom: spacing.md },
  usersList: { gap: spacing.md, marginBottom: spacing.lg },
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  userAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  userDetails: { flex: 1 },
  userName: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
  userEmail: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  userMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  userRole: { fontSize: 12, fontWeight: "600" },
  detailBody: { gap: spacing.md, paddingBottom: spacing.lg },
  detailBadgeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailText: { ...typography.body, color: colors.text },
});

export default DashboardUsersBody;
