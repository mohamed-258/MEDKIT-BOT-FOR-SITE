import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

console.log("Environment keys:", Object.keys(process.env).filter(k => k.toLowerCase().includes("credentials") || k.toLowerCase().includes("google") || k.toLowerCase().includes("firebase") || k.toLowerCase().includes("sa") || k.toLowerCase().includes("key") || k.toLowerCase().includes("secret")));

const firebaseConfig = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const adminApp = admin.initializeApp({ projectId: firebaseConfig.projectId });
const firestore = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

try {
  firestore.settings({ ignoreUndefinedProperties: true });
  console.log("Settings applied successfully!");
  
  (async () => {
    try {
      const snap = await firestore.collection("settings").doc("global").get();
      if (snap.exists) {
        console.log("SUCCESS READ: settings/global exists, data:", snap.data());
      } else {
        console.log("SUCCESS READ: settings/global does not exist, but document lookup worked.");
      }
      
      // Test write
      await firestore.collection("system").doc("test_write").set({
        timestamp: Date.now(),
        status: "test"
      });
      console.log("SUCCESS WRITE: system/test_write successfully written!");
    } catch (e: any) {
      console.error("FIRESTORE ACTION FAILED:", e.message, "\nCode:", e.code);
    }
  })();
} catch (err: any) {
  console.error("Error applying settings:", err.message);
}
