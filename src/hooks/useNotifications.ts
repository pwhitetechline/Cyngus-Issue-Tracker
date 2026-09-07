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
import { db } from '../lib/firebase';
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
      if (recipientEmail) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: recipientEmail,
              subject: notification.title,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #000;">${notification.title}</h2>
                  <p>${notification.message}</p>
                  ${notification.link ? `<a href="${window.location.origin}${notification.link}" style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Issue</a>` : ''}
                </div>
              `
            }),
          });
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
