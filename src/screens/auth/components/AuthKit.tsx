import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  FocusEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { BrandColors, brandGradient, ff, useBrandColors } from '../../../components/brand';
import { IllustrationName, rasterIllustrations } from '../../../assets/illustrations';
import { VectorIllustration } from '../../../components/illustrations';
import type { IllustrationName as VectorName } from '../../../components/illustrations/registry';
import LanguageSwitch from '../../../components/common/LanguageSwitch';
import { useT } from '../../../i18n';

/** Shared building blocks of the pre-login screens (design boards "Flux d'authentification"). */

const useStyles = () => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  return { c, s };
};

// ── Screen scaffold ─────────────────────────────────────────────────────────

const FocusContext = createContext<((e: FocusEvent) => void) | null>(null);

interface AuthScreenProps {
  children: ReactNode;
  /** Shows a back arrow at the top-left. */
  onBack?: () => void;
  /** Element at the top-right (e.g. "Passer"). */
  headerRight?: ReactNode;
  /** Pinned under the scroll content (not scrolled). */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Vertically centre the content when it is shorter than the screen. */
  center?: boolean;
  backgroundColor?: string;
  statusBarStyle?: 'dark-content' | 'light-content';
  /** FR | EN pill centred in the header (default true). */
  showLanguageSwitch?: boolean;
}

/**
 * Keeps the focused field visible above the keyboard WITHOUT jumping: it only
 * scrolls when the field would actually be hidden (by the keyboard or under
 * the header), and only by the distance needed. Scrolling every focused field
 * to the top — the previous behaviour — made the form jump on every tap.
 */
const useKeyboardAvoidingScroll = () => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardHeight = useRef(0);
  /** Top edge of the keyboard in window coordinates (0 when hidden). */
  const keyboardTop = useRef(0);
  const focusedTarget = useRef<any>(null);

  const ensureVisible = useCallback((target: any) => {
    if (!target?.measureInWindow) return;
    target.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const windowHeight = Dimensions.get('window').height;
      const visibleBottom = (keyboardTop.current || windowHeight - keyboardHeight.current) - 24;
      const visibleTop = 110; // below the status bar + screen header
      let delta = 0;
      if (y + h > visibleBottom) delta = y + h - visibleBottom;
      else if (y < visibleTop) delta = y - visibleTop;
      if (delta !== 0) {
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: true });
      }
    });
  }, []);

  useEffect(() => {
    // Both platforms. On recent Android (edge-to-edge, e.g. Android 15/16)
    // the window is NOT resized for the keyboard, so the keyboard simply
    // covers the lower fields unless we add room and scroll them into view.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardHeight.current = e.endCoordinates.height;
      keyboardTop.current = e.endCoordinates.screenY || 0;
      const target = focusedTarget.current;
      if (target) setTimeout(() => ensureVisible(target), 60);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.current = 0;
      keyboardTop.current = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [ensureVisible]);

  const onFieldFocus = useCallback(
    (e: FocusEvent) => {
      // Read the target now: React releases the synthetic event right after
      // this handler, so `e.target` is null inside the timeout below.
      const target = e.target;
      focusedTarget.current = target;
      // Keyboard already open (moving between fields): check right away.
      // Otherwise the keyboard "show" listener above does it once it's sized.
      if (keyboardHeight.current > 0) setTimeout(() => ensureVisible(target), 60);
    },
    [ensureVisible]
  );

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { scrollRef, onFieldFocus, onScroll };
};

/** Safe-area + keyboard-aware scroll container; a TextField inside is kept visible above the keyboard. */
export const AuthScreen = ({
  children,
  onBack,
  headerRight,
  footer,
  contentStyle,
  center,
  backgroundColor,
  statusBarStyle,
  showLanguageSwitch = true,
}: AuthScreenProps) => {
  const { c, s } = useStyles();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { scrollRef, onFieldFocus, onScroll } = useKeyboardAvoidingScroll();
  // iOS needs KeyboardAvoidingView; on Android the window itself is resized
  // (adjustResize), so a plain View avoids an extra layout layer.
  const KeyboardContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const bg = backgroundColor ?? c.background;
  const hasHeader = !!onBack || !!headerRight || showLanguageSwitch;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={statusBarStyle ?? c.statusBar} />
      {hasHeader ? (
        <View style={s.header}>
          <View style={s.headerSide}>
            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                style={s.backBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
              >
                <FontAwesome5 name="arrow-left" size={18} color={c.text} />
              </TouchableOpacity>
            ) : null}
          </View>
          {showLanguageSwitch ? <LanguageSwitch /> : null}
          <View style={[s.headerSide, s.headerSideRight]}>{headerRight ?? null}</View>
        </View>
      ) : null}
      <KeyboardContainer
        style={s.flex}
        {...(Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: insets.top } : null)}
      >
        <FocusContext.Provider value={onFieldFocus}>
          <ScrollView
            ref={scrollRef}
            style={s.flex}
            contentContainerStyle={[
              s.content,
              center && s.contentCenter,
              {
                // Android keyboard room comes from the app-wide KeyboardInsetView.
                paddingBottom: (footer ? 16 : 24) + (footer ? 0 : insets.bottom),
              },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScroll={onScroll}
            scrollEventThrottle={32}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </FocusContext.Provider>
        {footer ? <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View> : null}
      </KeyboardContainer>
    </View>
  );
};

