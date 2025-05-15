import React, { useEffect } from 'react';
import { View, Text, Image, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { styles } from '../../styles/globalStyles';
const TeamMember = ({ name, role, image, icon, delay = 0 }) => {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true
        })
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, delay]);

  return (
    <Animated.View 
      style={[
        styles.teamMember,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <View style={styles.teamImageContainer}>
        <Image 
          source={{ uri: image }} 
          style={styles.teamImage} 
          resizeMode="cover"
        />
        <View style={styles.teamIconContainer}>
          <Icon name={icon} size={14} color="#FFFFFF" />
        </View>
      </View>
      <Text style={styles.teamName}>{name}</Text>
      <Text style={styles.teamRole}>{role}</Text>
    </Animated.View>
  );
};

export default TeamMember;