const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
  constructor() {
    this.defaultFont = 'Helvetica';
    this.boldFont = 'Helvetica-Bold';
    this.logoPath = path.join(__dirname, '../public/images/company-logo.jpg');
  }

  async generatePurchaseOrderPDF(poData, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('=== STARTING PDF GENERATION ===');
        console.log('PO Data received:', JSON.stringify(poData, null, 2));

        const doc = new PDFDocument({ 
          size: 'A4', 
          margins: { top: 50, bottom: 50, left: 40, right: 40 },
          info: {
            Title: `Purchase Order - ${poData.poNumber}`,
            Author: 'GRATO ENGINEERING GLOBAL LTD',
            Subject: 'Purchase Order',
            Creator: 'Purchase Order System'
          }
        });

        if (outputPath) {
          doc.pipe(fs.createWriteStream(outputPath));
        }

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          console.log('=== PDF GENERATION COMPLETED ===');
          resolve({
            success: true,
            buffer: pdfBuffer,
            filename: `PO_${poData.poNumber}_${Date.now()}.pdf`
          });
        });

        this.generateExactPOContent(doc, poData);
        doc.end();
      } catch (error) {
        console.error('PDF generation error:', error);
        reject({
          success: false,
          error: error.message
        });
      }
    });
  }

  generateExactPOContent(doc, poData) {
    let yPos = 50;

    // Header with logo and company info
    this.drawHeader(doc, yPos, poData);
    yPos += 90;

    // Two-column section: Shipping address (left) and Supplier (right)
    this.drawAddressSection(doc, yPos, poData);
    yPos += 90; 

    // Purchase Order Title Bar
    this.drawPOTitleBar(doc, yPos, poData);
    yPos += 50;

    // Items Table
    const tableHeight = this.drawItemsTable(doc, yPos, poData);
    yPos += tableHeight + 15;

    // Payment Terms
    this.drawPaymentTerms(doc, yPos, poData);
    yPos += 40;

    // Signature Section at the end
    this.drawSignatureSection(doc, yPos, poData);

    // Footer
    this.drawFooter(doc, poData);
  }

  drawHeader(doc, yPos, poData) {
    // Company Logo (left side)
    try {
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 40, yPos, { width: 60, height: 56 });
      } else {
        // Placeholder logo - red box with text
        doc.rect(40, yPos, 60, 60)
           .strokeColor('#E63946')
           .lineWidth(2)
           .stroke();
        
        doc.fontSize(8)
           .fillColor('#E63946')
           .font(this.boldFont)
           .text('GRATO', 48, yPos + 20)
           .text('ENGINEERING', 43, yPos + 32)
           .fillColor('#000000');
      }
    } catch (error) {
      console.log('Logo loading error:', error.message);
      // Draw placeholder
      doc.rect(40, yPos, 60, 60)
         .strokeColor('#E63946')
         .lineWidth(2)
         .stroke();
      
      doc.fontSize(8)
         .fillColor('#E63946')
         .font(this.boldFont)
         .text('GRATO', 48, yPos + 20)
         .text('ENGINEERING', 43, yPos + 32)
         .fillColor('#000000');
    }

    // Company name and address (left, under logo)
    doc.fontSize(11)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('GRATO ENGINEERING GLOBAL LTD', 110, yPos);

    doc.fontSize(9)
       .font(this.defaultFont)
       .text('Bonaberi', 110, yPos + 15)
       .text('Douala Cameroon', 110, yPos + 28);
  }

  drawAddressSection(doc, yPos, poData) {
    // Left column: Shipping address
    doc.fontSize(9)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Shipping address', 40, yPos);

    doc.font(this.defaultFont)
       .fontSize(9)
       .text('GRATO ENGINEERING GLOBAL LTD', 40, yPos + 15)
       .text('Bonaberi', 40, yPos + 28)
       .text('Douala', 40, yPos + 41)
       .text('Cameroon', 40, yPos + 54);

    doc.text('☎ 680726107/653738918', 40, yPos + 67);

    // Right column: Supplier information (dynamic based on PO data)
    const supplier = poData.supplierDetails || {};
    
    doc.font(this.defaultFont)
       .fontSize(9)
       .text(this.safeString(supplier.name, 'Supplier Name Not Available'), 320, yPos)
       .text(this.safeString(supplier.address, 'Address Not Available'), 320, yPos + 13)
       .text(this.safeString(supplier.email, 'Email Not Available'), 320, yPos + 26);

    if (supplier.phone) {
      doc.text(`☎ ${supplier.phone}`, 320, yPos + 39);
    }
    
    if (supplier.taxId || supplier.registrationNumber) {
      doc.fontSize(8)
         .text(`VAT: ${supplier.taxId || supplier.registrationNumber || 'N/A'}`, 320, yPos + 52);
    }
  }

  drawPOTitleBar(doc, yPos, poData) {
    // Purchase Order title - just colored text, no background bar
    doc.fillColor('#C5504B') 
       .fontSize(14)
       .font(this.boldFont)
       .text(`Purchase Order #${this.safeString(poData.poNumber, 'P00004')}`, 40, yPos);

    // Three-column info below title
    const detailsY = yPos + 25; // Reduced spacing
    
    // Buyer column
    doc.fillColor('#888888')
       .fontSize(8)
       .font(this.defaultFont)
       .text('Buyer:', 40, detailsY);
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font(this.defaultFont)
       .text('GRATO ENGINEERING', 40, detailsY + 12);

    // Order Date column  
    doc.fillColor('#888888')
       .fontSize(8)
       .text('Order Date:', 220, detailsY);
    
    doc.fillColor('#000000')
       .fontSize(9)
       .text(this.formatDateExact(poData.creationDate), 220, detailsY + 12);

    // Expected Arrival column
    doc.fillColor('#888888')
       .fontSize(8)
       .text('Expected Arrival:', 400, detailsY);
    
    doc.fillColor('#000000')
       .fontSize(9)
       .text(this.formatDateExact(poData.expectedDeliveryDate), 400, detailsY + 12);
  }

  drawItemsTable(doc, yPos, poData) {
    console.log('=== DRAWING ITEMS TABLE ===');
    console.log('Items data:', poData.items);
    
    const tableWidth = 515;
    const colX = {
      desc: 40,
      qty: 280,
      unitPrice: 325,
      disc: 400,
      taxes: 445,
      amount: 490
    };
    
    let currentY = yPos;

    // Table header with gray background
    doc.fillColor('#F5F5F5') // Lighter gray to match the image
       .rect(40, currentY, tableWidth, 20)
       .fill();

    doc.strokeColor('#CCCCCC')
       .lineWidth(0.5)
       .rect(40, currentY, tableWidth, 20)
       .stroke();

    doc.fillColor('#000000')
       .fontSize(9)
       .font(this.boldFont);

    // Column headers
    doc.text('Description', colX.desc + 5, currentY + 6);
    doc.text('Qty', colX.qty, currentY + 6);
    doc.text('Unit Price', colX.unitPrice, currentY + 6);
    doc.text('Disc.', colX.disc, currentY + 6);
    doc.text('Taxes', colX.taxes, currentY + 6);
    doc.text('Amount', colX.amount, currentY + 6);

    // Vertical lines for header
    [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
      doc.moveTo(x, currentY).lineTo(x, currentY + 20).stroke();
    });

    currentY += 20;

    // Determine tax rate
    let taxRate = 0;
    if (poData.taxApplicable) {
      taxRate = 0.1925; // 19.25%
      console.log('Tax is applicable, using 19.25%');
    }
    
    let grandTotal = 0;

    // Table rows
    const items = Array.isArray(poData.items) ? poData.items : [];
    console.log(`Processing ${items.length} items`);

    items.forEach((item, index) => {
      console.log(`=== Processing item ${index} ===`, item);
      
      const quantity = this.safeNumber(item.quantity, 0);
      const unitPrice = this.safeNumber(item.unitPrice, 0);
      const discount = this.safeNumber(item.discount, 0);
      
      // Calculate amounts
      const itemSubtotal = quantity * unitPrice;
      const discountAmount = itemSubtotal * (discount / 100);
      const afterDiscount = itemSubtotal - discountAmount;
      const taxAmount = afterDiscount * taxRate;
      const itemTotal = afterDiscount + taxAmount;
      
      console.log('Calculated:', { itemSubtotal, discountAmount, afterDiscount, taxAmount, itemTotal });
      
      grandTotal += itemTotal;

      // Clean white rows (no alternating background for cleaner look like the image)
      
      // Row border
      doc.strokeColor('#CCCCCC')
         .rect(40, currentY, tableWidth, 22)
         .stroke();

      doc.fillColor('#000000')
         .fontSize(9)
         .font(this.defaultFont);

      // Cell content
      const description = this.truncateText(this.safeString(item.description, 'No description'), 35);
      
      doc.text(description, colX.desc + 5, currentY + 6);
      doc.text(quantity.toFixed(2), colX.qty, currentY + 6);
      doc.text(this.formatCurrency(unitPrice), colX.unitPrice, currentY + 6);
      doc.text(discount > 0 ? `${discount.toFixed(2)}%` : '0.00%', colX.disc, currentY + 6);
      doc.text(taxRate > 0 ? '19.25% G' : '0%', colX.taxes, currentY + 6);
      doc.text(`${this.formatCurrency(itemTotal)} FCFA`, colX.amount, currentY + 6);

      // Vertical lines for row
      [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
        doc.moveTo(x, currentY).lineTo(x, currentY + 22).stroke();
      });

      currentY += 22;
    });

    // If no items
    if (items.length === 0) {
      doc.fillColor('#F9F9F9')
         .rect(40, currentY, tableWidth, 22)
         .fill();

      doc.strokeColor('#CCCCCC')
         .rect(40, currentY, tableWidth, 22)
         .stroke();

      doc.fillColor('#666666')
         .text('No items found', colX.desc + 5, currentY + 6);
      
      currentY += 22;
    }

    // Draw summary box
    this.drawOrderSummary(doc, currentY, grandTotal, taxRate);

    return currentY - yPos + 90;
  }

  drawOrderSummary(doc, yPos, grandTotal, taxRate) {
    console.log('=== DRAWING ORDER SUMMARY ===');
    console.log('Grand Total:', grandTotal, 'Tax Rate:', taxRate);
    
    const summaryX = 380;
    const summaryWidth = 175;
    const labelX = summaryX + 10;
    const valueX = summaryX + summaryWidth - 10;
    
    yPos += 10;

    // Calculate breakdown
    let untaxedAmount = grandTotal;
    let vatAmount = 0;
    
    if (taxRate > 0) {
      untaxedAmount = grandTotal / (1 + taxRate);
      vatAmount = grandTotal - untaxedAmount;
    }

    // Summary box border
    doc.strokeColor('#CCCCCC')
       .lineWidth(0.5)
       .rect(summaryX, yPos, summaryWidth, 68)
       .stroke();

    doc.fontSize(9)
       .font(this.defaultFont)
       .fillColor('#000000');

    // Untaxed Amount
    doc.text('Untaxed Amount', labelX, yPos + 10);
    doc.text(`${this.formatCurrency(untaxedAmount)} FCFA`, labelX, yPos + 10, {
      width: summaryWidth - 20,
      align: 'right'
    });

    // VAT line
    doc.text('VAT 19.25%', labelX, yPos + 28);
    doc.text(`${this.formatCurrency(vatAmount)} FCFA`, labelX, yPos + 28, {
      width: summaryWidth - 20,
      align: 'right'
    });

    // Total row with gray background
    doc.fillColor('#E8E8E8')
       .rect(summaryX, yPos + 46, summaryWidth, 22)
       .fill();

    doc.strokeColor('#CCCCCC')
       .rect(summaryX, yPos + 46, summaryWidth, 22)
       .stroke();

    doc.fillColor('#000000')
       .font(this.boldFont)
       .text('Total', labelX, yPos + 53);
    
    doc.text(`${this.formatCurrency(grandTotal)} FCFA`, labelX, yPos + 53, {
      width: summaryWidth - 20,
      align: 'right'
    });
  }

  drawSignatureSection(doc, yPos, poData) {
    // Add some spacing before signatures
    yPos += 20;
    
    // doc.fontSize(9)
    //    .font(this.boldFont)
    //    .fillColor('#000000')
    //    .text('Signatures:', 40, yPos);
    
    // Three signature lines
    const signatureY = yPos + 20;
    const lineWidth = 120;
    const lineSpacing = 160;
    
    // Line 1 - Buyer
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(40, signatureY + 30)
       .lineTo(40 + lineWidth, signatureY + 30)
       .stroke();
    
    doc.fontSize(8)
       .font(this.defaultFont)
      //  .text('Buyer Signature', 40, signatureY + 35);
    // doc.text('Date: ___________', 40, signatureY + 48);
    
    // Line 2 - Supplier
    doc.moveTo(40 + lineSpacing, signatureY + 30)
       .lineTo(40 + lineSpacing + lineWidth, signatureY + 30)
       .stroke();
    // doc.text('Supplier Signature', 40 + lineSpacing, signatureY + 35);
    // doc.text('Date: ___________', 40 + lineSpacing, signatureY + 48);
    
    // Line 3 - Finance Approval
    doc.moveTo(40 + (lineSpacing * 2), signatureY + 30)
       .lineTo(40 + (lineSpacing * 2) + lineWidth, signatureY + 30)
       .stroke();
    // doc.text('Finance Approval', 40 + (lineSpacing * 2), signatureY + 35);
    // doc.text('Date: ___________', 40 + (lineSpacing * 2), signatureY + 48);
  }

  drawPaymentTerms(doc, yPos, poData) {
    doc.fontSize(9)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Payment Terms:', 40, yPos);

    doc.font(this.defaultFont)
       .fontSize(8)
       .text(this.safeString(poData.paymentTerms, 'Net 30 days'), 40, yPos + 15);

    // Special instructions if any
    if (poData.specialInstructions) {
      doc.font(this.boldFont)
         .fontSize(9)
         .text('Special Instructions:', 40, yPos + 35);

      doc.font(this.defaultFont)
         .fontSize(8)
         .text(this.safeString(poData.specialInstructions, ''), 40, yPos + 50, {
           width: 500
         });
    }
  }

  drawFooter(doc, poData) {
    const footerY = doc.page.height - 80;
    
    // Horizontal line
    doc.strokeColor('#CCCCCC')
       .lineWidth(0.5)
       .moveTo(40, footerY)
       .lineTo(555, footerY)
       .stroke();

    // Footer content
    doc.fontSize(7)
       .font(this.defaultFont)
       .fillColor('#666666');

    // Registration and page number
    doc.text('RC/DLA/2014/B/2690 NIU: M061421030521 Access Bank Cameroon PLC 10041000010010130003616', 40, footerY + 8);
    doc.text('Page 1 / 1', 520, footerY + 8);

    // Contact information
    doc.text('679586444 info@gratoengineering.com www.gratoengineering.com', 40, footerY + 20);
    doc.text('Location: Bonaberi-Douala, beside Santa', 40, footerY + 32);
    doc.text('Lucia Telecommunications, Civil, Electrical and Mechanical Engineering Services.', 40, footerY + 44);
  }

  // Helper methods
  safeNumber(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  safeString(value, defaultValue = '') {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    const str = String(value);
    if (str.includes('NaN') || str === 'NaN') {
      return defaultValue || '0';
    }
    return str;
  }

  formatDateExact(date) {
    if (!date) return '';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      
      return `${month}/${day}/${year}`;
    } catch (error) {
      console.error('Date formatting error:', error);
      return '';
    }
  }

  formatCurrency(number) {
    const safeNum = this.safeNumber(number, 0);
    if (isNaN(safeNum)) return '0.00';
    
    try {
      return safeNum.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } catch (error) {
      console.error('Number formatting error:', error);
      return '0.00';
    }
  }

  truncateText(text, maxLength) {
    const safeText = this.safeString(text, '');
    if (safeText.length <= maxLength) return safeText;
    return safeText.substring(0, maxLength - 3) + '...';
  }
}

module.exports = new PDFService();