// Context-Aware Matching Engine (SDD 6.1). Pure so it can be unit tested.
import { DEFAULT_PROJECT, type RelatedDocDTO } from './domain';

export const WEIGHTS = { project: 0.4, tags: 0.35, link: 0.25 } as const;

interface DocLite {
  id: string;
  title: string;
  projectName: string;
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function rankRelated(
  active: DocLite,
  candidates: DocLite[],
  tagsByDoc: Map<string, Set<string>>,
  linkedIds: Set<string>
): RelatedDocDTO[] {
  const activeTags = tagsByDoc.get(active.id) ?? new Set<string>();
  return candidates
    .filter((d) => d.id !== active.id)
    .map((d) => {
      const docTags = tagsByDoc.get(d.id) ?? new Set<string>();
      // 'General' is the default bucket, not a real project, so it does not count as a match
      const sameProject = d.projectName === active.projectName && d.projectName !== DEFAULT_PROJECT;
      const linked = linkedIds.has(d.id);
      const score =
        WEIGHTS.project * Number(sameProject) + WEIGHTS.tags * jaccard(activeTags, docTags) + WEIGHTS.link * Number(linked);
      return {
        id: d.id,
        title: d.title,
        projectName: d.projectName,
        score: Math.round(score * 100) / 100,
        sameProject,
        matchedTags: [...docTags].filter((t) => activeTags.has(t)).sort(),
        linked,
      };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
