import clsx from 'clsx';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { hotkeyParts } from '@/app/settings';
import { useApp } from '@/app/store';
import { useScanController } from '@/app/useScan';
import { Button, Dialog, Icon, KeyCap, TextArea } from '@/design-system';
import { platform } from '@/services/platform';
import { loadSamples, readFileBytes, sampleBytes, type SampleTooltip } from '@/services/samples';

export function usePasteDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { scanText } = useScanController();
  const dialog = (
    <Dialog
      open={open}
      title="Paste tooltip text"
      onClose={() => setOpen(false)}
      actions={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="advisor"
            disabled={!text.trim()}
            onClick={() => {
              if (scanText(text)) {
                setText('');
                setOpen(false);
              }
            }}
          >
            Analyze
          </Button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}>One line per tooltip line: name, type (e.g. “Ancestral Legendary Gloves”), Item Power, then affixes.</p>
      <TextArea
        aria-label="Tooltip text"
        value={text}
        placeholder={'Gauntlets of Earthquakes\nAncestral Legendary Gloves\n800 Item Power\n+14.0% Critical Strike Chance\n+5.5% Movement Speed'}
        onChange={(e) => setText(e.target.value)}
        rows={9}
      />
    </Dialog>
  );
  return { open: () => setOpen(true), dialog };
}

export function useFileScan() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { scanImage } = useScanController();
  const onFiles = async (files: FileList | File[] | null) => {
    const file = files?.[0];
    if (!file) return;
    const { bytes, dataUrl } = await readFileBytes(file);
    await scanImage(bytes, 'upload', dataUrl);
  };
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/bmp"
      className="gt-visually-hidden"
      data-testid="screenshot-input"
      onChange={(e) => {
        void onFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );
  return { pick: () => inputRef.current?.click(), input, onFiles };
}

export function SampleGallery({ compact }: { compact?: boolean }) {
  const [samples, setSamples] = useState<SampleTooltip[]>([]);
  const { scanImage } = useScanController();
  useEffect(() => {
    void loadSamples().then(setSamples);
  }, []);
  if (!samples.length) return null;
  return (
    <div className={clsx('gt-samples', compact && 'gt-samples--compact')}>
      <div className="gt-section-label">Try a sample tooltip</div>
      <div className="gt-samples__list">
        {samples.map((s) => (
          <button
            key={s.id}
            type="button"
            className="gt-samples__item"
            onClick={async () => {
              const { bytes, dataUrl } = await sampleBytes(s);
              await scanImage(bytes, 'sample', dataUrl);
            }}
          >
            <img src={`${import.meta.env.BASE_URL}${s.image}`} alt="" loading="lazy" />
            <span>{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DropZone() {
  const hotkey = useApp((s) => s.settings.hotkeys.scan);
  const [over, setOver] = useState(false);
  const { pick, input, onFiles } = useFileScan();
  const paste = usePasteDialog();
  const { scanNow } = useScanController();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void onFiles(e.dataTransfer.files);
  };
  return (
    <div
      className={clsx('gt-dropzone', over && 'is-over')}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {input}
      {paste.dialog}
      <div className="gt-dropzone__art" aria-hidden>
        <Icon name="advisor" size={34} strokeWidth={1.3} />
      </div>
      <h2 className="gt-dropzone__title">Show Grimtome an item</h2>
      <p className="gt-dropzone__body">
        {platform.capture.available ? (
          <>
            In game, hover an item and press <KeyCap keys={hotkeyParts(hotkey)} size="sm" />. Or drop a screenshot here.
          </>
        ) : (
          <>Drop a tooltip screenshot here, paste its text, or try one of the sample tooltips below.</>
        )}
      </p>
      <div className="gt-row gt-row--wrap gt-dropzone__actions">
        {platform.capture.available ? (
          <Button variant="primary" icon="scan" onClick={() => void scanNow()}>
            Scan now
          </Button>
        ) : null}
        <Button variant={platform.capture.available ? 'secondary' : 'primary'} icon="upload" onClick={pick}>
          Upload screenshot
        </Button>
        <Button variant="secondary" icon="paste" onClick={paste.open}>
          Paste text
        </Button>
      </div>
      <SampleGallery />
    </div>
  );
}
