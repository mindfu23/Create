/**
 * OAuth Callback Page
 * 
 * Handles OAuth redirects from cloud storage providers.
 * Extracts the authorization code and passes it back to the opener window.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CallbackStatus = 'processing' | 'success' | 'error';

export const OAuthCallbackPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [provider, setProvider] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Handle error from provider
        if (error) {
          setStatus('error');
          setErrorMessage(errorDescription || error || 'Authorization was denied');
          return;
        }

        // Validate required params
        if (!code) {
          setStatus('error');
          setErrorMessage('No authorization code received');
          return;
        }

        // Parse state to get provider and any other data
        let stateData: { provider?: string; returnUrl?: string } = {};
        if (state) {
          try {
            stateData = JSON.parse(atob(state));
            if (stateData.provider) {
              setProvider(stateData.provider);
            }
          } catch {
            // State might be just the provider name
            setProvider(state);
            stateData = { provider: state };
          }
        }

        // If opened in popup, send message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth_callback',
            provider: stateData.provider || 'unknown',
            code,
            state,
          }, window.location.origin);
          
          setStatus('success');
          
          // Close popup after short delay
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          // If not in popup, redirect to settings with the code
          // This handles cases where popup was blocked
          const redirectUrl = stateData.returnUrl || '/settings';
          
          // Store the auth code temporarily
          sessionStorage.setItem('oauth_callback_code', code);
          sessionStorage.setItem('oauth_callback_provider', stateData.provider || '');
          sessionStorage.setItem('oauth_callback_state', state || '');
          
          setStatus('success');
          
          // Redirect after short delay
          setTimeout(() => {
            setLocation(redirectUrl);
          }, 1500);
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setErrorMessage('Failed to process authorization');
      }
    };

    handleCallback();
  }, [setLocation]);

  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'processing' && (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Connecting...
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-6 w-6 text-green-500" />
                Connected!
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-6 w-6 text-red-500" />
                Connection Failed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {status === 'processing' && (
              provider 
                ? `Connecting to ${provider}...`
                : 'Processing authorization...'
            )}
            {status === 'success' && (
              'Your cloud storage has been connected. This window will close automatically.'
            )}
            {status === 'error' && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status === 'error' && (
            <Button 
              variant="outline" 
              onClick={() => setLocation('/settings')}
            >
              Back to Settings
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
