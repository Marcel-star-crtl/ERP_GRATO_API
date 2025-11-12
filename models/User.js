// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// const documentSchema = new mongoose.Schema({
//   name: String,
//   url: String,
//   publicId: String,
//   size: Number,
//   mimetype: String,
//   uploadedAt: { type: Date, default: Date.now }
// });

// const UserSchema = new mongoose.Schema({
//     email: {
//         type: String,
//         unique: true,
//         required: true,
//         trim: true,
//         lowercase: true,
//         validate: {
//             validator: function(v) {
//                 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
//             },
//             message: props => `${props.value} is not a valid email address!`
//         }
//     },
//     password: {
//         type: String,
//         required: true
//     },
//     fullName: {
//         type: String,
//         required: true,
//         trim: true
//     },
//     role: {
//         type: String,
//         enum: ['employee', 'supervisor', 'finance', 'admin', 'supplier', 'it', 'hr', 'supply_chain', 'buyer', 'hse'], 
//         required: true,
//         default: 'employee'
//     },
//     isActive: {
//         type: Boolean,
//         default: true
//     },
//     department: {
//         type: String,
//         required: function() {
//             return this.role !== 'supplier';
//         }
//     },

//     // UNIFIED SUPPLIER PROFILE
//     supplierDetails: {
//         companyName: { type: String, required: function() { return this.role === 'supplier'; } },
//         contactName: { type: String, required: function() { return this.role === 'supplier'; } },
//         phoneNumber: { type: String, required: function() { return this.role === 'supplier'; } },
//         alternatePhone: String,
//         website: String,
        
//         // Address
//         address: {
//         street: String,
//         city: String,
//         state: String,
//         country: { type: String, default: 'Cameroon' },
//         postalCode: String
//         },
        
//         // Business Information
//         supplierType: {
//         type: String,
//         enum: ['General', 'Supply Chain', 'HR/Admin', 'Operations', 'HSE', 'Refurbishment', 'IT Services', 'Construction'],
//         required: function() { return this.role === 'supplier'; }
//         },
//         businessType: {
//         type: String,
//         enum: ['Corporation', 'Limited Company', 'Partnership', 'Sole Proprietorship', 'Cooperative', 'Other']
//         },
//         businessRegistrationNumber: String,
//         taxIdNumber: String,
//         establishedYear: Number,
//         employeeCount: String,
        
//         // Services & Categories
//         servicesOffered: [String],
//         businessDescription: String,
        
//         // Financial
//         bankDetails: {
//         bankName: String,
//         accountNumber: String,
//         accountName: String,
//         swiftCode: String,
//         routingNumber: String
//         },
//         paymentTerms: {
//         type: String,
//         enum: ['15 days NET', '30 days NET', '45 days NET', '60 days NET', 'Cash on Delivery', 'Advance Payment'],
//         default: '30 days NET'
//         },
        
//         // Documents - following project pattern
//         documents: {
//         businessRegistrationCertificate: {
//             name: String,
//             url: String,
//             publicId: String,
//             size: Number,
//             mimetype: String,
//             uploadedAt: Date
//         },
//         taxClearanceCertificate: {
//             name: String,
//             url: String,
//             publicId: String,
//             size: Number,
//             mimetype: String,
//             uploadedAt: Date
//         },
//         bankStatement: {
//             name: String,
//             url: String,
//             publicId: String,
//             size: Number,
//             mimetype: String,
//             uploadedAt: Date
//         },
//         insuranceCertificate: {
//             name: String,
//             url: String,
//             publicId: String,
//             size: Number,
//             mimetype: String,
//             uploadedAt: Date
//         },
//         additionalDocuments: [{
//             name: String,
//             url: String,
//             publicId: String,
//             size: Number,
//             mimetype: String,
//             uploadedAt: Date
//         }]
//         }
//     },

