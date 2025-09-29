const Contract = require('../models/Contract');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { uploadFile, deleteFile } = require('../services/fileUploadService');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');


exports.createContract = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      category,
      supplierId,
      supplierName,
      contactPerson,
      contactEmail,
      contactPhone,
      totalValue,
      currency,
      paymentTerms,
      deliveryTerms,
      startDate,
      endDate,
      department,
      contractManager,
      priority,
      isRenewable,
      autoRenewal,
      renewalPeriod,
      renewalNotificationDays,
      milestones,
      internalNotes
    } = req.body;

    // Validate required fields
    if (!title || !description || !type || !category || !supplierId || !totalValue || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check if supplier exists
    const supplier = await User.findById(supplierId);
    if (!supplier || supplier.role !== 'supplier') {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if contract manager exists
    if (contractManager) {
      const manager = await User.findById(contractManager);
      if (!manager) {
        return res.status(404).json({
          success: false,
          message: 'Contract manager not found'
        });
      }
    }

    // Process uploaded documents
    const documents = [];
    if (req.files && req.files.contractDocuments) {
      for (const file of req.files.contractDocuments) {
        try {
          const uploadResult = await uploadFile(file, 'contract-documents');
          
          documents.push({
            name: file.originalname,
            type: this.getDocumentType(file.originalname),
            filename: uploadResult.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            uploadedBy: req.user.userId
          });
        } catch (uploadError) {
          console.error('Failed to upload document:', uploadError);
        }
      }
    }

    // Generate unique contract number
    const year = new Date().getFullYear();
    const count = await Contract.countDocuments({
      'dates.creationDate': {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`)
      }
    });
    const contractNumber = `CON-${year}-${String(count + 1).padStart(4, '0')}`;

    // Create contract
    const contractData = {
      contractNumber,
      title: title.trim(),
      description: description.trim(),
      type,
      category,
      
      supplier: {
        supplierId,
        supplierName: supplierName || supplier.fullName,
        contactPerson: contactPerson || supplier.supplierDetails?.contactName,
        contactEmail: contactEmail || supplier.email,
        contactPhone: contactPhone || supplier.supplierDetails?.phoneNumber
      },
      
      financials: {
        totalValue: parseFloat(totalValue),
        currency: currency || 'XAF',
        paymentTerms,
        deliveryTerms
      },
      
      dates: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      
      management: {
        contractManager: contractManager || req.user.userId,
        department: department || 'Supply Chain',
        createdBy: req.user.userId
      },
      
      priority: priority || 'Medium',
      
      renewal: {
        isRenewable: isRenewable === true || isRenewable === 'true',
        autoRenewal: autoRenewal === true || autoRenewal === 'true',
        renewalPeriod: parseInt(renewalPeriod) || 12,
        renewalNotificationDays: parseInt(renewalNotificationDays) || 30
      },
      
      documents,
      internalNotes: internalNotes || '',
      
      // Parse milestones if provided
      milestones: milestones ? JSON.parse(milestones).map(milestone => ({
        ...milestone,
        dueDate: new Date(milestone.dueDate),
        createdBy: req.user.userId
      })) : []
    };

    const contract = await Contract.create(contractData);

    // Send notification emails
    await this.sendContractCreationNotifications(contract);

    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: contract
    });

  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contract',
      error: error.message
    });
  }
};

exports.getAllContracts = async (req, res) => {
  try {
    const {
      status,
      type,
      category,
      department,
      priority,
      supplierId,
      contractManager,
      page = 1,
      limit = 20,
      sortBy = 'dates.creationDate',
      sortOrder = 'desc',
      search,
      startDate,
      endDate
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (department) filter['management.department'] = department;
    if (priority) filter.priority = priority;
    if (supplierId) filter['supplier.supplierId'] = supplierId;
    if (contractManager) filter['management.contractManager'] = contractManager;
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { contractNumber: { $regex: search, $options: 'i' } },
        { 'supplier.supplierName': { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      filter['dates.startDate'] = {};
      if (startDate) filter['dates.startDate'].$gte = new Date(startDate);
      if (endDate) filter['dates.startDate'].$lte = new Date(endDate);
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contracts = await Contract
      .find(filter)
      .populate('management.contractManager', 'fullName email department')
      .populate('management.createdBy', 'fullName email')
      .populate('management.approvedBy', 'fullName email')
      .populate('supplier.supplierId', 'fullName email supplierDetails')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Contract.countDocuments(filter);

    // Get statistics
    const stats = await this.getContractStatistics();

    res.json({
      success: true,
      data: contracts,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contracts'
    });
  }
};


exports.getContractById = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract
      .findOne({
        $or: [
          { _id: contractId },
          { contractNumber: contractId }
        ]
      })
      .populate('management.contractManager', 'fullName email department')
      .populate('management.createdBy', 'fullName email')
      .populate('management.approvedBy', 'fullName email')
      .populate('supplier.supplierId', 'fullName email supplierDetails')
      .populate('amendments.requestedBy', 'fullName email')
      .populate('amendments.approvedBy', 'fullName email')
      .populate('communications.recordedBy', 'fullName email');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    res.json({
      success: true,
      data: contract
    });

  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract'
    });
  }
};

// ===============================
// UPDATE CONTRACT
// ===============================
exports.updateContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const updateData = { ...req.body };

    const contract = await Contract.findOne({
      $or: [
        { _id: contractId },
        { contractNumber: contractId }
      ]
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check permissions - only contract manager, creator, or admin can update
    if (
      contract.management.contractManager.toString() !== req.user.userId &&
      contract.management.createdBy.toString() !== req.user.userId &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to update contract'
      });
    }

    // Validate dates if they are being updated
    if (updateData.startDate && updateData.endDate) {
      if (new Date(updateData.startDate) >= new Date(updateData.endDate)) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
    }

    // Handle document uploads
    if (req.files && req.files.contractDocuments) {
      const newDocuments = [];
      
      for (const file of req.files.contractDocuments) {
        try {
          const uploadResult = await uploadFile(file, 'contract-documents');
          
          newDocuments.push({
            name: file.originalname,
            type: this.getDocumentType(file.originalname),
            filename: uploadResult.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            uploadedBy: req.user.userId
          });
        } catch (uploadError) {
          console.error('Failed to upload document:', uploadError);
        }
      }
      
      contract.documents.push(...newDocuments);
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'contractNumber' && updateData[key] !== undefined) {
        if (key.includes('.')) {
          // Handle nested fields
          const keys = key.split('.');
          let current = contract;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = updateData[key];
        } else {
          contract[key] = updateData[key];
        }
      }
    });

    // Update modification info
    contract.management.lastModifiedBy = req.user.userId;
    contract.dates.lastModified = new Date();

    await contract.save();

    // Add communication record for update
    await contract.addCommunication({
      type: 'other',
      subject: 'Contract Updated',
      summary: `Contract updated by ${req.user.fullName || 'User'}`,
      participants: [req.user.fullName || 'User']
    }, req.user.userId);

    res.json({
      success: true,
      message: 'Contract updated successfully',
      data: contract
    });

  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contract',
      error: error.message
    });
  }
};

// ===============================
// DELETE CONTRACT
// ===============================
exports.deleteContract = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findOne({
      $or: [
        { _id: contractId },
        { contractNumber: contractId }
      ]
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check permissions - only admin can delete contracts
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete contracts'
      });
    }

    // Don't allow deletion of active contracts
    if (contract.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active contracts. Please terminate or suspend first.'
      });
    }

    // Delete associated documents from cloud storage
    if (contract.documents && contract.documents.length > 0) {
      for (const doc of contract.documents) {
        try {
          if (doc.publicId) {
            await deleteFile(doc.publicId);
          }
        } catch (deleteError) {
          console.error('Failed to delete document:', deleteError);
        }
      }
    }

    await Contract.findByIdAndDelete(contract._id);

    res.json({
      success: true,
      message: 'Contract deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contract'
    });
  }
};

// ===============================
// RENEW CONTRACT
// ===============================
exports.renewContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const {
      newEndDate,
      renewalType,
      adjustments,
      notes
    } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    if (!contract.renewal.isRenewable) {
      return res.status(400).json({
        success: false,
        message: 'Contract is not renewable'
      });
    }

    // Validate new end date
    const currentEndDate = new Date(contract.dates.endDate);
    const renewalEndDate = new Date(newEndDate);
    
    if (renewalEndDate <= currentEndDate) {
      return res.status(400).json({
        success: false,
        message: 'New end date must be after current end date'
      });
    }

    // Add renewal to history
    contract.renewal.renewalHistory.push({
      renewalDate: new Date(),
      previousEndDate: contract.dates.endDate,
      newEndDate: renewalEndDate,
      renewedBy: req.user.userId,
      notes: notes || ''
    });

    // Update contract dates and status
    const oldEndDate = contract.dates.endDate;
    contract.dates.endDate = renewalEndDate;
    contract.status = 'active';

    // Apply adjustments if provided
    if (adjustments) {
      if (adjustments.totalValue) {
        contract.financials.totalValue = parseFloat(adjustments.totalValue);
      }
      if (adjustments.paymentTerms) {
        contract.financials.paymentTerms = adjustments.paymentTerms;
      }
    }

    // Clear expiry notifications
    contract.notifications = contract.notifications.filter(n => n.type !== 'renewal_due' && n.type !== 'expiry_warning');

    await contract.save();

    // Add communication record
    await contract.addCommunication({
      type: 'renewal',
      subject: 'Contract Renewed',
      summary: `Contract renewed from ${oldEndDate.toDateString()} to ${renewalEndDate.toDateString()}`,
      participants: [req.user.fullName || 'User']
    }, req.user.userId);

    // Send notifications
    await this.sendRenewalNotifications(contract, oldEndDate);

    res.json({
      success: true,
      message: 'Contract renewed successfully',
      data: contract
    });

  } catch (error) {
    console.error('Error renewing contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to renew contract',
      error: error.message
    });
  }
};


exports.createAmendment = async (req, res) => {
  try {
    const { contractId } = req.params;
    const {
      type,
      description,
      effectiveDate,
      financialImpact
    } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Process amendment documents
    const amendmentDocuments = [];
    if (req.files && req.files.amendmentDocuments) {
      for (const file of req.files.amendmentDocuments) {
        try {
          const uploadResult = await uploadFile(file, 'contract-amendments');
          
          amendmentDocuments.push({
            filename: uploadResult.filename,
            originalName: file.originalname,
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            uploadDate: new Date()
          });
        } catch (uploadError) {
          console.error('Failed to upload amendment document:', uploadError);
        }
      }
    }

    // Create amendment
    const amendmentData = {
      type,
      description,
      effectiveDate: new Date(effectiveDate),
      requestedBy: req.user.userId,
      documents: amendmentDocuments
    };

    if (financialImpact) {
      amendmentData.financialImpact = {
        amount: parseFloat(financialImpact.amount) || 0,
        type: financialImpact.type
      };
    }

    await contract.addAmendment(amendmentData, req.user.userId);

    res.json({
      success: true,
      message: 'Amendment created successfully',
      data: contract
    });

  } catch (error) {
    console.error('Error creating amendment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create amendment',
      error: error.message
    });
  }
};


exports.updateContractStatus = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { status, reason, notes } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const oldStatus = contract.status;
    contract.status = status;

    // Handle status-specific logic
    switch (status) {
      case 'approved':
        contract.management.approvedBy = req.user.userId;
        contract.dates.approvedDate = new Date();
        break;
      case 'terminated':
        contract.archiveInfo.isArchived = true;
        contract.archiveInfo.archivedDate = new Date();
        contract.archiveInfo.archivedBy = req.user.userId;
        contract.archiveInfo.archiveReason = reason || 'Contract terminated';
        break;
    }

    await contract.save();

    // Add communication record
    await contract.addCommunication({
      type: 'other',
      subject: `Contract Status Changed`,
      summary: `Status changed from ${oldStatus} to ${status}${reason ? `. Reason: ${reason}` : ''}`,
      participants: [req.user.fullName || 'User']
    }, req.user.userId);

    // Send status change notifications
    await this.sendStatusChangeNotifications(contract, oldStatus);

    res.json({
      success: true,
      message: `Contract status updated to ${status}`,
      data: contract
    });

  } catch (error) {
    console.error('Error updating contract status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contract status',
      error: error.message
    });
  }
};

exports.getContractStatistics = async () => {
  try {
    const stats = await Contract.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalValue: { $sum: '$financials.totalValue' },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          expiringSoon: {
            $sum: { $cond: [{ $eq: ['$status', 'expiring_soon'] }, 1, 0] }
          },
          expired: {
            $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
          },
          draft: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          pendingApproval: {
            $sum: { $cond: [{ $eq: ['$status', 'pending_approval'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get contracts by category
    const categoryStats = await Contract.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, value: { $sum: '$financials.totalValue' } } },
      { $sort: { count: -1 } }
    ]);

    // Get contracts by department
    const departmentStats = await Contract.aggregate([
      { $group: { _id: '$management.department', count: { $sum: 1 }, value: { $sum: '$financials.totalValue' } } },
      { $sort: { count: -1 } }
    ]);

    return {
      overview: stats[0] || {
        total: 0,
        totalValue: 0,
        active: 0,
        expiringSoon: 0,
        expired: 0,
        draft: 0,
        pendingApproval: 0
      },
      byCategory: categoryStats,
      byDepartment: departmentStats
    };
  } catch (error) {
    console.error('Error getting contract statistics:', error);
    return {
      overview: {
        total: 0,
        totalValue: 0,
        active: 0,
        expiringSoon: 0,
        expired: 0,
        draft: 0,
        pendingApproval: 0
      },
      byCategory: [],
      byDepartment: []
    };
  }
};

exports.getExpiringContracts = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const expiringContracts = await Contract.getExpiringContracts(parseInt(days));
    
    res.json({
      success: true,
      data: expiringContracts,
      count: expiringContracts.length
    });

  } catch (error) {
    console.error('Error fetching expiring contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expiring contracts'
    });
  }
};


exports.exportContracts = async (req, res) => {
  try {
    const { format = 'excel', status, type, category } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;

    const contracts = await Contract
      .find(filter)
      .populate('management.contractManager', 'fullName email')
      .populate('supplier.supplierId', 'fullName email')
      .sort({ 'dates.creationDate': -1 })
      .lean();

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contracts');

      // Add headers
      worksheet.columns = [
        { header: 'Contract Number', key: 'contractNumber', width: 20 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Supplier', key: 'supplier', width: 25 },
        { header: 'Value (XAF)', key: 'value', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Start Date', key: 'startDate', width: 12 },
        { header: 'End Date', key: 'endDate', width: 12 },
        { header: 'Department', key: 'department', width: 15 }
      ];

      // Add data
      contracts.forEach(contract => {
        worksheet.addRow({
          contractNumber: contract.contractNumber,
          title: contract.title,
          type: contract.type,
          category: contract.category,
          supplier: contract.supplier.supplierName,
          value: contract.financials.totalValue,
          status: contract.status,
          startDate: moment(contract.dates.startDate).format('YYYY-MM-DD'),
          endDate: moment(contract.dates.endDate).format('YYYY-MM-DD'),
          department: contract.management.department
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=contracts-${Date.now()}.xlsx`);
      
      await workbook.xlsx.write(res);
    } else {
      res.json({
        success: true,
        data: contracts,
        count: contracts.length
      });
    }

  } catch (error) {
    console.error('Error exporting contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export contracts'
    });
  }
};

