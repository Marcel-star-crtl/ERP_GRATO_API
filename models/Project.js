const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    projectType: {
        type: String,
        required: true,
        enum: [
            'Infrastructure',
            'IT Implementation', 
            'Process Improvement',
            'Product Development',
            'Marketing Campaign',
            'Training Program',
            'Facility Upgrade',
            'Equipment Installation',
            'System Integration',
            'Research & Development',
            'Maintenance',
            'Other'
        ]
    },
    priority: {
        type: String,
        required: true,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Planning', 'Approved', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
        default: 'Planning'
    },
    department: {
        type: String,
        required: true,
        enum: ['Operations', 'IT', 'Finance', 'HR', 'Marketing', 'Supply Chain', 'Facilities']
    },
    projectManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    timeline: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    budgetCodeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BudgetCode',
        default: null
    },
    milestones: [{
        title: {
            type: String,
            required: true,
            trim: true
        },
        dueDate: {
            type: Date
        },
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Overdue'],
            default: 'Pending'
        },
        completedDate: {
            type: Date
        }
    }],
    teamMembers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            trim: true
        },
        addedDate: {
            type: Date,
            default: Date.now
        }
    }],
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    tags: [{
        type: String,
        trim: true
    }],
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadDate: {
            type: Date,
            default: Date.now
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
projectSchema.index({ name: 1 });
projectSchema.index({ department: 1 });
projectSchema.index({ projectManager: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ 'timeline.startDate': 1, 'timeline.endDate': 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ isActive: 1 });

// Virtual for project duration in days
projectSchema.virtual('duration').get(function() {
    if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
        const diffTime = Math.abs(this.timeline.endDate - this.timeline.startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    return 0;
});

// Virtual for days remaining
projectSchema.virtual('daysRemaining').get(function() {
    if (this.timeline && this.timeline.endDate) {
        const today = new Date();
        const diffTime = this.timeline.endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    return 0;
});

// Virtual for overdue status
projectSchema.virtual('isOverdue').get(function() {
    if (this.timeline && this.timeline.endDate && this.status !== 'Completed') {
        return new Date() > this.timeline.endDate;
    }
    return false;
});

// Pre-save middleware to validate timeline
projectSchema.pre('save', function(next) {
    if (this.timeline && this.timeline.startDate && this.timeline.endDate) {
        if (this.timeline.endDate <= this.timeline.startDate) {
            return next(new Error('End date must be after start date'));
        }
    }
    next();
});

// Pre-save middleware to update updatedBy field
projectSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedBy = this._updateContext?.userId || this.updatedBy;
    }
    next();
});

// Static method to get project statistics
projectSchema.statics.getStatistics = async function() {
    const stats = await this.aggregate([
        {
            $match: { isActive: true }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                planning: { $sum: { $cond: [{ $eq: ['$status', 'Planning'] }, 1, 0] } },
                approved: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                onHold: { $sum: { $cond: [{ $eq: ['$status', 'On Hold'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
                overdue: { 
                    $sum: { 
                        $cond: [
                            { 
                                $and: [
                                    { $lt: ['$timeline.endDate', new Date()] },
                                    { $ne: ['$status', 'Completed'] }
                                ]
                            }, 
                            1, 
                            0
                        ] 
                    } 
                },
                averageProgress: { $avg: '$progress' }
            }
        }
    ]);

    return stats.length > 0 ? stats[0] : {
        total: 0,
        planning: 0,
        approved: 0,
        inProgress: 0,
        completed: 0,
        onHold: 0,
        cancelled: 0,
        overdue: 0,
        averageProgress: 0
    };
};

// Static method to get projects by department
projectSchema.statics.getByDepartment = function(department, options = {}) {
    const query = { department, isActive: true };
    
    return this.find(query)
        .populate('projectManager', 'fullName email role')
        .populate('budgetCodeId', 'code name totalBudget used available')
        .populate('createdBy', 'fullName email')
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 0);
};

// Static method to search projects
projectSchema.statics.searchProjects = function(searchQuery, filters = {}) {
    const query = {
        isActive: true,
        $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { tags: { $regex: searchQuery, $options: 'i' } }
        ]
    };

    // Apply additional filters
    if (filters.department) query.department = filters.department;
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.projectType) query.projectType = filters.projectType;

    return this.find(query)
        .populate('projectManager', 'fullName email role')
        .populate('budgetCodeId', 'code name')
        .sort({ createdAt: -1 });
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;