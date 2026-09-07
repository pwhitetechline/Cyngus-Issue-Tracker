
import { db } from './firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';

/**
 * Fallback storage utility that stores files as Base64 strings in Firestore 
 * when Firebase Storage is unreachable.
 */

export async function uploadFileFallback(file: File): Promise<{ name: string, url: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        
        // Store in a dedicated collection for attachments
        const docRef = await addDoc(collection(db, 'attachments'), {
          name: file.name,
          type: file.type,
          data: base64Data,
          createdAt: new Date().toISOString()
        });

        // The URL will be a special path that we can resolve in our components
        // Or just the base64 data itself for immediate preview
        resolve({
          name: file.name,
          url: base64Data // For now, use the data URI directly for instant feedback
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
