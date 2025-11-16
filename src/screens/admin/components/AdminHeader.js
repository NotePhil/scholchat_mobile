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

const { width: screenWidth } = Dimensions.get("window");

const AdminHeader = ({ onLogout, onNavigateToProfile }) => {
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const notificationDropdownAnim = useRef(new Animated.Value(0)).current;
  const profileDropdownAnim = useRef(new Animated.Value(0)).current;

  const userData = {
    name: "Admin User",
    role: "Administrateur",
    connectionDate: "20/09/2025 14:30",
    initial: "A",
  };

  const notifications = [
    {
      id: 1,
      title: "Nouvelle inscription",
      message: "Un nouveau professeur s'est inscrit",
      time: "5min",
    },
    {
      id: 2,
      title: "Rapport système",
      message: "Rapport mensuel disponible",
      time: "1h",
    },
  ];

  const toggleNotificationDropdown = () => {
    if (showNotificationDropdown) {
      Animated.timing(notificationDropdownAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => setShowNotificationDropdown(false));
    } else {
      setShowNotificationDropdown(true);
      Animated.timing(notificationDropdownAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
    if (showProfileDropdown) {
      closeProfileDropdown();
    }
  };

  const toggleProfileDropdown = () => {
    if (showProfileDropdown) {
      closeProfileDropdown();
    } else {
      setShowProfileDropdown(true);
      Animated.timing(profileDropdownAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
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

  const notificationDropdownStyle = {
    opacity: notificationDropdownAnim,
    transform: [
      {
        translateY: notificationDropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
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
    ],
  };

  return (
    <>
      {(showNotificationDropdown || showProfileDropdown) && (
        <TouchableWithoutFeedback onPress={closeAllDropdowns}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.userAvatarContainer}
            onPress={toggleProfileDropdown}
          >
            <Text style={styles.userInitial}>{userData.initial}</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.appName}>SchoolChat Admin</Text>
            <Text style={styles.userRole}>{userData.role}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={toggleNotificationDropdown}
          >
            <FontAwesome5 name="bell" size={18} color="#6B7280" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>2</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <FontAwesome5 name="sign-out-alt" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {showProfileDropdown && (
          <Animated.View style={[styles.profileDropdown, profileDropdownStyle]}>
            <View style={styles.dropdownHeader}>
              <View style={styles.profileDropdownAvatar}>
                <Text style={styles.profileDropdownInitial}>
                  {userData.initial}
                </Text>
              </View>
              <View style={styles.profileDropdownInfo}>
                <Text style={styles.profileDropdownName}>{userData.name}</Text>
                <Text style={styles.profileDropdownRole}>{userData.role}</Text>
              </View>
            </View>

            <View style={styles.dropdownDivider} />

            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={handleViewProfile}
            >
              <Text style={styles.viewProfileButtonText}>Voir le profil</Text>
              <FontAwesome5 name="arrow-right" size={12} color="#4F46E5" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {showNotificationDropdown && (
          <Animated.View
            style={[styles.notificationDropdown, notificationDropdownStyle]}
          >
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Notifications</Text>
            </View>

            <View style={styles.dropdownDivider} />

            <View style={styles.notificationsList}>
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={styles.notificationItem}
                >
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                  </View>
                  <Text style={styles.notificationTime}>
                    {notification.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: "#DC2626",
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
  profileDropdownAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DC2626",
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
});

export default AdminHeader;