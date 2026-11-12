import { useEffect, useState } from 'react';

/**
 * Shared dimension inputs for the Pipe calculation choice and the Flange shape.
 * Used by every form that captures shape dimensions (BOM, PO, Stock Entry, Stock Balance, Production Plan).
 *
 * Storage stays in the existing columns, so nothing downstream changes:
 *  - Pipe Calculation 1 (default): OD, Thickness, Length                                    → unchanged
 *  - Pipe Calculation 2 (Hollow):  OD, ID (diameter), Length, thickness = (OD − ID) / 2      → π/4 (OD² − ID²) L
 *  - Flange:                        OD, ID (diameter), T (thickness)                         → π/4 (OD² − ID²) T
 * Display ("PIPE OD120 × ID30 × 40 mm") comes from formatDimensions, which recognises the Pipe 2 pattern.
 */
export const isFlangeShape = (shape) => String(shape || '').toLowerCase().includes('flange');

const num = (v) => parseFloat(v) || 0;
const round4 = (v) => String(parseFloat(Number(v).toFixed(4)));

// A saved Pipe Calculation 2 row: ID stored in diameter and wall = (OD − ID) / 2
export const isHollowPipeRow = (od, thickness, diameter) =>
  num(od) > 0 && num(thickness) > 0 && num(diameter) > 0 && Math.abs((num(od) - 2 * num(thickness)) - num(diameter)) < 0.01;

