// utils/enhancedDepartmentStructure.js

const ENHANCED_DEPARTMENT_STRUCTURE = {
  'Technical': {
    name: 'Technical',
    head: {
      email: 'didier.oyong@gratoengineering.com',
      name: 'Mr. Didier Oyong',
      position: 'Technical Director',
      reportsTo: 'kelvin.eyong@gratoglobal.com', // Now reports to Kelvin
      hierarchyLevel: 4
    },
    positions: {
      'HSE Coordinator': {
        email: 'bechem.mbu@gratoglobal.com',
        name: 'Mr. Ovo Becheni',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'coordinator'
      },
      'Head of Refurbishment': {
        email: 'verla.ivo@gratoengineering.com',
        name: 'Mr. Yerla Ivo',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'head'
      },
      'Project Manager': {
        email: 'joel@gratoengineering.com',
        name: 'Mr. Joel Wamba',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: ['Site Supervisor'],
        approvalAuthority: 'manager'
      },
      'Operations Manager': {
        email: 'pascal.rodrique@gratoglobal.com',
        name: 'Mr. Pascal Assam',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: ['Data Collector', 'NOC Coordinator'],
        approvalAuthority: 'manager'
      },
      'Diesel Coordinator': {
        email: 'minka.kevin@gratoglobal.com',
        name: 'Mr. Kevin Minka',
        reportsTo: 'didier.oyong@gratoengineering.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'coordinator'
      },
      'Data Collector': {
        email: 'bemba.essack@gratoglobal.com',
        name: 'Mr. Bemba Essack',
        reportsTo: 'pascal.rodrique@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'NOC Coordinator': {
        email: 'rodrigue.nono@gratoglobal.com',
        name: 'Mr. Rodrigue Nono',
        reportsTo: 'pascal.rodrique@gratoglobal.com', // Changed from Kevin
        hierarchyLevel: 2,
        canSupervise: ['NOC Operator'],
        approvalAuthority: 'coordinator'
      },
      'Site Supervisor': {
        email: null, // Multiple instances
        name: 'Site Supervisors',
        reportsTo: 'joel@gratoengineering.com',
        hierarchyLevel: 2,
        canSupervise: ['Field Technician'],
        approvalAuthority: 'supervisor',
        allowMultipleInstances: true // NEW: Handle multiple people in same role
      },
      'Field Technician': {
        email: null,
        name: 'Field Technicians',
        reportsTo: null, // Set dynamically based on assigned Site Supervisor
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: true,
        dynamicSupervisor: true // NEW: Supervisor assigned on creation
      },
      'NOC Operator': {
        email: null,
        name: 'NOC Operators',
        reportsTo: 'rodrigue.nono@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff',
        allowMultipleInstances: true
      }
    }
  },

  'Business Development & Supply Chain': {
    name: 'Business Development & Supply Chain',
    head: {
      email: 'kelvin.eyong@gratoglobal.com',
      name: 'Mr. E.T Kelvin',
      position: 'President / Head of Business',
      reportsTo: null, // Top of hierarchy
      hierarchyLevel: 5
    },
    positions: {
      'Supply Chain Coordinator': {
        email: 'lukong.lambert@gratoglobal.com',
        name: 'Mr. Lukong Lambert',
        reportsTo: 'kelvin.eyong@gratoglobal.com',
        hierarchyLevel: 3,
        canSupervise: ['Order Management Assistant/Buyer', 'Warehouse Coordinator/Buyer'],
        approvalAuthority: 'coordinator',
        specialRole: 'buyer',
        buyerConfig: {
          specializations: ['IT_Accessories', 'Office_Supplies', 'Equipment', 'Consumables', 'Software', 'Hardware', 'Furniture', 'Safety_Equipment', 'Maintenance_Supplies', 'General'],
          maxOrderValue: 10000000,
          canSelfBuy: true
        }
      },
      'Order Management Assistant/Buyer': {
        email: 'christabel@gratoengineering.com',
        name: 'Ms. Christabel Mangwi',
        reportsTo: 'lukong.lambert@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'buyer',
        specialRole: 'buyer',
        buyerConfig: {
          specializations: ['Office_Supplies', 'Consumables', 'General'],
          maxOrderValue: 2000000
        }
      },
      'Warehouse Coordinator/Buyer': {
        email: 'pryde.mua@gratoglobal.com',
        name: 'Mr. Pryde Mua',
        reportsTo: 'lukong.lambert@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: ['Warehouse Assistant'],
        approvalAuthority: 'coordinator',
        specialRole: 'buyer',
        buyerConfig: {
          specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
          maxOrderValue: 5000000
        }
      },
      'Warehouse Assistant': {
        email: 'aghangu.marie@gratoengineering.com',
        name: 'Ms. Aghangu Marie',
        reportsTo: 'pryde.mua@gratoglobal.com',
        hierarchyLevel: 1,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'Finance Officer': {
        email: 'ranibellmambo@gratoengineering.com',
        name: 'Ms. Ranibell Mambo',
        reportsTo: 'kelvin.eyong@gratoglobal.com',
        hierarchyLevel: 3,
        canSupervise: [],
        approvalAuthority: 'finance',
        specialRole: 'finance'
      }
    }
  },

  'HR & Admin': {
    name: 'HR & Admin',
    head: {
      email: 'bruiline.tsitoh@gratoglobal.com',
      name: 'Mrs. Bruiline Tsitoh',
      position: 'HR & Admin Head',
      reportsTo: 'kelvin.eyong@gratoglobal.com', // Now reports to Kelvin
      hierarchyLevel: 4
    },
    positions: {
      'Office Driver/Logistics Assistant': {
        email: 'che.earnest@gratoengineering.com',
        name: 'Mr. Che Earnest',
        reportsTo: 'bruiline.tsitoh@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'IT Staff': {
        email: 'marcel.ngong@gratoglobal.com',
        name: 'Marcel',
        reportsTo: 'bruiline.tsitoh@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      },
      'House Maid': {
        email: 'ndi.belther@gratoengineering.com',
        name: 'Ms. Ndi Belther',
        reportsTo: 'bruiline.tsitoh@gratoglobal.com',
        hierarchyLevel: 2,
        canSupervise: [],
        approvalAuthority: 'staff'
      }
    }
  }
};

/**
 * Find person details by email across all departments
 */
const findPersonByEmail = (email) => {
  for (const [deptKey, dept] of Object.entries(ENHANCED_DEPARTMENT_STRUCTURE)) {
    if (dept.head.email === email) {
      return {
        ...dept.head,
        department: deptKey,
        isDepartmentHead: true
      };
    }

    for (const [position, person] of Object.entries(dept.positions)) {
      if (person.email === email) {
        return {
          ...person,
          position,
          department: deptKey,
          isDepartmentHead: false
        };
      }
    }
  }
  return null;
};

/**
 * Get all supervisable positions for a person
 */
const getSupevisablePositions = (email) => {
  const person = findPersonByEmail(email);
  if (!person || !person.canSupervise) return [];

  return person.canSupervise.map(positionTitle => ({
    position: positionTitle,
    department: person.department
  }));
};

/**
 * Get complete approval chain for an employee
 */
const getApprovalChainFromStructure = (employeeEmail) => {
  const chain = [];
  let currentPerson = findPersonByEmail(employeeEmail);
  
  if (!currentPerson) {
    console.error(`Employee ${employeeEmail} not found in structure`);
    return [];
  }

  let level = 1;
  const seenEmails = new Set([employeeEmail]);

  // Traverse up the hierarchy
  while (currentPerson && currentPerson.reportsTo) {
    const supervisor = findPersonByEmail(currentPerson.reportsTo);
    
    if (!supervisor || seenEmails.has(supervisor.email)) break;

    chain.push({
      level: level++,
      approver: {
        name: supervisor.name,
        email: supervisor.email,
        role: supervisor.isDepartmentHead ? 'Department Head' : supervisor.position,
        department: supervisor.department
      },
      status: 'pending',
      assignedDate: new Date()
    });

    seenEmails.add(supervisor.email);
    currentPerson = supervisor;
  }

  // Always add Finance Officer as final approver (if not already in chain)
  const financeEmail = 'ranibellmambo@gratoengineering.com';
  if (!seenEmails.has(financeEmail)) {
    chain.push({
      level: level++,
      approver: {
        name: 'Ms. Ranibell Mambo',
        email: financeEmail,
        role: 'Finance Officer',
        department: 'Business Development & Supply Chain'
      },
      status: 'pending',
      assignedDate: new Date()
    });
  }

  return chain;
};

/**
 * Get all positions that can be created
 */
const getAllAvailablePositions = () => {
  const positions = [];

  for (const [deptKey, dept] of Object.entries(ENHANCED_DEPARTMENT_STRUCTURE)) {
    // Department head
    positions.push({
      key: `${deptKey}-head`,
      department: deptKey,
      position: dept.head.position,
      name: dept.head.name,
      email: dept.head.email,
      reportsTo: dept.head.reportsTo,
      hierarchyLevel: dept.head.hierarchyLevel,
      isDepartmentHead: true,
      allowMultiple: false
    });

    // All positions
    for (const [posTitle, posData] of Object.entries(dept.positions)) {
      positions.push({
        key: `${deptKey}-${posTitle}`,
        department: deptKey,
        position: posTitle,
        name: posData.name,
        email: posData.email,
        reportsTo: posData.reportsTo,
        hierarchyLevel: posData.hierarchyLevel,
        canSupervise: posData.canSupervise || [],
        approvalAuthority: posData.approvalAuthority,
        specialRole: posData.specialRole,
        buyerConfig: posData.buyerConfig,
        allowMultiple: posData.allowMultipleInstances || false,
        dynamicSupervisor: posData.dynamicSupervisor || false
      });
    }
  }

  return positions;
};

/**
 * Get potential supervisors for a position (for dynamic assignment)
 */
const getPotentialSupervisors = (department, position) => {
  const supervisors = [];
  const dept = ENHANCED_DEPARTMENT_STRUCTURE[department];
  
  if (!dept) return supervisors;

  // Check all positions in department
  for (const [posTitle, posData] of Object.entries(dept.positions)) {
    if (posData.canSupervise && posData.canSupervise.includes(position)) {
      supervisors.push({
        email: posData.email,
        name: posData.name,
        position: posTitle
      });
    }
  }

  return supervisors;
};

module.exports = {
  ENHANCED_DEPARTMENT_STRUCTURE,
  findPersonByEmail,
  getSupevisablePositions,
  getApprovalChainFromStructure,
  getAllAvailablePositions,
  getPotentialSupervisors
};








// // utils/enhancedDepartmentStructure.js

// const ENHANCED_DEPARTMENT_STRUCTURE = {
//   'Technical': {
//     name: 'Technical',
//     head: {
//       email: 'didier.oyong@gratoengineering.com',
//       name: 'Mr. Didier Oyong',
//       position: 'Technical Director',
//       reportsTo: 'kelvin.eyong@gratoglobal.com', // Now reports to Kelvin
//       hierarchyLevel: 4
//     },
//     positions: {
//       'HSE Coordinator': {
//         email: 'bechem.mbu@gratoglobal.com',
//         name: 'Mr. Ovo Becheni',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'coordinator'
//       },
//       'Head of Refurbishment': {
//         email: 'verla.ivo@gratoengineering.com',
//         name: 'Mr. Yerla Ivo',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'head'
//       },
//       'Project Manager': {
//         email: 'joel@gratoengineering.com',
//         name: 'Mr. Joel Wamba',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: ['Site Supervisor'],
//         approvalAuthority: 'manager'
//       },
//       'Operations Manager': {
//         email: 'pascal.rodrique@gratoglobal.com',
//         name: 'Mr. Pascal Assam',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: ['Data Collector', 'NOC Coordinator'],
//         approvalAuthority: 'manager'
//       },
//       'Diesel Coordinator': {
//         email: 'minka.kevin@gratoglobal.com',
//         name: 'Mr. Kevin Minka',
//         reportsTo: 'didier.oyong@gratoengineering.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'coordinator'
//       },
//       'Data Collector': {
//         email: 'bemba.essack@gratoglobal.com',
//         name: 'Mr. Bemba Essack',
//         reportsTo: 'pascal.rodrique@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'NOC Coordinator': {
//         email: 'rodrigue.nono@gratoglobal.com',
//         name: 'Mr. Rodrigue Nono',
//         reportsTo: 'pascal.rodrique@gratoglobal.com', // Changed from Kevin
//         hierarchyLevel: 2,
//         canSupervise: ['NOC Operator'],
//         approvalAuthority: 'coordinator'
//       },
//       'Site Supervisor': {
//         email: null, // Multiple instances
//         name: 'Site Supervisors',
//         reportsTo: 'joel@gratoengineering.com',
//         hierarchyLevel: 2,
//         canSupervise: ['Field Technician'],
//         approvalAuthority: 'supervisor',
//         allowMultipleInstances: true // NEW: Handle multiple people in same role
//       },
//       'Field Technician': {
//         email: null,
//         name: 'Field Technicians',
//         reportsTo: null, // Set dynamically based on assigned Site Supervisor
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: true,
//         dynamicSupervisor: true // NEW: Supervisor assigned on creation
//       },
//       'NOC Operator': {
//         email: null,
//         name: 'NOC Operators',
//         reportsTo: 'rodrigue.nono@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff',
//         allowMultipleInstances: true
//       }
//     }
//   },

//   'Business Development & Supply Chain': {
//     name: 'Business Development & Supply Chain',
//     head: {
//       email: 'kelvin.eyong@gratoglobal.com',
//       name: 'Mr. E.T Kelvin',
//       position: 'President / Head of Business',
//       reportsTo: null, // Top of hierarchy
//       hierarchyLevel: 5
//     },
//     positions: {
//       'Supply Chain Coordinator': {
//         email: 'lukong.lambert@gratoglobal.com',
//         name: 'Mr. Lukong Lambert',
//         reportsTo: 'kelvin.eyong@gratoglobal.com',
//         hierarchyLevel: 3,
//         canSupervise: ['Order Management Assistant/Buyer', 'Warehouse Coordinator/Buyer'],
//         approvalAuthority: 'coordinator',
//         specialRole: 'buyer',
//         buyerConfig: {
//           specializations: ['All'],
//           maxOrderValue: 10000000,
//           canSelfBuy: true
//         }
//       },
//       'Order Management Assistant/Buyer': {
//         email: 'christabel@gratoengineering.com',
//         name: 'Ms. Christabel Mangwi',
//         reportsTo: 'lukong.lambert@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'buyer',
//         specialRole: 'buyer',
//         buyerConfig: {
//           specializations: ['Office_Supplies', 'Consumables', 'General'],
//           maxOrderValue: 2000000
//         }
//       },
//       'Warehouse Coordinator/Buyer': {
//         email: 'pryde.mua@gratoglobal.com',
//         name: 'Mr. Pryde Mua',
//         reportsTo: 'lukong.lambert@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: ['Warehouse Assistant'],
//         approvalAuthority: 'coordinator',
//         specialRole: 'buyer',
//         buyerConfig: {
//           specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
//           maxOrderValue: 5000000
//         }
//       },
//       'Warehouse Assistant': {
//         email: 'aghangu.marie@gratoengineering.com',
//         name: 'Ms. Aghangu Marie',
//         reportsTo: 'pryde.mua@gratoglobal.com',
//         hierarchyLevel: 1,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'Finance Officer': {
//         email: 'ranibellmambo@gratoengineering.com',
//         name: 'Ms. Ranibell Mambo',
//         reportsTo: 'kelvin.eyong@gratoglobal.com',
//         hierarchyLevel: 3,
//         canSupervise: [],
//         approvalAuthority: 'finance',
//         specialRole: 'finance'
//       }
//     }
//   },

//   'HR & Admin': {
//     name: 'HR & Admin',
//     head: {
//       email: 'bruiline.tsitoh@gratoglobal.com',
//       name: 'Mrs. Bruiline Tsitoh',
//       position: 'HR & Admin Head',
//       reportsTo: 'kelvin.eyong@gratoglobal.com', // Now reports to Kelvin
//       hierarchyLevel: 4
//     },
//     positions: {
//       'Office Driver/Logistics Assistant': {
//         email: 'che.earnest@gratoengineering.com',
//         name: 'Mr. Che Earnest',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'IT Staff': {
//         email: 'marcel.ngong@gratoglobal.com',
//         name: 'Marcel',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       },
//       'House Maid': {
//         email: 'ndi.belther@gratoengineering.com',
//         name: 'Ms. Ndi Belther',
//         reportsTo: 'bruiline.tsitoh@gratoglobal.com',
//         hierarchyLevel: 2,
//         canSupervise: [],
//         approvalAuthority: 'staff'
//       }
//     }
//   }
// };

// /**
//  * Find person details by email across all departments
//  */
// const findPersonByEmail = (email) => {
//   for (const [deptKey, dept] of Object.entries(ENHANCED_DEPARTMENT_STRUCTURE)) {
//     if (dept.head.email === email) {
//       return {
//         ...dept.head,
//         department: deptKey,
//         isDepartmentHead: true
//       };
//     }

//     for (const [position, person] of Object.entries(dept.positions)) {
//       if (person.email === email) {
//         return {
//           ...person,
//           position,
//           department: deptKey,
//           isDepartmentHead: false
//         };
//       }
//     }
//   }
//   return null;
// };

// /**
//  * Get all supervisable positions for a person
//  */
// const getSupevisablePositions = (email) => {
//   const person = findPersonByEmail(email);
//   if (!person || !person.canSupervise) return [];

//   return person.canSupervise.map(positionTitle => ({
//     position: positionTitle,
//     department: person.department
//   }));
// };

// /**
//  * Get complete approval chain for an employee
//  */
// const getApprovalChainFromStructure = (employeeEmail) => {
//   const chain = [];
//   let currentPerson = findPersonByEmail(employeeEmail);
  
//   if (!currentPerson) {
//     console.error(`Employee ${employeeEmail} not found in structure`);
//     return [];
//   }

//   let level = 1;
//   const seenEmails = new Set([employeeEmail]);

//   // Traverse up the hierarchy
//   while (currentPerson && currentPerson.reportsTo) {
//     const supervisor = findPersonByEmail(currentPerson.reportsTo);
    
//     if (!supervisor || seenEmails.has(supervisor.email)) break;

//     chain.push({
//       level: level++,
//       approver: {
//         name: supervisor.name,
//         email: supervisor.email,
//         role: supervisor.isDepartmentHead ? 'Department Head' : supervisor.position,
//         department: supervisor.department
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });

