import * as React from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Header } from '@/components/header';
import { Badge, Brutal, Btn, Txt } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { atLeast, formatDue, isOverdue, PRIORITY_ORDER, STATUS_LABEL, TASK_STATUSES, type TaskDTO, type TaskStatus } from '@/lib/types';

const COLOR = { backlog: 'sub', todo: 'orange', in_progress: 'cyan', done: 'mint' } as const;

export default function KanbanScreen() {
  const { t } = useTheme();
  const { snapshot, role, api, upsertTask, reload } = useWorkspace();
  const [status, setStatus] = React.useState<TaskStatus>('todo');
  const [mine, setMine] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const canEdit = atLeast(role, 'Editor');
  const docTitle = new Map(snapshot.documents.map((d) => [d.id, d.title]));

  const visible = snapshot.tasks.filter((x) => !mine || x.assigneeId === snapshot.me.id);
  const column = visible
    .filter((x) => x.status === status)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));

  // Touch alternative to drag-and-drop: move a card one column left/right (optimistic, rolled back on error)
  const move = async (task: TaskDTO, dir: -1 | 1) => {
    const next = TASK_STATUSES[TASK_STATUSES.indexOf(task.status) + dir];
    if (!next) return;
    upsertTask({ ...task, status: next });
    try {
      upsertTask(await api.setTaskStatus(task.id, next));
    } catch (e) {
      upsertTask(task);
      Alert.alert('Gagal', (e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="KANBAN_MATRIX" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {TASK_STATUSES.map((s) => {
          const on = s === status;
          const count = visible.filter((x) => x.status === s).length;
          return (
            <Pressable key={s} onPress={() => setStatus(s)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ borderWidth: 2.5, borderColor: t.border, backgroundColor: on ? t.border : t.surface, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Txt variant="monoBold" color={on ? t.surface : t[COLOR[s]]} style={{ fontSize: 11 }}>{`0${TASK_STATUSES.indexOf(s) + 1} // ${STATUS_LABEL[s]}`}</Txt>
              <Txt variant="monoBold" color={on ? t.surface : t.text} style={{ fontSize: 11 }}>{count}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}>
        <Btn title="TUGAS_SAYA" variant={mine ? 'holo' : 'outline'} onPress={() => setMine(!mine)} style={{ flex: 1 }} />
        {canEdit && <Btn title="+ TUGAS_BARU" onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', status } })} style={{ flex: 1 }} />}
      </View>
      <FlatList
        data={column}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={t.text} />}
        ListEmptyComponent={<View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: t.border, padding: 20 }}><Txt variant="mono" style={{ textAlign: 'center' }}>Tidak ada tiket di kolom ini.</Txt></View>}
        renderItem={({ item }) => (
          <Brutal offset={3} style={{ padding: 12, gap: 8 }} bg={t.elevated}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Badge label={item.priority} tone={item.priority === 'urgent' ? 'hazard' : item.priority === 'high' ? 'urgent' : 'dream'} />
              {item.extractedByAi && <Txt variant="monoBold" color={t.purple} style={{ fontSize: 9 }}>[AI_EXTRACT]</Txt>}
            </View>
            <Pressable onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id } })} accessibilityRole="button">
              <Txt variant="monoBold" style={item.status === 'done' ? { textDecorationLine: 'line-through', color: t.muted } : undefined}>{item.title}</Txt>
            </Pressable>
            {item.documentId && docTitle.get(item.documentId) && (
              <Pressable onPress={() => router.push({ pathname: '/docs/[id]', params: { id: item.documentId! } })}>
                <Txt variant="monoBold" color={t.pink} style={{ fontSize: 10 }} numberOfLines={1}>REF: {docTitle.get(item.documentId)}</Txt>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: t.border, paddingTop: 8 }}>
              <Txt variant="tiny" numberOfLines={1} style={{ flex: 1 }}>
                {item.assigneeName ?? 'Unassigned'}
                {item.dueDate ? <Txt variant="tiny" color={isOverdue(item) ? t.pink : t.orange}>{`  ${isOverdue(item) ? 'LEWAT · ' : ''}${formatDue(item.dueDate)}`}</Txt> : null}
              </Txt>
              {canEdit && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {item.status !== 'backlog' && (
                    <Pressable onPress={() => move(item, -1)} accessibilityLabel="Pindah ke kolom sebelumnya" style={{ borderWidth: 2, borderColor: t.border, padding: 6 }}>
                      <Feather name="chevron-left" size={16} color={t.text} />
                    </Pressable>
                  )}
                  {item.status !== 'done' && (
                    <Pressable onPress={() => move(item, 1)} accessibilityLabel="Pindah ke kolom berikutnya" style={{ borderWidth: 2, borderColor: t.border, padding: 6 }}>
                      <Feather name="chevron-right" size={16} color={t.text} />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </Brutal>
        )}
      />
    </View>
  );
}
