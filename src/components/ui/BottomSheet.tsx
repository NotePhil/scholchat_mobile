import React, { ReactNode } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../styles/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Mobile-native replacement for the web app's centered dialog modals
 * (ProfessorModal, StudentModal, ParentModal, etc.) — slides up from the
 * bottom instead of overlaying a desktop-style dialog box.
 */
const BottomSheet = ({ visible, onClose, title, children }: BottomSheetProps) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.grayLight,
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
});

export default BottomSheet;
