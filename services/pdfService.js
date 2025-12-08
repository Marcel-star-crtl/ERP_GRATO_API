// services/pdfService.js - COMPLETE FILE WITH FIXED PAGINATION

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
  constructor() {
    this.defaultFont = 'Helvetica';
    this.boldFont = 'Helvetica-Bold';
    this.logoPath = path.join(__dirname, '../public/images/company-logo.jpg');
    this.pageMargins = { top: 50, bottom: 80, left: 40, right: 40 };
  }

  // ============================================
  // PURCHASE ORDER PDF - FIXED PAGINATION
  // ============================================
  // async generatePurchaseOrderPDF(poData, outputPath) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       console.log('=== STARTING PDF GENERATION ===');
  //       console.log('PO Data received:', JSON.stringify(poData, null, 2));

  //       const doc = new PDFDocument({ 
  //         size: 'A4', 
  //         margins: this.pageMargins,
  //         info: {
  //           Title: `Purchase Order - ${poData.poNumber}`,
  //           Author: 'GRATO ENGINEERING GLOBAL LTD',
  //           Subject: 'Purchase Order',
  //           Creator: 'Purchase Order System'
  //         }
  //       });

  //       if (outputPath) {
  //         doc.pipe(fs.createWriteStream(outputPath));
  //       }

  //       const chunks = [];
  //       doc.on('data', chunk => chunks.push(chunk));
  //       doc.on('end', () => {
  //         const pdfBuffer = Buffer.concat(chunks);
  //         console.log('=== PDF GENERATION COMPLETED ===');
  //         resolve({
  //           success: true,
  //           buffer: pdfBuffer,
  //           filename: `PO_${poData.poNumber}_${Date.now()}.pdf`
  //         });
  //       });

  //       this.generateExactPOContent(doc, poData);
  //       doc.end();
  //     } catch (error) {
  //       console.error('PDF generation error:', error);
  //       reject({
  //         success: false,
  //         error: error.message
  //       });
  //     }
  //   });
  // }

  async generatePurchaseOrderPDF(poData, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('=== STARTING PDF GENERATION ===');
        console.log('PO Data received:', JSON.stringify(poData, null, 2));

        const doc = new PDFDocument({ 
          size: 'A4', 
          margins: this.pageMargins,
          bufferPages: true, // ✅ CRITICAL: Enable page buffering for switchToPage
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
    let currentPage = 1;

    // Header with logo and company info
    this.drawHeader(doc, yPos, poData);
    yPos += 90;

    // Two-column section: Shipping address (left) and Supplier (right)
    this.drawAddressSection(doc, yPos, poData);
    yPos += 90; 

    // Purchase Order Title Bar
    this.drawPOTitleBar(doc, yPos, poData);
    yPos += 50;

    // Items Table - This handles pagination internally
    const tableResult = this.drawItemsTable(doc, yPos, poData, currentPage);
    yPos = tableResult.yPos;
    currentPage = tableResult.currentPage;

    // Check if we need a new page for remaining content
    if (yPos > 650) {
      doc.addPage();
      currentPage++;
      yPos = 50;
    }

    // Payment Terms
    this.drawPaymentTerms(doc, yPos, poData);
    yPos += 60;

    // Check if we need a new page for signature
    if (yPos > 680) {
      doc.addPage();
      currentPage++;
      yPos = 50;
    }

    // Signature Section
    this.drawSignatureSection(doc, yPos, poData);

    // ✅ FIXED: Draw footer on all pages with correct indexing
    const range = doc.bufferedPageRange();
    console.log('Page range:', range); // Debug log
    
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i); // ✅ Use 0-based index
      this.drawFooter(doc, poData, i + 1, range.count); // Pass 1-based page number for display
    }
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

    doc.text('682952153', 40, yPos + 67);

    // Right column: Supplier information (dynamic based on PO data)
    const supplier = poData.supplierDetails || {};
    
    doc.font(this.defaultFont)
       .fontSize(9)
       .text(this.safeString(supplier.name, 'Supplier Name Not Available'), 320, yPos)
       .text(this.safeString(supplier.address, 'Address Not Available'), 320, yPos + 13)
       .text(this.safeString(supplier.email, 'Email Not Available'), 320, yPos + 26);

    if (supplier.phone) {
      doc.text(`${supplier.phone}`, 320, yPos + 39);
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
    const detailsY = yPos + 25;
    
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

  drawItemsTable(doc, yPos, poData, currentPage) {
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
    const pageBottomLimit = 720; // Leave space for footer

    // Draw table header
    const drawTableHeader = (y) => {
      // Table header with gray background
      doc.fillColor('#F5F5F5')
         .rect(40, y, tableWidth, 20)
         .fill();

      doc.strokeColor('#CCCCCC')
         .lineWidth(0.5)
         .rect(40, y, tableWidth, 20)
         .stroke();

      doc.fillColor('#000000')
         .fontSize(9)
         .font(this.boldFont);

      // Column headers
      doc.text('Description', colX.desc + 5, y + 6);
      doc.text('Qty', colX.qty, y + 6);
      doc.text('Unit Price', colX.unitPrice, y + 6);
      doc.text('Disc.', colX.disc, y + 6);
      doc.text('Taxes', colX.taxes, y + 6);
      doc.text('Amount', colX.amount, y + 6);

      // Vertical lines for header
      [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
        doc.moveTo(x, y).lineTo(x, y + 20).stroke();
      });

      return y + 20;
    };

    currentY = drawTableHeader(currentY);

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
      
      // Get full description
      const description = this.safeString(item.description, 'No description');
      
      // Calculate dynamic row height based on description length
      const descWidth = 230; // Width available for description column
      doc.fontSize(8).font(this.defaultFont);
      const descHeight = doc.heightOfString(description, { width: descWidth, lineGap: 1 });
      const rowHeight = Math.max(25, descHeight + 12); // Minimum 25px, or description height + padding
      
      // ✅ FIXED: Check if row will fit on current page
      if (currentY + rowHeight > pageBottomLimit) {
        // Add new page
        doc.addPage();
        currentPage++;
        currentY = 50;
        
        // Redraw header on new page
        currentY = drawTableHeader(currentY);
      }

      // Row border
      doc.strokeColor('#CCCCCC')
         .rect(40, currentY, tableWidth, rowHeight)
         .stroke();

      doc.fillColor('#000000')
         .fontSize(8)
         .font(this.defaultFont);

      // Description - full text with word wrap
      doc.text(description, colX.desc + 5, currentY + 6, {
        width: descWidth,
        align: 'left',
        lineGap: 1
      });
      
      // Other columns - vertically centered
      const textY = currentY + (rowHeight / 2) - 4;
      
      doc.text(quantity.toFixed(2), colX.qty, textY);
      doc.text(this.formatCurrency(unitPrice), colX.unitPrice, textY);
      doc.text(discount > 0 ? `${discount.toFixed(2)}%` : '0.00%', colX.disc, textY);
      doc.text(taxRate > 0 ? '19.25% G' : '0%', colX.taxes, textY);
      doc.text(`${this.formatCurrency(itemTotal)} FCFA`, colX.amount, textY);

      // Vertical lines for row
      [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
      });

      currentY += rowHeight;
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

    // Check if summary will fit on current page
    if (currentY + 100 > pageBottomLimit) {
      doc.addPage();
      currentPage++;
      currentY = 50;
    }

    // Draw summary box
    this.drawOrderSummary(doc, currentY, grandTotal, taxRate);
    currentY += 90;

    return { yPos: currentY, currentPage };
  }

  drawOrderSummary(doc, yPos, grandTotal, taxRate) {
    console.log('=== DRAWING ORDER SUMMARY ===');
    console.log('Grand Total:', grandTotal, 'Tax Rate:', taxRate);
    
    const summaryX = 380;
    const summaryWidth = 175;
    const labelX = summaryX + 10;
    
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
    yPos += 20;
    
    const signatureY = yPos + 20;
    const lineWidth = 120;
    const lineSpacing = 160;
    
    // Three signature lines
    for (let i = 0; i < 3; i++) {
      const xPos = 40 + (i * lineSpacing);
      
      doc.moveTo(xPos, signatureY + 30)
         .lineTo(xPos + lineWidth, signatureY + 30)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
    }
  }

  drawPaymentTerms(doc, yPos, poData) {
    doc.fontSize(9)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Payment Terms:', 40, yPos);

    doc.font(this.defaultFont)
       .fontSize(8)
       .text(this.safeString(poData.paymentTerms, 'Net 30 days'), 40, yPos + 15);

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

 drawFooter(doc, poData, pageNum, totalPages) {
    const footerY = doc.page.height - 80;
    
    // ✅ SAVE current state before drawing footer
    doc.save();
    
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
    doc.text('RC/DLA/2014/B/2690 NIU: M061421030521 Access Bank Cameroon PLC 10041000010010130003616', 40, footerY + 8, {
      width: 470,
      continued: false // ✅ Prevents text from continuing
    });
    
    doc.text(`Page ${pageNum} / ${totalPages}`, 520, footerY + 8, {
      width: 35,
      align: 'right',
      continued: false
    });

    // Contact information
    doc.text('679586444 info@gratoengineering.com www.gratoengineering.com', 40, footerY + 20, {
      width: 515,
      continued: false
    });
    
    doc.text('Location: Bonaberi-Douala, beside Santa', 40, footerY + 32, {
      width: 515,
      continued: false
    });
    
    doc.text('Lucia Telecommunications, Civil, Electrical and Mechanical Engineering Services.', 40, footerY + 44, {
      width: 515,
      continued: false
    });
    
    // ✅ RESTORE state after drawing footer
    doc.restore();
  }

  // drawFooter(doc, poData, pageNum, totalPages) {
  //   const footerY = doc.page.height - 80;
    
  //   // Horizontal line
  //   doc.strokeColor('#CCCCCC')
  //      .lineWidth(0.5)
  //      .moveTo(40, footerY)
  //      .lineTo(555, footerY)
  //      .stroke();

  //   // Footer content
  //   doc.fontSize(7)
  //      .font(this.defaultFont)
  //      .fillColor('#666666');

  //   // Registration and page number
  //   doc.text('RC/DLA/2014/B/2690 NIU: M061421030521 Access Bank Cameroon PLC 10041000010010130003616', 40, footerY + 8);
  //   doc.text(`Page ${pageNum} / ${totalPages}`, 520, footerY + 8);

  //   // Contact information
  //   doc.text('679586444 info@gratoengineering.com www.gratoengineering.com', 40, footerY + 20);
  //   doc.text('Location: Bonaberi-Douala, beside Santa', 40, footerY + 32);
  //   doc.text('Lucia Telecommunications, Civil, Electrical and Mechanical Engineering Services.', 40, footerY + 44);
  // }

  generateExactPOContent(doc, poData) {
    let yPos = 50;
    let currentPage = 1;

    // Header with logo and company info
    this.drawHeader(doc, yPos, poData);
    yPos += 90;

    // Two-column section: Shipping address (left) and Supplier (right)
    this.drawAddressSection(doc, yPos, poData);
    yPos += 90; 

    // Purchase Order Title Bar
    this.drawPOTitleBar(doc, yPos, poData);
    yPos += 50;

    // Items Table - This handles pagination internally
    const tableResult = this.drawItemsTable(doc, yPos, poData, currentPage);
    yPos = tableResult.yPos;
    currentPage = tableResult.currentPage;

    // Check if we need a new page for remaining content
    if (yPos > 650) {
      doc.addPage();
      currentPage++;
      yPos = 50;
    }

    // Payment Terms
    this.drawPaymentTerms(doc, yPos, poData);
    yPos += 60;

    // Check if we need a new page for signature
    if (yPos > 680) {
      doc.addPage();
      currentPage++;
      yPos = 50;
    }

    // Signature Section
    this.drawSignatureSection(doc, yPos, poData);

    // Footer on each page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      this.drawFooter(doc, poData, i + 1, range.count);
    }
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

    doc.text('682952153', 40, yPos + 67);

    // Right column: Supplier information (dynamic based on PO data)
    const supplier = poData.supplierDetails || {};
    
    doc.font(this.defaultFont)
       .fontSize(9)
       .text(this.safeString(supplier.name, 'Supplier Name Not Available'), 320, yPos)
       .text(this.safeString(supplier.address, 'Address Not Available'), 320, yPos + 13)
       .text(this.safeString(supplier.email, 'Email Not Available'), 320, yPos + 26);

    if (supplier.phone) {
      doc.text(`${supplier.phone}`, 320, yPos + 39);
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
    const detailsY = yPos + 25;
    
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

  drawItemsTable(doc, yPos, poData, currentPage) {
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
    const pageBottomLimit = 720; // Leave space for footer

    // Draw table header
    const drawTableHeader = (y) => {
      // Table header with gray background
      doc.fillColor('#F5F5F5')
         .rect(40, y, tableWidth, 20)
         .fill();

      doc.strokeColor('#CCCCCC')
         .lineWidth(0.5)
         .rect(40, y, tableWidth, 20)
         .stroke();

      doc.fillColor('#000000')
         .fontSize(9)
         .font(this.boldFont);

      // Column headers
      doc.text('Description', colX.desc + 5, y + 6);
      doc.text('Qty', colX.qty, y + 6);
      doc.text('Unit Price', colX.unitPrice, y + 6);
      doc.text('Disc.', colX.disc, y + 6);
      doc.text('Taxes', colX.taxes, y + 6);
      doc.text('Amount', colX.amount, y + 6);

      // Vertical lines for header
      [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
        doc.moveTo(x, y).lineTo(x, y + 20).stroke();
      });

      return y + 20;
    };

    currentY = drawTableHeader(currentY);

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
      
      // Get full description
      const description = this.safeString(item.description, 'No description');
      
      // Calculate dynamic row height based on description length
      const descWidth = 230; // Width available for description column
      doc.fontSize(8).font(this.defaultFont);
      const descHeight = doc.heightOfString(description, { width: descWidth, lineGap: 1 });
      const rowHeight = Math.max(25, descHeight + 12); // Minimum 25px, or description height + padding
      
      // Check if row will fit on current page
      if (currentY + rowHeight > pageBottomLimit) {
        // Add new page
        doc.addPage();
        currentPage++;
        currentY = 50;
        
        // Redraw header on new page
        currentY = drawTableHeader(currentY);
      }

      // Row border
      doc.strokeColor('#CCCCCC')
         .rect(40, currentY, tableWidth, rowHeight)
         .stroke();

      doc.fillColor('#000000')
         .fontSize(8)
         .font(this.defaultFont);

      // Description - full text with word wrap
      doc.text(description, colX.desc + 5, currentY + 6, {
        width: descWidth,
        align: 'left',
        lineGap: 1
      });
      
      // Other columns - vertically centered
      const textY = currentY + (rowHeight / 2) - 4;
      
      doc.text(quantity.toFixed(2), colX.qty, textY);
      doc.text(this.formatCurrency(unitPrice), colX.unitPrice, textY);
      doc.text(discount > 0 ? `${discount.toFixed(2)}%` : '0.00%', colX.disc, textY);
      doc.text(taxRate > 0 ? '19.25% G' : '0%', colX.taxes, textY);
      doc.text(`${this.formatCurrency(itemTotal)} FCFA`, colX.amount, textY);

      // Vertical lines for row
      [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
      });

      currentY += rowHeight;
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

    // Check if summary will fit on current page
    if (currentY + 100 > pageBottomLimit) {
      doc.addPage();
      currentPage++;
      currentY = 50;
    }

    // Draw summary box
    this.drawOrderSummary(doc, currentY, grandTotal, taxRate);
    currentY += 90;

    return { yPos: currentY, currentPage };
  }

  // drawOrderSummary(doc, yPos, grandTotal, taxRate) {
  //   console.log('=== DRAWING ORDER SUMMARY ===');
  //   console.log('Grand Total:', grandTotal, 'Tax Rate:', taxRate);
    
  //   const summaryX = 380;
  //   const summaryWidth = 175;
  //   const labelX = summaryX + 10;
    
  //   yPos += 10;

  //   // Calculate breakdown
  //   let untaxedAmount = grandTotal;
  //   let vatAmount = 0;
    
  //   if (taxRate > 0) {
  //     untaxedAmount = grandTotal / (1 + taxRate);
  //     vatAmount = grandTotal - untaxedAmount;
  //   }

  //   // Summary box border
  //   doc.strokeColor('#CCCCCC')
  //      .lineWidth(0.5)
  //      .rect(summaryX, yPos, summaryWidth, 68)
  //      .stroke();

  //   doc.fontSize(9)
  //      .font(this.defaultFont)
  //      .fillColor('#000000');

  //   // Untaxed Amount
  //   doc.text('Untaxed Amount', labelX, yPos + 10);
  //   doc.text(`${this.formatCurrency(untaxedAmount)} FCFA`, labelX, yPos + 10, {
  //     width: summaryWidth - 20,
  //     align: 'right'
  //   });

  //   // VAT line
  //   doc.text('VAT 19.25%', labelX, yPos + 28);
  //   doc.text(`${this.formatCurrency(vatAmount)} FCFA`, labelX, yPos + 28, {
  //     width: summaryWidth - 20,
  //     align: 'right'
  //   });

  //   // Total row with gray background
  //   doc.fillColor('#E8E8E8')
  //      .rect(summaryX, yPos + 46, summaryWidth, 22)
  //      .fill();

  //   doc.strokeColor('#CCCCCC')
  //      .rect(summaryX, yPos + 46, summaryWidth, 22)
  //      .stroke();

  //   doc.fillColor('#000000')
  //      .font(this.boldFont)
  //      .text('Total', labelX, yPos + 53);
    
  //   doc.text(`${this.formatCurrency(grandTotal)} FCFA`, labelX, yPos + 53, {
  //     width: summaryWidth - 20,
  //     align: 'right'
  //   });
  // }

  // drawSignatureSection(doc, yPos, poData) {
  //   yPos += 20;
    
  //   const signatureY = yPos + 20;
  //   const lineWidth = 120;
  //   const lineSpacing = 160;
    
  //   // Three signature lines
  //   for (let i = 0; i < 3; i++) {
  //     const xPos = 40 + (i * lineSpacing);
      
  //     doc.moveTo(xPos, signatureY + 30)
  //        .lineTo(xPos + lineWidth, signatureY + 30)
  //        .strokeColor('#000000')
  //        .lineWidth(0.5)
  //        .stroke();
  //   }
  // }

  // drawPaymentTerms(doc, yPos, poData) {
  //   doc.fontSize(9)
  //      .font(this.boldFont)
  //      .fillColor('#000000')
  //      .text('Payment Terms:', 40, yPos);

  //   doc.font(this.defaultFont)
  //      .fontSize(8)
  //      .text(this.safeString(poData.paymentTerms, 'Net 30 days'), 40, yPos + 15);

  //   if (poData.specialInstructions) {
  //     doc.font(this.boldFont)
  //        .fontSize(9)
  //        .text('Special Instructions:', 40, yPos + 35);

  //     doc.font(this.defaultFont)
  //        .fontSize(8)
  //        .text(this.safeString(poData.specialInstructions, ''), 40, yPos + 50, {
  //          width: 500
  //        });
  //   }
  // }

  // drawFooter(doc, poData, pageNum, totalPages) {
  //   const footerY = doc.page.height - 80;
    
  //   // Horizontal line
  //   doc.strokeColor('#CCCCCC')
  //      .lineWidth(0.5)
  //      .moveTo(40, footerY)
  //      .lineTo(555, footerY)
  //      .stroke();

  //   // Footer content
  //   doc.fontSize(7)
  //      .font(this.defaultFont)
  //      .fillColor('#666666');

  //   // Registration and page number
  //   doc.text('RC/DLA/2014/B/2690 NIU: M061421030521 Access Bank Cameroon PLC 10041000010010130003616', 40, footerY + 8);
  //   doc.text(`Page ${pageNum} / ${totalPages}`, 520, footerY + 8);

  //   // Contact information
  //   doc.text('679586444 info@gratoengineering.com www.gratoengineering.com', 40, footerY + 20);
  //   doc.text('Location: Bonaberi-Douala, beside Santa', 40, footerY + 32);
  //   doc.text('Lucia Telecommunications, Civil, Electrical and Mechanical Engineering Services.', 40, footerY + 44);
  // }

  // ============================================
  // PETTY CASH FORM PDF (Uses Cash Request Format)
  // ============================================
  async generatePettyCashFormPDF(formData, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('=== STARTING PETTY CASH FORM PDF GENERATION ===');
        console.log('Form Number:', formData.displayId);
        console.log('Requisition:', formData.requisitionNumber);

        const doc = new PDFDocument({ 
          size: 'A4', 
          margins: this.pageMargins,
          info: {
            Title: `Petty Cash Form - ${formData.displayId}`,
            Author: 'GRATO ENGINEERING GLOBAL LTD',
            Subject: 'Petty Cash Form',
            Creator: 'Purchase Requisition System'
          }
        });

        if (outputPath) {
          doc.pipe(fs.createWriteStream(outputPath));
        }

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          console.log('=== PETTY CASH FORM PDF GENERATION COMPLETED ===');
          resolve({
            success: true,
            buffer: pdfBuffer,
            filename: `Petty_Cash_Form_${formData.displayId}_${Date.now()}.pdf`
          });
        });

        this.generateCashRequestContent(doc, formData);
        doc.end();
      } catch (error) {
        console.error('Petty Cash Form PDF generation error:', error);
        reject({
          success: false,
          error: error.message
        });
      }
    });
  }

  // ============================================
  // CASH REQUEST PDF (Employee Format)
  // ============================================
  async generateCashRequestPDF(requestData, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('=== STARTING CASH REQUEST PDF GENERATION ===');
        console.log('Request ID:', requestData._id);
        console.log('Employee:', requestData.employee?.fullName);

        const doc = new PDFDocument({ 
          size: 'A4', 
          margins: this.pageMargins,
          info: {
            Title: `Cash Request - ${requestData.displayId || requestData._id}`,
            Author: 'GRATO ENGINEERING GLOBAL LTD',
            Subject: 'Cash Request Document',
            Creator: 'Cash Request System'
          }
        });

        if (outputPath) {
          doc.pipe(fs.createWriteStream(outputPath));
        }

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          console.log('=== CASH REQUEST PDF GENERATION COMPLETED ===');
          resolve({
            success: true,
            buffer: pdfBuffer,
            filename: `Cash_Request_${requestData.displayId || requestData._id.toString().slice(-6).toUpperCase()}_${Date.now()}.pdf`
          });
        });

        this.generateCashRequestContent(doc, requestData);
        doc.end();
      } catch (error) {
        console.error('Cash Request PDF generation error:', error);
        reject({
          success: false,
          error: error.message
        });
      }
    });
  }

  generateCashRequestContent(doc, data) {
    let yPos = 50;

    // Header with logo and company info
    this.drawCashRequestHeader(doc, yPos, data);
    yPos += 90;

    // Request title bar
    this.drawCashRequestTitleBar(doc, yPos, data);
    yPos += 60;

    // Employee and Request Details
    yPos = this.drawCashRequestDetails(doc, yPos, data);

    // Check page break before approval chain
    if (yPos > 600) {
      doc.addPage();
      yPos = 50;
    }

    // Disbursement History (if exists)
    if (data.disbursements && data.disbursements.length > 0) {
      yPos = this.drawDisbursementHistory(doc, yPos, data);
      
      // Check page break after disbursement
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }
    }

    // Approval Chain Timeline
    yPos = this.drawApprovalChainTimeline(doc, yPos, data);

    // Check page break before financial summary
    if (yPos > 650) {
      doc.addPage();
      yPos = 50;
    }

    // Financial Summary
    yPos = this.drawCashRequestFinancialSummary(doc, yPos, data);

    // Budget Allocation (if exists)
    if (data.budgetAllocation && data.budgetAllocation.budgetCodeId) {
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }
      yPos = this.drawBudgetAllocation(doc, yPos, data);
    }

    // Check page break before signatures
    if (yPos > 680) {
      doc.addPage();
      yPos = 50;
    }

    // Signature Section
    this.drawCashRequestSignatureSection(doc, yPos, data);

    // Footer on all pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      this.drawCashRequestFooter(doc, data);
    }
  }

  drawCashRequestHeader(doc, yPos, data) {
    // Company Logo
    try {
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 40, yPos, { width: 60, height: 56 });
      } else {
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
      doc.rect(40, yPos, 60, 60)
         .strokeColor('#E63946')
         .lineWidth(2)
         .stroke();
    }

    // Company name and address
    doc.fontSize(11)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('GRATO ENGINEERING GLOBAL LTD', 110, yPos);

    doc.fontSize(9)
       .font(this.defaultFont)
       .text('Bonaberi', 110, yPos + 15)
       .text('Douala Cameroon', 110, yPos + 28)
       .text('682952153', 110, yPos + 41);
  }

  drawCashRequestTitleBar(doc, yPos, data) {
    // Title
    doc.fillColor('#C5504B') 
       .fontSize(14)
       .font(this.boldFont)
       .text(`CASH REQUEST #${data.displayId || data._id.toString().slice(-6).toUpperCase()}`, 40, yPos);

    const detailsY = yPos + 25;
    
    // Three columns
    doc.fillColor('#888888')
       .fontSize(8)
       .font(this.defaultFont)
       .text('Status:', 40, detailsY);
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font(this.boldFont)
       .text(this.formatStatus(data.status), 40, detailsY + 12);

    doc.fillColor('#888888')
       .fontSize(8)
       .text('Request Date:', 220, detailsY);
    
    doc.fillColor('#000000')
       .fontSize(9)
       .text(this.formatDateExact(data.createdAt), 220, detailsY + 12);

    // Show first disbursement date instead of single disbursement
    doc.fillColor('#888888')
       .fontSize(8)
       .text('First Disbursement:', 400, detailsY);
    
    const firstDisbursementDate = data.disbursements && data.disbursements.length > 0
      ? data.disbursements[0].date
      : data.disbursementDetails?.date;
    
    doc.fillColor('#000000')
       .fontSize(9)
       .text(this.formatDateExact(firstDisbursementDate), 400, detailsY + 12);
  }

  drawCashRequestDetails(doc, yPos, data) {
    yPos += 10;
    
    // Section header
    doc.fontSize(11)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Request Details', 40, yPos);
    
    yPos += 20;

    // Compact details box
    const boxStartY = yPos;
    const boxHeight = 100;
    
    doc.rect(40, yPos, 515, boxHeight)
       .strokeColor('#CCCCCC')
       .lineWidth(0.5)
       .stroke();

    yPos += 10;

    // Left Column - Employee Info
    doc.fontSize(8)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Requested By:', 50, yPos);
    
    doc.font(this.defaultFont)
       .fontSize(9)
       .text(data.employee?.fullName || 'N/A', 50, yPos + 12);
    
    doc.fontSize(8)
       .fillColor('#666666')
       .text(`${data.employee?.department || 'N/A'}`, 50, yPos + 25);

    // Right Column - Request Info
    doc.fillColor('#000000')
       .fontSize(8)
       .font(this.boldFont)
       .text('Request Type:', 280, yPos);
    
    doc.font(this.defaultFont)
       .fontSize(9)
       .text(this.formatRequestType(data.requestType), 280, yPos + 12);

    doc.font(this.boldFont)
       .fontSize(8)
       .text('Urgency:', 280, yPos + 30);
    
    doc.font(this.defaultFont)
       .fontSize(9)
       .text(this.formatUrgency(data.urgency), 280, yPos + 42);

    if (data.projectId) {
      doc.font(this.boldFont)
         .fontSize(8)
         .text('Project:', 280, yPos + 60);
      
      doc.font(this.defaultFont)
         .fontSize(8)
         .text((data.projectId.name || 'N/A').substring(0, 30), 280, yPos + 72);
    }

    yPos = boxStartY + boxHeight + 15;

    // Purpose - Compact
    doc.fontSize(8)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Purpose:', 40, yPos);
    
    yPos += 12;

    const purposeText = (data.purpose || 'N/A').substring(0, 200);
    doc.fontSize(8)
       .font(this.defaultFont)
       .fillColor('#333333')
       .text(purposeText, 40, yPos, {
         width: 515,
         align: 'justify',
         lineGap: 2
       });

    const purposeHeight = Math.min(doc.heightOfString(purposeText, { width: 515 }), 40);
    yPos += purposeHeight + 10;

    // Business Justification - Compact
    doc.fontSize(8)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Business Justification:', 40, yPos);
    
    yPos += 12;

    const justificationText = (data.businessJustification || 'N/A').substring(0, 250);
    doc.fontSize(8)
       .font(this.defaultFont)
       .fillColor('#333333')
       .text(justificationText, 40, yPos, {
         width: 515,
         align: 'justify',
         lineGap: 2
       });

    const justificationHeight = Math.min(doc.heightOfString(justificationText, { width: 515 }), 50);
    yPos += justificationHeight + 15;

    return yPos;
  }

  drawDisbursementHistory(doc, yPos, data) {
    yPos += 5;
    
    // Section header
    doc.fontSize(11)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Disbursement History', 40, yPos);
    
    yPos += 20;

    const totalDisbursed = data.totalDisbursed || 0;
    const remainingBalance = data.remainingBalance || 0;
    const amountApproved = data.amountApproved || data.amountRequested;

    const progress = Math.round((totalDisbursed / amountApproved) * 100);

    // Progress summary box
    const boxHeight = 50;
    doc.rect(40, yPos, 515, boxHeight)
       .fillAndStroke('#E6F7FF', '#1890FF');

    yPos += 10;

    // Progress info
    doc.fontSize(8)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Disbursement Progress:', 50, yPos);
    
    doc.text(`${progress}%`, 480, yPos, { width: 65, align: 'right' });

    yPos += 15;

    doc.fontSize(8)
       .font(this.defaultFont)
       .text(`Total Disbursed: XAF ${this.formatCurrency(totalDisbursed)}`, 50, yPos);
    
    if (remainingBalance > 0) {
      doc.text(`Remaining: XAF ${this.formatCurrency(remainingBalance)}`, 300, yPos);
    } else {
      doc.fillColor('#52c41a')
         .text('✓ Fully Disbursed', 300, yPos)
         .fillColor('#000000');
    }

    yPos += 30;

    // Individual disbursements
    if (data.disbursements && data.disbursements.length > 0) {
      doc.fontSize(9)
         .font(this.boldFont)
         .fillColor('#000000')
         .text('Payment History:', 40, yPos);
      
      yPos += 15;

      // Table header
      doc.rect(40, yPos, 515, 18)
         .fillAndStroke('#F5F5F5', '#CCCCCC');

      doc.fontSize(8)
         .font(this.boldFont)
         .fillColor('#000000')
         .text('#', 50, yPos + 5)
         .text('Date', 100, yPos + 5)
         .text('Amount', 250, yPos + 5)
         .text('Notes', 370, yPos + 5);

      yPos += 18;

      // Disbursement rows
      data.disbursements.forEach((disb, index) => {
        // Check if we need a new page
        if (yPos > 720) {
          doc.addPage();
          yPos = 50;
          
          // Redraw section header on new page
          doc.fontSize(11)
             .font(this.boldFont)
             .fillColor('#000000')
             .text('Disbursement History (continued)', 40, yPos);
          yPos += 20;
          
          // Redraw table header
          doc.rect(40, yPos, 515, 18)
             .fillAndStroke('#F5F5F5', '#CCCCCC');

          doc.fontSize(8)
             .font(this.boldFont)
             .fillColor('#000000')
             .text('#', 50, yPos + 5)
             .text('Date', 100, yPos + 5)
             .text('Amount', 250, yPos + 5)
             .text('Notes', 370, yPos + 5);

          yPos += 18;
        }

        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(40, yPos, 515, 20)
             .fillAndStroke('#FAFAFA', '#CCCCCC');
        } else {
          doc.rect(40, yPos, 515, 20)
             .stroke('#CCCCCC');
        }

        doc.fontSize(8)
           .font(this.defaultFont)
           .fillColor('#000000')
           .text(`${disb.disbursementNumber || index + 1}`, 50, yPos + 6)
           .text(this.formatDateExact(disb.date), 100, yPos + 6)
           .text(`XAF ${this.formatCurrency(disb.amount)}`, 250, yPos + 6);

        if (disb.notes) {
          const truncatedNotes = disb.notes.length > 30 
            ? `${disb.notes.substring(0, 30)}...` 
            : disb.notes;
          doc.text(truncatedNotes, 370, yPos + 6);
        }

        yPos += 20;
      });

      yPos += 10;
    }

    return yPos;
  }

  drawApprovalChainTimeline(doc, yPos, data) {
    // Section header
    doc.fontSize(11)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Approval Chain', 40, yPos);
    
    yPos += 20;

    if (!data.approvalChain || data.approvalChain.length === 0) {
      doc.fontSize(9)
         .font(this.defaultFont)
         .fillColor('#999999')
         .text('No approval chain data', 40, yPos);
      return yPos + 20;
    }

    // Draw each approval step - COMPACT VERSION
    data.approvalChain.forEach((step, index) => {
      // Check if we need a new page (leave room for footer)
      if (yPos > 680) {
        doc.addPage();
        yPos = 50;
        
        // Redraw section header on new page
        doc.fontSize(11)
           .font(this.boldFont)
           .fillColor('#000000')
           .text('Approval Chain (continued)', 40, yPos);
        yPos += 20;
      }

      // Draw timeline connector line (if not first)
      if (index > 0) {
        doc.moveTo(55, yPos - 10)
           .lineTo(55, yPos)
           .strokeColor('#CCCCCC')
           .lineWidth(2)
           .stroke();
      }

      // Draw status circle
      const statusColor = step.status === 'approved' ? '#52c41a' : 
                         step.status === 'rejected' ? '#f5222d' : '#d9d9d9';
      
      doc.circle(55, yPos + 6, 5)
         .fillAndStroke(statusColor, statusColor);

      // Step details - COMPACT
      doc.fontSize(8)
         .font(this.boldFont)
         .fillColor('#000000')
         .text(`Level ${step.level}: ${step.approver.name}`, 75, yPos);

      doc.fontSize(7)
         .font(this.defaultFont)
         .fillColor('#666666')
         .text(`${step.approver.role}`, 75, yPos + 10);

      // Status and date - COMPACT
      if (step.status === 'approved') {
        doc.fillColor('#52c41a')
           .fontSize(7)
           .font(this.boldFont)
           .text('✓ APPROVED', 75, yPos + 20);
        
        doc.fillColor('#666666')
           .font(this.defaultFont)
           .fontSize(7)
           .text(`${this.formatDateExact(step.actionDate)} ${step.actionTime || ''}`, 75, yPos + 30);

        if (step.comments) {
          const shortComment = step.comments.substring(0, 80);
          doc.fillColor('#333333')
             .fontSize(7)
             .text(`"${shortComment}${step.comments.length > 80 ? '...' : ''}"`, 75, yPos + 40, {
               width: 450
             });
          yPos += 55;
        } else {
          yPos += 45;
        }
      } else if (step.status === 'rejected') {
        doc.fillColor('#f5222d')
           .fontSize(7)
           .font(this.boldFont)
           .text('✗ REJECTED', 75, yPos + 20);
        
        doc.fillColor('#666666')
           .font(this.defaultFont)
           .fontSize(7)
           .text(`${this.formatDateExact(step.actionDate)} ${step.actionTime || ''}`, 75, yPos + 30);

        if (step.comments) {
          const shortComment = step.comments.substring(0, 80);
          doc.fillColor('#f5222d')
             .fontSize(7)
             .text(`"${shortComment}${step.comments.length > 80 ? '...' : ''}"`, 75, yPos + 40, {
               width: 450
             });
          yPos += 55;
        } else {
          yPos += 45;
        }
      } else {
        doc.fillColor('#999999')
           .fontSize(7)
           .font(this.defaultFont)
           .text('Pending', 75, yPos + 20);
        yPos += 35;
      }
    });

    return yPos + 10;
  }

  drawCashRequestFinancialSummary(doc, yPos, data) {
    yPos += 5;
    
    // Section header
    doc.fontSize(11)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Financial Summary', 40, yPos);
    
    yPos += 20;

    // Show all financial metrics
    const boxHeight = ['partially_disbursed', 'fully_disbursed'].includes(data.status) ? 88 : 70;
    doc.rect(40, yPos, 515, boxHeight)
       .fillAndStroke('#F5F5F5', '#CCCCCC');

    yPos += 12;

    // Amount Requested
    doc.fontSize(8)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Amount Requested:', 50, yPos);
    
    doc.text(`XAF ${this.formatCurrency(data.amountRequested)}`, 380, yPos, {
      width: 165,
      align: 'right'
    });

    yPos += 18;

    // Amount Approved
    doc.text('Amount Approved:', 50, yPos);
    
    doc.fillColor(data.amountApproved ? '#52c41a' : '#000000')
       .text(`XAF ${this.formatCurrency(data.amountApproved || data.amountRequested)}`, 380, yPos, {
         width: 165,
         align: 'right'
       });

    yPos += 18;

    // Total Disbursed (if partial/full disbursement)
    if (['partially_disbursed', 'fully_disbursed'].includes(data.status)) {
      doc.fillColor('#000000')
         .text('Total Disbursed:', 50, yPos);
      
      doc.fillColor('#1890ff')
         .font(this.boldFont)
         .fontSize(9)
         .text(`XAF ${this.formatCurrency(data.totalDisbursed || 0)}`, 380, yPos, {
           width: 165,
           align: 'right'
         });

      yPos += 18;

      // Remaining Balance
      doc.fillColor('#000000')
         .font(this.boldFont)
         .fontSize(8)
         .text('Remaining Balance:', 50, yPos);
      
      const remainingColor = data.remainingBalance > 0 ? '#faad14' : '#52c41a';
      doc.fillColor(remainingColor)
         .font(this.boldFont)
         .fontSize(9)
         .text(`XAF ${this.formatCurrency(data.remainingBalance || 0)}`, 380, yPos, {
           width: 165,
           align: 'right'
         });
    } else {
      // Original: Single disbursement amount
      doc.fillColor('#000000')
         .text('Amount Disbursed:', 50, yPos);
      
      const disbursedAmount = data.disbursementDetails?.amount || data.totalDisbursed || data.amountApproved || data.amountRequested;
      
      doc.fillColor('#1890ff')
         .font(this.boldFont)
         .fontSize(9)
         .text(`XAF ${this.formatCurrency(disbursedAmount)}`, 380, yPos, {
           width: 165,
           align: 'right'
         });
    }

    return yPos + 25;
  }

  drawBudgetAllocation(doc, yPos, data) {
    const budget = data.budgetAllocation;
    
    yPos += 5;
    
    // Section header
    doc.fontSize(11)
       .font(this.boldFont)
       .fillColor('#000000')
       .text('Budget Allocation', 40, yPos);
    
    yPos += 20;

    // Compact budget box
    const boxHeight = 75;
    doc.rect(40, yPos, 515, boxHeight)
       .strokeColor('#CCCCCC')
       .lineWidth(0.5)
       .stroke();

    yPos += 12;

    // Budget Code
    doc.fontSize(8)
       .font(this.boldFont)
       .text('Budget Code:', 50, yPos);
    
    doc.font(this.defaultFont)
       .text(budget.budgetCode || 'N/A', 200, yPos);

    yPos += 15;

    // Budget Name
    if (budget.budgetCodeId?.name) {
      doc.font(this.boldFont)
         .text('Budget Name:', 50, yPos);
      
      doc.font(this.defaultFont)
         .text((budget.budgetCodeId.name || '').substring(0, 50), 200, yPos, { width: 300 });
      
      yPos += 15;
    }

    // Allocated Amount
    doc.font(this.boldFont)
       .text('Allocated Amount:', 50, yPos);
    
    doc.font(this.defaultFont)
       .text(`XAF ${this.formatCurrency(budget.allocatedAmount)}`, 200, yPos);

    yPos += 15;

    // Status
    doc.font(this.boldFont)
       .text('Status:', 50, yPos);
    
    doc.font(this.defaultFont)
       .text(this.formatAllocationStatus(budget.allocationStatus), 200, yPos);

    return yPos + 20;
  }

  drawCashRequestSignatureSection(doc, yPos, data) {
    yPos += 15;
    
    const signatureY = yPos;
    const lineWidth = 120;
    const lineSpacing = 160;
    
    // Three signature lines
    for (let i = 0; i < 3; i++) {
      const xPos = 40 + (i * lineSpacing);
      
      doc.moveTo(xPos, signatureY + 25)
         .lineTo(xPos + lineWidth, signatureY + 25)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
    }
  }

  drawCashRequestFooter(doc, data) {
    // Footer is drawn on the current page
    const footerY = doc.page.height - 70;
    
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

    // Registration
    doc.text('RC/DLA/2014/B/2690 NIU: M061421030521', 40, footerY + 8);
    
    // Generation timestamp
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, footerY + 20);
    
    // Contact
    doc.text('679586444 | info@gratoengineering.com', 40, footerY + 32);
  }

  // ============================================
  // HELPER METHODS
  // ============================================
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

  formatStatus(status) {
    return (status || 'Unknown').replace(/_/g, ' ').toUpperCase();
  }

  formatRequestType(type) {
    return (type || 'N/A').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatUrgency(urgency) {
    const map = {
      'urgent': 'URGENT',
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW'
    };
    return map[urgency] || (urgency || 'N/A').toUpperCase();
  }

  formatAllocationStatus(status) {
    return (status || 'N/A').replace(/_/g, ' ').toUpperCase();
  }
}

