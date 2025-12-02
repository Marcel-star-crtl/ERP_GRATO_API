const PurchaseOrder = require('../models/PurchaseOrder');
const Quote = require('../models/Quote');
const User = require('../models/User');
const Supplier = require('../models/Supplier'); 
const Item = require('../models/Item');
const pdfService = require('../services/pdfService'); 
const archiver = require('archiver');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const RFQ = require('../models/RFQ');
const { uploadFile } = require('../config/cloudinary');
const { sendEmail } = require('../services/emailService');

const getSuppliers = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 50 } = req.query;

    let query = { 
      status: 'approved', 
      'approvalStatus.status': 'approved' 
    };

    // Add search filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }

    // Add category filter
    if (category && category !== 'all') {
      query.categories = category;
    }

    console.log('Supplier query:', JSON.stringify(query, null, 2));

    const suppliers = await Supplier.find(query)
      .select('name email phone address businessType categories performance bankDetails')
      .sort({ name: 1, 'performance.overallRating': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Supplier.countDocuments(query);

    console.log(`Found ${suppliers.length} suppliers out of ${total} total`);

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: suppliers.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suppliers',
      error: error.message
    });
  }
};

// Validate and get items for PO creation
const validatePOItems = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    // Extract item IDs and validate each item
    const itemValidations = await Promise.all(
      items.map(async (item) => {
        try {
          // If itemId is provided, validate against database
          if (item.itemId) {
            const dbItem = await Item.findById(item.itemId);
            if (!dbItem || !dbItem.isActive) {
              return {
                valid: false,
                error: 'Item not found or inactive in database',
                item
              };
            }

            return {
              valid: true,
              dbItem,
              item: {
                ...item,
                description: dbItem.description,
                category: dbItem.category,
                unitOfMeasure: dbItem.unitOfMeasure,
                standardPrice: dbItem.standardPrice
              }
            };
          } else {
            // Manual item entry - validate required fields
            if (!item.description || !item.quantity || !item.unitPrice) {
              return {
                valid: false,
                error: 'Description, quantity, and unit price are required for manual items',
                item
              };
            }

            return {
              valid: true,
              item: {
                ...item,
                totalPrice: item.quantity * item.unitPrice
              }
            };
          }
        } catch (error) {
          return {
            valid: false,
            error: error.message,
            item
          };
        }
      })
    );

    const validItems = itemValidations.filter(v => v.valid).map(v => v.item);
    const invalidItems = itemValidations.filter(v => !v.valid);

    res.json({
      success: true,
      data: {
        validItems,
        invalidItems,
        validCount: validItems.length,
        invalidCount: invalidItems.length,
        totalAmount: validItems.reduce((sum, item) => sum + (item.totalPrice || (item.quantity * item.unitPrice)), 0)
      }
    });

  } catch (error) {
    console.error('Validate PO items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate items',
      error: error.message
    });
  }
};

// Create purchase order independently
const createPurchaseOrder = async (req, res) => {
  try {
    const {
      supplierDetails,
      items,
      totalAmount,
      currency = 'XAF',
      taxApplicable = false,
      taxRate = 19.2,
      deliveryAddress,
      expectedDeliveryDate,
      paymentTerms,
      specialInstructions,
      notes
    } = req.body;

    console.log('Creating PO with data:', {
      supplierType: supplierDetails?.isExternal ? 'External' : 'Registered',
      supplierId: supplierDetails?.id,
      supplierName: supplierDetails?.name,
      supplierEmail: supplierDetails?.email,
      itemsCount: items?.length,
      totalAmount
    });

    // Validation
    if (!supplierDetails || !supplierDetails.name || !supplierDetails.email) {
      return res.status(400).json({
        success: false,
        message: 'Supplier details (name and email) are required'
      });
    }

    // For external suppliers, we don't need a supplierId, but for registered suppliers we do
    if (!supplierDetails.isExternal && !supplierDetails.id) {
      return res.status(400).json({
        success: false,
        message: 'Registered supplier must have an ID'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    if (!deliveryAddress || !expectedDeliveryDate || !paymentTerms) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address, expected delivery date, and payment terms are required'
      });
    }

    // Validate supplier exists in Supplier model (only for registered suppliers)
    let supplier = null;
    if (!supplierDetails.isExternal) {
      supplier = await Supplier.findById(supplierDetails.id);
      if (!supplier) {
        return res.status(400).json({
          success: false,
          message: 'Invalid supplier selected - supplier not found in database'
        });
      }

      if (supplier.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Selected supplier is not approved for orders'
        });
      }
    }

    // Validate and process items
    let calculatedTotal = 0;
    const processedItems = await Promise.all(
      items.map(async (item, index) => {
        if (!item.description || !item.quantity || item.quantity <= 0 || !item.unitPrice || item.unitPrice <= 0) {
          throw new Error(`Item ${index + 1}: Description, valid quantity, and unit price are required`);
        }

        const itemTotal = item.quantity * item.unitPrice;
        calculatedTotal += itemTotal;

        // If itemId is provided, fetch additional details from database
        let itemDetails = {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: itemTotal,
          specifications: item.specifications || ''
        };

        if (item.itemId) {
          const dbItem = await Item.findById(item.itemId);
          if (dbItem) {
            itemDetails = {
              ...itemDetails,
              itemId: item.itemId,
              itemCode: dbItem.code,
              category: dbItem.category,
              unitOfMeasure: dbItem.unitOfMeasure
            };
          }
        }

        return itemDetails;
      })
    );

    // Validate dates
    const deliveryDate = new Date(expectedDeliveryDate);
    const today = new Date();

    if (deliveryDate <= today) {
      return res.status(400).json({
        success: false,
        message: 'Expected delivery date must be in the future'
      });
    }

    // Generate PO number
    const now = new Date();
    const year = now.getFullYear();
    const count = await PurchaseOrder.countDocuments();
    const poNumber = `PO-${year}-${String(count + 1).padStart(6, '0')}`;

    // Create purchase order with proper supplier reference
    const purchaseOrder = new PurchaseOrder({
      poNumber,
      supplierId: supplier?._id || null, // Use Supplier model ID for registered suppliers, null for external
      buyerId: req.user.userId,

      // Order details
      items: processedItems,
      totalAmount: calculatedTotal,
      currency,
      taxApplicable,
      taxRate,

      // Delivery and payment
      deliveryAddress,
      expectedDeliveryDate: deliveryDate,
      paymentTerms,

      // Additional details
      specialInstructions,
      notes,

      // Status
      status: 'draft',
      progress: 5,
      currentStage: 'created',

      // Activities
      activities: [{
        type: 'created',
        description: 'Purchase order created',
        user: req.user.fullName || 'Buyer',
        timestamp: new Date()
      }],

      // Supplier details (snapshot from Supplier model or external supplier details)
      supplierDetails: supplier ? {
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: typeof supplier.address === 'object' 
          ? `${supplier.address.street || ''}, ${supplier.address.city || ''}, ${supplier.address.state || ''}`.trim()
          : supplier.address || '',
        businessType: supplier.businessType,
        registrationNumber: supplier.registrationNumber
      } : {
        name: supplierDetails.name,
        email: supplierDetails.email,
        phone: supplierDetails.phone || '',
        address: supplierDetails.address || '',
        businessType: 'External Supplier',
        registrationNumber: null
      },

      createdBy: req.user.userId
    });

    await purchaseOrder.save();

    console.log('Created purchase order:', {
      id: purchaseOrder._id,
      poNumber: purchaseOrder.poNumber,
      supplierId: purchaseOrder.supplierId,
      totalAmount: purchaseOrder.totalAmount
    });

    res.json({
      success: true,
      message: 'Purchase order created successfully',
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          totalAmount: purchaseOrder.totalAmount,
          currency: purchaseOrder.currency,
          status: purchaseOrder.status,
          supplierName: purchaseOrder.supplierDetails.name,
          creationDate: purchaseOrder.createdAt,
          expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
          items: purchaseOrder.items
        }
      }
    });

  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create purchase order',
      error: error.message
    });
  }
};

