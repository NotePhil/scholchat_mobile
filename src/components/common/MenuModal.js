import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { styles } from '../../styles/globalStyles';

const MenuModal = ({ isVisible, onClose, onMenuItemPress }) => {
  if (!isVisible) return null;

  return (
    <TouchableOpacity
      style={styles.menuOverlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onMenuItemPress('home')}
        >
          <Text style={styles.menuItemText}>Accueil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onMenuItemPress('about')}
        >
          <Text style={styles.menuItemText}>À propos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onMenuItemPress('products')}
        >
          <Text style={styles.menuItemText}>Nos produits</Text>
          <FontAwesome5 name="chevron-down" size={14} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onMenuItemPress('faq')}
        >
          <Text style={styles.menuItemText}>FAQ</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default MenuModal;