// ── Texts ───────────────────────────────────────────────────────────────────

export const AuthTitle = ({
  title,
  subtitle,
  align = 'center',
  style,
}: {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  style?: StyleProp<ViewStyle>;
}) => {
  const { s } = useStyles();
  return (
    <View style={[s.titleWrap, style]}>
      <Text style={[s.title, { textAlign: align }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={[s.subtitle, { textAlign: align }]}>{subtitle}</Text> : null}
    </View>
  );
};

export const TextLink = ({
  label,
  onPress,
  style,
  disabled,
  muted,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  muted?: boolean;
}) => {
  const { c, s } = useStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={style}
      accessibilityRole="link"
    >
      <Text style={[s.link, { color: disabled || muted ? c.textSecondary : c.link }]}>{label}</Text>
    </TouchableOpacity>
  );
};

/** "Vous n'avez pas de compte ? Créer un compte" style line. */
export const PromptLink = ({ text, link, onPress }: { text: string; link: string; onPress: () => void }) => {
  const { s } = useStyles();
  return (
    <View style={s.promptRow}>
      <Text style={s.promptText}>{text} </Text>
      <TextLink label={link} onPress={onPress} />
    </View>
  );
};

// ── Buttons ─────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'light';
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

export const GradientButton = ({ label, onPress, loading, disabled, variant = 'primary', icon, style }: ButtonProps) => {
  const { c, s } = useStyles();
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'light' ? c.primary : c.link;
  const content = (
    <View style={s.btnInner}>
      {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
      <Text style={[s.btnText, { color: textColor }]}>{label}</Text>
      {!loading && icon ? <FontAwesome5 name={icon} size={14} color={textColor} /> : null}
    </View>
  );
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      style={[s.btn, variant === 'primary' && s.btnShadow, inactive && { opacity: 0.6 }, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={brandGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.btnFill}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            s.btnFill,
            variant === 'outline'
              ? { borderWidth: 1.5, borderColor: c.link, backgroundColor: 'transparent' }
              : { backgroundColor: '#FFFFFF' },
          ]}
        >
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Banners ─────────────────────────────────────────────────────────────────

export const Banner = ({
  message,
  type = 'error',
  style,
}: {
  message?: string | null;
  type?: 'error' | 'info' | 'success';
  style?: StyleProp<ViewStyle>;
}) => {
  const { c, s } = useStyles();
  if (!message) return null;
  const palette =
    type === 'error'
      ? { bg: c.dangerSoft, fg: c.dangerText, icon: 'exclamation-circle', iconColor: c.danger }
      : type === 'success'
        ? { bg: c.successSoft, fg: c.success, icon: 'check-circle', iconColor: c.success }
        : { bg: c.infoSoft, fg: c.mode === 'dark' ? '#C7D2FE' : '#4338CA', icon: 'info-circle', iconColor: c.gradientStart };
  return (
    <View style={[s.banner, { backgroundColor: palette.bg }, style]} accessibilityLiveRegion="polite">
      <FontAwesome5 name={palette.icon} size={14} color={palette.iconColor} style={s.bannerIcon} solid />
      <Text style={[s.bannerText, { color: palette.fg }]}>{message}</Text>
    </View>
  );
};

// ── Form fields ─────────────────────────────────────────────────────────────

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  required?: boolean;
  icon?: string;
  error?: string | null;
  /** Password field with the eye toggle. */
  secure?: boolean;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const TextField = ({
  label,
  required,
  icon,
  error,
  secure,
  right,
  containerStyle,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) => {
  const { c, s } = useStyles();
  const { t } = useT();
  const scrollToFocused = useContext(FocusContext);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderColor = error ? c.danger : focused ? c.primary : c.border;

  return (
    <View style={[s.field, containerStyle]}>
      {label ? (
        <Text style={s.label}>
          {label}
          {required ? <Text style={{ color: c.danger }}> *</Text> : null}
        </Text>
      ) : null}
      {/*
        The style of this box must keep the same SHAPE whether the field is
        focused or not (only colour values change). Toggling extra props such
        as shadows on focus made React Native's New Architecture rebuild this
        native view and re-parent the TextInput, which detached it, dropped
        its focus and sent focus hopping to the next field in an endless loop.
        collapsable={false} also keeps it from being flattened away.
      */}
      <View collapsable={false} style={[s.inputBox, { borderColor, backgroundColor: c.input }]}>
        {icon ? (
          <FontAwesome5 name={icon} size={15} color={focused ? c.primary : c.placeholder} style={s.inputIcon} />
        ) : null}
        <TextInput
          {...inputProps}
          style={s.input}
          placeholderTextColor={c.placeholder}
          secureTextEntry={secure && !visible}
          autoCapitalize={secure ? 'none' : inputProps.autoCapitalize}
          autoCorrect={secure ? false : inputProps.autoCorrect}
          selectionColor={c.primary}
          onFocus={(e) => {
            setFocused(true);
            scrollToFocused?.(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setVisible((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={visible ? t('auth.common.hidePassword') : t('auth.common.showPassword')}
          >
            <FontAwesome5 name={visible ? 'eye-slash' : 'eye'} size={15} color={c.textSecondary} />
          </TouchableOpacity>
        ) : null}
        {right}
      </View>
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  );
};

export interface SelectOption {
  label: string;
  value: string;
  /** Shorter text shown in the closed field (e.g. "+237" for "+237  Cameroun"). */
  short?: string;
}

export const SelectField = ({
  label,
  required,
  icon,
  value,
  placeholder,
  options,
  onChange,
  error,
  containerStyle,
}: {
  label?: string;
  required?: boolean;
  icon?: string;
  value?: string;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}) => {
  const { c, s } = useStyles();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={[s.field, containerStyle]}>
      {label ? (
        <Text style={s.label}>
          {label}
          {required ? <Text style={{ color: c.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[s.inputBox, { borderColor: error ? c.danger : c.border, backgroundColor: c.input }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {icon ? <FontAwesome5 name={icon} size={15} color={c.placeholder} style={s.inputIcon} /> : null}
        <Text style={[s.selectText, { color: selected ? c.text : c.placeholder }]} numberOfLines={1}>
          {selected ? (selected.short ?? selected.label) : (placeholder ?? t('common.select'))}
        </Text>
        <FontAwesome5 name="chevron-down" size={12} color={c.textSecondary} />
      </TouchableOpacity>
      {error ? <Text style={s.fieldError}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setOpen(false)} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.sheetHandle} />
          {label ? <Text style={s.sheetTitle}>{label}</Text> : null}
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <TouchableOpacity
                  style={[s.sheetOption, active && { backgroundColor: c.primarySoft }]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[s.sheetOptionText, active && { color: c.primary }]}>{item.label}</Text>
                  {active ? <FontAwesome5 name="check" size={13} color={c.primary} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
};

// ── Step indicator ──────────────────────────────────────────────────────────

export const StepIndicator = ({ steps, current }: { steps: string[]; current: number }) => {
  const { c, s } = useStyles();
  const { t } = useT();
  return (
    <View
      style={s.steps}
      accessibilityLabel={t('auth.common.stepOf', { current: current + 1, total: steps.length, label: steps[current] })}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <View style={s.stepItem}>
              {done || active ? (
                <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.stepDot}>
                  {done ? (
                    <FontAwesome5 name="check" size={10} color="#FFFFFF" />
                  ) : (
                    <Text style={s.stepNumActive}>{i + 1}</Text>
                  )}
                </LinearGradient>
              ) : (
                <View style={[s.stepDot, { borderWidth: 1.5, borderColor: c.border, backgroundColor: c.background }]}>
                  <Text style={s.stepNum}>{i + 1}</Text>
                </View>
              )}
              <Text
                style={[s.stepLabel, (active || done) && { color: c.text }]}
                numberOfLines={label.includes(' ') ? 2 : 1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {label}
              </Text>
            </View>
            {i < steps.length - 1 ? (
              <View style={[s.stepLine, { backgroundColor: done ? c.primary : c.border }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ── Cards & chips ───────────────────────────────────────────────────────────

export const RoleCard = ({
  title,
  description,
  icon,
  color,
  soft,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  icon: string;
  color: string;
  soft: string;
  selected?: boolean;
  onPress: () => void;
}) => {
  const { c, s } = useStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.roleCard, { borderColor: selected ? c.primary : c.border }, selected && s.roleCardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${title}. ${description}`}
    >
      {selected ? (
        <View style={s.roleCheck}>
          <FontAwesome5 name="check-circle" size={16} color={c.primary} solid />
        </View>
      ) : null}
      <View style={[s.roleIcon, { backgroundColor: color }]}>
        <FontAwesome5 name={icon} size={20} color="#FFFFFF" solid />
      </View>
      <Text style={s.roleTitle}>{title}</Text>
      <Text style={s.roleDesc}>{description}</Text>
    </TouchableOpacity>
  );
};

export const Chip = ({ label, onRemove }: { label: string; onRemove?: () => void }) => {
  const { c, s } = useStyles();
  return (
    <View style={[s.chip, { backgroundColor: c.primarySoft }]}>
      <Text style={[s.chipText, { color: c.mode === 'dark' ? '#DDD6FE' : c.primary }]}>{label}</Text>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesome5 name="times" size={10} color={c.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

/** Radio row ("Classe" / "Code d'inscription"). */
export const RadioRow = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => {
  const { c, s } = useStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={s.radioRow}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <View style={[s.radio, { borderColor: selected ? c.primary : c.placeholder }]}>
        {selected ? <View style={[s.radioDot, { backgroundColor: c.primary }]} /> : null}
      </View>
      <Text style={s.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

export const Illustration = ({
  name,
  width,
  style,
}: {
  name: IllustrationName;
  width: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const c = useBrandColors();
  const dark = c.mode === 'dark';
  const raster = rasterIllustrations[name];
  return (
    <View style={[{ alignItems: 'center' }, style]}>
      {raster ? (
        <Image
          source={(dark && raster.dark) || raster.light}
          style={{ width, height: (width * raster.height) / raster.width }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <VectorIllustration name={name as VectorName} width={width} dark={dark} />
      )}
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    header: {
      height: 48,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    headerSideRight: { justifyContent: 'flex-end' },
    backBtn: { paddingVertical: 8, paddingRight: 12 },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 },
    contentCenter: { justifyContent: 'center' },
    footer: { paddingHorizontal: 24, paddingTop: 8 },

    titleWrap: { marginBottom: 20 },
    title: { ...ff('bold'), fontSize: 24, lineHeight: 32, color: c.text },
    subtitle: { ...ff('regular'), fontSize: 14, lineHeight: 21, color: c.textSecondary, marginTop: 6 },
    link: { ...ff('semibold'), fontSize: 14, lineHeight: 20 },
    promptRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
    promptText: { ...ff('regular'), fontSize: 14, lineHeight: 20, color: c.textSecondary },

    btn: { height: 52, borderRadius: 14 },
    btnShadow: {
      shadowColor: '#6D28D9',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: c.mode === 'dark' ? 0.35 : 0.25,
      shadowRadius: 12,
      elevation: 4,
    },
    btnFill: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    btnText: { ...ff('semibold'), fontSize: 16, lineHeight: 22 },

    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 16,
    },
    bannerIcon: { marginTop: 3, marginRight: 10 },
    bannerText: { ...ff('medium'), flex: 1, fontSize: 13, lineHeight: 19 },

    field: { marginBottom: 16 },
    label: { ...ff('medium'), fontSize: 14, lineHeight: 20, color: c.text, marginBottom: 8 },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      gap: 10,
    },
    inputIcon: { width: 18, textAlign: 'center' },
    input: { ...ff('regular'), flex: 1, minWidth: 0, fontSize: 15, color: c.text, paddingVertical: 12 },
    fieldError: { ...ff('regular'), fontSize: 12, lineHeight: 17, color: c.danger, marginTop: 6 },
    selectText: { ...ff('regular'), flex: 1, fontSize: 15 },

    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 12 },
    sheetTitle: { ...ff('semibold'), fontSize: 16, color: c.text, marginBottom: 8, paddingHorizontal: 8 },
    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    sheetOptionText: { ...ff('regular'), fontSize: 15, color: c.text },

    steps: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
    stepItem: { alignItems: 'center', width: 96 },
    stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    stepNum: { ...ff('semibold'), fontSize: 12, color: c.textSecondary },
    stepNumActive: { ...ff('semibold'), fontSize: 12, color: '#FFFFFF' },
    stepLabel: { ...ff('medium'), fontSize: 11, lineHeight: 14, color: c.textSecondary, marginTop: 6, textAlign: 'center' },
    stepLine: { flex: 1, height: 2, borderRadius: 1, marginTop: 12, marginHorizontal: -30 },


    roleCard: {
      flex: 1,
      minHeight: 168,
      borderWidth: 1.5,
      borderRadius: 18,
      backgroundColor: c.card,
      paddingHorizontal: 12,
      paddingVertical: 18,
      alignItems: 'center',
    },
    roleCardSelected: { backgroundColor: c.primarySoft },
    roleCheck: { position: 'absolute', top: 10, right: 10 },
    roleIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    roleTitle: { ...ff('semibold'), fontSize: 15, lineHeight: 21, color: c.text, textAlign: 'center' },
    roleDesc: { ...ff('regular'), fontSize: 12, lineHeight: 17, color: c.textSecondary, textAlign: 'center', marginTop: 4 },

    chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { ...ff('medium'), fontSize: 13 },

    radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: 10, height: 10, borderRadius: 5 },
    radioLabel: { ...ff('medium'), fontSize: 14, color: c.text },
  });