// // Create purchase order independently
// const createPurchaseOrder = async (req, res) => {
//   try {
//     const {
//       supplierDetails,
//       items,
//       totalAmount,
//       currency = 'XAF',
//       taxApplicable = false,
//       taxRate = 19.2,
//       deliveryAddress,
//       expectedDeliveryDate,
//       paymentTerms,
//       specialInstructions,
//       notes
//     } = req.body;

//     console.log('Creating PO with data:', {
//       supplierType: supplierDetails?.isExternal ? 'External' : 'Registered',
//       supplierId: supplierDetails?.id,
//       supplierName: supplierDetails?.name,
//       supplierEmail: supplierDetails?.email,
//       itemsCount: items?.length,
//       totalAmount
//     });

//     // Validation
//     if (!supplierDetails || !supplierDetails.name || !supplierDetails.email) {
//       return res.status(400).json({
//         success: false,
//         message: 'Supplier details (name and email) are required'
//       });
//     }

//     // For external suppliers, we don't need a supplierId, but for registered suppliers we do
//     if (!supplierDetails.isExternal && !supplierDetails.id) {
//       return res.status(400).json({
//         success: false,
//         message: 'Registered supplier must have an ID'
//       });
//     }

//     if (!items || items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'At least one item is required'
//       });
//     }

//     if (!deliveryAddress || !expectedDeliveryDate || !paymentTerms) {
//       return res.status(400).json({
//         success: false,
//         message: 'Delivery address, expected delivery date, and payment terms are required'
//       });
//     }

//     // Validate supplier exists in Supplier model (only for registered suppliers)
//     let supplier = null;
//     if (!supplierDetails.isExternal) {
//       supplier = await Supplier.findById(supplierDetails.id);
//       if (!supplier) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid supplier selected - supplier not found in database'
//         });
//       }

//       if (supplier.status !== 'approved') {
//         return res.status(400).json({
//           success: false,
//           message: 'Selected supplier is not approved for orders'
//         });
//       }
//     }

//     // Validate and process items
//     let calculatedTotal = 0;
//     const processedItems = await Promise.all(
//       items.map(async (item, index) => {
//         if (!item.description || !item.quantity || item.quantity <= 0 || !item.unitPrice || item.unitPrice <= 0) {
//           throw new Error(`Item ${index + 1}: Description, valid quantity, and unit price are required`);
//         }

//         const itemTotal = item.quantity * item.unitPrice;
//         calculatedTotal += itemTotal;

//         // If itemId is provided, fetch additional details from database
//         let itemDetails = {
//           description: item.description,
//           quantity: item.quantity,
//           unitPrice: item.unitPrice,
//           totalPrice: itemTotal,
//           specifications: item.specifications || ''
//         };

//         if (item.itemId) {
//           const dbItem = await Item.findById(item.itemId);
//           if (dbItem) {
//             itemDetails = {
//               ...itemDetails,
//               itemId: item.itemId,
//               itemCode: dbItem.code,
//               category: dbItem.category,
//               unitOfMeasure: dbItem.unitOfMeasure
//             };
//           }
//         }

//         return itemDetails;
//       })
//     );

//     // Validate dates
//     const deliveryDate = new Date(expectedDeliveryDate);
//     const today = new Date();

//     if (deliveryDate <= today) {
//       return res.status(400).json({
//         success: false,
//         message: 'Expected delivery date must be in the future'
//       });
//     }

//     // Generate PO number
//     const now = new Date();
//     const year = now.getFullYear();
//     const count = await PurchaseOrder.countDocuments();
//     const poNumber = `PO-${year}-${String(count + 1).padStart(6, '0')}`;

//     // Create purchase order with proper supplier reference
//     const purchaseOrder = new PurchaseOrder({
//       poNumber,
//       supplierId: supplier?._id || null, // Use Supplier model ID for registered suppliers, null for external
//       buyerId: req.user.userId,

//       // Order details
//       items: processedItems,
//       totalAmount: calculatedTotal,
//       currency,
//       taxApplicable,
//       taxRate,

//       // Delivery and payment
//       deliveryAddress,
//       expectedDeliveryDate: deliveryDate,
//       paymentTerms,

//       // Additional details
//       specialInstructions,
//       notes,

//       // Status
//       status: 'draft',
//       progress: 5,
//       currentStage: 'created',

//       // Activities
//       activities: [{
//         type: 'created',
//         description: 'Purchase order created',
//         user: req.user.fullName || 'Buyer',
//         timestamp: new Date()
//       }],

