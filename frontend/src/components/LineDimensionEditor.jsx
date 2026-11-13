import { PipeCalcFields, FlangeFields } from './ShapeCalcFields.jsx';

/**
 * Compact size inputs for one quotation / RFQ line, by the line's shape (taken from its size text prefix:
 * RB, PL, FL, PIPE, FLG, SQT, RCT, HEX, SB, TR). Weight is recalculated by the parent with the shared
 * calculateWeight (same formula as Item Master); this component only edits the numbers.
 *
 *   <LineDimensionEditor prefix="RB" item={line} onPatch={(field, value) => …} />
 */
export const PREFIX_TO_CALC_SHAPE = {
  RB: 'round bar', PL: 'plate', FL: 'flat', PIPE: 'pipe', FLG: 'flange', SQT: 'square tube',
  RCT: 'rectangular tube', HEX: 'hexagonal bar', SB: 'square bar', TR: 'threaded rod'
};

const FIELDS_BY_PREFIX = {
  RB: [['diameter', 'Ø Dia'], ['length', 'L']],
  PL: [['width', 'W'], ['length', 'L'], ['thickness', 'T']],
  FL: [['width', 'W'], ['thickness', 'T'], ['length', 'L']],
  SQT: [['width', 'A (side)'], ['thickness', 'T (wall)'], ['length', 'L']],
  RCT: [['width', 'W'], ['outer_diameter', 'H'], ['thickness', 'T (wall)'], ['length', 'L']],
  HEX: [['width', 'AF'], ['length', 'L']],
  SB: [['width', 'Side'], ['length', 'L']],
  TR: [['diameter', 'M (dia)'], ['thickness', 'Pitch'], ['length', 'L']]
};
const GENERIC_FIELDS = [['width', 'W'], ['outer_diameter', 'H/OD'], ['thickness', 'T'], ['diameter', 'Dia'], ['length', 'L']];

const inputClass = 'w-full p-1 bg-white border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none';
const labelClass = 'text-[10px] text-slate-400 font-medium';

const LineDimensionEditor = ({ prefix, item, onPatch }) => {
  const set = (field) => (v) => onPatch(field, v);

  if (prefix === 'PIPE') {
    return (
      <div className="grid grid-cols-3 gap-1">
        <PipeCalcFields
          od={item.outer_diameter} thickness={item.thickness} length={item.length} diameter={item.diameter}
          setOd={set('outer_diameter')} setThickness={set('thickness')} setLength={set('length')} setDiameter={set('diameter')}
          inputClass={inputClass} labelClass={labelClass} wrapClass="space-y-0.5" selectWrapClass="col-span-3 space-y-0.5" required={false}
        />
      </div>
    );
  }
  if (prefix === 'FLG') {
    return (
      <div className="grid grid-cols-3 gap-1">
        <FlangeFields
          od={item.outer_diameter} diameter={item.diameter} thickness={item.thickness}
          setOd={set('outer_diameter')} setDiameter={set('diameter')} setThickness={set('thickness')}
          inputClass={inputClass} labelClass={labelClass} wrapClass="space-y-0.5" noteClass="col-span-3" required={false}
        />
      </div>
    );
  }

  const fields = FIELDS_BY_PREFIX[prefix] || GENERIC_FIELDS;
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(fields.length, 3)}, minmax(0, 1fr))` }}>
      {fields.map(([field, label]) => (
        <div key={field} className="space-y-0.5">
          <label className={labelClass}>{label}</label>
          <input
            type="number" step="0.01" min="0" className={inputClass} placeholder="0"
            value={item[field] === null || item[field] === undefined || parseFloat(item[field]) === 0 ? '' : item[field]}
            onChange={(e) => onPatch(field, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
};

export default LineDimensionEditor;
