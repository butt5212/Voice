import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const saveGeneration = async (data: {
  text: string;
  audioUrl: string;
  voice: string;
  ambientSound?: string;
  effects?: string[];
}) => {
  const path = 'generations';
  try {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    return await addDoc(collection(db, path), {
      ...data,
      userId: auth.currentUser.uid,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const useGenerations = (callback: (data: any[]) => void) => {
  const path = 'generations';
  if (!auth.currentUser) return () => {};

  const q = query(
    collection(db, path),
    where('userId', '==', auth.currentUser.uid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const deleteGeneration = async (id: string) => {
  const path = `generations/${id}`;
  try {
    await deleteDoc(doc(db, 'generations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
