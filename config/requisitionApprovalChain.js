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
            // ENHANCED: Buyers with specific roles and specializations
            'Order Management Assistant/Buyer': {
                name: 'Mr. Cristabel Maneni',
                email: 'christabel@gratoengineering.com',
                supervisor: 'Supply Chain Coordinator',
                department: 'Business Development & Supply Chain',
                role: 'buyer',
                specializations: ['Office_Supplies', 'Consumables', 'General'],
                maxOrderValue: 2000000
            },
            'Warehouse Coordinator/Buyer': {
                name: 'Mr. Pryde Mua',
                email: 'pryde.mua@gratoglobal.com',
                supervisor: 'Supply Chain Coordinator',
                department: 'Business Development & Supply Chain',
                role: 'buyer',
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
                name: 'Ms. Rambell Mambo',
                email: 'ranibellmambo@gratoengineering.com',
                supervisor: 'Head of Business Dev & Supply Chain',
                department: 'Business Development & Supply Chain'
            }
        }
    },

    // HR & Admin
    'HR & Admin': {
        name: 'HR & Admin',
        head: 'Mrs. Brunline Teitoh',
        headEmail: 'bruiline.tsitoh@gratoglobal.com',
        positions: {
            'Office Driver/Logistics Assistant': {
                name: 'Mr. Che Earnest',
                email: 'che.earnest@gratoengineering.com',
                supervisor: 'HR & Admin Head',
                department: 'HR & Admin'
            },
            'IT Staff': {
                name: 'Mr. Ngong Marcel',
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

    // Executive - Kelvin now serves as President/Ultimate Authority
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
                name: 'Mrs. Brunline Teitoh',
                email: 'bruiline.tsitoh@gratoglobal.com',
                supervisor: 'President',
                department: 'Executive'
            }
        }
    }
};

// ENHANCED: Get available buyers for assignment
const getAvailableBuyers = () => {
    const buyers = [];

    // Extract buyers from department structure
    Object.values(DEPARTMENT_STRUCTURE).forEach(department => {
        Object.entries(department.positions).forEach(([position, person]) => {
            if (person.role === 'buyer') {
                buyers.push({
                    id: person.email,
                    name: person.name,
                    email: person.email,
                    position: position,
                    department: person.department,
                    specializations: person.specializations || [],
                    maxOrderValue: person.maxOrderValue || 1000000
                });
            }
        });
    });

    // Add coordinator as potential buyer (can buy themselves)
    buyers.push({
        id: 'lukong.lambert@gratoglobal.com',
        name: 'Mr. Lukong Lambert',
        email: 'lukong.lambert@gratoglobal.com',
        position: 'Supply Chain Coordinator',
        department: 'Business Development & Supply Chain',
        specializations: ['All'],
        maxOrderValue: 10000000,
        canSelfBuy: true
    });

    return buyers;
};

// ENHANCED: Get suitable buyer for a requisition
const getSuitableBuyer = (requisition) => {
    const buyers = getAvailableBuyers();
    const estimatedValue = requisition.budgetXAF ||
        requisition.financeVerification?.assignedBudget ||
        0;

    // Filter buyers based on specialization and order value
    const suitableBuyers = buyers.filter(buyer => {
        // Check order value capacity
        if (estimatedValue > buyer.maxOrderValue) return false;

        // Check specialization match
        if (buyer.specializations.includes('All')) return true;

        const itemCategory = requisition.itemCategory?.replace(' ', '_');
        return buyer.specializations.includes(itemCategory) ||
            buyer.specializations.includes('General');
    });

    // Sort by workload and specialization match
    return suitableBuyers.sort((a, b) => {
        // Prefer exact specialization match
        const aHasExact = a.specializations.includes(requisition.itemCategory?.replace(' ', '_'));
        const bHasExact = b.specializations.includes(requisition.itemCategory?.replace(' ', '_'));

        if (aHasExact && !bHasExact) return -1;
        if (!aHasExact && bHasExact) return 1;

        // Then by max order value (higher capacity first for complex orders)
        return b.maxOrderValue - a.maxOrderValue;
    });
};

// ENHANCED: Updated approval chain to include finance verification
const getApprovalChain = (employeeName, department) => {
    const chain = [];

    console.log(`Getting approval chain for: ${employeeName} in ${department}`);

    // Find the employee's data
    let employeeData = null;
    let employeeDepartmentName = department;

    // Search for employee in specified department first
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

    // If not found, search all departments
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

    // If still not found, create default chain
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

        // Add finance verification step
        chain.push({
            level: 2,
            approver: 'Ms. Rambell Mambo',
            email: 'ranibellmambo@gratoengineering.com',
            role: 'Finance Officer - Budget Verification',
            department: 'Business Development & Supply Chain'
        });

        // Add Head of Business as final approver
        chain.push({
            level: 3,
            approver: 'Mr. E.T Kelvin',
            email: 'kelvin.eyong@gratoglobal.com',
            role: 'Head of Business Development & Supply Chain - Final Approval',
            department: 'Business Development & Supply Chain',
            responsibilities: {
                sourcingTypeSelection: true,
                purchaseTypeAssignment: true,
                buyerAssignment: true,
                finalApproval: true
            }
        });

        return chain;
    }

    let currentEmployee = employeeData;
    let currentDepartment = employeeDepartmentName;
    let level = 1;

    console.log(`Starting approval chain traversal from: ${currentEmployee.name} (${currentEmployee.position}) in ${currentDepartment}`);

    // Traverse up the chain for supervisor approvals
    while (currentEmployee && currentEmployee.supervisor) {
        let supervisorFound = false;

        console.log(`Looking for supervisor: "${currentEmployee.supervisor}" for ${currentEmployee.name}`);

        // Check within the current department first
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

        // If not found in current department's positions, check if supervisor is the department head
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

        // If supervisor is 'President', break and add remaining chain
        if (!supervisorFound && currentEmployee.supervisor === 'President') {
            break;
        }

        if (!supervisorFound) {
            console.warn(`Supervisor "${currentEmployee.supervisor}" not found for "${currentEmployee.name}". Breaking chain traversal.`);

            // Add department head and president as fallback if not already in chain
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

    // ENHANCED: Add finance verification step after supervisor/hod approvals
    console.log('Adding finance verification step');
    chain.push({
        level: level++,
        approver: 'Ms. Rambell Mambo',
        email: 'ranibellmambo@gratoengineering.com',
        role: 'Finance Officer - Budget Verification',
        department: 'Business Development & Supply Chain'
    });

    // NEW WORKFLOW: Add Head of Business Dev & Supply Chain as final approver (with enhanced responsibilities)
    console.log('Adding Head of Business for final approval with enhanced responsibilities');
    chain.push({
        level: level++,
        approver: 'Mr. E.T Kelvin',
        email: 'kelvin.eyong@gratoglobal.com',
        role: 'Head of Business Development & Supply Chain - Final Approval',
        department: 'Business Development & Supply Chain',
        responsibilities: {
            sourcingTypeSelection: true,
            purchaseTypeAssignment: true,
            buyerAssignment: true,
            finalApproval: true
        }
    });

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

    // Add department head if not 'Executive' itself
    if (department !== 'Executive') {
        employees.push({
            name: dept.head,
            email: dept.headEmail,
            position: 'Department Head',
            department: department,
            supervisor: 'President'
        });
    }

    // Add other positions
    for (const [position, data] of Object.entries(dept.positions)) {
        employees.push({
            name: data.name,
            email: data.email,
            position: position,
            department: department,
            supervisor: data.supervisor,
            role: data.role || 'employee',
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