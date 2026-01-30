"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAndProfile = exports.demoteUserFromAdmin = exports.promoteUserToAdmin = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const requireAdmin = (context) => {
    if (!context.auth || context.auth.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }
};
const deleteByQuery = async (query, batchSize = 200) => {
    const snapshot = await query.limit(batchSize).get();
    if (snapshot.empty)
        return;
    const batch = db.batch();
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    if (snapshot.size >= batchSize) {
        await deleteByQuery(query, batchSize);
    }
};
exports.promoteUserToAdmin = functions.https.onCall(async (data, context) => {
    requireAdmin(context);
    const userId = data === null || data === void 0 ? void 0 : data.userId;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    await admin.auth().setCustomUserClaims(userId, { admin: true });
    await db.collection('profiles').doc(userId).set({
        role: 'admin',
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
});
exports.demoteUserFromAdmin = functions.https.onCall(async (data, context) => {
    requireAdmin(context);
    const userId = data === null || data === void 0 ? void 0 : data.userId;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    await admin.auth().setCustomUserClaims(userId, { admin: false });
    await db.collection('profiles').doc(userId).set({
        role: 'standard',
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
});
exports.deleteUserAndProfile = functions.https.onCall(async (data, context) => {
    var _a;
    requireAdmin(context);
    const userId = data === null || data === void 0 ? void 0 : data.userId;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    if (((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) === userId) {
        throw new functions.https.HttpsError('failed-precondition', 'Admin cannot delete their own account');
    }
    const projectsSnapshot = await db.collection('projects').where('created_by', '==', userId).get();
    for (const docSnap of projectsSnapshot.docs) {
        await db.recursiveDelete(docSnap.ref);
    }
    await deleteByQuery(db.collection('project_reports').where('created_by', '==', userId));
    await deleteByQuery(db.collectionGroup('snags').where('created_by', '==', userId));
    await deleteByQuery(db.collectionGroup('comments').where('author_id', '==', userId));
    await db.collection('profiles').doc(userId).delete().catch(() => undefined);
    await admin.auth().deleteUser(userId);
    return { success: true };
});