module.exports = new PDFService();








// const PDFDocument = require('pdfkit');
// const fs = require('fs');
// const path = require('path');

// class PDFService {
//   constructor() {
//     this.defaultFont = 'Helvetica';
//     this.boldFont = 'Helvetica-Bold';
//     this.logoPath = path.join(__dirname, '../public/images/company-logo.jpg');
//   }

//   // ============================================
//   // PURCHASE ORDER PDF (Existing - No Changes)
//   // ============================================
//   async generatePurchaseOrderPDF(poData, outputPath) {
//     return new Promise((resolve, reject) => {
//       try {
//         console.log('=== STARTING PDF GENERATION ===');
//         console.log('PO Data received:', JSON.stringify(poData, null, 2));

//         const doc = new PDFDocument({ 
//           size: 'A4', 
//           margins: { top: 50, bottom: 50, left: 40, right: 40 },
//           info: {
//             Title: `Purchase Order - ${poData.poNumber}`,
//             Author: 'GRATO ENGINEERING GLOBAL LTD',
//             Subject: 'Purchase Order',
//             Creator: 'Purchase Order System'
//           }
//         });

//         if (outputPath) {
//           doc.pipe(fs.createWriteStream(outputPath));
//         }

//         const chunks = [];
//         doc.on('data', chunk => chunks.push(chunk));
//         doc.on('end', () => {
//           const pdfBuffer = Buffer.concat(chunks);
//           console.log('=== PDF GENERATION COMPLETED ===');
//           resolve({
//             success: true,
//             buffer: pdfBuffer,
//             filename: `PO_${poData.poNumber}_${Date.now()}.pdf`
//           });
//         });

