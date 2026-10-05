import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { BrandColors, ff, roleAccents, useBrandColors } from '../../components/brand';
import { SignupPayload, SignupRole, authService } from '../../services/home/authService';
import { NIVEAUX } from '../../constants/niveaux';
import {
  AuthScreen,
  AuthTitle,
  Banner,
  GradientButton,
  PromptLink,
  SelectField,
  SelectOption,
  StepIndicator,
  TextField,
  TextLink,
} from './components/AuthKit';
import { EMAIL_REGEX } from './components/passwordRules';
import { TFunction, translate, useT } from '../../i18n';
import type { AccountCreatedParams } from './AccountCreatedScreen';

type DocumentAsset = DocumentPicker.DocumentPickerAsset;
type DocKey = 'cniRecto' | 'cniVerso' | 'selfie';

type StepId = 'infos' | 'niveau' | 'documents';

/** Same steps as web SignUp.jsx (the role itself is picked beforehand on RoleChoiceScreen). */
const STEPS: Record<SignupRole, StepId[]> = {
  professeur: ['infos', 'documents'],
  eleve: ['infos', 'niveau'],
  parent: ['infos'],
};

const roleLabel = (t: TFunction, role: SignupRole) => t(`auth.roleChoice.roles.${role}.title`);

type CountryCode = '237' | '33' | '221' | '225' | '212';

/**
 * National number rules per country (what libphonenumber's isValidPhoneNumber checks on the web,
 * for the countries offered here). `trunk`: a leading 0 typed out of habit is dropped.
 */
const PHONE_RULES: Record<CountryCode, { pattern: RegExp; trunk: boolean; placeholder: string }> = {
  '237': { pattern: /^[26]\d{8}$/, trunk: false, placeholder: '6 XX XX XX XX' },
  '33': { pattern: /^[1-9]\d{8}$/, trunk: true, placeholder: '6 XX XX XX XX' },
  '221': { pattern: /^[37]\d{8}$/, trunk: false, placeholder: '7X XXX XX XX' },
  '225': { pattern: /^0\d{9}$/, trunk: false, placeholder: '07 XX XX XX XX' },
  '212': { pattern: /^[5-7]\d{8}$/, trunk: true, placeholder: '6 XX XX XX XX' },
};

const COUNTRY_KEYS = Object.keys(PHONE_RULES) as CountryCode[];

const countryCodes = (t: TFunction): SelectOption[] =>
  COUNTRY_KEYS.map((code) => ({
    value: code,
    short: `+${code}`,
    label: `+${code}  ${t(`auth.signup.countries.${code}`)}`,
  }));

/** National digits as they will be sent (trunk 0 removed), or null when not a valid number. */
const normalizePhone = (country: CountryCode, raw: string): string | null => {
  const rule = PHONE_RULES[country];
  let digits = raw.replace(/\D/g, '');
  if (rule.trunk && digits.startsWith('0')) digits = digits.slice(1);
  return rule.pattern.test(digits) ? digits : null;
};

const DOCS: { key: DocKey; icon: string }[] = [
  { key: 'cniRecto', icon: 'id-card' },
  { key: 'cniVerso', icon: 'id-card' },
  { key: 'selfie', icon: 'user-circle' },
];

/**
 * Sign-up (Professeur / Élève / Parent) — exactly the fields of web SignUp.jsx:
 * nom, prénom, téléphone, email, adresse for everyone; an optional niveau for the élève; CNI
 * recto/verso + selfie (+ optional matricule) for the professeur. No password: the account is
 * created via POST /utilisateurs without motDePasse and the user chooses the password from the
 * e-mailed link (after activation for élève / parent, after admin validation for a professor).
 */
const SignUpScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useT();
  const COUNTRY_CODES = useMemo(() => countryCodes(t), [t]);
  const role: SignupRole = (['professeur', 'eleve', 'parent'] as const).includes(route.params?.role)
    ? route.params.role
    : 'eleve';
  const steps = STEPS[role];
  const stepLabels = steps.map((id) => t(`auth.signup.steps.${id}`));

  const [step, setStep] = useState(0);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('237');
  const [phone, setPhone] = useState('');
  const [adresse, setAdresse] = useState('');
  // Élève
  const [niveau, setNiveau] = useState('');
  const [niveauQuery, setNiveauQuery] = useState('');
  // Professeur
  const [matricule, setMatricule] = useState('');
  const [docs, setDocs] = useState<Record<DocKey, DocumentAsset | null>>({ cniRecto: null, cniVerso: null, selfie: null });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Professor profile already posted (an upload failed afterwards): retry only the uploads.
  const [createdProfessor, setCreatedProfessor] = useState<{ id: string; statut?: string } | null>(null);

  const isLast = step === steps.length - 1;
  const accent = roleAccents[role];
  const current = steps[step];

  const clear = (key: string) => {
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    if (error) setError('');
  };

  // ── Validation (web validateStep1 / validateStep3) ──────────────────────
  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};
    if (current === 'infos') {
      if (!nom.trim()) errs.nom = t('auth.signup.errors.lastName');
      if (!prenom.trim()) errs.prenom = t('auth.signup.errors.firstName');
      if (!phone.trim()) errs.phone = t('auth.signup.errors.phoneRequired');
      else if (!normalizePhone(countryCode, phone)) errs.phone = t('auth.signup.errors.phone');
      if (!email.trim()) errs.email = t('auth.signup.errors.emailRequired');
      else if (!EMAIL_REGEX.test(email.trim())) errs.email = t('auth.common.invalidEmail');
      if (!adresse.trim()) errs.adresse = t('auth.signup.errors.address');
    } else if (current === 'documents') {
      if (!docs.cniRecto || !docs.cniVerso || !docs.selfie) {
        setError(t('auth.signup.errors.documents'));
        return false;
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Professor documents ───────────────────────────────────────────────────
  const pickDoc = async (key: DocKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Web SignUp.jsx accepts images only (file.type.startsWith("image/")) for the 3 documents.
        type: ['image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length) {
        setDocs((prev) => ({ ...prev, [key]: result.assets[0] }));
        if (error) setError('');
      }
    } catch {
      setError(t('auth.signup.errors.filePicker'));
    }
  };

  const upload = async (file: DocumentAsset, ownerId: string, documentType: string) => {
    const mimeType = file.mimeType ?? 'application/octet-stream';
    const presigned = await authService.getPresignedUrl(file.name, mimeType, ownerId, documentType);
    await authService.uploadFile(presigned.url, { uri: file.uri, mimeType, name: file.name });
    return presigned.url.split('?')[0];
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const finish = (params: AccountCreatedParams) => navigation.navigate('AccountCreated', params);

  /** End screen from the sign-up response's inscriptionStatut (same cases as web SignUp.jsx). */
  const afterCreate = (statut?: string) => {
    if (statut === 'ROLE_ADDED') {
      // Existing active account: role usable now, with the account's existing password.
      finish({ variant: 'roleAdded' });
      return;
    }
    if (statut === 'ROLE_PENDING_VALIDATION') {
      finish({ variant: 'rolePending' });
      return;
    }
    if (statut === 'ACTIVATION_REQUIRED') {
      // Existing account never activated: a new activation link was e-mailed.
      finish({ variant: 'activation', email: email.trim(), roleAdded: true });
      return;
    }
    if (role === 'professeur') {
      finish({ variant: 'pending' });
      return;
    }
    finish({ variant: 'activation', email: email.trim() });
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      let created = createdProfessor;
      if (!created) {
        const payload: SignupPayload = {
          type: role,
          nom: nom.trim(),
          prenom: prenom.trim(),
          email: email.trim(),
          telephone: `+${countryCode}${normalizePhone(countryCode, phone) ?? phone.replace(/\D/g, '')}`,
          adresse: adresse.trim(),
        };
        if (role === 'eleve') payload.niveau = niveau;
        const res = await authService.signUp(payload);
        if (role !== 'professeur' || res.inscriptionStatut === 'ROLE_ADDED' || res.inscriptionStatut === 'ACTIVATION_REQUIRED' || !res.id) {
          afterCreate(res.inscriptionStatut);
          return;
        }
        created = { id: String(res.id), statut: res.inscriptionStatut };
        setCreatedProfessor(created);
      }

      // Professor: documents → PATCH urls + matricule (web handleDocumentSubmission).
      const urls = {
        cniRecto: docs.cniRecto ? await upload(docs.cniRecto, created.id, 'cni-recto') : '',
        cniVerso: docs.cniVerso ? await upload(docs.cniVerso, created.id, 'cni-verso') : '',
        selfie: docs.selfie ? await upload(docs.selfie, created.id, 'selfie') : '',
      };
      await authService.updateProfessorUrls(created.id, urls, matricule);
      afterCreate(created.statut);
    } catch (err) {
      const msg = err instanceof Error ? err.message : translate('auth.signup.errors.createFailed');
      setError(createdProfessor ? `${msg} ${translate('auth.signup.errors.retryUploads')}` : msg);
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (loading || !validateStep()) return;
    if (isLast) submit();
    else setStep((v) => v + 1);
  };

  const back = () => {
    setError('');
    setFieldErrors({});
    if (step > 0) setStep((v) => v - 1);
    else navigation.goBack();
  };

  // ── Steps UI ──────────────────────────────────────────────────────────────
  const renderInfos = () => (
    <>
      <AuthTitle
        align="left"
        title={t('auth.signup.infos.title')}
        subtitle={role === 'professeur' ? t('auth.signup.infos.subtitleTeacher') : t('auth.signup.infos.subtitle')}
      />
      <TextField
        label={t('auth.signup.infos.lastName')}
        required
        icon="user"
        placeholder={t('auth.signup.infos.lastNamePlaceholder')}
        value={nom}
        onChangeText={(v) => {
          setNom(v);
          clear('nom');
        }}
        autoCapitalize="words"
        textContentType="familyName"
        autoComplete="name-family"
        error={fieldErrors.nom}
      />
      <TextField
        label={t('auth.signup.infos.firstName')}
        required
        icon="user"
        placeholder={t('auth.signup.infos.firstNamePlaceholder')}
        value={prenom}
        onChangeText={(v) => {
          setPrenom(v);
          clear('prenom');
        }}
        autoCapitalize="words"
        textContentType="givenName"
        autoComplete="name-given"
        error={fieldErrors.prenom}
      />
      <View style={s.phoneRow}>
        <SelectField
          label={t('auth.common.phone')}
          required
          value={countryCode}
          options={COUNTRY_CODES}
          onChange={(v) => {
            setCountryCode(v as CountryCode);
            clear('phone');
          }}
          containerStyle={s.countryField}
        />
        <TextField
          label=" "
          icon="phone"
          placeholder={PHONE_RULES[countryCode].placeholder}
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            clear('phone');
          }}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          error={fieldErrors.phone}
          containerStyle={s.phoneField}
        />
      </View>
      <TextField
        label={t('auth.common.email')}
        required
        icon="envelope"
        placeholder={t('auth.common.emailPlaceholder')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          clear('email');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <TextField
        label={t('auth.signup.infos.address')}
        required
        icon="map-marker-alt"
        placeholder={t('auth.signup.infos.addressPlaceholder')}
        value={adresse}
        onChangeText={(v) => {
          setAdresse(v);
          clear('adresse');
        }}
        autoCapitalize="sentences"
        textContentType="fullStreetAddress"
        autoComplete="street-address"
        error={fieldErrors.adresse}
      />
      {role !== 'professeur' ? <Text style={s.hint}>{t('auth.signup.infos.passwordLater')}</Text> : null}
    </>
  );

  const renderNiveau = () => {
    const q = niveauQuery.trim().toLowerCase();
    const matches = q ? NIVEAUX.filter((n) => n.toLowerCase().includes(q)) : NIVEAUX;
    return (
      <>
        <AuthTitle align="left" title={t('auth.signup.niveau.title')} subtitle={t('auth.signup.niveau.subtitle')} />
        <TextField
          label={t('auth.signup.niveau.label')}
          icon="search"
          placeholder={t('auth.signup.niveau.searchPlaceholder')}
          value={niveauQuery}
          onChangeText={setNiveauQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {niveau ? (
          <View style={s.selectedRow}>
            <FontAwesome5 name="graduation-cap" size={13} color={c.primary} />
            <Text style={s.selectedText}>{t('auth.signup.niveau.selected', { niveau })}</Text>
            <TouchableOpacity
              onPress={() => setNiveau('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signup.niveau.clear')}
            >
              <FontAwesome5 name="times-circle" size={15} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={s.levelList}>
          {matches.length === 0 ? (
            <Text style={s.noResult}>{t('auth.signup.niveau.noResult')}</Text>
          ) : (
            matches.map((n, i) => {
              const active = n === niveau;
              return (
                <TouchableOpacity
                  key={n}
                  style={[s.levelRow, i > 0 && s.levelRowBorder, active && { backgroundColor: c.primarySoft }]}
                  onPress={() => {
                    setNiveau(active ? '' : n);
                    setNiveauQuery('');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.levelText, active && { color: c.primary }]}>{n}</Text>
                  {active ? <FontAwesome5 name="check" size={13} color={c.primary} /> : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </>
    );
  };

  const renderDocuments = () => (
    <>
      <AuthTitle
        align="left"
        title={t('auth.signup.verification.title')}
        subtitle={t('auth.signup.verification.subtitle')}
      />
      <TextField
        label={t('auth.signup.verification.matricule')}
        icon="id-badge"
        placeholder={t('auth.signup.verification.matriculePlaceholder')}
        value={matricule}
        onChangeText={setMatricule}
        autoCapitalize="characters"
      />
      {DOCS.map((d) => {
        const file = docs[d.key];
        const docLabel = t(`auth.signup.verification.docs.${d.key}.label`);
        const docHint = t(`auth.signup.verification.docs.${d.key}.hint`);
        return (
          <View key={d.key} style={s.docField}>
            <Text style={s.docLabel}>
              {docLabel}
              <Text style={{ color: c.danger }}> *</Text>
            </Text>
            <TouchableOpacity
              style={[s.docBox, file && { borderStyle: 'solid', borderColor: c.success }]}
              onPress={() => pickDoc(d.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${docLabel}${file ? ` : ${file.name}` : ''}`}
            >
              <View style={[s.docIcon, { backgroundColor: file ? c.successSoft : c.primarySoft }]}>
                <FontAwesome5 name={file ? 'check' : d.icon} size={15} color={file ? c.success : c.primary} />
              </View>
              <View style={s.flex}>
                <Text style={s.docName} numberOfLines={1}>
                  {file ? file.name : t('auth.signup.verification.addFile')}
                </Text>
                <Text style={s.docHint}>{file ? t('auth.signup.verification.tapToReplace') : `${docHint} · PNG, JPG${d.key === 'selfie' ? '' : ', PDF'}`}</Text>
              </View>
              {file ? (
                <TouchableOpacity
                  onPress={() => setDocs((prev) => ({ ...prev, [d.key]: null }))}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={t('auth.signup.verification.removeFile')}
                >
                  <FontAwesome5 name="times-circle" size={16} color={c.textSecondary} />
                </TouchableOpacity>
              ) : (
                <FontAwesome5 name="cloud-upload-alt" size={16} color={c.primary} />
              )}
            </TouchableOpacity>
          </View>
        );
      })}
      <Banner type="info" message={t('auth.signup.verification.afterValidation')} />
    </>
  );

  return (
    <AuthScreen
      onBack={back}
      headerRight={
        <View style={[s.rolePill, { backgroundColor: accent.soft }]}>
          <FontAwesome5 name={accent.icon} size={11} color={accent.color} />
          <Text style={[s.rolePillText, { color: accent.color }]}>{roleLabel(t, role)}</Text>
        </View>
      }
    >
      {steps.length > 1 ? <StepIndicator steps={stepLabels} current={step} /> : null}
      <Banner message={error} />

      {current === 'infos' && renderInfos()}
      {current === 'niveau' && renderNiveau()}
      {current === 'documents' && renderDocuments()}

      <GradientButton
        label={isLast ? (role === 'professeur' ? t('auth.signup.sendRequest') : t('auth.signup.createMyAccount')) : t('common.next')}
        onPress={next}
        loading={loading}
        style={s.cta}
      />
      <View style={s.links}>
        {step === 0 ? (
          <PromptLink text={t('auth.common.alreadyAccount')} link={t('auth.login.signIn')} onPress={() => navigation.navigate('Login')} />
        ) : (
          <TextLink label={t('common.previous')} onPress={back} disabled={loading} />
        )}
      </View>
    </AuthScreen>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    countryField: { width: 112 },
    phoneField: { flex: 1 },
    hint: { ...ff('regular'), fontSize: 12, lineHeight: 17, color: c.textSecondary, marginTop: -4, marginBottom: 16 },
    cta: { marginTop: 8 },
    links: { alignItems: 'center', marginTop: 20, minHeight: 24 },
    rolePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    rolePillText: { ...ff('semibold'), fontSize: 12 },
    selectedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.primarySoft,
      marginBottom: 12,
    },
    selectedText: { ...ff('medium'), fontSize: 14, color: c.text, flex: 1 },
    levelList: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      backgroundColor: c.card,
      overflow: 'hidden',
      marginBottom: 20,
    },
    levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    levelRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    levelText: { ...ff('medium'), fontSize: 14, color: c.text },
    noResult: { ...ff('regular'), fontSize: 13, color: c.textSecondary, textAlign: 'center', paddingVertical: 16 },
    docField: { marginBottom: 14 },
    docLabel: { ...ff('medium'), fontSize: 14, color: c.text, marginBottom: 8 },
    docBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: c.input,
    },
    docIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    docName: { ...ff('medium'), fontSize: 14, color: c.text },
    docHint: { ...ff('regular'), fontSize: 12, color: c.textSecondary, marginTop: 2 },
  });

export default SignUpScreen;