//     // NEW: Buyer-specific fields
//     buyerDetails: {
//         specializations: [{
//             type: String,
//             enum: ['IT_Accessories', 'Office_Supplies', 'Equipment', 'Consumables', 'Software', 'Hardware', 'Furniture', 'Safety_Equipment', 'Maintenance_Supplies', 'General']
//         }],
//         maxOrderValue: {
//             type: Number,
//             default: 1000000 
//         },
//         workload: {
//             currentAssignments: {
//                 type: Number,
//                 default: 0
//             },
//             monthlyTarget: {
//                 type: Number,
//                 default: 50
//             }
//         },
//         performance: {
//             completedOrders: {
//                 type: Number,
//                 default: 0
//             },
//             averageProcessingTime: {
//                 type: Number,
//                 default: 0 // in days
//             },
//             customerSatisfactionRating: {
//                 type: Number,
//                 min: 1,
//                 max: 5,
//                 default: 5
//             }
//         },
//         availability: {
//             isAvailable: {
//                 type: Boolean,
//                 default: true
//             },
//             unavailableReason: String,
//             unavailableUntil: Date
//         }
//     },

//     supplierStatus: {
//         accountStatus: {
//         type: String,
//         enum: ['pending', 'approved', 'rejected', 'suspended', 'inactive'],
//         default: 'pending'
//         },
//         emailVerified: { type: Boolean, default: false },
//         isVerified: { type: Boolean, default: false },
//         verificationToken: String,
//         verificationTokenExpiry: Date,
//         approvalDate: Date,
//         approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//         rejectionReason: String,
//         suspensionReason: String
//     },

//     // References to related entities
//     onboardingApplicationId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'SupplierOnboardingApplication'
//     },

//     // Employee hierarchy fields
//     supervisor: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//     },
//     departmentHead: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//     },
//     directReports: [{
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//     }],
//     departmentRole: {
//         type: String,
//         enum: ['head', 'supervisor', 'coordinator', 'staff', 'buyer', 'hr', 'it', 'supply_chain'], 
//         default: function() {
//             if (this.role === 'buyer') return 'buyer';
//             return this.role !== 'supplier' ? 'staff' : undefined;
//         }
//     },
//     hierarchyLevel: {
//         type: Number,
//         default: function() {
//             if (this.role === 'buyer') return 2; // Buyers are level 2
//             return this.role !== 'supplier' ? 1 : undefined;
//         }
//     },
//     permissions: {
//         type: [String],
//         default: []
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now
//     },
//     lastLogin: {
//         type: Date
//     }
// }, {
//     timestamps: true,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true }
// });

// // Enhanced indexes
// UserSchema.index({ role: 1 });
// UserSchema.index({ department: 1, hierarchyLevel: -1 });
// UserSchema.index({ 'supplierDetails.supplierType': 1 });
// UserSchema.index({ 'supplierStatus.accountStatus': 1 });
// UserSchema.index({ 'buyerDetails.specializations': 1 }); 

// // Virtual for contracts
// UserSchema.virtual('contracts', {
//   ref: 'Contract',
//   localField: '_id',
//   foreignField: 'supplier'
// });

// // Virtual for invoices
// UserSchema.virtual('invoices', {
//   ref: 'SupplierInvoice',
//   localField: '_id',
//   foreignField: 'supplier'
// });

// // Virtual for performance evaluations
// UserSchema.virtual('performanceEvaluations', {
//   ref: 'SupplierPerformance',
//   localField: '_id',
//   foreignField: 'supplier'
// });

// // Methods for supplier
// UserSchema.methods.getActiveContracts = async function() {
//   const Contract = mongoose.model('Contract');
//   return await Contract.find({
//     supplier: this._id,
//     status: 'active',
//     'dates.endDate': { $gte: new Date() }
//   });
// };

// UserSchema.methods.getPendingInvoices = async function() {
//   const SupplierInvoice = mongoose.model('SupplierInvoice');
//   return await SupplierInvoice.find({
//     supplier: this._id,
//     approvalStatus: { $in: ['pending_finance_assignment', 'pending_department_approval', 'pending_finance_processing'] }
//   });
// };

