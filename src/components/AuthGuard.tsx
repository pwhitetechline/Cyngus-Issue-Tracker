import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { 
  LogIn, 
  ShieldAlert, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Info
} from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isSigningIn, authError, signIn, signInRedirect, clearAuthError } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-dev-rnaxhre56mvesjd6th7b4b-342415813712.us-east1.run.app';

  const copyHostname = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openInNewTab = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Initializing security session...</p>
      </div>
    );
  }

  if (!user) {
    const isDomainError = authError?.includes('not authorized') || authError?.includes('unauthorized-domain');
    const isPopupError = authError?.includes('pop-up') || authError?.includes('closed before completion');

    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-zinc-950 p-4">
        <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-primary">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShieldAlert className="w-9 h-9 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Web Direct Brands</CardTitle>
            <CardDescription className="text-sm">
              Internal Issue Tracker & Engineering Workflow
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-2">
            {/* Embedded Iframe Notice */}
            {isInIframe && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-left space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                    <strong>Notice:</strong> Browser security (Chrome/Safari) restricts Google popups inside embedded preview iframes, which causes the screen to flicker back and forth. Open in a dedicated tab for 100% reliable login.
                  </p>
                </div>
                <Button 
                  onClick={openInNewTab}
                  variant="default" 
                  size="sm"
                  className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white h-8"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open in Dedicated Browser Tab to Sign In
                </Button>
              </div>
            )}

            {/* Error Message Box */}
            {authError && (
              <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-left space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-red-800 dark:text-red-200 leading-relaxed">
                    <strong className="font-semibold block mb-0.5">Authentication Problem Detected</strong>
                    {authError}
                  </div>
                </div>

                {/* Specific Guidance for Domain Not Authorized */}
                {isDomainError && (
                  <div className="pt-2 border-t border-red-200 dark:border-red-800/60 text-xs text-red-900 dark:text-red-200 space-y-1.5">
                    <p className="font-medium">To authorize this domain in Firebase:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Open Firebase Console: <a href="https://console.firebase.google.com/project/gen-lang-client-0431525341/authentication/settings" target="_blank" rel="noreferrer" className="underline font-semibold text-primary inline-flex items-center gap-1">Auth Settings <ExternalLink className="w-3 h-3" /></a></li>
                      <li>Under <strong>Authorized domains</strong>, click <strong>Add domain</strong></li>
                      <li>Paste the domain below:</li>
                    </ol>
                    <div className="flex items-center gap-2 mt-1 bg-white dark:bg-zinc-900 p-1.5 px-2.5 rounded border border-red-300 dark:border-red-800">
                      <code className="font-mono text-xs font-bold text-foreground flex-1 select-all">{currentHostname}</code>
                      <Button variant="ghost" size="sm" onClick={copyHostname} className="h-6 px-2 text-xs">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Standard Sign In Button */}
            <Button 
              onClick={signIn} 
              disabled={isSigningIn}
              variant={isInIframe ? "outline" : "default"}
              className="w-full h-12 text-base font-semibold shadow-sm" 
              size="lg"
            >
              {isSigningIn ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign in with Google
                </>
              )}
            </Button>

            {/* If popup error, offer redirect */}
            {isPopupError && (
              <Button 
                variant="ghost" 
                onClick={signInRedirect}
                disabled={isSigningIn}
                className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Or click here to Sign in via Full Page Redirect
              </Button>
            )}

            {/* Expandable Firebase authorized domain info */}
            <div className="border-t border-border/60 pt-3">
              <button 
                type="button"
                onClick={() => setShowDomainHelp(!showDomainHelp)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground"
              >
                <span>Environment: <code className="font-mono text-primary font-medium">{currentHostname}</code></span>
                {showDomainHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              
              {showDomainHelp && (
                <div className="mt-2 p-2.5 bg-muted/50 rounded text-xs text-muted-foreground space-y-1.5">
                  <p>If Google login closes instantly, ensure this hostname is listed under Authorized domains in Firebase:</p>
                  <div className="flex items-center justify-between gap-2 bg-background p-1.5 px-2 rounded border border-border">
                    <span className="font-mono truncate select-all">{currentHostname}</span>
                    <Button variant="ghost" size="sm" onClick={copyHostname} className="h-6 px-2 text-xs">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                  <a 
                    href="https://console.firebase.google.com/project/gen-lang-client-0431525341/authentication/settings" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-primary hover:underline font-medium inline-flex items-center gap-1 mt-1 block"
                  >
                    Open Firebase Auth Settings <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              Admin access is automatically assigned to <strong>pwhite.xm@gmail.com</strong> upon sign-in.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