// Get document type from filename
exports.getDocumentType = function(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  const name = filename.toLowerCase();
  
  if (name.includes('agreement') || name.includes('contract')) return 'master_agreement';
  if (name.includes('sla') || name.includes('service')) return 'sla';
  if (name.includes('amendment')) return 'amendment';
  if (name.includes('addendum')) return 'addendum';
  if (name.includes('certificate')) return 'certificate';
  if (name.includes('spec')) return 'specification';
  
  return 'other';
};

// Send contract creation notifications
exports.sendContractCreationNotifications = async function(contract) {
  try {
    // Notify contract manager
    if (contract.management.contractManager) {
      const manager = await User.findById(contract.management.contractManager);
      if (manager && manager.email) {
        await sendEmail({
          to: manager.email,
          subject: `New Contract Assigned - ${contract.contractNumber}`,
          html: this.generateContractEmailTemplate(contract, 'creation', manager.fullName)
        });
      }
    }

    // Notify supplier
    if (contract.supplier.contactEmail) {
      await sendEmail({
        to: contract.supplier.contactEmail,
        subject: `Contract Created - ${contract.contractNumber}`,
        html: this.generateContractEmailTemplate(contract, 'supplier_notification')
      });
    }

  } catch (error) {
    console.error('Failed to send contract creation notifications:', error);
  }
};

