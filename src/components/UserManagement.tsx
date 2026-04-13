import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc,
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, UserRole } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Shield, User as UserIcon, Mail, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as User)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      toast.success('User role updated');
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (email === 'PWhite.XM@gmail.com') {
      toast.error('Cannot delete the bootstrap admin');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user ${email}? This will remove their profile but not their reported issues.`)) return;

    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('User deleted successfully');
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
    </div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage team members, roles, and access permissions.</p>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/50 border-b border-border/50">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Active Team Members
          </CardTitle>
          <CardDescription>
            Assign roles to control what users can see and do in the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="pl-6">User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.uid} className="border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 border border-border">
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{user.displayName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{user.uid.slice(0, 8)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4 text-muted-foreground/60" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4 text-muted-foreground/60" />
                      {user.createdAt?.toDate ? format(user.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={user.role === 'ADMIN' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground'}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <Select 
                        value={user.role} 
                        onValueChange={(v) => handleRoleChange(user.uid, v as UserRole)}
                        disabled={user.email === 'PWhite.XM@gmail.com'}
                      >
                        <SelectTrigger className="w-[130px] h-9 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="REPORTER">Reporter</SelectItem>
                          <SelectItem value="ASSIGNEE">Assignee</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive h-9 w-9"
                        onClick={() => handleDeleteUser(user.uid, user.email)}
                        disabled={user.email === 'PWhite.XM@gmail.com'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
