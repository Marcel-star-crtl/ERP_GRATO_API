require('dotenv').config();
const mongoose = require('mongoose');

// Define the Request schema/model (adjust based on your actual model)
const RequestSchema = new mongoose.Schema({}, { strict: false, collection: 'requests' });
const Request = mongoose.model('Request', RequestSchema);

async function deleteSpecificRequest() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // The request ID to delete
    const requestId = '6932cc4609f5245a89627c95';

    console.log(`\nSearching for request with ID: ${requestId}`);

    // Find the request first
    const request = await Request.findById(requestId);

    if (!request) {
      console.log('\n❌ Request not found!');
      console.log('The request may have already been deleted or the ID is incorrect.');
      return;
    }

    // Display request details
    console.log('\n📋 Request Details:');
    console.log('---------------------');
    console.log(`Display ID: ${request.displayId || 'N/A'}`);
    console.log(`Employee: ${request.employee?.fullName || 'N/A'}`);
    console.log(`Email: ${request.employee?.email || 'N/A'}`);
    console.log(`Department: ${request.employee?.department || 'N/A'}`);
    console.log(`Amount Requested: ${request.amountRequested || 0}`);
    console.log(`Purpose: ${request.purpose || 'N/A'}`);
    console.log(`Status: ${request.status || 'N/A'}`);
    console.log(`Created At: ${request.createdAt || 'N/A'}`);
    console.log('---------------------');

    console.log('\n⚠️  WARNING: This will permanently delete this request!');
    console.log('This action cannot be undone.\n');

    // Delete the request
    const result = await Request.findByIdAndDelete(requestId);

    if (result) {
      console.log('\n✅ Successfully deleted the request!');
      console.log('\nDeletion Summary:');
      console.log('---------------------');
      console.log(`Deleted Request ID: ${requestId}`);
      console.log(`Display ID: ${result.displayId || 'N/A'}`);
      console.log(`Employee: ${result.employee?.fullName || 'N/A'}`);
      console.log(`Amount: ${result.amountRequested || 0}`);
      console.log('Status: Request permanently removed from the system');
      console.log('---------------------');
    } else {
      console.log('\n❌ Failed to delete the request.');
    }

  } catch (error) {
    console.error('\n❌ Error deleting request:', error);
    console.error('Error details:', error.message);
    
    if (error.name === 'CastError') {
      console.error('\n💡 Tip: The request ID format appears to be invalid.');
    }
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the deletion script
deleteSpecificRequest();