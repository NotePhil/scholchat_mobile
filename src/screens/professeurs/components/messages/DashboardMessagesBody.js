import React, { useState, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Animated,
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { messageService } from "../../../../services/messageService";
import { useUser } from "../../../../context/UserContext";
import ComposeMessageModal from "./ComposeMessageModal";

// Main Messages Body Component
const DashboardMessagesBody = ({ onBack }) => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("inbox");
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [demoMessages] = useState([
    {
      id: 1,
      sender: "Marie Dupont",
      subject: "Réunion parents-professeurs",
      preview:
        "Bonjour, je souhaiterais programmer une réunion pour discuter...",
      time: "10:30",
      date: "2024-09-22",
      isRead: false,
      isStarred: true,
      avatar: "MD",
      fullMessage:
        "Bonjour Mr Simo,\n\nJe souhaiterais programmer une réunion pour discuter des progrès de mon fils en mathématiques. Serait-il possible de nous rencontrer cette semaine ?\n\nCordialement,\nMarie Dupont",
      type: "received",
    },
    {
      id: 2,
      sender: "Pierre Martin",
      subject: "Nouveau programme de sciences",
      preview:
        "Le nouveau programme de sciences naturelles sera mis en place...",
      time: "09:15",
      date: "2024-09-22",
      isRead: true,
      isStarred: false,
      avatar: "PM",
      fullMessage:
        "Cher collègue,\n\nLe nouveau programme de sciences naturelles sera mis en place dès la semaine prochaine. Merci de préparer vos cours en conséquence.\n\nBien à vous,\nPierre Martin",
      type: "received",
    },
    {
      id: 3,
      sender: "Sophie Bernard",
      subject: "Re: Documents de cours",
      preview: "Merci pour les documents partagés. J'ai quelques questions...",
      time: "hier",
      date: "2024-09-21",
      isRead: true,
      isStarred: false,
      avatar: "SB",
      fullMessage:
        "Bonjour,\n\nMerci pour les documents partagés. J'ai quelques questions sur le chapitre 3. Pouvons-nous en discuter demain ?\n\nCordialement,\nSophie Bernard",
      type: "received",
    },
  ]);

  const [demoSentMessages] = useState([
    {
      id: 101,
      recipient: "Marie Dupont",
      subject: "Re: Réunion parents-professeurs",
      preview: "Bien sûr, nous pouvons nous rencontrer jeudi à 14h...",
      time: "11:00",
      date: "2024-09-22",
      isRead: true,
      avatar: "MD",
      fullMessage:
        "Chère Mme Dupont,\n\nBien sûr, nous pouvons nous rencontrer jeudi à 14h dans mon bureau. Nous pourrons discuter des progrès de votre fils et voir comment l'aider davantage.\n\nCordialement,\nMr Simo",
      type: "sent",
    },
  ]);

  const tabs = [
    { id: "inbox", label: "Reçus", icon: "inbox" },
    { id: "sent", label: "Envoyés", icon: "paper-plane" },
    { id: "starred", label: "Favoris", icon: "star" },
  ];

  const getMessagesToShow = () => {
    let messagesToShow = [];

    switch (activeTab) {
      case "inbox":
        messagesToShow = messages.filter(msg => msg.type === 'received');
        break;
      case "sent":
        messagesToShow = messages.filter(msg => msg.type === 'sent');
        break;
      case "starred":
        messagesToShow = messages.filter((msg) => msg.isStarred);
        break;
    }

    if (searchText) {
      messagesToShow = messagesToShow.filter(
        (msg) =>
          msg.subject.toLowerCase().includes(searchText.toLowerCase()) ||
          msg.sender?.toLowerCase().includes(searchText.toLowerCase()) ||
          msg.recipient?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return messagesToShow;
  };

  const handleMessagePress = (message) => {
    if (!message.isRead && message.type === "received") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? { ...msg, isRead: true } : msg
        )
      );
    }
    setSelectedMessage(message);
  };

  const handleStarToggle = (messageId) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isStarred: !msg.isStarred } : msg
      )
    );
  };

  // Load messages on component mount
  React.useEffect(() => {
    if (user?.userId) {
      loadMessages();
    }
  }, [user?.userId]);

  const loadMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const userMessages = await messageService.getUserMessages(user?.userId);
      
      // Format messages for display
      const formattedMessages = userMessages.map(msg => {
        const isReceived = msg.type === 'received';
        const displayPerson = isReceived 
          ? (msg.expediteur ? `${msg.expediteur.prenom || ''} ${msg.expediteur.nom || ''}`.trim() : 'Expéditeur inconnu')
          : (msg.destinataires && msg.destinataires.length > 0 
             ? msg.destinataires.map(d => `${d.prenom || ''} ${d.nom || ''}`.trim()).join(', ')
             : 'Destinataires inconnus');
        
        return {
          id: msg.id,
          sender: displayPerson,
          subject: msg.objet || 'Sans objet',
          preview: msg.contenu ? msg.contenu.replace(/<[^>]*>/g, '').substring(0, 50) + '...' : '',
          time: msg.dateCreation ? (() => {
            try {
              return new Date(msg.dateCreation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            } catch {
              return 'N/A';
            }
          })() : 'N/A',
          date: msg.dateCreation,
          isRead: msg.etat === 'lu' || msg.etat === 'reçu',
          isStarred: false,
          avatar: displayPerson.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'UK',
          fullMessage: msg.contenu || '',
          type: msg.type,
        };
      });
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      // Fallback to demo messages
      setMessages(demoMessages);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = () => {
    setShowCompose(false);
    loadMessages(); // Reload messages after sending
  };

  if (selectedMessage) {
    return (
      <MessageDetailView
        message={selectedMessage}
        onBack={() => setSelectedMessage(null)}
        onReply={(message) => {
          setSelectedMessage(null);
          setShowCompose(true);
        }}
        onForward={(message) => {
          setSelectedMessage(null);
          setShowCompose(true);
        }}
      />
    );
  }

  return (
    <View style={messagesStyles.container}>
      {/* Header */}
      <View style={messagesStyles.header}>
        {onBack && (
          <TouchableOpacity style={messagesStyles.backButton} onPress={onBack}>
            <FontAwesome5 name="arrow-left" size={20} color="#4F46E5" />
          </TouchableOpacity>
        )}
        <Text style={messagesStyles.headerTitle}>Messages</Text>
      </View>

      {/* Search Bar */}
      <View style={messagesStyles.searchContainer}>
        <FontAwesome5
          name="search"
          size={16}
          color="#6B7280"
          style={messagesStyles.searchIcon}
        />
        <TextInput
          style={messagesStyles.searchInput}
          placeholder="Rechercher dans les messages..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Tabs */}
      <View style={messagesStyles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              messagesStyles.tab,
              activeTab === tab.id && messagesStyles.activeTab,
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <FontAwesome5
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? "#4F46E5" : "#6B7280"}
            />
            <Text
              style={[
                messagesStyles.tabText,
                activeTab === tab.id && messagesStyles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages List */}
      <ScrollView style={messagesStyles.messagesList}>
        {isLoadingMessages ? (
          <View style={messagesStyles.loadingContainer}>
            <FontAwesome5 name="spinner" size={32} color="#4F46E5" />
            <Text style={messagesStyles.loadingText}>Chargement des messages...</Text>
          </View>
        ) : (
          <>
            {getMessagesToShow().map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onPress={() => handleMessagePress(message)}
                onStarToggle={() => handleStarToggle(message.id)}
              />
            ))}

            {getMessagesToShow().length === 0 && (
              <View style={messagesStyles.emptyState}>
                <FontAwesome5 name="inbox" size={48} color="#D1D5DB" />
                <Text style={messagesStyles.emptyStateText}>
                  {searchText ? "Aucun message trouvé" : "Aucun message"}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={messagesStyles.floatingButton}
        onPress={() => setShowCompose(true)}
      >
        <FontAwesome5 name="edit" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeMessageModal
          onClose={() => setShowCompose(false)}
          onSend={handleSendMessage}
        />
      )}
    </View>
  );
};

// Message Item Component
const MessageItem = ({ message, onPress, onStarToggle }) => {
  return (
    <TouchableOpacity style={messagesStyles.messageItem} onPress={onPress}>
      <View style={messagesStyles.messageLeft}>
        <View style={messagesStyles.messageAvatar}>
          <Text style={messagesStyles.messageAvatarText}>{message.avatar}</Text>
        </View>
        <View style={messagesStyles.messageContent}>
          <View style={messagesStyles.messageHeader}>
            <Text
              style={[
                messagesStyles.messageSender,
                !message.isRead && messagesStyles.unreadSender,
              ]}
            >
              {message.sender || message.recipient}
            </Text>
            <Text style={messagesStyles.messageTime}>{message.time}</Text>
          </View>
          <Text
            style={[
              messagesStyles.messageSubject,
              !message.isRead && messagesStyles.unreadSubject,
            ]}
            numberOfLines={1}
          >
            {message.subject}
          </Text>
          <Text style={messagesStyles.messagePreview} numberOfLines={1}>
            {message.preview}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={messagesStyles.starButton}
        onPress={onStarToggle}
      >
        <FontAwesome5
          name={message.isStarred ? "star" : "star"}
          size={16}
          color={message.isStarred ? "#FCD34D" : "#D1D5DB"}
          solid={message.isStarred}
        />
      </TouchableOpacity>
      {!message.isRead && <View style={messagesStyles.unreadIndicator} />}
    </TouchableOpacity>
  );
};

// Message Detail View Component
const MessageDetailView = ({ message, onBack, onReply, onForward }) => {
  return (
    <View style={messagesStyles.container}>
      {/* Header */}
      <View style={messagesStyles.detailHeader}>
        <TouchableOpacity style={messagesStyles.backButton} onPress={onBack}>
          <FontAwesome5 name="arrow-left" size={20} color="#4F46E5" />
        </TouchableOpacity>
        <View style={messagesStyles.detailHeaderInfo}>
          <Text style={messagesStyles.detailSubject} numberOfLines={1}>
            {message.subject}
          </Text>
        </View>
        <TouchableOpacity style={messagesStyles.moreButton}>
          <FontAwesome5 name="ellipsis-v" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={messagesStyles.detailContent}>
        {/* Message Info */}
        <View style={messagesStyles.messageInfo}>
          <View style={messagesStyles.messageInfoHeader}>
            <View style={messagesStyles.messageAvatar}>
              <Text style={messagesStyles.messageAvatarText}>
                {message.avatar}
              </Text>
            </View>
            <View style={messagesStyles.messageInfoContent}>
              <Text style={messagesStyles.messageInfoSender}>
                {message.sender || message.recipient}
              </Text>
              <Text style={messagesStyles.messageInfoTime}>
                {message.time} • {message.date}
              </Text>
            </View>
          </View>
        </View>

        {/* Message Content */}
        <View style={messagesStyles.messageBody}>
          <Text style={messagesStyles.messageText}>
            {message.fullMessage.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')}
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={messagesStyles.actionBar}>
        <TouchableOpacity
          style={messagesStyles.actionButton}
          onPress={() => onReply(message)}
        >
          <FontAwesome5 name="reply" size={18} color="#4F46E5" />
          <Text style={messagesStyles.actionButtonText}>Répondre</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={messagesStyles.actionButton}
          onPress={() => onForward(message)}
        >
          <FontAwesome5 name="share" size={18} color="#4F46E5" />
          <Text style={messagesStyles.actionButtonText}>Transférer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};



const messagesStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: "#F0F0FF",
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#4F46E5",
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  messageAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  unreadSender: {
    fontWeight: "600",
    color: "#111827",
  },
  messageTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  messageSubject: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  unreadSubject: {
    fontWeight: "600",
    color: "#111827",
  },
  messagePreview: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  starButton: {
    padding: 8,
    marginLeft: 8,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4F46E5",
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#9CA3AF",
    marginTop: 12,
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
  // Detail View Styles
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailHeaderInfo: {
    flex: 1,
    marginHorizontal: 16,
  },
  detailSubject: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  moreButton: {
    padding: 4,
  },
  detailContent: {
    flex: 1,
    padding: 16,
  },
  messageInfo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  messageInfoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  messageInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  messageInfoSender: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  messageInfoTime: {
    fontSize: 14,
    color: "#6B7280",
  },
  messageBody: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
  },
  actionBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#4F46E5",
  },
  // Compose Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  composeModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: "85%",
  },
  composeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  composeForm: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  messageInput: {
    height: 120,
    textAlignVertical: "top",
  },
  composeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginLeft: 8,
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

export default DashboardMessagesBody;
