const DEPARTMENT_STRUCTURE = {
  'Technical': {
      name: 'Technical',
      head: 'Mr. Didier Oyong',
      headEmail: 'didier.oyong@gratoengineering.com',
      positions: {
          'HSE Coordinator': {
              name: 'Mr. Ovo Becheni',
              email: 'bechem.mbu@gratoglobal.com',
              supervisor: 'Technical Director',
              department: 'Technical'
          },
          'Head of Refurbishment': {
              name: 'Mr. Yerla Ivo',
              email: 'verla.ivo@gratoengineering.com',
              supervisor: 'Technical Director',
              department: 'Technical'
          },
          'Project Manager': {
              name: 'Mr. Joel Wamba',
              email: 'joel@gratoengineering.com',
              supervisor: 'Technical Director',
              department: 'Technical'
          },
          'Operations Manager': {
              name: 'Mr. Pascal Assam',
              email: 'pascal.rodrique@gratoglobal.com',
              supervisor: 'Technical Director',
              department: 'Technical'
          },
          'Diesel Coordinator': {
              name: 'Mr. Kevin Minka',
              email: 'minka.kevin@gratoglobal.com',
              supervisor: 'Technical Director',
              department: 'Technical'
          },
          'Data Collector': {
              name: 'Mr. Bomba Yvone',
              email: 'bemba.essack@gratoglobal.com',
              supervisor: 'Operations Manager',
              department: 'Technical'
          },
          'NOC Coordinator': {
              name: 'Mr. Rodrigue Nono',
              email: 'rodrigue.nono@gratoglobal.com',
              supervisor: 'Diesel Coordinator',
              department: 'Technical'
          },
          'Site Supervisor': {
              name: 'Site Supervisors',
              email: 'site.supervisors@gratoengineering.com',
              supervisor: 'Project Manager',
              department: 'Technical'
          },
          'Field Technician': {
              name: 'Field Technicians',
              email: 'field.technicians@gratoengineering.com',
              supervisor: 'Site Supervisor',
              department: 'Technical'
          },
          'NOC Operator': {
              name: 'NOC Operators',
              email: 'noc.operators@gratoengineering.com',
              supervisor: 'NOC Coordinator',
              department: 'Technical'
          }
      }
  },

  // Business Development & Supply Chain
  'Business Development & Supply Chain': {
      name: 'Business Development & Supply Chain',
      head: 'Mr. E.T Kelvin',
      headEmail: 'kelvin.eyong@gratoglobal.com',
      positions: {
          'Supply Chain Coordinator': {
              name: 'Mr. Lukong Lambert',
              email: 'lukong.lambert@gratoglobal.com',
              supervisor: 'Head of Business Dev & Supply Chain',
              department: 'Business Development & Supply Chain'
          },
          // FIXED: Buyers with correct role structure
          'Order Management Assistant/Buyer': {
              name: 'Ms. Christabel Mangwi',
              email: 'christabel@gratoengineering.com',
              supervisor: 'Supply Chain Coordinator',
              department: 'Business Development & Supply Chain',
              role: 'employee', 
              departmentRole: 'buyer', 
              specializations: ['Office_Supplies', 'Consumables', 'General'],
              maxOrderValue: 2000000
          },
          'Warehouse Coordinator/Buyer': {
              name: 'Mr. Pryde Mua',
              email: 'pryde.mua@gratoglobal.com',
              supervisor: 'Supply Chain Coordinator',
              department: 'Business Development & Supply Chain',
              role: 'employee', 
              departmentRole: 'buyer', 
              specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
              maxOrderValue: 5000000
          },
          'Warehouse Assistant': {
              name: 'Ms. Aghangu Marie',
              email: 'aghangu.marie@gratoengineering.com',
              supervisor: 'Warehouse Coordinator',
              department: 'Business Development & Supply Chain'
          },
          'Finance Officer': {
              name: 'Ms. Ranibell Mambo',
              email: 'ranibellmambo@gratoengineering.com',
              supervisor: 'Head of Business Dev & Supply Chain',
              department: 'Business Development & Supply Chain'
          }
      }
  },

  // HR & Admin
  'HR & Admin': {
      name: 'HR & Admin',
      head: 'Mrs. Bruiline Tsitoh',
      headEmail: 'bruiline.tsitoh@gratoglobal.com',
      positions: {
          'Office Driver/Logistics Assistant': {
              name: 'Mr. Che Earnest',
              email: 'che.earnest@gratoengineering.com',
              supervisor: 'HR & Admin Head',
              department: 'HR & Admin'
          },
          'IT Staff': {
              name: 'Marcel',
              email: 'marcel.ngong@gratoglobal.com',
              supervisor: 'HR & Admin Head',
              department: 'HR & Admin'
          },
          'House Maid': {
              name: 'Ms. Ndi Belther',
              email: 'ndi.belther@gratoengineering.com',
              supervisor: 'HR & Admin Head',
              department: 'HR & Admin'
          }
      }
  },

  'Executive': {
      name: 'Executive',
      head: 'Mr. E.T Kelvin',
      headEmail: 'kelvin.eyong@gratoglobal.com',
      positions: {
          'Technical Director': {
              name: 'Mr. Didier Oyong',
              email: 'didier.oyong@gratoengineering.com',
              supervisor: 'President',
              department: 'Executive'
          },
          'Head of HR & Admin': {
              name: 'Mrs. Bruiline Tsitoh',
              email: 'bruiline.tsitoh@gratoglobal.com',
              supervisor: 'President',
              department: 'Executive'
          }
      }
  }
};

