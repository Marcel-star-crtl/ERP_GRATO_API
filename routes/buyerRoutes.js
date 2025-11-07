const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');

// Import controllers
const buyerRequisitionController = require('../controllers/buyerRequisitionController');
const buyerPurchaseOrderController = require('../controllers/buyerPurchaseOrderController');
const buyerDeliveryController = require('../controllers/buyerDeliveryController');

// Middleware to ensure only buyers, supply_chain users, and admins can access
const buyerAuthMiddleware = requireRoles('buyer', 'supply_chain', 'admin');


// Get all purchase orders for buyer
router.get('/purchase-orders', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.getPurchaseOrders
);

// Get specific purchase order details
router.get('/purchase-orders/:poId', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.getPurchaseOrderDetails
);

// Create purchase order 
router.post('/purchase-orders', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.createPurchaseOrder
);

// Update purchase order
router.put('/purchase-orders/:poId', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.updatePurchaseOrder
);

// Send purchase order to supplier
router.post('/purchase-orders/:poId/send', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.sendPurchaseOrderToSupplier
);

// Cancel purchase order
router.post('/purchase-orders/:poId/cancel', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.cancelPurchaseOrder
);

// Create purchase order from quote (alternative endpoint)
router.post('/quotes/:quoteId/create-purchase-order', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.createPurchaseOrderFromQuote
);


router.get('/purchase-orders/:poId/download-pdf', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.downloadPurchaseOrderPDF
);


router.get('/purchase-orders/:poId/preview-pdf', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.previewPurchaseOrderPDF
);


router.post('/purchase-orders/:poId/email-pdf', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.emailPurchaseOrderPDF
);


router.post('/purchase-orders/bulk-download', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.bulkDownloadPurchaseOrders
);

// Get purchase order details for PDF generation (internal use)
router.get('/purchase-orders/:poId/pdf-data', 
  authMiddleware, 
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const { poId } = req.params;
      const PurchaseOrder = require('../models/PurchaseOrder');
      const User = require('../models/User');

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

      // Return formatted data suitable for PDF generation
      const pdfData = {
        id: purchaseOrder._id,
        poNumber: purchaseOrder.poNumber,
        requisitionId: purchaseOrder.requisitionId?._id,
        requisitionTitle: purchaseOrder.requisitionId?.title,

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

        creationDate: purchaseOrder.createdAt,
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrder.actualDeliveryDate,
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
          itemCode: item.itemCode || (item.itemId ? item.itemId.code : ''),
          category: item.category || (item.itemId ? item.itemId.category : ''),
          unitOfMeasure: item.unitOfMeasure || (item.itemId ? item.itemId.unitOfMeasure : '')
        })),

        specialInstructions: purchaseOrder.specialInstructions,
        notes: purchaseOrder.notes,
        progress: purchaseOrder.progress,
        currentStage: purchaseOrder.currentStage,
        activities: purchaseOrder.activities
      };

      res.json({
        success: true,
        data: pdfData
      });

    } catch (error) {
      console.error('Get PDF data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch purchase order data for PDF',
        error: error.message
      });
    }
  }
);

// Validate purchase order IDs for bulk operations
router.post('/purchase-orders/validate-bulk', 
  authMiddleware, 
  buyerAuthMiddleware,
  async (req, res) => {
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
          message: 'Cannot process more than 50 purchase orders at once'
        });
      }

      const PurchaseOrder = require('../models/PurchaseOrder');

      const purchaseOrders = await PurchaseOrder.find({
        _id: { $in: poIds },
        buyerId: req.user.userId
      })
      .select('poNumber status totalAmount currency supplierDetails.name createdAt');

      const validPoIds = purchaseOrders.map(po => po._id.toString());
      const invalidPoIds = poIds.filter(id => !validPoIds.includes(id));

      res.json({
        success: true,
        data: {
          validPurchaseOrders: purchaseOrders.map(po => ({
            id: po._id,
            poNumber: po.poNumber,
            status: po.status,
            totalAmount: po.totalAmount,
            currency: po.currency,
            supplierName: po.supplierDetails?.name,
            creationDate: po.createdAt
          })),
          invalidPoIds,
          validCount: validPoIds.length,
          invalidCount: invalidPoIds.length,
          totalSelected: poIds.length
        }
      });

    } catch (error) {
      console.error('Validate bulk POs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate purchase orders',
        error: error.message
      });
    }
  }
);

