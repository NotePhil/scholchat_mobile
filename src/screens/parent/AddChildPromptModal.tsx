import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BrandColors, ff, useBrandColors } from '../../components/brand';
import { useAuthStore } from '../../store/useAuthStore';
import { useSelectedChildStore } from '../../store/useSelectedChildStore';
import { parentService } from '../../services/api';
import { GradientButton, Illustration, TextLink } from '../auth/components/AuthKit';
import { useT } from '../../i18n';
import AddChildSheet from './AddChildSheet';

/** Sessions (access tokens) for which the parent tapped "Plus tard" — memory only. */
const dismissedSessions = new Set<string>();

interface AddChildPromptModalProps {
  /** Brings the parent to the "Mes enfants" tab (the created child shows up there). */
  onGoToChildren: () => void;
}

/**
 * "Ajoutez votre enfant" — shown to a parent landing on the dashboard while their account has no
 * child yet (typically the first connection right after choosing the password). The button opens
 * the existing child creation flow (AddChildSheet: POST /profil-eleves + link to the parent);
 * "Plus tard" hides it for this session. Never shown once a child exists.
 */
const AddChildPromptModal = ({ onGoToChildren }: AddChildPromptModalProps) => {
  const c = useBrandColors();
  const s = useMemo(() => createStyles(c), [c]);
  const { width } = useWindowDimensions();
  const { t } = useT();
  const user = useAuthStore((st) => st.user);
  const token = useAuthStore((st) => st.token);
  const parentId = user?.userId ? String(user.userId) : undefined;
  const { children, ownerId, loadChildren } = useSelectedChildStore();
  // Own check (GET /parents/{id}/enfants): only a successful empty answer shows the prompt — a
  // network error must not ask a parent who already has children to add one.
  const [noChildren, setNoChildren] = useState(false);

  const [dismissed, setDismissed] = useState(() => !!token && dismissedSessions.has(token));
  const [showSheet, setShowSheet] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!parentId) return;
    let cancelled = false;
    parentService
      .getChildren(parentId)
      .then((list) => {
        if (!cancelled) setNoChildren(Array.isArray(list) && list.length === 0);
      })
      .catch(() => {
        if (!cancelled) setNoChildren(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
  }, []);

  const hasChildren = ownerId === parentId && children.length > 0;
  const visible = !!parentId && noChildren && !hasChildren && !dismissed && !showSheet;

  const dismiss = () => {
    if (token) dismissedSessions.add(token);
    setDismissed(true);
  };

  const addChild = () => {
    dismiss();
    onGoToChildren();
    // Let the prompt's modal close before the sheet opens (two modals at once misbehave on iOS).
    openTimer.current = setTimeout(() => setShowSheet(true), 350);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
        <View style={s.overlay}>
          <View style={s.card}>
            <Illustration name="onboarding4" width={Math.min(width - 96, 280)} style={s.illustration} />
            <Text style={s.title} accessibilityRole="header">
              {t('auth.addChildPrompt.title')}
            </Text>
            <Text style={s.message}>{t('auth.addChildPrompt.message')}</Text>
            <GradientButton label={t('auth.addChildPrompt.add')} icon="child" onPress={addChild} style={s.cta} />
            <TextLink label={t('auth.addChildPrompt.later')} onPress={dismiss} muted style={s.later} />
          </View>
        </View>
      </Modal>
      <AddChildSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        onAdded={() => parentId && loadChildren(parentId)}
        parentId={parentId}
      />
    </>
  );
};

const createStyles = (c: BrandColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: c.card,
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 16,
      alignItems: 'stretch',
    },
    illustration: { marginBottom: 14 },
    title: { ...ff('bold'), fontSize: 21, lineHeight: 28, color: c.text, textAlign: 'center' },
    message: {
      ...ff('regular'),
      fontSize: 14,
      lineHeight: 21,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    cta: {},
    later: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  });

export default AddChildPromptModal;
