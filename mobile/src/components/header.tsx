import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Txt, ViewerBanner } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { useTheme } from '@/lib/theme';

// Top bar shared by every tab: brand, workspace, effective role
export function Header({ title }: { title: string }) {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { snapshot, role } = useWorkspace();
  return (
    <View>
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: t.surface, borderBottomWidth: 3, borderColor: t.border, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 30, height: 30, backgroundColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
              <Txt style={{ color: dark ? t.neon.pink : t.neon.cyan, fontSize: 18, lineHeight: 22 }}>✦</Txt>
            </View>
            <Txt variant="h2">
              NEXUS<Txt variant="h2" color={t.pink}>//FLOW</Txt>
            </Txt>
          </View>
          <Badge label={role} tone={role === 'Admin' ? 'hazard' : role === 'Editor' ? 'cyan' : 'urgent'} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>{`// ${title}`}</Txt>
          <Txt variant="tiny" numberOfLines={1} style={{ maxWidth: '55%' }}>{snapshot.workspace.name}</Txt>
        </View>
      </View>
      {role === 'Viewer' && <ViewerBanner />}
    </View>
  );
}