//       // Supplier details (snapshot from Supplier model or external supplier details)
//       supplierDetails: supplier ? {
//         name: supplier.name,
//         email: supplier.email,
//         phone: supplier.phone,
//         address: typeof supplier.address === 'object' 
//           ? `${supplier.address.street || ''}, ${supplier.address.city || ''}, ${supplier.address.state || ''}`.trim()
//           : supplier.address || '',
//         businessType: supplier.businessType,
//         registrationNumber: supplier.registrationNumber
//       } : {
//         name: supplierDetails.name,
//         email: supplierDetails.email,
//         phone: supplierDetails.phone || '',
//         address: supplierDetails.address || '',
//         businessType: 'External Supplier',
//         registrationNumber: null
//       },

//       createdBy: req.user.userId
//     });

//     await purchaseOrder.save();

//     console.log('Created purchase order:', {
//       id: purchaseOrder._id,
//       poNumber: purchaseOrder.poNumber,
//       supplierId: purchaseOrder.supplierId,
//       totalAmount: purchaseOrder.totalAmount
//     });

//     // Auto-send email to external suppliers
//     let emailSent = false;
//     if (supplierDetails.isExternal) {
//       try {
//         console.log('Sending automatic email to external supplier:', supplierDetails.email);
        
//         const user = req.user;
//         const itemsHTML = purchaseOrder.items.map(item => `
//           <tr style="border-bottom: 1px solid #e8e8e8;">
//             <td style="padding: 8px; text-align: left;">${item.description}</td>
//             <td style="padding: 8px; text-align: center;">${item.quantity}</td>
//             <td style="padding: 8px; text-align: center;">${item.unitOfMeasure || 'Unit'}</td>
//             <td style="padding: 8px; text-align: right;">${purchaseOrder.currency} ${item.unitPrice.toLocaleString()}</td>
//             <td style="padding: 8px; text-align: right;">${purchaseOrder.currency} ${item.totalPrice.toLocaleString()}</td>
//           </tr>
//         `).join('');

//         await sendEmail({
//           to: supplierDetails.email,
//           subject: `New Purchase Order - ${purchaseOrder.poNumber}`,
//           html: `
//             <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
//               <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
//                 <h2 style="color: #1890ff; margin-top: 0;">New Purchase Order</h2>
//                 <p>Dear ${supplierDetails.name},</p>
//                 <p>We have created a new purchase order for your services. Please find the details below:</p>
//               </div>

//               <div style="background-color: white; padding: 20px; border: 1px solid #e8e8e8; border-radius: 8px; margin: 20px 0;">
//                 <h3 style="color: #333; margin-top: 0;">Purchase Order Details</h3>
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
//                   <div>
//                     <p><strong>PO Number:</strong> ${purchaseOrder.poNumber}</p>
//                     <p><strong>Order Date:</strong> ${new Date(purchaseOrder.createdAt).toLocaleDateString('en-GB')}</p>
//                     <p><strong>Expected Delivery:</strong> ${new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString('en-GB')}</p>
//                   </div>
//                   <div>
//                     <p><strong>Total Amount:</strong> ${purchaseOrder.currency} ${purchaseOrder.totalAmount.toLocaleString()}</p>
//                     <p><strong>Payment Terms:</strong> ${purchaseOrder.paymentTerms}</p>
//                   </div>
//                 </div>

//                 <h4 style="color: #333;">Items Ordered:</h4>
//                 <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
//                   <thead>
//                     <tr style="background-color: #f5f5f5;">
//                       <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
//                       <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
//                       <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Unit</th>
//                       <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
//                       <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     ${itemsHTML}
//                   </tbody>
//                 </table>

//                 ${purchaseOrder.deliveryAddress ? `
//                 <h4 style="color: #333;">Delivery Information:</h4>
//                 <p><strong>Delivery Address:</strong> ${purchaseOrder.deliveryAddress}</p>
//                 ` : ''}

//                 ${purchaseOrder.specialInstructions ? `
//                 <h4 style="color: #333;">Special Instructions:</h4>
//                 <p>${purchaseOrder.specialInstructions}</p>
//                 ` : ''}

//                 <div style="margin: 20px 0; padding: 15px; background-color: white; border-radius: 8px;">
//                   <p><strong>Next Steps:</strong></p>
//                   <ul>
//                     <li>Please confirm receipt of this purchase order</li>
//                     <li>Provide updated delivery timeline if different from expected date</li>
//                     <li>Notify us immediately of any issues or concerns</li>
//                     <li>Send delivery confirmation with tracking details when items are dispatched</li>
//                   </ul>
//                 </div>

//                 <p>Thank you for your service. We look forward to a successful delivery.</p>
//                 <p>Best regards,<br>${user.fullName}<br>Procurement Team</p>
//               </div>
//             </div>
//           `
//         });

//         emailSent = true;
//         console.log('✅ Email sent successfully to external supplier:', supplierDetails.email);

//       } catch (emailError) {
//         console.error('❌ Failed to send email to external supplier:', emailError);
//         // Don't fail the PO creation if email fails
//       }
//     }

//     res.json({
//       success: true,
//       message: `Purchase order created successfully${emailSent ? ' and emailed to supplier' : ''}`,
//       data: {
//         purchaseOrder: {
//           id: purchaseOrder._id,
//           poNumber: purchaseOrder.poNumber,
//           totalAmount: purchaseOrder.totalAmount,
//           currency: purchaseOrder.currency,
//           status: purchaseOrder.status,
//           supplierName: purchaseOrder.supplierDetails.name,
//           creationDate: purchaseOrder.createdAt,
//           expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
//           items: purchaseOrder.items
//         },
//         emailSent
//       }
//     });

//   } catch (error) {
//     console.error('Create purchase order error:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message || 'Failed to create purchase order',
//       error: error.message
//     });
//   }
// };

