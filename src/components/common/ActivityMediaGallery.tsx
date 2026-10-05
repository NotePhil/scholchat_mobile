import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActivityMediaImage from './ActivityMediaImage';
import ActivityMediaVideo from './ActivityMediaVideo';

/** One displayable media item of an activity, already filtered to IMAGE/VIDEO with an id, as web's loadEvents() does. */
export interface FeedMedia {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  presignedUrl?: string | null;
}

const GAP = 2; // web: gap-0.5
// Web's phone heights (Tailwind, below the sm breakpoint): h-72 / h-64 / h-48.
const H_SINGLE = 288;
const H_PAIR = 256;
const H_QUAD_ROW = 192;

/**
 * Media grid, same as web's ActivitiesContent "Media Gallery":
 *  - 1 item: one full-width tile
 *  - 2 items: two side-by-side tiles
 *  - 3 items: one large tile (2/3 width) + two stacked tiles
 *  - 4+ items: 2x2 grid, the 4th tile showing "+N" for the items not shown
 * Images and videos stay mixed in their original order. Tapping an image
 * opens the full-screen viewer; a video plays inline in its tile, as on web.
 * The "+N" tile always opens the viewer so the hidden items can be reached.
 */
export const ActivityMediaGallery = ({ medias, onOpen }: { medias: FeedMedia[]; onOpen: (index: number) => void }) => {
  if (medias.length === 0) return null;

  const cell = (index: number, style: ViewStyle, overlay?: string, compact?: boolean) => {
    const media = medias[index];
    const isVideo = media.type === 'VIDEO';
    if (isVideo && !overlay) {
      return (
        <View key={media.id} style={[styles.cell, style]}>
          <ActivityMediaVideo mediaId={media.id} presignedUrl={media.presignedUrl ?? null} style={styles.fill} compact={compact} />
        </View>
      );
    }
    return (
      <TouchableOpacity key={media.id} style={[styles.cell, style]} activeOpacity={0.9} onPress={() => onOpen(index)}>
        {isVideo ? (
          <View style={[styles.fill, styles.videoTile]}>
            <FontAwesome5 name="play" size={18} color="#FFFFFF" />
          </View>
        ) : (
          <ActivityMediaImage mediaId={media.id} presignedUrl={media.presignedUrl ?? null} style={styles.fill} />
        )}
        {overlay ? (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.overlayText}>{overlay}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (medias.length === 1) {
    return <View style={{ height: H_SINGLE }}>{cell(0, { flex: 1 })}</View>;
  }
  if (medias.length === 2) {
    return (
      <View style={[styles.row, { height: H_PAIR }]}>
        {cell(0, { flex: 1 })}
        {cell(1, { flex: 1 })}
      </View>
    );
  }
  if (medias.length === 3) {
    return (
      <View style={[styles.row, { height: H_PAIR }]}>
        {cell(0, { flex: 2 })}
        <View style={[styles.col, { flex: 1 }]}>
          {cell(1, { flex: 1 }, undefined, true)}
          {cell(2, { flex: 1 }, undefined, true)}
        </View>
      </View>
    );
  }
  const remaining = medias.length - 4;
  return (
    <View style={styles.col}>
      <View style={[styles.row, { height: H_QUAD_ROW }]}>
        {cell(0, { flex: 1 }, undefined, true)}
        {cell(1, { flex: 1 }, undefined, true)}
      </View>
      <View style={[styles.row, { height: H_QUAD_ROW }]}>
        {cell(2, { flex: 1 }, undefined, true)}
        {cell(3, { flex: 1 }, remaining > 0 ? `+${remaining}` : undefined, true)}
      </View>
    </View>
  );
};

/**
 * Full-screen viewer, based on web's image lightbox: dark backdrop, close
 * button, prev/next arrows and an "i / n" counter. On a phone you can also
 * swipe between items. Unlike web, videos are included too, and they play
 * here; a video only mounts while its page is the current one, so swiping
 * away stops it.
 */
export const ActivityMediaViewer = ({
  medias,
  initialIndex,
  onClose,
}: {
  medias: FeedMedia[];
  initialIndex: number;
  onClose: () => void;
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<FeedMedia>>(null);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const goTo = (next: number) => {
    const n = medias.length;
    const target = ((next % n) + n) % n; // wraps around, like web's navigateImage
    listRef.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const mediaHeight = height - insets.top - insets.bottom - 140;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={viewerStyles.backdrop}>
        <FlatList
          ref={listRef}
          data={medias}
          keyExtractor={(m) => m.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item, index: i }) => (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              {item.type === 'VIDEO' ? (
                i === index ? (
                  <ActivityMediaVideo
                    mediaId={item.id}
                    presignedUrl={item.presignedUrl ?? null}
                    style={{ width, height: Math.min(mediaHeight, (width * 9) / 16 + 120) }}
                    autoPlay
                  />
                ) : (
                  <View style={[viewerStyles.videoIdle, { width, height: (width * 9) / 16 }]}>
                    <FontAwesome5 name="play" size={28} color="#FFFFFF" />
                  </View>
                )
              ) : (
                <ActivityMediaImage
                  mediaId={item.id}
                  presignedUrl={item.presignedUrl ?? null}
                  style={{ width: width - 24, height: mediaHeight, borderRadius: 12 }}
                  resizeMode="contain"
                  placeholderColor="transparent"
                />
              )}
            </View>
          )}
        />

        <TouchableOpacity
          style={[viewerStyles.roundBtn, { top: insets.top + 12, right: 16 }]}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome5 name="times" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {medias.length > 1 ? (
          <>
            <TouchableOpacity style={[viewerStyles.roundBtn, viewerStyles.navLeft]} onPress={() => goTo(index - 1)}>
              <FontAwesome5 name="chevron-left" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[viewerStyles.roundBtn, viewerStyles.navRight]} onPress={() => goTo(index + 1)}>
              <FontAwesome5 name="chevron-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={[viewerStyles.counter, { bottom: insets.bottom + 20 }]} pointerEvents="none">
              <Text style={viewerStyles.counterText}>
                {index + 1} / {medias.length}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP },
  col: { flexDirection: 'column', gap: GAP },
  cell: { position: 'relative', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  videoTile: { backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
});

const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  roundBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: { left: 12, top: '50%', marginTop: -20 },
  navRight: { right: 12, top: '50%', marginTop: -20 },
  videoIdle: { backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  counterText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
});

export default ActivityMediaGallery;
