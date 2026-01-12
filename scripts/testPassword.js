// testNewPassword.js
const bcrypt = require('bcryptjs');

async function testNewHash() {
  const newPassword = "secureAdminPassword123";
  const newHash = await bcrypt.hash(newPassword, 10);
  console.log('New hash to store:', newHash);
  
  const match = await bcrypt.compare(newPassword, newHash);
  console.log('Verification with new hash:', match);
}

testNewHash();