import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/header';
import { Badge, Brutal, Choice, ErrorBox, Field, Txt } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { STATUS_LABEL, type SearchResultDTO } from '@/lib/types';

type SearchType = 'all' | 'notes' | 'tasks' | 'projects';

export default function SearchScreen() {
  const { t } = useTheme();
  const { snapshot, api } = useWorkspace();
  const [query, setQuery] = React.useState('');
  const [type, setType] = React.useState<SearchType>('all');
  const [results, setResults] = React.useState<SearchResultDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const seq = React.useRef(0);

  // Debounced; stale responses are ignored via the sequence counter
  React.useEffect(() => {
    if (!query.trim()) return setResults([]);
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(snapshot.workspace.id, query.trim(), type);
        if (id === seq.current) { setResults(res); setError(null); }
      } catch (e) {
        if (id === seq.current) { setResults([]); setError((e as Error).message); }
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, type, api, snapshot.workspace.id]);

  const open = (r: SearchResultDTO) => {
    if (r.type === 'note') router.push({ pathname: '/docs/[id]', params: { id: r.id } });
    else if (r.type === 'task') router.push({ pathname: '/task/[id]', params: { id: r.id } });
    else router.push('/docs');
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="PENCARIAN_TERPUSAT" />
      <View style={{ padding: 12, gap: 10 }}>
        <Field value={query} onChangeText={setQuery} placeholder="Cari catatan, tugas, tag, proyek…" autoCapitalize="none" returnKeyType="search" accessibilityLabel="Kata kunci pencarian" />
        <Choice value={type} onChange={setType} options={[{ value: 'all', label: 'SEMUA' }, { value: 'notes', label: 'CATATAN' }, { value: 'tasks', label: 'TUGAS' }, { value: 'projects', label: 'PROYEK' }]} />
      </View>
      {error && <View style={{ paddingHorizontal: 12 }}><ErrorBox message={error} /></View>}
      {loading && <ActivityIndicator color={t.text} style={{ marginTop: 8 }} />}
      <FlatList
        data={results}
        keyExtractor={(r) => `${r.type}-${r.id}`}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={!loading && query.trim() ? <Txt variant="mono" style={{ textAlign: 'center' }}>Tidak ditemukan hasil untuk &quot;{query}&quot;.</Txt>   : undefined}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} accessibilityRole="button">
            <Brutal offset={2} style={{ padding: 12, gap: 4 }} bg={t.elevated}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Badge label={item.type === 'note' ? 'NOTE' : item.type === 'task' ? 'TASK' : 'PROJECT'} tone={item.type === 'note' ? 'cyan' : item.type === 'task' ? 'urgent' : 'live'} />
                <Txt variant="monoBold" numberOfLines={1} style={{ flex: 1 }}>{item.title}</Txt>
              </View>
              <Txt variant="tiny" numberOfLines={1}>
                {item.status ? STATUS_LABEL[item.status] : item.tags?.length ? item.tags.map((x) => `#${x}`).join(' ') : item.projectName ?? ''}
              </Txt>
              {item.snippet && <Txt variant="tiny" numberOfLines={2}>{item.snippet}</Txt>}
            </Brutal>
          </Pressable>
        )}
      />
    </View>
  );
}
