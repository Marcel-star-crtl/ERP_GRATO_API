const BehavioralEvaluation = require('../models/BehavioralEvaluation');
const User = require('../models/User');
const { sendEvaluationEmail } = require('../services/emailService');

// Default behavioral criteria
const DEFAULT_CRITERIA = [
  'Attendance & Punctuality',
  'Teamwork & Collaboration',
  'Communication Skills',
  'Initiative & Proactivity',
  'Professionalism',
  'Adaptability',
  'Problem Solving',
  'Time Management'
];

// Create or update behavioral evaluation
const createOrUpdateEvaluation = async (req, res) => {
  try {
    const { employeeId, quarter, criteria, overallComments } = req.body;
    const evaluatorId = req.user.userId;

    console.log('=== CREATE/UPDATE BEHAVIORAL EVALUATION ===');
    console.log('Evaluator:', evaluatorId);
    console.log('Employee:', employeeId);
    console.log('Quarter:', quarter);

    // Validate quarter format
    if (!/^Q[1-4]-\d{4}$/.test(quarter)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quarter format. Use Q1-2025, Q2-2025, etc.'
      });
    }

    // Validate criteria
    if (!criteria || !Array.isArray(criteria) || criteria.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'At least 5 behavioral criteria must be evaluated'
      });
    }

    // Validate each criterion
    for (const criterion of criteria) {
      if (!criterion.name || !criterion.score) {
        return res.status(400).json({
          success: false,
          message: 'Each criterion must have a name and score'
        });
      }
      if (criterion.score < 1 || criterion.score > 5) {
        return res.status(400).json({
          success: false,
          message: 'Scores must be between 1 and 5'
        });
      }
    }

    const evaluator = await User.findById(evaluatorId);
    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if evaluator is supervisor
    if (evaluator.role !== 'supervisor' && evaluator.role !== 'admin' && evaluator.role !== 'supply_chain') {
      return res.status(403).json({
        success: false,
        message: 'Only supervisors can create behavioral evaluations'
      });
    }

    // For supervisors, verify they supervise this employee
    if (evaluator.role === 'supervisor' && employee.department !== evaluator.department) {
      return res.status(403).json({
        success: false,
        message: 'You can only evaluate employees in your department'
      });
    }

    const [, year] = quarter.split('-');

    // Check if evaluation already exists
    let evaluation = await BehavioralEvaluation.findOne({
      employee: employeeId,
      quarter: quarter
    });

    if (evaluation) {
      // Update existing evaluation (only if not submitted)
      if (evaluation.status === 'submitted' || evaluation.status === 'acknowledged') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify a submitted evaluation'
        });
      }

      evaluation.criteria = criteria;
      evaluation.overallComments = overallComments || '';
      evaluation.evaluator = evaluatorId;

      console.log('Updating existing evaluation');
    } else {
      // Create new evaluation
      evaluation = new BehavioralEvaluation({
        employee: employeeId,
        evaluator: evaluatorId,
        quarter: quarter,
        year: parseInt(year),
        criteria: criteria,
        overallComments: overallComments || ''
      });

      console.log('Creating new evaluation');
    }

    await evaluation.save();

    await evaluation.populate([
      { path: 'employee', select: 'fullName email department' },
      { path: 'evaluator', select: 'fullName email' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Behavioral evaluation saved successfully',
      data: evaluation
    });

  } catch (error) {
    console.error('Create/Update behavioral evaluation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save behavioral evaluation',
      error: error.message
    });
  }
};

// Submit behavioral evaluation
const submitEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const evaluatorId = req.user.userId;

    const evaluation = await BehavioralEvaluation.findOne({
      _id: id,
      evaluator: evaluatorId
    }).populate('employee', 'fullName email department');

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Evaluation not found'
      });
    }

    if (evaluation.status === 'submitted' || evaluation.status === 'acknowledged') {
      return res.status(400).json({
        success: false,
        message: 'Evaluation is already submitted'
      });
    }

    evaluation.submit();
    await evaluation.save();

    // Send notification to employee
    const evaluator = await User.findById(evaluatorId);
    try {
      await sendEvaluationEmail.behavioralEvaluationSubmitted(
        evaluation.employee.email,
        evaluation.employee.fullName,
        evaluator.fullName,
        evaluation.quarter,
        evaluation.overallBehavioralScore,
        evaluation._id
      );
    } catch (emailError) {
      console.error('Failed to send evaluation submission email:', emailError);
    }

    res.json({
      success: true,
      message: 'Behavioral evaluation submitted successfully',
      data: evaluation
    });

  } catch (error) {
    console.error('Submit evaluation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit evaluation',
      error: error.message
    });
  }
};

