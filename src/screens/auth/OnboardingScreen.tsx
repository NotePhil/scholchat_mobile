import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BrandColors, ff, useBrandColors } from '../../components/brand';
import { IllustrationName } from '../../assets/illustrations';
import { storageService } from '../../services/storageService';
import { useBoot } from '../../navigation/bootContext';
import { GradientButton, Illustration, TextLink } from './components/AuthKit';
import LanguageSwitch from '../../components/common/LanguageSwitch';
import { useT } from '../../i18n';

interface Slide {
  key: 'classes' | 'live' | 'messages' | 'parents';
  illustration: IllustrationName;
}

const SLIDES: Slide[] = [
  { key: 'classes', illustration: 'onboarding1' },
  { key: 'live', illustration: 'onboarding2' },
  { key: 'messages', illustration: 'onboarding3' },
  { key: 'parents', illustration: 'onboarding4' },
];

/** First-launch carousel (boards "Onboarding 1/4 … 4/4"). */
const OnboardingScreen = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { onboardingDone } = useBoot();
  const { t } = useT();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const illustrationWidth = Math.min(width - 48, height * 0.42, 420);

  const finish = async (target: 'Login' | 'RoleChoice') => {
    await storageService.setOnboardingSeen();
    onboardingDone();
    navigation.reset({
      index: target === 'Login' ? 0 : 1,
      routes: target === 'Login' ? [{ name: 'Login' }] : [{ name: 'Login' }, { name: 'RoleChoice' }],
    });
  };

  const next = () => {
    if (isLast) {
      finish('RoleChoice');
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={c.statusBar} backgroundColor={c.background} />
      <View style={s.header}>
        <View style={s.headerSide} />
        <LanguageSwitch />
        <View style={[s.headerSide, s.headerSideRight]}>
          <TouchableOpacity
            onPress={() => finish('Login')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
          >
            <Text style={s.skip}>{t('auth.onboarding.skip')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[s.slide, { width }]}>
            <Illustration name={item.illustration} width={illustrationWidth} style={s.illustration} />
            <Text style={s.title}>{t(`auth.onboarding.slides.${item.key}.title`)}</Text>
            <Text style={s.text}>{t(`auth.onboarding.slides.${item.key}.text`)}</Text>
          </View>
        )}
      />

      <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={s.dots} accessibilityLabel={t('auth.onboarding.pageOf', { current: index + 1, total: SLIDES.length })}>
          {SLIDES.map((slide, i) => (
            <View key={slide.key} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>
        <GradientButton label={isLast ? t('auth.onboarding.start') : t('common.next')} onPress={next} />
        <View style={s.secondary}>
          {isLast ? <TextLink label={t('auth.onboarding.haveAccount')} onPress={() => finish('Login')} /> : null}
        </View>
      </View>
    </View>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { height: 44, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    headerSideRight: { justifyContent: 'flex-end' },
    skip: { ...ff('medium'), fontSize: 14, color: c.textSecondary },
    slide: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
    illustration: { marginBottom: 28 },
    title: { ...ff('bold'), fontSize: 24, lineHeight: 32, color: c.text, textAlign: 'center' },
    text: { ...ff('regular'), fontSize: 15, lineHeight: 23, color: c.textSecondary, textAlign: 'center', marginTop: 14 },
    bottom: { paddingHorizontal: 24 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
    dotActive: { width: 22, backgroundColor: c.primary },
    secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
  });

export default OnboardingScreen;
