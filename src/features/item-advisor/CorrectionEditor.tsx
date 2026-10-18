import { useMemo, useState } from 'react';
import { useApp } from '@/app/store';
import { slotFromType } from '@/domain/items/parser';
import type { ParsedAffix, ParsedItem } from '@/domain/items/types';
import { RARITIES, SLOT_NAMES, SLOTS, type Rarity, type Slot } from '@/domain/shared/ids';
import { Button, IconButton, Select, TextArea, TextField, Toggle } from '@/design-system';

/**
 * Lets the player review and correct what OCR recognized. Saving marks the item
 * as verified, which the recommendation engine then trusts.
 */
export function CorrectionEditor({ item, onSave, onCancel }: { item: ParsedItem; onSave: (item: ParsedItem) => void; onCancel: () => void }) {
  const dictionary = useApp((s) => s.dictionary);
  const [draft, setDraft] = useState<ParsedItem>(() => structuredClone(item));
  const options = useMemo(() => dictionary.all().sort((a, b) => a.label.localeCompare(b.label)), [dictionary]);

  const setAffix = (i: number, patch: Partial<ParsedAffix>) =>
    setDraft((d) => ({ ...d, affixes: d.affixes.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));

  return (
    <div className="gt-correct">
      <div className="gt-correct__grid">
        <label className="gt-correct__field">
          <span>Name</span>
          <TextField value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value || null })} />
        </label>
        <label className="gt-correct__field">
          <span>Rarity</span>
          <Select value={draft.rarity ?? ''} onChange={(e) => setDraft({ ...draft, rarity: (e.target.value || null) as Rarity | null })}>
            <option value="">Unknown</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r[0]!.toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Select>
        </label>
        <label className="gt-correct__field">
          <span>Slot</span>
          <Select value={draft.slot ?? ''} onChange={(e) => setDraft({ ...draft, slot: (e.target.value || null) as Slot | null })}>
            <option value="">Unknown</option>
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_NAMES[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="gt-correct__field">
          <span>Item type</span>
          <TextField
            value={draft.itemType ?? ''}
            onChange={(e) => {
              const itemType = e.target.value || null;
              setDraft({ ...draft, itemType, slot: draft.slot ?? slotFromType(itemType) });
            }}
          />
        </label>
        <label className="gt-correct__field">
          <span>Item Power</span>
          <TextField
            inputMode="numeric"
            value={draft.itemPower ?? ''}
            onChange={(e) => setDraft({ ...draft, itemPower: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })}
          />
        </label>
        <div className="gt-correct__field gt-correct__field--toggle">
          <span>Ancestral</span>
          <Toggle label="Ancestral" checked={draft.ancestral} onChange={(v) => setDraft({ ...draft, ancestral: v })} />
        </div>
      </div>

      <div className="gt-section-label" style={{ margin: '18px 0 8px' }}>
        Affixes
      </div>
      <div className="gt-correct__affixes">
        {draft.affixes.map((a, i) => (
          <div key={i} className="gt-correct__affix">
            <Select
              aria-label="Affix"
              value={a.key ?? ''}
              onChange={(e) => {
                const def = options.find((o) => o.key === e.target.value);
                setAffix(i, def ? { key: def.key, label: def.label, category: def.category, method: 'user', confidence: 1 } : { key: null, method: 'none' });
              }}
            >
              <option value="">Not recognized — {a.raw.slice(0, 40)}</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
            <TextField
              aria-label="Value"
              className="gt-correct__value"
              value={a.value ?? ''}
              onChange={(e) => setAffix(i, { value: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })}
            />
            <label className="gt-correct__check" title="Greater Affix">
              <input type="checkbox" checked={a.greater} onChange={(e) => setAffix(i, { greater: e.target.checked })} /> GA
            </label>
            <label className="gt-correct__check" title="Tempered">
              <input type="checkbox" checked={a.tempered} onChange={(e) => setAffix(i, { tempered: e.target.checked })} /> Temp
            </label>
            <IconButton icon="trash" label="Remove affix" size="sm" onClick={() => setDraft((d) => ({ ...d, affixes: d.affixes.filter((_, j) => j !== i) }))} />
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          icon="plus"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              affixes: [
                ...d.affixes,
                { raw: '', key: null, label: '', category: null, value: null, percent: false, range: null, greater: false, tempered: false, confidence: 1, method: 'user' },
              ],
            }))
          }
        >
          Add affix
        </Button>
      </div>

      <label className="gt-correct__field" style={{ marginTop: 16 }}>
        <span>Legendary / unique power</span>
        <TextArea rows={3} value={draft.powerText ?? ''} onChange={(e) => setDraft({ ...draft, powerText: e.target.value || null })} style={{ fontFamily: 'var(--gt-font-ui)', minHeight: 80 }} />
      </label>

      <div className="gt-row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" icon="check" onClick={() => onSave({ ...draft, affixes: draft.affixes.filter((a) => a.key || a.raw) })}>
          Save corrections
        </Button>
      </div>
    </div>
  );
}