export const PipeCalcFields = ({
  od, thickness, length, diameter,
  setOd, setThickness, setLength, setDiameter,
  defaultMethod = '',
  inputClass = 'w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-emerald-500 outline-none',
  labelClass = 'text-xs text-slate-400 font-medium',
  wrapClass = 'space-y-1',
  selectWrapClass = 'md:col-span-3 space-y-1',
  required = true,
  onMethodChange
}) => {
  const savedIsHollow = defaultMethod === 'PIPE_HOLLOW' || isHollowPipeRow(od, thickness, diameter);
  const [method, setMethod] = useState(savedIsHollow ? 'PIPE_HOLLOW' : '');
  const [idDraft, setIdDraft] = useState('');

  // Follow the selected item / loaded row (e.g. a Pipe 2 stock variant picked in the BOM)
  // (never flips back to Calculation 1 on its own while the user is typing)
  useEffect(() => {
    if (savedIsHollow) setMethod('PIPE_HOLLOW');
  }, [savedIsHollow]);

  const isHollow = method === 'PIPE_HOLLOW';
  const derivedId = num(od) > 0 && num(thickness) > 0 && num(od) - 2 * num(thickness) > 0 ? round4(num(od) - 2 * num(thickness)) : '';
  const idValue = idDraft !== '' ? idDraft : derivedId;
  const idInvalid = isHollow && num(od) > 0 && num(idValue) > 0 && num(idValue) >= num(od);

  // OD / wall changed from outside (e.g. a stock variant was picked): drop the typed ID so it follows OD − 2T
  useEffect(() => {
    if (idDraft === '' || !(num(od) > 0 && num(thickness) > 0)) return;
    if (Math.abs((num(od) - 2 * num(thickness)) - num(idDraft)) > 0.001) setIdDraft('');
  }, [od, thickness]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyHollow = (odVal, idVal) => {
    const o = num(odVal);
    const i = num(idVal);
    const ok = o > 0 && i > 0 && i < o;
    setThickness(ok ? round4((o - i) / 2) : '');
    if (setDiameter) setDiameter(ok ? round4(i) : '');
  };

  return (
    <>
      <div className={selectWrapClass}>
        <label className={labelClass}>Select Pipe Calculation</label>
        <select
          className={inputClass}
          value={method}
          onChange={(e) => {
            const next = e.target.value;
            setMethod(next);
            if (next === 'PIPE_HOLLOW') {
              setIdDraft(derivedId);
              if (setDiameter && derivedId) setDiameter(derivedId);
            } else {
              setIdDraft('');
              // Back to Calculation 1: ID is not part of it
              if (setDiameter && isHollowPipeRow(od, thickness, diameter)) setDiameter('');
            }
            if (onMethodChange) onMethodChange(next);
          }}
        >
          <option value="">Pipe Calculation 1 – OD × Thickness × Length</option>
          <option value="PIPE_HOLLOW">Pipe Calculation 2 – Hollow Pipe (OD × ID × Length)</option>
        </select>
      </div>
      <div className={wrapClass}>
        <label className={labelClass}>Outer Diameter (OD) (mm){required ? ' *' : ''}</label>
        <input
          type="number" step="0.01" className={inputClass} placeholder="0.00" value={od || ''} required={required}
          onChange={(e) => { setOd(e.target.value); if (isHollow) applyHollow(e.target.value, idValue); }}
        />
      </div>
      {isHollow ? (
        <div className={wrapClass}>
          <label className={labelClass}>Inner Diameter (ID) (mm){required ? ' *' : ''}</label>
          <input
            type="number" step="0.01" className={inputClass} placeholder="0.00" value={idValue} required={required}
            onChange={(e) => { setIdDraft(e.target.value); applyHollow(od, e.target.value); }}
          />
        </div>
      ) : (
        <div className={wrapClass}>
          <label className={labelClass}>Thickness (mm){required ? ' *' : ''}</label>
          <input
            type="number" step="0.01" className={inputClass} placeholder="0.00" value={thickness || ''} required={required}
            onChange={(e) => setThickness(e.target.value)}
          />
        </div>
      )}
      <div className={wrapClass}>
        <label className={labelClass}>Length (L) (mm){required ? ' *' : ''}</label>
        <input
          type="number" step="0.01" className={inputClass} placeholder="0.00" value={length || ''} required={required}
          onChange={(e) => setLength(e.target.value)}
        />
      </div>
      {isHollow && (
        <div className={`${selectWrapClass} text-[11px] text-indigo-700`}>
          V = π/4 × (OD² − ID²) × L
          {num(od) > 0 && num(idValue) > 0 && !idInvalid && (
            <span className="text-slate-500"> · PIPE OD{num(od)} × ID{num(idValue)}{num(length) > 0 ? ` × ${num(length)}` : ''} mm · wall {thickness} mm</span>
          )}
          {idInvalid && <span className="ml-2 text-amber-700 font-semibold">⚠️ Inner Diameter must be less than the Outer Diameter.</span>}
        </div>
      )}
    </>
  );
};

export const FlangeFields = ({
  od, diameter, thickness,
  setOd, setDiameter, setThickness,
  inputClass = 'w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-emerald-500 outline-none',
  labelClass = 'text-xs text-slate-400 font-medium',
  wrapClass = 'space-y-1',
  noteClass = 'md:col-span-3',
  required = true
}) => {
  const idInvalid = num(od) > 0 && num(diameter) > 0 && num(diameter) >= num(od);
  return (
    <>
      <div className={wrapClass}>
        <label className={labelClass}>Outer Diameter (OD) (mm){required ? ' *' : ''}</label>
        <input type="number" step="0.01" className={inputClass} placeholder="0.00" value={od || ''} required={required} onChange={(e) => setOd(e.target.value)} />
      </div>
      <div className={wrapClass}>
        <label className={labelClass}>Inner Diameter (ID) (mm){required ? ' *' : ''}</label>
        <input type="number" step="0.01" className={inputClass} placeholder="0.00" value={diameter || ''} required={required} onChange={(e) => setDiameter(e.target.value)} />
      </div>
      <div className={wrapClass}>
        <label className={labelClass}>Thickness (T) (mm){required ? ' *' : ''}</label>
        <input type="number" step="0.01" className={inputClass} placeholder="0.00" value={thickness || ''} required={required} onChange={(e) => setThickness(e.target.value)} />
      </div>
      <div className={`${noteClass} text-[11px] text-indigo-700`}>
        V = π/4 × (OD² − ID²) × T <span className="text-slate-500">(without bolt-hole deduction)</span>
        {num(od) > 0 && num(diameter) > 0 && num(thickness) > 0 && !idInvalid && (
          <span className="text-slate-500"> · FLG OD{num(od)} × ID{num(diameter)} × {num(thickness)} mm</span>
        )}
        {idInvalid && <span className="ml-2 text-amber-700 font-semibold">⚠️ Inner Diameter must be less than the Outer Diameter.</span>}
      </div>
    </>
  );
};
