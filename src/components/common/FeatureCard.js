import React from 'react';
import { View, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons'; // Ensure you're using the correct icon set
import { styles } from '../../styles/globalStyles';

const FeatureCard = ({ title, description, icon, iconColor, backgroundColor, fullWidth }) => {
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
