import { Camera } from 'expo-camera';

export type CallMode = 'VIDEO' | 'AUDIO' | 'CONTENT_ONLY' | string | undefined;
export type CallPermissionKind = 'camera' | 'microphone';
export type CallPermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';

export type CallPermissionStatus = Record<CallPermissionKind, CallPermissionState>;

/**
 * Which OS permissions a live-session mode needs before the Jitsi WebView is
 * mounted. Android's WebView silently refuses getUserMedia() (black tiles, no
 * in-page prompt) unless the app already holds CAMERA / RECORD_AUDIO, so the
 * OS dialogs must be resolved first. Every mode except CONTENT_ONLY asks for
 * both: an AUDIO session still lets anyone turn the camera on from the
 * toolbar, exactly like web.
 */
export const neededCallPermissions = (mode: CallMode): CallPermissionKind[] =>
  mode === 'CONTENT_ONLY' ? [] : ['camera', 'microphone'];

const toState = (p: { granted: boolean; canAskAgain: boolean; status: string }): CallPermissionState => {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return p.canAskAgain ? 'denied' : 'blocked';
};

export const getCallPermissions = async (): Promise<CallPermissionStatus> => {
  const [cam, mic] = await Promise.all([Camera.getCameraPermissionsAsync(), Camera.getMicrophonePermissionsAsync()]);
  return { camera: toState(cam), microphone: toState(mic) };
};

/** Requests (sequentially, so Android shows one clear dialog at a time) each missing permission. */
export const requestCallPermissions = async (kinds: CallPermissionKind[]): Promise<CallPermissionStatus> => {
  const current = await getCallPermissions();
  for (const kind of kinds) {
    if (current[kind] === 'granted' || current[kind] === 'blocked') continue;
    const res = kind === 'camera' ? await Camera.requestCameraPermissionsAsync() : await Camera.requestMicrophonePermissionsAsync();
    current[kind] = toState(res);
  }
  return current;
};

export const allGranted = (status: CallPermissionStatus | null, kinds: CallPermissionKind[]) =>
  !!status && kinds.every((k) => status[k] === 'granted');
