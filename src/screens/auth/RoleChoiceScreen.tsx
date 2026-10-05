import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BrandColors, Logo, Wordmark, ff, roleAccents, useBrandColors } from '../../components/brand';
import { AuthScreen, Banner, GradientButton, Illustration, PromptLink, RoleCard } from './components/AuthKit';
import { useT } from '../../i18n';
import type { SignupRole } from '../../services/home/authService';

export type ChoosableRole = SignupRole;

/** Same account types (and order) as web SignUp.jsx's "Type de compte" step. */
const ROLES: ChoosableRole[] = ['parent', 'eleve', 'professeur'];

/** "Je suis…" / "Créer un compte" — role cards leading to the matching sign-up flow. */
const RoleChoiceScreen = () => {
  const c = useBrandColors();
  const { width } = useWindowDimensions();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  const { t } = useT();
  const route = useRoute<any>();
  const fromLogin: boolean = !!route.params?.fromLogin;
  const [role, setRole] = useState<ChoosableRole | null>(null);
  const [hint, setHint] = useState('');

  const goOn = () => {
    if (!role) {
      setHint(t('auth.roleChoice.pickToContinue'));
      return;
    }
    navigation.navigate('SignUp', { role });
  };

  const goLogin = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'));

  return (
    <AuthScreen
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      footer={
        <>
          <GradientButton label={t('auth.common.createAccount')} onPress={goOn} />
          <View style={s.loginRow}>
            <PromptLink text={fromLogin ? t('auth.common.alreadyAccount') : ''} link={t('auth.login.signIn')} onPress={goLogin} />
          </View>
        </>
      }
    >
      <View style={s.head}>
        {fromLogin ? (
          <Illustration name="community" width={Math.min(width - 48, 360)} style={s.community} />
        ) : (
          <>
            <Logo size="md" />
            <Wordmark color={c.text} size={24} style={s.wordmark} />
          </>
        )}
        <Text style={s.title}>{fromLogin ? t('auth.common.createAccount') : t('auth.roleChoice.iAm')}</Text>
        <Text style={s.subtitle}>{t('auth.roleChoice.subtitle')}</Text>
      </View>

      <Banner message={hint} type="info" />

      <View style={s.grid}>
        {[ROLES.slice(0, 2), ROLES.slice(2)].map((row, i) => (
          <View key={i} style={s.row}>
            {row.map((r) => (
              <RoleCard
                key={r}
                title={t(`auth.roleChoice.roles.${r}.title`)}
                description={t(`auth.roleChoice.roles.${r}.description`)}
                icon={roleAccents[r].icon}
                color={roleAccents[r].color}
                soft={roleAccents[r].soft}
                selected={role === r}
                onPress={() => {
                  setRole(r);
                  setHint('');
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </AuthScreen>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    head: { alignItems: 'center', marginBottom: 20, marginTop: 4 },
    wordmark: { marginTop: 8 },
    community: { marginBottom: 8 },
    title: { ...ff('bold'), fontSize: 24, lineHeight: 32, color: c.text, marginTop: 14, textAlign: 'center' },
    subtitle: {
      ...ff('regular'),
      fontSize: 14,
      lineHeight: 21,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      paddingHorizontal: 12,
    },
    grid: { gap: 12 },
    row: { flexDirection: 'row', gap: 12 },
    loginRow: { height: 48, alignItems: 'center', justifyContent: 'center' },
  });

export default RoleChoiceScreen;
