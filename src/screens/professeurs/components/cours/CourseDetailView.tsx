import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Badge, Button } from '../../../../components/ui';
import { colors, radius, spacing, typography } from '../../../../styles/theme';
import { Cours } from './DashboardCoursBody';

export interface CourseDetailViewProps {
  cours: Cours;
  onBack: () => void;
  onEdit: (cours: Cours) => void;
  onDelete: (cours: Cours) => void;
  onProgram: (cours: Cours) => void;
}

/**
 * Full page Course Details View (Page seule et non modale).
 */
export const CourseDetailView = ({
  cours,
  onBack,
  onEdit,
  onDelete,
  onProgram,
}: CourseDetailViewProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'chapitres' | 'docs'>('details');

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Cours : ${cours.titre}\n${cours.description || ''}`,
        title: cours.titre,
      });
    } catch {
      // ignore
    }
  };

  const isPublie = cours.etat === 'PUBLIE';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Détails du cours</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {cours.titre}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerShareBtn} onPress={handleShare}>
          <FontAwesome5 name="share-alt" size={15} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
            Détails
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chapitres' && styles.activeTab]}
          onPress={() => setActiveTab('chapitres')}
        >
          <Text style={[styles.tabText, activeTab === 'chapitres' && styles.activeTabText]}>
            Chapitres ({cours.chapitres?.length ?? 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'docs' && styles.activeTab]}
          onPress={() => setActiveTab('docs')}
        >
          <Text style={[styles.tabText, activeTab === 'docs' && styles.activeTabText]}>
            Informations
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'details' && (
          <>
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <View style={styles.courseIconBox}>
                  <Text style={styles.courseIconText}>
                    {cours.titre.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseTitle}>{cours.titre}</Text>
                  <View style={styles.badgeRow}>
                    <Badge
                      label={cours.etat}
                      tone={isPublie ? 'success' : 'warning'}
                    />
                    <Badge
                      label={cours.restriction || 'PUBLIC'}
                      tone="neutral"
                    />
                  </View>
                </View>
              </View>

              {cours.description ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <Text style={styles.sectionText}>{cours.description}</Text>
                </View>
              ) : null}

              {cours.references ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Références & Bibliographie</Text>
                  <Text style={styles.sectionText}>{cours.references}</Text>
                </View>
              ) : null}

              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <FontAwesome5 name="calendar-alt" size={13} color={colors.textMuted} />
                  <Text style={styles.metaText}>
                    Créé le : {new Date(cours.dateCreation).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <FontAwesome5 name="book" size={13} color={colors.textMuted} />
                  <Text style={styles.metaText}>
                    Chapitres enregistrés : {cours.chapitres?.length ?? 0}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsBar}>
                <Button
                  label="Programmer ce cours"
                  onPress={() => onProgram(cours)}
                  style={{ flex: 1, backgroundColor: colors.primary }}
                />
                <TouchableOpacity
                  style={styles.actionIconButton}
                  onPress={() => onEdit(cours)}
                >
                  <FontAwesome5 name="edit" size={15} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionIconButton, { borderColor: colors.danger }]}
                  onPress={() => onDelete(cours)}
                >
                  <FontAwesome5 name="trash" size={15} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {activeTab === 'chapitres' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chapitres du cours</Text>
            {(!cours.chapitres || cours.chapitres.length === 0) ? (
              <Text style={styles.emptyText}>Aucun chapitre défini pour ce cours.</Text>
            ) : (
              cours.chapitres.map((ch, i) => (
                <View key={i} style={styles.chapterRow}>
                  <View style={styles.chapterNumBox}>
                    <Text style={styles.chapterNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.chapterTitle}>{ch}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'docs' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Renseignements complémentaires</Text>
            <DetailLine label="Identifiant" value={cours.id} />
            <DetailLine label="Statut" value={cours.etat} />
            <DetailLine label="Visibilité" value={cours.restriction || 'PUBLIC'} />
            <DetailLine label="Date de création" value={new Date(cours.dateCreation).toLocaleString('fr-FR')} />
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const DetailLine = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailLine}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerEyebrow: { ...typography.caption, color: colors.textMuted },
  headerTitle: { ...typography.h3, color: colors.text },
  headerShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { ...typography.body, color: colors.textMuted },
  activeTabText: { color: colors.primary, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  titleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  courseIconBox: {
    width: 50,
    height: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseIconText: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  courseTitle: { ...typography.h2, color: colors.text, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  section: { marginTop: spacing.md },
  sectionLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700', marginBottom: 2 },
  sectionText: { ...typography.body, color: colors.text },
  metaBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { ...typography.caption, color: colors.textMuted },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionIconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  emptyText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chapterNumBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  chapterTitle: { ...typography.body, color: colors.text, flex: 1 },
  detailLine: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700', fontSize: 10, textTransform: 'uppercase' },
  detailValue: { ...typography.body, color: colors.text, marginTop: 2 },
});

export default CourseDetailView;
