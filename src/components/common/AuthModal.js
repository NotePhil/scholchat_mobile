import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { styles } from "../../styles/globalStyles";

const AuthModal = ({ visible, onClose, onNavigateToDashboard, onNavigateToAdmin, onSignUp }) => {
  const [authMode, setAuthMode] = useState("signin");
  const [signupStep, setSignupStep] = useState(1);
  const [rememberMe, setRememberMe] = useState(false);
  const [userType, setUserType] = useState("");
  const [showUserTypeDropdown, setShowUserTypeDropdown] = useState(false);
  const [showEducationLevelDropdown, setShowEducationLevelDropdown] =
    useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
    userType: "",
    cniRecto: null,
    cniVerso: null,
    profilePhoto: null,
    teacherMatricule: "",
    educationLevel: "",
  });

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileUpload = (fieldName) => {
    console.log(`File upload for ${fieldName} - would open file picker`);
    setFormData((prev) => ({
      ...prev,
      [fieldName]: "file_selected.jpg",
    }));
  };

  const handleSignIn = () => {
    console.log("Sign in attempt with:", {
      email: formData.email,
      password: formData.password,
    });

    // Check for admin credentials
    if (formData.email === "admin@admin.com" && formData.password === "admin@admin.com") {
      onNavigateToAdmin();
    } else {
      // Navigate to professor dashboard for all other credentials
      onNavigateToDashboard();
    }
  };

  const handleSignupSubmit = () => {
    if (signupStep === 1) {
      setSignupStep(2);
    } else {
      onSignUp({ ...formData, userType });
      setSignupStep(1);
    }
  };

  const userTypes = ["Professeur", "Élève", "Parent"];
  const educationLevels = ["Primaire", "Collège", "Lycée", "Université"];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <FontAwesome5 name="times" size={20} color="#6B7280" />
          </TouchableOpacity>

          <View style={styles.authTabs}>
            <TouchableOpacity
              style={[
                styles.authTab,
                authMode === "signin" && styles.activeAuthTab,
              ]}
              onPress={() => setAuthMode("signin")}
            >
              <Text
                style={[
                  styles.authTabText,
                  authMode === "signin" && styles.activeAuthTabText,
                ]}
              >
                Connexion
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.authTab,
                authMode === "signup" && styles.activeAuthTab,
              ]}
              onPress={() => setAuthMode("signup")}
            >
              <Text
                style={[
                  styles.authTabText,
                  authMode === "signup" && styles.activeAuthTabText,
                ]}
              >
                Inscription
              </Text>
            </TouchableOpacity>
          </View>

          {authMode === "signin" ? (
            <View style={styles.authForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Entrez votre email"
                  value={formData.email}
                  onChangeText={(text) => handleInputChange("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Entrez votre mot de passe"
                  value={formData.password}
                  onChangeText={(text) => handleInputChange("password", text)}
                  secureTextEntry={true}
                />
              </View>

              <View style={authModalStyles.rememberForgotContainer}>
                <TouchableOpacity
                  style={authModalStyles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <FontAwesome5
                    name={rememberMe ? "check-square" : "square"}
                    size={16}
                    color="#4F46E5"
                  />
                  <Text style={authModalStyles.rememberMeText}>
                    Se souvenir de moi
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text style={authModalStyles.forgotPassword}>
                    Mot de passe oublié ?
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, authModalStyles.signinButton]}
                onPress={handleSignIn}
              >
                <FontAwesome5
                  name="sign-in-alt"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.buttonText}>Se connecter</Text>
              </TouchableOpacity>

              <Text style={styles.authSwitchText}>
                Pas encore de compte?{" "}
                <Text
                  style={styles.authSwitchLink}
                  onPress={() => setAuthMode("signup")}
                >
                  S'inscrire
                </Text>
              </Text>

              <Text style={authModalStyles.termsText}>
                En vous connectant, vous acceptez nos{" "}
                <Text style={authModalStyles.termsLink}>
                  Conditions d'utilisation
                </Text>{" "}
                et notre{" "}
                <Text style={authModalStyles.termsLink}>
                  Politique de confidentialité
                </Text>
              </Text>
            </View>
          ) : (
            <View style={styles.authForm}>
              <View style={authModalStyles.signupProgressContainer}>
                <View style={authModalStyles.progressNumbers}>
                  <View
                    style={[
                      styles.progressStep,
                      signupStep === 1 && styles.activeProgressStep,
                    ]}
                  >
                    <Text
                      style={[
                        styles.progressStepText,
                        signupStep === 1 && styles.activeProgressStepText,
                      ]}
                    >
                      1
                    </Text>
                  </View>
                  <View style={styles.progressLine} />
                  <View
                    style={[
                      styles.progressStep,
                      signupStep === 2 && styles.activeProgressStep,
                    ]}
                  >
                    <Text
                      style={[
                        styles.progressStepText,
                        signupStep === 2 && styles.activeProgressStepText,
                      ]}
                    >
                      2
                    </Text>
                  </View>
                </View>
                <Text style={authModalStyles.progressLabelRight}>
                  {signupStep === 1
                    ? "Informations personnelles"
                    : "Détails du compte"}
                </Text>
              </View>

              {signupStep === 1 ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Prénom</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Entrez votre prénom"
                      value={formData.firstName}
                      onChangeText={(text) =>
                        handleInputChange("firstName", text)
                      }
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nom</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Entrez votre nom"
                      value={formData.lastName}
                      onChangeText={(text) =>
                        handleInputChange("lastName", text)
                      }
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Entrez votre email"
                      value={formData.email}
                      onChangeText={(text) => handleInputChange("email", text)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Numéro de téléphone</Text>
                    <View style={styles.phoneInputContainer}>
                      <View style={styles.countryCodeContainer}>
                        <Text style={styles.countryCode}>🇨🇲 +237</Text>
                      </View>
                      <TextInput
                        style={[styles.input, styles.phoneInput]}
                        placeholder="Numéro de téléphone"
                        value={formData.phone}
                        onChangeText={(text) =>
                          handleInputChange("phone", text)
                        }
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Adresse</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Entrez votre adresse"
                      value={formData.address}
                      onChangeText={(text) =>
                        handleInputChange("address", text)
                      }
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Type d'utilisateur</Text>
                    <TouchableOpacity
                      style={[styles.input, authModalStyles.dropdownTrigger]}
                      onPress={() =>
                        setShowUserTypeDropdown(!showUserTypeDropdown)
                      }
                    >
                      <Text>{userType || "Sélectionnez un type"}</Text>
                      <FontAwesome5
                        name={
                          showUserTypeDropdown ? "chevron-up" : "chevron-down"
                        }
                        size={14}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                    {showUserTypeDropdown && (
                      <View style={authModalStyles.dropdown}>
                        {userTypes.map((type, index) => (
                          <TouchableOpacity
                            key={index}
                            style={authModalStyles.dropdownItem}
                            onPress={() => {
                              setUserType(type);
                              setShowUserTypeDropdown(false);
                            }}
                          >
                            <Text>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {userType === "Professeur" && (
                    <>
                      <View style={styles.inputContainer}>
                        <Text
                          style={[
                            styles.inputLabel,
                            authModalStyles.requiredField,
                          ]}
                        >
                          CNI Recto *
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.input,
                            authModalStyles.fileUploadButton,
                          ]}
                          onPress={() => handleFileUpload("cniRecto")}
                        >
                          <FontAwesome5
                            name="upload"
                            size={16}
                            color="#6B7280"
                          />
                          <Text style={authModalStyles.fileUploadText}>
                            {formData.cniRecto
                              ? "Fichier sélectionné"
                              : "Aucun fichier choisi"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.inputContainer}>
                        <Text
                          style={[
                            styles.inputLabel,
                            authModalStyles.requiredField,
                          ]}
                        >
                          CNI Verso *
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.input,
                            authModalStyles.fileUploadButton,
                          ]}
                          onPress={() => handleFileUpload("cniVerso")}
                        >
                          <FontAwesome5
                            name="upload"
                            size={16}
                            color="#6B7280"
                          />
                          <Text style={authModalStyles.fileUploadText}>
                            {formData.cniVerso
                              ? "Fichier sélectionné"
                              : "Aucun fichier choisi"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.inputContainer}>
                        <Text
                          style={[
                            styles.inputLabel,
                            authModalStyles.requiredField,
                          ]}
                        >
                          Photo de profil *
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.input,
                            authModalStyles.fileUploadButton,
                          ]}
                          onPress={() => handleFileUpload("profilePhoto")}
                        >
                          <FontAwesome5
                            name="upload"
                            size={16}
                            color="#6B7280"
                          />
                          <Text style={authModalStyles.fileUploadText}>
                            {formData.profilePhoto
                              ? "Fichier sélectionné"
                              : "Aucun fichier choisi"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>
                          Matricule du professeur (Optionnel)
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Entrez votre matricule"
                          value={formData.teacherMatricule}
                          onChangeText={(text) =>
                            handleInputChange("teacherMatricule", text)
                          }
                        />
                      </View>
                    </>
                  )}

                  {userType === "Élève" && (
                    <View style={styles.inputContainer}>
                      <Text
                        style={[
                          styles.inputLabel,
                          authModalStyles.requiredField,
                        ]}
                      >
                        Niveau d'éducation *
                      </Text>
                      <TouchableOpacity
                        style={[styles.input, authModalStyles.dropdownTrigger]}
                        onPress={() =>
                          setShowEducationLevelDropdown(
                            !showEducationLevelDropdown
                          )
                        }
                      >
                        <Text>
                          {formData.educationLevel || "Sélectionnez un niveau"}
                        </Text>
                        <FontAwesome5
                          name={
                            showEducationLevelDropdown
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={14}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {showEducationLevelDropdown && (
                        <View style={authModalStyles.dropdown}>
                          {educationLevels.map((level, index) => (
                            <TouchableOpacity
                              key={index}
                              style={authModalStyles.dropdownItem}
                              onPress={() => {
                                handleInputChange("educationLevel", level);
                                setShowEducationLevelDropdown(false);
                              }}
                            >
                              <Text>{level}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              {signupStep === 1 ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSignupSubmit}
                >
                  <FontAwesome5
                    name="arrow-right"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.buttonText}>Étape suivante</Text>
                </TouchableOpacity>
              ) : (
                <View style={authModalStyles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, authModalStyles.backButton]}
                    onPress={() => setSignupStep(1)}
                  >
                    <FontAwesome5
                      name="arrow-left"
                      size={16}
                      color="#111827"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.secondaryButtonText}>Retour</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, authModalStyles.createButton]}
                    onPress={handleSignupSubmit}
                  >
                    <FontAwesome5
                      name="user-plus"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.buttonText}>Créer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const authModalStyles = StyleSheet.create({
  rememberForgotContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  rememberMe: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberMeText: {
    marginLeft: 8,
    color: "#6B7280",
  },
  forgotPassword: {
    color: "#4F46E5",
    textDecorationLine: "underline",
  },
  termsText: {
    textAlign: "center",
    marginTop: 16,
    color: "#6B7280",
  },
  termsLink: {
    color: "#4F46E5",
    textDecorationLine: "underline",
  },
  signupProgressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  progressNumbers: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressLabelRight: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
  },
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 12,
  },
  dropdown: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 10,
    marginTop: 4,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  requiredField: {
    color: "#111827",
    fontWeight: "500",
  },
  fileUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
  },
  fileUploadText: {
    marginLeft: 8,
    color: "#6B7280",
    fontSize: 14,
  },
  signinButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  createButton: {
    flex: 1.2,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default AuthModal;
