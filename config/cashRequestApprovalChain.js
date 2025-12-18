const { getApprovalChainFromStructure } = require('./departmentStructure');

/**
 * FIXED: Get cash request approval chain with Finance ALWAYS as final step
 * 
 * @param {string} employeeEmail - Email of employee requesting cash
 * @returns {array} - Approval chain with levels, Finance always as final step
 */
const getCashRequestApprovalChain = (employeeEmail) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== BUILDING CASH REQUEST APPROVAL CHAIN ===`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🔹 Employee Email: ${employeeEmail}`);
  console.log(`🔹 Timestamp: ${new Date().toISOString()}`);

  // Validate input
  if (!employeeEmail || typeof employeeEmail !== 'string') {
    console.error('❌ Invalid employee email provided');
    console.error(`   Type: ${typeof employeeEmail}`);
    console.error(`   Value: ${employeeEmail}`);
    return getFallbackApprovalChain();
  }

  console.log(`✓ Input validation passed`);

  // STEP 1: Get base approval chain from structure
  console.log(`\n--- STEP 1: Getting Base Approval Chain ---`);
  const baseApprovalChain = getApprovalChainFromStructure(employeeEmail);

  console.log(`Base chain result type: ${typeof baseApprovalChain}`);
  console.log(`Base chain is array: ${Array.isArray(baseApprovalChain)}`);
  console.log(`Base chain length: ${baseApprovalChain?.length || 0}`);

  if (!baseApprovalChain || baseApprovalChain.length === 0) {
    console.warn(`⚠️ No approval chain found for ${employeeEmail}`);
    console.warn(`⚠️ Returning fallback chain`);
    return getFallbackApprovalChain();
  }

  console.log(`✓ Base approval chain retrieved: ${baseApprovalChain.length} levels`);
  console.log(`\nBase chain details:`);
  baseApprovalChain.forEach((step, index) => {
    console.log(`  [${index}] Level ${step.level}: ${step.approver?.name} (${step.approver?.email}) - ${step.approver?.role}`);
  });

  // STEP 2: Define Finance Officer constant
  console.log(`\n--- STEP 2: Defining Finance Officer ---`);
  const FINANCE_OFFICER = {
    name: 'Ms. Ranibell Mambo',
    email: 'ranibellmambo@gratoengineering.com',
    role: 'Finance Officer',
    department: 'Finance'
  };
  console.log(`Finance Officer defined:`, FINANCE_OFFICER);

  // STEP 3: Check if Finance is already in the base chain
  console.log(`\n--- STEP 3: Checking for Existing Finance Officer ---`);
  const financeIndex = baseApprovalChain.findIndex(step => {
    const stepEmail = step.approver?.email?.toLowerCase();
    const financeEmail = FINANCE_OFFICER.email.toLowerCase();
    console.log(`  Comparing: "${stepEmail}" === "${financeEmail}" ? ${stepEmail === financeEmail}`);
    return stepEmail === financeEmail;
  });

  const hasFinance = financeIndex !== -1;
  console.log(`Finance Officer found in base chain: ${hasFinance}`);
  if (hasFinance) {
    console.log(`  Position: ${financeIndex + 1}`);
  }

  // STEP 4: Process the chain
  console.log(`\n--- STEP 4: Processing Approval Chain ---`);
  let processedChain;

  if (hasFinance) {
    console.log(`⚠️ Finance already exists at position ${financeIndex + 1}`);
    console.log(`   Action: Remove from current position and append at end`);
    
    // Remove Finance from current position
    const financeStep = baseApprovalChain.splice(financeIndex, 1)[0];
    console.log(`   Removed Finance step:`, financeStep);
    console.log(`   Remaining base chain length: ${baseApprovalChain.length}`);
    
    // Process remaining chain
    console.log(`\n   Processing remaining ${baseApprovalChain.length} step(s):`);
    processedChain = baseApprovalChain.map((step, index) => {
      const approver = step.approver || {};
      const newLevel = index + 1;
      
      const processed = {
        level: newLevel,
        approver: {
          name: String(approver.name || 'Unknown Approver').trim(),
          email: String(approver.email || '').trim().toLowerCase(),
          role: mapRoleForCashApproval(approver.role || 'Approver', newLevel, approver.email),
          department: String(approver.department || 'Unknown Department').trim()
        },
        status: 'pending',
        assignedDate: index === 0 ? new Date() : null,
        comments: '',
        actionDate: null,
        actionTime: null,
        decidedBy: null
      };
      
      console.log(`     [${index}] L${newLevel}: ${processed.approver.name} (${processed.approver.role})`);
      return processed;
    });

    // Add Finance at the end
    const finalLevel = processedChain.length + 1;
    const financeStepFinal = {
      level: finalLevel,
      approver: {
        name: FINANCE_OFFICER.name,
        email: FINANCE_OFFICER.email,
        role: FINANCE_OFFICER.role,
        department: FINANCE_OFFICER.department
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    };

    processedChain.push(financeStepFinal);
    console.log(`\n   ✅ Finance Officer appended as Level ${finalLevel}`);
    console.log(`   Final processed chain length: ${processedChain.length}`);

  } else {
    console.log(`✅ Finance NOT in base chain - will append as final step`);
    
    // Process base chain
    console.log(`\n   Processing ${baseApprovalChain.length} base step(s):`);
    processedChain = baseApprovalChain.map((step, index) => {
      const approver = step.approver || {};
      const newLevel = index + 1;
      
      const processed = {
        level: newLevel,
        approver: {
          name: String(approver.name || 'Unknown Approver').trim(),
          email: String(approver.email || '').trim().toLowerCase(),
          role: mapRoleForCashApproval(approver.role || 'Approver', newLevel, approver.email),
          department: String(approver.department || 'Unknown Department').trim()
        },
        status: 'pending',
        assignedDate: index === 0 ? new Date() : null,
        comments: '',
        actionDate: null,
        actionTime: null,
        decidedBy: null
      };
      
      console.log(`     [${index}] L${newLevel}: ${processed.approver.name} (${processed.approver.role})`);
      return processed;
    });

    console.log(`\n   Processed chain length BEFORE Finance: ${processedChain.length}`);

    // CRITICAL: Append Finance Officer as final step
    const finalLevel = processedChain.length + 1;
    console.log(`   Calculating final level: ${processedChain.length} + 1 = ${finalLevel}`);
    
    const financeStepFinal = {
      level: finalLevel,
      approver: {
        name: FINANCE_OFFICER.name,
        email: FINANCE_OFFICER.email,
        role: FINANCE_OFFICER.role,
        department: FINANCE_OFFICER.department
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    };

    console.log(`\n   Creating Finance step:`, JSON.stringify(financeStepFinal, null, 2));
    console.log(`   Pushing Finance step to array...`);
    
    processedChain.push(financeStepFinal);
    
    console.log(`   ✅ Finance Officer pushed to array`);
    console.log(`   Final processed chain length AFTER Finance: ${processedChain.length}`);
  }

  // STEP 5: Validate final chain
  console.log(`\n--- STEP 5: Validating Final Chain ---`);
  console.log(`Chain to validate - Length: ${processedChain.length}`);
  console.log(`Chain to validate - Is Array: ${Array.isArray(processedChain)}`);
  
  console.log(`\nFull chain before validation:`);
  processedChain.forEach((step, index) => {
    console.log(`  [${index}] L${step.level}: ${step.approver.name} (${step.approver.role}) - ${step.approver.email}`);
  });

  const validation = validateCashApprovalChain(processedChain);
  console.log(`\nValidation result:`, validation);

  if (!validation.valid) {
    console.error('❌ VALIDATION FAILED');
    console.error(`   Error: ${validation.error}`);
    console.error(`\n   Chain that failed:`);
    console.error(JSON.stringify(processedChain, null, 2));
    console.error(`\n   Returning fallback chain instead`);
    return getFallbackApprovalChain();
  }

  console.log(`✅ Validation PASSED`);

  // STEP 6: Final summary
  console.log(`\n--- FINAL SUMMARY ---`);
  console.log(`✅ Cash approval chain created with ${processedChain.length} levels`);
  
  const chainSummary = processedChain.map(s => 
    `L${s.level}: ${s.approver.name} (${s.approver.role})`
  ).join(' → ');
  console.log(`\nChain: ${chainSummary}`);
  
  console.log(`\nLast approver check:`);
  const lastStep = processedChain[processedChain.length - 1];
  console.log(`  Name: ${lastStep.approver.name}`);
  console.log(`  Role: ${lastStep.approver.role}`);
  console.log(`  Email: ${lastStep.approver.email}`);
  console.log(`  Is Finance: ${lastStep.approver.role === 'Finance Officer'}`);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== END APPROVAL CHAIN BUILD ===`);
  console.log(`${'='.repeat(60)}\n`);

  return processedChain;
};

/**
 * Map role from structure to cash approval role
 */
const mapRoleForCashApproval = (structureRole, level, email = '') => {
  const role = String(structureRole || '');
  const roleLower = role.toLowerCase();
  const emailLower = String(email || '').toLowerCase();
  
  console.log(`      Mapping role: "${role}" at level ${level} for email "${emailLower}"`);
  
  // CRITICAL: Finance Officer role mapping by email (most reliable)
  if (emailLower === 'ranibellmambo@gratoengineering.com') {
    console.log(`      ✓ Mapped to: Finance Officer (by email)`);
    return 'Finance Officer';
  }

  // Finance role mapping by keyword
  if (roleLower.includes('finance')) {
    console.log(`      ✓ Mapped to: Finance Officer (by keyword)`);
    return 'Finance Officer';
  }
  
  // President / Head of Business
  if (roleLower.includes('president') || roleLower === 'head of business') {
    console.log(`      ✓ Mapped to: Head of Business`);
    return 'Head of Business';
  }
  
  // Department Heads and Directors
  if (roleLower.includes('head') || roleLower.includes('director')) {
    console.log(`      ✓ Mapped to: Departmental Head`);
    return 'Departmental Head';
  }

  // Supervisors and Managers
  if (roleLower.includes('supervisor') || roleLower.includes('manager') || roleLower.includes('coordinator')) {
    console.log(`      ✓ Mapped to: Supervisor`);
    return 'Supervisor';
  }

  // Fallback to level-based mapping (dynamic)
  let mappedRole = role;
  if (level === 1) mappedRole = 'Supervisor';
  else if (level === 2) mappedRole = 'Departmental Head';
  else if (level === 3) mappedRole = 'Head of Business';
  
  console.log(`      ✓ Mapped to: ${mappedRole} (by level fallback)`);
  return mappedRole;
};

/**
 * FIXED: Fallback cash approval chain with Finance as final step
 */
const getFallbackApprovalChain = () => {
  console.warn('\n⚠️⚠️⚠️ USING FALLBACK APPROVAL CHAIN ⚠️⚠️⚠️');
  console.warn('Employee not found in department structure');
  console.warn('This employee should be added to config/departmentStructure.js\n');
  
  const fallbackChain = [
    {
      level: 1,
      approver: {
        name: 'Mrs. Bruiline Tsitoh',
        email: 'bruiline.tsitoh@gratoglobal.com',
        role: 'Supervisor',
        department: 'HR & Admin'
      },
      status: 'pending',
      assignedDate: new Date(),
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    },
    {
      level: 2,
      approver: {
        name: 'Mrs. Bruiline Tsitoh',
        email: 'bruiline.tsitoh@gratoglobal.com',
        role: 'Departmental Head',
        department: 'HR & Admin'
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    },
    {
      level: 3,
      approver: {
        name: 'Mr. E.T Kelvin',
        email: 'kelvin.eyong@gratoglobal.com',
        role: 'Head of Business',
        department: 'Executive'
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    },
    {
      level: 4,
      approver: {
        name: 'Ms. Ranibell Mambo',
        email: 'ranibellmambo@gratoengineering.com',
        role: 'Finance Officer',
        department: 'Finance'
      },
      status: 'pending',
      assignedDate: null,
      comments: '',
      actionDate: null,
      actionTime: null,
      decidedBy: null
    }
  ];

  console.log('Fallback chain created with 4 levels');
  return fallbackChain;
};

/**
 * Get next approval status based on current level
 */
const getNextApprovalStatus = (currentLevel, totalLevels, approvalChain = []) => {
  // Check if we're at the last level
  if (currentLevel === totalLevels) {
    return 'approved'; // Finance approved = fully approved
  }
  
  const nextLevel = currentLevel + 1;
  
  // Check if next level is Finance by examining the approval chain
  if (approvalChain && approvalChain.length > 0) {
    const nextStep = approvalChain.find(s => s.level === nextLevel);
    if (nextStep && nextStep.approver.role === 'Finance Officer') {
      return 'pending_finance';
    }
  }
  
  // Default status mapping
  const statusMap = {
    1: 'pending_supervisor',
    2: 'pending_departmental_head',
    3: 'pending_head_of_business',
    4: 'pending_finance'
  };
  
  return statusMap[nextLevel] || 'pending_finance';
};

/**
 * Check if user can approve cash request at specific level
 */
const canUserApproveAtLevel = (user, approvalStep) => {
  if (!user || !approvalStep) return false;
  
  // Normalize emails for comparison
  const userEmail = String(user.email || '').toLowerCase().trim();
  const stepEmail = String(approvalStep.approver?.email || '').toLowerCase().trim();
  
  // Match by email (most reliable)
  if (userEmail !== stepEmail) return false;
  
  // Check step status is pending
  if (approvalStep.status !== 'pending') return false;
  
  // Admin can approve at levels 2 and 3
  if (user.role === 'admin') {
    return approvalStep.level === 2 || approvalStep.level === 3;
  }
  
  // Finance can approve at their level (final approval)
  if (user.role === 'finance') {
    return approvalStep.approver.role === 'Finance Officer';
  }
  
  // Supervisors can approve at level 1
  if (user.role === 'supervisor') {
    return approvalStep.level === 1;
  }
  
  return false;
};

/**
 * Get user's cash approval level
 */
const getUserApprovalLevel = (userRole, userEmail) => {
  const email = String(userEmail || '').toLowerCase().trim();
  
  // Finance Officer - final approval (dynamic level)
  if (email === 'ranibellmambo@gratoengineering.com' || userRole === 'finance') {
    return 99; // High number to indicate final level
  }
  
  // Head of Business (President)
  if (email === 'kelvin.eyong@gratoglobal.com') {
    return 3;
  }
  
  // Department Heads and Admin
  if (userRole === 'admin') {
    return 2;
  }
  
  // Supervisors
  if (userRole === 'supervisor') {
    return 1;
  }
  
  return 0;
};

/**
 * Validate cash approval chain structure
 * Ensures Finance is the final step
 */
const validateCashApprovalChain = (approvalChain) => {
  console.log(`\n   [VALIDATE] Starting validation...`);
  console.log(`   [VALIDATE] Chain type: ${typeof approvalChain}`);
  console.log(`   [VALIDATE] Is array: ${Array.isArray(approvalChain)}`);
  console.log(`   [VALIDATE] Length: ${approvalChain?.length || 0}`);

  if (!Array.isArray(approvalChain) || approvalChain.length === 0) {
    return { valid: false, error: 'Approval chain must be a non-empty array' };
  }

  // Check if Finance Officer is the last step
  const lastStep = approvalChain[approvalChain.length - 1];
  console.log(`   [VALIDATE] Last step exists: ${!!lastStep}`);
  console.log(`   [VALIDATE] Last step has approver: ${!!lastStep?.approver}`);
  console.log(`   [VALIDATE] Last step role: "${lastStep?.approver?.role}"`);
  console.log(`   [VALIDATE] Last step email: "${lastStep?.approver?.email}"`);

  if (!lastStep || !lastStep.approver) {
    return { valid: false, error: 'Last step is missing approver data' };
  }

  if (lastStep.approver.role !== 'Finance Officer') {
    console.log(`   [VALIDATE] ❌ Finance Officer check FAILED`);
    console.log(`   [VALIDATE]    Expected: "Finance Officer"`);
    console.log(`   [VALIDATE]    Got: "${lastStep.approver.role}"`);
    
    return { 
      valid: false, 
      error: `Finance Officer must be the final approver. Found: ${lastStep.approver.role} (${lastStep.approver.email})`
    };
  }

  console.log(`   [VALIDATE] ✅ Finance Officer is final approver`);

  // Validate each step
  console.log(`   [VALIDATE] Validating ${approvalChain.length} steps...`);
  for (let i = 0; i < approvalChain.length; i++) {
    const step = approvalChain[i];
    
    if (!step.level || typeof step.level !== 'number') {
      return { valid: false, error: `Step ${i + 1}: Missing or invalid level` };
    }

    if (step.level !== i + 1) {
      return { valid: false, error: `Step ${i + 1}: Level mismatch (expected ${i + 1}, got ${step.level})` };
    }

    if (!step.approver || typeof step.approver !== 'object') {
      return { valid: false, error: `Step ${i + 1}: Missing or invalid approver object` };
    }

    const { name, email, role, department } = step.approver;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver name must be a non-empty string` };
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver email must be a non-empty string` };
    }

    if (!role || typeof role !== 'string' || role.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver role must be a non-empty string` };
    }

    if (!department || typeof department !== 'string' || department.trim().length === 0) {
      return { valid: false, error: `Step ${i + 1}: Approver department must be a non-empty string` };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: `Step ${i + 1}: Invalid email format: ${email}` };
    }

    console.log(`   [VALIDATE]   Step ${i + 1}: ✓ ${name} (${role})`);
  }

  console.log(`   [VALIDATE] ✅ All steps validated successfully`);
  return { valid: true };
};

/**
 * Check if a step is Finance approval
 */
const isFinanceStep = (step) => {
  if (!step || !step.approver) return false;
  
  return step.approver.role === 'Finance Officer' || 
         step.approver.email?.toLowerCase() === 'ranibellmambo@gratoengineering.com';
};

module.exports = {
  getCashRequestApprovalChain,
  getNextApprovalStatus,
  canUserApproveAtLevel,
  getUserApprovalLevel,
  getFallbackApprovalChain,
  validateCashApprovalChain,
  validateApprovalChain: validateCashApprovalChain, 
  isFinanceStep
};