// Get suppliers for PO creation
router.get('/suppliers', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.getSuppliers
);

// Get specific supplier details
router.get('/suppliers/:supplierId', 
  authMiddleware, 
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      const Supplier = require('../models/Supplier');

      const supplier = await Supplier.findById(supplierId)
        .select('name email phone address businessType categories performance bankDetails documents certifications');

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        });
      }

      res.json({
        success: true,
        data: supplier
      });

    } catch (error) {
      console.error('Get supplier details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch supplier details',
        error: error.message
      });
    }
  }
);

// =============================================
// ITEMS VALIDATION ROUTES  
// =============================================

// Validate items for PO creation
router.post('/purchase-orders/validate-items', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerPurchaseOrderController.validatePOItems
);

// Get items for PO creation (active items from database)
router.get('/items', 
  authMiddleware, 
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const { search, category, limit = 50 } = req.query;
      const Item = require('../models/Item');

      let query = { isActive: true };

      if (search) {
        query.$or = [
          { description: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { specifications: { $regex: search, $options: 'i' } }
        ];
      }

      if (category && category !== 'all') {
        query.category = category;
      }

      const items = await Item.find(query)
        .select('code description category subcategory unitOfMeasure standardPrice specifications')
        .sort({ category: 1, description: 1 })
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: items
      });

    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch items',
        error: error.message
      });
    }
  }
);

// Get item categories for filtering
router.get('/items/categories', 
  authMiddleware, 
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const Item = require('../models/Item');

      const categories = await Item.distinct('category', { isActive: true });

      res.json({
        success: true,
        data: categories.sort()
      });

    } catch (error) {
      console.error('Get item categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch item categories',
        error: error.message
      });
    }
  }
);

// Search items for autocomplete
router.get('/items/search', 
  authMiddleware, 
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters'
        });
      }

      const Item = require('../models/Item');

      const items = await Item.find({
        isActive: true,
        $or: [
          { description: { $regex: q, $options: 'i' } },
          { code: { $regex: q, $options: 'i' } }
        ]
      })
      .select('_id code description category unitOfMeasure standardPrice')
      .limit(parseInt(limit))
      .sort({ description: 1 });

      res.json({
        success: true,
        data: items
      });

    } catch (error) {
      console.error('Search items error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search items',
        error: error.message
      });
    }
  }
);

// =============================================
// PURCHASE REQUISITION ROUTES
// =============================================

// Get assigned requisitions for buyer
router.get('/requisitions', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.getAssignedRequisitions
);

// Get specific requisition details
router.get('/requisitions/:requisitionId', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.getRequisitionDetails
);

// Start sourcing process for requisition
router.post('/requisitions/:requisitionId/start-sourcing', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.startSourcing
);

// Create RFQ for requisition
router.post('/requisitions/:requisitionId/rfq', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.startSourcing
);

// Get RFQ details for requisition
router.get('/requisitions/:requisitionId/rfq', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.getRFQDetails || ((req, res) => {
    res.status(501).json({ 
      success: false, 
      message: 'RFQ details endpoint not implemented yet' 
    });
  })
);

// =============================================
// QUOTE MANAGEMENT ROUTES
// =============================================

// Get quotes for a requisition
router.get('/requisitions/:requisitionId/quotes', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.getQuotes
);

// Evaluate quotes for a requisition
router.post('/requisitions/:requisitionId/quotes/evaluate', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.evaluateQuotes
);

// Select a quote
router.post('/requisitions/:requisitionId/quotes/:quoteId/select', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.selectQuote
);

// Reject a quote
router.post('/requisitions/:requisitionId/quotes/:quoteId/reject', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.rejectQuote
);

// Request clarification on a quote
router.post('/requisitions/:requisitionId/quotes/:quoteId/clarify', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.requestQuoteClarification
);

// =============================================
// DELIVERY MANAGEMENT ROUTES
// =============================================

// Get deliveries for buyer
router.get('/deliveries', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerDeliveryController?.getDeliveries || ((req, res) => {
    res.status(501).json({ 
      success: false, 
      message: 'Deliveries endpoint not implemented yet' 
    });
  })
);

