// Same design tokens as the web app's globals.css (Artistic Clash, WCAG-verified pairs).
import * as React from 'react';
import { useColorScheme } from 'react-native';
import { storage } from './storage';

const neon = { pink: '#FF1A75', cyan: '#00F0FF', mint: '#00E5A3', yellow: '#FFE600', orange: '#FF8A00', ink: '#0A0A0C' };

export const palettes = {
  light: {
    canvas: '#F4F3EE', surface: '#FFFFFF', elevated: '#FAF9F5', border: '#0A0A0C', text: '#0A0A0C', sub: '#3E404C', muted: '#646675',
    shadow: '#0A0A0C', shadowLg: '#0A0A0C',
    // accent "ink" colours that pass AA as text on light surfaces
    pink: '#C8005A', cyan: '#00737A', mint: '#00704F', orange: '#A64B00', yellow: '#7A6200', purple: '#7928CA',
    neon,
  },
  dark: {
    canvas: '#07080C', surface: '#0E1017', elevated: '#151824', border: '#FFFFFF', text: '#F4F4F6', sub: '#B5B8C8', muted: '#82869A',
    shadow: '#00F0FF', shadowLg: '#FF1A75',
    pink: '#FF1A75', cyan: '#00F0FF', mint: '#00E5A3', orange: '#FF8A00', yellow: '#FFE600', purple: '#B98CFF',
    neon,
  },
};
export type Palette = typeof palettes.light;

export const fonts = {
  display: 'Syne_800ExtraBold',
  tech: 'SpaceGrotesk_700Bold',
  body: 'PlusJakartaSans_400Regular',
  bodyBold: 'PlusJakartaSans_700Bold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
};

type Mode = 'system' | 'light' | 'dark';
const ThemeContext = React.createContext<{ t: Palette; dark: boolean; mode: Mode; setMode: (m: Mode) => void }>({
  t: palettes.light,
  dark: false,
  mode: 'system',
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = React.useState<Mode>('system');
  React.useEffect(() => {
    storage.get('nf_theme').then((m) => (m === 'light' || m === 'dark') && setModeState(m));
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    void storage.set('nf_theme', m);
  };
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return <ThemeContext.Provider value={{ t: dark ? palettes.dark : palettes.light, dark, mode, setMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => React.useContext(ThemeContext);
