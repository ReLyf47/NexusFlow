import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, ErrorBox, Field, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const TABS = [
  { name: 'docs', label: 'DOCS', icon: 'file-text' },
  { name: 'kanban', label: 'KANBAN', icon: 'trello' },
  { name: 'search', label: 'CARI', icon: 'search' },
  { name: 'settings', label: 'AKUN', icon: 'settings' },
] as const;

export default function AppLayout() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, snapshot, loadError, reload, api, selectWorkspace, signOut } = useSession();
  const [wsName, setWsName] = React.useState('');

  if (!user) return <Redirect href="/login" />;
  if (loadError)
    return (
      <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 40, gap: 12, backgroundColor: t.canvas }}>
        <ErrorBox message={loadError} onRetry={reload} />
        <Btn title="KELUAR" variant="outline" onPress={signOut} />
      </View>
    );
  if (!snapshot) {
    // Member of no workspace (e.g. removed): offer to create one
    return (
      <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 40, gap: 12, backgroundColor: t.canvas }}>
        <ActivityIndicator color={t.text} />
        <Txt variant="h2">Belum ada workspace</Txt>
        <Field label="Nama workspace" value={wsName} onChangeText={setWsName} />
        <Btn
          title="BUAT_WORKSPACE"
          variant="holo"
          disabled={wsName.trim().length < 2}
          onPress={async () => selectWorkspace((await api.createWorkspace(wsName.trim())).id)}
        />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.canvas } }}
      tabBar={({ state, navigateToTab }) => (
        <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderTopWidth: 3, borderColor: t.border, paddingBottom: insets.bottom, paddingTop: 6 }}>
          {state.routes.map((route, i) => {
            const tab = TABS.find((x) => x.name === route.name);
            if (!tab) return null;
            const focused = state.index === i;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={tab.label}
                onPress={() => !focused && navigateToTab(route.key)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 6, borderWidth: 2, borderColor: focused ? t.border : 'transparent', backgroundColor: focused ? t.canvas : 'transparent', gap: 2 }}
              >
                <Feather name={tab.icon} size={18} color={focused ? t.text : t.sub} />
                <Txt variant="monoBold" color={focused ? t.text : t.sub} style={{ fontSize: 10 }}>
                  {tab.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