const getAvailableBuyers = () => {
  const buyers = [];

  // Extract buyers from department structure
  Object.values(DEPARTMENT_STRUCTURE).forEach(department => {
      Object.entries(department.positions).forEach(([position, person]) => {
          if (person.departmentRole === 'buyer') {
              buyers.push({
                  id: person.email,
                  name: person.name,
                  email: person.email,
                  position: position,
                  department: person.department,
                  role: person.role || 'employee', 
                  departmentRole: person.departmentRole, 
                  specializations: person.specializations || [],
                  maxOrderValue: person.maxOrderValue || 1000000
              });
          }
      });
  });

  buyers.push({
      id: 'lukong.lambert@gratoglobal.com',
      name: 'Mr. Lukong Lambert',
      email: 'lukong.lambert@gratoglobal.com',
      position: 'Supply Chain Coordinator',
      department: 'Business Development & Supply Chain',
      role: 'supervisor', 
      departmentRole: 'coordinator',
      specializations: ['All'],
      maxOrderValue: 10000000,
      canSelfBuy: true
  });

  return buyers;
};

const getSuitableBuyer = (requisition) => {
  const buyers = getAvailableBuyers();
  const estimatedValue = requisition.budgetXAF ||
      requisition.financeVerification?.assignedBudget ||
      0;

  const suitableBuyers = buyers.filter(buyer => {
      if (estimatedValue > buyer.maxOrderValue) return false;

      if (buyer.specializations.includes('All')) return true;

      const itemCategory = requisition.itemCategory?.replace(' ', '_');
      return buyer.specializations.includes(itemCategory) ||
          buyer.specializations.includes('General');
  });

  return suitableBuyers.sort((a, b) => {
      const aHasExact = a.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
      const bHasExact = b.specializations.includes(requisition.itemCategory?.replace(' ', '_'));

      if (aHasExact && !bHasExact) return -1;
      if (!aHasExact && bHasExact) return 1;

      return b.maxOrderValue - a.maxOrderValue;
  });
};

