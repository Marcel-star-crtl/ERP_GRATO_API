// scripts/diagnostic.js - Run this from project root: node scripts/diagnostic.js

const path = require('path');
const fs = require('fs');

console.log('\n🔍 BUYER ROUTES DIAGNOSTIC CHECK\n');
console.log('='.repeat(60));

try {
  // 1. Check if routes directory exists
  console.log('\n1️⃣  Checking routes directory...');
  const routesDir = path.join(__dirname, '..', 'routes');
  
  if (!fs.existsSync(routesDir)) {
    console.log('   ❌ Routes directory does not exist!');
    process.exit(1);
  }
  
  console.log('   ✅ Routes directory exists:', routesDir);
  
  // 2. Check for buyerRoutes.js
  console.log('\n2️⃣  Checking for buyerRoutes.js...');
  const buyerRoutesPath = path.join(routesDir, 'buyerRoutes.js');
  
  if (!fs.existsSync(buyerRoutesPath)) {
    console.log('   ❌ buyerRoutes.js does NOT exist!');
    process.exit(1);
  }
  
  console.log('   ✅ buyerRoutes.js exists');
  
  // 3. Read file content
  console.log('\n3️⃣  Reading buyerRoutes.js content...');
  const content = fs.readFileSync(buyerRoutesPath, 'utf8');
  const lines = content.split('\n');
  
  console.log('   Total lines:', lines.length);
  console.log('   File size:', (content.length / 1024).toFixed(2), 'KB');
  
  // 4. Check for module.exports
  console.log('\n4️⃣  Checking for module.exports...');
  const hasExport = content.includes('module.exports');
  
  if (!hasExport) {
    console.log('   ❌ No module.exports found!');
    console.log('   ⚠️  Add "module.exports = router;" at the end of the file');
    process.exit(1);
  }
  
  console.log('   ✅ module.exports found');
  
  // Show the export line
  const exportLine = lines.find(line => line.trim().startsWith('module.exports'));
  console.log('   Export statement:', exportLine?.trim());
  
  // 5. Try to require the module
  console.log('\n5️⃣  Attempting to load buyerRoutes module...');
  
  try {
    const buyerRoutes = require(buyerRoutesPath);
    
    console.log('   ✅ Module loaded successfully');
    console.log('   Type:', typeof buyerRoutes);
    console.log('   Is function:', typeof buyerRoutes === 'function');
    console.log('   Has stack:', !!buyerRoutes.stack);
    
    if (!buyerRoutes.stack) {
      console.log('   ❌ Router has no stack - not a valid Express router!');
      process.exit(1);
    }
    
    console.log('   Stack length:', buyerRoutes.stack.length);
    
    // 6. Count and analyze routes
    console.log('\n6️⃣  Analyzing routes...');
    
    const allLayers = buyerRoutes.stack;
    const routeLayers = allLayers.filter(layer => layer.route);
    const middlewareLayers = allLayers.filter(layer => !layer.route);
    
    console.log('   Total stack layers:', allLayers.length);
    console.log('   Route layers:', routeLayers.length);
    console.log('   Middleware layers:', middlewareLayers.length);
    
    // 7. Check for Supply Chain routes
    console.log('\n7️⃣  Checking for Supply Chain routes...');
    
    const supplyChainRoutes = routeLayers.filter(layer => 
      layer.route.path.includes('supply-chain')
    );
    
    if (supplyChainRoutes.length === 0) {
      console.log('   ❌ NO Supply Chain routes found!');
      console.log('   ⚠️  The routes are missing from the file');
    } else {
      console.log(`   ✅ Found ${supplyChainRoutes.length} Supply Chain routes:`);
      supplyChainRoutes.forEach(layer => {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        console.log(`      ${methods} ${layer.route.path}`);
      });
    }
    
    // 8. Check for specific Supply Chain endpoints
    console.log('\n8️⃣  Checking for specific endpoints...');
    
    const requiredEndpoints = [
      { path: '/purchase-orders/supply-chain/pending', method: 'get' },
      { path: '/purchase-orders/supply-chain/stats', method: 'get' },
      { path: '/purchase-orders/:poId/download-for-signing', method: 'get' },
      { path: '/purchase-orders/:poId/assign-department', method: 'post' },
      { path: '/purchase-orders/:poId/reject', method: 'post' }
    ];
    
    requiredEndpoints.forEach(endpoint => {
      const found = routeLayers.find(layer => 
        layer.route.path === endpoint.path && 
        layer.route.methods[endpoint.method]
      );
      
      if (found) {
        console.log(`   ✅ ${endpoint.method.toUpperCase()} ${endpoint.path}`);
      } else {
        console.log(`   ❌ ${endpoint.method.toUpperCase()} ${endpoint.path} - NOT FOUND`);
      }
    });
    
    // 9. Check controller references
    console.log('\n9️⃣  Checking controller references...');
    
    const hasControllerImport = content.includes('buyerPurchaseOrderController');
    console.log('   buyerPurchaseOrderController imported:', hasControllerImport ? '✅' : '❌');
    
    if (hasControllerImport) {
      const requiredMethods = [
        'getSupplyChainPendingPOs',
        'getSupplyChainPOStats',
        'downloadPOForSigning',
        'assignPOToDepartment',
        'rejectPO'
      ];
      
      requiredMethods.forEach(method => {
        const hasReference = content.includes(`buyerPurchaseOrderController.${method}`);
        console.log(`   - ${method}:`, hasReference ? '✅' : '❌');
      });
    }
    
    // 10. Check middleware imports
    console.log('\n🔟 Checking middleware imports...');
    
    const requiredMiddleware = [
      'authMiddleware',
      'requireRoles',
      'upload'
    ];
    
    requiredMiddleware.forEach(middleware => {
      const hasMiddleware = content.includes(middleware);
      console.log(`   ${middleware}:`, hasMiddleware ? '✅' : '❌');
    });
    
    // 11. Show route order (important for matching)
    console.log('\n1️⃣1️⃣  Route order (first 20 routes):');
    console.log('   (Order matters - specific routes must come before generic ones)\n');
    
    routeLayers.slice(0, 20).forEach((layer, index) => {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      const path = layer.route.path;
      const isSupplyChain = path.includes('supply-chain');
      const icon = isSupplyChain ? '🎯' : '  ';
      
      console.log(`   ${icon} [${index + 1}] ${methods.padEnd(6)} ${path}`);
    });
    
    // 12. Check if generic routes come before specific ones (anti-pattern)
    console.log('\n1️⃣2️⃣  Checking route order issues...');
    
    let genericPOIndex = -1;
    let supplyChainIndex = -1;
    
    routeLayers.forEach((layer, index) => {
      if (layer.route.path === '/purchase-orders' && genericPOIndex === -1) {
        genericPOIndex = index;
      }
      if (layer.route.path.includes('supply-chain') && supplyChainIndex === -1) {
        supplyChainIndex = index;
      }
    });
    
    if (genericPOIndex !== -1 && supplyChainIndex !== -1) {
      if (genericPOIndex < supplyChainIndex) {
        console.log('   ⚠️  WARNING: Generic /purchase-orders route comes BEFORE supply-chain routes!');
        console.log(`      Generic route at position: ${genericPOIndex + 1}`);
        console.log(`      Supply Chain route at position: ${supplyChainIndex + 1}`);
        console.log('      This may cause routing issues - specific routes should come first!');
      } else {
        console.log('   ✅ Route order is correct');
      }
    }
    
    // 13. Check server.js mounting
    console.log('\n1️⃣3️⃣  Checking server.js mounting...');
    const serverPath = path.join(__dirname, '..', 'server.js');
    
    if (fs.existsSync(serverPath)) {
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      const hasBuyerMount = serverContent.includes("app.use('/api/buyer'");
      
      console.log('   buyerRoutes mounted:', hasBuyerMount ? '✅' : '❌');
      
      if (hasBuyerMount) {
        // Find the mounting line
        const lines = serverContent.split('\n');
        const mountLine = lines.find(line => line.includes("app.use('/api/buyer'"));
        console.log('   Mount statement:', mountLine?.trim());
      }
    } else {
      console.log('   ⚠️  server.js not found');
    }
    
    // 14. Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    
    const issues = [];
    
    if (supplyChainRoutes.length === 0) {
      issues.push('❌ Supply Chain routes not found in buyerRoutes.js');
    }
    
    if (genericPOIndex !== -1 && supplyChainIndex !== -1 && genericPOIndex < supplyChainIndex) {
      issues.push('⚠️  Route order issue detected');
    }
    
    if (!hasControllerImport) {
      issues.push('❌ Controller import missing');
    }
    
    if (issues.length === 0) {
      console.log('\n✅ All checks passed!');
      console.log('\nIf you\'re still getting 404 errors:');
      console.log('1. Restart your Node.js server');
      console.log('2. Clear any caching (pm2 restart, nodemon restart)');
      console.log('3. Check browser console for correct API URL');
      console.log('4. Verify user has "supply_chain" role in database');
    } else {
      console.log('\n⚠️  Issues found:\n');
      issues.forEach(issue => console.log('   ' + issue));
      console.log('\nPlease fix these issues and restart the server.');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTIC COMPLETE\n');
    
  } catch (requireError) {
    console.log('   ❌ Failed to load module!');
    console.log('\n   Error:', requireError.message);
    console.log('\n   This usually means:');
    console.log('   1. Syntax error in buyerRoutes.js');
    console.log('   2. Missing dependency/controller');
    console.log('   3. Circular dependency');
    console.log('\n   Full stack trace:');
    console.log(requireError.stack);
    process.exit(1);
  }
  
} catch (error) {
  console.error('\n❌ DIAGNOSTIC FAILED:', error.message);
  console.error('\nFull stack trace:');
  console.error(error.stack);
  process.exit(1);
}