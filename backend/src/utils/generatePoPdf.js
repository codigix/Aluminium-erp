const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mustache = require('mustache');

const generatePoPdf = async (data) => {
  const { type = 'receipt', receipt, po, items = [] } = data;
  
  try {
    const templatePath = path.join(__dirname, '../../templates/po-receipt.html');
    const template = fs.readFileSync(templatePath, 'utf8');

    const formatCurrency = (value) => {
      if (!value) return '0.00';
      return parseFloat(value).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    const formatDate = (date) => {
      if (!date) return '—';
      try {
        return new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        return date;
      }
    };

    let renderData = {
      logoPath: path.join(__dirname, '../../assets/logo.png'),
      isReceipt: type === 'receipt',
      isPO: type === 'po',
      items: items.map((item, idx) => ({
        sr: idx + 1,
        itemCode: item.item_code || item.itemCode || '—',
        description: item.description || '—',
        qty: parseFloat(item.quantity || 0).toFixed(3),
        rate: formatCurrency(item.unit_rate || item.rate || 0),
        amount: formatCurrency(item.amount || (parseFloat(item.quantity || 0) * parseFloat(item.unit_rate || item.rate || 0)))
      }))
    };

    if (type === 'receipt' && receipt) {
      renderData = {
        ...renderData,
        poNumber: receipt.po_number || '—',
        poDate: formatDate(receipt.created_at),
        receiptId: `REC-${receipt.id}`,
        receiptDate: formatDate(receipt.receipt_date),
        refNo: receipt.po_number || '—',
        vendorName: receipt.vendor_name || '—',
        vendorAddress: '',
        vendorGST: '',
        vendorPhone: '',
        supplierCode: '',
        quotationRef: receipt.po_number || '—',
        paymentTerms: '',
        deliveryDate: '—',
        transport: 'inclusive',
        notes: receipt.notes || '',
        subTotal: formatCurrency(receipt.total_amount || 0),
        cgstAmount: '',
        cgstPercent: 0,
        sgstAmount: '',
        sgstPercent: 0,
        igstAmount: '',
        igstPercent: 0,
        grandTotal: formatCurrency(receipt.total_amount || 0)
      };
    } else if (type === 'po' && po) {
      const subTotal = po.total_amount || 0;
      renderData = {
        ...renderData,
        poNumber: po.po_number || '—',
        poDate: formatDate(po.created_at),
        vendorName: po.vendor_name || '—',
        vendorAddress: '',
        vendorGST: '',
        vendorPhone: '',
        supplierCode: '',
        quotationRef: po.po_number || '—',
        paymentTerms: po.notes || '',
        deliveryDate: formatDate(po.expected_delivery_date),
        transport: 'inclusive',
        notes: po.notes || '',
        subTotal: formatCurrency(subTotal),
        cgstAmount: formatCurrency(0),
        cgstPercent: 9,
        sgstAmount: formatCurrency(0),
        sgstPercent: 9,
        igstAmount: '',
        igstPercent: 0,
        grandTotal: formatCurrency(subTotal)
      };
    }

    const html = mustache.render(template, renderData);

    const outputDir = path.join(__dirname, '../../pdf');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfFileName = type === 'receipt' 
      ? `PO_Receipt_${receipt?.id || Date.now()}.pdf`
      : `PO_${po?.po_number || Date.now()}.pdf`;

    const pdfPath = path.join(outputDir, pdfFileName);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '10mm',
        right: '10mm'
      }
    });

    await browser.close();

    return pdfPath;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  }
};

module.exports = generatePoPdf;
