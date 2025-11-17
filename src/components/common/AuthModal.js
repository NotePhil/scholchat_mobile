import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import * as DocumentPicker from 'expo-document-picker';
import { FontAwesome5 } from "@expo/vector-icons";
import { styles } from "../../styles/globalStyles";
import { authService } from '../../services/home/authService';
import { Alert } from 'react-native';
import { useUser } from '../../context/UserContext';
import { getNavigationRoute } from '../../utils/tokenUtils';

const AuthModal = ({ visible, onClose, onNavigateToDashboard, onNavigateToAdmin, onSignUp }) => {
  const { login } = useUser();
  const [authMode, setAuthMode] = useState("signin");
  const [signupStep, setSignupStep] = useState(1);
  const [rememberMe, setRememberMe] = useState(false);
  const [userType, setUserType] = useState("");
  const [showUserTypeDropdown, setShowUserTypeDropdown] = useState(false);
  const [showEducationLevelDropdown, setShowEducationLevelDropdown] =
    useState(false);
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState("+237");
  const [selectedCountryFlag, setSelectedCountryFlag] = useState("🇨🇲");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    cniRecto: 'idle',
    cniVerso: 'idle', 
    profilePhoto: 'idle'
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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

  const handleFileUpload = async (fieldName) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFormData((prev) => ({
          ...prev,
          [fieldName]: file,
        }));
      }
    } catch (error) {
      console.log('File selection error:', error);
    }
  };

  const handleFileDelete = (fieldName) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: null,
    }));
  };

  const handleSignIn = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const loginResponse = await authService.login(formData.email, formData.password);
      
      console.log('Login successful:', loginResponse);
      
      // Update user context
      login(loginResponse);
      
      // Navigate based on JWT token role
      const route = getNavigationRoute(loginResponse.accessToken);
      if (route === 'admin') {
        onNavigateToAdmin();
      } else {
        onNavigateToDashboard();
      }
      
      // Close modal and reset form
      onClose();
      setFormData({ ...formData, email: '', password: '' });
      
    } catch (error) {
      console.error('Login failed:', error);
      setErrorMessage(error.message);
      Alert.alert('Erreur de connexion', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async () => {
    if (signupStep === 1) {
      setSignupStep(2);
    } else {
      if (userType === "Professeur") {
        await handleProfessorSignup();
      } else {
        onSignUp({ ...formData, userType });
        setSignupStep(1);
      }
    }
  };

  const handleProfessorSignup = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      console.log('=== STARTING PROFESSOR SIGNUP ===');
      console.log('Form data:', formData);
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Format d\'email invalide. Veuillez vérifier votre adresse email.');
      }
      
      // Step 1: Create professor
      console.log('Step 1: Creating professor...');
      const professor = await authService.createProfessor(formData);
      console.log('Professor created successfully:', professor);
      const professorId = professor.id;
      console.log('Professor ID:', professorId);
      
      // Step 2: Upload files
      console.log('Step 2: Starting file uploads...');
      const uploadPromises = [];
      const urls = {};
      
      if (formData.cniRecto) {
        console.log('Uploading CNI Recto:', formData.cniRecto.name);
        setUploadStatus(prev => ({ ...prev, cniRecto: 'loading' }));
        uploadPromises.push(
          uploadFileToServer('cniRecto', formData.cniRecto, professorId, 'CNI_RECTO')
            .then(url => { 
              console.log('CNI Recto uploaded successfully:', url);
              urls.cniRecto = url; 
              setUploadStatus(prev => ({ ...prev, cniRecto: 'success' })); 
            })
            .catch(error => { 
              console.error('CNI Recto upload failed:', error);
              setUploadStatus(prev => ({ ...prev, cniRecto: 'error' })); 
              throw new Error('CNI Recto upload failed'); 
            })
        );
      }
      
      if (formData.cniVerso) {
        setUploadStatus(prev => ({ ...prev, cniVerso: 'loading' }));
        uploadPromises.push(
          uploadFileToServer('cniVerso', formData.cniVerso, professorId, 'CNI_VERSO')
            .then(url => { urls.cniVerso = url; setUploadStatus(prev => ({ ...prev, cniVerso: 'success' })); })
            .catch(() => { setUploadStatus(prev => ({ ...prev, cniVerso: 'error' })); throw new Error('CNI Verso upload failed'); })
        );
      }
      
      if (formData.profilePhoto) {
        setUploadStatus(prev => ({ ...prev, profilePhoto: 'loading' }));
        uploadPromises.push(
          uploadFileToServer('profilePhoto', formData.profilePhoto, professorId, 'SELFIE')
            .then(url => { urls.selfie = url; setUploadStatus(prev => ({ ...prev, profilePhoto: 'success' })); })
            .catch(() => { setUploadStatus(prev => ({ ...prev, profilePhoto: 'error' })); throw new Error('Selfie upload failed'); })
        );
      }
      
      console.log('Waiting for all uploads to complete...');
      await Promise.all(uploadPromises);
      console.log('All uploads completed. URLs:', urls);
      
      // Step 3: Update professor with URLs
      console.log('Step 3: Updating professor with URLs...');
      const updatedProfessor = await authService.updateProfessorUrls(professorId, urls);
      console.log('Professor updated successfully:', updatedProfessor);
      
      // Success
      setIsLoading(false);
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        onClose();
        setSignupStep(1);
        setFormData({
          firstName: "", lastName: "", email: "", phone: "", address: "",
          password: "", confirmPassword: "", userType: "", cniRecto: null,
          cniVerso: null, profilePhoto: null, teacherMatricule: "", educationLevel: ""
        });
      }, 2000);
      
    } catch (error) {
      console.error('=== PROFESSOR SIGNUP FAILED ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      setIsLoading(false);
      setErrorMessage(error.message);
      Alert.alert('Erreur', error.message);
    }
  };
  
  const uploadFileToServer = async (fieldName, file, professorId, documentType) => {
    console.log(`Getting presigned URL for ${fieldName}:`, {
      fileName: file.name,
      mimeType: file.mimeType,
      professorId,
      documentType
    });
    
    const presignedResponse = await authService.getPresignedUrl(
      file.name,
      file.mimeType,
      professorId,
      documentType
    );
    console.log(`Presigned URL received for ${fieldName}:`, presignedResponse);
    
    console.log(`Uploading file ${fieldName} to MinIO...`);
    await authService.uploadFile(presignedResponse.url, file);
    console.log(`File ${fieldName} uploaded successfully to MinIO`);
    
    // Return shorter URL without query parameters for database storage
    const baseUrl = presignedResponse.url.split('?')[0];
    console.log(`Returning base URL for ${fieldName}:`, baseUrl);
    return baseUrl;
  };

  const userTypes = ["Professeur", "Élève", "Parent"];
  const educationLevels = ["Primaire", "Collège", "Lycée", "Université"];
  const countryCodes = [
    { flag: "🇨🇲", code: "+237", country: "Cameroun" },
    { flag: "🇫🇷", code: "+33", country: "France" },
    { flag: "🇸🇳", code: "+221", country: "Sénégal" },
    { flag: "🇨🇮", code: "+225", country: "Côte d'Ivoire" },
    { flag: "🇲🇦", code: "+212", country: "Maroc" },
  ];

  return (
    <>
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
              onPress={() => {
                setAuthMode("signin");
                setErrorMessage('');
              }}
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
              onPress={() => {
                setAuthMode("signup");
                setErrorMessage('');
              }}
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

              {errorMessage ? (
                <View style={authModalStyles.errorContainer}>
                  <Text style={authModalStyles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

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
                style={[styles.primaryButton, authModalStyles.signinButton, isLoading && { opacity: 0.7 }]}
                onPress={handleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <FontAwesome5
                    name="spinner"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <FontAwesome5
                    name="sign-in-alt"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={styles.buttonText}>
                  {isLoading ? 'Connexion...' : 'Se connecter'}
                </Text>
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
                      <TouchableOpacity
                        style={[styles.countryCodeContainer, authModalStyles.countryCodeDropdown]}
                        onPress={() => setShowCountryCodeDropdown(!showCountryCodeDropdown)}
                      >
                        <Text style={styles.countryCode}>
                          {selectedCountryFlag} {selectedCountryCode}
                        </Text>
                        <FontAwesome5
                          name={showCountryCodeDropdown ? "chevron-up" : "chevron-down"}
                          size={12}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {showCountryCodeDropdown && (
                        <ScrollView style={authModalStyles.countryDropdown}>
                          {countryCodes.map((country, index) => (
                            <TouchableOpacity
                              key={index}
                              style={[
                                authModalStyles.countryDropdownItem,
                                index === countryCodes.length - 1 && { borderBottomWidth: 0 }
                              ]}
                              onPress={() => {
                                setSelectedCountryCode(country.code);
                                setSelectedCountryFlag(country.flag);
                                setShowCountryCodeDropdown(false);
                              }}
                            >
                              <Text style={authModalStyles.countryDropdownText}>
                                {country.flag} {country.code} {country.country}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
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
                        {!formData.cniRecto ? (
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
                              Aucun fichier choisi
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={authModalStyles.filePreviewContainer}>
                            <Text style={authModalStyles.fileName}>
                              {formData.cniRecto.name}
                            </Text>
                            <View style={authModalStyles.fileActions}>
                              <TouchableOpacity
                                style={authModalStyles.deleteButton}
                                onPress={() => handleFileDelete("cniRecto")}
                              >
                                <FontAwesome5 name="trash" size={14} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
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
                        {!formData.cniVerso ? (
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
                              Aucun fichier choisi
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={authModalStyles.filePreviewContainer}>
                            <Text style={authModalStyles.fileName}>
                              {formData.cniVerso.name}
                            </Text>
                            <View style={authModalStyles.fileActions}>
                              <TouchableOpacity
                                style={authModalStyles.deleteButton}
                                onPress={() => handleFileDelete("cniVerso")}
                              >
                                <FontAwesome5 name="trash" size={14} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>

                      <View style={styles.inputContainer}>
                        <Text
                          style={[
                            styles.inputLabel,
                            authModalStyles.requiredField,
                          ]}
                        >
                          Selfie *
                        </Text>
                        {!formData.profilePhoto ? (
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
                              Aucun fichier choisi
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={authModalStyles.filePreviewContainer}>
                            <Text style={authModalStyles.fileName}>
                              {formData.profilePhoto.name}
                            </Text>
                            <View style={authModalStyles.fileActions}>
                              <TouchableOpacity
                                style={authModalStyles.deleteButton}
                                onPress={() => handleFileDelete("profilePhoto")}
                              >
                                <FontAwesome5 name="trash" size={14} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
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
                  style={[styles.primaryButton, { flexDirection: "row", alignItems: "center", justifyContent: "center" }]}
                  onPress={handleSignupSubmit}
                >
                  <Text style={styles.buttonText}>Étape suivante</Text>
                  <FontAwesome5
                    name="arrow-right"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginLeft: 8 }}
                  />
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
                    style={[styles.primaryButton, authModalStyles.createButton, isLoading && { opacity: 0.7 }]}
                    onPress={handleSignupSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <FontAwesome5 name="spinner" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : (
                      <FontAwesome5 name="user-plus" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.buttonText}>{isLoading ? 'Création...' : 'Créer'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
      </Modal>
      
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
      >
        <View style={authModalStyles.successOverlay}>
          <View style={authModalStyles.successContainer}>
            <FontAwesome5 name="check-circle" size={48} color="#10B981" />
            <Text style={authModalStyles.successTitle}>Compte créé avec succès!</Text>
            <Text style={authModalStyles.successMessage}>En attente de validation</Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const authModalStyles = StyleSheet.create({
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
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
  countryCodeDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 12,
    gap: 8,
  },
  countryDropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 20,
    maxHeight: 200,
  },
  countryDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  countryDropdownText: {
    fontSize: 14,
    color: "#111827",
  },
  filePreviewContainer: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fileName: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  fileActions: {
    flexDirection: "row",
    gap: 8,
  },
  deleteButton: {
    padding: 4,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    margin: 20,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default AuthModal;