// Create purchase order from selected quote
const createPurchaseOrderFromQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const {
      deliveryAddress,
      expectedDeliveryDate,
      paymentTerms,
      specialInstructions,
      termsAndConditions
    } = req.body;

    const quote = await Quote.findById(quoteId)
      .populate('supplierId', 'fullName email phone supplierDetails')
      .populate('requisitionId', 'title deliveryLocation employee')
      .populate('rfqId', 'title buyerId');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Verify quote is selected
    if (quote.status !== 'selected') {
      return res.status(400).json({
        success: false,
        message: 'Quote must be selected before creating purchase order'
      });
    }

    // Verify buyer owns the RFQ for this quote
    if (quote.rfqId.buyerId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to quote'
      });
    }

    // Check if PO already exists for this quote
    const existingPO = await PurchaseOrder.findOne({ quoteId: quote._id });
    if (existingPO) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order already exists for this quote',
        data: { poNumber: existingPO.poNumber }
      });
    }

    // Generate PO number
    const now = new Date();
    const year = now.getFullYear();
    const count = await PurchaseOrder.countDocuments();
    const poNumber = `PO-${year}-${String(count + 1).padStart(6, '0')}`;

    // Create purchase order
    const purchaseOrder = new PurchaseOrder({
      poNumber,
      quoteId: quote._id,
      requisitionId: quote.requisitionId._id,
      supplierId: quote.supplierId._id,
      buyerId: req.user.userId,

      // Order details
      items: quote.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice || (item.quantity * item.unitPrice),
        specifications: item.specifications
      })),

      totalAmount: quote.totalAmount,
      currency: quote.currency || 'XAF',

      // Delivery and payment
      deliveryAddress: deliveryAddress || quote.requisitionId.deliveryLocation,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : new Date(Date.now() + (quote.deliveryTime?.value || 14) * 24 * 60 * 60 * 1000),
      paymentTerms: paymentTerms || quote.paymentTerms || '30 days',

      // Additional details
      specialInstructions,
      termsAndConditions,

      // Status
      status: 'draft',
      progress: 5,
      currentStage: 'created',

      // Activities
      activities: [{
        type: 'created',
        description: 'Purchase order created from selected quote',
        user: req.user.fullName || 'Buyer',
        timestamp: new Date()
      }],

      // Supplier details (snapshot)
      supplierDetails: {
        name: quote.supplierId.supplierDetails?.companyName || quote.supplierId.fullName,
        email: quote.supplierId.email,
        phone: quote.supplierId.phone,
        address: quote.supplierId.supplierDetails?.address
      },

      createdBy: req.user.userId
    });

    await purchaseOrder.save();

    // Update quote status
    quote.status = 'purchase_order_created';
    quote.purchaseOrderId = purchaseOrder._id;
    await quote.save();

    // Update requisition status
    const requisition = await PurchaseRequisition.findById(quote.requisitionId._id);
    if (requisition) {
      requisition.status = 'procurement_complete';
      if (!requisition.procurementDetails) {
        requisition.procurementDetails = {};
      }
      requisition.procurementDetails.purchaseOrderId = purchaseOrder._id;
      requisition.procurementDetails.finalCost = quote.totalAmount;
      await requisition.save();
    }

    res.json({
      success: true,
      message: 'Purchase order created successfully',
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          totalAmount: purchaseOrder.totalAmount,
          status: purchaseOrder.status,
          supplierName: purchaseOrder.supplierDetails.name,
          creationDate: purchaseOrder.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase order',
      error: error.message
    });
  }
};

// Get purchase orders for buyer
const getPurchaseOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    let query = { buyerId: req.user.userId };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { poNumber: { $regex: search, $options: 'i' } },
        { 'supplierDetails.name': { $regex: search, $options: 'i' } }
      ];
    }

    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('supplierId', 'fullName email phone supplierDetails')
      .populate('requisitionId', 'title requisitionNumber employee')
      .populate('quoteId', 'quoteNumber')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PurchaseOrder.countDocuments(query);

    // Transform to frontend format
    const transformedPOs = purchaseOrders.map(po => ({
      id: po._id,
      poNumber: po.poNumber,
      requisitionId: po.requisitionId?.requisitionNumber || po.requisitionId?._id,
      supplierId: po.supplierId?._id,
      supplierName: po.supplierDetails?.name || po.supplierId?.supplierDetails?.companyName || po.supplierId?.fullName,
      supplierEmail: po.supplierDetails?.email || po.supplierId?.email,
      supplierPhone: po.supplierDetails?.phone || po.supplierId?.phone,
      creationDate: po.createdAt,
      expectedDeliveryDate: po.expectedDeliveryDate,
      status: po.status,
      totalAmount: po.totalAmount,
      currency: po.currency,
      paymentTerms: po.paymentTerms,
      deliveryAddress: po.deliveryAddress,
      progress: po.progress,
      currentStage: po.currentStage,
      items: po.items,
      activities: po.activities,
      deliveryTracking: po.deliveryTracking,
      specialInstructions: po.specialInstructions,
      notes: po.notes
    }));

    res.json({
      success: true,
      data: transformedPOs,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: transformedPOs.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase orders',
      error: error.message
    });
  }
};

// Get purchase order details
const getPurchaseOrderDetails = async (req, res) => {
  try {
    const { poId } = req.params;

    const purchaseOrder = await PurchaseOrder.findById(poId)
      .populate('supplierId', 'fullName email phone supplierDetails')
      .populate('requisitionId', 'title requisitionNumber employee')
      .populate('quoteId', 'quoteNumber')
      .populate('createdBy', 'fullName')
      .populate('lastModifiedBy', 'fullName');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Verify buyer owns this purchase order
    if (purchaseOrder.buyerId.toString() !== req.user.userId) {
      const user = await User.findById(req.user.userId);
      // Allow supply chain and admin users to view
      if (!['admin', 'supply_chain'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to purchase order'
        });
      }
    }

    res.json({
      success: true,
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          requisitionId: purchaseOrder.requisitionId?._id,
          requisitionTitle: purchaseOrder.requisitionId?.title,
          supplierId: purchaseOrder.supplierId?._id,
          supplierName: purchaseOrder.supplierDetails?.name || purchaseOrder.supplierId?.supplierDetails?.companyName || purchaseOrder.supplierId?.fullName,
          supplierEmail: purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email,
          supplierPhone: purchaseOrder.supplierDetails?.phone || purchaseOrder.supplierId?.phone,
          creationDate: purchaseOrder.createdAt,
          expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
          actualDeliveryDate: purchaseOrder.actualDeliveryDate,
          status: purchaseOrder.status,
          totalAmount: purchaseOrder.totalAmount,
          currency: purchaseOrder.currency,
          paymentTerms: purchaseOrder.paymentTerms,
          deliveryAddress: purchaseOrder.deliveryAddress,
          deliveryTerms: purchaseOrder.deliveryTerms,
          progress: purchaseOrder.progress,
          currentStage: purchaseOrder.currentStage,
          items: purchaseOrder.items,
          activities: purchaseOrder.activities,
          deliveryTracking: purchaseOrder.deliveryTracking,
          notes: purchaseOrder.notes,
          internalNotes: purchaseOrder.internalNotes,
          attachments: purchaseOrder.attachments,
          specialInstructions: purchaseOrder.specialInstructions,
          termsAndConditions: purchaseOrder.termsAndConditions,
          performanceMetrics: purchaseOrder.performanceMetrics,
          createdBy: purchaseOrder.createdBy?.fullName,
          lastModifiedBy: purchaseOrder.lastModifiedBy?.fullName,
          lastModifiedDate: purchaseOrder.lastModifiedDate
        }
      }
    });

  } catch (error) {
    console.error('Get purchase order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase order details',
      error: error.message
    });
  }
};

