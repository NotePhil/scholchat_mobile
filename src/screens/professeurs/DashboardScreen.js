import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

const DashboardScreen = ({ navigation, onLogout }) => {
  // Sample data for the pie chart (you can integrate react-native-chart-kit later)
  const pieData = [
    {
      name: 'Professeurs',
      population: 4,
      color: '#4F46E5',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
    {
      name: 'Élèves',
      population: 12,
      color: '#10B981',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
  ];

  return (
    <View style={dashboardStyles.container}>
      {/* Header */}
      <View style={dashboardStyles.header}>
        <View style={dashboardStyles.headerLeft}>
          <View style={dashboardStyles.logoContainer}>
            <Text style={dashboardStyles.logoText}>S</Text>
          </View>
          <View style={dashboardStyles.headerInfo}>
            <Text style={dashboardStyles.appName}>SchoolChat</Text>
            <Text style={dashboardStyles.userRole}>Professeur</Text>
          </View>
        </View>
        <View style={dashboardStyles.headerRight}>
          <TouchableOpacity style={dashboardStyles.notificationButton}>
            <FontAwesome5 name="bell" size={18} color="#6B7280" />
            <View style={dashboardStyles.notificationBadge}>
              <Text style={dashboardStyles.notificationText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={dashboardStyles.profileContainer}
            onPress={onLogout}
          >
            <View style={dashboardStyles.profileAvatar}>
              <Text style={dashboardStyles.profileInitial}>P</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={dashboardStyles.content}>
        {/* Welcome Section */}
        <View style={dashboardStyles.welcomeSection}>
          <Text style={dashboardStyles.welcomeText}>Bienvenue Mr Simo</Text>
          <TouchableOpacity style={dashboardStyles.updateButton}>
            <Text style={dashboardStyles.updateButtonText}>Actualiser</Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard Description */}
        <Text style={dashboardStyles.dashboardDescription}>
          Tableau de bord de gestion de la plateforme
        </Text>

        {/* Statistics Grid */}
        <View style={dashboardStyles.statsGrid}>
          {/* Total Users */}
          <View style={[dashboardStyles.statCard, dashboardStyles.totalUsersCard]}>
            <View style={dashboardStyles.statHeader}>
              <FontAwesome5 name="users" size={20} color="#4F46E5" />
              <Text style={dashboardStyles.statGrowth}>+12% ce mois</Text>
            </View>
            <Text style={dashboardStyles.statNumber}>16</Text>
            <Text style={dashboardStyles.statTitle}>Total Utilisateurs</Text>
            <Text style={dashboardStyles.statSubtitle}>Tous les utilisateurs</Text>
          </View>

          {/* Teachers */}
          <View style={[dashboardStyles.statCard, dashboardStyles.teachersCard]}>
            <View style={dashboardStyles.statHeader}>
              <FontAwesome5 name="chalkboard-teacher" size={20} color="#10B981" />
              <Text style={dashboardStyles.statGrowth}>+8% ce mois</Text>
            </View>
            <Text style={dashboardStyles.statNumber}>4</Text>
            <Text style={dashboardStyles.statTitle}>Professeurs</Text>
            <Text style={dashboardStyles.statSubtitle}>3 actifs</Text>
          </View>

          {/* Classes */}
          <View style={[dashboardStyles.statCard, dashboardStyles.classesCard]}>
            <View style={dashboardStyles.statHeader}>
              <FontAwesome5 name="door-open" size={20} color="#8B5CF6" />
              <Text style={dashboardStyles.statGrowth}>+15% ce mois</Text>
            </View>
            <Text style={dashboardStyles.statNumber}>6</Text>
            <Text style={dashboardStyles.statTitle}>Classes</Text>
            <Text style={dashboardStyles.statSubtitle}>2 actives</Text>
          </View>

          {/* Establishments */}
          <View style={[dashboardStyles.statCard, dashboardStyles.establishmentsCard]}>
            <View style={dashboardStyles.statHeader}>
              <FontAwesome5 name="building" size={20} color="#F97316" />
              <Text style={dashboardStyles.statGrowth}>+5% ce mois</Text>
            </View>
            <Text style={dashboardStyles.statNumber}>2</Text>
            <Text style={dashboardStyles.statTitle}>Établissements</Text>
            <Text style={dashboardStyles.statSubtitle}>1 actif</Text>
          </View>
        </View>

        {/* User Distribution Chart */}
        <View style={dashboardStyles.chartSection}>
          <Text style={dashboardStyles.chartTitle}>Répartition des Utilisateurs</Text>
          <View style={dashboardStyles.chartContainer}>
            <Text style={dashboardStyles.chartPlaceholder}>
              Graphique en secteurs sera affiché ici
            </Text>
            {/* You can add PieChart component here when react-native-chart-kit is installed */}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={dashboardStyles.bottomNav}>
        <TouchableOpacity style={dashboardStyles.navItem}>
          <FontAwesome5 name="trophy" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={dashboardStyles.navItem}>
          <FontAwesome5 name="chart-bar" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={[dashboardStyles.navItem, dashboardStyles.activeNavItem]}>
          <FontAwesome5 name="th-large" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={dashboardStyles.navItem}>
          <FontAwesome5 name="users" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={dashboardStyles.navItem}>
          <FontAwesome5 name="comments" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={dashboardStyles.navItem}>
          <FontAwesome5 name="cog" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const dashboardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 50, // Account for status bar
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flexDirection: 'column',
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  userRole: {
    fontSize: 12,
    color: '#6B7280',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    marginRight: 16,
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  updateButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dashboardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statGrowth: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  totalUsersCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  teachersCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  classesCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  establishmentsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
  },
  chartSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  chartPlaceholder: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navItem: {
    padding: 8,
  },
  activeNavItem: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 12,
  },
});

export default DashboardScreen;