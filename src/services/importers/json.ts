import { migrateBuild, parseBuildFile, type Build, type BuildFile } from '@/domain/builds/schema';
import type { BuildRole } from '@/domain/shared/ids';

/** JSON import/export of builds (`grimtome.builds` v1, or a single build object). */

export type JsonImportResult = { ok: true; builds: Partial<Record<BuildRole, Build>> } | { ok: false; errors: string[] };

export function importJson(text: string): JsonImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (raw && typeof raw === 'object' && (raw as { format?: unknown }).format === 'grimtome.builds') {
    const file = parseBuildFile(raw);
    if (!file.ok) return file;
    const builds: Partial<Record<BuildRole, Build>> = {};
    if (file.value.leveling) builds.leveling = file.value.leveling;
    if (file.value.endgame) builds.endgame = file.value.endgame;
    if (!builds.leveling && !builds.endgame) return { ok: false, errors: ['The file contains no builds.'] };
    return { ok: true, builds };
  }
  const single = migrateBuild(raw);
  if (!single.ok) return single;
  return { ok: true, builds: { [single.value.role]: single.value } };
}

export function exportJson(builds: Partial<Record<BuildRole, Build>>): string {
  const file: BuildFile = { format: 'grimtome.builds', version: 1, ...builds };
  return JSON.stringify(file, null, 2);
}
