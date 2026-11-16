import * as React from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MarkdownView } from '@/components/markdown-view';
import { Badge, Brutal, Btn, Choice, ErrorBox, SectionLabel, Sticker, Txt, ViewerBanner } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { fonts, useTheme } from '@/lib/theme';
import { atLeast, DEFAULT_PROJECT, formatDue, isOverdue, NEXT_STATUS, STATUS_LABEL, type DocumentDTO, type RelatedContextDTO, type TaskDTO } from '@/lib/types';

const AUTOSAVE_MS = 3000; // NFR-REL-02
type Patch = { title?: string; content?: string; projectName?: string; tags?: string[]; isArchived?: boolean };

export default function DocumentScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { snapshot, role, api, upsertDoc, removeDoc, upsertTask } = useWorkspace();

  const [doc, setDoc] = React.useState<DocumentDTO | null>(null);
  const [context, setContext] = React.useState<RelatedContextDTO | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(edit === '1');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [tagInput, setTagInput] = React.useState('');
  const [save, setSave] = React.useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [summary, setSummary] = React.useState<{ state: 'idle' | 'loading' | 'done' | 'error'; bullets: string[]; message?: string }>({ state: 'idle', bullets: [] });
  const pending = React.useRef<Patch | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await api.getDocument(id);
      setDoc(res.document);
      setContext(res.context);
      setTitle(res.document.title);
      setContent(res.document.content);
      const saved = (res.document.summary ?? '').split('\n').map((l) => l.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
      if (saved.length) setSummary({ state: 'done', bullets: saved });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, id]);
  React.useEffect(() => void load(), [load]);

  const flush = React.useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (!patch) return;
    pending.current = null;
    setSave('saving');
    try {
      const res = await api.updateDocument(id, patch);
      setDoc(res.document);
      setContext(res.context);
      upsertDoc(res.document);
      setSave(pending.current ? 'dirty' : 'saved');
    } catch (e) {
      pending.current = { ...patch, ...(pending.current as Patch | null) };
      setSave('error');
      Alert.alert('Gagal menyimpan', (e as Error).message);
    }
  }, [api, id, upsertDoc]);

  const queue = (patch: Patch, immediate = false) => {
    pending.current = { ...pending.current, ...patch };
    setSave('dirty');
    clearTimeout(timer.current);
    if (immediate) void flush();
    else timer.current = setTimeout(flush, AUTOSAVE_MS);
  };
  // Save pending edits when leaving the screen
  React.useEffect(() => () => void flush(), [flush]);

  if (error) return <View style={{ flex: 1, padding: 16, paddingTop: insets.top + 16 }}><ErrorBox message={error} onRetry={load} /></View>;
  if (!doc) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={t.text} /></View>;

  const canEdit = atLeast(role, 'Editor') && !doc.isArchived;
  const canRemove = role === 'Admin' || (atLeast(role, 'Editor') && doc.authorId === snapshot.me.id);
  const linked = snapshot.tasks.filter((x) => x.documentId === doc.id);
  const projects = [...new Set([DEFAULT_PROJECT, doc.projectName, ...snapshot.documents.map((d) => d.projectName)])].sort();
  const aiLabel = `${snapshot.workspace.llm.provider.toUpperCase()} // ${snapshot.workspace.llm.model.toUpperCase()}`;

  const openWiki = (wikiTitle: string) => {
    const target = snapshot.documents.find((d) => !d.isArchived && d.title.toLowerCase() === wikiTitle.toLowerCase());
    if (target) router.push({ pathname: '/docs/[id]', params: { id: target.id } });
    else Alert.alert('Dokumen belum ada', `"${wikiTitle}" belum dibuat di workspace ini.`);
  };

  const runSummary = async () => {
    setSummary((s) => ({ ...s, state: 'loading' }));
    try {
      const res = await api.summarize(doc.id);
      setSummary({ state: 'done', bullets: res.summary });
    } catch (e) {
      setSummary((s) => ({ ...s, state: 'error', message: (e as Error).message }));
    }
  };

  const cycle = async (task: TaskDTO) => {
    upsertTask({ ...task, status: NEXT_STATUS[task.status] });
    try {
      upsertTask(await api.setTaskStatus(task.id, NEXT_STATUS[task.status]));
    } catch (e) {
      upsertTask(task);
      Alert.alert('Gagal', (e as Error).message);
    }
  };

  const remove = () =>
    Alert.alert('Hapus dokumen', `Arsipkan atau hapus permanen "${doc.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Arsipkan', onPress: () => queue({ isArchived: true }, true) },
      {
        text: 'Hapus permanen',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteDocument(doc.id, true);
            removeDoc(doc.id);
            router.back();
          } catch (e) {
            Alert.alert('Gagal', (e as Error).message);
          }
        },
      },
    ]);

  const saveLabel = { saved: 'TERSIMPAN', dirty: 'BELUM_TERSIMPAN', saving: 'MENYIMPAN…', error: 'GAGAL — KETUK' }[save];
  const saveTone = ({ saved: 'live', dirty: 'urgent', saving: 'cyan', error: 'hazard' } as const)[save];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.canvas }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: t.surface, borderBottomWidth: 3, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Kembali" style={{ padding: 8 }}>
          <Feather name="arrow-left" size={22} color={t.text} />
        </Pressable>
        <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>{`${doc.projectName.toUpperCase()} / NOTES.MD`}</Txt>
        {atLeast(role, 'Editor') ? (
          <Pressable onPress={() => save === 'error' && void flush()} accessibilityLabel={`Status simpan ${saveLabel}`}>
            <Badge label={saveLabel} tone={saveTone} />
          </Pressable>
        ) : (
          <Badge label="READ_ONLY" tone="urgent" />
        )}
      </View>
      {role === 'Viewer' && <ViewerBanner />}

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {doc.isArchived && (
          <View style={{ borderWidth: 2.5, borderStyle: 'dashed', borderColor: t.border, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="monoBold">Dokumen diarsipkan.</Txt>
            {canRemove && <Btn title="PULIHKAN" variant="outline" onPress={() => queue({ isArchived: false }, true)} />}
          </View>
        )}
        <Sticker label={aiLabel} />
        {editing ? (
          <TextInput
            accessibilityLabel="Judul dokumen"
            value={title}
            onChangeText={(v) => { setTitle(v); if (v.trim()) queue({ title: v.trim() }); }}
            style={{ fontFamily: fonts.display, fontSize: 24, color: t.text, borderWidth: 2.5, borderColor: t.border, backgroundColor: t.surface, padding: 10, textTransform: 'uppercase' }}
          />
        ) : (
          <Txt variant="display">{title}</Txt>
        )}

        <Choice
          label="Proyek"
          value={doc.projectName}
          disabled={!canEdit}
          options={projects.map((p) => ({ value: p, label: p }))}
          onChange={(p) => { setDoc({ ...doc, projectName: p }); queue({ projectName: p }, true); }}
        />

        <View style={{ gap: 6 }}>
          <Txt variant="label">Tags</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {doc.tags.map((tag) => (
              <Pressable key={tag} disabled={!canEdit} onPress={() => { const next = doc.tags.filter((x) => x !== tag); setDoc({ ...doc, tags: next }); queue({ tags: next }, true); }}
                accessibilityLabel={canEdit ? `Hapus tag ${tag}` : `Tag ${tag}`}>
                <Badge label={`#${tag}${canEdit ? ' ×' : ''}`} />
              </Pressable>
            ))}
            {canEdit && (
              <TextInput
                accessibilityLabel="Tambah tag"
                placeholder="+tag"
                placeholderTextColor={t.muted}
                value={tagInput}
                onChangeText={setTagInput}
                autoCapitalize="none"
                onSubmitEditing={() => {
                  const tag = tagInput.trim().replace(/^#+/, '').toLowerCase();
                  setTagInput('');
                  if (tag && !doc.tags.includes(tag)) { const next = [...doc.tags, tag]; setDoc({ ...doc, tags: next }); queue({ tags: next }, true); }
                }}
                style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: t.border, color: t.text, fontFamily: fonts.monoBold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, minWidth: 80 }}
              />
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Btn title={summary.state === 'loading' ? 'MEMPROSES…' : 'RINGKASAN_AI'} loading={summary.state === 'loading'} disabled={!canEdit} onPress={runSummary} icon={<Feather name="zap" size={14} color={t.orange} />} />
          <Btn title="EKSTRAK_TUGAS_AI" variant="holo" disabled={!canEdit} onPress={() => router.push({ pathname: '/extract/[docId]', params: { docId: doc.id } })} />
          {canEdit && <Btn title={editing ? 'PRATINJAU' : 'EDIT'} variant="outline" onPress={() => { void flush(); setEditing(!editing); }} />}
          {canRemove && <Btn title="⋯" variant="outline" onPress={remove} accessibilityLabel="Aksi dokumen" />}
        </View>

        {summary.state === 'error' && <ErrorBox message={summary.message ?? 'Gagal'} onRetry={runSummary} />}
        {summary.state === 'done' && (
          <Brutal style={{ padding: 14, gap: 8 }}>
            <Txt variant="label" color={t.pink}>AI_EXECUTIVE_SUMMARY</Txt>
            {summary.bullets.map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                <Txt variant="monoBold" color={t.pink}>→</Txt>
                <Txt style={{ flex: 1 }}>{b}</Txt>
              </View>
            ))}
          </Brutal>
        )}

        <Brutal style={{ padding: editing ? 0 : 16 }}>
          {editing ? (
            <TextInput
              accessibilityLabel="Isi dokumen (Markdown)"
              multiline
              value={content}
              onChangeText={(v) => { setContent(v); queue({ content: v }); }}
              onBlur={() => void flush()}
              placeholder="Tulis Markdown. [[Judul]] menautkan dokumen lain."
              placeholderTextColor={t.muted}
              textAlignVertical="top"
              style={{ minHeight: 320, padding: 14, color: t.text, fontFamily: fonts.mono, fontSize: 13, lineHeight: 20 }}
            />
          ) : (
            <MarkdownView content={content} onWikiLink={openWiki} />
          )}
        </Brutal>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt variant="h2">Tiket Tertaut ({linked.length})</Txt>
          {canEdit && <Btn title="+ TUGAS" variant="outline" onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', documentId: doc.id } })} />}
        </View>
        {linked.length === 0 && <Txt variant="mono">Belum ada tugas dari dokumen ini.</Txt>}
        {linked.map((task) => (
          <Brutal key={task.id} offset={3} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => cycle(task)} disabled={!atLeast(role, 'Editor')} accessibilityLabel={`Status ${STATUS_LABEL[task.status]}, ketuk untuk ganti`}>
              <Feather name={task.status === 'done' ? 'check-circle' : task.status === 'in_progress' ? 'play-circle' : 'circle'} size={22} color={task.status === 'done' ? t.mint : task.status === 'in_progress' ? t.cyan : t.muted} />
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}>
              <Txt variant="monoBold" style={task.status === 'done' ? { textDecorationLine: 'line-through', color: t.muted } : undefined}>{task.title}</Txt>
              <Txt variant="tiny" color={isOverdue(task) ? t.pink : t.muted}>
                {STATUS_LABEL[task.status]} · {task.assigneeName ?? 'Unassigned'}{task.dueDate ? ` · ${formatDue(task.dueDate)}` : ''}
              </Txt>
            </Pressable>
          </Brutal>
        ))}

        {context && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <Txt variant="h2">Konteks Tertaut</Txt>
              <Badge label={`${context.stats.activeConnections} AKTIF`} tone="live" />
            </View>
            {context.ranked.length === 0 && context.backlinks.length === 0 && <Txt variant="mono">Belum ada konteks — tambahkan proyek, tag, atau [[wikilink]].</Txt>}
            {context.ranked.length > 0 && <SectionLabel>RELATED_DOCS</SectionLabel>}
            {context.ranked.map((r) => (
              <Pressable key={r.id} onPress={() => router.push({ pathname: '/docs/[id]', params: { id: r.id } })}>
                <Brutal offset={2} style={{ padding: 10, gap: 2 }} bg={t.elevated}>
                  <Txt variant="monoBold" numberOfLines={1}>{r.title}</Txt>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt variant="tiny" numberOfLines={1} style={{ flex: 1 }}>
                      {[r.sameProject && 'proyek sama', r.linked && 'tertaut', ...r.matchedTags.map((x) => `#${x}`)].filter(Boolean).join(' · ')}
                    </Txt>
                    <Txt variant="monoBold" style={{ fontSize: 10 }} color={r.score >= 0.9 ? t.cyan : r.score >= 0.7 ? t.purple : t.sub}>{Math.round(r.score * 100)}% MATCH</Txt>
                  </View>
                </Brutal>
              </Pressable>
            ))}
            {context.backlinks.length > 0 && <SectionLabel>{`INBOUND_BACKLINKS (${context.backlinks.length})`}</SectionLabel>}
            {context.backlinks.map((l) => (
              <Pressable key={l.id} onPress={() => router.push({ pathname: '/docs/[id]', params: { id: l.id } })}>
                <Brutal offset={2} style={{ padding: 10 }} bg={t.elevated}>
                  <Txt variant="monoBold" numberOfLines={1}>{l.title}</Txt>
                  <Txt variant="tiny" style={{ fontStyle: 'italic' }}>menautkan ke [[{l.anchorText}]]</Txt>
                </Brutal>
              </Pressable>
            ))}
            <Txt variant="tiny">
              GRAPH_TOPOLOGY · OUTBOUND {context.stats.outbound} · BACKLINKS {context.stats.inbound} · TASKS {linked.length}
            </Txt>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
