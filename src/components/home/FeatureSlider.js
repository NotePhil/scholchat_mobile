import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { styles } from '../../styles/globalStyles';

const FeatureSlider = ({ features }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.featureSlider}>
      {features.map((feature, index) => (
        <View
          key={feature.id}
          style={[
            styles.featureSlide,
            { opacity: index === currentIndex ? 1 : 0 }
          ]}
        >
          <View style={styles.sliderIcon}>
            <FontAwesome5 name={feature.icon} size={32} color="#4F46E5" />
          </View>
          <Text style={styles.sliderTitle}>{feature.title}</Text>
          <Text style={styles.sliderDescription}>{feature.description}</Text>
        </View>
      ))}
      <View style={styles.sliderDots}>
        {features.map((_, index) => (
          <View
            key={index}
            style={[
              styles.sliderDot,
              { backgroundColor: index === currentIndex ? '#4F46E5' : '#E5E7EB' }
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default FeatureSlider;