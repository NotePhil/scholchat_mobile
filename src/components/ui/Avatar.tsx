import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '../../styles/theme';

interface AvatarProps {
  name?: string;
  uri?: string;
  size?: number;
}

const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
};

const Avatar = ({ name, uri, size = 40 }: AvatarProps) => {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, dimensionStyle]} />;
  }

  return (
    <View style={[styles.fallback, dimensionStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.grayLight,
  },
  fallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  initials: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});

export default Avatar;
