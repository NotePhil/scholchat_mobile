import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const MessageDetailView = ({ message, onBack, onReply, onForward }) => {
  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <FontAwesome5 name="arrow-left" size={20} color="#4F46E5" />
        </TouchableOpacity>
        <View style={styles.detailHeaderInfo}>
          <Text style={styles.detailSubject} numberOfLines={1}>
            {message.subject}
          </Text>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <FontAwesome5 name="ellipsis-v" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.detailContent}>
        <View style={styles.messageInfo}>
          <View style={styles.messageInfoHeader}>
            <View style={styles.messageAvatar}>
              <Text style={styles.messageAvatarText}>{message.avatar}</Text>
            </View>
            <View style={styles.messageInfoContent}>
              <Text style={styles.messageInfoSender}>
                {message.sender || message.recipient}
              </Text>
              <Text style={styles.messageInfoTime}>
                {message.time} • {message.date}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.messageBody}>
          <Text style={styles.messageText}>{message.fullMessage}</Text>
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onReply(message)}
        >
          <FontAwesome5 name="reply" size={18} color="#4F46E5" />
          <Text style={styles.actionButtonText}>Répondre</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onForward(message)}
        >
          <FontAwesome5 name="share" size={18} color="#4F46E5" />
          <Text style={styles.actionButtonText}>Transférer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  detailHeader: {
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
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
  },
  messageAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default MessageDetailView;
