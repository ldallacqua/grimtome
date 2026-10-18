import { useRef, useState } from 'react';
import { useApp } from '@/app/store';
import { CLASS_IDS, CLASS_NAMES, type BuildRole, type ClassId } from '@/domain/shared/ids';
import { Button, Callout, Dialog, Segmented, Select, TextArea, TextField } from '@/design-system';
import { importJson } from '@/services/importers/json';
import { parseMaxrollUrl } from '@/services/importers/maxroll';
import { importFromText, type PasteImportResult } from '@/services/importers/paste';
import { platform } from '@/services/platform';

type Mode = 'paste' | 'json' | 'link';

export function ImportDialog({
  open,
  onClose,
  initialRole = 'leveling',
}: {
  open: boolean;
  onClose: () => void;
  initialRole?: BuildRole;
}) {
  const [mode, setMode] = useState<Mode>('paste');
  const [role, setRole] = useState<BuildRole>(initialRole);
  const [classId, setClassId] = useState<ClassId>('barbarian');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<PasteImportResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const catalog = useApp((s) => s.catalog);
  const dictionary = useApp((s) => s.dictionary);
  const setBuild = useApp((s) => s.setBuild);
  const toast = useApp((s) => s.toast);
  const link = url ? parseMaxrollUrl(url) : null;

  const reset = () => {
    setPreview(null);
    setErrors([]);
    setText('');
    setUrl('');
    setName('');
  };
  const close = () => {
    reset();
    onClose();
  };

  const analyze = () => {
    setErrors([]);
    if (url && !link) {
      setErrors([
        'That does not look like a maxroll.gg Diablo IV link. Leave it empty or paste a link like https://maxroll.gg/d4/build-guides/…',
      ]);
      return;
    }
    setPreview(
      importFromText(text, {
        classId,
        role,
        name,
        catalog,
        dictionary,
        ...(link ? { sourceUrl: link.url } : {}),
      }),
    );
  };

  const onJsonFile = async (file: File | undefined) => {
    if (!file) return;
    const result = importJson(await file.text());
    if (!result.ok) {
      setErrors(result.errors.slice(0, 6));
      return;
    }
    for (const [r, b] of Object.entries(result.builds)) setBuild(r as BuildRole, b!);
    toast({
      tone: 'success',
      title: 'Builds imported',
      body: Object.values(result.builds)
        .map((b) => b!.name)
        .join(' · '),
    });
    close();
  };

  return (
    <Dialog
      open={open}
      title="Import a build"
      onClose={close}
      actions={
        mode === 'paste' ? (
          preview ? (
            <>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Back
              </Button>
              <Button
                variant="primary"
                icon="check"
                onClick={() => {
                  setBuild(role, preview.build);
                  toast({
                    tone: 'success',
                    title: `${role === 'leveling' ? 'Leveling' : 'Endgame'} build saved`,
                    body: preview.build.name,
                  });
                  close();
                }}
              >
                Save as {role} build
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" icon="advisor" disabled={!text.trim()} onClick={analyze}>
                Recognize
              </Button>
            </>
          )
        ) : (
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        )
      }
    >
      <div className="gt-import">
        <Segmented<Mode>
          label="Import method"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrors([]);
          }}
          options={[
            { value: 'paste', label: 'Paste a guide' },
            { value: 'json', label: 'JSON file' },
            { value: 'link', label: 'Maxroll link' },
          ]}
        />
        {errors.length ? (
          <Callout tone="danger" title="Could not import">
            <ul className="gt-caveats">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        {mode === 'paste' && !preview ? (
          <>
            <div className="gt-import__row">
              <Segmented<BuildRole>
                label="Role"
                value={role}
                onChange={setRole}
                size="sm"
                options={[
                  { value: 'leveling', label: 'Leveling' },
                  { value: 'endgame', label: 'Endgame' },
                ]}
              />
              <Select
                aria-label="Class"
                value={classId}
                onChange={(e) => setClassId(e.target.value as ClassId)}
              >
                {CLASS_IDS.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_NAMES[c]}
                  </option>
                ))}
              </Select>
            </div>
            <TextField
              placeholder="Build name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Build name"
            />
            <TextField
              placeholder="Source link (optional), e.g. https://maxroll.gg/d4/build-guides/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Source link"
            />
            <TextArea
              rows={10}
              aria-label="Guide text"
              placeholder="Copy the skill order, gear (aspects, uniques, stat priorities) and Paragon sections from the guide you are reading, and paste them here."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {!catalog ? (
              <Callout tone="warning" title="Limited recognition">
                Game data is not imported, so only stat priorities and slots can be recognized. Import game
                assets in Settings to recognize skills, aspects, uniques, boards and glyphs.
              </Callout>
            ) : null}
          </>
        ) : null}

        {mode === 'paste' && preview ? (
          <div className="gt-import__preview">
            <h3>{preview.build.name}</h3>
            <div className="gt-import__counts">
              {Object.entries(preview.counts).map(([k, v]) => (
                <div key={k} className="gt-import__count">
                  <span className="gt-num">{v}</span>
                  {k}
                </div>
              ))}
            </div>
            {preview.warnings.length ? (
              <Callout tone="warning" title="Review before saving">
                <ul className="gt-caveats">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Callout>
            ) : (
              <Callout tone="success" title="Looks good">
                Recognized entries are listed above. Nothing was invented — anything the text did not name is
                left empty.
              </Callout>
            )}
          </div>
        ) : null}

        {mode === 'json' ? (
          <>
            <p>
              Import a file exported from Grimtome (or written by hand) using the <code>grimtome.builds</code>{' '}
              format described in the docs.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="gt-visually-hidden"
              onChange={(e) => void onJsonFile(e.target.files?.[0])}
            />
            <Button variant="primary" icon="upload" onClick={() => fileRef.current?.click()}>
              Choose JSON file
            </Button>
          </>
        ) : null}

        {mode === 'link' ? (
          <>
            <Callout tone="info" title="Why Grimtome does not download Maxroll pages">
              Maxroll does not permit automated access to its planner and guides, so Grimtome never fetches
              them. Open the guide in your browser, copy the sections you need, and use “Paste a guide” — the
              link is kept with your build for attribution.
            </Callout>
            <TextField
              placeholder="https://maxroll.gg/d4/build-guides/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Maxroll link"
            />
            <div className="gt-row">
              <Button
                variant="secondary"
                icon="external"
                disabled={!link}
                onClick={() => link && void platform.openExternal(link.url)}
              >
                Open in browser
              </Button>
              <Button variant="primary" icon="paste" disabled={!link} onClick={() => setMode('paste')}>
                Continue to paste
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
