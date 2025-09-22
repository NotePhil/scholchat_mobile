import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const MessageItem = ({ message, onPress, onStarToggle }) => {
  return (
    <TouchableOpacity style={styles.messageItem} onPress={onPress}>
      <View style={styles.messageLeft}>
        <View style={styles.messageAvatar}>
          <Text style={styles.messageAvatarText}>{message.avatar}</Text>
        </View>
        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text
              style={[
                styles.messageSender,
                !message.isRead && styles.unreadSender,
              ]}
            >
              {message.sender || message.recipient}
            </Text>
            <Text style={styles.messageTime}>{message.time}</Text>
          </View>
          <Text
            style={[
              styles.messageSubject,
              !message.isRead && styles.unreadSubject,
            ]}
            numberOfLines={1}
          >
            {message.subject}
          </Text>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {message.preview}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.starButton} onPress={onStarToggle}>
        <FontAwesome5
          name={message.isStarred ? "star" : "star"}
          size={16}
          color={message.isStarred ? "#FCD34D" : "#D1D5DB"}
          solid={message.isStarred}
        />
      </TouchableOpacity>
      {!message.isRead && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
});

export default MessageItem;
