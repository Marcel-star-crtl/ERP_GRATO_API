const admin = require('firebase-admin');

const serviceAccount = {
  type: "service_account",
  project_id: "njangi-app-299d6",
  private_key_id: "ba9f4d167af4505a5537d7203125ecc91f9bff76",
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: "firebase-adminsdk-tjs9y@njangi-app-299d6.iam.gserviceaccount.com",
  client_id: "104084527768258223198",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-tjs9y%40njangi-app-299d6.iam.gserviceaccount.com"
};

const initializeFirebase = () => {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: "njangi-app-299d6",
            clientEmail: "firebase-adminsdk-tjs9y@njangi-app-299d6.iam.gserviceaccount.com",
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        console.log('Firebase Admin SDK initialized successfully');
      }
      return admin;
    } catch (error) {
      console.error('Firebase Admin SDK initialization error:', error);
      throw error;
    }
  };
  
  module.exports = { admin, initializeFirebase };