// UserSchema.methods.getPerformanceScore = async function() {
//   const SupplierPerformance = mongoose.model('SupplierPerformance');
//   const evaluations = await SupplierPerformance.find({
//     supplier: this._id,
//     status: { $in: ['submitted', 'reviewed'] }
//   }).sort({ evaluationDate: -1 }).limit(5);
  
//   if (evaluations.length === 0) return null;
  
//   const avgScore = evaluations.reduce((sum, eval) => sum + eval.overallScore, 0) / evaluations.length;
//   return {
//     averageScore: avgScore.toFixed(2),
//     latestScore: evaluations[0].overallScore,
//     evaluationCount: evaluations.length,
//     latestEvaluationDate: evaluations[0].evaluationDate
//   };
// };

// UserSchema.methods.canSubmitInvoice = async function() {
//   // Check if supplier is approved and active
//   if (this.supplierStatus.accountStatus !== 'approved' || !this.isActive) {
//     return { allowed: false, reason: 'Supplier account not approved or inactive' };
//   }
  
//   // Invoices can be submitted with or without contract (as per requirements)
//   return { allowed: true };
// };

// UserSchema.methods.getSupplierSummary = async function() {
//   const Contract = mongoose.model('Contract');
//   const SupplierInvoice = mongoose.model('SupplierInvoice');
  
//   const [contracts, invoices, performance] = await Promise.all([
//     Contract.find({ supplier: this._id }),
//     SupplierInvoice.find({ supplier: this._id }),
//     this.getPerformanceScore()
//   ]);
  
//   const activeContracts = contracts.filter(c => c.status === 'active').length;
//   const totalContractValue = contracts.reduce((sum, c) => sum + (c.financials?.totalValue || 0), 0);
  
//   const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);
//   const pendingInvoices = invoices.filter(inv => 
//     ['pending_finance_assignment', 'pending_department_approval'].includes(inv.approvalStatus)
//   ).length;
//   const paidInvoices = invoices.filter(inv => inv.approvalStatus === 'paid').length;
  
//   return {
//     contracts: {
//       total: contracts.length,
//       active: activeContracts,
//       totalValue: totalContractValue
//     },
//     invoices: {
//       total: invoices.length,
//       pending: pendingInvoices,
//       paid: paidInvoices,
//       totalInvoiced
//     },
//     performance: performance || { averageScore: 0, evaluationCount: 0 }
//   };
// };

// // Virtual for display name
// UserSchema.virtual('displayName').get(function() {
//     if (this.role === 'supplier') {
//         return this.supplierDetails?.companyName || this.fullName;
//     }
//     return this.fullName;
// });

// // Method to get approval authority level
// UserSchema.methods.getApprovalAuthority = function() {
//     if (this.role === 'admin') return 'admin';
//     if (this.role === 'supplier') return 'supplier';
//     if (this.role === 'buyer') return 'buyer';
//     if (this.departmentRole === 'head') return 'department_head';
//     if (this.departmentRole === 'supervisor') return 'supervisor';
//     return 'employee';
// };

// // NEW: Method to check if buyer can handle requisition
// UserSchema.methods.canHandleRequisition = function(requisition) {
//     if (this.role !== 'buyer') return false;
//     if (!this.buyerDetails?.availability?.isAvailable) return false;
    
//     // Check specializations
//     const buyerSpecs = this.buyerDetails.specializations || [];
//     if (buyerSpecs.length > 0 && !buyerSpecs.includes(requisition.itemCategory?.replace(' ', '_'))) {
//         return false;
//     }
    
//     // Check max order value
//     const estimatedValue = requisition.budgetXAF || requisition.financeVerification?.assignedBudget || 0;
//     if (estimatedValue > (this.buyerDetails?.maxOrderValue || 1000000)) {
//         return false;
//     }
    
//     return true;
// };

// // NEW: Method to get buyer workload
// UserSchema.methods.getBuyerWorkload = function() {
//     if (this.role !== 'buyer') return null;
    
//     return {
//         current: this.buyerDetails?.workload?.currentAssignments || 0,
//         target: this.buyerDetails?.workload?.monthlyTarget || 50,
//         percentage: Math.round(((this.buyerDetails?.workload?.currentAssignments || 0) / (this.buyerDetails?.workload?.monthlyTarget || 50)) * 100)
//     };
// };

