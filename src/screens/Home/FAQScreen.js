import React, { useState } from 'react';
import { ScrollView, View, Text,Image, TextInput } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import NavBar from '../../components/common/NavBar';
import FAQItem from '../../components/home/FAQItem';
import { styles } from '../../styles/globalStyles';
import faq from '../../../assets/faq.png'; 
const FAQScreen = ({ navigation, onLoginPress }) => {
  const [activeFaqItem, setActiveFaqItem] = useState(null);

  const faqItems = [
    {
      question: "Comment puis-je accéder à mon cahier de texte?",
      answer: "Vous pouvez accéder à votre cahier de texte en vous connectant à votre compte et en cliquant sur l'onglet 'Cahier de texte' dans le menu principal. Toutes vos notes et contenus de cours y seront organisés par matière."
    },
    {
      question: "Comment contacter un enseignant via la messagerie?",
      answer: "Pour contacter un enseignant, rendez-vous dans la section 'Messagerie', sélectionnez 'Nouveau message', choisissez l'enseignant dans la liste des contacts et rédigez votre message. Vous recevrez une notification lorsqu'il vous répondra."
    },
    {
      question: "Comment suivre mes absences et retards?",
      answer: "La section 'Suivi des absences' vous permet de visualiser toutes vos absences et retards. Vous pouvez filtrer par période ou par matière, et même recevoir des alertes si vous approchez d'un seuil critique d'absences."
    },
    {
      question: "Comment définir des objectifs scolaires?",
      answer: "Dans la section 'Objectifs scolaires', cliquez sur 'Ajouter un objectif', définissez votre but, la date d'échéance et les étapes intermédiaires. L'application vous aidera à suivre votre progression et vous enverra des rappels."
    },
    {
      question: "Est-ce que l'application fonctionne hors ligne?",
      answer: "Oui, certaines fonctionnalités comme le cahier de texte et les devoirs sont disponibles hors ligne. Vos données seront synchronisées automatiquement lorsque vous vous reconnecterez à Internet."
    }
  ];

  const toggleFaqItem = (index) => {
    if (activeFaqItem === index) {
      setActiveFaqItem(null);
    } else {
      setActiveFaqItem(index);
    }
  };

  return (
    <View style={styles.container}>
    <NavBar onLoginPress={onLoginPress} />
      <ScrollView style={styles.container}>
        <View style={styles.section}>
               <Image 
                          source={faq} 
                          style={styles.faqImage}
                          resizeMode="cover"
                        />
          <Text style={styles.pageTitle}>Foire Aux Questions</Text>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <FontAwesome5 name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                placeholder="Rechercher une question..."
                style={styles.searchInput}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.faqContainer}>
            {faqItems.map((item, index) => (
              <FAQItem
                key={index}
                question={item.question}
                answer={item.answer}
                isActive={activeFaqItem === index}
                onPress={() => toggleFaqItem(index)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default FAQScreen;