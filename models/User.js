const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const paymentDetailsSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['bank', 'mobile_money'],
        required: true
    },
    accountName: String,
    accountNumber: String,
    bankName: String,
    bankCode: String,
    mobileMoneyProvider: String,
    mobileMoneyNumber: String
});

const locationSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['Point'],
        default: 'Point' 
    },
    coordinates: {
        type: [Number],
        required: true,
        validate: {
            validator: function(v) {
                return v.length === 2 && 
                       v[0] >= -180 && v[0] <= 180 && 
                       v[1] >= -90 && v[1] <= 90;
            },
            message: 'Invalid coordinates'
        },
        index: '2dsphere'
    },
    address: String,
    city: String,
    country: String
});

const fcmTokenSchema = new mongoose.Schema({
    token: {
      type: String,
      required: true
    },
    device: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      enum: ['ios', 'android'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
});

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
    },
    phone: {
        type: String,
    },
    password: {
        type: String,
        required: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['verified', 'unverified', 'pending'],
        default: 'unverified'
    },
    emailVerificationToken: {
        type: String
    },
    phoneVerificationToken: {
        type: String
    },
    balance: {
        type: Number,
        default: 0
    },
    pin: {
        type: String,
        select: false
    },
    role: {
        type: String,
        enum: ['user', 'doer', 'admin'],
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    fcmTokens: [fcmTokenSchema],

    // Common Profile Fields
    profilePhoto: {
        url: String,
        verified: { 
            type: Boolean, 
            default: false 
        }
    },
    fullName: {
        type: String,
        trim: true
    },
    headline: {
        type: String,
        trim: true
    },
    aboutSection: {
        type: String,
        trim: true
    },
    identificationDocument: {
        type: {
            type: String,
            enum: ['passport', 'national_id']
        },
        number: String,
        url: String,
        publicId: String,
        width: Number,
        height: Number,
        format: String,
        resourceType: String,
        verified: { 
            type: Boolean, 
            default: false 
        }
    },
    employmentStatus: {
        type: String,
        enum: ['employed', 'self-employed', 'unemployed', 'student']
    },
    location: locationSchema,
    residence: {
        type: String
    },
    spokenLanguages: [{
        language: [String],
        proficiency: {
            type: String,
            enum: ['basic', 'intermediate', 'fluent', 'native']
        }
    }],
    preferredPaymentMethods: [{
        type: String,
        enum: ['bank_transfer', 'mobile_money', 'cash']
    }],
    paymentDetails: [paymentDetailsSchema],

    // Doer-specific fields
    doerProfile: {
        availability: {
            schedule: [{
                day: {
                    type: String,
                    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                },
                available: Boolean,
                hours: {
                    from: String,
                    to: String
                }
            }],
            status: {
                type: String,
                enum: ['available', 'busy', 'unavailable'],
                default: 'available'
            }
        },
        skills: [{
            name: String,
            yearsOfExperience: Number,
            certification: String
        }],
        services: [{
            name: String,
            description: String,
            basePrice: Number,
            category: String
        }],
        serviceRadius: {
            distance: Number,
            unit: {
                type: String,
                enum: ['km', 'miles'],
                default: 'km'
            }
        },
        locationSharingEnabled: {
            type: Boolean,
            default: false
        },
        insurance: {
            provider: String,
            policyNumber: String,
            expiryDate: Date,
            coverageType: String
        },
        ratings: {
            average: {
                type: Number,
                default: 0
            },
            count: {
                type: Number,
                default: 0
            }
        },
        completedTasks: {
            type: Number,
            default: 0
        },
        currentLocation: {
            type: {
                type: String,
                default: "Point",
                enum: ["Point"]
            },
            coordinates: {
                type: [Number],
                default: undefined 
            }
        },
        activeTask: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task'
        },
        preferredRadius: {
            type: Number,
            default: 10 
        },
        hourlyRate: {
            type: Number,
            default: undefined 
        }
    },
    
    // Profile completion tracking
    profileCompletionStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'verified'],
        default: 'pending'
    },
    profileCompletionPercentage: {
        type: Number,
        default: 0
    },
    verificationStatus: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified'
    }, 
    updatedAt: Date,
}, {
    timestamps: true
});

// Indexes
// UserSchema.index({ 'location': '2dsphere' });
UserSchema.index({ 'location.coordinates': '2dsphere' });
UserSchema.index({ 'doerProfile.currentLocation': '2dsphere' });
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ phone: 1 }, { sparse: true });

// Password hashing middleware
UserSchema.pre('save', async function(next) {
    try {
        if (this.isModified('password')) {
            this.password = await bcrypt.hash(this.password, 10);
        }
        if (this.isModified('pin')) {
            this.pin = await bcrypt.hash(this.pin, 10);
        }
        next();
    } catch (err) {
        next(err);
    }
});

// Method to check if user is a doer
UserSchema.methods.isDoer = function() {
    return this.role === 'doer';
};

// Method to check if profile is complete
UserSchema.methods.isProfileComplete = function() {
    return this.profileCompletionStatus === 'completed' || this.profileCompletionStatus === 'verified';
};

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to compare PIN
UserSchema.methods.comparePin = async function(candidatePin) {
    return await bcrypt.compare(candidatePin, this.pin);
};

// Add method to manage FCM tokens
UserSchema.methods.addFcmToken = async function(token, device, platform) {
    if (!this.fcmTokens) {
      this.fcmTokens = [];
    }
    
    // Check if token already exists
    const tokenExists = this.fcmTokens.find(t => t.token === token);
    if (!tokenExists) {
      this.fcmTokens.push({ token, device, platform });
      await this.save();
    }
    return this;
  };

module.exports = mongoose.model('User', UserSchema);