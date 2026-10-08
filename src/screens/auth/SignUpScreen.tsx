import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { BrandColors, ff, roleAccents, useBrandColors } from '../../components/brand';
import {
  CLASS_APPROVAL_PENDING,
  SignupError,
  SignupPayload,
  SignupRole,
  authService,
} from '../../services/home/authService';
import { ClassPreview, ClassPreviewError, classPreviewService } from '../../services/api/classPreviewService';
import { isClassCodeError } from '../../services/api/parentService';
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
import { SIGNUP_EMAIL_REGEX } from './components/passwordRules';
import { TFunction, TranslationKey, translate, useT } from '../../i18n';
import type { AccountCreatedParams } from './AccountCreatedScreen';
import { ClassPreviewStatus, useClassPreview } from '../../hooks/useClassPreview';
import ClassPreviewCard from '../../components/common/ClassPreviewCard';

type DocumentAsset = DocumentPicker.DocumentPickerAsset;
type DocKey = 'cniRecto' | 'cniVerso' | 'selfie';

type StepId = 'infos' | 'classe' | 'confirmation' | 'enfants' | 'recap' | 'documents';

/** Child card of the parent sign-up ("Vos enfants"), with its own class-code check. */
interface ChildDraft {
  key: string;
  prenom: string;
  nom: string;
  code: string;
  status: ClassPreviewStatus;
  preview: ClassPreview | null;
  /** Normalized code the preview / error belongs to. */
  checkedCode: string;
  lookupError: string;
  errors: { prenom?: string; nom?: string; code?: string; general?: string };
}

const MAX_CHILDREN = 10;
const normalizeCode = (code: string) => code.trim().toUpperCase();
let childKeySeq = 0;
const newChild = (): ChildDraft => ({
  key: `child-${++childKeySeq}`,
  prenom: '',
  nom: '',
  code: '',
  status: 'idle',
  preview: null,
  checkedCode: '',
  lookupError: '',
  errors: {},
});
const isChildVerified = (ch: ChildDraft) => ch.status === 'found' && !!ch.preview && ch.checkedCode === normalizeCode(ch.code);

/** Existing e-mail reported by the sign-up (actions shown under the e-mail field). */
type EmailIssue = 'exists' | 'pending' | 'inactive' | 'other';

const EMAIL_ISSUE_KEYS: Record<'exists' | 'pending' | 'inactive', TranslationKey> = {
  exists: 'auth.signup.errors.emailExists',
  pending: 'auth.signup.errors.emailPendingClass',
  inactive: 'auth.signup.errors.emailInactive',
};

/**
 * Failed sign-up about the e-mail (existing account, pending class sign-up, invalid format…) or the
 * phone → field error (same cases as web utils/signupErrors.js), or null.
 */
const mapSignupFieldError = (
  code: string | undefined,
  message: string
): { field: 'email' | 'phone'; message: string; issue?: EmailIssue } | null => {
  const c = String(code || '').toUpperCase();
  if (c === 'EMAIL_DEJA_UTILISE') return { field: 'email', issue: 'exists', message: translate(EMAIL_ISSUE_KEYS.exists) };
  // Existing account not active (never activated / awaiting validation): refused, nothing changed.
  if (c === 'COMPTE_NON_ACTIVE') return { field: 'email', issue: 'inactive', message: translate(EMAIL_ISSUE_KEYS.inactive) };
  if (c === 'COMPTE_EN_ATTENTE_VALIDATION') {
    return { field: 'email', issue: 'inactive', message: translate('auth.signup.errors.emailAwaitingValidation') };
  }
  if (c === 'INSCRIPTION_EN_ATTENTE') return { field: 'email', issue: 'pending', message: translate(EMAIL_ISSUE_KEYS.pending) };
  if (c === 'ROLE_INCOMPATIBLE') {
    return { field: 'email', issue: 'other', message: message || translate('auth.signup.errors.roleIncompatible') };
  }
  // Existing account (not active) that already has / requested this profile.
  if (c === 'DUPLICATE_RESOURCE') return { field: 'email', issue: 'exists', message: message || translate(EMAIL_ISSUE_KEYS.exists) };
  if (/invalid email|email is required/i.test(message)) return { field: 'email', message: translate('auth.signup.errors.invalidEmail') };
  if (/invalid phone/i.test(message)) return { field: 'phone', message: translate('auth.signup.errors.phone') };
  return null;
};

