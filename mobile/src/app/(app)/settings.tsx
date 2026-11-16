import * as React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Header } from '@/components/header';
import { Badge, Brutal, Btn, Choice, Field, SectionLabel, Txt } from '@/components/ui';
import { useWorkspace } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { ROLES, type LlmProvider, type MemberDTO, type Role } from '@/lib/types';

export default function SettingsScreen() {
  const { t, mode, setMode } = useTheme();
  const { snapshot, role, api, selectWorkspace, signOut, serverUrl, reload } = useWorkspace();
  const isAdmin = role === 'Admin';
  const wsId = snapshot.workspace.id;
  const [members, setMembers] = React.useState<MemberDTO[]>(snapshot.members);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<Role>('Editor');
  const [llm, setLlm] = React.useState({ provider: snapshot.workspace.llm.provider as LlmProvider, baseUrl: snapshot.workspace.llm.baseUrl ?? '', model: snapshot.workspace.llm.model, apiKey: '' });
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => setMembers(snapshot.members), [snapshot.members]);

  const attempt = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) Alert.alert('Berhasil', ok);
    } catch (e) {
      Alert.alert('Gagal', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="AKUN_&_PENGATURAN" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Brutal style={{ padding: 14, gap: 4 }}>
          <Txt variant="bodyBold">{snapshot.me.name}</Txt>
          <Txt variant="mono">{snapshot.me.email}</Txt>
          <Txt variant="tiny">Server: {serverUrl}</Txt>
        </Brutal>

        <Choice label="Tema" value={mode} onChange={setMode} options={[{ value: 'system', label: 'SISTEM' }, { value: 'light', label: 'LIGHT' }, { value: 'dark', label: 'DARK' }]} />

        <SectionLabel>WORKSPACES</SectionLabel>
        {snapshot.workspaces.map((w) => (
          <Pressable key={w.id} onPress={() => w.id !== wsId && selectWorkspace(w.id)} accessibilityRole="button" accessibilityState={{ selected: w.id === wsId }}>
            <Brutal offset={2} style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} bg={w.id === wsId ? t.elevated : t.surface}>
              <Txt variant="monoBold" numberOfLines={1} style={{ flex: 1 }}>{w.id === wsId ? '● ' : ''}{w.name}</Txt>
              <Badge label={w.role} />
            </Brutal>
          </Pressable>
        ))}

        <SectionLabel>{`ANGGOTA (${members.length})`}</SectionLabel>
        {members.map((m) => {
          const owner = m.userId === snapshot.workspace.ownerId;
          return (
            <Brutal key={m.id} offset={2} style={{ padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="monoBold" numberOfLines={1}>{m.name}</Txt>
                  <Txt variant="tiny" numberOfLines={1}>{m.email}</Txt>
                </View>
                {owner ? <Badge label="OWNER" tone="brutal" /> : !isAdmin && <Badge label={m.role} />}
              </View>
              {isAdmin && !owner && (
                <View style={{ gap: 8 }}>
                  <Choice
                    value={m.role}
                    options={ROLES.map((r) => ({ value: r, label: r.toUpperCase() }))}
                    onChange={(r) => attempt('role', async () => { const u = await api.setMemberRole(wsId, m.id, r); setMembers((l) => l.map((x) => (x.id === m.id ? u : x))); })}
                  />
                  <Btn title="KELUARKAN" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() =>
                    Alert.alert('Keluarkan anggota', `Keluarkan ${m.name}?`, [
                      { text: 'Batal', style: 'cancel' },
                      { text: 'Keluarkan', style: 'destructive', onPress: () => attempt('remove', async () => { await api.removeMember(wsId, m.id); setMembers((l) => l.filter((x) => x.id !== m.id)); }) },
                    ])}
                  />
                </View>
              )}
            </Brutal>
          );
        })}
        {isAdmin && (
          <Brutal style={{ padding: 14, gap: 10 }}>
            <Field label="Undang via email (akun terdaftar)" value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" />
            <Choice value={inviteRole} onChange={setInviteRole} options={ROLES.map((r) => ({ value: r, label: r.toUpperCase() }))} />
            <Btn title="UNDANG" variant="holo" loading={busy === 'invite'} disabled={!inviteEmail.includes('@')} onPress={() =>
              attempt('invite', async () => { const m = await api.inviteMember(wsId, inviteEmail.trim().toLowerCase(), inviteRole); setMembers((l) => [...l, m]); setInviteEmail(''); }, 'Anggota ditambahkan.')}
            />
          </Brutal>
        )}

        <SectionLabel>KONFIGURASI_LLM</SectionLabel>
        <Brutal style={{ padding: 14, gap: 10 }}>
          {isAdmin ? (
            <>
              <Choice value={llm.provider} onChange={(provider) => setLlm({ ...llm, provider })} options={[{ value: 'ollama', label: 'OLLAMA' }, { value: 'openai', label: 'OPENAI' }]} />
              <Field label="Model" value={llm.model} onChangeText={(model) => setLlm({ ...llm, model })} autoCapitalize="none" />
              <Field label="Base URL (kosong = default)" value={llm.baseUrl} onChangeText={(baseUrl) => setLlm({ ...llm, baseUrl })} autoCapitalize="none" keyboardType="url" />
              {llm.provider === 'openai' && (
                <Field label={snapshot.workspace.llm.hasApiKey ? 'API key (tersimpan — isi untuk ganti)' : 'API key'} value={llm.apiKey} onChangeText={(apiKey) => setLlm({ ...llm, apiKey })} secureTextEntry autoCapitalize="none" />
              )}
              <Btn title="SIMPAN_KONFIGURASI" variant="holo" loading={busy === 'llm'} onPress={() =>
                attempt('llm', async () => {
                  await api.setLlm(wsId, { provider: llm.provider, baseUrl: llm.baseUrl, model: llm.model, ...(llm.apiKey ? { apiKey: llm.apiKey } : {}) });
                  setLlm((s) => ({ ...s, apiKey: '' }));
                  await reload();
                }, 'Konfigurasi LLM disimpan.')}
              />
            </>
          ) : (
            <Txt variant="monoBold">{snapshot.workspace.llm.provider.toUpperCase()} // {snapshot.workspace.llm.model}</Txt>
          )}
          <Btn title="TES_KONEKSI" variant="outline" loading={busy === 'ping'} onPress={() =>
            attempt('ping', async () => { const s = await api.aiStatus(wsId); setAiStatus(`${s.engine}: ${s.online ? 'ONLINE' : 'OFFLINE'}`); })}
          />
          {aiStatus && <Txt variant="monoBold" color={aiStatus.endsWith('ONLINE') ? t.mint : t.pink}>{aiStatus}</Txt>}
        </Brutal>

        <Btn title="KELUAR" variant="danger" onPress={signOut} />
      </ScrollView>
    </View>
  );
}
