import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export type MenuItemKey = 'home' | 'about' | 'products' | 'faq';

interface MenuModalProps {
  isVisible: boolean;
  onClose: () => void;
  onMenuItemPress: (item: MenuItemKey) => void;
}

const MenuModal = ({ isVisible, onClose, onMenuItemPress }: MenuModalProps) => {
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

const styles = StyleSheet.create({
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#111827',
  },
});

export default MenuModal;
