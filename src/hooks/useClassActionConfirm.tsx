import React, { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { TFunction, translate, useT } from '../i18n';

export type ClassConfirmAction = 'approve' | 'reject' | 'delete';

/**
 * Wording for the class moderation confirmations (approve / reject / delete).
 * Mirrors scholchat_front/src/utils/classActionConfirm.jsx word for word.
 */
export const getClassActionTexts = (action: ClassConfirmAction, className?: string | null, t: TFunction = translate) => {
  const target = className ? t('classConfirm.targetNamed', { name: className }) : t('classConfirm.targetUnnamed');
  switch (action) {
    case 'approve':
      return {
        title: t('classConfirm.approveTitle'),
        message: t('classConfirm.approveMessage', { target }),
        warning: undefined as string | undefined,
        success: t('classConfirm.approveSuccess'),
        error: t('classConfirm.approveError'),
        destructive: false,
      };
    case 'reject':
      return {
        title: t('classConfirm.rejectTitle'),
        message: t('classConfirm.rejectMessage', { target }),
        warning: undefined as string | undefined,
        success: t('classConfirm.rejectSuccess'),
        error: t('classConfirm.rejectError'),
        destructive: true,
      };
    case 'delete':
    default:
      return {
        title: t('classConfirm.deleteTitle'),
        message: t('classConfirm.deleteMessage', { target }),
        warning: t('classConfirm.irreversible') as string | undefined,
        success: t('classConfirm.deleteSuccess'),
        error: t('classConfirm.deleteError'),
        destructive: true,
      };
  }
};

interface PendingAction {
  action: ClassConfirmAction;
  className?: string | null;
  run: () => Promise<unknown>;
}

/**
 * `const { askConfirm, confirmDialog } = useClassActionConfirm();`
 * then `askConfirm('approve', cls.nom, () => classAdminService.approve(cls.id).then(load))`
 * and render `{confirmDialog}`. The dialog stays open with a spinner on
 * "Confirmer" while `run` is pending (double taps ignored), then shows a
 * success or error Alert.
 */
export const useClassActionConfirm = () => {
  const { t } = useT();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const askConfirm = useCallback(
    (action: ClassConfirmAction, className: string | null | undefined, run: () => Promise<unknown>) => {
      if (busyRef.current) return;
      setPending({ action, className, run });
    },
    []
  );

  const handleConfirm = async () => {
    if (!pending || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const texts = getClassActionTexts(pending.action, pending.className, t);
    try {
      await pending.run();
      setPending(null);
      Alert.alert(t('classConfirm.successTitle'), texts.success);
    } catch (err) {
      setPending(null);
      Alert.alert(t('common.error'), err instanceof Error && err.message ? err.message : texts.error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const texts = pending ? getClassActionTexts(pending.action, pending.className, t) : null;
  const confirmDialog = (
    <ConfirmDialog
      visible={!!pending}
      title={texts?.title ?? ''}
      message={texts?.message ?? ''}
      warning={texts?.warning}
      destructive={texts?.destructive}
      loading={busy}
      onConfirm={handleConfirm}
      onCancel={() => setPending(null)}
    />
  );

  return { askConfirm, confirmDialog, busy };
};
