import { useAuth } from '../hooks/useAuth';
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
  Users
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
            <Button variant="ghost" size="icon" className="text-muted-foreground relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
            </Button>
            
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
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