// // Method to check if supplier is active and approved
// UserSchema.methods.isApprovedSupplier = function() {
//     return this.role === 'supplier' && 
//            this.supplierStatus.accountStatus === 'approved' && 
//            this.isActive && 
//            this.supplierStatus.emailVerified;
// };






const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const documentSchema = new mongoose.Schema({
  name: String,
  url: String,
  publicId: String,
  size: Number,
  mimetype: String,
  uploadedAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    password: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    
    // CORE ROLE (What they do, NOT who they supervise)
    role: {
        type: String,
        enum: ['employee', 'finance', 'admin', 'buyer', 'hr', 'supply_chain', 'technical', 'hse', 'supplier', 'it'],
        required: true,
        default: 'employee'
    },
    
    isActive: {
        type: Boolean,
        default: true
    },
    
    // ORGANIZATIONAL STRUCTURE
    department: {
        type: String,
        required: function() {
            return this.role !== 'supplier';
        }
    },
    
    position: {
        type: String,
        required: function() {
            return this.role !== 'supplier';
        }
        // e.g., "IT Staff", "HR & Admin Head", "Technical Director"
    },
    
    // PRIMARY HIERARCHY REFERENCE
    supervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
        // Index removed - defined in schema.index() below
    },
    
    // SECONDARY REFERENCE
    departmentHead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
        // Index removed - defined in schema.index() below
    },
    
    // DIRECT REPORTS (People who report to this user)
    directReports: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // APPROVAL CAPACITIES (What roles this person can approve as)
    approvalCapacities: [{
        type: String,
        enum: [
            'direct_supervisor',      // Immediate manager
            'department_head',        // Head of department
            'business_head',          // Head of Business (Kelvin)
            'finance_officer',        // Finance approval
            'technical_director',     // Technical dept head
            'hse_coordinator',        // HSE approval
            'project_manager',        // Project-specific
            'supply_chain_coordinator', // Supply chain
            'operations_manager'      // Operations
        ]
    }],
    
    // CACHED HIERARCHY PATH (for quick lookups and loop prevention)
    hierarchyPath: [{
        type: String  // Array of user IDs from this user up to top
        // e.g., ["marcel_id", "bruiline_id", "kelvin_id"]
    }],
    
    // HIERARCHY LEVEL (1 = lowest, 5 = highest)
    hierarchyLevel: {
        type: Number,
        default: 1,
        min: 1,
        max: 5
    },
    
    // DEPARTMENT ROLE (for legacy compatibility)
    departmentRole: {
        type: String,
        enum: ['head', 'supervisor', 'coordinator', 'staff', 'buyer', 'hr', 'it', 'supply_chain'],
        default: 'staff'
    },
    
    // PERMISSIONS
    permissions: {
        type: [String],
        default: []
    },

    // ==========================================
    // SUPPLIER-SPECIFIC FIELDS
    // ==========================================
    supplierDetails: {
        companyName: { type: String, required: function() { return this.role === 'supplier'; } },
        contactName: { type: String, required: function() { return this.role === 'supplier'; } },
        phoneNumber: { type: String, required: function() { return this.role === 'supplier'; } },
        alternatePhone: String,
        website: String,
        
        address: {
            street: String,
            city: String,
            state: String,
            country: { type: String, default: 'Cameroon' },
            postalCode: String
        },
        
        supplierType: {
            type: String,
            enum: ['General', 'Supply Chain', 'HR/Admin', 'Operations', 'HSE', 'Refurbishment', 'IT Services', 'Construction'],
            required: function() { return this.role === 'supplier'; }
        },
        businessType: {
            type: String,
            enum: ['Corporation', 'Limited Company', 'Partnership', 'Sole Proprietorship', 'Cooperative', 'Other']
        },
        businessRegistrationNumber: String,
        taxIdNumber: String,
        establishedYear: Number,
        employeeCount: String,
        
        servicesOffered: [String],
        businessDescription: String,
        
        bankDetails: {
            bankName: String,
            accountNumber: String,
            accountName: String,
            swiftCode: String,
            routingNumber: String
        },
        paymentTerms: {
            type: String,
            enum: ['15 days NET', '30 days NET', '45 days NET', '60 days NET', 'Cash on Delivery', 'Advance Payment'],
            default: '30 days NET'
        },
        
        documents: {
            businessRegistrationCertificate: documentSchema,
            taxClearanceCertificate: documentSchema,
            bankStatement: documentSchema,
            insuranceCertificate: documentSchema,
            additionalDocuments: [documentSchema]
        }
    },

    // BUYER-SPECIFIC FIELDS
    buyerDetails: {
        specializations: [{
            type: String,
            enum: ['IT_Accessories', 'Office_Supplies', 'Equipment', 'Consumables', 
                   'Software', 'Hardware', 'Furniture', 'Safety_Equipment', 
                   'Maintenance_Supplies', 'General']
        }],
        maxOrderValue: {
            type: Number,
            default: 1000000
        },
        workload: {
            currentAssignments: { type: Number, default: 0 },
            monthlyTarget: { type: Number, default: 50 }
        },
        performance: {
            completedOrders: { type: Number, default: 0 },
            averageProcessingTime: { type: Number, default: 0 },
            customerSatisfactionRating: { type: Number, min: 1, max: 5, default: 5 }
        },
        availability: {
            isAvailable: { type: Boolean, default: true },
            unavailableReason: String,
            unavailableUntil: Date
        }
    },

    supplierStatus: {
        accountStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'suspended', 'inactive'],
            default: 'pending'
        },
        emailVerified: { type: Boolean, default: false },
        isVerified: { type: Boolean, default: false },
        verificationToken: String,
        verificationTokenExpiry: Date,
        approvalDate: Date,
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rejectionReason: String,
        suspensionReason: String
    },

    onboardingApplicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SupplierOnboardingApplication'
    },

    createdAt: { type: Date, default: Date.now },
    lastLogin: Date,
    
    // AUDIT FIELDS
    lastHierarchyUpdate: Date,
    hierarchyUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ==========================================