//         this.generateExactPOContent(doc, poData);
//         doc.end();
//       } catch (error) {
//         console.error('PDF generation error:', error);
//         reject({
//           success: false,
//           error: error.message
//         });
//       }
//     });
//   }

//   generateExactPOContent(doc, poData) {
//     let yPos = 50;

//     // Header with logo and company info
//     this.drawHeader(doc, yPos, poData);
//     yPos += 90;

//     // Two-column section: Shipping address (left) and Supplier (right)
//     this.drawAddressSection(doc, yPos, poData);
//     yPos += 90; 

//     // Purchase Order Title Bar
//     this.drawPOTitleBar(doc, yPos, poData);
//     yPos += 50;

//     // Items Table
//     const tableHeight = this.drawItemsTable(doc, yPos, poData);
//     yPos += tableHeight + 15;

//     // Payment Terms
//     this.drawPaymentTerms(doc, yPos, poData);
//     yPos += 40;

//     // Signature Section at the end
//     this.drawSignatureSection(doc, yPos, poData);

//     // Footer
//     this.drawFooter(doc, poData);
//   }

//   drawHeader(doc, yPos, poData) {
//     // Company Logo (left side)
//     try {
//       if (fs.existsSync(this.logoPath)) {
//         doc.image(this.logoPath, 40, yPos, { width: 60, height: 56 });
//       } else {
//         // Placeholder logo - red box with text
//         doc.rect(40, yPos, 60, 60)
//            .strokeColor('#E63946')
//            .lineWidth(2)
//            .stroke();
        
