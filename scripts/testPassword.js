// // testPassword.js
// const bcrypt = require('bcryptjs');

// const storedHash = "$2a$10$NRnHNXV702HCjolopNON9.noj1bUjNDl1iis.jvhiaF0afs9FJIVW";
// const testPassword = "secureAdminPassword123";

// bcrypt.compare(testPassword, storedHash)
//   .then(match => {
//     console.log('Password matches:', match);
//   })
//   .catch(err => {
//     console.error('Error comparing:', err);
//   });



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