import React, { useCallback, useEffect, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { useNavigation, useRoute } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Button, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { liveSessionService } from "../../services/api";
import { LiveSessionInfo } from "../../types";
import { useUser } from "../../context/UserContext";

/**
 * Live video classroom — mirrors scholchat_front's Jitsi-based session
 * (LiveSession/JitsiRoom.jsx): embeds the room URL the backend hands back
 * from startSession/joinSession in a WebView, since React Native has no
 * native Jitsi Meet iframe equivalent.
 */
const LiveSessionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useUser();
  const coursId: string | undefined = route.params?.coursId;
  const isHost: boolean = route.params?.isHost ?? false;

  const [session, setSession] = useState<LiveSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const checkActive = useCallback(async () => {
    if (!coursId) return;
    setLoading(true);
    setError("");
    try {
      const active = await liveSessionService.getActiveSession(coursId);
      setSession(active ?? null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [coursId]);

  useEffect(() => {
    checkActive();
  }, [checkActive]);

  const handleStart = async () => {
    if (!coursId) return;
    setStarting(true);
    try {
      const started = await liveSessionService.startSession(coursId);
      setSession(started);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du démarrage de la session.");
    } finally {
      setStarting(false);
    }
  };

  const handleJoin = async () => {
    if (!coursId || !session) return;
    setStarting(true);
    try {
      const joined = await liveSessionService.joinSession(coursId, session.id);
      setSession(joined);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec de la connexion à la session.");
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    if (!coursId || !session) return;
    try {
      if (isHost) await liveSessionService.endSession(coursId, session.id);
      else await liveSessionService.leaveSession(coursId, session.id);
    } catch {
      // best-effort
    } finally {
      navigation.goBack();
    }
  };

  if (!coursId) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState icon="video" title="Session invalide" message="Aucun cours associé à cette session." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session en direct</Text>
        {session ? (
          <TouchableOpacity onPress={handleEnd} style={styles.endButton}>
            <Text style={styles.endButtonText}>{isHost ? "Terminer" : "Quitter"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {loading ? (
        <LoadingSpinner fullScreen label="Vérification de la session..." />
      ) : error ? (
        <EmptyState icon="exclamation-triangle" title="Erreur" message={error} />
      ) : session?.roomUrl ? (
        <WebView
          source={{ uri: session.roomUrl }}
          style={styles.webview}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
        />
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="video"
            title={isHost ? "Aucune session active" : "En attente du professeur"}
            message={
              isHost
                ? "Démarrez la session pour que les participants puissent vous rejoindre."
                : "La session démarrera dès que le professeur l'aura lancée."
            }
          />
          {isHost ? (
            <Button label="Démarrer la session" onPress={handleStart} loading={starting} fullWidth />
          ) : (
            <Button label="Actualiser" onPress={checkActive} loading={starting} fullWidth variant="secondary" />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.h3, color: colors.text },
  endButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.dangerLight, borderRadius: 8 },
  endButtonText: { color: colors.danger, fontWeight: "700" },
  webview: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl },
});

export default LiveSessionScreen;
