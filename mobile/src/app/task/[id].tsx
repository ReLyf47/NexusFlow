import * as React from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Choice, Field, Txt } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { atLeast, STATUS_LABEL, TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '@/lib/types';

export default function TaskScreen() {
  const { id, documentId, status } = useLocalSearchParams<{ id: string; documentId?: string; status?: TaskStatus }>();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { snapshot, role, api, upsertTask, removeTask } = useWorkspace();
  const existing = id === 'new' ? null : snapshot.tasks.find((x) => x.id === id) ?? null;
  const canEdit = atLeast(role, 'Editor');

  const [form, setForm] = React.useState({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    status: existing?.status ?? status ?? ('todo' as TaskStatus),
    priority: existing?.priority ?? ('medium' as TaskPriority),
    assigneeId: existing?.assigneeId ?? '',
    dueDate: existing?.dueDate ?? '',
    documentId: existing?.documentId ?? documentId ?? '',
  });
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (id !== 'new' && !existing) {
    return (
      <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 20, gap: 12, backgroundColor: t.canvas }}>
        <Txt variant="h2">Tugas tidak ditemukan</Txt>
        <Btn title="KEMBALI" onPress={() => router.back()} />
      </View>
    );
  }

  const submit = async () => {
    if (form.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) return Alert.alert('Tenggat tidak valid', 'Gunakan format YYYY-MM-DD.');
    setBusy(true);
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
      documentId: form.documentId || null,
    };
    try {
      upsertTask(existing ? await api.updateTask(existing.id, body) : await api.createTask(snapshot.workspace.id, body));
      router.back();
    } catch (e) {
      Alert.alert('Gagal menyimpan', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Hapus tugas', `Hapus "${existing!.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTask(existing!.id);
            removeTask(existing!.id);
            router.back();
          } catch (e) {
            Alert.alert('Gagal', (e as Error).message);
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.surface }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: insets.top + 18, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 3, borderColor: t.border, paddingBottom: 10 }}>
          <Txt variant="h2">{existing ? (canEdit ? 'Edit Tugas' : 'Detail Tugas') : 'Tugas Baru'}</Txt>
          <Btn title="✕" variant="ghost" onPress={() => router.back()} accessibilityLabel="Tutup" />
        </View>
        {existing?.extractedByAi && <Txt variant="monoBold" color={t.purple} style={{ fontSize: 10 }}>[AI_EXTRACT] dibuat dari ekstraksi AI</Txt>}
        <Field label="Judul" value={form.title} onChangeText={(v) => set('title', v)} editable={canEdit} maxLength={255} />
        <Field label="Deskripsi" value={form.description} onChangeText={(v) => set('description', v)} editable={canEdit} multiline style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 10 }} />
        <Choice label="Status" value={form.status} disabled={!canEdit} onChange={(v) => set('status', v)} options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        <Choice label="Prioritas" value={form.priority} disabled={!canEdit} onChange={(v) => set('priority', v)} options={TASK_PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() }))} />
        <Choice
          label="Penanggung jawab"
          value={form.assigneeId}
          disabled={!canEdit}
          onChange={(v) => set('assigneeId', v)}
          options={[{ value: '', label: '— BELUM —' }, ...snapshot.members.map((m) => ({ value: m.userId, label: m.name.split(' ')[0] }))]}
        />
        <Field label="Tenggat (YYYY-MM-DD)" value={form.dueDate} onChangeText={(v) => set('dueDate', v)} editable={canEdit} placeholder="2026-12-01" keyboardType="numbers-and-punctuation" />
        <Choice
          label="Dokumen asal (originDocId)"
          value={form.documentId}
          disabled={!canEdit}
          onChange={(v) => set('documentId', v)}
          options={[{ value: '', label: '— TANPA —' }, ...snapshot.documents.filter((d) => !d.isArchived || d.id === form.documentId).map((d) => ({ value: d.id, label: d.title.slice(0, 28) }))]}
        />
        {canEdit && <Btn title={existing ? 'SIMPAN' : 'BUAT_TUGAS'} variant="holo" loading={busy} disabled={form.title.trim().length < 2} onPress={submit} />}
        {canEdit && existing && <Btn title="HAPUS_TUGAS" variant="ghost" onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
