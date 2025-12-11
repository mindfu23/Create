/**
 * Cloud Storage Settings Component
 * 
 * UI for managing cloud storage connections.
 */

import React, { useState } from 'react';
import { 
  Cloud, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Star,
  StarOff,
  Server,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { 
  FaDropbox, 
  FaGoogleDrive, 
  FaMicrosoft, 
  FaBox,
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCloudStorage, useCloudProviders } from '@/lib/cloudStorage';
import type { CloudProvider, CredentialAuth } from '@shared/cloudStorage';

// Provider icons
const providerIcons: Record<CloudProvider, React.ReactNode> = {
  dropbox: <FaDropbox className="h-5 w-5 text-blue-500" />,
  google_drive: <FaGoogleDrive className="h-5 w-5 text-green-500" />,
  onedrive: <FaMicrosoft className="h-5 w-5 text-blue-600" />,
  box: <FaBox className="h-5 w-5 text-blue-400" />,
  webdav: <Server className="h-5 w-5 text-gray-500" />,
  sftp: <Terminal className="h-5 w-5 text-gray-500" />,
};

interface CloudStorageSettingsProps {
  userId: string;
  isPremiumUser?: boolean;
}

export function CloudStorageSettings({ userId, isPremiumUser = false }: CloudStorageSettingsProps) {
  const { toast } = useToast();
  const providers = useCloudProviders();
  
  const {
    isAvailable,
    connections,
    activeConnection,
    isLoading,
    syncStatus,
    pendingCount,
    connectProvider,
    connectWithCredentials,
    disconnect,
    deleteConnection,
    setDefaultConnection,
    testConnection,
    syncNow,
    refresh,
  } = useCloudStorage({ userId, isPremiumUser });
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | ''>('');
  const [credentials, setCredentials] = useState<Partial<CredentialAuth>>({});
  const [displayName, setDisplayName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Premium gate
  if (!isAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Cloud Storage
          </CardTitle>
          <CardDescription>
            Sync your data across devices with cloud storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Cloud className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Cloud storage sync is a premium feature
            </p>
            <Button variant="default">
              Upgrade to Premium
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Handle OAuth connection
  const handleOAuthConnect = (provider: CloudProvider) => {
    connectProvider(provider);
  };
  
  // Handle credential connection
  const handleCredentialConnect = async () => {
    if (!selectedProvider || selectedProvider === 'dropbox' || 
        selectedProvider === 'google_drive' || selectedProvider === 'onedrive' || 
        selectedProvider === 'box') {
      return;
    }
    
    if (!credentials.serverUrl || !credentials.username) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setIsConnecting(true);
    
    try {
      const success = await connectWithCredentials(
        selectedProvider,
        credentials as CredentialAuth,
        displayName || `My ${selectedProvider.toUpperCase()} Server`
      );
      
      if (success) {
        toast({
          title: 'Connected!',
          description: `Successfully connected to ${displayName || selectedProvider}`,
        });
        setIsAddDialogOpen(false);
        resetForm();
      } else {
        toast({
          title: 'Connection Failed',
          description: 'Could not connect to the server. Please check your credentials.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while connecting',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  const resetForm = () => {
    setSelectedProvider('');
    setCredentials({});
    setDisplayName('');
  };
  
  const handleDelete = async (connectionId: string) => {
    await deleteConnection(connectionId);
    toast({
      title: 'Disconnected',
      description: 'Cloud storage connection removed',
    });
  };
  
  const handleSetDefault = async (connectionId: string) => {
    await setDefaultConnection(connectionId);
    toast({
      title: 'Default Set',
      description: 'This connection is now your default',
    });
  };
  
  const handleTest = async (connectionId: string) => {
    const success = await testConnection(connectionId);
    toast({
      title: success ? 'Connection OK' : 'Connection Failed',
      description: success 
        ? 'Successfully connected to cloud storage' 
        : 'Could not connect. Please check your settings.',
      variant: success ? 'default' : 'destructive',
    });
  };
  
  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 animate-spin mr-1" />Syncing</Badge>;
      case 'pending':
        return <Badge variant="outline">{pendingCount} pending</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      case 'synced':
      default:
        return <Badge variant="default"><Check className="h-3 w-3 mr-1" />Synced</Badge>;
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Cloud Storage
            </CardTitle>
            <CardDescription>
              Sync your data across devices
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getSyncStatusBadge()}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={syncNow}
              disabled={syncStatus === 'syncing'}
            >
              <RefreshCw className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connected accounts */}
        {connections.length > 0 && (
          <div className="space-y-2">
            <Label>Connected Accounts</Label>
            {connections.map((conn) => (
              <div 
                key={conn.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {providerIcons[conn.provider]}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {conn.displayName}
                      {conn.isDefault && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {conn.isConnected ? 'Connected' : 'Disconnected'}
                      {conn.lastSyncAt && ` · Last sync: ${new Date(conn.lastSyncAt).toLocaleString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(conn.id)}
                    title="Test connection"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {!conn.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(conn.id)}
                      title="Set as default"
                    >
                      <StarOff className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(conn.id)}
                    title="Remove connection"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Add connection */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Cloud Storage
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Connect Cloud Storage</DialogTitle>
              <DialogDescription>
                Choose a cloud storage provider to sync your data
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Provider selection */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select 
                  value={selectedProvider} 
                  onValueChange={(v) => {
                    setSelectedProvider(v as CloudProvider);
                    resetForm();
                    setSelectedProvider(v as CloudProvider);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem 
                        key={provider.id} 
                        value={provider.id}
                        disabled={!provider.isConfigured && provider.authMethod === 'oauth'}
                      >
                        <div className="flex items-center gap-2">
                          {providerIcons[provider.id]}
                          <span>{provider.name}</span>
                          {!provider.isConfigured && provider.authMethod === 'oauth' && (
                            <span className="text-xs text-muted-foreground">(Not configured)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* OAuth providers */}
              {selectedProvider && ['dropbox', 'google_drive', 'onedrive', 'box'].includes(selectedProvider) && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Click below to sign in with {providers.find(p => p.id === selectedProvider)?.name}
                  </p>
                  <Button onClick={() => handleOAuthConnect(selectedProvider)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect with {providers.find(p => p.id === selectedProvider)?.name}
                  </Button>
                </div>
              )}
              
              {/* Credential-based providers (WebDAV/SFTP) */}
              {selectedProvider && ['webdav', 'sftp'].includes(selectedProvider) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="My Server"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="serverUrl">Server URL *</Label>
                    <Input
                      id="serverUrl"
                      placeholder={selectedProvider === 'webdav' 
                        ? 'https://webdav.example.com' 
                        : 'sftp://example.com'
                      }
                      value={credentials.serverUrl || ''}
                      onChange={(e) => setCredentials({ ...credentials, serverUrl: e.target.value })}
                    />
                  </div>
                  
                  {selectedProvider === 'sftp' && (
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        placeholder="22"
                        value={credentials.port || ''}
                        onChange={(e) => setCredentials({ ...credentials, port: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={credentials.username || ''}
                      onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={credentials.password || ''}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    />
                  </div>
                  
                  {selectedProvider === 'sftp' && (
                    <div className="space-y-2">
                      <Label htmlFor="privateKey">Private Key (alternative to password)</Label>
                      <textarea
                        id="privateKey"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="-----BEGIN RSA PRIVATE KEY-----"
                        value={credentials.privateKey || ''}
                        onChange={(e) => setCredentials({ ...credentials, privateKey: e.target.value })}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="basePath">Base Path (optional)</Label>
                    <Input
                      id="basePath"
                      placeholder="/path/to/folder"
                      value={credentials.basePath || ''}
                      onChange={(e) => setCredentials({ ...credentials, basePath: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {selectedProvider && ['webdav', 'sftp'].includes(selectedProvider) && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCredentialConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
        
        {/* No connections message */}
        {connections.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No cloud storage connected. Add one above to sync your data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