//     seenEmails.add(supervisor.email);
//     currentPerson = supervisor;
//   }

//   // Always add Finance Officer as final approver (if not already in chain)
//   const financeEmail = 'ranibellmambo@gratoengineering.com';
//   if (!seenEmails.has(financeEmail)) {
//     chain.push({
//       level: level++,
//       approver: {
//         name: 'Ms. Ranibell Mambo',
//         email: financeEmail,
//         role: 'Finance Officer',
//         department: 'Business Development & Supply Chain'
//       },
//       status: 'pending',
//       assignedDate: new Date()
//     });
//   }

//   return chain;
// };

// /**
//  * Get all positions that can be created
//  */
// const getAllAvailablePositions = () => {
//   const positions = [];

//   for (const [deptKey, dept] of Object.entries(ENHANCED_DEPARTMENT_STRUCTURE)) {
//     // Department head
//     positions.push({
//       key: `${deptKey}-head`,
//       department: deptKey,
//       position: dept.head.position,
//       name: dept.head.name,
//       email: dept.head.email,
//       reportsTo: dept.head.reportsTo,
//       hierarchyLevel: dept.head.hierarchyLevel,
//       isDepartmentHead: true,
//       allowMultiple: false
//     });

//     // All positions
//     for (const [posTitle, posData] of Object.entries(dept.positions)) {
//       positions.push({
//         key: `${deptKey}-${posTitle}`,
//         department: deptKey,
//         position: posTitle,
//         name: posData.name,
//         email: posData.email,
//         reportsTo: posData.reportsTo,
//         hierarchyLevel: posData.hierarchyLevel,
//         canSupervise: posData.canSupervise || [],
//         approvalAuthority: posData.approvalAuthority,
//         specialRole: posData.specialRole,
//         buyerConfig: posData.buyerConfig,
//         allowMultiple: posData.allowMultipleInstances || false,
//         dynamicSupervisor: posData.dynamicSupervisor || false
//       });
//     }
//   }

//   return positions;
// };

// /**
//  * Get potential supervisors for a position (for dynamic assignment)
//  */
// const getPotentialSupervisors = (department, position) => {
//   const supervisors = [];
//   const dept = ENHANCED_DEPARTMENT_STRUCTURE[department];
  
//   if (!dept) return supervisors;

//   // Check all positions in department
//   for (const [posTitle, posData] of Object.entries(dept.positions)) {
//     if (posData.canSupervise && posData.canSupervise.includes(position)) {
//       supervisors.push({
//         email: posData.email,
//         name: posData.name,
//         position: posTitle
//       });
//     }
//   }

//   return supervisors;
// };

// module.exports = {
//   ENHANCED_DEPARTMENT_STRUCTURE,
//   findPersonByEmail,
//   getSupevisablePositions,
//   getApprovalChainFromStructure,
//   getAllAvailablePositions,
//   getPotentialSupervisors
// };