// INDEXES FOR PERFORMANCE
// ==========================================
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ department: 1, hierarchyLevel: -1 });
UserSchema.index({ supervisor: 1 });
UserSchema.index({ departmentHead: 1 });
UserSchema.index({ hierarchyPath: 1 });
UserSchema.index({ 'supplierDetails.supplierType': 1 });
UserSchema.index({ 'supplierStatus.accountStatus': 1 });
UserSchema.index({ 'buyerDetails.specializations': 1 });

// ==========================================
// VIRTUALS
// ==========================================
UserSchema.virtual('displayName').get(function() {
    if (this.role === 'supplier') {
        return this.supplierDetails?.companyName || this.fullName;
    }
    return this.fullName;
});

UserSchema.virtual('contracts', {
    ref: 'Contract',
    localField: '_id',
    foreignField: 'supplier'
});

UserSchema.virtual('invoices', {
    ref: 'SupplierInvoice',
    localField: '_id',
    foreignField: 'supplier'
});

UserSchema.virtual('performanceEvaluations', {
    ref: 'SupplierPerformance',
    localField: '_id',
    foreignField: 'supplier'
});

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Get complete approval chain for this user
 */
UserSchema.methods.getApprovalChain = async function(workflowType = 'general') {
    const WorkflowService = require('../services/workflowService');
    return await WorkflowService.generateApprovalWorkflow(this._id, workflowType);
};

/**
 * Check if this user can approve for another user
 */
UserSchema.methods.canApproveFor = function(userId) {
    return this.directReports.some(id => id.toString() === userId.toString()) ||
           this.approvalCapacities.length > 0;
};

/**
 * Get all subordinates (direct and indirect)
 */
UserSchema.methods.getAllSubordinates = async function() {
    const User = mongoose.model('User');
    const subordinates = [];
    
    const traverse = async (userId) => {
        const user = await User.findById(userId).populate('directReports');
        if (!user) return;
        
        for (const report of user.directReports) {
            subordinates.push(report);
            await traverse(report._id);
        }
    };
    
    await traverse(this._id);
    return subordinates;
};

