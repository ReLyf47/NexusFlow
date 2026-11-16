// Artistic Clash primitives for React Native.
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { fonts, useTheme } from '@/lib/theme';

type TxtVariant = 'display' | 'h2' | 'body' | 'bodyBold' | 'mono' | 'monoBold' | 'label' | 'tiny';

export function Txt({ variant = 'body', color, style, ...props }: TextProps & { variant?: TxtVariant; color?: string }) {
  const { t } = useTheme();
  const v: Record<TxtVariant, object> = {
    display: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, textTransform: 'uppercase', color: t.text },
    h2: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, textTransform: 'uppercase', color: t.text },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25.6, color: t.text },
    bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24, color: t.text },
    mono: { fontFamily: fonts.mono, fontSize: 12, color: t.sub },
    monoBold: { fontFamily: fonts.monoBold, fontSize: 12, color: t.text },
    label: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: t.muted },
    tiny: { fontFamily: fonts.mono, fontSize: 10, color: t.muted },
  };
  return <Text {...props} style={[v[variant], color ? { color } : null, style]} />;
}

// Brutal frame: 3px border + hard offset shadow (an actual offset block, crisp on Android & iOS)
export function Brutal({ children, style, offset = 4, bg }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; offset?: number; bg?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ marginRight: offset, marginBottom: offset }}>
      <View style={[StyleSheet.absoluteFill, { top: offset, left: offset, right: -offset, bottom: -offset, backgroundColor: t.shadow }]} />
      <View style={[{ borderWidth: 3, borderColor: t.border, backgroundColor: bg ?? t.surface }, style]}>{children}</View>
    </View>
  );
}

type BtnVariant = 'default' | 'holo' | 'outline' | 'ghost' | 'danger';

export function Btn({
  title,
  variant = 'default',
  icon,
  loading,
  disabled,
  style,
  ...props
}: PressableProps & { title: string; variant?: BtnVariant; icon?: React.ReactNode; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const off = disabled || loading;
  const frame: Record<BtnVariant, ViewStyle> = {
    default: { backgroundColor: t.surface, borderWidth: 2.5, borderColor: t.border },
    // prism lives in the frame, label stays on a solid fill (readability rule)
    holo: {
      backgroundColor: t.border,
      borderWidth: 3,
      borderTopColor: t.neon.pink,
      borderRightColor: t.neon.yellow,
      borderBottomColor: t.neon.cyan,
      borderLeftColor: t.neon.mint,
    },
    outline: { borderWidth: 2, borderColor: t.border },
    ghost: {},
    danger: { backgroundColor: t.neon.pink, borderWidth: 2.5, borderColor: t.border },
  };
  const color = variant === 'holo' ? t.surface : variant === 'danger' ? t.neon.ink : variant === 'ghost' ? t.sub : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      {...props}
      style={({ pressed }) => [
        { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off ? 0.4 : 1 },
        frame[variant],
        pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : icon}
      <Txt variant="monoBold" color={color} style={{ fontSize: 12 }}>
        {title}
      </Txt>
    </Pressable>
  );
}

type BadgeTone = 'dream' | 'live' | 'urgent' | 'cyan' | 'hazard' | 'brutal';
export function Badge({ label, tone = 'dream' }: { label: string; tone?: BadgeTone }) {
  const { t } = useTheme();
  const bg: Record<BadgeTone, string> = { dream: t.elevated, live: t.neon.mint, urgent: t.neon.yellow, cyan: t.neon.cyan, hazard: t.neon.pink, brutal: t.border };
  const fg = tone === 'dream' ? t.text : tone === 'brutal' ? t.surface : t.neon.ink;
  return (
    <View style={{ borderWidth: 2, borderColor: t.border, backgroundColor: bg[tone], borderRadius: tone === 'brutal' ? 0 : 99, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Txt variant="monoBold" color={fg} style={{ fontSize: 9, textTransform: 'uppercase' }}>
        {label}
      </Txt>
    </View>
  );
}

// Y2K chrome sticker, tilted off-grid (Clash Pair 5)
export function Sticker({ label }: { label: string }) {
  const { t, dark } = useTheme();
  return (
    <View
      style={{
        transform: [{ rotate: '-1.5deg' }],
        borderWidth: 2.5,
        borderColor: t.border,
        backgroundColor: dark ? '#334155' : '#E2E8F0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Txt variant="monoBold" numberOfLines={1} color={dark ? '#FFFFFF' : '#0A0A0C'} style={{ fontSize: 10 }}>
        <Txt variant="monoBold" color={t.pink} style={{ fontSize: 10 }}>
          ✦{' '}
        </Txt>
        {label}
      </Txt>
    </View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <Txt variant="label">{label}</Txt>}
      <TextInput
        placeholderTextColor={t.muted}
        accessibilityLabel={label}
        {...props}
        style={[
          { minHeight: 46, borderWidth: 2.5, borderColor: t.border, backgroundColor: t.elevated, color: t.text, paddingHorizontal: 12, fontFamily: fonts.monoBold, fontSize: 13 },
          props.editable === false && { opacity: 0.6 },
          style,
        ]}
      />
    </View>
  );
}

// Horizontal single-choice chips (replaces <select> on mobile)
export function Choice<T extends string>({ value, options, onChange, disabled, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; label?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <Txt variant="label">{label}</Txt>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled }}
              onPress={() => onChange(o.value)}
              style={{ borderWidth: 2, borderColor: t.border, backgroundColor: on ? t.border : t.surface, paddingHorizontal: 10, paddingVertical: 8, opacity: disabled && !on ? 0.5 : 1 }}
            >
              <Txt variant="monoBold" color={on ? t.surface : t.text} style={{ fontSize: 11 }}>
                {o.label}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Txt variant="label" style={{ marginTop: 6 }}>{`// ${children}`}</Txt>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ borderWidth: 2.5, borderColor: t.border, backgroundColor: t.neon.yellow, padding: 12, gap: 10 }}>
      <Txt variant="monoBold" color={t.neon.ink}>
        {message}
      </Txt>
      {onRetry && <Btn title="COBA_LAGI" onPress={onRetry} style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

export function ViewerBanner() {
  const { t } = useTheme();
  return (
    <View style={{ backgroundColor: t.neon.yellow, borderBottomWidth: 3, borderColor: t.border, paddingHorizontal: 14, paddingVertical: 8 }}>
      <Txt variant="monoBold" color={t.neon.ink} style={{ fontSize: 11 }}>
        [MODE: READ-ONLY] Izin Viewer — pengeditan, tiket tugas & AI dinonaktifkan.
      </Txt>
    </View>
  );
}
