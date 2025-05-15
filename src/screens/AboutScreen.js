import React, { useEffect } from 'react';
import { ScrollView, View, Text, Image, Animated, Easing } from 'react-native';
import NavBar from '../components/common/NavBar';
import TeamMember from '../components/common/TeamMember';
import { styles } from '../styles/globalStyles'; // Ensure this path is correct
import Icon from 'react-native-vector-icons/MaterialIcons';
import aboutImage from '../../assets/about.png'; // Add this import
const AboutScreen = ({ navigation, onLoginPress }) => {
  const fadeAnim = new Animated.Value(0);
  const slideUpAnim = new Animated.Value(30);
  const teamMembers = [
    {
      id: 1,
      name: 'Sophie Martin',
      role: 'Directrice Pédagogique',
      image: 'https://readdy.ai/api/search-image?query=Professional%20headshot%20of%20a%20female%20education%20technology%20expert%20with%20glasses%2C%20neutral%20background%2C%20professional%20attire%2C%20friendly%20smile%2C%20high%20quality%20portrait%2C%20clean%20lighting&width=80&height=80&seq=3&orientation=squarish',
      icon: 'school'
    },
    {
      id: 2,
      name: 'Thomas Dubois',
      role: 'Directeur Technique',
      image: 'https://readdy.ai/api/search-image?query=Professional%20headshot%20of%20a%20male%20software%20developer%2C%20neutral%20background%2C%20casual%20professional%20attire%2C%20confident%20expression%2C%20high%20quality%20portrait%2C%20clean%20lighting&width=80&height=80&seq=4&orientation=squarish',
      icon: 'code'
    },
    {
      id: 3,
      name: 'Camille Bernard',
      role: 'Designer UX',
      image: 'https://readdy.ai/api/search-image?query=Professional%20headshot%20of%20a%20female%20UX%20designer%2C%20neutral%20background%2C%20creative%20professional%20attire%2C%20warm%20smile%2C%20high%20quality%20portrait%2C%20clean%20lighting&width=80&height=80&seq=5&orientation=squarish',
      icon: 'design-services'
    },
    {
      id: 4,
      name: 'Nicolas Petit',
      role: 'Responsable Marketing',
      image: 'https://readdy.ai/api/search-image?query=Professional%20headshot%20of%20a%20male%20marketing%20specialist%2C%20neutral%20background%2C%20business%20casual%20attire%2C%20approachable%20expression%2C%20high%20quality%20portrait%2C%20clean%20lighting&width=80&height=80&seq=6&orientation=squarish',
      icon: 'campaign'
    }
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(
        fadeAnim,
        {
          toValue: 1,
          duration: 800,
          useNativeDriver: true
        }
      ),
      Animated.timing(
        slideUpAnim,
        {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        }
      )
    ]).start();
  }, [fadeAnim, slideUpAnim]);

  return (
    <View style={styles.container}>
    <NavBar onLoginPress={onLoginPress} />
      <ScrollView style={styles.container}>
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }]
            }
          ]}
        >
              <Image 
            source={aboutImage} 
            style={styles.aboutImage}
            resizeMode="cover"
          />
          <View style={styles.headerContainer}>
            <Text style={styles.pageTitle}>À Propos de Nous</Text>
            <Icon name="info" size={28} color="#4F46E5" style={styles.titleIcon} />
          </View>

          <Animated.View
            style={[
              styles.card,
              styles.missionCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideUpAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30],
                  extrapolate: 'clamp'
                })}]
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <Icon name="flag" size={24} color="#4F46E5" style={styles.cardIcon} />
              <Text style={styles.cardTitle}>Notre Mission</Text>
            </View>
            <Text style={styles.cardText}>
              Chez SchoolChat, notre mission est de transformer l'expérience éducative en fournissant des outils numériques innovants qui facilitent l'organisation, la communication et le suivi des progrès académiques.
            </Text>
            <Text style={styles.cardText}>
              Nous croyons que chaque étudiant mérite un accompagnement personnalisé pour atteindre son plein potentiel, et c'est pourquoi nous avons développé cette application complète qui répond aux besoins réels des étudiants d'aujourd'hui.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              styles.historyCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideUpAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30],
                  extrapolate: 'clamp'
                })}],
                marginTop: 20
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <Icon name="history" size={24} color="#4F46E5" style={styles.cardIcon} />
              <Text style={styles.cardTitle}>Notre Histoire</Text>
            </View>
            <Text style={styles.cardText}>
              Fondée en 2020 par un groupe d'anciens enseignants et de développeurs passionnés par l'éducation, notre entreprise a commencé comme une startup avec une vision claire : révolutionner la façon dont les étudiants gèrent leur parcours académique.
            </Text>
            <Text style={styles.cardText}>
              Après des années de recherche et de développement en collaboration étroite avec des établissements scolaires, nous avons lancé SchoolChat, une solution qui ne cesse d'évoluer grâce aux retours de notre communauté d'utilisateurs.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              styles.teamCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideUpAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30],
                  extrapolate: 'clamp'
                })}],
                marginTop: 20
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <Icon name="groups" size={24} color="#4F46E5" style={styles.cardIcon} />
              <Text style={styles.cardTitle}>Notre Équipe</Text>
            </View>
            <View style={styles.teamGrid}>
              {teamMembers.map((member, index) => (
                <TeamMember
                  key={member.id}
                  name={member.name}
                  role={member.role}
                  image={member.image}
                  icon={member.icon}
                  delay={index * 100}
                />
              ))}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              styles.valuesCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideUpAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30],
                  extrapolate: 'clamp'
                })}],
                marginTop: 20,
                marginBottom: 30
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <Icon name="star" size={24} color="#4F46E5" style={styles.cardIcon} />
              <Text style={styles.cardTitle}>Nos Valeurs</Text>
            </View>
            <View style={styles.valuesContainer}>
              <View style={styles.valueItem}>
                <Icon name="lightbulb" size={20} color="#4F46E5" />
                <Text style={styles.valueText}>Innovation</Text>
              </View>
              <View style={styles.valueItem}>
                <Icon name="handshake" size={20} color="#4F46E5" />
                <Text style={styles.valueText}>Collaboration</Text>
              </View>
              <View style={styles.valueItem}>
                <Icon name="school" size={20} color="#4F46E5" />
                <Text style={styles.valueText}>Excellence</Text>
              </View>
              <View style={styles.valueItem}>
                <Icon name="accessibility" size={20} color="#4F46E5" />
                <Text style={styles.valueText}>Accessibilité</Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

export default AboutScreen;
