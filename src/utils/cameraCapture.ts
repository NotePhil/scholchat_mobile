/**
 * Camera capture shared by every photo/video picker (event creation, message
 * attachments, course media, professor documents…).
 *
 * - Asks for the camera permission with a clear rationale; when it was denied
 *   (and can no longer be asked), offers "Ouvrir les réglages".
 * - Returns a file descriptor ready for `mediaService` uploads (xhrUpload), or
 *   null when the user cancelled / refused.
 */
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { translate } from '../i18n';

export type CaptureKind = 'photo' | 'video';

export interface CapturedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  isVideo: boolean;
  width?: number;
  height?: number;
  /** Only when requested with `base64: true` (photos). */
  base64?: string;
}

const openSettingsAlert = (message: string) => {
  Alert.alert(translate('camera.permissionTitle'), message, [
    { text: translate('common.cancel'), style: 'cancel' },
    { text: translate('camera.openSettings'), onPress: () => Linking.openSettings().catch(() => undefined) },
  ]);
};

/** Camera permission (and the microphone one for video on iOS, prompted by the picker itself). */
export const ensureCameraPermission = async (): Promise<boolean> => {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) {
    openSettingsAlert(translate('camera.permissionDenied'));
    return false;
  }
  const res = await ImagePicker.requestCameraPermissionsAsync();
  if (res.granted) return true;
  if (res.canAskAgain === false) openSettingsAlert(translate('camera.permissionDenied'));
  else Alert.alert(translate('camera.permissionTitle'), translate('camera.permissionRationale'));
  return false;
};

/** Opens the camera to take a photo or record a video. */
export const captureFromCamera = async (
  kind: CaptureKind = 'photo',
  options: { quality?: number; allowsEditing?: boolean; aspect?: [number, number]; maxDurationSec?: number; base64?: boolean } = {}
): Promise<CapturedFile | null> => {
  if (!(await ensureCameraPermission())) return null;
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === 'video' ? ['videos'] : ['images'],
      quality: options.quality ?? 0.8,
      allowsEditing: options.allowsEditing ?? false,
      aspect: options.aspect,
      base64: kind === 'photo' ? options.base64 ?? false : false,
      videoMaxDuration: kind === 'video' ? options.maxDurationSec ?? 300 : undefined,
    });
  } catch (err) {
    // Simulator / device without a camera.
    Alert.alert(translate('camera.unavailableTitle'), err instanceof Error ? err.message : translate('camera.unavailable'));
    return null;
  }
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  const isVideo = a.type === 'video' || (a.mimeType ?? '').startsWith('video/') || kind === 'video';
  const mimeType = a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
  const ext = isVideo ? (mimeType.includes('quicktime') ? 'mov' : 'mp4') : mimeType.includes('png') ? 'png' : 'jpg';
  return {
    uri: a.uri,
    name: a.fileName ?? `${isVideo ? 'video' : 'photo'}_${Date.now()}.${ext}`,
    mimeType,
    size: a.fileSize ?? undefined,
    isVideo,
    width: a.width,
    height: a.height,
    base64: a.base64 ?? undefined,
  };
};

/** Asks where an image should come from: the camera or the files / gallery. Resolves null when dismissed. */
export const chooseImageSource = (): Promise<'camera' | 'library' | null> =>
  new Promise((resolve) => {
    let done = false;
    const finish = (v: 'camera' | 'library' | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    Alert.alert(
      translate('camera.chooseSourceTitle'),
      undefined,
      [
        { text: translate('camera.takePhoto'), onPress: () => finish('camera') },
        { text: translate('camera.fromFiles'), onPress: () => finish('library') },
        { text: translate('common.cancel'), style: 'cancel', onPress: () => finish(null) },
      ],
      { cancelable: true, onDismiss: () => finish(null) }
    );
  });

export interface PickedImageFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/**
 * One image (identity documents, selfie…): "Prendre une photo" or "Choisir un fichier"
 * (DocumentPicker, images only). Resolves null when cancelled.
 */
export const pickImageFromCameraOrFiles = async (): Promise<PickedImageFile | null> => {
  const source = await chooseImageSource();
  if (!source) return null;
  if (source === 'camera') {
    const f = await captureFromCamera('photo', { quality: 0.8 });
    return f ? { uri: f.uri, name: f.name, mimeType: f.mimeType, size: f.size } : null;
  }
  const result = await DocumentPicker.getDocumentAsync({ type: ['image/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType || 'image/jpeg', size: a.size ?? undefined };
};
