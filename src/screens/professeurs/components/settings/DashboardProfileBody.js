import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardProfileBody = ({ onLogout }) => {
  // Mock user data
  const [userData, setUserData] = useState({
    name: "Pierre Martin",
    email: "pierre.martin@schoolchat.com",
    role: "Professeur de Mathématiques",
    phone: "+237 699 999 999",
    bio: "Enseignant passionné par les mathématiques et l'innovation pédagogique.",
    avatar: "https://via.placeholder.com/150",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({ ...userData });

  const handleEditPress = () => {
    setIsEditing(true);
  };

  const handleSavePress = () => {
    setUserData({ ...editedData });
    setIsEditing(false);
    Alert.alert("Succès", "Vos informations ont été mises à jour.");
  };

  const handleCancelPress = () => {
    setEditedData({ ...userData });
    setIsEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Déconnecter",
          onPress: onLogout,
          style: "destructive",
        },
      ],
      { cancelable: false }
    );
  };

  const handleChange = (field, value) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: editedData.avatar }}
            style={styles.avatar}
            resizeMode="cover"
          />
          {isEditing && (
            <TouchableOpacity style={styles.editAvatarButton}>
              <FontAwesome5 name="camera" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          {isEditing ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom complet</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.name}
                  onChangeText={(text) => handleChange("name", text)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.email}
                  onChangeText={(text) => handleChange("email", text)}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Téléphone</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.phone}
                  onChangeText={(text) => handleChange("phone", text)}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rôle</Text>
                <TextInput
                  style={styles.input}
                  value={editedData.role}
                  onChangeText={(text) => handleChange("role", text)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={editedData.bio}
                  onChangeText={(text) => handleChange("bio", text)}
                  multiline
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.name}>{userData.name}</Text>
              <Text style={styles.role}>{userData.role}</Text>
              <Text style={styles.email}>{userData.email}</Text>
              <Text style={styles.phone}>{userData.phone}</Text>
              <Text style={styles.bio}>{userData.bio}</Text>
            </>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSavePress}
              >
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelPress}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={handleEditPress}
            >
              <FontAwesome5 name="edit" size={16} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paramètres du compte</Text>
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingItemLeft}>
            <FontAwesome5 name="lock" size={18} color="#4F46E5" />
            <Text style={styles.settingItemText}>Changer le mot de passe</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={16} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingItemLeft}>
            <FontAwesome5 name="bell" size={18} color="#4F46E5" />
            <Text style={styles.settingItemText}>Notifications</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Autres</Text>
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingItemLeft}>
            <FontAwesome5 name="info-circle" size={18} color="#4F46E5" />
            <Text style={styles.settingItemText}>
              À propos de l'application
            </Text>
          </View>
          <FontAwesome5 name="chevron-right" size={16} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
          <View style={styles.settingItemLeft}>
            <FontAwesome5 name="sign-out-alt" size={18} color="#EF4444" />
            <Text style={[styles.settingItemText, styles.logoutText]}>
              Déconnexion
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 70,
    backgroundColor: "#4F46E5",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: "#4F46E5",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: "#10B981",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
  },
  cancelButtonText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingItemText: {
    fontSize: 14,
    color: "#111827",
    marginLeft: 12,
  },
  logoutText: {
    color: "#EF4444",
  },
});

export default DashboardProfileBody;