/**
 * Steps per role (the role itself is picked beforehand on RoleChoiceScreen). Élève: Infos perso →
 * Classe (required class code) → Confirmation, then the class teacher approves. Parent: Infos perso →
 * Vos enfants (one card per child, each with its verified class code) → Récapitulatif; the account
 * is created at once and each child's request waits for its class teacher.
 */
const STEPS: Record<SignupRole, StepId[]> = {
  professeur: ['infos', 'documents'],
  eleve: ['infos', 'classe', 'confirmation'],
  parent: ['infos', 'enfants', 'recap'],
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
 * Sign-up (Professeur / Élève / Parent): nom, prénom, téléphone, email, adresse for everyone;
 * CNI recto/verso + selfie (+ optional matricule) for the professeur; the class code (codeClasse)
 * for an élève; the children (prénom, nom, verified class code each) for a parent; then a summary.
 * No password: the account is created via POST /utilisateurs without motDePasse. A professor
 * chooses the password from the e-mailed link after admin validation; an élève receives a temporary
 * password by e-mail once the class teacher approved the request; a parent receives it right away
 * (children requests pending). The temporary password is changed at first login.
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
  const [codeClasse, setCodeClasse] = useState('');
  // Parent: one card per child
  const [enfants, setEnfants] = useState<ChildDraft[]>(() => [newChild()]);
  // Professeur
  const [matricule, setMatricule] = useState('');
  const [docs, setDocs] = useState<Record<DocKey, DocumentAsset | null>>({ cniRecto: null, cniVerso: null, selfie: null });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emailIssue, setEmailIssue] = useState<EmailIssue | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Professor profile already posted (an upload failed afterwards): retry only the uploads.
  const [createdProfessor, setCreatedProfessor] = useState<{ id: string; statut?: string; uploadToken?: string } | null>(null);

  // Class code (élève): public preview, looked up only by the "Vérifier le code" button.
  const classLookup = useClassPreview(codeClasse, 'eleve');
  const allChildrenVerified = enfants.length > 0 && enfants.every(isChildVerified);

  const isLast = step === steps.length - 1;
  const verifyingCode = steps[step] === 'classe' && classLookup.status !== 'found';
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
      else if (!SIGNUP_EMAIL_REGEX.test(email.trim())) errs.email = t('auth.signup.errors.invalidEmail');
      if (!adresse.trim()) errs.adresse = t('auth.signup.errors.address');
    } else if (current === 'classe') {
      if (!codeClasse.trim()) errs.codeClasse = t('auth.signup.errors.classCodeRequired');
    } else if (current === 'enfants') {
      return validateChildren();
    } else if (current === 'documents') {
      if (!docs.cniRecto || !docs.cniVerso || !docs.selfie) {
        setError(t('auth.signup.errors.documents'));
        return false;
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Parent: children cards ─────────────────────────────────────────────────
  const updateChild = (key: string, patch: Partial<ChildDraft> | ((ch: ChildDraft) => Partial<ChildDraft>)) => {
    setEnfants((list) => list.map((ch) => (ch.key === key ? { ...ch, ...(typeof patch === 'function' ? patch(ch) : patch) } : ch)));
    if (error) setError('');
  };

  const setChildCount = (count: number) => {
    const n = Math.max(1, Math.min(MAX_CHILDREN, count));
    setEnfants((list) => (n > list.length ? [...list, ...Array.from({ length: n - list.length }, newChild)] : list.slice(0, n)));
    if (error) setError('');
  };

  const removeChild = (key: string) => {
    setEnfants((list) => (list.length > 1 ? list.filter((ch) => ch.key !== key) : list));
    if (error) setError('');
  };

  /** "Vérifier le code" of one card: public preview (GET /public/classes/apercu?type=parent). */
  const verifyChild = async (key: string) => {
    const ch = enfants.find((x) => x.key === key);
    if (!ch) return;
    const code = normalizeCode(ch.code);
    if (!code) {
      updateChild(key, { errors: { ...ch.errors, code: t('classPreview.errors.required') } });
      return;
    }
    updateChild(key, { status: 'loading', preview: null, checkedCode: code, lookupError: '', errors: { ...ch.errors, code: undefined } });
    try {
      const preview = await classPreviewService.getPreview(code, 'parent');
      // Ignore a late answer for a code edited meanwhile.
      updateChild(key, (cur) => (cur.checkedCode === code && normalizeCode(cur.code) === code ? { status: 'found', preview } : {}));
    } catch (err) {
      const e = err as ClassPreviewError;
      updateChild(key, (cur) =>
        cur.checkedCode === code && normalizeCode(cur.code) === code
          ? { status: 'error', preview: null, lookupError: e?.message || translate('classPreview.errors.generic') }
          : {}
      );
    }
  };

  /** "Vos enfants" step: names + verified code on every card, no child twice. */
  const validateChildren = (): boolean => {
    let ok = true;
    const seen = new Set<string>();
    const next = enfants.map((ch) => {
      const errors: ChildDraft['errors'] = {};
      if (!ch.prenom.trim()) errors.prenom = t('auth.signup.errors.firstName');
      if (!ch.nom.trim()) errors.nom = t('auth.signup.errors.lastName');
      if (!ch.code.trim()) errors.code = t('classPreview.errors.required');
      else if (!isChildVerified(ch)) errors.code = t('classPreview.verifyFirst');
      const identity = `${ch.prenom.trim().toLowerCase()}|${ch.nom.trim().toLowerCase()}`;
      if (ch.prenom.trim() && ch.nom.trim()) {
        if (seen.has(identity)) errors.general = t('parentChildren.errors.duplicateForm');
        seen.add(identity);
      }
      if (Object.keys(errors).length) ok = false;
      return { ...ch, errors };
    });
    setEnfants(next);
    if (!ok) setError('');
    return ok;
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

  // uploadToken: signed token from the sign-up response, required by the backend for these
  // unauthenticated document uploads.
  const upload = async (file: DocumentAsset, ownerId: string, documentType: string, uploadToken?: string) => {
    const mimeType = file.mimeType ?? 'application/octet-stream';
    const presigned = await authService.getPresignedUrl(file.name, mimeType, ownerId, documentType, uploadToken);
    await authService.uploadFile(presigned.url, { uri: file.uri, mimeType, name: file.name }, uploadToken);
    return presigned.url.split('?')[0];
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const finish = (params: AccountCreatedParams) => navigation.navigate('AccountCreated', params);

  /** End screen from the sign-up response's inscriptionStatut (same cases as web SignUp.jsx). */
  const afterCreate = (statut?: string, statutInscription?: string, classeNom?: string, res?: Record<string, unknown>) => {
    if (role === 'parent' && statut !== 'ROLE_ADDED') {
      // Parent: account created now (login + temporary password e-mailed), children requests pending.
      const returned = Array.isArray(res?.enfants) ? (res?.enfants as Record<string, unknown>[]) : [];
      const children = (returned.length ? returned : enfants).map((e, i) => {
        const draft = enfants[i];
        const r = e as Record<string, unknown>;
        return {
          prenom: String(r.prenom ?? draft?.prenom ?? '').trim(),
          nom: String(r.nom ?? draft?.nom ?? '').trim(),
          classeNom: typeof r.classeNom === 'string' && r.classeNom ? r.classeNom : draft?.preview?.nom ?? '',
        };
      });
      finish({ variant: 'parentCreated', email: email.trim(), enfants: children });
      return;
    }
    if (statutInscription === CLASS_APPROVAL_PENDING) {
      // Parent / élève: the class teacher must approve, then login + temporary password by e-mail.
      finish({ variant: 'classPending', email: email.trim(), classeNom: classeNom || undefined });
      return;
    }
    if (statut === 'ROLE_ADDED') {
      // Existing active account: role usable now, with the account's existing password.
      finish({ variant: 'roleAdded' });
      return;
    }
    if (statut === 'ROLE_PENDING_VALIDATION' && role !== 'professeur') {
      // Existing account (not active yet): the student profile request was added to it.
      navigation.navigate('Login', {
        email: email.trim(),
        message: classeNom
          ? translate('auth.signup.errors.studentRequestAddedNamed', { classe: classeNom })
          : translate('auth.signup.errors.studentRequestAdded'),
      });
      return;
    }
    if (statut === 'ROLE_PENDING_VALIDATION') {
      finish({ variant: 'rolePending' });
      return;
    }
    if (role === 'professeur') {
      finish({ variant: 'pending' });
      return;
    }
    finish({ variant: 'activation', email: email.trim() });
  };

  const showEmailIssue = (issue: EmailIssue | null, message: string, field: 'email' | 'phone' = 'email') => {
    setStep(0);
    setError('');
    setFieldErrors({ [field]: message });
    setEmailIssue(field === 'email' ? issue : null);
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
        if (role === 'eleve') payload.codeClasse = codeClasse.trim();
        if (role === 'parent') {
          payload.enfants = enfants.map((ch) => ({ prenom: ch.prenom.trim(), nom: ch.nom.trim(), codeClasse: normalizeCode(ch.code) }));
        }
        const res = await authService.signUp(payload);
        if (role !== 'professeur' || res.inscriptionStatut === 'ROLE_ADDED' || !res.id) {
          afterCreate(
            res.inscriptionStatut,
            typeof res.statutInscription === 'string' ? res.statutInscription : undefined,
            typeof res.classeNom === 'string' ? res.classeNom : undefined,
            res
          );
          return;
        }
        created = { id: String(res.id), statut: res.inscriptionStatut, uploadToken: res.uploadToken };
        setCreatedProfessor(created);
      }

      // Professor: documents → PATCH urls + matricule (web handleDocumentSubmission).
      const urls = {
        cniRecto: docs.cniRecto ? await upload(docs.cniRecto, created.id, 'cni-recto', created.uploadToken) : '',
        cniVerso: docs.cniVerso ? await upload(docs.cniVerso, created.id, 'cni-verso', created.uploadToken) : '',
        selfie: docs.selfie ? await upload(docs.selfie, created.id, 'selfie', created.uploadToken) : '',
      };
      await authService.updateProfessorUrls(created.id, urls, matricule, created.uploadToken);
      afterCreate(created.statut);
    } catch (err) {
      const msg = err instanceof Error ? err.message : translate('auth.signup.errors.createFailed');
      const code = (err as SignupError)?.code;
      const enfantIndex = (err as SignupError)?.enfantIndex;
      if (role === 'parent' && enfantIndex !== undefined && enfantIndex < enfants.length) {
        // A child refused: back to "Vos enfants", error on that child's card.
        const key = enfants[enfantIndex].key;
        updateChild(
          key,
          isClassCodeError(code)
            ? { status: 'idle', preview: null, checkedCode: '', lookupError: '', errors: { code: msg } }
            : { errors: { general: msg } }
        );
        setStep(steps.indexOf('enfants'));
        return;
      }
      if (role === 'parent' && (code === 'ENFANTS_REQUIS' || isClassCodeError(code))) {
        setStep(steps.indexOf('enfants'));
        setError(msg);
        return;
      }
      const fieldError = mapSignupFieldError(code, msg);
      if (fieldError && !createdProfessor) {
        // E-mail (existing account…) or phone refused: back to the infos step, error under the field.
        showEmailIssue(fieldError.issue ?? null, fieldError.message, fieldError.field);
        return;
      }
      if (role === 'eleve' && code && /CODE_CLASSE|CLASSE_/.test(code)) {
        // Class code refused: back to the code step, error under the field.
        classLookup.reset();
        setStep(steps.indexOf('classe'));
        setFieldErrors({ codeClasse: msg });
        return;
      }
      setError(createdProfessor ? `${msg} ${translate('auth.signup.errors.retryUploads')}` : msg);
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    if (loading || !validateStep()) return;
    if (current === 'classe' && classLookup.status !== 'found') {
      // Single button: "Vérifier le code" runs the lookup (class card or error under the field); once the
      // class is found the same button becomes "Suivant".
      await classLookup.check();
      return;
    }
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
          setEmailIssue(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        error={fieldErrors.email}
      />
      {emailIssue && emailIssue !== 'pending' && fieldErrors.email ? (
        <View style={s.emailActions}>
          {emailIssue === 'inactive' ? (
            <TextLink label={t('verifyAccount.link')} onPress={() => navigation.navigate('VerifyAccount', { email: email.trim() })} />
          ) : (
            <>
              <TextLink label={t('auth.login.signIn')} onPress={() => navigation.navigate('Login', { email: email.trim() })} />
              <TextLink
                label={t('auth.login.forgotPassword')}
                onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
              />
            </>
          )}
        </View>
      ) : null}
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
      {role !== 'professeur' ? (
        <Text style={s.hint}>{t(role === 'parent' ? 'auth.signup.infos.passwordLaterParent' : 'auth.signup.infos.passwordLater')}</Text>
      ) : null}
    </>
  );

  const renderClasse = () => (
    <>
      <AuthTitle align="left" title={t('auth.signup.classe.title')} subtitle={t('auth.signup.classe.subtitle')} />
      <TextField
        label={t('auth.signup.classe.label')}
        required
        icon="key"
        placeholder={t('auth.signup.classe.placeholder')}
        value={codeClasse}
        onChangeText={(v) => {
          setCodeClasse(v);
          clear('codeClasse');
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType={classLookup.status === 'found' ? 'next' : 'search'}
        onSubmitEditing={next}
        error={fieldErrors.codeClasse}
      />
      <ClassPreviewCard
        status={classLookup.status}
        preview={classLookup.preview}
        error={classLookup.error}
        style={s.previewCard}
      />
      <Banner type="info" message={t('auth.signup.classe.hint')} />
      <Text style={s.hint}>{t('auth.signup.classe.approvalStudent')}</Text>
    </>
  );

  const renderConfirmation = () => {
    const rows: { icon: string; label: string; value: string }[] = [
      { icon: 'user-tag', label: t('auth.signup.confirmation.profile'), value: roleLabel(t, role) },
      { icon: 'user', label: t('auth.signup.confirmation.name'), value: `${prenom.trim()} ${nom.trim()}`.trim() },
      { icon: 'envelope', label: t('auth.common.email'), value: email.trim() },
      {
        icon: 'phone',
        label: t('auth.common.phone'),
        value: `+${countryCode} ${normalizePhone(countryCode, phone) ?? phone.trim()}`,
      },
      { icon: 'map-marker-alt', label: t('auth.signup.infos.address'), value: adresse.trim() },
      { icon: 'key', label: t('auth.signup.classe.label'), value: codeClasse.trim() },
    ];
    return (
      <>
        <AuthTitle align="left" title={t('auth.signup.confirmation.title')} subtitle={t('auth.signup.confirmation.subtitle')} />
        <View style={s.summary}>
          {rows.map((r, i) => (
            <View key={r.label} style={[s.summaryRow, i > 0 && s.summaryRowBorder]}>
              <View style={s.summaryIcon}>
                <FontAwesome5 name={r.icon} size={12} color={c.primary} />
              </View>
              <View style={s.flex}>
                <Text style={s.summaryLabel}>{r.label}</Text>
                <Text style={s.summaryValue} numberOfLines={2}>
                  {r.value || '—'}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <TextLink label={t('auth.signup.confirmation.edit')} onPress={() => setStep(0)} disabled={loading} style={s.editLink} />
        {classLookup.preview ? (
          <ClassPreviewCard status="found" preview={classLookup.preview} heading={t('classPreview.joining')} style={s.previewCard} />
        ) : null}
        <Banner type="info" message={t('auth.signup.confirmation.nextSteps')} />
      </>
    );
  };

  const personalRows = (): { icon: string; label: string; value: string }[] => [
    { icon: 'user-tag', label: t('auth.signup.confirmation.profile'), value: roleLabel(t, role) },
    { icon: 'user', label: t('auth.signup.confirmation.name'), value: `${prenom.trim()} ${nom.trim()}`.trim() },
    { icon: 'envelope', label: t('auth.common.email'), value: email.trim() },
    { icon: 'phone', label: t('auth.common.phone'), value: `+${countryCode} ${normalizePhone(countryCode, phone) ?? phone.trim()}` },
    { icon: 'map-marker-alt', label: t('auth.signup.infos.address'), value: adresse.trim() },
  ];

  const renderEnfants = () => (
    <>
      <AuthTitle align="left" title={t('auth.signup.enfants.title')} subtitle={t('auth.signup.enfants.subtitle')} />
      <View style={s.countRow}>
        <Text style={s.countLabel}>{t('auth.signup.enfants.howMany')}</Text>
        <View style={s.stepper}>
          <TouchableOpacity
            style={[s.stepperBtn, enfants.length <= 1 && s.stepperBtnDisabled]}
            onPress={() => setChildCount(enfants.length - 1)}
            disabled={enfants.length <= 1 || loading}
            accessibilityRole="button"
            accessibilityLabel={t('auth.signup.enfants.fewer')}
          >
            <FontAwesome5 name="minus" size={12} color={c.primary} />
          </TouchableOpacity>
          <Text style={s.countValue} accessibilityLiveRegion="polite">
            {enfants.length}
          </Text>
          <TouchableOpacity
            style={[s.stepperBtn, enfants.length >= MAX_CHILDREN && s.stepperBtnDisabled]}
            onPress={() => setChildCount(enfants.length + 1)}
            disabled={enfants.length >= MAX_CHILDREN || loading}
            accessibilityRole="button"
            accessibilityLabel={t('auth.signup.enfants.more')}
          >
            <FontAwesome5 name="plus" size={12} color={c.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {enfants.map((ch, i) => {
        const verified = isChildVerified(ch);
        const shownStatus: ClassPreviewStatus = ch.checkedCode === normalizeCode(ch.code) ? ch.status : 'idle';
        return (
          <View key={ch.key} style={[s.childCard, verified && { borderColor: c.success }]}>
            <View style={s.childHead}>
              <Text style={s.childTitle}>{t('auth.signup.enfants.child', { index: i + 1 })}</Text>
              {enfants.length > 1 ? (
                <TextLink label={t('auth.signup.enfants.remove')} onPress={() => removeChild(ch.key)} disabled={loading} muted />
              ) : null}
            </View>
            <TextField
              label={t('auth.signup.infos.firstName')}
              required
              icon="child"
              placeholder={t('parentChildren.firstNamePlaceholder')}
              value={ch.prenom}
              onChangeText={(v) => updateChild(ch.key, { prenom: v, errors: { ...ch.errors, prenom: undefined, general: undefined } })}
              autoCapitalize="words"
              error={ch.errors.prenom}
            />
            <TextField
              label={t('auth.signup.infos.lastName')}
              required
              icon="user"
              placeholder={t('parentChildren.lastNamePlaceholder')}
              value={ch.nom}
              onChangeText={(v) => updateChild(ch.key, { nom: v, errors: { ...ch.errors, nom: undefined, general: undefined } })}
              autoCapitalize="words"
              error={ch.errors.nom}
            />
            <TextField
              label={t('auth.signup.classe.label')}
              required
              icon="key"
              placeholder={t('auth.signup.classe.placeholder')}
              value={ch.code}
              onChangeText={(v) =>
                updateChild(ch.key, { code: v, status: 'idle', preview: null, lookupError: '', errors: { ...ch.errors, code: undefined } })
              }
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => verifyChild(ch.key)}
              error={ch.errors.code}
            />
            {!verified ? (
              <GradientButton
                label={shownStatus === 'loading' ? t('classPreview.verifying') : t('classPreview.verify')}
                icon="search"
                variant="outline"
                onPress={() => verifyChild(ch.key)}
                loading={shownStatus === 'loading'}
                disabled={!ch.code.trim() || loading}
                style={s.verifyBtn}
              />
            ) : null}
            <ClassPreviewCard status={shownStatus} preview={ch.preview} error={ch.lookupError} style={s.previewCard} />
            {ch.errors.general ? <Banner message={ch.errors.general} /> : null}
          </View>
        );
      })}

      {enfants.length < MAX_CHILDREN ? (
        <TouchableOpacity style={s.addChild} onPress={() => setChildCount(enfants.length + 1)} disabled={loading} accessibilityRole="button">
          <FontAwesome5 name="plus-circle" size={14} color={c.primary} />
          <Text style={s.addChildText}>{t('auth.signup.enfants.add')}</Text>
        </TouchableOpacity>
      ) : null}
      {!allChildrenVerified ? <Text style={s.hint}>{t('auth.signup.enfants.verifyAll')}</Text> : null}
      <Banner type="info" message={t('auth.signup.enfants.approvalHint')} />
    </>
  );

  const renderRecap = () => (
    <>
      <AuthTitle align="left" title={t('auth.signup.recap.title')} subtitle={t('auth.signup.confirmation.subtitle')} />
      <View style={s.summary}>
        {personalRows().map((r, i) => (
          <View key={r.label} style={[s.summaryRow, i > 0 && s.summaryRowBorder]}>
            <View style={s.summaryIcon}>
              <FontAwesome5 name={r.icon} size={12} color={c.primary} />
            </View>
            <View style={s.flex}>
              <Text style={s.summaryLabel}>{r.label}</Text>
              <Text style={s.summaryValue} numberOfLines={2}>
                {r.value || '—'}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <TextLink label={t('auth.signup.confirmation.edit')} onPress={() => setStep(0)} disabled={loading} style={s.editLink} />
      <Text style={s.sectionLabel}>{t('auth.signup.recap.children', { count: enfants.length })}</Text>
      <View style={s.summary}>
        {enfants.map((ch, i) => (
          <View key={ch.key} style={[s.summaryRow, i > 0 && s.summaryRowBorder]}>
            <View style={s.summaryIcon}>
              <FontAwesome5 name="child" size={12} color={c.primary} />
            </View>
            <View style={s.flex}>
              <Text style={s.summaryValue} numberOfLines={1}>
                {`${ch.prenom.trim()} ${ch.nom.trim()}`.trim() || '—'}
              </Text>
              <Text style={s.summaryLabel} numberOfLines={2}>
                {[ch.preview?.nom, ch.preview?.etablissementNom].filter(Boolean).join(' · ') || normalizeCode(ch.code)}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <TextLink
        label={t('auth.signup.recap.editChildren')}
        onPress={() => setStep(steps.indexOf('enfants'))}
        disabled={loading}
        style={s.editLink}
      />
      <Banner type="info" message={t('auth.signup.recap.nextSteps')} />
    </>
  );

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
      {current === 'classe' && renderClasse()}
      {current === 'confirmation' && renderConfirmation()}
      {current === 'enfants' && renderEnfants()}
      {current === 'recap' && renderRecap()}
      {current === 'documents' && renderDocuments()}

      <GradientButton
        label={
          isLast
            ? role === 'professeur'
              ? t('auth.signup.sendRequest')
              : role === 'parent'
                ? t('common.confirm')
                : t('auth.signup.createMyAccount')
            : verifyingCode
              ? classLookup.status === 'loading'
                ? t('classPreview.verifying')
                : t('classPreview.verify')
              : t('common.next')
        }
        onPress={next}
        loading={loading || (verifyingCode && classLookup.status === 'loading')}
        disabled={(current === 'classe' && !codeClasse.trim()) || (current === 'enfants' && !allChildrenVerified)}
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
    summary: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      backgroundColor: c.card,
      overflow: 'hidden',
      marginBottom: 12,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
    summaryRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    summaryIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryLabel: { ...ff('regular'), fontSize: 12, color: c.textSecondary },
    summaryValue: { ...ff('semibold'), fontSize: 14, color: c.text, marginTop: 1 },
    editLink: { alignSelf: 'flex-end', marginBottom: 14 },
    emailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: -6, marginBottom: 14 },
    previewCard: { marginBottom: 14 },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      backgroundColor: c.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
    },
    countLabel: { ...ff('semibold'), fontSize: 14, color: c.text, flex: 1 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepperBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperBtnDisabled: { opacity: 0.4 },
    countValue: { ...ff('bold'), fontSize: 17, color: c.text, minWidth: 22, textAlign: 'center' },
    childCard: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      backgroundColor: c.card,
      padding: 14,
      paddingBottom: 4,
      marginBottom: 14,
    },
    childHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    childTitle: { ...ff('bold'), fontSize: 15, color: c.text },
    verifyBtn: { marginTop: -4, marginBottom: 12 },
    addChild: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, marginBottom: 10 },
    addChildText: { ...ff('semibold'), fontSize: 14, color: c.primary },
    sectionLabel: { ...ff('semibold'), fontSize: 13, color: c.textSecondary, marginBottom: 8 },
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