// Employee acknowledges evaluation
const acknowledgeEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const evaluation = await BehavioralEvaluation.findOne({
      _id: id,
      employee: userId
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Evaluation not found'
      });
    }

    if (evaluation.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Evaluation must be submitted before acknowledgment'
      });
    }

    evaluation.acknowledge(userId);
    await evaluation.save();

    res.json({
      success: true,
      message: 'Evaluation acknowledged successfully',
      data: evaluation
    });

  } catch (error) {
    console.error('Acknowledge evaluation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge evaluation',
      error: error.message
    });
  }
};

// Get evaluations (for supervisors)
const getEvaluations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { quarter, status, employeeId } = req.query;
    const user = await User.findById(userId);

    let filter = {};

    if (user.role === 'supervisor') {
      // Get all employees in supervisor's department
      const departmentEmployees = await User.find({ 
        department: user.department,
        role: { $ne: 'supervisor' }
      }).select('_id');
      
      filter.employee = { $in: departmentEmployees.map(e => e._id) };
    } else if (!['admin', 'supply_chain'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (quarter) filter.quarter = quarter;
    if (status) filter.status = status;
    if (employeeId) filter.employee = employeeId;

    const evaluations = await BehavioralEvaluation.find(filter)
      .populate('employee', 'fullName email department position')
      .populate('evaluator', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: evaluations,
      count: evaluations.length
    });

  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evaluations',
      error: error.message
    });
  }
};

// Get employee's evaluations
const getEmployeeEvaluations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { quarter } = req.query;

    const filter = { employee: userId };
    if (quarter) filter.quarter = quarter;

    const evaluations = await BehavioralEvaluation.find(filter)
      .populate('evaluator', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: evaluations
    });

  } catch (error) {
    console.error('Get employee evaluations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evaluations',
      error: error.message
    });
  }
};

// Get single evaluation
const getEvaluationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const user = await User.findById(userId);

    const evaluation = await BehavioralEvaluation.findById(id)
      .populate('employee', 'fullName email department position')
      .populate('evaluator', 'fullName email');

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Evaluation not found'
      });
    }

    // Check access permissions
    const isEmployee = evaluation.employee._id.equals(userId);
    const isEvaluator = evaluation.evaluator._id.equals(userId);
    const isAdmin = ['admin', 'supply_chain'].includes(user.role);

    if (!isEmployee && !isEvaluator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: evaluation
    });

  } catch (error) {
    console.error('Get evaluation by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evaluation',
      error: error.message
    });
  }
};

// Delete evaluation (only draft)
const deleteEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const evaluation = await BehavioralEvaluation.findOne({
      _id: id,
      evaluator: userId
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Evaluation not found'
      });
    }

    if (evaluation.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete draft evaluations'
      });
    }

    await evaluation.deleteOne();

    res.json({
      success: true,
      message: 'Evaluation deleted successfully'
    });

  } catch (error) {
    console.error('Delete evaluation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete evaluation',
      error: error.message
    });
  }
};

// Get default criteria
const getDefaultCriteria = async (req, res) => {
  try {
    res.json({
      success: true,
      data: DEFAULT_CRITERIA.map(name => ({
        name,
        score: null,
        comments: ''
      }))
    });
  } catch (error) {
    console.error('Get default criteria error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default criteria',
      error: error.message
    });
  }
};

module.exports = {
  createOrUpdateEvaluation,
  submitEvaluation,
  acknowledgeEvaluation,
  getEvaluations,
  getEmployeeEvaluations,
  getEvaluationById,
  deleteEvaluation,
  getDefaultCriteria,
  DEFAULT_CRITERIA
};