// Confirm delivery receipt
router.post('/deliveries/:deliveryId/confirm', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerDeliveryController?.confirmDelivery || ((req, res) => {
    res.status(501).json({ 
      success: false, 
      message: 'Confirm delivery endpoint not implemented yet' 
    });
  })
);

// Report delivery issues
router.post('/deliveries/:deliveryId/report-issue', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerDeliveryController?.reportDeliveryIssue || ((req, res) => {
    res.status(501).json({ 
      success: false, 
      message: 'Report delivery issue endpoint not implemented yet' 
    });
  })
);


// Get buyer dashboard data
router.get('/dashboard', 
  authMiddleware, 
  buyerAuthMiddleware,
  buyerRequisitionController.getBuyerDashboard
);

// Get buyer analytics
router.get('/analytics', 
  authMiddleware, 
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const { period = '30d' } = req.query;
      const PurchaseOrder = require('../models/PurchaseOrder');
      const PurchaseRequisition = require('../models/PurchaseRequisition');

      // Calculate date range based on period
      const now = new Date();
      let startDate;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get purchase order analytics
      const poAnalytics = await PurchaseOrder.aggregate([
        { 
          $match: { 
            buyerId: req.user.userId, 
            createdAt: { $gte: startDate } 
          } 
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$totalAmount' }
          }
        }
      ]);

      // Get requisition analytics
      const reqAnalytics = await PurchaseRequisition.aggregate([
        { 
          $match: { 
            assignedBuyerId: req.user.userId, 
            createdAt: { $gte: startDate } 
          } 
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          period,
          purchaseOrders: poAnalytics,
          requisitions: reqAnalytics,
          summary: {
            totalPOs: poAnalytics.reduce((sum, item) => sum + item.count, 0),
            totalValue: poAnalytics.reduce((sum, item) => sum + item.totalValue, 0),
            totalRequisitions: reqAnalytics.reduce((sum, item) => sum + item.count, 0)
          }
        }
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
        error: error.message
      });
    }
  }
);

// =============================================
// ERROR HANDLING MIDDLEWARE
// =============================================

// Handle PDF-specific errors
router.use((error, req, res, next) => {
  // PDF generation errors
  if (error.name === 'PDFGenerationError') {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate PDF document',
      error: error.message,
      details: 'Please try again or contact support if the issue persists'
    });
  }

  // File size errors
  if (error.name === 'FileSizeError') {
    return res.status(413).json({
      success: false,
      message: 'File size too large for processing',
      error: error.message
    });
  }

  // ZIP creation errors
  if (error.name === 'ZipCreationError') {
    return res.status(500).json({
      success: false,
      message: 'Failed to create ZIP archive',
      error: error.message
    });
  }

  // Email sending errors
  if (error.name === 'EmailError') {
    return res.status(500).json({
      success: false,
      message: 'Failed to send email with PDF attachment',
      error: error.message
    });
  }

  next(error);
});

// =============================================
// ROUTE PARAMETER VALIDATION
// =============================================

// Validate purchase order ID parameter
router.param('poId', async (req, res, next, poId) => {
  try {
    // Basic MongoDB ObjectId validation
    if (!poId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase order ID format'
      });
    }

    req.poId = poId;
    next();
  } catch (error) {
    next(error);
  }
});

// Validate requisition ID parameter
router.param('requisitionId', async (req, res, next, requisitionId) => {
  try {
    // Basic MongoDB ObjectId validation
    if (!requisitionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid requisition ID format'
      });
    }

    req.requisitionId = requisitionId;
    next();
  } catch (error) {
    next(error);
  }
});

router.get(
  '/petty-cash-forms', 
  buyerRequisitionController.getPettyCashForms
);
router.get(
  '/petty-cash-forms/:formId', 
  buyerRequisitionController.getPettyCashFormDetails
);
router.get(
  '/petty-cash-forms/:formId/download', 
  buyerRequisitionController.downloadPettyCashFormPDF
);

// Validate supplier ID parameter
router.param('supplierId', async (req, res, next, supplierId) => {
  try {
    // Basic MongoDB ObjectId validation
    if (!supplierId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid supplier ID format'
      });
    }

    req.supplierId = supplierId;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = router;


