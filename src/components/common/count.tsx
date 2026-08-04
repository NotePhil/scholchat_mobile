import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, StyleProp, TextStyle } from 'react-native';

interface CountUpProps {
  to: number;
  duration: number;
  style?: StyleProp<TextStyle>;
}

const CountUp = ({ to, duration, style }: CountUpProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: to,
      duration: duration,
      useNativeDriver: true,
    }).start();
  }, [to, duration, animatedValue]);

  return (
    <Animated.Text style={[style, styles.text]}>
      {animatedValue.interpolate({
        inputRange: [0, to],
        outputRange: ['0', to.toString()],
      })}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default CountUp;