//         doc.fontSize(8)
//            .fillColor('#E63946')
//            .font(this.boldFont)
//            .text('GRATO', 48, yPos + 20)
//            .text('ENGINEERING', 43, yPos + 32)
//            .fillColor('#000000');
//       }
//     } catch (error) {
//       console.log('Logo loading error:', error.message);
//       // Draw placeholder
//       doc.rect(40, yPos, 60, 60)
//          .strokeColor('#E63946')
//          .lineWidth(2)
//          .stroke();
      
//       doc.fontSize(8)
//          .fillColor('#E63946')
//          .font(this.boldFont)
//          .text('GRATO', 48, yPos + 20)
//          .text('ENGINEERING', 43, yPos + 32)
//          .fillColor('#000000');
//     }

//     // Company name and address (left, under logo)
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('GRATO ENGINEERING GLOBAL LTD', 110, yPos);

//     doc.fontSize(9)
//        .font(this.defaultFont)
//        .text('Bonaberi', 110, yPos + 15)
//        .text('Douala Cameroon', 110, yPos + 28);
//   }

//   drawAddressSection(doc, yPos, poData) {
//     // Left column: Shipping address
//     doc.fontSize(9)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Shipping address', 40, yPos);

//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text('GRATO ENGINEERING GLOBAL LTD', 40, yPos + 15)
//        .text('Bonaberi', 40, yPos + 28)
//        .text('Douala', 40, yPos + 41)
//        .text('Cameroon', 40, yPos + 54);

//     doc.text('682952153', 40, yPos + 67);

//     // Right column: Supplier information (dynamic based on PO data)
//     const supplier = poData.supplierDetails || {};
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(this.safeString(supplier.name, 'Supplier Name Not Available'), 320, yPos)
//        .text(this.safeString(supplier.address, 'Address Not Available'), 320, yPos + 13)
//        .text(this.safeString(supplier.email, 'Email Not Available'), 320, yPos + 26);

//     if (supplier.phone) {
//       doc.text(`${supplier.phone}`, 320, yPos + 39);
//     }
    
//     if (supplier.taxId || supplier.registrationNumber) {
//       doc.fontSize(8)
//          .text(`VAT: ${supplier.taxId || supplier.registrationNumber || 'N/A'}`, 320, yPos + 52);
//     }
//   }

//   drawPOTitleBar(doc, yPos, poData) {
//     // Purchase Order title - just colored text, no background bar
//     doc.fillColor('#C5504B') 
//        .fontSize(14)
//        .font(this.boldFont)
//        .text(`Purchase Order #${this.safeString(poData.poNumber, 'P00004')}`, 40, yPos);

//     // Three-column info below title
//     const detailsY = yPos + 25; // Reduced spacing
    
//     // Buyer column
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .font(this.defaultFont)
//        .text('Buyer:', 40, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .font(this.defaultFont)
//        .text('GRATO ENGINEERING', 40, detailsY + 12);

//     // Order Date column  
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('Order Date:', 220, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(poData.creationDate), 220, detailsY + 12);

//     // Expected Arrival column
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('Expected Arrival:', 400, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(poData.expectedDeliveryDate), 400, detailsY + 12);
//   }

//   drawItemsTable(doc, yPos, poData) {
//     console.log('=== DRAWING ITEMS TABLE ===');
//     console.log('Items data:', poData.items);
    
//     const tableWidth = 515;
//     const colX = {
//       desc: 40,
//       qty: 280,
//       unitPrice: 325,
//       disc: 400,
//       taxes: 445,
//       amount: 490
//     };
    
//     let currentY = yPos;

//     // Table header with gray background
//     doc.fillColor('#F5F5F5')
//        .rect(40, currentY, tableWidth, 20)
//        .fill();

//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .rect(40, currentY, tableWidth, 20)
//        .stroke();

//     doc.fillColor('#000000')
//        .fontSize(9)
//        .font(this.boldFont);

//     // Column headers
//     doc.text('Description', colX.desc + 5, currentY + 6);
//     doc.text('Qty', colX.qty, currentY + 6);
//     doc.text('Unit Price', colX.unitPrice, currentY + 6);
//     doc.text('Disc.', colX.disc, currentY + 6);
//     doc.text('Taxes', colX.taxes, currentY + 6);
//     doc.text('Amount', colX.amount, currentY + 6);

//     // Vertical lines for header
//     [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
//       doc.moveTo(x, currentY).lineTo(x, currentY + 20).stroke();
//     });

//     currentY += 20;

//     // Determine tax rate
//     let taxRate = 0;
//     if (poData.taxApplicable) {
//       taxRate = 0.1925; // 19.25%
//       console.log('Tax is applicable, using 19.25%');
//     }
    
//     let grandTotal = 0;

//     // Table rows
//     const items = Array.isArray(poData.items) ? poData.items : [];
//     console.log(`Processing ${items.length} items`);

//     items.forEach((item, index) => {
//       console.log(`=== Processing item ${index} ===`, item);
      
//       const quantity = this.safeNumber(item.quantity, 0);
//       const unitPrice = this.safeNumber(item.unitPrice, 0);
//       const discount = this.safeNumber(item.discount, 0);
      
//       // Calculate amounts
//       const itemSubtotal = quantity * unitPrice;
//       const discountAmount = itemSubtotal * (discount / 100);
//       const afterDiscount = itemSubtotal - discountAmount;
//       const taxAmount = afterDiscount * taxRate;
//       const itemTotal = afterDiscount + taxAmount;
      
//       console.log('Calculated:', { itemSubtotal, discountAmount, afterDiscount, taxAmount, itemTotal });
      
//       grandTotal += itemTotal;
      
//       // Get full description
//       const description = this.safeString(item.description, 'No description');
      
//       // Calculate dynamic row height based on description length
//       const descWidth = 230; // Width available for description column
//       doc.fontSize(8).font(this.defaultFont);
//       const descHeight = doc.heightOfString(description, { width: descWidth, lineGap: 1 });
//       const rowHeight = Math.max(25, descHeight + 12); // Minimum 25px, or description height + padding
      
//       // Row border
//       doc.strokeColor('#CCCCCC')
//          .rect(40, currentY, tableWidth, rowHeight)
//          .stroke();

//       doc.fillColor('#000000')
//          .fontSize(8)
//          .font(this.defaultFont);

//       // Description - full text with word wrap
//       doc.text(description, colX.desc + 5, currentY + 6, {
//         width: descWidth,
//         align: 'left',
//         lineGap: 1
//       });
      
//       // Other columns - vertically centered
//       const textY = currentY + (rowHeight / 2) - 4;
      
//       doc.text(quantity.toFixed(2), colX.qty, textY);
//       doc.text(this.formatCurrency(unitPrice), colX.unitPrice, textY);
//       doc.text(discount > 0 ? `${discount.toFixed(2)}%` : '0.00%', colX.disc, textY);
//       doc.text(taxRate > 0 ? '19.25% G' : '0%', colX.taxes, textY);
//       doc.text(`${this.formatCurrency(itemTotal)} FCFA`, colX.amount, textY);

//       // Vertical lines for row
//       [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
//         doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
//       });

//       currentY += rowHeight;
//     });

//     // If no items
//     if (items.length === 0) {
//       doc.fillColor('#F9F9F9')
//          .rect(40, currentY, tableWidth, 22)
//          .fill();

//       doc.strokeColor('#CCCCCC')
//          .rect(40, currentY, tableWidth, 22)
//          .stroke();

//       doc.fillColor('#666666')
//          .text('No items found', colX.desc + 5, currentY + 6);
      
//       currentY += 22;
//     }

//     // Draw summary box
//     this.drawOrderSummary(doc, currentY, grandTotal, taxRate);

//     return currentY - yPos + 90;
//   }

//   drawOrderSummary(doc, yPos, grandTotal, taxRate) {
//     console.log('=== DRAWING ORDER SUMMARY ===');
//     console.log('Grand Total:', grandTotal, 'Tax Rate:', taxRate);
    
//     const summaryX = 380;
//     const summaryWidth = 175;
//     const labelX = summaryX + 10;
    
//     yPos += 10;

//     // Calculate breakdown
//     let untaxedAmount = grandTotal;
//     let vatAmount = 0;
    
//     if (taxRate > 0) {
//       untaxedAmount = grandTotal / (1 + taxRate);
//       vatAmount = grandTotal - untaxedAmount;
//     }

//     // Summary box border
//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .rect(summaryX, yPos, summaryWidth, 68)
//        .stroke();

//     doc.fontSize(9)
//        .font(this.defaultFont)
//        .fillColor('#000000');

//     // Untaxed Amount
//     doc.text('Untaxed Amount', labelX, yPos + 10);
//     doc.text(`${this.formatCurrency(untaxedAmount)} FCFA`, labelX, yPos + 10, {
//       width: summaryWidth - 20,
//       align: 'right'
//     });

//     // VAT line
//     doc.text('VAT 19.25%', labelX, yPos + 28);
//     doc.text(`${this.formatCurrency(vatAmount)} FCFA`, labelX, yPos + 28, {
//       width: summaryWidth - 20,
//       align: 'right'
//     });

//     // Total row with gray background
//     doc.fillColor('#E8E8E8')
//        .rect(summaryX, yPos + 46, summaryWidth, 22)
//        .fill();

//     doc.strokeColor('#CCCCCC')
//        .rect(summaryX, yPos + 46, summaryWidth, 22)
//        .stroke();

//     doc.fillColor('#000000')
//        .font(this.boldFont)
//        .text('Total', labelX, yPos + 53);
    
//     doc.text(`${this.formatCurrency(grandTotal)} FCFA`, labelX, yPos + 53, {
//       width: summaryWidth - 20,
//       align: 'right'
//     });
//   }

//   drawSignatureSection(doc, yPos, poData) {
//     yPos += 20;
    
//     const signatureY = yPos + 20;
//     const lineWidth = 120;
//     const lineSpacing = 160;
    
//     // Three signature lines
//     for (let i = 0; i < 3; i++) {
//       const xPos = 40 + (i * lineSpacing);
      
//       doc.moveTo(xPos, signatureY + 30)
//          .lineTo(xPos + lineWidth, signatureY + 30)
//          .strokeColor('#000000')
//          .lineWidth(0.5)
//          .stroke();
//     }
//   }

//   drawPaymentTerms(doc, yPos, poData) {
//     doc.fontSize(9)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Payment Terms:', 40, yPos);

//     doc.font(this.defaultFont)
//        .fontSize(8)
//        .text(this.safeString(poData.paymentTerms, 'Net 30 days'), 40, yPos + 15);

//     if (poData.specialInstructions) {
//       doc.font(this.boldFont)
//          .fontSize(9)
//          .text('Special Instructions:', 40, yPos + 35);

//       doc.font(this.defaultFont)
//          .fontSize(8)
//          .text(this.safeString(poData.specialInstructions, ''), 40, yPos + 50, {
//            width: 500
//          });
//     }
//   }

//   drawFooter(doc, poData) {
//     const footerY = doc.page.height - 80;
    
//     // Horizontal line
//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .moveTo(40, footerY)
//        .lineTo(555, footerY)
//        .stroke();

//     // Footer content
//     doc.fontSize(7)
//        .font(this.defaultFont)
//        .fillColor('#666666');

//     // Registration and page number
//     doc.text('RC/DLA/2014/B/2690 NIU: M061421030521 Access Bank Cameroon PLC 10041000010010130003616', 40, footerY + 8);
//     doc.text('Page 1 / 1', 520, footerY + 8);

//     // Contact information
//     doc.text('679586444 info@gratoengineering.com www.gratoengineering.com', 40, footerY + 20);
//     doc.text('Location: Bonaberi-Douala, beside Santa', 40, footerY + 32);
//     doc.text('Lucia Telecommunications, Civil, Electrical and Mechanical Engineering Services.', 40, footerY + 44);
//   }

//   // ============================================
//   // PETTY CASH FORM PDF (Uses Cash Request Format)
//   // ============================================
//   async generatePettyCashFormPDF(formData, outputPath) {
//     return new Promise((resolve, reject) => {
//       try {
//         console.log('=== STARTING PETTY CASH FORM PDF GENERATION ===');
//         console.log('Form Number:', formData.displayId);
//         console.log('Requisition:', formData.requisitionNumber);

//         const doc = new PDFDocument({ 
//           size: 'A4', 
//           margins: { top: 50, bottom: 80, left: 40, right: 40 },
//           info: {
//             Title: `Petty Cash Form - ${formData.displayId}`,
//             Author: 'GRATO ENGINEERING GLOBAL LTD',
//             Subject: 'Petty Cash Form',
//             Creator: 'Purchase Requisition System'
//           }
//         });

//         if (outputPath) {
//           doc.pipe(fs.createWriteStream(outputPath));
//         }

//         const chunks = [];
//         doc.on('data', chunk => chunks.push(chunk));
//         doc.on('end', () => {
//           const pdfBuffer = Buffer.concat(chunks);
//           console.log('=== PETTY CASH FORM PDF GENERATION COMPLETED ===');
//           resolve({
//             success: true,
//             buffer: pdfBuffer,
//             filename: `Petty_Cash_Form_${formData.displayId}_${Date.now()}.pdf`
//           });
//         });

//         this.generateCashRequestContent(doc, formData);
//         doc.end();
//       } catch (error) {
//         console.error('Petty Cash Form PDF generation error:', error);
//         reject({
//           success: false,
//           error: error.message
//         });
//       }
//     });
//   }

