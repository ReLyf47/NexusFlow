import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brutal, Btn, ErrorBox, Field, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, serverUrl, signIn, signUp } = useSession();
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [server, setServer] = React.useState(serverUrl);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (user) return <Redirect href="/docs" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await signIn(server, email, password);
      else await signUp(server, name, email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.canvas }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 32, gap: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, backgroundColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ color: t.neon.cyan, fontSize: 24, lineHeight: 28 }}>✦</Txt>
          </View>
          <Txt variant="display" style={{ fontSize: 22 }}>
            NEXUS<Txt variant="display" color={t.pink} style={{ fontSize: 22 }}>//FLOW</Txt>
          </Txt>
        </View>

        <Brutal style={{ padding: 18, gap: 14 }}>
          <Txt variant="label" color={t.pink}>{mode === 'login' ? '// AUTH_LOGIN' : '// AUTH_REGISTER'}</Txt>
          <Txt variant="display">{mode === 'login' ? 'Masuk' : 'Buat Akun'}</Txt>
          <Field label="Server NexusFlow" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.10:3000" />
          {mode === 'register' && <Field label="Nama lengkap" value={name} onChangeText={setName} autoComplete="name" />}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onSubmitEditing={submit} />
          {error && <ErrorBox message={error} />}
          <Btn title={mode === 'login' ? 'MASUK' : 'DAFTAR'} variant="holo" loading={busy} disabled={!email || !password || (mode === 'register' && !name)} onPress={submit} />
          <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} accessibilityRole="button">
            <Txt variant="mono" style={{ textAlign: 'center' }}>
              {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              <Txt variant="monoBold" style={{ textDecorationLine: 'underline' }}>{mode === 'login' ? 'Daftar' : 'Masuk'}</Txt>
            </Txt>
          </Pressable>
        </Brutal>

        <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: t.border, padding: 12, gap: 2, backgroundColor: t.surface }}>
          <Txt variant="monoBold" style={{ fontSize: 11 }}>// DEMO (bun run db:seed) · nexusflow123</Txt>
          <Txt variant="tiny">alif@nexusflow.dev — Admin · sarah@ — Editor · rian@ — Viewer</Txt>
          <Txt variant="tiny">Emulator Android: http://10.0.2.2:3000 · HP fisik: IP LAN komputer</Txt>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
