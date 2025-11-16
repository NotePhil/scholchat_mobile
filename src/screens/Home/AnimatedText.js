import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';

const AnimatedText = ({ texts, interval = 2000, typingSpeed = 150, deletingSpeed = 75 }) => {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  // Blinking cursor animation
  useEffect(() => {
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    blinkAnimation.start();
    return () => blinkAnimation.stop();
  }, []);

  // Typing/deleting animation
  useEffect(() => {
    const currentText = texts[index];

    const type = () => {
      if (isDeleting) {
        // Deleting text
        setDisplayText(prev => {
          const newText = prev.substring(0, prev.length - 1);
          if (newText.length === 0) {
            setIsDeleting(false);
            setIndex(prevIndex => (prevIndex + 1) % texts.length);
          } else {
            timerRef.current = setTimeout(type, deletingSpeed);
          }
          return newText;
        });
      } else {
        // Typing text
        setDisplayText(prev => {
          const newText = currentText.substring(0, prev.length + 1);
          if (newText.length === currentText.length) {
            timerRef.current = setTimeout(() => setIsDeleting(true), interval);
          } else {
            timerRef.current = setTimeout(type, typingSpeed);
          }
          return newText;
        });
      }
    };

    timerRef.current = setTimeout(type, isDeleting ? deletingSpeed : typingSpeed);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [index, isDeleting, texts, interval, typingSpeed, deletingSpeed]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {displayText}
        <Animated.View style={[styles.cursor, { opacity: animatedValue }]} />
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  text: {
    fontSize: 18,
    color: 'white',
    textAlign: 'left',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  cursor: {
    width: 2,
    height: 13,
    backgroundColor: 'white',
    marginLeft: 2,
  },
});

export default AnimatedText;