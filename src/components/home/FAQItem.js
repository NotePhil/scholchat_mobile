import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { styles } from '../../styles/globalStyles';

const FAQItem = ({ question, answer, isActive, onPress }) => {
  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={onPress}
      >
        <Text style={styles.faqQuestionText}>{question}</Text>
        <FontAwesome5
          name={isActive ? 'minus' : 'plus'}
          size={16}
          color="#4F46E5"
        />
      </TouchableOpacity>
      {isActive && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
};

export default FAQItem;