// Update purchase order
const updatePurchaseOrder = async (req, res) => {
  try {
    const { poId } = req.params;
    const updates = req.body;

    const purchaseOrder = await PurchaseOrder.findById(poId);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Verify buyer owns this purchase order
    if (purchaseOrder.buyerId.toString() !== req.user.userId) {
      const user = await User.findById(req.user.userId);
      if (!['admin', 'supply_chain'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to purchase order'
        });
      }
    }

    // Don't allow updates to sent or completed purchase orders
    if (['sent_to_supplier', 'acknowledged', 'delivered', 'completed', 'cancelled'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update purchase order in current status'
      });
    }

    // Update purchase order
    const allowedUpdates = [
      'expectedDeliveryDate',
      'deliveryAddress',
      'paymentTerms',
      'specialInstructions',
      'notes',
      'internalNotes'
    ];

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        if (key === 'expectedDeliveryDate' && updates[key]) {
          purchaseOrder[key] = new Date(updates[key]);
        } else {
          purchaseOrder[key] = updates[key];
        }
      }
    });

    purchaseOrder.lastModifiedBy = req.user.userId;
    purchaseOrder.lastModifiedDate = new Date();

    // Add activity
    purchaseOrder.activities.push({
      type: 'updated',
      description: 'Purchase order updated',
      user: req.user.fullName || 'Buyer',
      timestamp: new Date()
    });

    await purchaseOrder.save();

    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: purchaseOrder.status,
          lastModifiedDate: purchaseOrder.lastModifiedDate
        }
      }
    });

  } catch (error) {
    console.error('Update purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update purchase order',
      error: error.message
    });
  }
};

