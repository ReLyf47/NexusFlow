import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brutal, Btn, Choice, ErrorBox, Txt } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { TASK_PRIORITIES, type ActionItemDraftDTO } from '@/lib/types';

type Draft = ActionItemDraftDTO & { checked: boolean };

// SDD 5.1 state machine: FetchingAIResult -> ReviewDraftTasks -> CommitTasks
export default function ExtractScreen() {
  const { docId } = useLocalSearchParams<{ docId: string }>();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { snapshot, api, upsertTask } = useWorkspace();
  const [phase, setPhase] = React.useState<'loading' | 'error' | 'review'>('loading');
  const [message, setMessage] = React.useState('');
  const [engine, setEngine] = React.useState('');
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [committing, setCommitting] = React.useState(false);

  const extract = React.useCallback(async () => {
    setPhase('loading');
    try {
      const res = await api.extract(docId);
      setEngine(res.engine);
      setDrafts(res.actionItems.map((d) => ({ ...d, checked: true })));
      setPhase('review');
    } catch (e) {
      setMessage((e as Error).message);
      setPhase('error');
    }
  }, [api, docId]);
  React.useEffect(() => void extract(), [extract]);

  const update = (i: number, patch: Partial<Draft>) => setDrafts((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const selected = drafts.filter((d) => d.checked);

  const commit = async () => {
    setCommitting(true);
    try {
      const created = await api.commitTasks(
        snapshot.workspace.id,
        docId,
        selected.map(({ title, description, priority, assigneeId, dueDate }) => ({ title, description, priority, assigneeId, dueDate }))
      );
      created.forEach(upsertTask);
      router.back();
    } catch (e) {
      setMessage((e as Error).message);
      setPhase('error');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      {/* holographic frame while the model computes (BorderBeam equivalent) */}
      <View style={{ height: 6, flexDirection: 'row' }}>
        {[t.neon.pink, t.neon.orange, t.neon.yellow, t.neon.mint, t.neon.cyan].map((c) => (
          <View key={c} style={{ flex: 1, backgroundColor: phase === 'loading' || committing ? c : t.border }} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: insets.top + 12, gap: 14, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 3, borderColor: t.border, paddingBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="h2">Ekstraksi Tugas AI</Txt>
            <Txt variant="tiny">ENGINE: <Txt variant="tiny" color={t.cyan}>{engine || `${snapshot.workspace.llm.provider.toUpperCase()} // ${snapshot.workspace.llm.model.toUpperCase()}`}</Txt></Txt>
          </View>
          <Btn title="✕" variant="ghost" onPress={() => router.back()} accessibilityLabel="Tutup" />
        </View>

        {phase === 'loading' && (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={t.text} size="large" />
            <Txt variant="monoBold">✺ MEMPROSES… menganalisis notula</Txt>
            <Txt variant="tiny">Batas waktu 15 detik</Txt>
          </View>
        )}
        {phase === 'error' && <ErrorBox message={message} onRetry={extract} />}
        {phase === 'review' && (
          <>
            <Txt>{drafts.length ? `Ditemukan ${drafts.length} action item. Tinjau sebelum dikirim ke Kanban:` : 'Tidak ditemukan action item eksplisit.'}</Txt>
            {drafts.map((d, i) => (
              <Brutal key={i} offset={3} style={{ padding: 12, gap: 10 }} bg={t.elevated}>
                <Pressable onPress={() => update(i, { checked: !d.checked })} accessibilityRole="checkbox" accessibilityState={{ checked: d.checked }} style={{ flexDirection: 'row', gap: 10 }}>
                  <Feather name={d.checked ? 'check-square' : 'square'} size={20} color={d.checked ? t.pink : t.muted} />
                  <Txt variant="monoBold" style={{ flex: 1 }}>{d.title}</Txt>
                </Pressable>
                <Choice
                  label={d.assigneeHint && !d.assigneeId ? `PIC (saran AI: ${d.assigneeHint})` : 'PIC'}
                  value={d.assigneeId ?? ''}
                  onChange={(v) => update(i, { assigneeId: v || null })}
                  options={[{ value: '', label: '—' }, ...snapshot.members.map((m) => ({ value: m.userId, label: m.name.split(' ')[0] }))]}
                />
                <Choice label={`Prioritas${d.dueDate ? ` · DUE ${d.dueDate}` : ''}`} value={d.priority} onChange={(v) => update(i, { priority: v })} options={TASK_PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() }))} />
              </Brutal>
            ))}
            <Txt variant="tiny">Tugas otomatis mengikat originDocId catatan ini.</Txt>
            <Btn title={`✓ KONFIRMASI_KE_KANBAN (${selected.length})`} variant="holo" loading={committing} disabled={!selected.length} onPress={commit} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
