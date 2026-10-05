import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BrandColors, ff, useBrandColors } from '../brand';
import { SupportedLanguage, useLanguageStore } from '../../store/useLanguageStore';
import { useT } from '../../i18n';

const OPTIONS: SupportedLanguage[] = ['fr', 'en'];

/**
 * Compact "FR | EN" segmented pill (globe icon optional). Follows the app-wide
 * light/dark theme through useBrandColors, so it works on pre-login screens and
 * in the logged-in header alike. The choice is persisted by useLanguageStore.
 */
const LanguageSwitch = ({ showIcon = true, style }: { showIcon?: boolean; style?: StyleProp<ViewStyle> }) => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const { t, lang } = useT();
  const setLanguage = useLanguageStore((st) => st.setLanguage);

  return (
    <View style={[s.pill, style]} accessibilityRole="radiogroup" accessibilityLabel={t('language.label')}>
      {showIcon ? <FontAwesome5 name="globe" size={11} color={c.textSecondary} style={s.icon} /> : null}
      {OPTIONS.map((option) => {
        const active = option === lang;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => (active ? undefined : setLanguage(option))}
            style={[s.segment, active && s.segmentActive]}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(option === 'fr' ? 'language.french' : 'language.english')}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]}>{option.toUpperCase()}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.mode === 'dark' ? c.card : c.backgroundAlt,
      padding: 2,
    },
    icon: { marginLeft: 7, marginRight: 3 },
    segment: { minWidth: 34, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignItems: 'center' },
    segmentActive: { backgroundColor: c.primary },
    segmentText: { ...ff('semibold'), fontSize: 11, lineHeight: 14, color: c.textSecondary, letterSpacing: 0.4 },
    segmentTextActive: { color: '#FFFFFF' },
  });

export default LanguageSwitch;