// Send purchase order to supplier
const sendPurchaseOrderToSupplier = async (req, res) => {
  try {
    const { poId } = req.params;
    const { message } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(poId)
      .populate('supplierId', 'fullName email supplierDetails')
      .populate('requisitionId', 'title');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Verify buyer owns this purchase order
    if (purchaseOrder.buyerId.toString() !== req.user.userId) {
      const user = await User.findById(req.user.userId);
      if (!['admin', 'supply_chain'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to purchase order'
        });
      }
    }

    // Only allow sending draft or approved purchase orders
    if (!['draft', 'approved'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order has already been sent or is not in sendable status'
      });
    }

    // Get user details for email
    const user = await User.findById(req.user.userId);

    // Send email to supplier
    try {
      const supplierEmail = purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email;
      const supplierName = purchaseOrder.supplierDetails?.name || 
                          purchaseOrder.supplierId?.supplierDetails?.companyName || 
                          purchaseOrder.supplierId?.fullName;

      await sendEmail({
        to: supplierEmail,
        subject: `Purchase Order - ${purchaseOrder.poNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
            <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
              <h2 style="color: #1890ff; margin-top: 0;">Purchase Order</h2>
              <p>Dear ${supplierName},</p>
              <p>Please find below the official purchase order:</p>

              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Order Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">PO Number:</td>
                    <td style="padding: 8px 0;">${purchaseOrder.poNumber}</td>
                  </tr>
                  ${purchaseOrder.requisitionId?.title ? `
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Project:</td>
                    <td style="padding: 8px 0;">${purchaseOrder.requisitionId.title}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Total Amount:</td>
                    <td style="padding: 8px 0; color: #1890ff; font-weight: bold; font-size: 18px;">
                      ${purchaseOrder.currency} ${purchaseOrder.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Expected Delivery:</td>
                    <td style="padding: 8px 0;">${new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Payment Terms:</td>
                    <td style="padding: 8px 0;">${purchaseOrder.paymentTerms}</td>
                  </tr>
                </table>
              </div>

              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Items Ordered</h3>
                <table border="1" style="border-collapse: collapse; width: 100%; border: 1px solid #ddd;">
                  <thead>
                    <tr style="background-color: #f5f5f5;">
                      <th style="padding: 10px; text-align: left;">Description</th>
                      <th style="padding: 10px; text-align: center;">Quantity</th>
                      <th style="padding: 10px; text-align: right;">Unit Price</th>
                      <th style="padding: 10px; text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${purchaseOrder.items.map(item => `
                      <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">
                          ${item.description}
                          ${item.specifications ? `<br><small style="color: #666;">${item.specifications}</small>` : ''}
                        </td>
                        <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">
                          ${purchaseOrder.currency} ${item.unitPrice.toLocaleString()}
                        </td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">
                          ${purchaseOrder.currency} ${item.totalPrice.toLocaleString()}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #f5f5f5; font-weight: bold;">
                      <td colspan="3" style="padding: 10px; text-align: right;">Total Amount:</td>
                      <td style="padding: 10px; text-align: right; color: #1890ff;">
                        ${purchaseOrder.currency} ${purchaseOrder.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style="background-color: #fff7e6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #faad14;">Delivery Instructions</h4>
                <p><strong>Delivery Address:</strong><br>${purchaseOrder.deliveryAddress}</p>
                <p><strong>Expected Delivery Date:</strong> ${new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString('en-GB')}</p>
                ${purchaseOrder.specialInstructions ? `<p><strong>Special Instructions:</strong><br>${purchaseOrder.specialInstructions}</p>` : ''}
              </div>

              ${message ? `
              <div style="background-color: #f6ffed; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #52c41a;">Additional Message</h4>
                <p>${message}</p>
              </div>
              ` : ''}

              <div style="margin: 20px 0; padding: 15px; background-color: white; border-radius: 8px;">
                <p><strong>Next Steps:</strong></p>
                <ul>
                  <li>Please confirm receipt of this purchase order</li>
                  <li>Provide updated delivery timeline if different from expected date</li>
                  <li>Notify us immediately of any issues or concerns</li>
                  <li>Send delivery confirmation with tracking details when items are dispatched</li>
                </ul>
              </div>

              <p>Thank you for your service. We look forward to a successful delivery.</p>
              <p>Best regards,<br>${user.fullName}<br>Procurement Team</p>
            </div>
          </div>
        `
      });

      // Update purchase order status
      purchaseOrder.status = 'sent_to_supplier';
      purchaseOrder.sentDate = new Date();
      purchaseOrder.progress = 25;
      purchaseOrder.currentStage = 'supplier_acknowledgment';

      purchaseOrder.activities.push({
        type: 'sent',
        description: 'Purchase order sent to supplier',
        user: user.fullName || 'Buyer',
        timestamp: new Date()
      });

      await purchaseOrder.save();

    } catch (emailError) {
      console.error('Failed to send purchase order to supplier:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send purchase order to supplier'
      });
    }

    res.json({
      success: true,
      message: 'Purchase order sent to supplier successfully',
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: purchaseOrder.status,
          sentDate: purchaseOrder.sentDate
        }
      }
    });

  } catch (error) {
    console.error('Send purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send purchase order',
      error: error.message
    });
  }
};

// Cancel purchase order
const cancelPurchaseOrder = async (req, res) => {
  try {
    const { poId } = req.params;
    const { cancellationReason } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(poId)
      .populate('supplierId', 'fullName email supplierDetails');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Verify buyer owns this purchase order
    if (purchaseOrder.buyerId.toString() !== req.user.userId) {
      const user = await User.findById(req.user.userId);
      if (!['admin', 'supply_chain'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to purchase order'
        });
      }
    }

    // Don't allow cancellation of completed or delivered orders
    if (['completed', 'delivered'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed or delivered purchase order'
      });
    }

    // Update purchase order status
    purchaseOrder.status = 'cancelled';
    purchaseOrder.cancellationReason = cancellationReason;
    purchaseOrder.cancelledDate = new Date();

    const user = await User.findById(req.user.userId);
    purchaseOrder.activities.push({
      type: 'cancelled',
      description: `Purchase order cancelled: ${cancellationReason}`,
      user: user.fullName || 'Buyer',
      timestamp: new Date()
    });

    await purchaseOrder.save();

    // Notify supplier if order was already sent
    if (purchaseOrder.sentDate) {
      try {
        const supplierEmail = purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email;
        const supplierName = purchaseOrder.supplierDetails?.name || 
                            purchaseOrder.supplierId?.supplierDetails?.companyName || 
                            purchaseOrder.supplierId?.fullName;

        await sendEmail({
          to: supplierEmail,
          subject: `Purchase Order Cancelled - ${purchaseOrder.poNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #fff2f0; padding: 20px; border-radius: 8px; border-left: 4px solid #ff4d4f;">
                <h2 style="color: #ff4d4f; margin-top: 0;">Purchase Order Cancellation</h2>
                <p>Dear ${supplierName},</p>
                <p>We regret to inform you that Purchase Order ${purchaseOrder.poNumber} has been cancelled.</p>

                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p><strong>PO Number:</strong> ${purchaseOrder.poNumber}</p>
                  <p><strong>Original Amount:</strong> ${purchaseOrder.currency} ${purchaseOrder.totalAmount.toLocaleString()}</p>
                  <p><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
                  ${cancellationReason ? `<p><strong>Reason:</strong> ${cancellationReason}</p>` : ''}
                </div>

                <p>Please disregard this purchase order and do not proceed with any deliveries.</p>
                <p>We apologize for any inconvenience this may cause and appreciate your understanding.</p>

                <p>Best regards,<br>${user.fullName}<br>Procurement Team</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to notify supplier of cancellation:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: {
        purchaseOrder: {
          id: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
          status: purchaseOrder.status,
          cancelledDate: purchaseOrder.cancelledDate
        }
      }
    });

  } catch (error) {
    console.error('Cancel purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel purchase order',
      error: error.message
    });
  }
};

// Download purchase order as PDF
const downloadPurchaseOrderPDF = async (req, res) => {
  try {
    const { poId } = req.params;

    console.log(`Generating PDF for PO: ${poId}`);

    const purchaseOrder = await PurchaseOrder.findById(poId)
      .populate('supplierId', 'fullName email phone supplierDetails')
      .populate('requisitionId', 'title requisitionNumber employee')
      .populate('quoteId', 'quoteNumber')
      .populate('createdBy', 'fullName')
      .populate('items.itemId', 'code description category unitOfMeasure');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Verify buyer owns this purchase order
    if (purchaseOrder.buyerId.toString() !== req.user.userId) {
      const user = await User.findById(req.user.userId);
      // Allow supply chain and admin users to download
      if (!['admin', 'supply_chain'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to purchase order'
        });
      }
    }

    // Helper function to safely convert to number
    const safeNumber = (value, defaultValue = 0) => {
      if (value === null || value === undefined || value === '') {
        return defaultValue;
      }
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    };

    // Calculate tax information if not present
    const taxApplicable = Boolean(purchaseOrder.taxApplicable);
    const taxRate = safeNumber(purchaseOrder.taxRate, 0);
    const totalAmount = safeNumber(purchaseOrder.totalAmount, 0);
    const taxAmount = safeNumber(purchaseOrder.taxAmount, 0);
    
    // Calculate subtotal if not present
    let subtotalAmount = safeNumber(purchaseOrder.subtotalAmount, 0);
    if (subtotalAmount === 0 && totalAmount > 0) {
      if (taxApplicable && taxRate > 0) {
        // If tax is applied, subtract tax from total to get subtotal
        subtotalAmount = totalAmount - taxAmount;
      } else {
        // If no tax, subtotal equals total
        subtotalAmount = totalAmount;
      }
    }

    // Prepare data for PDF generation with all required tax fields
    const pdfData = {
      id: purchaseOrder._id,
      poNumber: purchaseOrder.poNumber,
      requisitionId: purchaseOrder.requisitionId?._id,
      requisitionTitle: purchaseOrder.requisitionId?.title,

      // Supplier details from multiple sources
      supplierDetails: {
        name: purchaseOrder.supplierDetails?.name || 
              purchaseOrder.supplierId?.supplierDetails?.companyName || 
              purchaseOrder.supplierId?.fullName,
        email: purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email,
        phone: purchaseOrder.supplierDetails?.phone || purchaseOrder.supplierId?.phone,
        address: purchaseOrder.supplierDetails?.address || 
                 purchaseOrder.supplierId?.supplierDetails?.address,
        businessType: purchaseOrder.supplierDetails?.businessType || 
                      purchaseOrder.supplierId?.supplierDetails?.businessType
      },

      // Order details with safe number conversion
      creationDate: purchaseOrder.createdAt,
      expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
      actualDeliveryDate: purchaseOrder.actualDeliveryDate,
      status: purchaseOrder.status,
      
      // Financial details with proper tax handling
      totalAmount: totalAmount,
      subtotalAmount: subtotalAmount,
      taxApplicable: taxApplicable,
      taxRate: taxRate,
      taxAmount: taxAmount,
      currency: purchaseOrder.currency || 'XAF',
      
      paymentTerms: purchaseOrder.paymentTerms,
      deliveryAddress: purchaseOrder.deliveryAddress,
      deliveryTerms: purchaseOrder.deliveryTerms,

      // Items with enhanced details and safe number conversion
      items: (purchaseOrder.items || []).map(item => {
        const quantity = safeNumber(item.quantity, 0);
        const unitPrice = safeNumber(item.unitPrice, 0);
        const totalPrice = safeNumber(item.totalPrice, quantity * unitPrice);
        const discount = safeNumber(item.discount, 0);

        return {
          description: item.description || 'No description',
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          discount: discount,
          specifications: item.specifications,
          itemCode: item.itemCode || (item.itemId ? item.itemId.code : ''),
          category: item.category || (item.itemId ? item.itemId.category : ''),
          unitOfMeasure: item.unitOfMeasure || (item.itemId ? item.itemId.unitOfMeasure : 'Units')
        };
      }),

      // Additional details
      specialInstructions: purchaseOrder.specialInstructions || '',
      notes: purchaseOrder.notes || '',
      termsAndConditions: purchaseOrder.termsAndConditions || '',

      // Progress and activities
      progress: purchaseOrder.progress,
      currentStage: purchaseOrder.currentStage,
      activities: purchaseOrder.activities || [],

      // Legacy compatibility
      supplierName: purchaseOrder.supplierDetails?.name || 
                   purchaseOrder.supplierId?.supplierDetails?.companyName || 
                   purchaseOrder.supplierId?.fullName || 'Unknown Supplier',
      supplierEmail: purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email || '',
      supplierPhone: purchaseOrder.supplierDetails?.phone || purchaseOrder.supplierId?.phone || ''
    };

    console.log('PDF Data prepared with tax info:', {
      poNumber: pdfData.poNumber,
      supplierName: pdfData.supplierDetails.name,
      itemsCount: pdfData.items.length,
      totalAmount: pdfData.totalAmount,
      subtotalAmount: pdfData.subtotalAmount,
      taxApplicable: pdfData.taxApplicable,
      taxRate: pdfData.taxRate,
      taxAmount: pdfData.taxAmount,
      itemsWithNumbers: pdfData.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }))
    });

    // Validate critical data before PDF generation
    if (!pdfData.poNumber) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order number is missing'
      });
    }

    if (!pdfData.supplierDetails.name && !pdfData.supplierName) {
      return res.status(400).json({
        success: false,
        message: 'Supplier information is missing'
      });
    }

    if (!Array.isArray(pdfData.items) || pdfData.items.length === 0) {
      console.warn('No items found in purchase order, creating empty items array');
      pdfData.items = [{
        description: 'No items specified',
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
        discount: 0,
        unitOfMeasure: 'Units'
      }];
    }

    // Generate PDF
    const pdfResult = await pdfService.generatePurchaseOrderPDF(pdfData);

    if (!pdfResult.success) {
      console.error('PDF generation failed:', pdfResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
        error: pdfResult.error
      });
    }

    console.log('PDF generated successfully:', pdfResult.filename);

    // Set response headers for PDF download
    const filename = `PO_${purchaseOrder.poNumber}_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfResult.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the PDF buffer
    res.send(pdfResult.buffer);

    console.log(`PDF download completed for PO: ${purchaseOrder.poNumber}`);

  } catch (error) {
    console.error('Download purchase order PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF download',
      error: error.message
    });
  }
};

// Preview purchase order as PDF (inline viewing)
const previewPurchaseOrderPDF = async (req, res) => {
  try {
    const { poId } = req.params;

    const purchaseOrder = await PurchaseOrder.findById(poId)
      .populate('supplierId', 'fullName email phone supplierDetails')
      .populate('requisitionId', 'title requisitionNumber employee')
      .populate('items.itemId', 'code description category unitOfMeasure');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Authorization check
    if (purchaseOrder.buyerId.toString() !== req.user.userId) {
      const user = await User.findById(req.user.userId);
      if (!['admin', 'supply_chain'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to purchase order'
        });
      }
    }

    // Prepare data (same as download function)
    const pdfData = {
      id: purchaseOrder._id,
      poNumber: purchaseOrder.poNumber,
      requisitionTitle: purchaseOrder.requisitionId?.title,
      supplierDetails: {
        name: purchaseOrder.supplierDetails?.name || 
              purchaseOrder.supplierId?.supplierDetails?.companyName || 
              purchaseOrder.supplierId?.fullName,
        email: purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email,
        phone: purchaseOrder.supplierDetails?.phone || purchaseOrder.supplierId?.phone,
        address: purchaseOrder.supplierDetails?.address,
        businessType: purchaseOrder.supplierDetails?.businessType
      },
      creationDate: purchaseOrder.createdAt,
      expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
      status: purchaseOrder.status,
      totalAmount: purchaseOrder.totalAmount,
      currency: purchaseOrder.currency,
      paymentTerms: purchaseOrder.paymentTerms,
      deliveryAddress: purchaseOrder.deliveryAddress,
      items: purchaseOrder.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice || (item.quantity * item.unitPrice),
        specifications: item.specifications,
        itemCode: item.itemCode,
        category: item.category,
        unitOfMeasure: item.unitOfMeasure
      })),
      specialInstructions: purchaseOrder.specialInstructions,
      notes: purchaseOrder.notes
    };

    // Generate PDF
    const pdfResult = await pdfService.generatePurchaseOrderPDF(pdfData);

    if (!pdfResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF preview',
        error: pdfResult.error
      });
    }

    // Set headers for inline viewing
    const filename = `PO_${purchaseOrder.poNumber}_preview.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfResult.buffer.length);

    // Send PDF for inline viewing
    res.send(pdfResult.buffer);

  } catch (error) {
    console.error('Preview purchase order PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF preview',
      error: error.message
    });
  }
};

