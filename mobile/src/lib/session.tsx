import * as React from 'react';
import { Platform } from 'react-native';
import { createApi, type Api } from './api';
import { storage } from './storage';
import type { DocSummaryDTO, DocumentDTO, TaskDTO, UserDTO, WorkspaceSnapshotDTO } from './types';

export const DEFAULT_SERVER =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

const KEYS = { server: 'nf_server', token: 'nf_token', refresh: 'nf_refresh', workspace: 'nf_workspace' };

interface SessionValue {
  ready: boolean;
  serverUrl: string;
  user: UserDTO | null;
  api: Api;
  snapshot: WorkspaceSnapshotDTO | null;
  loadError: string | null;
  signIn: (server: string, email: string, password: string) => Promise<void>;
  signUp: (server: string, name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  upsertTask: (task: TaskDTO) => void;
  removeTask: (id: string) => void;
  upsertDoc: (doc: DocumentDTO | DocSummaryDTO) => void;
  removeDoc: (id: string) => void;
}

const SessionContext = React.createContext<SessionValue | null>(null);

const summary = ({ id, title, projectName, authorId, isArchived, tags, createdAt, updatedAt }: DocSummaryDTO): DocSummaryDTO => ({
  id, title, projectName, authorId, isArchived, tags, createdAt, updatedAt,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [serverUrl, setServerUrl] = React.useState(DEFAULT_SERVER);
  const [user, setUser] = React.useState<UserDTO | null>(null);
  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshotDTO | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const tokens = React.useRef<{ token: string; refreshToken: string } | null>(null);

  const clear = React.useCallback(async () => {
    tokens.current = null;
    setUser(null);
    setSnapshot(null);
    await Promise.all([storage.remove(KEYS.token), storage.remove(KEYS.refresh)]);
  }, []);

  // One factory so every client persists refreshed tokens and signs out on expiry the same way
  const makeApi = React.useCallback(
    (url: string) =>
      createApi({
        baseUrl: url.trim().replace(/\/+$/, ''),
        getTokens: () => tokens.current,
        onTokens: (t) => {
          tokens.current = t;
          void storage.set(KEYS.token, t.token);
          void storage.set(KEYS.refresh, t.refreshToken);
        },
        onExpired: () => void clear(),
      }),
    [clear]
  );
  const api = React.useMemo(() => makeApi(serverUrl), [makeApi, serverUrl]);

  const loadWorkspace = React.useCallback(
    async (client: Api, preferred: string | null) => {
      setLoadError(null);
      try {
        const me = await client.me();
        setUser(me.user);
        const ws = me.workspaces.find((w) => w.id === preferred) ?? me.workspaces[0];
        if (!ws) return setSnapshot(null);
        await storage.set(KEYS.workspace, ws.id);
        setSnapshot(await client.snapshot(ws.id));
      } catch (e) {
        setLoadError((e as Error).message);
      }
    },
    []
  );

  // Restore a saved session on launch
  React.useEffect(() => {
    (async () => {
      const [server, token, refreshToken, ws] = await Promise.all([
        storage.get(KEYS.server),
        storage.get(KEYS.token),
        storage.get(KEYS.refresh),
        storage.get(KEYS.workspace),
      ]);
      const url = server ?? DEFAULT_SERVER;
      setServerUrl(url);
      if (token && refreshToken) {
        tokens.current = { token, refreshToken };
        const client = makeApi(url);
        await loadWorkspace(client, ws);
      }
      setReady(true);
    })();
  }, [loadWorkspace, makeApi]);

  const start = async (server: string, session: { token: string; refreshToken: string }) => {
    const url = server.trim().replace(/\/+$/, '');
    tokens.current = { token: session.token, refreshToken: session.refreshToken };
    await Promise.all([storage.set(KEYS.server, url), storage.set(KEYS.token, session.token), storage.set(KEYS.refresh, session.refreshToken)]);
    setServerUrl(url);
    await loadWorkspace(makeApi(url), await storage.get(KEYS.workspace));
  };

  const anon = (server: string) => createApi({ baseUrl: server.trim().replace(/\/+$/, ''), getTokens: () => null, onTokens: () => {}, onExpired: () => {} });

  const value: SessionValue = {
    ready,
    serverUrl,
    user,
    api,
    snapshot,
    loadError,
    signIn: async (server, email, password) => start(server, await anon(server).login(email.trim().toLowerCase(), password)),
    signUp: async (server, name, email, password) => start(server, await anon(server).register(name.trim(), email.trim().toLowerCase(), password)),
    signOut: async () => {
      await api.logout().catch(() => {});
      await clear();
    },
    selectWorkspace: (id) => loadWorkspace(api, id),
    reload: () => loadWorkspace(api, snapshot?.workspace.id ?? null),
    upsertTask: (task) =>
      setSnapshot((s) => s && { ...s, tasks: s.tasks.some((t) => t.id === task.id) ? s.tasks.map((t) => (t.id === task.id ? task : t)) : [task, ...s.tasks] }),
    removeTask: (id) => setSnapshot((s) => s && { ...s, tasks: s.tasks.filter((t) => t.id !== id) }),
    upsertDoc: (doc) =>
      setSnapshot(
        (s) =>
          s && {
            ...s,
            documents: s.documents.some((d) => d.id === doc.id)
              ? s.documents.map((d) => (d.id === doc.id ? summary(doc) : d))
              : [summary(doc), ...s.documents],
          }
      ),
    removeDoc: (id) =>
      setSnapshot(
        (s) => s && { ...s, documents: s.documents.filter((d) => d.id !== id), tasks: s.tasks.map((t) => (t.documentId === id ? { ...t, documentId: null } : t)) }
      ),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

// Convenience for screens that only render inside a loaded workspace
export function useWorkspace() {
  const s = useSession();
  return { ...s, snapshot: s.snapshot!, role: s.snapshot!.effectiveRole };
}
