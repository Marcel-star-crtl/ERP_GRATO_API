const { DEPARTMENT_STRUCTURE } = require('./departmentStructure');

/**
 * Get immediate supervisor for action item approval
 * Returns only the direct supervisor who needs to approve the task
 */
const getTaskSupervisor = (employeeName, department) => {
  console.log(`\n=== FINDING IMMEDIATE SUPERVISOR ===`);
  console.log(`Employee: ${employeeName}`);
  console.log(`Department: ${department}`);

  // Find employee in department structure
  let employeeData = null;
  let employeeDepartmentName = department;

  // Check if employee is department head
  if (DEPARTMENT_STRUCTURE[department] && DEPARTMENT_STRUCTURE[department].head === employeeName) {
    // Department heads are supervised by President
    const executive = DEPARTMENT_STRUCTURE['Executive'];
    if (executive) {
      console.log(`✓ Employee is Department Head - Immediate Supervisor: ${executive.head}`);
      return {
        name: executive.head,
        email: executive.headEmail,
        department: 'Executive'
      };
    }
    return null;
  }

  // Search for employee in all departments
  for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
    if (deptData.head === employeeName) {
      // This person is a department head
      const executive = DEPARTMENT_STRUCTURE['Executive'];
      if (executive) {
        console.log(`✓ Employee is Department Head of ${deptKey} - Immediate Supervisor: ${executive.head}`);
        return {
          name: executive.head,
          email: executive.headEmail,
          department: 'Executive'
        };
      }
      return null;
    }

    if (deptData.positions) {
      for (const [pos, data] of Object.entries(deptData.positions)) {
        if (data.name === employeeName) {
          employeeData = { ...data, position: pos };
          employeeDepartmentName = deptKey;
          console.log(`✓ Found employee: ${pos} in ${deptKey}`);
          break;
        }
      }
    }
    if (employeeData) break;
  }

  if (!employeeData) {
    console.warn(`⚠ Employee "${employeeName}" not found`);
    // Default to department head as immediate supervisor
    if (DEPARTMENT_STRUCTURE[department]) {
      console.log(`Using department head as default supervisor: ${DEPARTMENT_STRUCTURE[department].head}`);
      return {
        name: DEPARTMENT_STRUCTURE[department].head,
        email: DEPARTMENT_STRUCTURE[department].headEmail,
        department: department
      };
    }
    return null;
  }

  // Find immediate supervisor
  if (!employeeData.supervisor) {
    console.warn(`⚠ No supervisor defined for ${employeeName}`);
    // Default to department head
    const dept = DEPARTMENT_STRUCTURE[employeeDepartmentName];
    if (dept) {
      console.log(`Using department head as default: ${dept.head}`);
      return {
        name: dept.head,
        email: dept.headEmail,
        department: employeeDepartmentName
      };
    }
    return null;
  }

  const dept = DEPARTMENT_STRUCTURE[employeeDepartmentName];
  if (!dept) return null;

  // Check in positions first
  if (dept.positions) {
    for (const [pos, data] of Object.entries(dept.positions)) {
      if (pos === employeeData.supervisor || data.name === employeeData.supervisor) {
        console.log(`✓ Immediate Supervisor: ${data.name} (${pos})`);
        return {
          name: data.name,
          email: data.email,
          department: employeeDepartmentName
        };
      }
    }
  }

  // Check if supervisor is department head
  if (dept.head === employeeData.supervisor || employeeData.supervisor.includes('Head')) {
    console.log(`✓ Immediate Supervisor: ${dept.head} (Department Head)`);
    return {
      name: dept.head,
      email: dept.headEmail,
      department: employeeDepartmentName
    };
  }

  console.warn(`⚠ Supervisor "${employeeData.supervisor}" not found`);
  // Fallback to department head
  console.log(`Falling back to department head: ${dept.head}`);
  return {
    name: dept.head,
    email: dept.headEmail,
    department: employeeDepartmentName
  };
};

module.exports = {
  getTaskSupervisor
};





