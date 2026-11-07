import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Notification } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { useAuth } from '../hooks/useAuth';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const path = 'notifications';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      setLoading(false);
    }, (error) => {
      console.error('Notification fetch error:', error);
      handleFirestoreError(error, OperationType.LIST, path, false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id!), { read: true })));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>, recipientEmail?: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        read: false,
        createdAt: serverTimestamp(),
      });

      // If an email is provided, send the email via our API
      if (recipientEmail && recipientEmail.includes('@')) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              to: recipientEmail.trim().toLowerCase(),
              subject: notification.title,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                  <div style="margin-bottom: 16px;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; background-color: #f1f5f9; padding: 3px 8px; border-radius: 4px;">
                      ${notification.type || 'NOTIFICATION'}
                    </span>
                  </div>
                  <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">${notification.title}</h2>
                  <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">${notification.message}</p>
                  ${notification.link ? `
                    <div style="margin-top: 24px;">
                      <a href="${window.location.origin}${notification.link}" style="display: inline-block; padding: 10px 18px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                        View Issue
                      </a>
                    </div>
                  ` : ''}
                  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
                    This is an automated notification from Web Direct Brands Issue Tracker.
                  </div>
                </div>
              `
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.warn('[Notifications] Email delivery status:', response.status, errData);
          } else {
            console.log('[Notifications] Email sent successfully to', recipientEmail);
          }
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  };

  return { 
    notifications, 
    unreadCount: notifications.filter(n => !n.read).length,
    loading, 
    markAsRead, 
    markAllAsRead,
    createNotification 
  };
}
