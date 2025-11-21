import React, { useState, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Animated,
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ClassCard from "./ClassCard";
import AccessRequestModal from "./AccessRequestModal";
import ClassDetails from "./ClassDetails";
import { classService } from "../../../../services/classService";
import { useUser } from "../../../../context/UserContext";

const DashboardClassesBody = () => {
  const { user } = useUser();
  const [activeFilter, setActiveFilter] = useState("toutes");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentView, setCurrentView] = useState("list"); // 'list', 'details', 'create'
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState("info");

  // Load classes on component mount
  React.useEffect(() => {
    if (user?.userId) {
      loadClasses();
    }
  }, [user?.userId]);

  // Create Class Modal State
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [className, setClassName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] = useState(null);
  const [selectedModerator, setSelectedModerator] = useState(null);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showEstablishmentDropdown, setShowEstablishmentDropdown] = useState(false);
  const [showModeratorDropdown, setShowModeratorDropdown] = useState(false);
  const [etablissements, setEtablissements] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Animation values
  const loadingAnimation = useRef(new Animated.Value(0)).current;
  const successAnimation = useRef(new Animated.Value(0)).current;

  const levels = [
    "MATERNELLE",
    "PRIMAIRE", 
    "COLLEGE",
    "LYCEE",
    "UNIVERSITE"
  ];

  const [classes, setClasses] = useState([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

  const filters = [
    { id: "toutes", label: "Toutes" },
    { id: "actives", label: "Actives" },
    { id: "inactives", label: "Inactives" },
    { id: "mes-classes", label: "Mes Classes" },
  ];

  const getStateColor = (state) => {
    return state === "ACTIVE" ? "#10B981" : "#6B7280";
  };

  const getStateBackground = (state) => {
    return state === "ACTIVE" ? "#D1FAE5" : "#F3F4F6";
  };

  const getStateText = (state) => {
    return state === "ACTIVE" ? "Active" : "Inactive";
  };

  const handleRequestAccess = () => {
    setShowAccessModal(true);
  };

  const handleCancelRequest = () => {
    setShowAccessModal(false);
    setTokenValue("");
    setIsLoading(false);
    setShowSuccess(false);
  };

  const handleValidateToken = () => {
    if (!tokenValue.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un token valide");
      return;
    }
    setIsLoading(true);
    // Start loading animation
    Animated.loop(
      Animated.timing(loadingAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccess(true);
      // Start success animation
      Animated.sequence([
        Animated.timing(successAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(successAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowAccessModal(false);
        setTokenValue("");
        setShowSuccess(false);
        loadingAnimation.setValue(0);
        successAnimation.setValue(0);
      });
    }, 3000);
  };

  const handleViewDetails = (classItem) => {
    console.log('=== LOADING CLASS DETAILS FOR VIEW ===');
    console.log('Class item:', classItem);
    
    const cachedData = classesCache.get(classItem.id);
    if (cachedData) {
      const enhancedClass = {
        ...classItem,
        studentsCount: cachedData.students.length,
        parentsCount: cachedData.parents.length,
        othersCount: cachedData.others.length,
        students: cachedData.students,
        parents: cachedData.parents,
        others: cachedData.others,
        accessRequests: cachedData.accessRequests,
        etablissementDetails: cachedData.etablissementDetails,
        moderatorDetails: cachedData.moderatorDetails,
      };
      
      setSelectedClass(enhancedClass);
      setCurrentView("details");
    } else {
      Alert.alert('Erreur', 'Données de classe non disponibles');
    }
  };

  const handleManageClass = async (classItem) => {
    console.log('=== LOADING CLASS DETAILS FOR MANAGE ===');
    console.log('Class item:', classItem);
    
    const cachedData = classesCache.get(classItem.id);
    if (cachedData) {
      const enhancedClass = {
        ...classItem,
        studentsCount: cachedData.students.length,
        parentsCount: cachedData.parents.length,
        othersCount: cachedData.others.length,
        students: cachedData.students,
        parents: cachedData.parents,
        others: cachedData.others,
        accessRequests: cachedData.accessRequests,
        etablissementDetails: cachedData.etablissementDetails,
        moderatorDetails: cachedData.moderatorDetails,
      };
      
      setSelectedClass(enhancedClass);
      setCurrentView("details");
      setActiveDetailTab("manage");
    } else {
      // Fallback to API call if cache is missing
      try {
        const [classDetails, accessRequests, classUsers] = await Promise.all([
          classService.getClassDetails(classItem.id),
          classService.getClassAccessRequests(classItem.id),
          classService.getClassUsers(classItem.id)
        ]);
        
        const students = classUsers.filter(user => user.type === 'eleve');
        const parents = classUsers.filter(user => user.type === 'utilisateur' && !user.admin);
        const others = classUsers.filter(user => user.type !== 'eleve' && (user.type !== 'utilisateur' || user.admin));
        
        const formattedStudents = students.map(student => ({
          id: student.id,
          name: `${student.prenom || ''} ${student.nom || ''}`.trim(),
          email: student.email || student.telephone || 'Non spécifié',
          niveau: student.niveau || 'Non spécifié'
        }));
        
        const formattedParents = parents.map(parent => ({
          id: parent.id,
          name: `${parent.prenom || ''} ${parent.nom || ''}`.trim(),
          phone: parent.telephone || parent.email || 'Non spécifié'
        }));
        
        const formattedAccessRequests = (accessRequests || []).map(request => ({
          id: request.id,
          name: `${request.utilisateurPrenom || ''} ${request.utilisateurNom || ''}`.trim(),
          role: 'Utilisateur',
          date: new Date(request.dateDemande).toLocaleDateString('fr-FR'),
          status: request.etat || 'EN_ATTENTE'
        }));
        
        const enhancedClass = {
          ...classItem,
          studentsCount: students.length,
          parentsCount: parents.length,
          othersCount: others.length,
          students: formattedStudents,
          parents: formattedParents,
          others: others,
          accessRequests: formattedAccessRequests,
          etablissementDetails: classDetails.etablissement,
          moderatorDetails: classDetails.moderator,
        };
        
        setSelectedClass(enhancedClass);
        setCurrentView("details");
        setActiveDetailTab("manage");
      } catch (error) {
        console.error('=== ERROR LOADING CLASS DETAILS ===');
        console.error('Error details:', error);
        Alert.alert('Erreur', 'Impossible de charger les détails de la classe');
      }
    }
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedClass(null);
    setActiveDetailTab("info");
  };

  const handleCreateClass = async () => {
    console.log('=== OPENING CREATE CLASS MODAL ===');
    console.log('User data:', user);
    
    setShowCreateClassModal(true);
    await loadCreateClassData();
  };

  const [classesCache, setClassesCache] = useState(new Map());

  const loadClasses = async () => {
    console.log('=== LOADING CLASSES DATA ===');
    console.log('User ID:', user?.userId);
    
    setIsLoadingClasses(true);
    try {
      console.log('Fetching classes with publication rights from API...');
      const classesData = await classService.getClassesWithPublicationRights(user?.userId);
      
      console.log('=== CLASSES DATA RECEIVED ===');
      console.log('Raw classes data:', classesData);
      console.log('Classes count:', classesData?.length || 0);
      
      if (classesData && Array.isArray(classesData)) {
        const formattedClasses = await Promise.all(
          classesData.map(async (classItem) => {
            console.log('Processing class:', classItem);
            
            try {
              // Fetch detailed data for each class
              const [classDetails, accessRequests, classUsers] = await Promise.all([
                classService.getClassDetails(classItem.id),
                classService.getClassAccessRequests(classItem.id),
                classService.getClassUsers(classItem.id)
              ]);
              
              // Count users by type
              const students = classUsers.filter(user => user.type === 'eleve');
              const parents = classUsers.filter(user => user.type === 'utilisateur' && !user.admin);
              const others = classUsers.filter(user => user.type !== 'eleve' && (user.type !== 'utilisateur' || user.admin));
              
              // Format data for caching
              const formattedStudents = students.map(student => ({
                id: student.id,
                name: `${student.prenom || ''} ${student.nom || ''}`.trim(),
                email: student.email || student.telephone || 'Non spécifié',
                niveau: student.niveau || 'Non spécifié'
              }));
              
              const formattedParents = parents.map(parent => ({
                id: parent.id,
                name: `${parent.prenom || ''} ${parent.nom || ''}`.trim(),
                phone: parent.telephone || parent.email || 'Non spécifié'
              }));
              
              const formattedAccessRequests = (accessRequests || []).map(request => ({
                id: request.id,
                name: `${request.utilisateurPrenom || ''} ${request.utilisateurNom || ''}`.trim(),
                role: 'Utilisateur',
                date: new Date(request.dateDemande).toLocaleDateString('fr-FR'),
                status: request.etat || 'EN_ATTENTE'
              }));
              
              // Cache the detailed data
              const cachedData = {
                classDetails,
                accessRequests: formattedAccessRequests,
                students: formattedStudents,
                parents: formattedParents,
                others,
                etablissementDetails: classDetails.etablissement,
                moderatorDetails: classDetails.moderator,
              };
              
              setClassesCache(prev => new Map(prev.set(classItem.id, cachedData)));
              
              return {
                id: classItem.id,
                name: classDetails.nom || classItem.nom || 'Nom non défini',
                level: classDetails.niveau || classItem.niveau || 'Niveau non défini',
                state: classDetails.etat === 'ACTIF' ? 'ACTIVE' : 'INACTIVE',
                studentsCount: students.length,
                parentsCount: parents.length,
                creationDate: classDetails.dateCreation || classItem.dateCreation || new Date().toISOString(),
                description: classDetails.description || '',
                etablissement: classDetails.etablissement?.nom || 'Non spécifié',
                moderator: classDetails.moderator ? `${classDetails.moderator.prenom || ''} ${classDetails.moderator.nom || ''}`.trim() : 'Non spécifié',
                teacherRights: 'Droit de publication',
                students: formattedStudents,
                parents: formattedParents,
                accessRequests: formattedAccessRequests,
              };
            } catch (error) {
              console.error(`Error loading details for class ${classItem.id}:`, error);
              return {
                id: classItem.id,
                name: classItem.nom || 'Nom non défini',
                level: classItem.niveau || 'Niveau non défini',
                state: classItem.etat === 'ACTIF' ? 'ACTIVE' : 'INACTIVE',
                studentsCount: 0,
                parentsCount: 0,
                creationDate: classItem.dateCreation || new Date().toISOString(),
                description: '',
                etablissement: 'Non spécifié',
                moderator: 'Non spécifié',
                teacherRights: 'Droit de publication',
                students: [],
                parents: [],
                accessRequests: [],
              };
            }
          })
        );
        
        console.log('=== FORMATTED CLASSES ===');
        console.log('Formatted classes:', formattedClasses);
        
        setClasses(formattedClasses);
      } else {
        console.log('No classes data received or invalid format');
        setClasses([]);
      }
    } catch (error) {
      console.error('=== ERROR LOADING CLASSES ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      Alert.alert('Erreur', 'Impossible de charger les classes');
      setClasses([]);
    } finally {
      setIsLoadingClasses(false);
      console.log('=== FINISHED LOADING CLASSES ===');
    }
  };

  const loadCreateClassData = async () => {
    console.log('=== LOADING CREATE CLASS DATA ===');
    setIsLoadingData(true);
    
    try {
      console.log('Starting to fetch etablissements and professors...');
      
      const etablissementsPromise = classService.getEtablissements();
      const professorsPromise = classService.getProfessors();
      
      const [etablissementsData, professorsData] = await Promise.all([
        etablissementsPromise,
        professorsPromise
      ]);
      
      console.log('=== ETABLISSEMENTS DATA RECEIVED ===');
      console.log('Raw etablissements data:', etablissementsData);
      console.log('Etablissements count:', etablissementsData?.length || 0);
      
      console.log('=== PROFESSORS DATA RECEIVED ===');
      console.log('Raw professors data:', professorsData);
      console.log('Professors count:', professorsData?.length || 0);
      
      setEtablissements(etablissementsData || []);
      setProfessors(professorsData || []);
      
      console.log('Data loaded successfully into state');
    } catch (error) {
      console.error('=== ERROR LOADING CREATE CLASS DATA ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      Alert.alert('Erreur', `Impossible de charger les données: ${error.message}`);
    } finally {
      setIsLoadingData(false);
      console.log('=== FINISHED LOADING CREATE CLASS DATA ===');
    }
  };

  const generateActivationCode = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setActivationCode(randomCode);
  };

  const handleCreateNewClass = async () => {
    console.log('=== STARTING CLASS CREATION ===');
    console.log('Form data:', {
      className,
      selectedLevel,
      activationCode,
      selectedEstablishment,
      selectedModerator,
      user
    });
    
    if (!className.trim() || !selectedLevel || !activationCode.trim()) {
      console.log('Validation failed - missing required fields');
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires (*)');
      return;
    }

    setIsLoading(true);
    try {
      const classData = {
        nom: className,
        niveau: selectedLevel,
        dateCreation: new Date().toISOString(),
        codeActivation: activationCode,
        etat: 'EN_ATTENTE_APPROBATION',
        etablissement: selectedEstablishment ? { id: selectedEstablishment.id } : null,
        moderator: user.userId,
        parents: [],
        eleves: []
      };
      
      console.log('Class data to be sent:', classData);
      console.log('Creating class...');

      const createdClass = await classService.createClass(classData);
      console.log('Class created successfully:', createdClass);
      
      // Grant publication rights to the creator
      console.log('Granting publication rights...');
      await classService.grantPublicationRights(user.userId, createdClass.id, true, true);
      console.log('Publication rights granted successfully');
      
      Alert.alert('Succès', 'Classe créée avec succès!');
      
      // Add to local state for immediate UI update
      const newClass = {
        id: createdClass.id,
        name: createdClass.nom,
        level: createdClass.niveau,
        state: createdClass.etat,
        studentsCount: 0,
        parentsCount: 0,
        creationDate: createdClass.dateCreation,
        description: createdClass.description || "",
        etablissement: selectedEstablishment?.nom || "Non spécifié",
        moderator: user.nom || "Non spécifié",
        teacherRights: "Droit de publication",
        students: [],
        parents: [],
        accessRequests: [],
      };
      
      setClasses((prevClasses) => [newClass, ...prevClasses]);
      setShowCreateClassModal(false);
      resetCreateForm();
      
      // Reload classes to get updated data from server
      await loadClasses();
    } catch (error) {
      console.error('=== CLASS CREATION FAILED ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      Alert.alert('Erreur', `Impossible de créer la classe: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetCreateForm = () => {
    setClassName("");
    setSelectedLevel("");
    setActivationCode("");
    setSelectedEstablishment(null);
    setSelectedModerator(null);
  };

  // Filter classes
  const filteredClasses = classes.filter((classItem) => {
    const matchesSearch =
      classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.level.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      activeFilter === "toutes" ||
      (activeFilter === "actives" && classItem.state === "ACTIVE") ||
      (activeFilter === "inactives" && classItem.state === "INACTIVE") ||
      (activeFilter === "mes-classes" && true);
    return matchesSearch && matchesFilter;
  });

  // Loading animation styles
  const loadingRotation = loadingAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (currentView === "details" && selectedClass) {
    return (
      <ClassDetails
        selectedClass={selectedClass}
        onBack={handleBackToList}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
        onRefresh={async () => {
          try {
            const [classDetails, accessRequests, classUsers] = await Promise.all([
              classService.getClassDetails(selectedClass.id),
              classService.getClassAccessRequests(selectedClass.id),
              classService.getClassUsers(selectedClass.id)
            ]);
            
            const students = classUsers.filter(user => user.type === 'eleve');
            const parents = classUsers.filter(user => user.type === 'utilisateur' && !user.admin);
            const others = classUsers.filter(user => user.type !== 'eleve' && (user.type !== 'utilisateur' || user.admin));
            
            const formattedStudents = students.map(student => ({
              id: student.id,
              name: `${student.prenom || ''} ${student.nom || ''}`.trim(),
              email: student.email || student.telephone || 'Non spécifié',
              niveau: student.niveau || 'Non spécifié'
            }));
            
            const formattedParents = parents.map(parent => ({
              id: parent.id,
              name: `${parent.prenom || ''} ${parent.nom || ''}`.trim(),
              phone: parent.telephone || parent.email || 'Non spécifié'
            }));
            
            const formattedAccessRequests = (accessRequests || []).map(request => ({
              id: request.id,
              name: `${request.utilisateurPrenom || ''} ${request.utilisateurNom || ''}`.trim(),
              role: 'Utilisateur',
              date: new Date(request.dateDemande).toLocaleDateString('fr-FR'),
              status: request.etat || 'EN_ATTENTE'
            }));
            
            // Update cache
            const cachedData = {
              classDetails,
              accessRequests: formattedAccessRequests,
              students: formattedStudents,
              parents: formattedParents,
              others,
              etablissementDetails: classDetails.etablissement,
              moderatorDetails: classDetails.moderator,
            };
            
            setClassesCache(prev => new Map(prev.set(selectedClass.id, cachedData)));
            
            // Update selected class
            const updatedClass = {
              ...selectedClass,
              studentsCount: students.length,
              parentsCount: parents.length,
              othersCount: others.length,
              students: formattedStudents,
              parents: formattedParents,
              others: others,
              accessRequests: formattedAccessRequests,
            };
            
            setSelectedClass(updatedClass);
            
            // Update classes list
            setClasses(prev => prev.map(cls => 
              cls.id === selectedClass.id 
                ? { ...cls, studentsCount: students.length, parentsCount: parents.length }
                : cls
            ));
          } catch (error) {
            console.error('Error refreshing class data:', error);
          }
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header Section */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Mes Classes</Text>
          <Text style={styles.pageSubtitle}>
            Gérez et supervisez les classes auxquelles vous avez accès
          </Text>
        </View>
        {/* Access Request Button */}
        <TouchableOpacity
          style={styles.accessButton}
          onPress={handleRequestAccess}
        >
          <FontAwesome5 name="key" size={16} color="#FFFFFF" />
          <Text style={styles.accessButtonText}>
            Demander l'accès à une classe
          </Text>
        </TouchableOpacity>
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterTab,
                  activeFilter === filter.id && styles.activeFilterTab,
                ]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeFilter === filter.id && styles.activeFilterTabText,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <FontAwesome5
            name="search"
            size={16}
            color="#6B7280"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une classe..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        {/* Classes List */}
        <View style={styles.classesList}>
          {isLoadingClasses ? (
            <View style={styles.loadingContainer}>
              <FontAwesome5 name="spinner" size={32} color="#4F46E5" />
              <Text style={styles.loadingText}>Chargement des classes...</Text>
            </View>
          ) : (
            filteredClasses.map((classItem) => (
              <ClassCard
                key={classItem.id}
                classItem={classItem}
                onViewDetails={handleViewDetails}
                onManageClass={handleManageClass}
              />
            ))
          )}
        </View>
        {/* Empty State */}
        {!isLoadingClasses && filteredClasses.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome5 name="school" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucune classe trouvée</Text>
            <Text style={styles.emptyText}>
              Essayez de modifier vos critères de recherche ou demandez l'accès
              à une nouvelle classe
            </Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleCreateClass}
      >
        <FontAwesome5 name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      {/* Access Request Modal */}
      <AccessRequestModal
        visible={showAccessModal}
        onClose={handleCancelRequest}
        onCancel={handleCancelRequest}
        onValidate={handleValidateToken}
        tokenValue={tokenValue}
        setTokenValue={setTokenValue}
        isLoading={isLoading}
        showSuccess={showSuccess}
        loadingAnimation={loadingAnimation}
        successAnimation={successAnimation}
      />
      {/* Create Class Modal */}
      <Modal
        visible={showCreateClassModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowCreateClassModal(false);
          resetCreateForm();
        }}
      >
        <View style={styles.createModalContainer}>
          <ScrollView contentContainerStyle={styles.createModalScrollContainer}>
            {/* Header */}
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Créer une Classe</Text>
              <Text style={styles.createModalSubtitle}>
                Ajoutez une nouvelle classe à votre système
              </Text>
              <TouchableOpacity
                style={styles.createModalCloseButton}
                onPress={() => {
                  setShowCreateClassModal(false);
                  resetCreateForm();
                }}
                disabled={isLoadingData || isLoading}
              >
                <FontAwesome5 name="times" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.createFormContainer}>
              {/* Class Name */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>Nom de la classe *</Text>
                <TextInput
                  style={styles.createTextInput}
                  placeholder="Ex: Terminale C1"
                  value={className}
                  onChangeText={setClassName}
                />
              </View>

              {/* Level Selection */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>Niveau *</Text>
                <TouchableOpacity
                  style={styles.createDropdownButton}
                  onPress={() => setShowLevelDropdown(!showLevelDropdown)}
                >
                  <Text style={styles.createDropdownText}>
                    {selectedLevel || "Sélectionner un niveau"}
                  </Text>
                  <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {showLevelDropdown && (
                  <View style={styles.createDropdownOptions}>
                    {levels.map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={styles.createDropdownOption}
                        onPress={() => {
                          console.log('Selected level:', level);
                          setSelectedLevel(level);
                          setShowLevelDropdown(false);
                        }}
                      >
                        <Text style={styles.createDropdownOptionText}>
                          {level}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Activation Code */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>Code d'activation *</Text>
                <View style={styles.createCodeContainer}>
                  <TextInput
                    style={styles.createTextInput}
                    placeholder="Code d'activation"
                    value={activationCode}
                    onChangeText={setActivationCode}
                  />
                  <TouchableOpacity
                    style={styles.createGenerateButton}
                    onPress={generateActivationCode}
                  >
                    <Text style={styles.createGenerateButtonText}>Générer</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Establishment Selection */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>
                  Établissement (Optionnel) {isLoadingData && '(Chargement...)'}
                </Text>
                <TouchableOpacity
                  style={styles.createDropdownButton}
                  onPress={() => setShowEstablishmentDropdown(!showEstablishmentDropdown)}
                  disabled={isLoadingData}
                >
                  <Text style={styles.createDropdownText}>
                    {selectedEstablishment ? `${selectedEstablishment?.nom || 'Nom non défini'} - ${selectedEstablishment?.localisation || 'Localisation non définie'}` : "Aucun établissement (Optionnel)"}
                  </Text>
                  <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {showEstablishmentDropdown && (
                  <View style={styles.createDropdownOptions}>
                    <TouchableOpacity
                      key="no-establishment"
                      style={styles.createDropdownOption}
                      onPress={() => {
                        console.log('Selected establishment: None');
                        setSelectedEstablishment(null);
                        setShowEstablishmentDropdown(false);
                      }}
                    >
                      <Text style={styles.createDropdownOptionText}>Aucun établissement</Text>
                    </TouchableOpacity>
                    {etablissements.map((etablissement) => (
                      <TouchableOpacity
                        key={etablissement?.id || etablissement?.nom || 'unknown'}
                        style={styles.createDropdownOption}
                        onPress={() => {
                          console.log('Selected establishment:', etablissement);
                          setSelectedEstablishment(etablissement);
                          setShowEstablishmentDropdown(false);
                        }}
                      >
                        <Text style={styles.createDropdownOptionText}>
                          {etablissement?.nom || 'Nom non défini'} - {etablissement?.localisation || 'Localisation non définie'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Moderator Selection */}
              <View style={styles.createFormField}>
                <Text style={styles.createFieldLabel}>
                  Modérateur (Optionnel) {isLoadingData && '(Chargement...)'}
                </Text>
                <TouchableOpacity
                  style={styles.createDropdownButton}
                  onPress={() => setShowModeratorDropdown(!showModeratorDropdown)}
                  disabled={isLoadingData}
                >
                  <Text style={styles.createDropdownText}>
                    {selectedModerator ? `${selectedModerator.prenom} ${selectedModerator.nom}` : "Aucun modérateur (Optionnel)"}
                  </Text>
                  <FontAwesome5 name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {showModeratorDropdown && (
                  <View style={styles.createDropdownOptions}>
                    <TouchableOpacity
                      key="no-moderator"
                      style={styles.createDropdownOption}
                      onPress={() => {
                        console.log('Selected moderator: None');
                        setSelectedModerator(null);
                        setShowModeratorDropdown(false);
                      }}
                    >
                      <Text style={styles.createDropdownOptionText}>Aucun modérateur</Text>
                    </TouchableOpacity>
                    {professors.map((professor) => (
                      <TouchableOpacity
                        key={professor?.id || professor?.nom || 'unknown'}
                        style={styles.createDropdownOption}
                        onPress={() => {
                          console.log('Selected moderator:', professor);
                          setSelectedModerator(professor);
                          setShowModeratorDropdown(false);
                        }}
                      >
                        <Text style={styles.createDropdownOptionText}>
                          {professor?.prenom || ''} {professor?.nom || 'Nom non défini'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Important Information */}
              <View style={styles.createInfoBox}>
                <Text style={styles.createInfoTitle}>
                  Information importante
                </Text>
                <Text style={styles.createInfoText}>
                  • La classe sera créée avec le statut "En attente
                  d'approbation"
                </Text>
                <Text style={styles.createInfoText}>
                  • Le code d'activation permet aux utilisateurs de rejoindre la
                  classe
                </Text>
                <Text style={styles.createInfoText}>
                  • Vous pourrez ajouter des parents et élèves après la création
                </Text>
                <Text style={styles.createInfoText}>
                  • Vous recevrez automatiquement les droits de publication pour
                  cette classe
                </Text>
                <Text style={styles.createInfoText}>
                  • Les champs marqués avec * sont obligatoires
                </Text>
              </View>

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.createButton, isLoading && { opacity: 0.7 }]}
                onPress={handleCreateNewClass}
                disabled={isLoading}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isLoading && (
                    <FontAwesome5 name="spinner" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.createButtonText}>
                    {isLoading ? 'Création...' : 'Créer la classe'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pageHeader: {
    marginTop: 20,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  accessButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  accessButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
  },
  activeFilterTab: {
    backgroundColor: "#4F46E5",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeFilterTabText: {
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  classesList: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Create Class Modal Styles
  createModalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 20,
  },
  createModalScrollContainer: {
    paddingBottom: 20,
  },
  createModalHeader: {
    marginBottom: 20,
  },
  createModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  createModalSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  createModalCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 8,
  },
  createFormContainer: {
    marginBottom: 20,
  },
  createFormField: {
    marginBottom: 16,
  },
  createFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  createTextInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  createDropdownButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  createDropdownText: {
    fontSize: 16,
    color: "#6B7280",
  },
  createDropdownOptions: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  createDropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  createDropdownOptionText: {
    fontSize: 16,
    color: "#111827",
  },
  createCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  createGenerateButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  createGenerateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  createInfoBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  createInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  createInfoText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  createButton: {
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
  },
});

export default DashboardClassesBody;
