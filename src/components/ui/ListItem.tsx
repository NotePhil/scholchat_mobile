import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../styles/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}

const ListItem = ({ title, subtitle, leading, trailing, onPress, showChevron = !!onPress }: ListItemProps) => {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? (
        <FontAwesome5 name="chevron-right" size={14} color={colors.textMuted} style={styles.chevron} />
      ) : null}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leading: {
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});

export default ListItem;
