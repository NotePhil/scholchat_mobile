import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles as globalStyles } from '../../styles/globalStyles';
import logo from '../../../assets/logo.png';
import enFlag from '../../../assets/en.jpeg';
import frFlag from '../../../assets/fr.jpeg';

const NavBar = ({ onLoginPress }) => {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('fr');
  const [languageButtonLayout, setLanguageButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const insets = useSafeAreaInsets();

  const toggleLanguageDropdown = () => {
    setShowLanguageDropdown(!showLanguageDropdown);
  };

  const changeLanguage = (lang) => {
    setCurrentLanguage(lang);
    setShowLanguageDropdown(false);
  };

  const onLanguageButtonLayout = (event) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setLanguageButtonLayout({ x, y, width, height });
  };

  return (
    <>
      <View style={[globalStyles.navBar, { paddingTop: insets.top }]}>
        <View style={globalStyles.navBarContent}>
          <View style={globalStyles.logoContainer}>
            <Image source={logo} style={[globalStyles.logo, { width: 50, height: 50 }]} />
          </View>
          <View style={navBarStyles.navButtonsContainer}>
            <TouchableOpacity
              style={globalStyles.loginButton}
              onPress={onLoginPress}
            >
              <Text style={globalStyles.loginButtonText}>Connexion / Inscription</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={navBarStyles.languageButton}
              onPress={toggleLanguageDropdown}
              onLayout={onLanguageButtonLayout}
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
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <Modal
        transparent={true}
        visible={showLanguageDropdown}
        onRequestClose={() => setShowLanguageDropdown(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLanguageDropdown(false)}>
          <View style={navBarStyles.modalOverlay}>
            <View style={[
              navBarStyles.languageDropdown,
              {
                position: 'absolute',
                top: insets.top + 60, // Adjust based on your navbar height
                right: 20,
              }
            ]}>
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
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const navBarStyles = StyleSheet.create({
  navButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageButton: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  languageDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
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