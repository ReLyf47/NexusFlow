import * as React from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Header } from '@/components/header';
import { Brutal, Btn, Txt } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { atLeast, DEFAULT_PROJECT } from '@/lib/types';

export default function DocsScreen() {
  const { t } = useTheme();
  const { snapshot, role, api, upsertDoc, reload } = useWorkspace();
  const [project, setProject] = React.useState<string | null>(null);
  const [archived, setArchived] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const live = snapshot.documents.filter((d) => !d.isArchived);
  const projects = [...new Set(live.map((d) => d.projectName))].sort();
  const docs = snapshot.documents.filter((d) => d.isArchived === archived && (!project || d.projectName === project));
  const canEdit = atLeast(role, 'Editor');

  const create = async () => {
    setCreating(true);
    try {
      const { document } = await api.createDocument(snapshot.workspace.id, {
        title: 'Catatan Baru',
        content: '',
        projectName: project ?? DEFAULT_PROJECT,
      });
      upsertDoc(document);
      router.push({ pathname: '/docs/[id]', params: { id: document.id, edit: '1' } });
    } finally {
      setCreating(false);
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ borderWidth: 2, borderColor: t.border, backgroundColor: on ? t.border : t.surface, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Txt variant="monoBold" color={on ? t.surface : t.text} style={{ fontSize: 11 }}>{label}</Txt>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <Header title="DIRECTORY_ROOT" />
      <View style={{ paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {chip(`SEMUA (${live.length})`, !project && !archived, () => { setProject(null); setArchived(false); })}
          {projects.map((p) => chip(p, project === p, () => { setProject(project === p ? null : p); setArchived(false); }))}
          {snapshot.documents.some((d) => d.isArchived) && chip('ARSIP', archived, () => setArchived(!archived))}
        </ScrollView>
      </View>
      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={t.text} />}
        ListEmptyComponent={
          <Brutal style={{ padding: 18, gap: 10 }}>
            <Txt variant="label" color={t.pink}>// EMPTY</Txt>
            <Txt variant="h2">Belum ada catatan</Txt>
            {canEdit && <Btn title="+ BUAT CATATAN PERTAMA" variant="holo" onPress={create} loading={creating} />}
          </Brutal>
        }
        renderItem={({ item }) => {
          const openTasks = snapshot.tasks.filter((x) => x.documentId === item.id && x.status !== 'done').length;
          return (
            <Pressable onPress={() => router.push({ pathname: '/docs/[id]', params: { id: item.id } })} accessibilityRole="button" accessibilityLabel={item.title}>
              <Brutal style={{ padding: 14, gap: 6 }} offset={3}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Txt variant="label" color={t.pink} numberOfLines={1} style={{ flex: 1 }}>{item.projectName.toUpperCase()}</Txt>
                  {openTasks > 0 && <Txt variant="tiny">{openTasks} tugas aktif</Txt>}
                </View>
                <Txt variant="bodyBold" numberOfLines={2} style={{ fontStyle: item.isArchived ? 'italic' : 'normal' }}>{item.title}</Txt>
                {item.tags.length > 0 && <Txt variant="tiny" numberOfLines={1}>{item.tags.map((x) => `#${x}`).join('  ')}</Txt>}
              </Brutal>
            </Pressable>
          );
        }}
      />
      {canEdit && (
        <Pressable
          onPress={create}
          disabled={creating}
          accessibilityRole="button"
          accessibilityLabel="Buat dokumen baru"
          style={{ position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, backgroundColor: t.border, borderWidth: 3, borderTopColor: t.neon.pink, borderRightColor: t.neon.yellow, borderBottomColor: t.neon.cyan, borderLeftColor: t.neon.mint, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="plus" size={26} color={t.surface} />
        </Pressable>
      )}
    </View>
  );
}
