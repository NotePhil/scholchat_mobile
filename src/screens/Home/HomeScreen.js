import React from "react";
import { ScrollView, View, Text, Image, TouchableOpacity } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import NavBar from "../../components/common/NavBar";
import FeatureSlider from "../../components/home/FeatureSlider";
import FeatureCard from "../../components/common/FeatureCard";
import AnimatedText from "./AnimatedText";
import { styles } from "../../styles/globalStyles";

// Import the images from the assets folder
import homeimg1 from "../../../assets/homeimg1.jpg";
import homeimg2 from "../../../assets/homeimg2.jpg";

const HomeScreen = ({ navigation, onLoginPress, onNavigateToDashboard }) => {
  const features = [
    {
      id: 1,
      title: "Cahier de texte",
      description:
        "Organisez et accédez facilement aux notes de cours et au contenu de chaque sujet.",
      icon: "book",
      color: "#EFF6FF",
      iconColor: "#3B82F6",
    },
    {
      id: 2,
      title: "Messagerie",
      description:
        "Communiquez facilement avec les enseignants et les autres élèves.",
      icon: "comments",
      color: "#ECFDF5",
      iconColor: "#10B981",
    },
    {
      id: 3,
      title: "Devoirs",
      description:
        "Suivez les devoirs assignés et gérez les dates de rendu efficacement.",
      icon: "tasks",
      color: "#F5F3FF",
      iconColor: "#8B5CF6",
    },
    {
      id: 4,
      title: "Suivi des absences",
      description:
        "Gardez un enregistrement des absences et suivez les retards.",
      icon: "calendar-check",
      color: "#FEE2E2",
      iconColor: "#EF4444",
    },
    {
      id: 5,
      title: "Objectifs scolaires",
      description:
        "Définissez et suivez les objectifs scolaires de manière structurée.",
      icon: "bullseye",
      color: "#FFEDD5",
      iconColor: "#F97316",
    },
  ];

  const sliderFeatures = [
    {
      id: 1,
      title: "Soutien psychologique",
      description: "Un accompagnement personnalisé",
      icon: "brain",
    },
    {
      id: 2,
      title: "Orientation académique",
      description: "Conseils pour choisir votre parcours",
      icon: "graduation-cap",
    },
    {
      id: 3,
      title: "Tutorat en ligne",
      description: "Des cours particuliers à la demande",
      icon: "chalkboard-teacher",
    },
  ];

  const handleSignUp = (formData) => {
    console.log("Signing up with:", formData);
    setShowAuth(false);
    if (onNavigateToDashboard) {
      onNavigateToDashboard();
    }
  };

  return (
    <View style={styles.container}>
      <NavBar onLoginPress={onLoginPress} />
      <ScrollView style={styles.container}>
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Image source={homeimg1} style={styles.heroImage} />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>SchoolChat</Text>
            <View style={{ minHeight: 24 }}>
              <Text style={{ color: "white" }}>
                <AnimatedText
                  texts={[
                    "Un lien direct pour mieux accompagner vos enfants",
                    "Simplifier les échanges pour la réussite de vos enfants",
                    "La réussite scolaire commence par une bonne communication",
                  ]}
                  interval={3000}
                  typingSpeed={150}
                  deletingSpeed={75}
                />
              </Text>
            </View>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nos Fonctionnalités</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                iconColor={feature.iconColor}
                backgroundColor={feature.color}
                fullWidth={index === features.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Feature Slider */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pourquoi Notre SchoolChat Est Exceptionnel
          </Text>
          <FeatureSlider features={sliderFeatures} />
        </View>

        {/* Goals Section */}
        <View style={[styles.section, { backgroundColor: "#F9FAFB" }]}>
          <View style={styles.goalContainer}>
            <Image source={homeimg2} style={styles.goalImage} />
            <View style={styles.goalTextContainer}>
              <Text style={styles.goalTitle}>
                Atteignez Vos Objectifs Avec Notre Guide
              </Text>
              <Text style={styles.goalDescription}>
                Notre plateforme de guidage étudiant est conçue pour vous
                accompagner tout au long de votre parcours académique. Que vous
                ayez besoin d'aide pour choisir votre orientation, gérer votre
                stress, ou améliorer vos méthodes d'apprentissage, nous sommes
                là pour vous.
              </Text>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.buttonText}>
                  Développez vos compétences
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Qu'est-ce que SchoolChat?</Text>
          <Text style={styles.cardText}>
            SchoolChat est une plateforme complète conçue pour faciliter
            l'organisation, la communication et le suivi scolaire. Avec des
            outils intuitifs et des fonctionnalités adaptées, nous accompagnons
            les étudiants vers la réussite.
          </Text>
          <View style={styles.featuresGrid}>
            <View
              style={[
                styles.featureCard,
                { width: "100%", flexDirection: "row" },
              ]}
            >
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: "#EFF6FF", marginRight: 16 },
                ]}
              >
                <FontAwesome5 name="laptop" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.featureTitle}>Apprentissage en Ligne</Text>
                <Text style={styles.featureDescription}>
                  Commencez un cours aujourd'hui
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.featureCard,
                { width: "100%", flexDirection: "row", marginTop: 12 },
              ]}
            >
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: "#ECFDF5", marginRight: 16 },
                ]}
              >
                <FontAwesome5
                  name="chalkboard-teacher"
                  size={20}
                  color="#10B981"
                />
              </View>
              <View>
                <Text style={styles.featureTitle}>Devenez Instructeur</Text>
                <Text style={styles.featureDescription}>
                  Commencez un cours aujourd'hui
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: "#4F46E5", paddingVertical: 32 },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: "#FFFFFF", marginBottom: 16 },
            ]}
          >
            Nous Sommes Fiers
          </Text>
          <Text
            style={[
              styles.cardText,
              { color: "#E0E7FF", textAlign: "center", marginBottom: 24 },
            ]}
          >
            Vous n'êtes pas seul dans votre parcours, nous sommes là pour vous
            accompagner.
          </Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <FontAwesome5
                name="user-graduate"
                size={24}
                color="#FFFFFF"
                style={styles.statIcon}
              />
              <Text style={styles.statNumber}>63</Text>
              <Text style={styles.statLabel}>Étudiants Inscrits</Text>
            </View>
            <View style={styles.statItem}>
              <FontAwesome5
                name="book"
                size={24}
                color="#FFFFFF"
                style={styles.statIcon}
              />
              <Text style={styles.statNumber}>20</Text>
              <Text style={styles.statLabel}>Cours Disponibles</Text>
            </View>
            <View style={styles.statItem}>
              <FontAwesome5
                name="laptop"
                size={24}
                color="#FFFFFF"
                style={styles.statIcon}
              />
              <Text style={styles.statNumber}>4</Text>
              <Text style={styles.statLabel}>Apprenants en Ligne</Text>
            </View>
          </View>
        </View>

        {/* Download App Section */}
        <View style={[styles.section, { backgroundColor: "#F3F4F6" }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
            Restez Connecté avec Votre Communauté Scolaire !
          </Text>
          <Text
            style={[styles.cardText, { textAlign: "center", marginBottom: 16 }]}
          >
            Téléchargez l'application ScholChat pour rejoindre les discussions,
            accéder aux ressources, et rester informé des actualités scolaires.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { alignSelf: "center" }]}
          >
            <Text style={styles.buttonText}>Télécharger l'application</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: "#1F2937", paddingVertical: 32 },
          ]}
        >
          {/* Logo and Description */}
          <View style={styles.footerSection}>
            <View style={styles.footerLogoContainer}>
              <Image
                source={require("../../../assets/logo.png")}
                style={styles.footerLogo}
              />
              <Text style={styles.footerLogoText}>ScholChat</Text>
            </View>
            <Text style={styles.footerText}>
              ScholChat réunit les étudiants, enseignants, et parents dans une
              application sécurisée, facilitant la communication et l'engagement
              scolaire.
            </Text>
          </View>

          {/* Contact Section */}
          <View style={styles.footerSection}>
            <Text style={styles.footerTitle}>Contact</Text>
            <Text style={styles.footerText}>
              Vous avez des questions ou besoin de support ? Notre équipe est là
              pour vous aider.
            </Text>
            <View style={styles.footerLinkContainer}>
              <TouchableOpacity style={styles.footerLink}>
                <Text style={styles.footerLinkText}>Nous Contacter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerLink}>
                <Text style={styles.footerLinkText}>Mentions Légales</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Legal Section */}
          <View style={styles.footerSection}>
            <Text style={styles.footerTitle}>Politique de Confidentialité</Text>
            <Text style={styles.footerText}>
              ScholChat respecte votre vie privée et garantit un environnement
              en ligne sécurisé.
            </Text>
            <View style={styles.footerLinkContainer}>
              <TouchableOpacity style={styles.footerLink}>
                <Text style={styles.footerLinkText}>
                  Politique de Confidentialité
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerLink}>
                <Text style={styles.footerLinkText}>Conditions Générales</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Social Media Section */}
          <View style={styles.footerSection}>
            <Text style={styles.footerTitle}>Suivez-nous</Text>
            <Text style={styles.footerText}>
              Suivez-nous sur les réseaux sociaux pour rester informé des
              dernières actualités.
            </Text>
            <View style={styles.socialIcons}>
              <TouchableOpacity style={styles.socialIcon}>
                <FontAwesome5 name="facebook" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialIcon}>
                <FontAwesome5 name="twitter" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialIcon}>
                <FontAwesome5 name="instagram" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialIcon}>
                <FontAwesome5 name="linkedin" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
