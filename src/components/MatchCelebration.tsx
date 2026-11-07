import { Modal, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { Luvball } from '@/components/Luvball';
import { colors, fonts } from '@/lib/theme';

type Props = {
  visible: boolean;
  name: string;
  onView: () => void;
  onClose: () => void;
};

/** "You caught each other!" pop-up. */
export function MatchCelebration({ visible, name, onView, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.hearts}>💞</Text>
          <View style={styles.balls}>
            <Luvball size={64} />
            <Luvball size={64} />
          </View>
          <Text style={styles.title}>You caught each other!</Text>
          <Text style={styles.body}>
            {name} threw a Luvball at you too. You're now in each other's Caught list.
          </Text>
          <View style={styles.buttons}>
            <ShellButton label={`See ${name}'s Entry`} onPress={onView} />
            <ShellButton variant="ghost" label="Keep exploring" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,34,48,0.75)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.luvRed,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 8,
    borderBottomColor: '#B92A3E',
  },
  hearts: { fontSize: 44 },
  balls: { flexDirection: 'row', gap: 12, marginVertical: 12 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 26, lineHeight: 32, color: colors.white, textAlign: 'center' },
  body: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21, color: colors.cream, textAlign: 'center', marginTop: 8 },
  buttons: { alignSelf: 'stretch', marginTop: 18, gap: 4 },
});
