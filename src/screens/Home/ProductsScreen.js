import React from 'react';
import { ScrollView, View, Text,Image, TouchableOpacity } from 'react-native';
import NavBar from '../../components/common/NavBar';
import { styles } from '../../styles/globalStyles';
import products from '../../../assets/produit.png'; 
const ProductsScreen = ({navigation, onLoginPress }) => {
  return (
    <View style={styles.container}>
 <NavBar onLoginPress={onLoginPress} />
      <ScrollView style={styles.container}>
          
        <View style={styles.section}>
        <Image 
                  source={products} 
                  style={styles.productsImage}
                  resizeMode="cover"
                />
          <Text style={styles.pageTitle}>Nos Produits</Text>
          
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Guide Lycéen</Text>
            <Text style={styles.cardText}>
              Une solution complète pour les lycéens avec des fonctionnalités adaptées à leur parcours scolaire, incluant le suivi des notes, l'orientation post-bac, et la préparation aux examens.
            </Text>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>En savoir plus</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Guide Universitaire</Text>
            <Text style={styles.cardText}>
              Un accompagnement personnalisé pour les étudiants universitaires avec gestion des cours, planning des partiels, recherche de stages et préparation à la vie professionnelle.
            </Text>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>En savoir plus</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Guide Professionnel</Text>
            <Text style={styles.cardText}>
              Pour les jeunes professionnels, des outils de gestion de carrière, développement des compétences, et réseautage avec d'autres professionnels du même domaine.
            </Text>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>En savoir plus</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default ProductsScreen;