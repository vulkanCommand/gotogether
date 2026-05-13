export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 22,
  xl: 26,
  pill: 999,
};

export const footerScrollPadding = 150;

export const typography = {
  eyebrow: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as const,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.7,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
};

export const shadows = {
  soft: {
    boxShadow: '0px 6px 16px rgba(15, 23, 42, 0.06)',
  },
  card: {
    boxShadow: '0px 10px 24px rgba(15, 23, 42, 0.06), 0px 2px 8px rgba(15, 23, 42, 0.03)',
  },
  floating: {
    boxShadow: '0px 12px 28px rgba(15, 23, 42, 0.1), 0px 3px 10px rgba(15, 23, 42, 0.04)',
  },
};
