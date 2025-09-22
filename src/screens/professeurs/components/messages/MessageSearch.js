import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const MessageSearch = ({ searchText, setSearchText }) => {
  return (
    <View style={styles.searchContainer}>
      <FontAwesome5
        name="search"
        size={16}
        color="#6B7280"
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.searchInput}
        placeholder="Rechercher dans les messages..."
        value={searchText}
        onChangeText={setSearchText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default MessageSearch;
