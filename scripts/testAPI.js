const mongoose = require('mongoose');
const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m'
};

// Helper function to log with colors
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to format JSON
function formatJSON(data) {
  return JSON.stringify(data, null, 2);
}

// Test result tracking
let passed = 0;
let failed = 0;

async function testEndpoint(name, url, expectedChecks = {}) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Testing: ${name}`, 'blue');
  log(`URL: ${url}`, 'gray');
  log('='.repeat(60), 'blue');

  try {
    const startTime = Date.now();
    const response = await axios.get(url);
    const duration = Date.now() - startTime;

    log(`✓ Status: ${response.status}`, 'green');
    log(`✓ Response time: ${duration}ms`, 'green');
    log(`✓ Content-Type: ${response.headers['content-type']}`, 'green');

    // Log response data
    log('\nResponse Data:', 'yellow');
    console.log(formatJSON(response.data));

    // Perform expected checks
    if (expectedChecks.isArray && !Array.isArray(response.data)) {
      throw new Error('Expected response to be an array');
    }

    if (expectedChecks.hasLength !== undefined) {
      const length = Array.isArray(response.data) 
        ? response.data.length 
        : Object.keys(response.data).length;
      log(`✓ Data length: ${length}`, 'green');
    }

    if (expectedChecks.requiredFields && Array.isArray(response.data)) {
      const firstItem = response.data[0];
      if (firstItem) {
        const missingFields = expectedChecks.requiredFields.filter(
          field => !(field in firstItem)
        );
        if (missingFields.length > 0) {
          log(`⚠ Missing fields in first item: ${missingFields.join(', ')}`, 'yellow');
        } else {
          log(`✓ All required fields present`, 'green');
        }
      }
    }

    if (expectedChecks.checkProperty) {
      const { property, value } = expectedChecks.checkProperty;
      if (Array.isArray(response.data)) {
        const allMatch = response.data.every(item => item[property] === value);
        if (allMatch) {
          log(`✓ All items have ${property} = ${value}`, 'green');
        } else {
          log(`⚠ Not all items have ${property} = ${value}`, 'yellow');
        }
      }
    }

    if (expectedChecks.hasStatsFields) {
      const statsFields = ['total', 'published', 'drafts'];
      const hasAllStats = statsFields.every(field => field in response.data);
      if (hasAllStats) {
        log(`✓ All stats fields present`, 'green');
      } else {
        log(`⚠ Missing stats fields`, 'yellow');
      }
    }

    log(`\n✓ TEST PASSED: ${name}`, 'green');
    passed++;
    return response.data;

  } catch (error) {
    log(`\n✗ TEST FAILED: ${name}`, 'red');
    
    if (error.response) {
      log(`Status: ${error.response.status}`, 'red');
      log(`Error data: ${formatJSON(error.response.data)}`, 'red');
    } else if (error.request) {
      log('No response received from server', 'red');
      log('Make sure the server is running on http://localhost:5001', 'yellow');
    } else {
      log(`Error: ${error.message}`, 'red');
    }
    
    if (error.stack) {
      log('\nStack trace:', 'gray');
      console.log(error.stack);
    }
    
    failed++;
    return null;
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('Starting API Tests for Projects Endpoints', 'blue');
  log('='.repeat(60) + '\n', 'blue');

  // Test 1: Get all projects
  await testEndpoint(
    'GET All Projects',
    `${BASE_URL}/projects`,
    {
      isArray: true,
      hasLength: true,
      requiredFields: ['_id', 'title']
    }
  );

  // Test 2: Get published projects only
  await testEndpoint(
    'GET Published Projects (isDraft=false)',
    `${BASE_URL}/projects?isDraft=false`,
    {
      isArray: true,
      hasLength: true,
      checkProperty: { property: 'isDraft', value: false }
    }
  );

  // Test 3: Get draft projects
  await testEndpoint(
    'GET Draft Projects (isDraft=true)',
    `${BASE_URL}/projects?isDraft=true`,
    {
      isArray: true,
      hasLength: true,
      checkProperty: { property: 'isDraft', value: true }
    }
  );

  // Test 4: Get project stats
  await testEndpoint(
    'GET Projects Stats',
    `${BASE_URL}/projects/stats`,
    {
      hasStatsFields: true
    }
  );

  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('Test Summary', 'blue');
  log('='.repeat(60), 'blue');
  log(`Total tests: ${passed + failed}`, 'yellow');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log('='.repeat(60) + '\n', 'blue');

  process.exit(failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  log('\nUnhandled Promise Rejection:', 'red');
  console.error(error);
  process.exit(1);
});

// Run the tests
log('Initializing API tests...', 'yellow');
log('Server URL: http://localhost:5001\n', 'gray');

runTests().catch((error) => {
  log('\nFatal error during test execution:', 'red');
  console.error(error);
  process.exit(1);
});