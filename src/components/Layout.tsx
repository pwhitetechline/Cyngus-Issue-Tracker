import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { Button } from './ui/button';
import { 
  LayoutDashboard, 
  PlusCircle, 
  LogOut, 
  Settings, 
  Menu, 
  X, 
  Bug, 
  Search,
  Bell,
  Users,
  CheckCircle2,
  MessageSquare,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ThemeToggle } from './ThemeToggle';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { Input } from './ui/input';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { user, logout, isAdmin } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'issues', label: 'All Issues', icon: Bug },
    { id: 'create', label: 'New Issue', icon: PlusCircle },
    ...(isAdmin ? [{ id: 'users', label: 'Manage Users', icon: Users }] : []),
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="bg-primary rounded-lg p-2 flex-shrink-0">
            <Bug className="w-6 h-6 text-primary-foreground" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-foreground">Cygnus</span>}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                activeTab === item.id 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span>{item.label}</span>}
              {activeTab === item.id && isSidebarOpen && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3 p-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {isSidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-8">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search issues, tags, or users..." 
                className="pl-10 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="icon" className="text-muted-foreground relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
                  )}
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-80 p-0">
                <DropdownMenuGroup>
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <DropdownMenuLabel className="p-0 font-bold">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.preventDefault();
                          markAllAsRead();
                        }}
                        className="text-xs h-7 px-2 text-primary hover:text-primary"
                      >
                        Mark all as read
                      </Button>
                    )}
                  </div>
                </DropdownMenuGroup>
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm italic">
                      No notifications yet
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map((notification) => (
                        <DropdownMenuItem 
                          key={notification.id}
                          onClick={() => notification.id && markAsRead(notification.id)}
                          className={cn(
                            "p-4 flex flex-col items-start gap-1 cursor-pointer border-b border-border/50 last:border-0",
                            !notification.read && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className={cn(
                              "p-1.5 rounded-full",
                              notification.type === 'ISSUE_ASSIGNED' && "bg-blue-500/10 text-blue-500",
                              notification.type === 'COMMENT_ADDED' && "bg-green-500/10 text-green-500",
                              notification.type === 'STATUS_CHANGED' && "bg-amber-500/10 text-amber-500",
                              !notification.type && "bg-primary/10 text-primary"
                            )}>
                              {notification.type === 'ISSUE_ASSIGNED' && <UserPlus className="w-3 h-3" />}
                              {notification.type === 'COMMENT_ADDED' && <MessageSquare className="w-3 h-3" />}
                              {notification.type === 'STATUS_CHANGED' && <RefreshCw className="w-3 h-3" />}
                              {!notification.type && <Bell className="w-3 h-3" />}
                            </div>
                            <span className={cn(
                              "text-sm text-foreground",
                              !notification.read ? "font-bold" : "font-medium"
                            )}>
                              {notification.title}
                            </span>
                            {!notification.read && (
                              <div className="w-1.5 h-1.5 bg-primary rounded-full ml-auto" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 pl-7">
                            {notification.message}
                          </p>
                          <span className="text-[10px] text-muted-foreground/60 pl-7 mt-1">
                            {notification.createdAt?.toDate ? formatDistanceToNow(notification.createdAt.toDate()) : 'just now'} ago
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button variant="ghost" className="w-full text-xs h-8 text-muted-foreground">
                    View all notifications
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-accent p-1 rounded-full transition-colors outline-none">
                <Avatar className="w-8 h-8 border border-border">
                  <AvatarImage src={user?.photoURL} />
                  <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-foreground leading-none">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">{user?.role}</p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveTab('settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
