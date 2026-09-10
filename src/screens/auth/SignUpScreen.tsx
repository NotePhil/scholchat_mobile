import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,

  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { authService } from '../../services/home/authService';
import { userService } from '../../services/api';

const logo = require('../../../assets/logo.png');

type DocumentAsset = DocumentPicker.DocumentPickerAsset;

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  teacherMatricule: string;
  educationLevel: string;
  cniRecto: DocumentAsset | null;
  cniVerso: DocumentAsset | null;
  profilePhoto: DocumentAsset | null;
}

const EMPTY_FORM: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  teacherMatricule: '',
  educationLevel: '',
  cniRecto: null,
  cniVerso: null,
  profilePhoto: null,
};

const ACCOUNT_TYPES = [
  { key: 'eleve', label: 'Élève', icon: 'user-graduate', desc: 'Accès aux cours et devoirs' },
  { key: 'parent', label: 'Parent', icon: 'user-friends', desc: 'Suivi de vos enfants' },
  { key: 'professeur', label: 'Professeur', icon: 'chalkboard-teacher', desc: 'Gestion des classes et notes' },
];

const EDUCATION_LEVELS = ['Primaire', 'Collège', 'Lycée', 'Université', 'Autre'];

const COUNTRY_CODES = [
  { flag: '🇨🇲', code: '+237', name: 'Cameroun' },
  { flag: '🇫🇷', code: '+33', name: 'France' },
  { flag: '🇸🇳', code: '+221', name: 'Sénégal' },
  { flag: '🇨🇮', code: '+225', name: "Côte d'Ivoire" },
  { flag: '🇲🇦', code: '+212', name: 'Maroc' },
];

/**
 * Enterprise-grade, clean & professional Registration screen matching the Scholchat Web experience.
 * Multi-step flow: 1. Personal info -> 2. Role selection -> 3. Documents (Professeur only)
 */
const SignUpScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<string>('eleve');
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const [selectedCountryCode, setSelectedCountryCode] = useState('+237');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const totalSteps = selectedRole === 'professeur' ? 3 : 2;
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const handleFileUpload = async (fieldName: 'cniRecto' | 'cniVerso' | 'profilePhoto') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFormData((prev) => ({ ...prev, [fieldName]: result.assets[0] }));
      }
    } catch (err) {
      console.log('File selection error:', err);
    }
  };

  const uploadFileToServer = async (file: DocumentAsset, professorId: string, documentType: string): Promise<string> => {
    const presigned = await authService.getPresignedUrl(
      file.name,
      file.mimeType ?? 'application/octet-stream',
      professorId,
      documentType
    );
    await authService.uploadFile(presigned.url, {
      uri: file.uri,
      mimeType: file.mimeType ?? 'application/octet-stream',
      name: file.name,
    });
    return presigned.url.split('?')[0];
  };

  const handleCompleteRegistration = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      if (selectedRole === 'professeur') {
        const professor = await authService.createProfessor({
          lastName: formData.lastName.trim(),
          firstName: formData.firstName.trim(),
          email: formData.email.trim(),
          phone: `${selectedCountryCode}${formData.phone.trim()}`,
          address: formData.address.trim(),
          teacherMatricule: formData.teacherMatricule.trim(),
        });
        const professorId = professor.id as string;

        const urls: { cniRecto?: string; cniVerso?: string; selfie?: string } = {};
        if (formData.cniRecto) {
          urls.cniRecto = await uploadFileToServer(formData.cniRecto, professorId, 'cni-recto');
        }
        if (formData.cniVerso) {
          urls.cniVerso = await uploadFileToServer(formData.cniVerso, professorId, 'cni-verso');
        }
        if (formData.profilePhoto) {
          urls.selfie = await uploadFileToServer(formData.profilePhoto, professorId, 'selfie');
        }

        await authService.updateProfessorUrls(professorId, {
          cniRecto: urls.cniRecto ?? '',
          cniVerso: urls.cniVerso ?? '',
          selfie: urls.selfie ?? '',
        });
      } else {
        const payload: Record<string, unknown> = {
          type: selectedRole,
          nom: formData.lastName.trim(),
          prenom: formData.firstName.trim(),
          email: formData.email.trim(),
          telephone: `${selectedCountryCode}${formData.phone.trim()}`,
          adresse: formData.address.trim(),
          etat: 'INACTIVE',
        };
        if (selectedRole === 'eleve' && formData.educationLevel) {
          payload.niveau = formData.educationLevel;
        }
        await userService.createUser(payload);
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigation.navigate('VerifyEmail', {
          email: formData.email.trim(),
          userType: selectedRole === 'professeur' ? 'Professeur' : 'Utilisateur',
        });
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue lors de la création du compte.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim()) {
        setErrorMessage('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setErrorMessage("Format d'adresse email invalide.");
        return;
      }
      setErrorMessage('');
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (selectedRole === 'professeur') {
        setCurrentStep(3);
      } else {
        handleCompleteRegistration();
      }
      return;
    }

    if (currentStep === 3) {
      handleCompleteRegistration();
    }
  };

  if (showSuccess) {
    return (
      <View style={[styles.safeArea, { paddingTop: topPadding }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.successContainer}>
          <View style={styles.successIconBadge}>
            <FontAwesome5 name="check" size={32} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Compte créé avec succès !</Text>
          <Text style={styles.successSubtitle}>
            Votre demande a bien été enregistrée. Elle est actuellement en attente de validation par l'administration.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => (currentStep > 1 ? setCurrentStep((s) => s - 1) : navigation.goBack())}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome5 name="arrow-left" size={16} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Création de compte</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step Progress Header */}
          <View style={styles.stepperContainer}>
            <View style={styles.stepperRow}>
              {[1, 2, selectedRole === 'professeur' ? 3 : null].filter(Boolean).map((stepNum, idx) => {
                const s = stepNum as number;
                const isCompleted = currentStep > s;
                const isActive = currentStep === s;
                return (
                  <React.Fragment key={s}>
                    <View style={styles.stepItem}>
                      <View
                        style={[
                          styles.stepBadge,
                          isActive && styles.stepBadgeActive,
                          isCompleted && styles.stepBadgeCompleted,
                        ]}
                      >
                        {isCompleted ? (
                          <FontAwesome5 name="check" size={12} color="#FFFFFF" />
                        ) : (
                          <Text
                            style={[
                              styles.stepBadgeText,
                              (isActive || isCompleted) && styles.stepBadgeTextActive,
                            ]}
                          >
                            {s}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
                        {s === 1 ? 'Informations' : s === 2 ? 'Rôle' : 'Documents'}
                      </Text>
                    </View>
                    {idx < totalSteps - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          currentStep > s && styles.stepLineActive,
                        ]}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.alertBox}>
              <FontAwesome5 name="exclamation-circle" size={14} color="#DC2626" />
              <Text style={styles.alertText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Step 1: Informations Personnelles */}
          {currentStep === 1 && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Informations personnelles</Text>
              <Text style={styles.cardSectionSub}>
                Renseignez vos coordonnées de base pour débuter l'inscription.
              </Text>

              {/* Prénom */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Prénom <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'firstName' && styles.inputContainerFocused,
                  ]}
                >
                  <FontAwesome5
                    name="user"
                    size={14}
                    color={focusedField === 'firstName' ? '#2563EB' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Paul"
                    placeholderTextColor="#94A3B8"
                    value={formData.firstName}
                    onChangeText={(val) => handleInputChange('firstName', val)}
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Nom */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Nom <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'lastName' && styles.inputContainerFocused,
                  ]}
                >
                  <FontAwesome5
                    name="user"
                    size={14}
                    color={focusedField === 'lastName' ? '#2563EB' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Biya"
                    placeholderTextColor="#94A3B8"
                    value={formData.lastName}
                    onChangeText={(val) => handleInputChange('lastName', val)}
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Adresse email <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'email' && styles.inputContainerFocused,
                  ]}
                >
                  <FontAwesome5
                    name="envelope"
                    size={14}
                    color={focusedField === 'email' ? '#2563EB' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="paul.biya@exemple.com"
                    placeholderTextColor="#94A3B8"
                    value={formData.email}
                    onChangeText={(val) => handleInputChange('email', val)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Téléphone */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Numéro de téléphone <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.phoneRow}>
                  <TouchableOpacity
                    style={styles.countryBtn}
                    onPress={() => setShowCountryDropdown((prev) => !prev)}
                  >
                    <Text style={styles.countryText}>{selectedCountryCode}</Text>
                    <FontAwesome5 name="chevron-down" size={10} color="#64748B" />
                  </TouchableOpacity>
                  <View
                    style={[
                      styles.inputContainer,
                      { flex: 1 },
                      focusedField === 'phone' && styles.inputContainerFocused,
                    ]}
                  >
                    <FontAwesome5
                      name="phone"
                      size={14}
                      color={focusedField === 'phone' ? '#2563EB' : '#94A3B8'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="6 00 00 00 00"
                      placeholderTextColor="#94A3B8"
                      value={formData.phone}
                      onChangeText={(val) => handleInputChange('phone', val)}
                      keyboardType="phone-pad"
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>
                {showCountryDropdown && (
                  <View style={styles.dropdown}>
                    {COUNTRY_CODES.map((c) => (
                      <TouchableOpacity
                        key={c.code}
                        style={styles.dropdownOption}
                        onPress={() => {
                          setSelectedCountryCode(c.code);
                          setShowCountryDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownOptionText}>
                          {c.flag} {c.code} ({c.name})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Adresse */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Adresse physique</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'address' && styles.inputContainerFocused,
                  ]}
                >
                  <FontAwesome5
                    name="map-marker-alt"
                    size={14}
                    color={focusedField === 'address' ? '#2563EB' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Ville, quartier..."
                    placeholderTextColor="#94A3B8"
                    value={formData.address}
                    onChangeText={(val) => handleInputChange('address', val)}
                    onFocus={() => setFocusedField('address')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Step 2: Choix du profil */}
          {currentStep === 2 && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Type de profil</Text>
              <Text style={styles.cardSectionSub}>
                Choisissez le statut sous lequel vous souhaitez rejoindre SchoolChat.
              </Text>

              <View style={styles.rolesGrid}>
                {ACCOUNT_TYPES.map((role) => {
                  const isSelected = selectedRole === role.key;
                  return (
                    <TouchableOpacity
                      key={role.key}
                      style={[styles.roleCard, isSelected && styles.roleCardSelected]}
                      onPress={() => setSelectedRole(role.key)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.roleIconCircle,
                          isSelected && styles.roleIconCircleSelected,
                        ]}
                      >
                        <FontAwesome5
                          name={role.icon}
                          size={18}
                          color={isSelected ? '#2563EB' : '#64748B'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleCardTitle, isSelected && styles.roleCardTitleSelected]}>
                          {role.label}
                        </Text>
                        <Text style={styles.roleCardDesc}>{role.desc}</Text>
                      </View>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Éducation level if élève */}
              {selectedRole === 'eleve' && (
                <View style={[styles.formGroup, { marginTop: 12 }]}>
                  <Text style={styles.label}>Niveau d'études</Text>
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={() => setShowLevelDropdown((prev) => !prev)}
                  >
                    <Text style={formData.educationLevel ? styles.selectBtnValue : styles.selectBtnPlaceholder}>
                      {formData.educationLevel || 'Sélectionner un niveau...'}
                    </Text>
                    <FontAwesome5 name="chevron-down" size={12} color="#64748B" />
                  </TouchableOpacity>

                  {showLevelDropdown && (
                    <View style={styles.dropdown}>
                      {EDUCATION_LEVELS.map((lvl) => (
                        <TouchableOpacity
                          key={lvl}
                          style={styles.dropdownOption}
                          onPress={() => {
                            handleInputChange('educationLevel', lvl);
                            setShowLevelDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownOptionText}>{lvl}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Step 3: Documents justificatifs (Professeur uniquement) */}
          {currentStep === 3 && selectedRole === 'professeur' && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Pièces justificatives</Text>
              <Text style={styles.cardSectionSub}>
                Afin de garantir la conformité pédagogique, veuillez transmettre vos documents.
              </Text>

              {/* Matricule */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Matricule enseignant (optionnel)</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'teacherMatricule' && styles.inputContainerFocused,
                  ]}
                >
                  <FontAwesome5
                    name="id-card"
                    size={14}
                    color={focusedField === 'teacherMatricule' ? '#2563EB' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: PROF-2026-X"
                    placeholderTextColor="#94A3B8"
                    value={formData.teacherMatricule}
                    onChangeText={(val) => handleInputChange('teacherMatricule', val)}
                    onFocus={() => setFocusedField('teacherMatricule')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Upload items */}
              {[
                { key: 'cniRecto' as const, label: 'CNI ou Passeport (Recto) *' },
                { key: 'cniVerso' as const, label: 'CNI ou Passeport (Verso) *' },
                { key: 'profilePhoto' as const, label: 'Photo de profil (Selfie) *' },
              ].map((doc) => {
                const file = formData[doc.key];
                return (
                  <View key={doc.key} style={styles.formGroup}>
                    <Text style={styles.label}>{doc.label}</Text>
                    {file ? (
                      <View style={styles.fileCard}>
                        <FontAwesome5 name="file-alt" size={16} color="#2563EB" />
                        <Text style={styles.fileName} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setFormData((p) => ({ ...p, [doc.key]: null }))}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <FontAwesome5 name="times-circle" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadBox}
                        onPress={() => handleFileUpload(doc.key)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="cloud-upload-alt" size={20} color="#2563EB" />
                        <Text style={styles.uploadBoxText}>Parcourir un document (PDF, PNG, JPG)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleNextStep}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Traitement en cours...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.primaryButtonText}>
                    {currentStep === totalSteps ? 'Finaliser mon inscription' : 'Continuer'}
                  </Text>
                  <FontAwesome5
                    name={currentStep === totalSteps ? 'check' : 'arrow-right'}
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.footerLinkRow}>
              <Text style={styles.footerText}>Vous possédez déjà un compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLinkBold}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 6,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  stepperContainer: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stepBadgeActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  stepBadgeCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  stepBadgeTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  stepLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  stepLineActive: {
    backgroundColor: '#2563EB',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 18,
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSectionSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputContainerFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  countryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#1E293B',
  },
  rolesGrid: {
    gap: 10,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  roleCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  roleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconCircleSelected: {
    backgroundColor: '#DBEAFE',
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  roleCardTitleSelected: {
    color: '#1D4ED8',
  },
  roleCardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#2563EB',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  selectBtnPlaceholder: {
    fontSize: 14,
    color: '#94A3B8',
  },
  selectBtnValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
  },
  uploadBoxText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 4,
    marginBottom: 24,
  },
  primaryButton: {
    height: 50,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  footerLinkBold: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SignUpScreen;
