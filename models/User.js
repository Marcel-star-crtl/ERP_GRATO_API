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
    role: {
        type: String,
        enum: ['employee', 'supervisor', 'finance', 'admin', 'supplier', 'it', 'hr', 'supply_chain', 'buyer'], // NEW: Added buyer role
        required: true,
        default: 'employee'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    department: {
        type: String,
        required: function() {
            return this.role !== 'supplier';
        }
    },
    
    supplierDetails: {
        companyName: {
            type: String,
            required: function() {
                return this.role === 'supplier';
            }
        },
        contactName: {
            type: String,
            required: function() {
                return this.role === 'supplier';
            }
        },
        phoneNumber: {
            type: String,
            required: function() {
                return this.role === 'supplier';
            }
        },
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            postalCode: String
        },
        businessRegistrationNumber: String,
        taxIdNumber: String,
        supplierType: {
            type: String,
            enum: ['HSE', 'Refurbishment', 'Project', 'Operations', 'Diesel', 'Supply Chain', 'HR/Admin', 'General'],
            required: function() {
                return this.role === 'supplier';
            }
        },
        bankDetails: {
            bankName: String,
            accountName: String,
            accountNumber: String,
            routingNumber: String
        },
        businessInfo: {
            yearsInBusiness: Number,
            primaryServices: [String],
            certifications: [String],
            website: String
        },
        contractInfo: {
            contractNumber: String,
            contractStartDate: Date,
            contractEndDate: Date,
            contractValue: Number,
            paymentTerms: String
        },
        documents: {
            businessRegistrationCertificate: documentSchema,
            taxClearanceCertificate: documentSchema,
            bankStatement: documentSchema,
            insuranceCertificate: documentSchema,
            additionalDocuments: [documentSchema]
        }
    },

    // NEW: Buyer-specific fields
    buyerDetails: {
        specializations: [{
            type: String,
            enum: ['IT_Accessories', 'Office_Supplies', 'Equipment', 'Consumables', 'Software', 'Hardware', 'Furniture', 'Safety_Equipment', 'Maintenance_Supplies', 'General']
        }],
        maxOrderValue: {
            type: Number,
            default: 1000000 // Default max order value of 1M XAF
        },
        workload: {
            currentAssignments: {
                type: Number,
                default: 0
            },
            monthlyTarget: {
                type: Number,
                default: 50
            }
        },
        performance: {
            completedOrders: {
                type: Number,
                default: 0
            },
            averageProcessingTime: {
                type: Number,
                default: 0 // in days
            },
            customerSatisfactionRating: {
                type: Number,
                min: 1,
                max: 5,
                default: 5
            }
        },
        availability: {
            isAvailable: {
                type: Boolean,
                default: true
            },
            unavailableReason: String,
            unavailableUntil: Date
        }
    },

    // Enhanced supplier status
    supplierStatus: {
        accountStatus: {
            type: String,
            enum: ['pending', 'approved', 'suspended', 'rejected'],
            default: function() {
                return this.role === 'supplier' ? 'pending' : undefined;
            }
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        approvalDate: Date,
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        verificationToken: String,
        emailVerified: {
            type: Boolean,
            default: false
        }
    },

    // Employee hierarchy fields
    supervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    departmentHead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    directReports: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    departmentRole: {
        type: String,
        enum: ['head', 'supervisor', 'coordinator', 'staff', 'buyer'], // NEW: Added buyer
        default: function() {
            if (this.role === 'buyer') return 'buyer';
            return this.role !== 'supplier' ? 'staff' : undefined;
        }
    },
    hierarchyLevel: {
        type: Number,
        default: function() {
            if (this.role === 'buyer') return 2; // Buyers are level 2
            return this.role !== 'supplier' ? 1 : undefined;
        }
    },
    permissions: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Enhanced indexes
UserSchema.index({ role: 1 });
UserSchema.index({ department: 1, hierarchyLevel: -1 });
UserSchema.index({ 'supplierDetails.supplierType': 1 });
UserSchema.index({ 'supplierStatus.accountStatus': 1 });
UserSchema.index({ 'buyerDetails.specializations': 1 }); // NEW: Index for buyer specializations

// Virtual for display name
UserSchema.virtual('displayName').get(function() {
    if (this.role === 'supplier') {
        return this.supplierDetails?.companyName || this.fullName;
    }
    return this.fullName;
});

// Method to get approval authority level
UserSchema.methods.getApprovalAuthority = function() {
    if (this.role === 'admin') return 'admin';
    if (this.role === 'supplier') return 'supplier';
    if (this.role === 'buyer') return 'buyer';
    if (this.departmentRole === 'head') return 'department_head';
    if (this.departmentRole === 'supervisor') return 'supervisor';
    return 'employee';
};

// NEW: Method to check if buyer can handle requisition
UserSchema.methods.canHandleRequisition = function(requisition) {
    if (this.role !== 'buyer') return false;
    if (!this.buyerDetails?.availability?.isAvailable) return false;
    
    // Check specializations
    const buyerSpecs = this.buyerDetails.specializations || [];
    if (buyerSpecs.length > 0 && !buyerSpecs.includes(requisition.itemCategory?.replace(' ', '_'))) {
        return false;
    }
    
    // Check max order value
    const estimatedValue = requisition.budgetXAF || requisition.financeVerification?.assignedBudget || 0;
    if (estimatedValue > (this.buyerDetails?.maxOrderValue || 1000000)) {
        return false;
    }
    
    return true;
};

// NEW: Method to get buyer workload
UserSchema.methods.getBuyerWorkload = function() {
    if (this.role !== 'buyer') return null;
    
    return {
        current: this.buyerDetails?.workload?.currentAssignments || 0,
        target: this.buyerDetails?.workload?.monthlyTarget || 50,
        percentage: Math.round(((this.buyerDetails?.workload?.currentAssignments || 0) / (this.buyerDetails?.workload?.monthlyTarget || 50)) * 100)
    };
};

// Method to check if supplier is active and approved
UserSchema.methods.isApprovedSupplier = function() {
    return this.role === 'supplier' && 
           this.supplierStatus.accountStatus === 'approved' && 
           this.isActive && 
           this.supplierStatus.emailVerified;
};

// Password hashing middleware
UserSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);






