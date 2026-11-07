import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_PHOTOS, type LocalPhoto } from '@/lib/entry';
import { colors, fonts } from '@/lib/theme';

export type GridPhoto = { key: string; uri: string | null };

/** Opens the photo library and returns up to `limit` images. */
export async function pickPhotos(limit: number): Promise<LocalPhoto[]> {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

type Props = {
  photos: GridPhoto[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
  busy?: boolean;
};

/** 2×2 grid of photo slots. The first photo is the main one shown on the Radar. */
export function PhotoGrid({ photos, onAdd, onRemove, onMakeMain, busy }: Props) {
  const slots = Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i] ?? null);
  const firstEmpty = photos.length;
  return (
    <View style={styles.grid}>
      {slots.map((p, i) =>
        p ? (
          <View key={p.key} style={styles.slot}>
            {p.uri ? <Image source={{ uri: p.uri }} style={styles.image} /> : <View style={styles.image} />}
            {i === 0 ? (
              <View style={styles.mainBadge}>
                <Text style={styles.mainBadgeText}>MAIN</Text>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => onMakeMain(i)} style={styles.makeMain} disabled={busy}>
                <Text style={styles.makeMainText}>Make main</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              onPress={() => onRemove(i)}
              style={styles.remove}
              disabled={busy}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            key={`empty-${i}`}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            onPress={onAdd}
            disabled={busy || i !== firstEmpty}
            style={[styles.slot, styles.empty, i !== firstEmpty && styles.emptyIdle]}
          >
            {busy && i === firstEmpty ? (
              <ActivityIndicator color={colors.luvRed} />
            ) : (
              <>
                <Text style={styles.plus}>+</Text>
                {i === firstEmpty ? <Text style={styles.addText}>{i === 0 ? 'Add main photo' : 'Add photo'}</Text> : null}
              </>
            )}
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    width: '48%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  image: { width: '100%', height: '100%', backgroundColor: '#EEE' },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.luvRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIdle: { borderColor: colors.screenEdge, opacity: 0.7 },
  plus: { fontFamily: fonts.bodyHeavy, fontSize: 34, color: colors.luvRed, lineHeight: 38 },
  addText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.luvRed, marginTop: 2 },
  mainBadge: { position: 'absolute', left: 8, bottom: 8, backgroundColor: colors.luvRed, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  mainBadgeText: { fontFamily: fonts.pixelBold, fontSize: 10, color: colors.white, letterSpacing: 1 },
  makeMain: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(30,34,48,0.75)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  makeMainText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(30,34,48,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.white, fontSize: 14, fontFamily: fonts.bodyHeavy },
});
