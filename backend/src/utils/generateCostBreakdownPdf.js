const puppeteer = require('puppeteer');
const { getHostCompanyLogoBase64 } = require('./hostCompanyLogoHelper');

// Quotation Cost Breakdown PDF (internal costing sheet), in the ERP's company-branded document format:
//   company header → document meta → summary per item → BOM detail per item (raw materials, operations, components)
// `rows` are the objects returned by getQuotationCostBreakdownDetails (same numbers as the screen).

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const money = (v) => '₹' + (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v, d = 3) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: d });

const buildHtml = ({ company, clientName, quoteNumber, version, projectName, quoteDate, status, rows }) => {
  const logo = company ? getHostCompanyLogoBase64(company) : null;
  const parents = rows.filter(r => !String(r.sr || '').includes('↳'));
  const sum = (f) => parents.reduce((s, r) => s + f(r), 0);
  const totals = {
    qty: sum(r => Number(r.qty) || 0),
    material: sum(r => (Number(r.materialCost) || 0) * (Number(r.qty) || 0)),
    operations: sum(r => (Number(r.operation_cost) || 0) * (Number(r.qty) || 0)),
    profit: sum(r => (Number(r.profit) || 0) * (Number(r.qty) || 0)),
    total: sum(r => Number(r.total) || 0)
  };
  const cost = totals.material + totals.operations;
  const marginPct = totals.total > 0 ? (totals.profit / totals.total) * 100 : 0;

  const summaryRows = parents.map(r => `
    <tr>
      <td class="c">${esc(r.sr)}</td>
      <td><b>${esc(r.drawing_no)}</b></td>
      <td>${esc(r.description)}</td>
      <td class="c"><span class="tag ${r.type === 'ASM' ? 'tag-asm' : ''}">${esc(r.type)}</span></td>
      <td class="r">${num(r.qty, 2)}</td>
      <td class="r">${money(r.materialCost)}</td>
      <td class="r">${money(r.operation_cost)}</td>
      <td class="r ${Number(r.profit) < 0 ? 'neg' : 'pos'}">${money(r.profit)}</td>
      <td class="r"><b>${money(r.unitRate)}</b></td>
      <td class="r"><b>${money(r.total)}</b></td>
    </tr>`).join('');

  const detailSections = parents.map(r => {
    const mats = r.bom_materials || [];
    const ops = r.bom_operations || [];
    const comps = r.bom_components || [];
    const showComp = comps.length > 0;
    const matTotal = mats.reduce((s, m) => s + (Number(m.cost) || 0), 0);
    const opTotal = ops.reduce((s, o) => s + (Number(o.cost) || 0), 0);
    return `
    <section class="item">
      <div class="item-head">
        <div><span class="item-no">${esc(r.sr)}</span> <b>${esc(r.drawing_no)}</b> &nbsp;${esc(r.description)} <span class="tag ${r.type === 'ASM' ? 'tag-asm' : ''}">${esc(r.type)}</span></div>
        <div class="formula">Material ${money(r.materialCost)} + Operations ${money(r.operation_cost)} + Profit <span class="${Number(r.profit) < 0 ? 'neg' : 'pos'}">${money(r.profit)}</span> = <b>Unit Price ${money(r.unitRate)}</b> &nbsp;×&nbsp; ${num(r.qty, 2)} = <b>${money(r.total)}</b>${Number(r.profit) < 0 ? ` &nbsp;<span class="neg"><b>Below BOM cost by ${money(Math.abs(Number(r.profit)))}</b></span>` : ''}</div>
      </div>

      <div class="sub-title">Raw Materials (per unit)</div>
      ${mats.length === 0 ? '<div class="empty">No raw materials in BOM</div>' : `
      <table>
        <thead><tr>
          ${showComp ? '<th>Component</th>' : ''}
          <th>Material</th><th>Item Code</th><th>Size</th>
          <th class="r">Qty</th><th class="r">Wt / Unit</th><th class="r">Scrap</th><th class="r">Rate</th><th class="r">Cost</th>
        </tr></thead>
        <tbody>${mats.map(m => `
          <tr>
            ${showComp ? `<td class="mono">${esc(m.component || '—')}</td>` : ''}
            <td>${esc(m.name)}</td>
            <td class="mono">${esc(m.item_code || '—')}</td>
            <td>${esc((m.dimensions || m.shape) || '—')}</td>
            <td class="r">${num(m.qty)} ${esc(m.uom || '')}</td>
            <td class="r">${Number(m.weight_per_unit) > 0 ? `${num(m.weight_per_unit)} kg` : '—'}</td>
            <td class="r">${Number(m.scrap_percent) > 0 ? `${num(m.scrap_percent, 2)}%` : '—'}</td>
            <td class="r">${money(m.rate)}</td>
            <td class="r"><b>${money(m.cost)}</b></td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="${showComp ? 8 : 7}" class="r">Material total</td><td class="r"><b>${money(matTotal)}</b></td></tr></tfoot>
      </table>`}

      <div class="sub-title">Operations (per unit)</div>
      ${ops.length === 0 ? '<div class="empty">No operations in BOM</div>' : `
      <table>
        <thead><tr>
          ${showComp ? '<th>Component</th>' : ''}
          <th>Operation</th><th>Workstation</th>
          <th class="r">Setup (min)</th><th class="r">Cycle (min)</th><th class="r">Rate / hr</th><th class="r">Cost</th>
        </tr></thead>
        <tbody>${ops.map(o => `
          <tr>
            ${showComp ? `<td class="mono">${esc(o.component || '—')}</td>` : ''}
            <td>${esc(o.name)}</td>
            <td>${esc(o.workstation || '—')}</td>
            <td class="r">${num(o.setup_time_min, 2)}</td>
            <td class="r">${num(o.cycle_time_min, 2)}</td>
            <td class="r">${money(o.hourly_rate)}</td>
            <td class="r"><b>${money(o.cost)}</b></td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="${showComp ? 6 : 5}" class="r">Operation total</td><td class="r"><b>${money(opTotal)}</b></td></tr></tfoot>
      </table>`}

      ${showComp ? `
      <div class="sub-title">Components</div>
      <table>
        <thead><tr><th>Component</th><th>Description</th><th class="r">Qty</th><th>Costed from</th><th class="r">Cost</th></tr></thead>
        <tbody>${comps.map(c => {
          const pm = c.part_materials || [];
          const po = c.part_operations || [];
          const partCost = (Number(c.part_material_cost) || 0) + (Number(c.part_operation_cost) || 0);
          const partRows = (pm.length || po.length) ? `
          <tr><td colspan="5" class="part">
            ${pm.map(m => `<div class="part-line"><span class="part-k">Material</span> ${esc(m.name)}${m.item_code ? ` <span class="mono">${esc(m.item_code)}</span>` : ''} · ${esc((m.dimensions || m.shape) || '—')} · ${num(m.qty)} ${esc(m.uom || '')}${Number(m.weight_per_unit) > 0 ? ` · ${num(m.weight_per_unit)} kg` : ''} × ${money(m.rate)} <b class="part-v">${money(m.cost)}</b></div>`).join('')}
            ${po.map(o => `<div class="part-line"><span class="part-k">Operation</span> ${esc(o.name)}${o.workstation ? ` · ${esc(o.workstation)}` : ''} · ${num(o.setup_time_min, 2)} + ${num(o.cycle_time_min, 2)} min × ${money(o.hourly_rate)}/hr <b class="part-v">${money(o.cost)}</b></div>`).join('')}
            <div class="part-sum">Per part ${money(partCost)} × ${num(c.qty, 2)} = <b>${money(partCost * (Number(c.qty) || 0))}</b></div>
          </td></tr>` : '';
          return `
          <tr>
            <td class="mono"><b>${esc(c.code)}</b></td>
            <td>${esc(c.description || '—')}</td>
            <td class="r">${num(c.qty, 2)}</td>
            <td>${c.source === 'BOM' ? 'Component BOM' : `Rate ${money(c.rate)}`}</td>
            <td class="r"><b>${money(c.cost)}</b></td>
          </tr>${partRows}`;
        }).join('')}
        </tbody>
      </table>` : ''}
    </section>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Cost Breakdown ${esc(quoteNumber)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 9px; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
  .brand { display: flex; gap: 10px; align-items: center; }
  .brand img { max-height: 52px; max-width: 110px; object-fit: contain; }
  .co-name { font-size: 15px; font-weight: 700; color: #1e3a8a; }
  .co-meta { color: #475569; font-size: 8.5px; line-height: 1.45; max-width: 330px; }
  .doc { text-align: right; }
  .doc-title { font-size: 13px; font-weight: 700; color: #0f172a; letter-spacing: .4px; }
  .doc-sub { font-size: 8px; color: #b91c1c; font-weight: 600; text-transform: uppercase; letter-spacing: .6px; margin-top: 2px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; margin: 10px 0; padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
  .meta .k { color: #64748b; font-size: 7.5px; text-transform: uppercase; letter-spacing: .4px; }
  .meta .v { font-weight: 600; font-size: 9.5px; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 8px 0 10px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
  .kpi .k { color: #64748b; font-size: 7.5px; text-transform: uppercase; }
  .kpi .v { font-size: 11.5px; font-weight: 700; margin-top: 2px; }
  .kpi.grand { background: #eef2ff; border-color: #c7d2fe; }
  .kpi.grand .v { color: #3730a3; }
  h3 { font-size: 10px; margin: 12px 0 5px; color: #0f172a; border-left: 3px solid #4f46e5; padding-left: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #f1f5f9; color: #334155; font-weight: 700; font-size: 8px; text-align: left; padding: 4px 5px; border: 1px solid #cbd5e1; }
  td { padding: 4px 5px; border: 1px solid #e2e8f0; vertical-align: top; }
  tfoot td { background: #f8fafc; font-weight: 600; border-top: 1px solid #94a3b8; }
  .r { text-align: right; white-space: nowrap; }
  .c { text-align: center; }
  .mono { font-family: Consolas, monospace; font-size: 8px; color: #475569; }
  .pos { color: #047857; }
  .neg { color: #b91c1c; }
  .tag { display: inline-block; padding: 0 4px; border-radius: 3px; background: #f1f5f9; color: #475569; font-size: 7.5px; font-weight: 700; }
  .tag-asm { background: #dbeafe; color: #1d4ed8; }
  .grand-row td { background: #eef2ff; font-weight: 700; color: #1e1b4b; border-top: 1.5px solid #6366f1; }
  .item { border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 8px; margin-bottom: 8px; page-break-inside: avoid; }
  .item-head { display: flex; flex-direction: column; gap: 3px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 5px; margin-bottom: 4px; }
  .item-no { display: inline-block; min-width: 16px; text-align: center; background: #1e3a8a; color: #fff; border-radius: 3px; font-weight: 700; margin-right: 2px; }
  .formula { color: #475569; font-size: 8.5px; }
  .sub-title { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; margin: 6px 0 3px; }
  .empty { color: #94a3b8; font-style: italic; font-size: 8.5px; padding: 2px 0 4px; }
  td.part { background: #fafbff; border-left: 2px solid #c7d2fe; padding: 3px 8px 4px 16px; }
  .part-line { font-size: 8px; color: #475569; padding: 1px 0; display: flex; gap: 4px; }
  .part-k { display: inline-block; min-width: 46px; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 7px; padding-top: 1px; }
  .part-v { margin-left: auto; color: #334155; }
  .part-sum { text-align: right; font-size: 8px; color: #64748b; border-top: 1px dotted #cbd5e1; margin-top: 2px; padding-top: 2px; }
  .note { margin-top: 10px; font-size: 7.5px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 5px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">
      ${logo ? `<img src="${logo}" />` : ''}
      <div>
        <div class="co-name">${esc(company?.company_name || 'SP TECHPIONEER PRIVATE LIMITED')}</div>
        <div class="co-meta">${esc(company?.company_address || '')}${(() => {
          const addr = String(company?.company_address || '').toUpperCase();
          const showGstin = company?.gstin && !addr.includes(String(company.gstin).toUpperCase());
          const parts = [];
          if (showGstin) parts.push(`GSTIN: <b>${esc(company.gstin)}</b>`);
          if (company?.pan) parts.push(`PAN: <b>${esc(company.pan)}</b>`);
          return parts.length ? `<br/>${parts.join(' &nbsp;·&nbsp; ')}` : '';
        })()}</div>
      </div>
    </div>
    <div class="doc">
      <div class="doc-title">QUOTATION COST BREAKDOWN</div>
      <div class="doc-sub">Internal costing sheet — confidential</div>
    </div>
  </div>

  <div class="meta">
    <div><div class="k">Quotation No.</div><div class="v">${esc(quoteNumber)}${version ? ` · V${esc(version)}` : ''}</div></div>
    <div><div class="k">Client</div><div class="v">${esc(clientName || '—')}</div></div>
    <div><div class="k">Project</div><div class="v">${esc(projectName || '—')}</div></div>
    <div><div class="k">Quotation Date / Status</div><div class="v">${esc(quoteDate || '—')}${status ? ` · ${esc(status)}` : ''}</div></div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="k">Material cost</div><div class="v">${money(totals.material)}</div></div>
    <div class="kpi"><div class="k">Operation cost</div><div class="v">${money(totals.operations)}</div></div>
    <div class="kpi"><div class="k">Total cost</div><div class="v">${money(cost)}</div></div>
    <div class="kpi"><div class="k">Profit &amp; overheads</div><div class="v ${totals.profit < 0 ? 'neg' : 'pos'}">${money(totals.profit)} <span style="font-size:8px;font-weight:600">(${marginPct.toFixed(1)}%)</span></div></div>
    <div class="kpi grand"><div class="k">Quotation total</div><div class="v">${money(totals.total)}</div></div>
  </div>

  <h3>Summary</h3>
  <table>
    <thead><tr>
      <th class="c" style="width:22px">#</th><th style="width:85px">Drawing No.</th><th>Description</th><th class="c" style="width:34px">Type</th>
      <th class="r" style="width:34px">Qty</th><th class="r">Material / unit</th><th class="r">Operations / unit</th><th class="r">Profit / unit</th>
      <th class="r">Unit Price</th><th class="r">Total</th>
    </tr></thead>
    <tbody>${summaryRows}</tbody>
    <tfoot><tr class="grand-row">
      <td colspan="4">Quotation Grand Total</td>
      <td class="r">${num(totals.qty, 2)}</td>
      <td class="r">${money(totals.material)}</td>
      <td class="r">${money(totals.operations)}</td>
      <td class="r">${money(totals.profit)}</td>
      <td></td>
      <td class="r">${money(totals.total)}</td>
    </tr></tfoot>
  </table>

  <h3>BOM Detail — Raw Materials &amp; Operations</h3>
  ${detailSections}

  <div class="note">
    Material cost = qty × weight per unit × (1 + scrap) × rate (or qty × rate for non-weight items). Operation cost = (setup + cycle minutes) ÷ 60 × hourly rate.
    Profit &amp; overheads = unit price − (material + operations). Grand-total columns are per-unit values × quantity. Generated ${esc(today)}.
  </div>
</body></html>`;
};

const generateCostBreakdownPdf = async (data) => {
  const html = buildHtml(data);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '10mm', right: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7px;color:#94a3b8;padding:0 10mm;display:flex;justify-content:space-between;">
        <span>${esc(data.quoteNumber)} · Cost Breakdown</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`
    });
  } finally {
    await browser.close();
  }
};

module.exports = { generateCostBreakdownPdf, buildCostBreakdownHtml: buildHtml };