// Generate and email PDF to supplier or internal team
const emailPurchaseOrderPDF = async (req, res) => {
  try {
    const { poId } = req.params;
    const { emailTo, emailType = 'supplier', message = '' } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(poId)
      .populate('supplierId', 'fullName email phone supplierDetails')
      .populate('requisitionId', 'title requisitionNumber employee')
      .populate('items.itemId', 'code description category unitOfMeasure');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Authorization check
    if (purchaseOrder.buyerId.toString() !== req.user.userId) {
      const user = await User.findById(req.user.userId);
      if (!['admin', 'supply_chain'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to purchase order'
        });
      }
    }

    // Prepare PDF data
    const pdfData = {
      poNumber: purchaseOrder.poNumber,
      supplierDetails: {
        name: purchaseOrder.supplierDetails?.name || 
              purchaseOrder.supplierId?.fullName,
        email: purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email,
        phone: purchaseOrder.supplierDetails?.phone || purchaseOrder.supplierId?.phone,
        address: purchaseOrder.supplierDetails?.address
      },
      creationDate: purchaseOrder.createdAt,
      expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
      status: purchaseOrder.status,
      totalAmount: purchaseOrder.totalAmount,
      currency: purchaseOrder.currency,
      paymentTerms: purchaseOrder.paymentTerms,
      deliveryAddress: purchaseOrder.deliveryAddress,
      items: purchaseOrder.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice || (item.quantity * item.unitPrice),
        specifications: item.specifications
      })),
      specialInstructions: purchaseOrder.specialInstructions
    };

    // Generate PDF
    const pdfResult = await pdfService.generatePurchaseOrderPDF(pdfData);

    if (!pdfResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF for email',
        error: pdfResult.error
      });
    }

    // Get user details
    const user = await User.findById(req.user.userId);

    // Determine recipient
    const recipientEmail = emailTo || purchaseOrder.supplierDetails?.email || purchaseOrder.supplierId?.email;
    const recipientName = emailType === 'supplier' ? 
      purchaseOrder.supplierDetails?.name : 
      'Team';

    // Send email with PDF attachment
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Purchase Order ${purchaseOrder.poNumber} - PDF Document`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Purchase Order Document</h2>
          <p>Dear ${recipientName},</p>
          <p>Please find attached the PDF document for Purchase Order ${purchaseOrder.poNumber}.</p>

          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>PO Number:</strong> ${purchaseOrder.poNumber}</p>
            <p><strong>Total Amount:</strong> ${purchaseOrder.currency} ${purchaseOrder.totalAmount.toLocaleString()}</p>
            <p><strong>Expected Delivery:</strong> ${new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString('en-GB')}</p>
          </div>

          ${message ? `<p><strong>Additional Message:</strong></p><p>${message}</p>` : ''}

          <p>Best regards,<br>${user.fullName}<br>Procurement Team</p>
        </div>
      `,
      attachments: [{
        filename: pdfResult.filename,
        content: pdfResult.buffer,
        contentType: 'application/pdf'
      }]
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email with PDF attachment',
        error: emailResult.error
      });
    }

    res.json({
      success: true,
      message: `Purchase order PDF sent successfully to ${recipientEmail}`,
      data: {
        poNumber: purchaseOrder.poNumber,
        sentTo: recipientEmail,
        filename: pdfResult.filename
      }
    });

  } catch (error) {
    console.error('Email purchase order PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to email PDF',
      error: error.message
    });
  }
};

