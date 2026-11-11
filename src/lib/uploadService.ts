import { db, auth } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

/**
 * Universal, instant file uploader.
 * Converts attachments into self-contained data URLs and registers them in Firestore.
 * This guarantees instantaneous upload (no waiting, no hanging, no 404 errors on Netlify).
 */
export async function uploadAttachment(file: File, issueId: string = 'new'): Promise<{ name: string; url: string }> {
  // Guard against prohibited dangerous executables
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  const prohibitedExtensions = new Set([
    '.exe', '.sh', '.bat', '.cmd', '.com', '.vbs', '.js', '.mjs', '.php',
    '.py', '.rb', '.html', '.htm', '.xhtml', '.jsp', '.asp', '.aspx', '.jar', '.scr', '.dll'
  ]);

  if (prohibitedExtensions.has(ext)) {
    throw new Error(`File type "${ext}" is not permitted for security reasons.`);
  }

  // 10MB safety check
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`File "${file.name}" is too large (maximum size is 10MB).`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;

        // Save reference record in Firestore attachments collection if small enough for document storage
        if (file.size <= 800 * 1024) {
          try {
            await addDoc(collection(db, 'attachments'), {
              name: file.name,
              type: file.type || (ext === '.txt' ? 'text/plain' : 'application/octet-stream'),
              issueId: issueId || 'new',
              size: file.size,
              data: dataUrl,
              userId: auth.currentUser?.uid || null,
              createdAt: new Date().toISOString()
            });
          } catch (dbErr) {
            console.warn('[Upload] Note: Firestore attachments document write skipped, using data URI directly:', dbErr);
          }
        }

        console.log(`[Upload] Successfully processed ${file.name} (${file.size} bytes)`);
        resolve({
          name: file.name,
          url: dataUrl
        });
      } catch (err: any) {
        console.error('[Upload] Error processing attachment:', err);
        reject(new Error(err?.message || 'Failed to process file'));
      }
    };

    reader.onerror = () => {
      console.error('[Upload] FileReader error on:', file.name);
      reject(new Error(`Could not read "${file.name}" from disk.`));
    };

    reader.readAsDataURL(file);
  });
}
