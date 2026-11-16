# NexusFlow Subproject Context & Guidelines

## Scope & Isolation Directive
- **Subproject Directory**: `/home/relyf/PL/TuBes`
- **Topic**: NexusFlow — Unified Context-Aware Workspace for Knowledge Workers (Course: *Pemrograman Lanjut*, Student: Alif Akbar Arraiyan, NIM: 101032330121).
- **Isolation Policy**: Under no circumstances should context, code, memories, or conventions be shared with or leaked to `/Calculator`, `/Game`, or `/PHP`.

---

## Technology Stack
- **Framework**: Next.js 15 (App Router, React 19, TypeScript), React Server Components (RSC) as default.
- **Database**: MariaDB 11.4 LTS via Docker Compose (`nexusflow_mariadb`), 8-table schema in `src/db/schema.ts` (matches `DATABASE_RELATIONS.md` + auth & LLM config columns).
- **Layers**: Server Actions (`src/actions`) and REST routes (`src/app/api`) are thin controllers → services (`src/services`, own all business rules & RBAC via `requireMember`) → Drizzle ORM. Never put RBAC checks only in UI.
- **Auth**: bcrypt + JWT (`jose`): 2h access / 7d refresh; `users.token_version` bump = revoke all tokens. Role preview cookie may only lower privileges.
- **Validation**: Strict Zod schemas (`src/lib/validations/index.ts`) for all inputs.
- **AI**: provider-agnostic gateway `src/lib/ai.ts` (Ollama + OpenAI adapters); model output is always Zod-validated and normalized before use.
- **UI Components**: Restyled shadcn/ui (3px borders, solid offset shadows) + Magic UI (max 3 effects: `BorderBeam`, `ShimmerBadge`, `AmbientMist`). Accent colours used as TEXT must use the `ink-*` tokens (neon hues fail WCAG on light surfaces); run `node scripts/verify_contrast.js` after palette changes.
- **Theming**: next-themes with `data-theme` attribute and a `<head>` script that persists `?theme=`.
- **Mobile**: Expo SDK 58 app in `mobile/` (Expo Router, Bearer tokens via `/api/*`). It mirrors `src/lib/domain.ts` types in `mobile/src/lib/types.ts` — keep both in sync when the API changes.
- **Tests**: `bun run test` (unit), `bun run test:api` (E2E against a seeded server), `cd mobile && bun run typecheck`.

---

## Mandatory Design Skills
Any agent working on UI/UX in this subproject must consult:
1. `anti-ui-slop`
2. `exceptional-ui-design`
3. `antigravity-design-expert`

---

## Design Principles: The Artistic Clash
- **Aesthetic**: Neo-Brutalism × Y2K × Designer × Simplistic × Clean × Seamless × Holographic × Dreamcore.
- **Conflict Pairs**: Heavy brutal box × fluid iridescent holo, rigid mono typography × soft floating dreamcore haze, clean whitespace × chrome metallic sticker, 3px solid border × pastel haze, rigid grid × intentional subtle tilt badges.
- **Readability Directive**: Text must ALWAYS sit on solid surfaces (`#FFFFFF` Light, `#0E1017` / `#07080C` Dark). Never place text directly over gradients, grain, or haze. WCAG AA minimum, WCAG AAA target.
- **Forbidden (Zero AI Slop)**: No generic purple-blue gradients, no rounded-2xl cards with soft blur shadows, no emoji as icons, no gratuitous glassmorphism, no Inter/Roboto default fonts.
