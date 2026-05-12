import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { hasSeenAppGuide, markAppGuideSeen } from '../services/appGuide';

type Props = {
  enabled: boolean;
};

type GuideSlide = {
  title: string;
  subtitle: string;
  body: string;
};

const slides: GuideSlide[] = [
  {
    title: 'Home',
    subtitle: 'See what is happening next.',
    body: 'Home helps you quickly check your next event, upcoming trips, and important crew updates in one place.',
  },
  {
    title: 'Trips',
    subtitle: 'Plan every trip with your crew.',
    body: 'Create trips, add friends, organize dates, choose destinations, and manage the full trip plan from one place.',
  },
  {
    title: 'Live',
    subtitle: 'Stay connected during the trip.',
    body: 'Use Live to follow active trip updates, check what is happening now, and keep everyone aligned while traveling.',
  },
  {
    title: 'Expenses',
    subtitle: 'Split costs without confusion.',
    body: 'Add shared expenses, track who paid, split costs with friends, and keep trip spending clear for everyone.',
  },
];

const illustration = require('../../assets/prototype/onboarding-illustration.png');

export default function AppGuideModal({ enabled }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<GuideSlide>>(null);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!enabled || hasChecked) {
      return;
    }

    const checkVisibility = async () => {
      const seen = await hasSeenAppGuide();

      if (!mounted) {
        return;
      }

      setVisible(!seen);
      setHasChecked(true);
    };

    void checkVisibility();

    return () => {
      mounted = false;
    };
  }, [enabled, hasChecked]);

  const lastIndex = slides.length - 1;
  const isLast = activeIndex === lastIndex;

  const footerLabel = useMemo(() => (isLast ? 'Continue' : 'Next'), [isLast]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (Number.isFinite(nextIndex)) {
      setActiveIndex(Math.max(0, Math.min(lastIndex, nextIndex)));
    }
  };

  const handlePrimaryAction = async () => {
    if (!isLast) {
      const nextIndex = Math.min(lastIndex, activeIndex + 1);
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
      return;
    }

    await markAppGuideSeen();
    setVisible(false);
  };

  return (
    <Modal visible={visible && enabled} transparent={false} animationType="fade" statusBarTranslucent>
      <LinearGradient colors={[colors.accent, colors.violet]} style={styles.screen}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={[styles.safeContent, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 28) }]}>
          <View style={styles.headerSpace} />

          <FlatList
            ref={listRef}
            data={slides}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.title}
            onMomentumScrollEnd={handleMomentumEnd}
            renderItem={({ item }) => (
              <View style={[styles.slide, { width }]}>
                <View style={styles.illustrationWrap}>
                  <Image source={illustration} style={styles.illustration} resizeMode="contain" />
                </View>

                <View style={styles.card}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                </View>
              </View>
            )}
          />

          <View style={styles.footer}>
            <View style={styles.dotsRow}>
              {slides.map((slide, index) => (
                <View key={slide.title} style={[styles.dot, index === activeIndex && styles.dotActive]} />
              ))}
            </View>

            <Pressable onPress={() => void handlePrimaryAction()} style={styles.buttonWrap}>
              <LinearGradient colors={[colors.accent, colors.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
                <Text style={styles.buttonText}>{footerLabel}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  safeContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerSpace: {
    height: 8,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  illustration: {
    width: 248,
    height: 248,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  title: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.accentStrong,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 32,
    gap: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  dotActive: {
    width: 22,
    backgroundColor: '#FFFFFF',
  },
  buttonWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  button: {
    minHeight: 54,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
