// config/poApprovalChain.js

const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

/**
 * Get PO approval chain (3 levels):
 * Level 1: Department Head
 * Level 2: Head of Business (President)
 * Level 3: Finance Officer
 */
const getPOApprovalChain = (department) => {
  console.log(`\n=== BUILDING PO APPROVAL CHAIN ===`);
  console.log(`Department: ${department}`);
  
  const chain = [];
  
  // Department mapping
  const departmentMapping = {
    'HR & Admin': 'HR & Admin',
    'HR/Admin': 'HR & Admin',
    'Technical': 'Technical',
    'Business Development': 'Business Development & Supply Chain',
    'Business Dev': 'Business Development & Supply Chain',
    'Supply Chain': 'Supply Chain',
    'Finance': 'Finance'
  };
  
  const mappedDepartment = departmentMapping[department] || department;
  const deptData = DEPARTMENT_STRUCTURE[mappedDepartment];
  
  if (!deptData) {
    console.error(`❌ Department not found: ${department}`);
    throw new Error(`Department configuration not found for: ${department}`);
  }
  
  // Level 1: Department Head
  chain.push({
    level: 1,
    approver: deptData.head,
    email: deptData.headEmail,
    role: 'Department Head',
    department: mappedDepartment
  });
  
  console.log(`✓ Level 1: ${deptData.head} (Department Head) - ${deptData.headEmail}`);
  
  // Level 2: Head of Business (President)
  const executive = DEPARTMENT_STRUCTURE['Executive'];
  if (!executive) {
    console.error('❌ Executive department not found');
    throw new Error('Executive configuration missing');
  }
  
  chain.push({
    level: 2,
    approver: executive.head,
    email: executive.headEmail,
    role: 'Head of Business',
    department: 'Executive'
  });
  
  console.log(`✓ Level 2: ${executive.head} (Head of Business) - ${executive.headEmail}`);
  
  // Level 3: Finance Officer (ALWAYS LAST)
  const financeEmail = 'ranibellmambo@gratoengineering.com';
  chain.push({
    level: 3,
    approver: 'Ms. Ranibell Mambo',
    email: financeEmail,
    role: 'Finance Officer',
    department: 'Business Development & Supply Chain'
  });
  
  console.log(`✓ Level 3: Ms. Ranibell Mambo (Finance Officer) - ${financeEmail}`);
  
  const finalChain = chain.map(s => `L${s.level}: ${s.approver} (${s.role})`).join(' → ');
  console.log(`\n✅ Final Chain (3 levels): ${finalChain}`);
  console.log('=== END PO APPROVAL CHAIN ===\n');
  
  return chain;
};

/**
 * Get Supply Chain Coordinator details
 */
const getSupplyChainCoordinator = () => {
  return {
    name: 'Mr. Lukong Lambert',
    email: 'lukong.lambert@gratoglobal.com',
    role: 'Supply Chain Coordinator'
  };
};

module.exports = {
  getPOApprovalChain,
  getSupplyChainCoordinator
};