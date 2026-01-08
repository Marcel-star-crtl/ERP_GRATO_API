// diagnostic.js - Run this from project root: node scripts/diagnostic.js
const path = require('path');
const fs = require('fs');

console.log('\n🔍 DIAGNOSTIC CHECK FOR SUPPLIER ROUTES\n');

try {
  // Check routes directory
  console.log('1️⃣ Checking routes directory...');
  const routesDir = path.join(__dirname, '..', 'routes');
  
  if (!fs.existsSync(routesDir)) {
    console.log('   ❌ Routes directory does not exist!');
    process.exit(1);
  }
  
  console.log('   ✅ Routes directory exists:', routesDir);
  
  // List all files in routes directory
  console.log('\n2️⃣ Listing all files in routes directory...');
  const files = fs.readdirSync(routesDir);
  console.log('   Files found:', files.length);
  
  const supplierFiles = files.filter(f => f.toLowerCase().includes('supplier'));
  console.log('\n   Supplier-related files:');
  supplierFiles.forEach(f => console.log('      -', f));
  
  // Check for the specific file
  console.log('\n3️⃣ Checking for supplierInvoiceRoutes.js...');
  const targetFile = 'supplierInvoiceRoutes.js';
  const filePath = path.join(routesDir, targetFile);
  
  if (!fs.existsSync(filePath)) {
    console.log('   ❌ supplierInvoiceRoutes.js does NOT exist!');
    console.log('   Looking for similar names...');
    const similar = files.filter(f => 
      f.toLowerCase().includes('supplier') && 
      f.toLowerCase().includes('invoice')
    );
    if (similar.length > 0) {
      console.log('   Found similar files:', similar);
    }
    process.exit(1);
  }
  
  console.log('   ✅ File exists:', filePath);
  
  // Read file content
  console.log('\n4️⃣ Reading file content...');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log('   Total lines:', lines.length);
  console.log('   File size:', content.length, 'bytes');
  
  // Check for module.exports
  console.log('\n5️⃣ Checking for module.exports...');
  if (content.includes('module.exports')) {
    console.log('   ✅ File contains module.exports');
    
    // Find the line
    const exportLines = lines.filter(line => line.includes('module.exports'));
    console.log('   Export statement(s):');
    exportLines.forEach(line => console.log('      ', line.trim()));
  } else {
    console.log('   ❌ File does NOT contain module.exports!');
    console.log('   ⚠️  THIS IS THE PROBLEM - Add "module.exports = router;" at the end');
  }
  
  // Check last 5 lines
  console.log('\n6️⃣ Last 5 lines of file:');
  const lastLines = lines.slice(-5).filter(l => l.trim());
  lastLines.forEach((line, i) => {
    console.log(`   ${lines.length - 5 + i}: ${line}`);
  });
  
  // Try to require it
  console.log('\n7️⃣ Attempting to require the module...');
  try {
    const supplierRoutes = require(filePath);
    
    console.log('   ✅ Module loaded successfully');
    console.log('   Type:', typeof supplierRoutes);
    console.log('   Is function:', typeof supplierRoutes === 'function');
    console.log('   Has stack:', !!supplierRoutes.stack);
    
    if (supplierRoutes.stack) {
      console.log('   Stack length:', supplierRoutes.stack.length);
      
      // Count routes
      const routeCount = supplierRoutes.stack.filter(layer => layer.route).length;
      console.log('   Total routes:', routeCount);
      
      // Check for approval routes
      const approvalRoutes = supplierRoutes.stack.filter(layer => 
        layer.route && layer.route.path.includes('approval')
      );
      
      console.log('\n8️⃣ Checking for approval routes...');
      if (approvalRoutes.length > 0) {
        console.log(`   ✅ Found ${approvalRoutes.length} approval routes:`);
        approvalRoutes.forEach(layer => {
          const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
          console.log(`      ${methods} /api/suppliers${layer.route.path}`);
        });
      } else {
        console.log('   ❌ NO approval routes found!');
        
        // Show first 10 routes
        console.log('\n   First 10 routes in the file:');
        supplierRoutes.stack.slice(0, 10).forEach((layer, i) => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            console.log(`      [${i}] ${methods} ${layer.route.path}`);
          }
        });
      }
    }
    
    // Check controllers
    console.log('\n9️⃣ Checking controller files...');
    const controllersDir = path.join(__dirname, '..', 'controllers');
    
    const controllerFiles = [
      'supplierController.js',
      'supplierApprovalController.js',
      'supplierInvoiceController.js',
      'unifiedSupplierController.js'
    ];
    
    controllerFiles.forEach(file => {
      const controllerPath = path.join(controllersDir, file);
      if (fs.existsSync(controllerPath)) {
        console.log(`   ✅ ${file} exists`);
        try {
          require(controllerPath);
          console.log(`      ✓ Loads without error`);
        } catch (err) {
          console.log(`      ❌ Error loading: ${err.message}`);
        }
      } else {
        console.log(`   ❌ ${file} NOT FOUND`);
      }
    });
    
    console.log('\n✅ DIAGNOSTIC COMPLETE\n');
    
  } catch (requireError) {
    console.log('   ❌ Failed to require module:', requireError.message);
    console.log('\n   Full error stack:');
    console.log(requireError.stack);
  }
  
} catch (error) {
  console.error('\n❌ DIAGNOSTIC FAILED:', error.message);
  console.error('\nFull stack trace:');
  console.error(error.stack);
}