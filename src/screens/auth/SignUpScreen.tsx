import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../styles/theme';
import { authService } from '../../services/home/authService';
import { userService } from '../../services/api';

const logo = require('../../../assets/logo.png');

const USER_TYPE_TO_BACKEND_TYPE: Record<string, string> = {
  Professeur: 'professeur',
  Élève: 'eleve',
  Parent: 'parent',
};

type DocumentAsset = DocumentPicker.DocumentPickerAsset;
type UploadFieldStatus = 'idle' | 'loading' | 'success' | 'error';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  confirmPassword: string;
  cniRecto: DocumentAsset | null;
  cniVerso: DocumentAsset | null;
  profilePhoto: DocumentAsset | null;
  teacherMatricule: string;
  educationLevel: string;
}

const EMPTY_FORM: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  password: '',
  confirmPassword: '',
  cniRecto: null,
  cniVerso: null,
  profilePhoto: null,
  teacherMatricule: '',
  educationLevel: '',
};

const userTypes = ['Professeur', 'Élève', 'Parent'];
const educationLevels = ['Primaire', 'Collège', 'Lycée', 'Université'];
const countryCodes = [
  { flag: '🇨🇲', code: '+237', country: 'Cameroun' },
  { flag: '🇫🇷', code: '+33', country: 'France' },
  { flag: '🇸🇳', code: '+221', country: 'Sénégal' },
  { flag: '🇨🇮', code: '+225', country: "Côte d'Ivoire" },
  { flag: '🇲🇦', code: '+212', country: 'Maroc' },
];