//   // ============================================
//   // CASH REQUEST PDF (Employee Format)
//   // ============================================
//   async generateCashRequestPDF(requestData, outputPath) {
//     return new Promise((resolve, reject) => {
//       try {
//         console.log('=== STARTING CASH REQUEST PDF GENERATION ===');
//         console.log('Request ID:', requestData._id);
//         console.log('Employee:', requestData.employee?.fullName);

//         const doc = new PDFDocument({ 
//           size: 'A4', 
//           margins: { top: 50, bottom: 80, left: 40, right: 40 },
//           info: {
//             Title: `Cash Request - ${requestData.displayId || requestData._id}`,
//             Author: 'GRATO ENGINEERING GLOBAL LTD',
//             Subject: 'Cash Request Document',
//             Creator: 'Cash Request System'
//           }
//         });

//         if (outputPath) {
//           doc.pipe(fs.createWriteStream(outputPath));
//         }

//         const chunks = [];
//         doc.on('data', chunk => chunks.push(chunk));
//         doc.on('end', () => {
//           const pdfBuffer = Buffer.concat(chunks);
//           console.log('=== CASH REQUEST PDF GENERATION COMPLETED ===');
//           resolve({
//             success: true,
//             buffer: pdfBuffer,
//             filename: `Cash_Request_${requestData.displayId || requestData._id.toString().slice(-6).toUpperCase()}_${Date.now()}.pdf`
//           });
//         });

//         this.generateCashRequestContent(doc, requestData);
//         doc.end();
//       } catch (error) {
//         console.error('Cash Request PDF generation error:', error);
//         reject({
//           success: false,
//           error: error.message
//         });
//       }
//     });
//   }

//   generateCashRequestContent(doc, data) {
//     let yPos = 50;

//     // Header with logo and company info
//     this.drawCashRequestHeader(doc, yPos, data);
//     yPos += 90;

//     // Request title bar
//     this.drawCashRequestTitleBar(doc, yPos, data);
//     yPos += 60;

//     // Employee and Request Details
//     yPos = this.drawCashRequestDetails(doc, yPos, data);

//     // Check page break before approval chain
//     if (yPos > 600) {
//       doc.addPage();
//       yPos = 50;
//     }

//     // ✅ NEW: Disbursement History (if exists)
//     if (data.disbursements && data.disbursements.length > 0) {
//       yPos = this.drawDisbursementHistory(doc, yPos, data);
      
//       // Check page break after disbursement
//       if (yPos > 650) {
//         doc.addPage();
//         yPos = 50;
//       }
//     }

//     // Approval Chain Timeline
//     yPos = this.drawApprovalChainTimeline(doc, yPos, data);

//     // Check page break before financial summary
//     if (yPos > 650) {
//       doc.addPage();
//       yPos = 50;
//     }

//     // Financial Summary
//     yPos = this.drawCashRequestFinancialSummary(doc, yPos, data);

//     // Budget Allocation (if exists)
//     if (data.budgetAllocation && data.budgetAllocation.budgetCodeId) {
//       if (yPos > 650) {
//         doc.addPage();
//         yPos = 50;
//       }
//       yPos = this.drawBudgetAllocation(doc, yPos, data);
//     }

//     // Check page break before signatures
//     if (yPos > 680) {
//       doc.addPage();
//       yPos = 50;
//     }

//     // Signature Section
//     this.drawCashRequestSignatureSection(doc, yPos, data);

//     // Footer
//     this.drawCashRequestFooter(doc, data);
//   }

//   drawCashRequestHeader(doc, yPos, data) {
//     // Company Logo
//     try {
//       if (fs.existsSync(this.logoPath)) {
//         doc.image(this.logoPath, 40, yPos, { width: 60, height: 56 });
//       } else {
//         doc.rect(40, yPos, 60, 60)
//            .strokeColor('#E63946')
//            .lineWidth(2)
//            .stroke();
        
//         doc.fontSize(8)
//            .fillColor('#E63946')
//            .font(this.boldFont)
//            .text('GRATO', 48, yPos + 20)
//            .text('ENGINEERING', 43, yPos + 32)
//            .fillColor('#000000');
//       }
//     } catch (error) {
//       console.log('Logo loading error:', error.message);
//       doc.rect(40, yPos, 60, 60)
//          .strokeColor('#E63946')
//          .lineWidth(2)
//          .stroke();
//     }

//     // Company name and address
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('GRATO ENGINEERING GLOBAL LTD', 110, yPos);

//     doc.fontSize(9)
//        .font(this.defaultFont)
//        .text('Bonaberi', 110, yPos + 15)
//        .text('Douala Cameroon', 110, yPos + 28)
//        .text('682952153', 110, yPos + 41);
//   }

//   drawCashRequestTitleBar(doc, yPos, data) {
//     // Title
//     doc.fillColor('#C5504B') 
//        .fontSize(14)
//        .font(this.boldFont)
//        .text(`CASH REQUEST #${data.displayId || data._id.toString().slice(-6).toUpperCase()}`, 40, yPos);

//     const detailsY = yPos + 25;
    
//     // Three columns
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .font(this.defaultFont)
//        .text('Status:', 40, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .font(this.boldFont)
//        .text(this.formatStatus(data.status), 40, detailsY + 12);

//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('Request Date:', 220, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(data.createdAt), 220, detailsY + 12);

//     // ✅ FIXED: Show first disbursement date instead of single disbursement
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('First Disbursement:', 400, detailsY);
    
//     const firstDisbursementDate = data.disbursements && data.disbursements.length > 0
//       ? data.disbursements[0].date
//       : data.disbursementDetails?.date;
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(firstDisbursementDate), 400, detailsY + 12);
//   }

//   drawCashRequestDetails(doc, yPos, data) {
//     yPos += 10;
    
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Request Details', 40, yPos);
    
//     yPos += 20;

//     // Compact details box
//     const boxStartY = yPos;
//     const boxHeight = 100;
    
//     doc.rect(40, yPos, 515, boxHeight)
//        .strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .stroke();

//     yPos += 10;

//     // Left Column - Employee Info
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Requested By:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(data.employee?.fullName || 'N/A', 50, yPos + 12);
    
//     doc.fontSize(8)
//        .fillColor('#666666')
//        .text(`${data.employee?.department || 'N/A'}`, 50, yPos + 25);

//     // Right Column - Request Info
//     doc.fillColor('#000000')
//        .fontSize(8)
//        .font(this.boldFont)
//        .text('Request Type:', 280, yPos);
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(this.formatRequestType(data.requestType), 280, yPos + 12);

//     doc.font(this.boldFont)
//        .fontSize(8)
//        .text('Urgency:', 280, yPos + 30);
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(this.formatUrgency(data.urgency), 280, yPos + 42);

//     if (data.projectId) {
//       doc.font(this.boldFont)
//          .fontSize(8)
//          .text('Project:', 280, yPos + 60);
      
//       doc.font(this.defaultFont)
//          .fontSize(8)
//          .text((data.projectId.name || 'N/A').substring(0, 30), 280, yPos + 72);
//     }

//     yPos = boxStartY + boxHeight + 15;

//     // Purpose - Compact
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Purpose:', 40, yPos);
    
//     yPos += 12;

//     const purposeText = (data.purpose || 'N/A').substring(0, 200);
//     doc.fontSize(8)
//        .font(this.defaultFont)
//        .fillColor('#333333')
//        .text(purposeText, 40, yPos, {
//          width: 515,
//          align: 'justify',
//          lineGap: 2
//        });

//     const purposeHeight = Math.min(doc.heightOfString(purposeText, { width: 515 }), 40);
//     yPos += purposeHeight + 10;

//     // Business Justification - Compact
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Business Justification:', 40, yPos);
    
//     yPos += 12;

//     const justificationText = (data.businessJustification || 'N/A').substring(0, 250);
//     doc.fontSize(8)
//        .font(this.defaultFont)
//        .fillColor('#333333')
//        .text(justificationText, 40, yPos, {
//          width: 515,
//          align: 'justify',
//          lineGap: 2
//        });

//     const justificationHeight = Math.min(doc.heightOfString(justificationText, { width: 515 }), 50);
//     yPos += justificationHeight + 15;

//     return yPos;
//   }

//   // ✅ NEW: Draw Disbursement History
//   drawDisbursementHistory(doc, yPos, data) {
//     yPos += 5;
    
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Disbursement History', 40, yPos);
    
//     yPos += 20;

//     const totalDisbursed = data.totalDisbursed || 0;
//     const remainingBalance = data.remainingBalance || 0;
//     const amountApproved = data.amountApproved || data.amountRequested;

//     const progress = Math.round((totalDisbursed / amountApproved) * 100);

//     // Progress summary box
//     const boxHeight = 50;
//     doc.rect(40, yPos, 515, boxHeight)
//        .fillAndStroke('#E6F7FF', '#1890FF');

//     yPos += 10;

//     // Progress info
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Disbursement Progress:', 50, yPos);
    
//     doc.text(`${progress}%`, 480, yPos, { width: 65, align: 'right' });

//     yPos += 15;

//     doc.fontSize(8)
//        .font(this.defaultFont)
//        .text(`Total Disbursed: XAF ${this.formatCurrency(totalDisbursed)}`, 50, yPos);
    
//     if (remainingBalance > 0) {
//       doc.text(`Remaining: XAF ${this.formatCurrency(remainingBalance)}`, 300, yPos);
//     } else {
//       doc.fillColor('#52c41a')
//          .text('✓ Fully Disbursed', 300, yPos)
//          .fillColor('#000000');
//     }

//     yPos += 30;

//     // Individual disbursements
//     if (data.disbursements && data.disbursements.length > 0) {
//       doc.fontSize(9)
//          .font(this.boldFont)
//          .fillColor('#000000')
//          .text('Payment History:', 40, yPos);
      
//       yPos += 15;

//       // Table header
//       doc.rect(40, yPos, 515, 18)
//          .fillAndStroke('#F5F5F5', '#CCCCCC');

//       doc.fontSize(8)
//          .font(this.boldFont)
//          .fillColor('#000000')
//          .text('#', 50, yPos + 5)
//          .text('Date', 100, yPos + 5)
//          .text('Amount', 250, yPos + 5)
//          .text('Notes', 370, yPos + 5);

//       yPos += 18;

//       // Disbursement rows
//       data.disbursements.forEach((disb, index) => {
//         // Alternate row colors
//         if (index % 2 === 0) {
//           doc.rect(40, yPos, 515, 20)
//              .fillAndStroke('#FAFAFA', '#CCCCCC');
//         } else {
//           doc.rect(40, yPos, 515, 20)
//              .stroke('#CCCCCC');
//         }

//         doc.fontSize(8)
//            .font(this.defaultFont)
//            .fillColor('#000000')
//            .text(`${disb.disbursementNumber || index + 1}`, 50, yPos + 6)
//            .text(this.formatDateExact(disb.date), 100, yPos + 6)
//            .text(`XAF ${this.formatCurrency(disb.amount)}`, 250, yPos + 6);

//         if (disb.notes) {
//           const truncatedNotes = disb.notes.length > 30 
//             ? `${disb.notes.substring(0, 30)}...` 
//             : disb.notes;
//           doc.text(truncatedNotes, 370, yPos + 6);
//         }

//         yPos += 20;
//       });

//       yPos += 10;
//     }

//     return yPos;
//   }

//   drawApprovalChainTimeline(doc, yPos, data) {
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Approval Chain', 40, yPos);
    
//     yPos += 20;

//     if (!data.approvalChain || data.approvalChain.length === 0) {
//       doc.fontSize(9)
//          .font(this.defaultFont)
//          .fillColor('#999999')
//          .text('No approval chain data', 40, yPos);
//       return yPos + 20;
//     }

//     // Draw each approval step - COMPACT VERSION
//     data.approvalChain.forEach((step, index) => {
//       // Check if we need a new page (leave room for footer)
//       if (yPos > 680) {
//         doc.addPage();
//         yPos = 50;
        
//         // Redraw section header on new page
//         doc.fontSize(11)
//            .font(this.boldFont)
//            .fillColor('#000000')
//            .text('Approval Chain (continued)', 40, yPos);
//         yPos += 20;
//       }

//       // Draw timeline connector line (if not first)
//       if (index > 0) {
//         doc.moveTo(55, yPos - 10)
//            .lineTo(55, yPos)
//            .strokeColor('#CCCCCC')
//            .lineWidth(2)
//            .stroke();
//       }

//       // Draw status circle
//       const statusColor = step.status === 'approved' ? '#52c41a' : 
//                          step.status === 'rejected' ? '#f5222d' : '#d9d9d9';
      
//       doc.circle(55, yPos + 6, 5)
//          .fillAndStroke(statusColor, statusColor);

//       // Step details - COMPACT
//       doc.fontSize(8)
//          .font(this.boldFont)
//          .fillColor('#000000')
//          .text(`Level ${step.level}: ${step.approver.name}`, 75, yPos);

//       doc.fontSize(7)
//          .font(this.defaultFont)
//          .fillColor('#666666')
//          .text(`${step.approver.role}`, 75, yPos + 10);

//       // Status and date - COMPACT
//       if (step.status === 'approved') {
//         doc.fillColor('#52c41a')
//            .fontSize(7)
//            .font(this.boldFont)
//            .text('✓ APPROVED', 75, yPos + 20);
        
//         doc.fillColor('#666666')
//            .font(this.defaultFont)
//            .fontSize(7)
//            .text(`${this.formatDateExact(step.actionDate)} ${step.actionTime || ''}`, 75, yPos + 30);

//         if (step.comments) {
//           const shortComment = step.comments.substring(0, 80);
//           doc.fillColor('#333333')
//              .fontSize(7)
//              .text(`"${shortComment}${step.comments.length > 80 ? '...' : ''}"`, 75, yPos + 40, {
//                width: 450
//              });
//           yPos += 55;
//         } else {
//           yPos += 45;
//         }
//       } else if (step.status === 'rejected') {
//         doc.fillColor('#f5222d')
//            .fontSize(7)
//            .font(this.boldFont)
//            .text('✗ REJECTED', 75, yPos + 20);
        
//         doc.fillColor('#666666')
//            .font(this.defaultFont)
//            .fontSize(7)
//            .text(`${this.formatDateExact(step.actionDate)} ${step.actionTime || ''}`, 75, yPos + 30);

//         if (step.comments) {
//           const shortComment = step.comments.substring(0, 80);
//           doc.fillColor('#f5222d')
//              .fontSize(7)
//              .text(`"${shortComment}${step.comments.length > 80 ? '...' : ''}"`, 75, yPos + 40, {
//                width: 450
//              });
//           yPos += 55;
//         } else {
//           yPos += 45;
//         }
//       } else {
//         doc.fillColor('#999999')
//            .fontSize(7)
//            .font(this.defaultFont)
//            .text('Pending', 75, yPos + 20);
//         yPos += 35;
//       }
//     });

