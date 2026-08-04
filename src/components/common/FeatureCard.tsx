import React from 'react';
import { View, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { styles } from '../../styles/globalStyles';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  iconColor: string;
  backgroundColor: string;
  fullWidth?: boolean;
}

const FeatureCard = ({ title, description, icon, iconColor, backgroundColor, fullWidth }: FeatureCardProps) => {
  return (
    <View style={[styles.featureCard, fullWidth && { width: '100%' }]}>
      <View style={[styles.featureIcon, { backgroundColor }]}>
        <FontAwesome5 name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
};

export default FeatureCard;