// Send renewal notifications
exports.sendRenewalNotifications = async function(contract, oldEndDate) {
  try {
    const manager = await User.findById(contract.management.contractManager);
    
    if (manager && manager.email) {
      await sendEmail({
        to: manager.email,
        subject: `Contract Renewed - ${contract.contractNumber}`,
        html: this.generateRenewalEmailTemplate(contract, oldEndDate, manager.fullName)
      });
    }

  } catch (error) {
    console.error('Failed to send renewal notifications:', error);
  }
};

// Send status change notifications
exports.sendStatusChangeNotifications = async function(contract, oldStatus) {
  try {
    const manager = await User.findById(contract.management.contractManager);
    
    if (manager && manager.email) {
      await sendEmail({
        to: manager.email,
        subject: `Contract Status Changed - ${contract.contractNumber}`,
        html: this.generateStatusChangeEmailTemplate(contract, oldStatus, manager.fullName)
      });
    }

  } catch (error) {
    console.error('Failed to send status change notifications:', error);
  }
};

// Generate contract email template
exports.generateContractEmailTemplate = function(contract, type, recipientName = '') {
  const baseStyle = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
  `;
  
  const endStyle = `
        <p>Best regards,<br>Grato Engineering Contract Management Team</p>
      </div>
    </div>
  `;

  switch (type) {
    case 'creation':
      return `${baseStyle}
        <h2 style="color: #1890ff;">New Contract Assignment</h2>
        <p>Dear ${recipientName},</p>
        <p>A new contract has been created and assigned to you for management.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Contract Details:</h3>
          <ul>
            <li><strong>Contract Number:</strong> ${contract.contractNumber}</li>
            <li><strong>Title:</strong> ${contract.title}</li>
            <li><strong>Supplier:</strong> ${contract.supplier.supplierName}</li>
            <li><strong>Value:</strong> ${contract.financials.totalValue.toLocaleString()} ${contract.financials.currency}</li>
            <li><strong>Start Date:</strong> ${moment(contract.dates.startDate).format('DD/MM/YYYY')}</li>
            <li><strong>End Date:</strong> ${moment(contract.dates.endDate).format('DD/MM/YYYY')}</li>
            <li><strong>Department:</strong> ${contract.management.department}</li>
          </ul>
        </div>
        
        <p>Please review the contract details and ensure all requirements are met.</p>
        ${endStyle}
      `;
      
    case 'supplier_notification':
      return `${baseStyle}
        <h2 style="color: #52c41a;">Contract Created</h2>
        <p>Dear ${contract.supplier.contactPerson || 'Partner'},</p>
        <p>A new contract has been created for your organization.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Contract Details:</h3>
          <ul>
            <li><strong>Contract Number:</strong> ${contract.contractNumber}</li>
            <li><strong>Title:</strong> ${contract.title}</li>
            <li><strong>Value:</strong> ${contract.financials.totalValue.toLocaleString()} ${contract.financials.currency}</li>
            <li><strong>Start Date:</strong> ${moment(contract.dates.startDate).format('DD/MM/YYYY')}</li>
            <li><strong>End Date:</strong> ${moment(contract.dates.endDate).format('DD/MM/YYYY')}</li>
            <li><strong>Status:</strong> ${contract.status}</li>
          </ul>
        </div>
        
        <p>Please review the contract terms and contact us if you have any questions.</p>
        ${endStyle}
      `;
      
    default:
      return `${baseStyle}
        <h2>Contract Notification</h2>
        <p>Contract ${contract.contractNumber} has been updated.</p>
        ${endStyle}
      `;
  }
};

// Generate renewal email template
exports.generateRenewalEmailTemplate = function(contract, oldEndDate, recipientName) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px;">
        <h2 style="color: #52c41a;">Contract Successfully Renewed</h2>
        <p>Dear ${recipientName},</p>
        
        <p>Contract ${contract.contractNumber} has been successfully renewed.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Renewal Details:</h3>
          <ul>
            <li><strong>Contract:</strong> ${contract.title}</li>
            <li><strong>Previous End Date:</strong> ${moment(oldEndDate).format('DD/MM/YYYY')}</li>
            <li><strong>New End Date:</strong> ${moment(contract.dates.endDate).format('DD/MM/YYYY')}</li>
            <li><strong>Extended Period:</strong> ${moment(contract.dates.endDate).diff(moment(oldEndDate), 'days')} days</li>
            <li><strong>Current Value:</strong> ${contract.financials.totalValue.toLocaleString()} ${contract.financials.currency}</li>
          </ul>
        </div>
        
        <p>The contract is now active with the new terms.</p>
        <p>Best regards,<br>Grato Engineering Contract Management Team</p>
      </div>
    </div>
  `;
};

// Generate status change email template
exports.generateStatusChangeEmailTemplate = function(contract, oldStatus, recipientName) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px;">
        <h2>Contract Status Update</h2>
        <p>Dear ${recipientName},</p>
        
        <p>The status of contract ${contract.contractNumber} has been updated.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <ul>
            <li><strong>Contract:</strong> ${contract.title}</li>
            <li><strong>Previous Status:</strong> ${oldStatus}</li>
            <li><strong>New Status:</strong> ${contract.status}</li>
            <li><strong>Updated:</strong> ${moment().format('DD/MM/YYYY HH:mm')}</li>
          </ul>
        </div>
        
        <p>Please review the updated contract status in the system.</p>
        <p>Best regards,<br>Grato Engineering Contract Management Team</p>
      </div>
    </div>
  `;
};

