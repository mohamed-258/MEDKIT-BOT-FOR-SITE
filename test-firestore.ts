import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const adminApp = admin.initializeApp({ projectId: firebaseConfig.projectId });
const firestore = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

try {
  firestore.settings({ ignoreUndefinedProperties: true });
  console.log("Settings applied successfully!");
} catch (err) {
  console.error("Error applying settings:", err.message);
}