const getApprovalChain = (employeeName, department) => {
  const chain = [];

  console.log(`Getting approval chain for: ${employeeName} in ${department}`);

  let employeeData = null;
  let employeeDepartmentName = department;

  if (DEPARTMENT_STRUCTURE[department]) {
      if (DEPARTMENT_STRUCTURE[department].head === employeeName) {
          employeeData = {
              name: employeeName,
              email: DEPARTMENT_STRUCTURE[department].headEmail,
              position: 'Department Head',
              supervisor: 'President',
              department: department
          };
      } else {
          for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[department].positions || {})) {
              if (data.name === employeeName) {
                  employeeData = { ...data, position: pos };
                  break;
              }
          }
      }
  }

  if (!employeeData) {
      for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
          if (deptData.head === employeeName) {
              employeeData = {
                  name: employeeName,
                  email: deptData.headEmail,
                  position: 'Department Head',
                  supervisor: 'President',
                  department: deptKey
              };
              employeeDepartmentName = deptKey;
              break;
          }

          if (deptData.positions) {
              for (const [pos, data] of Object.entries(deptData.positions)) {
                  if (data.name === employeeName) {
                      employeeData = { ...data, position: pos };
                      employeeDepartmentName = deptKey;
                      break;
                  }
              }
          }

          if (employeeData) break;
      }
  }

  if (!employeeData) {
      console.warn(`Employee "${employeeName}" not found. Creating default approval chain.`);

      if (DEPARTMENT_STRUCTURE[department]) {
          chain.push({
              level: 1,
              approver: DEPARTMENT_STRUCTURE[department].head,
              email: DEPARTMENT_STRUCTURE[department].headEmail,
              role: 'Department Head',
              department: department
          });
      }

      chain.push({
          level: 2,
          approver: 'Ms. Ranibell Mambo',
          email: 'ranibellmambo@gratoengineering.com',
          role: 'Finance Officer',
          department: 'Business Development & Supply Chain'
      });

      if (DEPARTMENT_STRUCTURE['Executive']) {
          chain.push({
              level: 3,
              approver: DEPARTMENT_STRUCTURE['Executive'].head,
              email: DEPARTMENT_STRUCTURE['Executive'].headEmail,
              role: 'President',
              department: 'Executive'
          });
      }

      return chain;
  }

  let currentEmployee = employeeData;
  let currentDepartment = employeeDepartmentName;
  let level = 1;

  console.log(`Starting approval chain traversal from: ${currentEmployee.name} (${currentEmployee.position}) in ${currentDepartment}`);

  while (currentEmployee && currentEmployee.supervisor) {
      let supervisorFound = false;

      console.log(`Looking for supervisor: "${currentEmployee.supervisor}" for ${currentEmployee.name}`);

      if (DEPARTMENT_STRUCTURE[currentDepartment] && DEPARTMENT_STRUCTURE[currentDepartment].positions) {
          for (const [pos, data] of Object.entries(DEPARTMENT_STRUCTURE[currentDepartment].positions)) {
              if (pos === currentEmployee.supervisor || data.name === currentEmployee.supervisor) {
                  chain.push({
                      level: level++,
                      approver: data.name,
                      email: data.email,
                      role: pos,
                      department: currentDepartment
                  });
                  currentEmployee = { ...data, position: pos };
                  supervisorFound = true;
                  console.log(`Found supervisor in positions: ${data.name} (${pos})`);
                  break;
              }
          }
      }

      if (!supervisorFound && DEPARTMENT_STRUCTURE[currentDepartment] &&
          (DEPARTMENT_STRUCTURE[currentDepartment].head === currentEmployee.supervisor ||
              currentEmployee.supervisor.includes('Head'))) {

          chain.push({
              level: level++,
              approver: DEPARTMENT_STRUCTURE[currentDepartment].head,
              email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
              role: 'Department Head',
              department: currentDepartment
          });

          currentEmployee = {
              name: DEPARTMENT_STRUCTURE[currentDepartment].head,
              email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
              position: 'Department Head',
              supervisor: 'President',
              department: currentDepartment
          };
          supervisorFound = true;
          console.log(`Found supervisor as department head: ${DEPARTMENT_STRUCTURE[currentDepartment].head}`);
      }

      if (!supervisorFound && currentEmployee.supervisor === 'President') {
          break;
      }

      if (!supervisorFound) {
          console.warn(`Supervisor "${currentEmployee.supervisor}" not found for "${currentEmployee.name}". Breaking chain traversal.`);

          if (DEPARTMENT_STRUCTURE[currentDepartment] && !chain.some(step => step.role === 'Department Head')) {
              chain.push({
                  level: level++,
                  approver: DEPARTMENT_STRUCTURE[currentDepartment].head,
                  email: DEPARTMENT_STRUCTURE[currentDepartment].headEmail,
                  role: 'Department Head',
                  department: currentDepartment
              });
          }

          break;
      }
  }

  console.log('Adding finance verification step');
  chain.push({
      level: level++,
      approver: 'Ms. Ranibell Mambo',
      email: 'ranibellmambo@gratoengineering.com',
      role: 'Finance Officer - Budget Verification',
      department: 'Business Development & Supply Chain'
  });

  if (DEPARTMENT_STRUCTURE['Executive'] && !chain.some(step => step.role === 'President')) {
      chain.push({
          level: level++,
          approver: DEPARTMENT_STRUCTURE['Executive'].head,
          email: DEPARTMENT_STRUCTURE['Executive'].headEmail,
          role: 'President',
          department: 'Executive'
      });
  }

  console.log(`Final approval chain created with ${chain.length} levels:`,
      chain.map(step => `Level ${step.level}: ${step.approver} (${step.role})`));

  return chain.length > 0 ? chain : null;
};

const getDepartmentList = () => {
  return Object.keys(DEPARTMENT_STRUCTURE).filter(key => key !== 'Executive').map(key => ({
      key,
      name: DEPARTMENT_STRUCTURE[key].name,
      head: DEPARTMENT_STRUCTURE[key].head
  }));
};

const getEmployeesInDepartment = (department) => {
  const dept = DEPARTMENT_STRUCTURE[department];
  if (!dept) return [];

  const employees = [];

  if (department !== 'Executive') {
      employees.push({
          name: dept.head,
          email: dept.headEmail,
          position: 'Department Head',
          department: department,
          supervisor: 'President'
      });
  }

  for (const [position, data] of Object.entries(dept.positions)) {
      employees.push({
          name: data.name,
          email: data.email,
          position: position,
          department: department,
          supervisor: data.supervisor,
          role: data.role || 'employee', 
          departmentRole: data.departmentRole || 'staff', 
          specializations: data.specializations,
          maxOrderValue: data.maxOrderValue
      });
  }

  return employees;
};

module.exports = {
  DEPARTMENT_STRUCTURE,
  getApprovalChain,
  getDepartmentList,
  getEmployeesInDepartment,
  getAvailableBuyers,
  getSuitableBuyer
};