//     return yPos + 10;
//   }

//   drawCashRequestFinancialSummary(doc, yPos, data) {
//     yPos += 5;
    
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Financial Summary', 40, yPos);
    
//     yPos += 20;

//     // ✅ UPDATED: Show all financial metrics
//     const boxHeight = ['partially_disbursed', 'fully_disbursed'].includes(data.status) ? 88 : 70;
//     doc.rect(40, yPos, 515, boxHeight)
//        .fillAndStroke('#F5F5F5', '#CCCCCC');

//     yPos += 12;

//     // Amount Requested
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Amount Requested:', 50, yPos);
    
//     doc.text(`XAF ${this.formatCurrency(data.amountRequested)}`, 380, yPos, {
//       width: 165,
//       align: 'right'
//     });

//     yPos += 18;

//     // Amount Approved
//     doc.text('Amount Approved:', 50, yPos);
    
//     doc.fillColor(data.amountApproved ? '#52c41a' : '#000000')
//        .text(`XAF ${this.formatCurrency(data.amountApproved || data.amountRequested)}`, 380, yPos, {
//          width: 165,
//          align: 'right'
//        });

//     yPos += 18;

//     // ✅ NEW: Total Disbursed (if partial/full disbursement)
//     if (['partially_disbursed', 'fully_disbursed'].includes(data.status)) {
//       doc.fillColor('#000000')
//          .text('Total Disbursed:', 50, yPos);
      
//       doc.fillColor('#1890ff')
//          .font(this.boldFont)
//          .fontSize(9)
//          .text(`XAF ${this.formatCurrency(data.totalDisbursed || 0)}`, 380, yPos, {
//            width: 165,
//            align: 'right'
//          });

//       yPos += 18;

//       // ✅ NEW: Remaining Balance
//       doc.fillColor('#000000')
//          .font(this.boldFont)
//          .fontSize(8)
//          .text('Remaining Balance:', 50, yPos);
      
//       const remainingColor = data.remainingBalance > 0 ? '#faad14' : '#52c41a';
//       doc.fillColor(remainingColor)
//          .font(this.boldFont)
//          .fontSize(9)
//          .text(`XAF ${this.formatCurrency(data.remainingBalance || 0)}`, 380, yPos, {
//            width: 165,
//            align: 'right'
//          });
//     } else {
//       // Original: Single disbursement amount
//       doc.fillColor('#000000')
//          .text('Amount Disbursed:', 50, yPos);
      
//       const disbursedAmount = data.disbursementDetails?.amount || data.totalDisbursed || data.amountApproved || data.amountRequested;
      
//       doc.fillColor('#1890ff')
//          .font(this.boldFont)
//          .fontSize(9)
//          .text(`XAF ${this.formatCurrency(disbursedAmount)}`, 380, yPos, {
//            width: 165,
//            align: 'right'
//          });
//     }

//     return yPos + 25;
//   }

//   drawBudgetAllocation(doc, yPos, data) {
//     const budget = data.budgetAllocation;
    
//     yPos += 5;
    
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Budget Allocation', 40, yPos);
    
//     yPos += 20;

//     // Compact budget box
//     const boxHeight = 75;
//     doc.rect(40, yPos, 515, boxHeight)
//        .strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .stroke();

//     yPos += 12;

