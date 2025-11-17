import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useUser } from "../../../context/UserContext";

const { width: screenWidth } = Dimensions.get("window");

const DashboardHeader = ({ onLogout, onNavigateToProfile }) => {
  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Animation values
  const notificationDropdownAnim = useRef(new Animated.Value(0)).current;
  const profileDropdownAnim = useRef(new Animated.Value(0)).current;

  const { user } = useUser();
  
  const getUserInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };
  
  const getConnectionDateTime = () => {
    if (user?.loginTime) {
      const loginDate = new Date(user.loginTime);
      return loginDate.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getRoleDisplay = () => {
    if (user?.decodedToken?.roles) {
      const nonUserRole = user.decodedToken.roles.find(role => role !== 'ROLE_USER');
      if (nonUserRole === 'ROLE_PROFESSOR') return 'Professeur';
      if (nonUserRole === 'ROLE_ADMIN') return 'Administrateur';
    }
    return 'Utilisateur';
  };
  
  const userData = {
    name: user?.username || 'Utilisateur',
    role: getRoleDisplay(),
    connectionDate: getConnectionDateTime(),
    initial: getUserInitial(user?.username),
  };

  // Mock notifications data
  const notifications = [
    {
      id: 1,
      title: "Nouveau message",
      message: "Vous avez reçu un nouveau message",
      time: "5min",
    },
    {
      id: 2,
      title: "Cours programmé",
      message: "Cours de mathématiques dans 1h",
      time: "1h",
    },
    {
      id: 3,
      title: "Rappel",
      message: "Réunion parents-professeurs demain",
      time: "2h",
    },
  ];

  const toggleNotificationDropdown = () => {
    if (showNotificationDropdown) {
      // Close animation
      Animated.timing(notificationDropdownAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => setShowNotificationDropdown(false));
    } else {
      // Open animation
      setShowNotificationDropdown(true);
      Animated.timing(notificationDropdownAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }

    // Close profile dropdown if open
    if (showProfileDropdown) {
      closeProfileDropdown();
    }
  };

  const toggleProfileDropdown = () => {
    if (showProfileDropdown) {
      closeProfileDropdown();
    } else {
      // Open animation
      setShowProfileDropdown(true);
      Animated.timing(profileDropdownAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }

    // Close notification dropdown if open
    if (showNotificationDropdown) {
      closeNotificationDropdown();
    }
  };

  const closeNotificationDropdown = () => {
    Animated.timing(notificationDropdownAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setShowNotificationDropdown(false));
  };

  const closeProfileDropdown = () => {
    Animated.timing(profileDropdownAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setShowProfileDropdown(false));
  };

  const closeAllDropdowns = () => {
    if (showNotificationDropdown) {
      closeNotificationDropdown();
    }
    if (showProfileDropdown) {
      closeProfileDropdown();
    }
  };

  const handleViewProfile = () => {
    closeProfileDropdown();
    if (onNavigateToProfile) {
      onNavigateToProfile();
    }
  };

  const handleLogout = () => {
    closeAllDropdowns();
    onLogout();
  };

  // Animation styles
  const notificationDropdownStyle = {
    opacity: notificationDropdownAnim,
    transform: [
      {
        translateY: notificationDropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        scale: notificationDropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 1],
        }),
      },
    ],
  };

  const profileDropdownStyle = {
    opacity: profileDropdownAnim,
    transform: [
      {
        translateY: profileDropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        scale: profileDropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 1],
        }),
      },
    ],
  };

  return (
    <>
      {/* Overlay to close dropdowns when clicking outside */}
      {(showNotificationDropdown || showProfileDropdown) && (
        <TouchableWithoutFeedback onPress={closeAllDropdowns}>
          <View style={headerStyles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <View style={headerStyles.header}>
        <View style={headerStyles.headerLeft}>
          <TouchableOpacity
            style={headerStyles.userAvatarContainer}
            onPress={toggleProfileDropdown}
          >
            <Text style={headerStyles.userInitial}>{userData.initial}</Text>
          </TouchableOpacity>
          <View style={headerStyles.headerInfo}>
            <Text style={headerStyles.appName}>SchoolChat</Text>
            <Text style={headerStyles.userRole}>{userData.role}</Text>
          </View>
        </View>

        <View style={headerStyles.headerRight}>
          <TouchableOpacity
            style={headerStyles.notificationButton}
            onPress={toggleNotificationDropdown}
          >
            <FontAwesome5 name="bell" size={18} color="#6B7280" />
            <View style={headerStyles.notificationBadge}>
              <Text style={headerStyles.notificationText}>3</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={headerStyles.logoutButton}
            onPress={handleLogout}
          >
            <FontAwesome5 name="sign-out-alt" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Profile Dropdown */}
        {showProfileDropdown && (
          <Animated.View
            style={[headerStyles.profileDropdown, profileDropdownStyle]}
          >
            <View style={headerStyles.dropdownHeader}>
              <View style={headerStyles.profileDropdownAvatar}>
                <Text style={headerStyles.profileDropdownInitial}>
                  {userData.initial}
                </Text>
              </View>
              <View style={headerStyles.profileDropdownInfo}>
                <Text style={headerStyles.profileDropdownName}>
                  {userData.name}
                </Text>
                <Text style={headerStyles.profileDropdownRole}>
                  {userData.role}
                </Text>
              </View>
            </View>

            <View style={headerStyles.dropdownDivider} />

            <View style={headerStyles.profileDropdownDetails}>
              <View style={headerStyles.profileDetailRow}>
                <FontAwesome5 name="clock" size={14} color="#6B7280" />
                <Text style={headerStyles.profileDetailText}>
                  Connecté le {userData.connectionDate}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={headerStyles.viewProfileButton}
              onPress={handleViewProfile}
            >
              <Text style={headerStyles.viewProfileButtonText}>
                Voir le profil
              </Text>
              <FontAwesome5 name="arrow-right" size={12} color="#4F46E5" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Notification Dropdown */}
        {showNotificationDropdown && (
          <Animated.View
            style={[
              headerStyles.notificationDropdown,
              notificationDropdownStyle,
            ]}
          >
            <View style={headerStyles.dropdownHeader}>
              <Text style={headerStyles.dropdownTitle}>Notifications</Text>
              <TouchableOpacity>
                <Text style={headerStyles.markAllReadText}>
                  Tout marquer lu
                </Text>
              </TouchableOpacity>
            </View>

            <View style={headerStyles.dropdownDivider} />

            <View style={headerStyles.notificationsList}>
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={headerStyles.notificationItem}
                >
                  <View style={headerStyles.notificationContent}>
                    <Text style={headerStyles.notificationTitle}>
                      {notification.title}
                    </Text>
                    <Text style={headerStyles.notificationMessage}>
                      {notification.message}
                    </Text>
                  </View>
                  <Text style={headerStyles.notificationTime}>
                    {notification.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={headerStyles.viewAllButton}>
              <Text style={headerStyles.viewAllButtonText}>
                Voir toutes les notifications
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </>
  );
};

const headerStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingTop: 50,
    zIndex: 1001,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EC4899",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userInitial: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerInfo: {
    flexDirection: "column",
  },
  appName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  userRole: {
    fontSize: 12,
    color: "#6B7280",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationButton: {
    position: "relative",
    marginRight: 16,
    padding: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  logoutButton: {
    padding: 8,
    marginLeft: 8,
  },

  // Profile Dropdown Styles
  profileDropdown: {
    position: "absolute",
    top: 70,
    left: 16,
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1002,
  },

  // Notification Dropdown Styles
  notificationDropdown: {
    position: "absolute",
    top: 70,
    right: 16,
    width: screenWidth - 32,
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1002,
  },

  // Shared Dropdown Styles
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },

  // Profile Dropdown Specific Styles
  profileDropdownAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EC4899",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  profileDropdownInitial: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  profileDropdownInfo: {
    flex: 1,
  },
  profileDropdownName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  profileDropdownRole: {
    fontSize: 12,
    color: "#6B7280",
  },
  profileDropdownDetails: {
    padding: 16,
    paddingTop: 12,
  },
  profileDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  profileDetailText: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 8,
  },
  viewProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  viewProfileButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4F46E5",
  },

  // Notification Dropdown Specific Styles
  markAllReadText: {
    fontSize: 13,
    color: "#4F46E5",
    fontWeight: "500",
  },
  notificationsList: {
    maxHeight: 250,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  notificationContent: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  viewAllButton: {
    padding: 16,
    paddingTop: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4F46E5",
  },
});

export default DashboardHeader;