// Bulk download multiple POs as ZIP file
const bulkDownloadPurchaseOrders = async (req, res) => {
  try {
    const { poIds } = req.body;

    if (!poIds || !Array.isArray(poIds) || poIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order IDs are required'
      });
    }

    if (poIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Cannot download more than 50 purchase orders at once'
      });
    }

    const purchaseOrders = await PurchaseOrder.find({
      _id: { $in: poIds },
      buyerId: req.user.userId
    })
    .populate('supplierId', 'fullName email phone supplierDetails')
    .populate('requisitionId', 'title requisitionNumber')
    .populate('items.itemId', 'code description category unitOfMeasure');

    if (purchaseOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid purchase orders found'
      });
    }

    // Generate PDFs for all orders
    const pdfPromises = purchaseOrders.map(async (po) => {
      const pdfData = {
        poNumber: po.poNumber,
        supplierDetails: {
          name: po.supplierDetails?.name || po.supplierId?.fullName,
          email: po.supplierDetails?.email || po.supplierId?.email,
          phone: po.supplierDetails?.phone || po.supplierId?.phone,
          address: po.supplierDetails?.address
        },
        creationDate: po.createdAt,
        expectedDeliveryDate: po.expectedDeliveryDate,
        status: po.status,
        totalAmount: po.totalAmount,
        currency: po.currency,
        paymentTerms: po.paymentTerms,
        deliveryAddress: po.deliveryAddress,
        items: po.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice || (item.quantity * item.unitPrice),
          specifications: item.specifications
        })),
        specialInstructions: po.specialInstructions
      };

      const pdfResult = await pdfService.generatePurchaseOrderPDF(pdfData);
      return {
        poNumber: po.poNumber,
        filename: `PO_${po.poNumber}.pdf`,
        buffer: pdfResult.success ? pdfResult.buffer : null,
        success: pdfResult.success
      };
    });

    const pdfResults = await Promise.all(pdfPromises);
    const successfulPDFs = pdfResults.filter(pdf => pdf.success && pdf.buffer);

    if (successfulPDFs.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate any PDFs'
      });
    }

    // Create ZIP file
    const zipFilename = `Purchase_Orders_${new Date().toISOString().split('T')[0]}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('ZIP creation error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to create ZIP file'
        });
      }
    });

    archive.pipe(res);

    // Add each PDF to the ZIP
    successfulPDFs.forEach(pdf => {
      archive.append(pdf.buffer, { name: pdf.filename });
    });

    await archive.finalize();

  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to create bulk download',
        error: error.message
      });
    }
  }
};

module.exports = {
  getSuppliers,
  validatePOItems,
  createPurchaseOrder,
  createPurchaseOrderFromQuote,
  getPurchaseOrders,
  getPurchaseOrderDetails,
  updatePurchaseOrder,
  sendPurchaseOrderToSupplier,
  cancelPurchaseOrder,
  downloadPurchaseOrderPDF,
  previewPurchaseOrderPDF,
  emailPurchaseOrderPDF,
  bulkDownloadPurchaseOrders
};