//     // Budget Code
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .text('Budget Code:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .text(budget.budgetCode || 'N/A', 200, yPos);

//     yPos += 15;

//     // Budget Name
//     if (budget.budgetCodeId?.name) {
//       doc.font(this.boldFont)
//          .text('Budget Name:', 50, yPos);
      
//       doc.font(this.defaultFont)
//          .text((budget.budgetCodeId.name || '').substring(0, 50), 200, yPos, { width: 300 });
      
//       yPos += 15;
//     }

//     // Allocated Amount
//     doc.font(this.boldFont)
//        .text('Allocated Amount:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .text(`XAF ${this.formatCurrency(budget.allocatedAmount)}`, 200, yPos);

//     yPos += 15;

//     // Status
//     doc.font(this.boldFont)
//        .text('Status:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .text(this.formatAllocationStatus(budget.allocationStatus), 200, yPos);

//     return yPos + 20;
//   }

//   drawCashRequestSignatureSection(doc, yPos, data) {
//     yPos += 15;
    
//     const signatureY = yPos;
//     const lineWidth = 120;
//     const lineSpacing = 160;
    
//     // Three signature lines
//     for (let i = 0; i < 3; i++) {
//       const xPos = 40 + (i * lineSpacing);
      
//       doc.moveTo(xPos, signatureY + 25)
//          .lineTo(xPos + lineWidth, signatureY + 25)
//          .strokeColor('#000000')
//          .lineWidth(0.5)
//          .stroke();
//     }
//   }

//   drawCashRequestFooter(doc, data) {
//     // Get current page number and total pages
//     const range = doc.bufferedPageRange();
//     const currentPage = range.start + range.count;
    
//     // Only draw footer on the LAST page
//     const footerY = doc.page.height - 70;
    
//     // Horizontal line
//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .moveTo(40, footerY)
//        .lineTo(555, footerY)
//        .stroke();

//     // Footer content
//     doc.fontSize(7)
//        .font(this.defaultFont)
//        .fillColor('#666666');

//     // Registration
//     doc.text('RC/DLA/2014/B/2690 NIU: M061421030521', 40, footerY + 8);
    
//     // Generation timestamp
//     doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, footerY + 20);
    
//     // Page number
//     doc.text(`Page ${currentPage}`, 510, footerY + 8);

//     // Contact
//     doc.text('679586444 | info@gratoengineering.com', 40, footerY + 32);
//   }

//   // ============================================
//   // HELPER METHODS
//   // ============================================
//   safeNumber(value, defaultValue = 0) {
//     if (value === null || value === undefined || value === '') {
//       return defaultValue;
//     }
//     const num = Number(value);
//     return isNaN(num) ? defaultValue : num;
//   }

//   safeString(value, defaultValue = '') {
//     if (value === null || value === undefined) {
//       return defaultValue;
//     }
//     const str = String(value);
//     if (str.includes('NaN') || str === 'NaN') {
//       return defaultValue || '0';
//     }
//     return str;
//   }

//   formatDateExact(date) {
//     if (!date) return '';
//     try {
//       const d = new Date(date);
//       if (isNaN(d.getTime())) return '';
      
//       const day = String(d.getDate()).padStart(2, '0');
//       const month = String(d.getMonth() + 1).padStart(2, '0');
//       const year = d.getFullYear();
      
//       return `${month}/${day}/${year}`;
//     } catch (error) {
//       console.error('Date formatting error:', error);
//       return '';
//     }
//   }

//   formatCurrency(number) {
//     const safeNum = this.safeNumber(number, 0);
//     if (isNaN(safeNum)) return '0.00';
    
//     try {
//       return safeNum.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
//     } catch (error) {
//       console.error('Number formatting error:', error);
//       return '0.00';
//     }
//   }

//   truncateText(text, maxLength) {
//     const safeText = this.safeString(text, '');
//     if (safeText.length <= maxLength) return safeText;
//     return safeText.substring(0, maxLength - 3) + '...';
//   }

//   formatStatus(status) {
//     return (status || 'Unknown').replace(/_/g, ' ').toUpperCase();
//   }

//   formatRequestType(type) {
//     return (type || 'N/A').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//   }

//   formatUrgency(urgency) {
//     const map = {
//       'urgent': 'URGENT',
//       'high': 'HIGH',
//       'medium': 'MEDIUM',
//       'low': 'LOW'
//     };
//     return map[urgency] || (urgency || 'N/A').toUpperCase();
//   }

//   formatAllocationStatus(status) {
//     return (status || 'N/A').replace(/_/g, ' ').toUpperCase();
//   }
// }

// module.exports = new PDFService();










// const PDFDocument = require('pdfkit');
// const fs = require('fs');
// const path = require('path');

// class PDFService {
//   constructor() {
//     this.defaultFont = 'Helvetica';
//     this.boldFont = 'Helvetica-Bold';
//     this.logoPath = path.join(__dirname, '../public/images/company-logo.jpg');
//   }

//   async generatePurchaseOrderPDF(poData, outputPath) {
//     return new Promise((resolve, reject) => {
//       try {
//         console.log('=== STARTING PDF GENERATION ===');
//         console.log('PO Data received:', JSON.stringify(poData, null, 2));

//         const doc = new PDFDocument({ 
//           size: 'A4', 
//           margins: { top: 50, bottom: 50, left: 40, right: 40 },
//           info: {
//             Title: `Purchase Order - ${poData.poNumber}`,
//             Author: 'GRATO ENGINEERING GLOBAL LTD',
//             Subject: 'Purchase Order',
//             Creator: 'Purchase Order System'
//           }
//         });

//         if (outputPath) {
//           doc.pipe(fs.createWriteStream(outputPath));
//         }

//         const chunks = [];
//         doc.on('data', chunk => chunks.push(chunk));
//         doc.on('end', () => {
//           const pdfBuffer = Buffer.concat(chunks);
//           console.log('=== PDF GENERATION COMPLETED ===');
//           resolve({
//             success: true,
//             buffer: pdfBuffer,
//             filename: `PO_${poData.poNumber}_${Date.now()}.pdf`
//           });
//         });

//         this.generateExactPOContent(doc, poData);
//         doc.end();
//       } catch (error) {
//         console.error('PDF generation error:', error);
//         reject({
//           success: false,
//           error: error.message
//         });
//       }
//     });
//   }

//   /**
//    * Generate Petty Cash Form PDF - Identical format to Cash Request
//    * Uses the same template as generateCashRequestPDF
//    */
//   async generatePettyCashFormPDF(formData, outputPath) {
//     return new Promise((resolve, reject) => {
//       try {
//         console.log('=== STARTING PETTY CASH FORM PDF GENERATION ===');
//         console.log('Form Number:', formData.displayId);
//         console.log('Requisition:', formData.requisitionNumber);

//         const doc = new PDFDocument({ 
//           size: 'A4', 
//           margins: { top: 50, bottom: 80, left: 40, right: 40 },
//           info: {
//             Title: `Petty Cash Form - ${formData.displayId}`,
//             Author: 'GRATO ENGINEERING GLOBAL LTD',
//             Subject: 'Petty Cash Form',
//             Creator: 'Purchase Requisition System'
//           }
//         });

//         if (outputPath) {
//           doc.pipe(fs.createWriteStream(outputPath));
//         }

//         const chunks = [];
//         doc.on('data', chunk => chunks.push(chunk));
//         doc.on('end', () => {
//           const pdfBuffer = Buffer.concat(chunks);
//           console.log('=== PETTY CASH FORM PDF GENERATION COMPLETED ===');
//           resolve({
//             success: true,
//             buffer: pdfBuffer,
//             filename: `Petty_Cash_Form_${formData.displayId}_${Date.now()}.pdf`
//           });
//         });

//         // Use the same content generation as cash request
//         // The format is identical
//         this.generateCashRequestContent(doc, formData);
//         doc.end();
//       } catch (error) {
//         console.error('Petty Cash Form PDF generation error:', error);
//         reject({
//           success: false,
//           error: error.message
//         });
//       }
//     });
//   }

//   generateExactPOContent(doc, poData) {
//     let yPos = 50;

//     // Header with logo and company info
//     this.drawHeader(doc, yPos, poData);
//     yPos += 90;

//     // Two-column section: Shipping address (left) and Supplier (right)
//     this.drawAddressSection(doc, yPos, poData);
//     yPos += 90; 

//     // Purchase Order Title Bar
//     this.drawPOTitleBar(doc, yPos, poData);
//     yPos += 50;

//     // Items Table
//     const tableHeight = this.drawItemsTable(doc, yPos, poData);
//     yPos += tableHeight + 15;

//     // Payment Terms
//     this.drawPaymentTerms(doc, yPos, poData);
//     yPos += 40;

//     // Signature Section at the end
//     this.drawSignatureSection(doc, yPos, poData);

//     // Footer
//     this.drawFooter(doc, poData);
//   }

//   drawHeader(doc, yPos, poData) {
//     // Company Logo (left side)
//     try {
//       if (fs.existsSync(this.logoPath)) {
//         doc.image(this.logoPath, 40, yPos, { width: 60, height: 56 });
//       } else {
//         // Placeholder logo - red box with text
//         doc.rect(40, yPos, 60, 60)
//            .strokeColor('#E63946')
//            .lineWidth(2)
//            .stroke();
        
//         doc.fontSize(8)
//            .fillColor('#E63946')
//            .font(this.boldFont)
//            .text('GRATO', 48, yPos + 20)
//            .text('ENGINEERING', 43, yPos + 32)
//            .fillColor('#000000');
//       }
//     } catch (error) {
//       console.log('Logo loading error:', error.message);
//       // Draw placeholder
//       doc.rect(40, yPos, 60, 60)
//          .strokeColor('#E63946')
//          .lineWidth(2)
//          .stroke();
      
//       doc.fontSize(8)
//          .fillColor('#E63946')
//          .font(this.boldFont)
//          .text('GRATO', 48, yPos + 20)
//          .text('ENGINEERING', 43, yPos + 32)
//          .fillColor('#000000');
//     }

//     // Company name and address (left, under logo)
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('GRATO ENGINEERING GLOBAL LTD', 110, yPos);

//     doc.fontSize(9)
//        .font(this.defaultFont)
//        .text('Bonaberi', 110, yPos + 15)
//        .text('Douala Cameroon', 110, yPos + 28);
//   }

//   drawAddressSection(doc, yPos, poData) {
//     // Left column: Shipping address
//     doc.fontSize(9)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Shipping address', 40, yPos);

//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text('GRATO ENGINEERING GLOBAL LTD', 40, yPos + 15)
//        .text('Bonaberi', 40, yPos + 28)
//        .text('Douala', 40, yPos + 41)
//        .text('Cameroon', 40, yPos + 54);

//     doc.text('☎ 680726107/653738918', 40, yPos + 67);

//     // Right column: Supplier information (dynamic based on PO data)
//     const supplier = poData.supplierDetails || {};
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(this.safeString(supplier.name, 'Supplier Name Not Available'), 320, yPos)
//        .text(this.safeString(supplier.address, 'Address Not Available'), 320, yPos + 13)
//        .text(this.safeString(supplier.email, 'Email Not Available'), 320, yPos + 26);

//     if (supplier.phone) {
//       doc.text(`☎ ${supplier.phone}`, 320, yPos + 39);
//     }
    
//     if (supplier.taxId || supplier.registrationNumber) {
//       doc.fontSize(8)
//          .text(`VAT: ${supplier.taxId || supplier.registrationNumber || 'N/A'}`, 320, yPos + 52);
//     }
//   }

//   drawPOTitleBar(doc, yPos, poData) {
//     // Purchase Order title - just colored text, no background bar
//     doc.fillColor('#C5504B') 
//        .fontSize(14)
//        .font(this.boldFont)
//        .text(`Purchase Order #${this.safeString(poData.poNumber, 'P00004')}`, 40, yPos);

//     // Three-column info below title
//     const detailsY = yPos + 25; // Reduced spacing
    
//     // Buyer column
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .font(this.defaultFont)
//        .text('Buyer:', 40, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .font(this.defaultFont)
//        .text('GRATO ENGINEERING', 40, detailsY + 12);

//     // Order Date column  
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('Order Date:', 220, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(poData.creationDate), 220, detailsY + 12);

//     // Expected Arrival column
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('Expected Arrival:', 400, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(poData.expectedDeliveryDate), 400, detailsY + 12);
//   }

//   drawItemsTable(doc, yPos, poData) {
//     console.log('=== DRAWING ITEMS TABLE ===');
//     console.log('Items data:', poData.items);
    
//     const tableWidth = 515;
//     const colX = {
//       desc: 40,
//       qty: 280,
//       unitPrice: 325,
//       disc: 400,
//       taxes: 445,
//       amount: 490
//     };
    
//     let currentY = yPos;

//     // Table header with gray background
//     doc.fillColor('#F5F5F5') // Lighter gray to match the image
//        .rect(40, currentY, tableWidth, 20)
//        .fill();

//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .rect(40, currentY, tableWidth, 20)
//        .stroke();

//     doc.fillColor('#000000')
//        .fontSize(9)
//        .font(this.boldFont);

//     // Column headers
//     doc.text('Description', colX.desc + 5, currentY + 6);
//     doc.text('Qty', colX.qty, currentY + 6);
//     doc.text('Unit Price', colX.unitPrice, currentY + 6);
//     doc.text('Disc.', colX.disc, currentY + 6);
//     doc.text('Taxes', colX.taxes, currentY + 6);
//     doc.text('Amount', colX.amount, currentY + 6);

//     // Vertical lines for header
//     [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
//       doc.moveTo(x, currentY).lineTo(x, currentY + 20).stroke();
//     });

//     currentY += 20;

//     // Determine tax rate
//     let taxRate = 0;
//     if (poData.taxApplicable) {
//       taxRate = 0.1925; // 19.25%
//       console.log('Tax is applicable, using 19.25%');
//     }
    
//     let grandTotal = 0;

//     // Table rows
//     const items = Array.isArray(poData.items) ? poData.items : [];
//     console.log(`Processing ${items.length} items`);

//     items.forEach((item, index) => {
//       console.log(`=== Processing item ${index} ===`, item);
      
//       const quantity = this.safeNumber(item.quantity, 0);
//       const unitPrice = this.safeNumber(item.unitPrice, 0);
//       const discount = this.safeNumber(item.discount, 0);
      
//       // Calculate amounts
//       const itemSubtotal = quantity * unitPrice;
//       const discountAmount = itemSubtotal * (discount / 100);
//       const afterDiscount = itemSubtotal - discountAmount;
//       const taxAmount = afterDiscount * taxRate;
//       const itemTotal = afterDiscount + taxAmount;
      
//       console.log('Calculated:', { itemSubtotal, discountAmount, afterDiscount, taxAmount, itemTotal });
      
//       grandTotal += itemTotal;

//       // Clean white rows (no alternating background for cleaner look like the image)
      
//       // Row border
//       doc.strokeColor('#CCCCCC')
//          .rect(40, currentY, tableWidth, 22)
//          .stroke();

//       doc.fillColor('#000000')
//          .fontSize(9)
//          .font(this.defaultFont);

//       // Cell content
//       const description = this.truncateText(this.safeString(item.description, 'No description'), 35);
      
//       doc.text(description, colX.desc + 5, currentY + 6);
//       doc.text(quantity.toFixed(2), colX.qty, currentY + 6);
//       doc.text(this.formatCurrency(unitPrice), colX.unitPrice, currentY + 6);
//       doc.text(discount > 0 ? `${discount.toFixed(2)}%` : '0.00%', colX.disc, currentY + 6);
//       doc.text(taxRate > 0 ? '19.25% G' : '0%', colX.taxes, currentY + 6);
//       doc.text(`${this.formatCurrency(itemTotal)} FCFA`, colX.amount, currentY + 6);

//       // Vertical lines for row
//       [colX.qty, colX.unitPrice, colX.disc, colX.taxes, colX.amount].forEach(x => {
//         doc.moveTo(x, currentY).lineTo(x, currentY + 22).stroke();
//       });

//       currentY += 22;
//     });

//     // If no items
//     if (items.length === 0) {
//       doc.fillColor('#F9F9F9')
//          .rect(40, currentY, tableWidth, 22)
//          .fill();

//       doc.strokeColor('#CCCCCC')
//          .rect(40, currentY, tableWidth, 22)
//          .stroke();

//       doc.fillColor('#666666')
//          .text('No items found', colX.desc + 5, currentY + 6);
      
//       currentY += 22;
//     }

//     // Draw summary box
//     this.drawOrderSummary(doc, currentY, grandTotal, taxRate);

//     return currentY - yPos + 90;
//   }

//   drawOrderSummary(doc, yPos, grandTotal, taxRate) {
//     console.log('=== DRAWING ORDER SUMMARY ===');
//     console.log('Grand Total:', grandTotal, 'Tax Rate:', taxRate);
    
//     const summaryX = 380;
//     const summaryWidth = 175;
//     const labelX = summaryX + 10;
//     const valueX = summaryX + summaryWidth - 10;
    
//     yPos += 10;

//     // Calculate breakdown
//     let untaxedAmount = grandTotal;
//     let vatAmount = 0;
    
//     if (taxRate > 0) {
//       untaxedAmount = grandTotal / (1 + taxRate);
//       vatAmount = grandTotal - untaxedAmount;
//     }

//     // Summary box border
//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .rect(summaryX, yPos, summaryWidth, 68)
//        .stroke();

//     doc.fontSize(9)
//        .font(this.defaultFont)
//        .fillColor('#000000');

//     // Untaxed Amount
//     doc.text('Untaxed Amount', labelX, yPos + 10);
//     doc.text(`${this.formatCurrency(untaxedAmount)} FCFA`, labelX, yPos + 10, {
//       width: summaryWidth - 20,
//       align: 'right'
//     });

//     // VAT line
//     doc.text('VAT 19.25%', labelX, yPos + 28);
//     doc.text(`${this.formatCurrency(vatAmount)} FCFA`, labelX, yPos + 28, {
//       width: summaryWidth - 20,
//       align: 'right'
//     });

//     // Total row with gray background
//     doc.fillColor('#E8E8E8')
//        .rect(summaryX, yPos + 46, summaryWidth, 22)
//        .fill();

//     doc.strokeColor('#CCCCCC')
//        .rect(summaryX, yPos + 46, summaryWidth, 22)
//        .stroke();

//     doc.fillColor('#000000')
//        .font(this.boldFont)
//        .text('Total', labelX, yPos + 53);
    
//     doc.text(`${this.formatCurrency(grandTotal)} FCFA`, labelX, yPos + 53, {
//       width: summaryWidth - 20,
//       align: 'right'
//     });
//   }

//   drawSignatureSection(doc, yPos, poData) {
//     // Add some spacing before signatures
//     yPos += 20;
    
//     // doc.fontSize(9)
//     //    .font(this.boldFont)
//     //    .fillColor('#000000')
//     //    .text('Signatures:', 40, yPos);
    
//     // Three signature lines
//     const signatureY = yPos + 20;
//     const lineWidth = 120;
//     const lineSpacing = 160;
    
//     // Line 1 - Buyer
//     doc.strokeColor('#000000')
//        .lineWidth(0.5)
//        .moveTo(40, signatureY + 30)
//        .lineTo(40 + lineWidth, signatureY + 30)
//        .stroke();
    
//     doc.fontSize(8)
//        .font(this.defaultFont)
//       //  .text('Buyer Signature', 40, signatureY + 35);
//     // doc.text('Date: ___________', 40, signatureY + 48);
    
//     // Line 2 - Supplier
//     doc.moveTo(40 + lineSpacing, signatureY + 30)
//        .lineTo(40 + lineSpacing + lineWidth, signatureY + 30)
//        .stroke();
//     // doc.text('Supplier Signature', 40 + lineSpacing, signatureY + 35);
//     // doc.text('Date: ___________', 40 + lineSpacing, signatureY + 48);
    
//     // Line 3 - Finance Approval
//     doc.moveTo(40 + (lineSpacing * 2), signatureY + 30)
//        .lineTo(40 + (lineSpacing * 2) + lineWidth, signatureY + 30)
//        .stroke();
//     // doc.text('Finance Approval', 40 + (lineSpacing * 2), signatureY + 35);
//     // doc.text('Date: ___________', 40 + (lineSpacing * 2), signatureY + 48);
//   }

//   drawPaymentTerms(doc, yPos, poData) {
//     doc.fontSize(9)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Payment Terms:', 40, yPos);

//     doc.font(this.defaultFont)
//        .fontSize(8)
//        .text(this.safeString(poData.paymentTerms, 'Net 30 days'), 40, yPos + 15);

//     // Special instructions if any
//     if (poData.specialInstructions) {
//       doc.font(this.boldFont)
//          .fontSize(9)
//          .text('Special Instructions:', 40, yPos + 35);

//       doc.font(this.defaultFont)
//          .fontSize(8)
//          .text(this.safeString(poData.specialInstructions, ''), 40, yPos + 50, {
//            width: 500
//          });
//     }
//   }

//   drawFooter(doc, poData) {
//     const footerY = doc.page.height - 80;
    
//     // Horizontal line
//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .moveTo(40, footerY)
//        .lineTo(555, footerY)
//        .stroke();

//     // Footer content
//     doc.fontSize(7)
//        .font(this.defaultFont)
//        .fillColor('#666666');

//     // Registration and page number
//     doc.text('RC/DLA/2014/B/2690 NIU: M061421030521 Access Bank Cameroon PLC 10041000010010130003616', 40, footerY + 8);
//     doc.text('Page 1 / 1', 520, footerY + 8);

//     // Contact information
//     doc.text('679586444 info@gratoengineering.com www.gratoengineering.com', 40, footerY + 20);
//     doc.text('Location: Bonaberi-Douala, beside Santa', 40, footerY + 32);
//     doc.text('Lucia Telecommunications, Civil, Electrical and Mechanical Engineering Services.', 40, footerY + 44);
//   }

//   // Helper methods
//   safeNumber(value, defaultValue = 0) {
//     if (value === null || value === undefined || value === '') {
//       return defaultValue;
//     }
//     const num = Number(value);
//     return isNaN(num) ? defaultValue : num;
//   }

//   safeString(value, defaultValue = '') {
//     if (value === null || value === undefined) {
//       return defaultValue;
//     }
//     const str = String(value);
//     if (str.includes('NaN') || str === 'NaN') {
//       return defaultValue || '0';
//     }
//     return str;
//   }

//   formatDateExact(date) {
//     if (!date) return '';
//     try {
//       const d = new Date(date);
//       if (isNaN(d.getTime())) return '';
      
//       const day = String(d.getDate()).padStart(2, '0');
//       const month = String(d.getMonth() + 1).padStart(2, '0');
//       const year = d.getFullYear();
      
//       return `${month}/${day}/${year}`;
//     } catch (error) {
//       console.error('Date formatting error:', error);
//       return '';
//     }
//   }

//   formatCurrency(number) {
//     const safeNum = this.safeNumber(number, 0);
//     if (isNaN(safeNum)) return '0.00';
    
//     try {
//       return safeNum.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
//     } catch (error) {
//       console.error('Number formatting error:', error);
//       return '0.00';
//     }
//   }

//   truncateText(text, maxLength) {
//     const safeText = this.safeString(text, '');
//     if (safeText.length <= maxLength) return safeText;
//     return safeText.substring(0, maxLength - 3) + '...';
//   }



//   // Cash Reuest Download 
//   /**
//    * Generate Cash Request PDF with approval chain - FIXED
//    */
//   async generateCashRequestPDF(requestData, outputPath) {
//     return new Promise((resolve, reject) => {
//       try {
//         console.log('=== STARTING CASH REQUEST PDF GENERATION ===');
//         console.log('Request ID:', requestData._id);
//         console.log('Employee:', requestData.employee?.fullName);

//         const doc = new PDFDocument({ 
//           size: 'A4', 
//           margins: { top: 50, bottom: 80, left: 40, right: 40 },
//           info: {
//             Title: `Cash Request - ${requestData.displayId || requestData._id}`,
//             Author: 'GRATO ENGINEERING GLOBAL LTD',
//             Subject: 'Cash Request Document',
//             Creator: 'Cash Request System'
//           }
//         });

//         if (outputPath) {
//           doc.pipe(fs.createWriteStream(outputPath));
//         }

//         const chunks = [];
//         doc.on('data', chunk => chunks.push(chunk));
//         doc.on('end', () => {
//           const pdfBuffer = Buffer.concat(chunks);
//           console.log('=== CASH REQUEST PDF GENERATION COMPLETED ===');
//           resolve({
//             success: true,
//             buffer: pdfBuffer,
//             filename: `Cash_Request_${requestData.displayId || requestData._id.toString().slice(-6).toUpperCase()}_${Date.now()}.pdf`
//           });
//         });

//         this.generateCashRequestContent(doc, requestData);
//         doc.end();
//       } catch (error) {
//         console.error('Cash Request PDF generation error:', error);
//         reject({
//           success: false,
//           error: error.message
//         });
//       }
//     });
//   }

//   generateCashRequestContent(doc, data) {
//     let yPos = 50;

//     // Header with logo and company info
//     this.drawCashRequestHeader(doc, yPos, data);
//     yPos += 90;

//     // Request title bar
//     this.drawCashRequestTitleBar(doc, yPos, data);
//     yPos += 60;

//     // Employee and Request Details
//     yPos = this.drawCashRequestDetails(doc, yPos, data);

//     // Check page break before approval chain
//     if (yPos > 600) {
//       doc.addPage();
//       yPos = 50;
//     }

//     // Approval Chain Timeline
//     yPos = this.drawApprovalChainTimeline(doc, yPos, data);

//     // Check page break before financial summary
//     if (yPos > 650) {
//       doc.addPage();
//       yPos = 50;
//     }

//     // Financial Summary
//     yPos = this.drawCashRequestFinancialSummary(doc, yPos, data);

//     // Budget Allocation (if exists)
//     if (data.budgetAllocation && data.budgetAllocation.budgetCodeId) {
//       // Check page break before budget
//       if (yPos > 650) {
//         doc.addPage();
//         yPos = 50;
//       }
//       yPos = this.drawBudgetAllocation(doc, yPos, data);
//     }

//     // Check page break before signatures
//     if (yPos > 680) {
//       doc.addPage();
//       yPos = 50;
//     }

//     // Signature Section
//     this.drawCashRequestSignatureSection(doc, yPos, data);

//     // Footer (always at bottom of CURRENT page only)
//     this.drawCashRequestFooter(doc, data);
//   }

//   drawCashRequestHeader(doc, yPos, data) {
//     // Company Logo
//     try {
//       if (fs.existsSync(this.logoPath)) {
//         doc.image(this.logoPath, 40, yPos, { width: 60, height: 56 });
//       } else {
//         doc.rect(40, yPos, 60, 60)
//            .strokeColor('#E63946')
//            .lineWidth(2)
//            .stroke();
        
//         doc.fontSize(8)
//            .fillColor('#E63946')
//            .font(this.boldFont)
//            .text('GRATO', 48, yPos + 20)
//            .text('ENGINEERING', 43, yPos + 32)
//            .fillColor('#000000');
//       }
//     } catch (error) {
//       console.log('Logo loading error:', error.message);
//       doc.rect(40, yPos, 60, 60)
//          .strokeColor('#E63946')
//          .lineWidth(2)
//          .stroke();
//     }

//     // Company name and address
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('GRATO ENGINEERING GLOBAL LTD', 110, yPos);

//     doc.fontSize(9)
//        .font(this.defaultFont)
//        .text('Bonaberi', 110, yPos + 15)
//        .text('Douala Cameroon', 110, yPos + 28)
//        .text('☎ 680726107/653738918', 110, yPos + 41);
//   }

//   drawCashRequestTitleBar(doc, yPos, data) {
//     // Title
//     doc.fillColor('#C5504B') 
//        .fontSize(14)
//        .font(this.boldFont)
//        .text(`CASH REQUEST #${data.displayId || data._id.toString().slice(-6).toUpperCase()}`, 40, yPos);

//     const detailsY = yPos + 25;
    
//     // Three columns
//     doc.fillColor('#888888')
//        .fontSize(8)
//        .font(this.defaultFont)
//        .text('Status:', 40, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .font(this.boldFont)
//        .text(this.formatStatus(data.status), 40, detailsY + 12);

//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('Request Date:', 220, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(data.createdAt), 220, detailsY + 12);

//     doc.fillColor('#888888')
//        .fontSize(8)
//        .text('Disbursed Date:', 400, detailsY);
    
//     doc.fillColor('#000000')
//        .fontSize(9)
//        .text(this.formatDateExact(data.disbursementDetails?.date), 400, detailsY + 12);
//   }

//   drawCashRequestDetails(doc, yPos, data) {
//     yPos += 10;
    
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Request Details', 40, yPos);
    
//     yPos += 20;

//     // Compact details box
//     const boxStartY = yPos;
//     const boxHeight = 100;
    
//     doc.rect(40, yPos, 515, boxHeight)
//        .strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .stroke();

//     yPos += 10;

//     // Left Column - Employee Info
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Requested By:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(data.employee?.fullName || 'N/A', 50, yPos + 12);
    
//     doc.fontSize(8)
//        .fillColor('#666666')
//        .text(`${data.employee?.department || 'N/A'}`, 50, yPos + 25);

//     // Right Column - Request Info
//     doc.fillColor('#000000')
//        .fontSize(8)
//        .font(this.boldFont)
//        .text('Request Type:', 280, yPos);
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(this.formatRequestType(data.requestType), 280, yPos + 12);

//     doc.font(this.boldFont)
//        .fontSize(8)
//        .text('Urgency:', 280, yPos + 30);
    
//     doc.font(this.defaultFont)
//        .fontSize(9)
//        .text(this.formatUrgency(data.urgency), 280, yPos + 42);

//     if (data.projectId) {
//       doc.font(this.boldFont)
//          .fontSize(8)
//          .text('Project:', 280, yPos + 60);
      
//       doc.font(this.defaultFont)
//          .fontSize(8)
//          .text((data.projectId.name || 'N/A').substring(0, 30), 280, yPos + 72);
//     }

//     yPos = boxStartY + boxHeight + 15;

//     // Purpose - Compact
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Purpose:', 40, yPos);
    
//     yPos += 12;

//     const purposeText = (data.purpose || 'N/A').substring(0, 200);
//     doc.fontSize(8)
//        .font(this.defaultFont)
//        .fillColor('#333333')
//        .text(purposeText, 40, yPos, {
//          width: 515,
//          align: 'justify',
//          lineGap: 2
//        });

//     // Calculate actual height used
//     const purposeHeight = Math.min(doc.heightOfString(purposeText, { width: 515 }), 40);
//     yPos += purposeHeight + 10;

//     // Business Justification - Compact
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Business Justification:', 40, yPos);
    
//     yPos += 12;

//     const justificationText = (data.businessJustification || 'N/A').substring(0, 250);
//     doc.fontSize(8)
//        .font(this.defaultFont)
//        .fillColor('#333333')
//        .text(justificationText, 40, yPos, {
//          width: 515,
//          align: 'justify',
//          lineGap: 2
//        });

//     const justificationHeight = Math.min(doc.heightOfString(justificationText, { width: 515 }), 50);
//     yPos += justificationHeight + 15;

//     return yPos;
//   }

//   drawApprovalChainTimeline(doc, yPos, data) {
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Approval Chain', 40, yPos);
    
//     yPos += 20;

//     if (!data.approvalChain || data.approvalChain.length === 0) {
//       doc.fontSize(9)
//          .font(this.defaultFont)
//          .fillColor('#999999')
//          .text('No approval chain data', 40, yPos);
//       return yPos + 20;
//     }

//     // Draw each approval step - COMPACT VERSION
//     data.approvalChain.forEach((step, index) => {
//       // Check if we need a new page (leave room for footer)
//       if (yPos > 680) {
//         doc.addPage();
//         yPos = 50;
        
//         // Redraw section header on new page
//         doc.fontSize(11)
//            .font(this.boldFont)
//            .fillColor('#000000')
//            .text('Approval Chain (continued)', 40, yPos);
//         yPos += 20;
//       }

//       // Draw timeline connector line (if not first)
//       if (index > 0) {
//         doc.moveTo(55, yPos - 10)
//            .lineTo(55, yPos)
//            .strokeColor('#CCCCCC')
//            .lineWidth(2)
//            .stroke();
//       }

//       // Draw status circle
//       const statusColor = step.status === 'approved' ? '#52c41a' : 
//                          step.status === 'rejected' ? '#f5222d' : '#d9d9d9';
      
//       doc.circle(55, yPos + 6, 5)
//          .fillAndStroke(statusColor, statusColor);

//       // Step details - COMPACT
//       doc.fontSize(8)
//          .font(this.boldFont)
//          .fillColor('#000000')
//          .text(`Level ${step.level}: ${step.approver.name}`, 75, yPos);

//       doc.fontSize(7)
//          .font(this.defaultFont)
//          .fillColor('#666666')
//          .text(`${step.approver.role}`, 75, yPos + 10);

//       // Status and date - COMPACT
//       if (step.status === 'approved') {
//         doc.fillColor('#52c41a')
//            .fontSize(7)
//            .font(this.boldFont)
//            .text('✓ APPROVED', 75, yPos + 20);
        
//         doc.fillColor('#666666')
//            .font(this.defaultFont)
//            .fontSize(7)
//            .text(`${this.formatDateExact(step.actionDate)} ${step.actionTime || ''}`, 75, yPos + 30);

//         if (step.comments) {
//           const shortComment = step.comments.substring(0, 80);
//           doc.fillColor('#333333')
//              .fontSize(7)
//              .text(`"${shortComment}${step.comments.length > 80 ? '...' : ''}"`, 75, yPos + 40, {
//                width: 450
//              });
//           yPos += 55;
//         } else {
//           yPos += 45;
//         }
//       } else if (step.status === 'rejected') {
//         doc.fillColor('#f5222d')
//            .fontSize(7)
//            .font(this.boldFont)
//            .text('✗ REJECTED', 75, yPos + 20);
        
//         doc.fillColor('#666666')
//            .font(this.defaultFont)
//            .fontSize(7)
//            .text(`${this.formatDateExact(step.actionDate)} ${step.actionTime || ''}`, 75, yPos + 30);

//         if (step.comments) {
//           const shortComment = step.comments.substring(0, 80);
//           doc.fillColor('#f5222d')
//              .fontSize(7)
//              .text(`"${shortComment}${step.comments.length > 80 ? '...' : ''}"`, 75, yPos + 40, {
//                width: 450
//              });
//           yPos += 55;
//         } else {
//           yPos += 45;
//         }
//       } else {
//         doc.fillColor('#999999')
//            .fontSize(7)
//            .font(this.defaultFont)
//            .text('Pending', 75, yPos + 20);
//         yPos += 35;
//       }
//     });

//     return yPos + 10;
//   }

//   drawCashRequestFinancialSummary(doc, yPos, data) {
//     yPos += 5;
    
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Financial Summary', 40, yPos);
    
//     yPos += 20;

//     // Compact summary box
//     const boxHeight = 70;
//     doc.rect(40, yPos, 515, boxHeight)
//        .fillAndStroke('#F5F5F5', '#CCCCCC');

//     yPos += 12;

//     // Amount Requested
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Amount Requested:', 50, yPos);
    
//     doc.text(`XAF ${this.formatCurrency(data.amountRequested)}`, 380, yPos, {
//       width: 165,
//       align: 'right'
//     });

//     yPos += 18;

//     // Amount Approved
//     doc.text('Amount Approved:', 50, yPos);
    
//     doc.fillColor(data.amountApproved ? '#52c41a' : '#000000')
//        .text(`XAF ${this.formatCurrency(data.amountApproved || data.amountRequested)}`, 380, yPos, {
//          width: 165,
//          align: 'right'
//        });

//     yPos += 18;

//     // Amount Disbursed
//     doc.fillColor('#000000')
//        .text('Amount Disbursed:', 50, yPos);
    
//     const disbursedAmount = data.disbursementDetails?.amount || data.amountApproved || data.amountRequested;
    
//     doc.fillColor('#1890ff')
//        .font(this.boldFont)
//        .fontSize(9)
//        .text(`XAF ${this.formatCurrency(disbursedAmount)}`, 380, yPos, {
//          width: 165,
//          align: 'right'
//        });

//     return yPos + 25;
//   }

//   drawBudgetAllocation(doc, yPos, data) {
//     const budget = data.budgetAllocation;
    
//     yPos += 5;
    
//     // Section header
//     doc.fontSize(11)
//        .font(this.boldFont)
//        .fillColor('#000000')
//        .text('Budget Allocation', 40, yPos);
    
//     yPos += 20;

//     // Compact budget box
//     const boxHeight = 75;
//     doc.rect(40, yPos, 515, boxHeight)
//        .strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .stroke();

//     yPos += 12;

//     // Budget Code
//     doc.fontSize(8)
//        .font(this.boldFont)
//        .text('Budget Code:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .text(budget.budgetCode || 'N/A', 200, yPos);

//     yPos += 15;

//     // Budget Name
//     if (budget.budgetCodeId?.name) {
//       doc.font(this.boldFont)
//          .text('Budget Name:', 50, yPos);
      
//       doc.font(this.defaultFont)
//          .text((budget.budgetCodeId.name || '').substring(0, 50), 200, yPos, { width: 300 });
      
//       yPos += 15;
//     }

//     // Allocated Amount
//     doc.font(this.boldFont)
//        .text('Allocated Amount:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .text(`XAF ${this.formatCurrency(budget.allocatedAmount)}`, 200, yPos);

//     yPos += 15;

//     // Status
//     doc.font(this.boldFont)
//        .text('Status:', 50, yPos);
    
//     doc.font(this.defaultFont)
//        .text(this.formatAllocationStatus(budget.allocationStatus), 200, yPos);

//     return yPos + 20;
//   }

//   drawCashRequestSignatureSection(doc, yPos, data) {
//     yPos += 15;
    
//     const signatureY = yPos;
//     const lineWidth = 120;
//     const lineSpacing = 160;
    
//     // Three signature lines
//     for (let i = 0; i < 3; i++) {
//       const xPos = 40 + (i * lineSpacing);
      
//       doc.moveTo(xPos, signatureY + 25)
//          .lineTo(xPos + lineWidth, signatureY + 25)
//          .strokeColor('#000000')
//          .lineWidth(0.5)
//          .stroke();
//     }
//   }

//   drawCashRequestFooter(doc, data) {
//     // Get current page number and total pages
//     const range = doc.bufferedPageRange();
//     const currentPage = range.start + range.count;
    
//     // Only draw footer on the LAST page
//     const footerY = doc.page.height - 70;
    
//     // Horizontal line
//     doc.strokeColor('#CCCCCC')
//        .lineWidth(0.5)
//        .moveTo(40, footerY)
//        .lineTo(555, footerY)
//        .stroke();

//     // Footer content
//     doc.fontSize(7)
//        .font(this.defaultFont)
//        .fillColor('#666666');

//     // Registration
//     doc.text('RC/DLA/2014/B/2690 NIU: M061421030521', 40, footerY + 8);
    
//     // Generation timestamp
//     doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, footerY + 20);
    
//     // Page number
//     doc.text(`Page ${currentPage}`, 510, footerY + 8);

//     // Contact
//     doc.text('679586444 | info@gratoengineering.com', 40, footerY + 32);
//   }

//   // Helper methods
//   formatStatus(status) {
//     return (status || 'Unknown').replace(/_/g, ' ').toUpperCase();
//   }

//   formatRequestType(type) {
//     return (type || 'N/A').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//   }

//   formatUrgency(urgency) {
//     const map = {
//       'urgent': 'URGENT',
//       'high': 'HIGH',
//       'medium': 'MEDIUM',
//       'low': 'LOW'
//     };
//     return map[urgency] || (urgency || 'N/A').toUpperCase();
//   }

//   formatAllocationStatus(status) {
//     return (status || 'N/A').replace(/_/g, ' ').toUpperCase();
//   }
// }

// module.exports = new PDFService();