import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { useNavigation, useRoute } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Button, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { liveSessionService } from "../../services/api";
import { LiveSessionInfo } from "../../types";

/**
 * Builds the same Jitsi meeting URL web's JitsiRoom.jsx configures via the
 * JS External API, but as a plain URL for WebView to load directly (RN has
 * no DOM to run that script against). The backend never returns a ready
 * "roomUrl" — only roomName/jitsiJwt/jitsiDomain (SessionResponseDTO) — so
 * this reconstructs it: jwt as a query param (Jitsi's documented
 * direct-navigation auth method) and the same config overrides JitsiRoom.jsx
 * sets, passed via the URL hash fragment (parsed client-side by Jitsi's own
 * web app, same as the JS API would apply them).
 */
const buildJitsiUrl = (session: LiveSessionInfo, isModerator: boolean): string | null => {
  if (!session.roomName || !session.jitsiDomain) return null;
  const startWithAudioMuted = !isModerator;
  const startWithVideoMuted = session.mode !== 'VIDEO' || !isModerator;
  const params = new URLSearchParams();
  if (session.jitsiJwt) params.set('jwt', session.jitsiJwt);
  const hash = [
    `config.startWithAudioMuted=${startWithAudioMuted}`,
    `config.startWithVideoMuted=${startWithVideoMuted}`,
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=true',
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false',
    // Jitsi's web app shows a big "open in app" promo/redirect on mobile
    // user-agents by default, which breaks WebView playback if left on.
    'interfaceConfig.MOBILE_APP_PROMO=false',
  ].join('&');
  const query = params.toString();
  return `https://${session.jitsiDomain}/${session.roomName}${query ? `?${query}` : ''}#${hash}`;
};

/**
 * Live video classroom — mirrors scholchat_front's Jitsi-based session
 * (LiveSession/JitsiRoom.jsx): loads the same Jitsi room + config in a
 * WebView, since React Native has no native Jitsi Meet iframe equivalent.
 */
const LiveSessionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const coursId: string | undefined = route.params?.coursId;
  const isHost: boolean = route.params?.isHost ?? false;

  const [session, setSession] = useState<LiveSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const jitsiUrl = useMemo(() => (session ? buildJitsiUrl(session, isHost) : null), [session, isHost]);

  // getActiveSession() only confirms a session exists and hands back its id —
  // its response isn't directly connectable. Every client (host included,
  // once a session is already running) must call joinSession() to get a
  // jitsiJwt actually scoped to them; web's LiveSession.jsx never skips this
  // step, so neither do we.
  const checkActive = useCallback(async () => {
    if (!coursId) return;
    setLoading(true);
    setError("");
    try {
      const active = await liveSessionService.getActiveSession(coursId);
      if (!active) {
        setSession(null);
        return;
      }
      const joined = await liveSessionService.joinSession(coursId, active.sessionId);
      setSession(joined);
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
      // The host calling startSession already gets back a JWT scoped to
      // them as moderator — no separate join step needed here.
      const started = await liveSessionService.startSession(coursId);
      setSession(started);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Échec du démarrage de la session.");
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    if (!coursId || !session) return;
    try {
      if (isHost) await liveSessionService.endSession(coursId, session.sessionId);
      else await liveSessionService.leaveSession(coursId, session.sessionId);
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
      ) : session && session.mode === "CONTENT_ONLY" ? (
        <View style={styles.contentOnlyWrap}>
          <View style={styles.contentOnlyIcon}>
            <FontAwesome5 name="book-open" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.contentOnlyTitle}>Mode Contenu Seul</Text>
          <Text style={styles.contentOnlySubtitle}>Cette session n'utilise pas la caméra ni le micro.</Text>
        </View>
      ) : session && jitsiUrl ? (
        <WebView
          source={{ uri: jitsiUrl }}
          style={styles.webview}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
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
  contentOnlyWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#111827", paddingHorizontal: spacing.xl },
  contentOnlyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  contentOnlyTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  contentOnlySubtitle: { color: "#9CA3AF", fontSize: 13, marginTop: spacing.xs, textAlign: "center" },
});

export default LiveSessionScreen;
