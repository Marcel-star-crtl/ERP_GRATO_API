const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

/**
 * UPDATED: Get 3-level supplier invoice approval chain
 * Level 1: Department Head
 * Level 2: Head of Business (President)
 * Level 3: Finance Officer (ALWAYS LAST)
 * 
 * Note: Supply Chain Coordinator reviews BEFORE this chain starts
 */
const getSupplierApprovalChain = (department, serviceCategory) => {
  const chain = [];
  
  console.log(`\n=== BUILDING SUPPLIER APPROVAL CHAIN ===`);
  console.log(`Department: ${department}`);
  console.log(`Service Category: ${serviceCategory}`);

  // LEVEL 1: Department Head
  const deptHead = DEPARTMENT_STRUCTURE[department];
  if (deptHead && deptHead.head) {
    chain.push({
      level: 1,
      approver: deptHead.head.name,
      email: deptHead.head.email,
      role: 'Department Head',
      department: department
    });
    console.log(`✓ Level 1: ${deptHead.head.name} (Department Head) - ${deptHead.head.email}`);
  } else {
    console.warn(`⚠ Department head not found for ${department}`);
  }

  // LEVEL 2: Head of Business / President
  const executive = DEPARTMENT_STRUCTURE['Business Development & Supply Chain'];
  if (executive && executive.head) {
    chain.push({
      level: 2,
      approver: executive.head.name,
      email: executive.head.email,
      role: 'Head of Business',
      department: 'Business Development & Supply Chain'
    });
    console.log(`✓ Level 2: ${executive.head.name} (Head of Business) - ${executive.head.email}`);
  }

  // LEVEL 3: Finance Officer (ALWAYS LAST)
  chain.push({
    level: 3,
    approver: 'Ms. Ranibell Mambo',
    email: 'ranibellmambo@gratoengineering.com',
    role: 'Finance Officer',
    department: 'Business Development & Supply Chain'
  });
  console.log(`✓ Level 3: Ms. Ranibell Mambo (Finance Officer) - ranibellmambo@gratoengineering.com`);

  const finalChain = chain.map(s => `L${s.level}: ${s.approver} (${s.role})`).join(' → ');
  console.log(`\n✅ Final Chain (${chain.length} levels): ${finalChain}`);
  console.log('=== END APPROVAL CHAIN ===\n');

  return chain;
};

/**
 * NEW: Get Supply Chain Coordinator info
 */
const getSupplyChainCoordinator = () => {
  return {
    name: 'Mr. Lukong Lambert',
    email: 'lukong.lambert@gratoglobal.com',
    role: 'Supply Chain Coordinator',
    department: 'Business Development & Supply Chain'
  };
};

module.exports = {
  getSupplierApprovalChain,
  getSupplyChainCoordinator
};



