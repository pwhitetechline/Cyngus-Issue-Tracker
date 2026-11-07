import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from 'next-themes';
import { 
  User, 
  Bell, 
  Moon, 
  Sun, 
  Monitor, 
  Shield, 
  LogOut,
  Mail,
  UserCircle,
  Zap,
  Sliders
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from './ui/tabs';
import { getAutomationSettings, saveAutomationSettings, AutomationSettings } from '../lib/automation';
import { toast } from 'sonner';

export function Settings() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const [notifications, setNotifications] = useState({
    assignments: true,
    statusChanges: true,
    comments: true,
    issueCreation: true,
    emailDigest: false
  });

  const [automation, setAutomation] = useState<AutomationSettings>(() => getAutomationSettings());

  const updateAutomationRule = (key: keyof AutomationSettings, value: boolean) => {
    const updated = { ...automation, [key]: value };
    setAutomation(updated);
    saveAutomationSettings(updated);
    toast.success('Automation preferences updated');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and application settings.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                User Profile
              </CardTitle>
              <CardDescription>Your personal information and account status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 overflow-hidden">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-10 h-10 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{user?.displayName || 'Anonymous User'}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {user?.email}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={isAdmin ? "default" : "secondary"} className="uppercase text-[10px]">
                      {user?.role || 'REPORTER'}
                    </Badge>
                    {isAdmin && (
                      <Badge variant="outline" className="border-primary/50 text-primary uppercase text-[10px] flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Admin Access
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Account Actions</h4>
                <Button variant="destructive" onClick={logout} className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6 space-y-6">
          {/* Appearance Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize how the application looks on your device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Sun className="w-6 h-6" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Moon className="w-6 h-6" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    theme === 'system' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Monitor className="w-6 h-6" />
                  <span className="text-sm font-medium">System</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>Choose when you want to be notified about issue activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label>New Issues Created</Label>
                      {isAdmin && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground italic">Notify admins when any new issue is created in the organization.</p>
                  </div>
                  <Switch 
                    checked={notifications.issueCreation} 
                    onCheckedChange={(val) => setNotifications(n => ({...n, issueCreation: val}))} 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>New Assignments</Label>
                    <p className="text-sm text-muted-foreground italic">Notify me when I am assigned to an issue.</p>
                  </div>
                  <Switch 
                    checked={notifications.assignments} 
                    onCheckedChange={(val) => setNotifications(n => ({...n, assignments: val}))} 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Status Updates</Label>
                    <p className="text-sm text-muted-foreground italic">Notify me when an issue I'm involved in changes status.</p>
                  </div>
                  <Switch 
                    checked={notifications.statusChanges} 
                    onCheckedChange={(val) => setNotifications(n => ({...n, statusChanges: val}))} 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>New Comments</Label>
                    <p className="text-sm text-muted-foreground italic">Notify me when someone comments on my issues.</p>
                  </div>
                  <Switch 
                    checked={notifications.comments} 
                    onCheckedChange={(val) => setNotifications(n => ({...n, comments: val}))} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Automation Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Workflow Automation
              </CardTitle>
              <CardDescription>Configure smart assignment routing and automated status transitions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-medium text-foreground">Workload-Based Auto-Assignment</Label>
                    <p className="text-sm text-muted-foreground italic">
                      Automatically route unassigned incoming issues to active team members with the lowest active issue count.
                    </p>
                  </div>
                  <Switch 
                    checked={automation.autoAssignEnabled} 
                    onCheckedChange={(val) => updateAutomationRule('autoAssignEnabled', val)} 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium text-foreground">Critical Escalation Routing</Label>
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                        High Priority
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      Directly route tickets with CRITICAL severity to the administrator team (PWhite.XM@gmail.com).
                    </p>
                  </div>
                  <Switch 
                    checked={automation.criticalEscalateToAdmin} 
                    onCheckedChange={(val) => updateAutomationRule('criticalEscalateToAdmin', val)} 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-medium text-foreground">Auto-Advance on Assignment</Label>
                    <p className="text-sm text-muted-foreground italic">
                      Automatically advance ticket status from OPEN to IN PROGRESS upon member assignment.
                    </p>
                  </div>
                  <Switch 
                    checked={automation.autoAdvanceOnAssign} 
                    onCheckedChange={(val) => updateAutomationRule('autoAdvanceOnAssign', val)} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
