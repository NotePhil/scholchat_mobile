import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { styles } from '../../styles/globalStyles';
import logo from '../../../assets/logo.png';
import enFlag from '../../../assets/en.jpeg';
import frFlag from '../../../assets/fr.jpeg';

const NavBar = ({ onLoginPress }) => {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('fr'); // Default to French

  const toggleLanguageDropdown = () => {
    setShowLanguageDropdown(!showLanguageDropdown);
  };

  const changeLanguage = (lang) => {
    setCurrentLanguage(lang);
    setShowLanguageDropdown(false);
    // You can add your language change logic here
  };

  return (
    <View style={styles.navBar}>
      <View style={styles.navBarContent}>
        <View style={styles.logoContainer}>
          <Image source={logo} style={styles.logo} />
        </View>
        <View style={navBarStyles.navButtonsContainer}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={onLoginPress}
          >
            <Text style={styles.loginButtonText}>Connexion / 
            Inscription</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={navBarStyles.languageButton}
            onPress={toggleLanguageDropdown}
          >
            <View style={navBarStyles.currentLanguageContainer}>
              <Image 
                source={currentLanguage === 'fr' ? frFlag : enFlag} 
                style={navBarStyles.languageFlag} 
              />
              <Text style={navBarStyles.currentLanguageText}>
                {currentLanguage === 'fr' ? 'FR' : 'EN'}
              </Text>
            </View>
            {showLanguageDropdown && (
              <View style={navBarStyles.languageDropdown}>
                <TouchableOpacity 
                  style={navBarStyles.languageOption}
                  onPress={() => changeLanguage('en')}
                >
                  <Image source={enFlag} style={navBarStyles.languageFlag} />
                  <Text style={navBarStyles.languageText}>English</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={navBarStyles.languageOption}
                  onPress={() => changeLanguage('fr')}
                >
                  <Image source={frFlag} style={navBarStyles.languageFlag} />
                  <Text style={navBarStyles.languageText}>Français</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const navBarStyles = StyleSheet.create({
  navButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, // Adds space between buttons
  },
  languageButton: {
    position: 'relative',
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  currentLanguageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageFlag: {
    width: 20,
    height: 14,
    borderRadius: 2,
    marginRight: 6,
  },
  currentLanguageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  languageDropdown: {
    position: 'absolute',
    top: 35,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
    minWidth: 120,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  languageText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
});

export default NavBar;