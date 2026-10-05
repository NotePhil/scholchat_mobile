import { LiveSessionInfo } from '../../../types';

export interface JitsiPageOptions {
  session: LiveSessionInfo;
  isModerator: boolean;
  displayName: string;
  subject: string;
  /** false when the user continued without camera/mic: join muted, receive-only. */
  withMedia: boolean;
}

/** Messages posted by the page through window.ReactNativeWebView.postMessage. */
export type JitsiEvent =
  | { type: 'loaded' }
  | { type: 'joined' }
  | { type: 'hangup' }
  | { type: 'participants'; count: number }
  | { type: 'audioMuted'; muted: boolean }
  | { type: 'videoMuted'; muted: boolean }
  | { type: 'error'; message: string };

/** JSON safe to inline inside a <script> block. */
const inline = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

/**
 * Same Jitsi setup as web's JitsiRoom.jsx (JitsiMeetExternalAPI, same
 * configOverwrite / interfaceConfigOverwrite / toolbar per role), rendered in a
 * WebView page whose base URL is the Jitsi origin (secure context, same-origin
 * iframe). The External API gives us the same events web listens to
 * (readyToClose / videoConferenceLeft → hangup) plus join/mute state, bridged
 * to React Native via postMessage. RN drives it back with
 * `window.__sc.cmd(name)` through injectJavaScript.
 */
export const buildJitsiHtml = ({ session, isModerator, displayName, subject, withMedia }: JitsiPageOptions): string => {
  const mode = session.mode;
  let startWithAudioMuted = !isModerator;
  let startWithVideoMuted = mode !== 'VIDEO' || !isModerator;
  if (mode === 'AUDIO') startWithVideoMuted = true;
  if (mode === 'CONTENT_ONLY' || !withMedia) {
    startWithAudioMuted = true;
    startWithVideoMuted = true;
  }

  const options = {
    roomName: session.roomName,
    jwt: session.jitsiJwt,
    width: '100%',
    height: '100%',
    userInfo: { displayName: displayName || 'Utilisateur' },
    configOverwrite: {
      startWithAudioMuted,
      startWithVideoMuted,
      disableDeepLinking: true,
      prejoinPageEnabled: false,
      prejoinConfig: { enabled: false },
      disableInviteFunctions: true,
      enableWelcomePage: false,
      enableClosePage: false,
      subject: subject || 'Session ScholChat',
      readOnlyName: true,
      disableProfile: true,
      // Phones expose 4 cameras + several audio routes: don't flood the call with "new device" toasts.
      disabledNotifications: ['notify.newDeviceCameraTitle', 'notify.newDeviceAudioTitle'],
      toolbarButtons: isModerator
        ? ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'participants-pane', 'toggle-camera', 'hangup']
        : ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'toggle-camera', 'hangup'],
    },
    interfaceConfigOverwrite: {
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      TOOLBAR_ALWAYS_VISIBLE: true,
      HIDE_INVITE_MORE_HEADER: true,
      DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
      MOBILE_APP_PROMO: false,
    },
  };

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #030712; overflow: hidden; }
  #meet { position: absolute; inset: 0; }
  #meet iframe { border: 0; }
</style>
</head><body>
<div id="meet"></div>
<script>
(function () {
  var post = function (msg) { try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {} };
  var domain = ${inline(session.jitsiDomain)};
  var options = ${inline(options)};
  var api = null;
  var wasVideoOn = false;
  var countParticipants = function () {
    try { post({ type: 'participants', count: api.getNumberOfParticipants() }); } catch (e) {}
  };
  window.__sc = {
    cmd: function (name) {
      if (!api) return;
      try {
        if (name === 'hangup') api.executeCommand('hangup');
        else if (name === 'toggleAudio') api.executeCommand('toggleAudio');
        else if (name === 'toggleVideo') api.executeCommand('toggleVideo');
        else if (name === 'background') {
          api.isVideoMuted().then(function (muted) { wasVideoOn = !muted; if (!muted) api.executeCommand('toggleVideo'); });
        } else if (name === 'foreground') {
          if (wasVideoOn) { wasVideoOn = false; api.isVideoMuted().then(function (muted) { if (muted) api.executeCommand('toggleVideo'); }); }
        } else if (name === 'dispose') { api.dispose(); api = null; }
      } catch (e) {}
    }
  };
  var start = function () {
    if (!window.JitsiMeetExternalAPI) { post({ type: 'error', message: 'external_api' }); return; }
    options.parentNode = document.getElementById('meet');
    api = new window.JitsiMeetExternalAPI(domain, options);
    post({ type: 'loaded' });
    var hangup = function () { post({ type: 'hangup' }); };
    api.addEventListeners({
      videoConferenceJoined: function () { post({ type: 'joined' }); countParticipants(); },
      participantJoined: countParticipants,
      participantLeft: countParticipants,
      audioMuteStatusChanged: function (e) { post({ type: 'audioMuted', muted: !!(e && e.muted) }); },
      videoMuteStatusChanged: function (e) { post({ type: 'videoMuted', muted: !!(e && e.muted) }); },
      readyToClose: hangup,
      videoConferenceLeft: hangup
    });
  };
  var s = document.createElement('script');
  s.src = 'https://' + domain + '/libs/external_api.min.js';
  s.async = true;
  s.onload = start;
  s.onerror = function () { post({ type: 'error', message: 'external_api_load' }); };
  document.head.appendChild(s);
})();
</script>
</body></html>`;
};