/**
 * Get approval authority level
 */
UserSchema.methods.getApprovalAuthority = function() {
    if (this.role === 'admin') return 'admin';
    if (this.role === 'supplier') return 'supplier';
    if (this.approvalCapacities.includes('business_head')) return 'business_head';
    if (this.approvalCapacities.includes('department_head')) return 'department_head';
    if (this.approvalCapacities.includes('direct_supervisor')) return 'supervisor';
    if (this.role === 'buyer') return 'buyer';
    return 'employee';
};

/**
 * Check if buyer can handle requisition
 */
UserSchema.methods.canHandleRequisition = function(requisition) {
    if (this.role !== 'buyer') return false;
    if (!this.buyerDetails?.availability?.isAvailable) return false;
    
    const buyerSpecs = this.buyerDetails.specializations || [];
    if (buyerSpecs.length > 0 && !buyerSpecs.includes(requisition.itemCategory?.replace(' ', '_'))) {
        return false;
    }
    
    const estimatedValue = requisition.budgetXAF || requisition.financeVerification?.assignedBudget || 0;
    if (estimatedValue > (this.buyerDetails?.maxOrderValue || 1000000)) {
        return false;
    }
    
    return true;
};

/**
 * Get buyer workload
 */
UserSchema.methods.getBuyerWorkload = function() {
    if (this.role !== 'buyer') return null;
    
    return {
        current: this.buyerDetails?.workload?.currentAssignments || 0,
        target: this.buyerDetails?.workload?.monthlyTarget || 50,
        percentage: Math.round(((this.buyerDetails?.workload?.currentAssignments || 0) / 
                               (this.buyerDetails?.workload?.monthlyTarget || 50)) * 100)
    };
};

/**
 * Check if supplier is approved
 */
UserSchema.methods.isApprovedSupplier = function() {
    return this.role === 'supplier' && 
           this.supplierStatus.accountStatus === 'approved' && 
           this.isActive && 
           this.supplierStatus.emailVerified;
};

/**
 * Get supplier summary
 */
UserSchema.methods.getSupplierSummary = async function() {
    const Contract = mongoose.model('Contract');
    const SupplierInvoice = mongoose.model('SupplierInvoice');
    
    const [contracts, invoices, performance] = await Promise.all([
        Contract.find({ supplier: this._id }),
        SupplierInvoice.find({ supplier: this._id }),
        this.getPerformanceScore()
    ]);
    
    const activeContracts = contracts.filter(c => c.status === 'active').length;
    const totalContractValue = contracts.reduce((sum, c) => sum + (c.financials?.totalValue || 0), 0);
    
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);
    const pendingInvoices = invoices.filter(inv => 
        ['pending_finance_assignment', 'pending_department_approval'].includes(inv.approvalStatus)
    ).length;
    const paidInvoices = invoices.filter(inv => inv.approvalStatus === 'paid').length;
    
    return {
        contracts: { total: contracts.length, active: activeContracts, totalValue: totalContractValue },
        invoices: { total: invoices.length, pending: pendingInvoices, paid: paidInvoices, totalInvoiced },
        performance: performance || { averageScore: 0, evaluationCount: 0 }
    };
};

UserSchema.methods.getPerformanceScore = async function() {
    const SupplierPerformance = mongoose.model('SupplierPerformance');
    const evaluations = await SupplierPerformance.find({
        supplier: this._id,
        status: { $in: ['submitted', 'reviewed'] }
    }).sort({ evaluationDate: -1 }).limit(5);
    
    if (evaluations.length === 0) return null;
    
    const avgScore = evaluations.reduce((sum, eval) => sum + eval.overallScore, 0) / evaluations.length;
    return {
        averageScore: avgScore.toFixed(2),
        latestScore: evaluations[0].overallScore,
        evaluationCount: evaluations.length,
        latestEvaluationDate: evaluations[0].evaluationDate
    };
};

// ==========================================
// PASSWORD HANDLING
// ==========================================
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);