/** Full-page signup (replaces AuthModal's signup tab) — 2-step: personal info, then role + details. */
const SignUpScreen = () => {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState('');
  const [showUserTypeDropdown, setShowUserTypeDropdown] = useState(false);
  const [showEducationLevelDropdown, setShowEducationLevelDropdown] = useState(false);
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState('+237');
  const [selectedCountryFlag, setSelectedCountryFlag] = useState('🇨🇲');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<'cniRecto' | 'cniVerso' | 'profilePhoto', UploadFieldStatus>>({
    cniRecto: 'idle',
    cniVerso: 'idle',
    profilePhoto: 'idle',
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const handleInputChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (fieldName: 'cniRecto' | 'cniVerso' | 'profilePhoto') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length) {
        setFormData((prev) => ({ ...prev, [fieldName]: result.assets[0] }));
      }
    } catch (err) {
      console.log('File selection error:', err);
    }
  };

  const handleFileDelete = (fieldName: 'cniRecto' | 'cniVerso' | 'profilePhoto') => {
    setFormData((prev) => ({ ...prev, [fieldName]: null }));
  };

  const uploadFileToServer = async (
    file: DocumentAsset,
    professorId: string,
    documentType: string
  ): Promise<string> => {
    const presigned = await authService.getPresignedUrl(file.name, file.mimeType ?? 'application/octet-stream', professorId, documentType);
    await authService.uploadFile(presigned.url, { uri: file.uri, mimeType: file.mimeType ?? 'application/octet-stream', name: file.name });
    return presigned.url.split('?')[0];
  };

  const handleProfessorSignup = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error("Format d'email invalide. Veuillez vérifier votre adresse email.");
      }

      const professor = await authService.createProfessor({
        lastName: formData.lastName,
        firstName: formData.firstName,
        email: formData.email,
        phone: `${selectedCountryCode}${formData.phone}`,
        address: formData.address,
        teacherMatricule: formData.teacherMatricule,
      });
      const professorId = professor.id as string;

      const urls: { cniRecto?: string; cniVerso?: string; selfie?: string } = {};
      const uploads: Promise<void>[] = [];

      if (formData.cniRecto) {
        setUploadStatus((p) => ({ ...p, cniRecto: 'loading' }));
        uploads.push(
          uploadFileToServer(formData.cniRecto, professorId, 'CNI_RECTO')
            .then((url) => {
              urls.cniRecto = url;
              setUploadStatus((p) => ({ ...p, cniRecto: 'success' }));
            })
            .catch(() => {
              setUploadStatus((p) => ({ ...p, cniRecto: 'error' }));
              throw new Error('CNI Recto upload failed');
            })
        );
      }
      if (formData.cniVerso) {
        setUploadStatus((p) => ({ ...p, cniVerso: 'loading' }));
        uploads.push(
          uploadFileToServer(formData.cniVerso, professorId, 'CNI_VERSO')
            .then((url) => {
              urls.cniVerso = url;
              setUploadStatus((p) => ({ ...p, cniVerso: 'success' }));
            })
            .catch(() => {
              setUploadStatus((p) => ({ ...p, cniVerso: 'error' }));
              throw new Error('CNI Verso upload failed');
            })
        );
      }
      if (formData.profilePhoto) {
        setUploadStatus((p) => ({ ...p, profilePhoto: 'loading' }));
        uploads.push(
          uploadFileToServer(formData.profilePhoto, professorId, 'SELFIE')
            .then((url) => {
              urls.selfie = url;
              setUploadStatus((p) => ({ ...p, profilePhoto: 'success' }));
            })
            .catch(() => {
              setUploadStatus((p) => ({ ...p, profilePhoto: 'error' }));
              throw new Error('Selfie upload failed');
            })
        );
      }

      await Promise.all(uploads);
      await authService.updateProfessorUrls(professorId, {
        cniRecto: urls.cniRecto ?? '',
        cniVerso: urls.cniVerso ?? '',
        selfie: urls.selfie ?? '',
      });

      finishSignup();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      Alert.alert('Erreur', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBasicSignup = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const backendType = USER_TYPE_TO_BACKEND_TYPE[userType] || 'eleve';
      const payload: Record<string, unknown> = {
        type: backendType,
        nom: formData.lastName.trim(),
        prenom: formData.firstName.trim(),
        email: formData.email.trim(),
        telephone: `${selectedCountryCode}${formData.phone}`,
        adresse: formData.address.trim(),
        etat: 'INACTIVE',
      };
      if (backendType === 'eleve') payload.niveau = formData.educationLevel;

      await userService.createUser(payload);
      finishSignup();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      Alert.alert('Erreur', message);
    } finally {
      setIsLoading(false);
    }
  };

  const finishSignup = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setStep(1);
      setUserType('');
      setFormData(EMPTY_FORM);
      navigation.navigate('Login');
    }, 2000);
  };

  const handleSubmit = async () => {
    if (step === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
        return;
      }
      setStep(2);
      return;
    }
    if (!userType) {
      Alert.alert('Erreur', "Veuillez sélectionner un type d'utilisateur.");
      return;
    }
    if (userType === 'Professeur') await handleProfessorSignup();
    else await handleBasicSignup();
  };

  if (showSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrap}>
          <FontAwesome5 name="check-circle" size={56} color={colors.success} />
          <Text style={styles.successTitle}>Compte créé avec succès !</Text>
          <Text style={styles.successMessage}>En attente de validation</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (step === 2 ? setStep(1) : navigation.goBack())} style={styles.backButton}>
            <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer un compte</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={logo} style={styles.logo} resizeMode="contain" />

          <View style={styles.progressRow}>
            <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]}>
              <Text style={[styles.progressDotText, step >= 1 && styles.progressDotTextActive]}>1</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]}>
              <Text style={[styles.progressDotText, step >= 2 && styles.progressDotTextActive]}>2</Text>
            </View>
          </View>
          <Text style={styles.progressLabel}>{step === 1 ? 'Informations personnelles' : 'Détails du compte'}</Text>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {step === 1 ? (
            <>
              <Input label="Prénom" value={formData.firstName} onChangeText={(t) => handleInputChange('firstName', t)} placeholder="Prénom" />
              <Input label="Nom" value={formData.lastName} onChangeText={(t) => handleInputChange('lastName', t)} placeholder="Nom" />
              <Input
                label="Email"
                value={formData.email}
                onChangeText={(t) => handleInputChange('email', t)}
                placeholder="vous@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity style={styles.countryCode} onPress={() => setShowCountryCodeDropdown((v) => !v)}>
                  <Text>{selectedCountryFlag} {selectedCountryCode}</Text>
                  <FontAwesome5 name={showCountryCodeDropdown ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
                </TouchableOpacity>
                <Input
                  value={formData.phone}
                  onChangeText={(t) => handleInputChange('phone', t)}
                  placeholder="Numéro"
                  keyboardType="phone-pad"
                  style={styles.phoneInput}
                />
              </View>
              {showCountryCodeDropdown && (
                <View style={styles.dropdown}>
                  {countryCodes.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCountryCode(c.code);
                        setSelectedCountryFlag(c.flag);
                        setShowCountryCodeDropdown(false);
                      }}
                    >
                      <Text>{c.flag} {c.code} {c.country}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Input label="Adresse" value={formData.address} onChangeText={(t) => handleInputChange('address', t)} placeholder="Adresse" />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Type d'utilisateur</Text>
              <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowUserTypeDropdown((v) => !v)}>
                <Text>{userType || 'Sélectionnez un type'}</Text>
                <FontAwesome5 name={showUserTypeDropdown ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
              </TouchableOpacity>
              {showUserTypeDropdown && (
                <View style={styles.dropdown}>
                  {userTypes.map((type) => (
                    <TouchableOpacity key={type} style={styles.dropdownItem} onPress={() => { setUserType(type); setShowUserTypeDropdown(false); }}>
                      <Text>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {userType === 'Professeur' && (
                <>
                  {(['cniRecto', 'cniVerso', 'profilePhoto'] as const).map((field) => (
                    <View key={field} style={{ marginBottom: spacing.md }}>
                      <Text style={styles.fieldLabel}>
                        {field === 'cniRecto' ? 'CNI Recto *' : field === 'cniVerso' ? 'CNI Verso *' : 'Selfie *'}
                      </Text>
                      {!formData[field] ? (
                        <TouchableOpacity style={styles.uploadButton} onPress={() => handleFileUpload(field)}>
                          <FontAwesome5 name="upload" size={16} color={colors.textMuted} />
                          <Text style={styles.uploadButtonText}>Aucun fichier choisi</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.filePreview}>
                          <Text style={styles.fileName} numberOfLines={1}>{formData[field]?.name}</Text>
                          <TouchableOpacity onPress={() => handleFileDelete(field)}>
                            <FontAwesome5 name="trash" size={14} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                  <Input
                    label="Matricule du professeur (optionnel)"
                    value={formData.teacherMatricule}
                    onChangeText={(t) => handleInputChange('teacherMatricule', t)}
                    placeholder="Matricule"
                  />
                </>
              )}

              {userType === 'Élève' && (
                <>
                  <Text style={styles.fieldLabel}>Niveau d'éducation *</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowEducationLevelDropdown((v) => !v)}>
                    <Text>{formData.educationLevel || 'Sélectionnez un niveau'}</Text>
                    <FontAwesome5 name={showEducationLevelDropdown ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                  {showEducationLevelDropdown && (
                    <View style={styles.dropdown}>
                      {educationLevels.map((level) => (
                        <TouchableOpacity key={level} style={styles.dropdownItem} onPress={() => { handleInputChange('educationLevel', level); setShowEducationLevelDropdown(false); }}>
                          <Text>{level}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          <Button
            label={step === 1 ? 'Étape suivante' : isLoading ? 'Création...' : 'Créer mon compte'}
            onPress={handleSubmit}
            loading={isLoading}
            fullWidth
            style={styles.submitButton}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.h3, color: colors.text },
  content: { padding: spacing.xl, paddingTop: 0 },
  logo: { width: 64, height: 64, alignSelf: 'center', marginBottom: spacing.lg },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { backgroundColor: colors.primary },
  progressDotText: { color: colors.textMuted, fontWeight: '700' },
  progressDotTextActive: { color: colors.white },
  progressLine: { width: 40, height: 2, backgroundColor: colors.grayLight, marginHorizontal: spacing.sm },
  progressLabel: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: spacing.md },
  fieldLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  phoneRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  phoneInput: { flex: 1, marginBottom: 0 },
  dropdown: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  dropdownItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  uploadButtonText: { color: colors.textMuted },
  filePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  fileName: { flex: 1, color: colors.text, marginRight: spacing.sm },
  submitButton: { marginTop: spacing.md, marginBottom: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...typography.body, color: colors.textMuted },
  footerLink: { ...typography.body, color: colors.primary, fontWeight: '700' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successTitle: { ...typography.h2, color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  successMessage: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});

export default SignUpScreen;
