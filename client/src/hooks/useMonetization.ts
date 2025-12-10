/**
 * useMonetization Hook
 * 
 * React hook for accessing monetization state and actions.
 * Handles initialization, status tracking, and ad display.
 * 
 * Usage:
 *   const { isPremium, adsEnabled, showUpgradeModal, purchase } = useMonetization();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  MonetizationStatus,
  Product,
  MONETIZATION_FLAGS,
  initializeAds,
  initializePurchases,
  getMonetizationStatus,
  getAvailableProducts,
  purchaseProduct,
  restorePurchases,
  showBanner,
  hideBanner,
  maybeShowInterstitial,
  shouldShowAdsOnPage,
} from '@/lib/monetization';

interface UseMonetizationReturn {
  // Status
  status: MonetizationStatus;
  isLoading: boolean;
  isPremium: boolean;
  adsEnabled: boolean;
  
  // Products
  products: Product[];
  
  // Actions
  purchase: (productId: string) => Promise<boolean>;
  restore: () => Promise<void>;
  trackAction: () => Promise<void>; // Call after major actions to maybe show interstitial
  
  // UI helpers
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
}

const DEFAULT_STATUS: MonetizationStatus = {
  isPremium: false,
  hasActiveSubscription: false,
  subscriptionTier: 'free',
  adsEnabled: true,
};

export function useMonetization(): UseMonetizationReturn {
  const [status, setStatus] = useState<MonetizationStatus>(DEFAULT_STATUS);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [location] = useLocation();
  
  const initialized = useRef(false);

  // Initialize monetization on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function initialize() {
      if (!MONETIZATION_FLAGS.enabled) {
        setIsLoading(false);
        return;
      }

      try {
        // Initialize services
        await Promise.all([
          initializeAds(),
          initializePurchases(),
        ]);

        // Get initial status and products
        const [currentStatus, availableProducts] = await Promise.all([
          getMonetizationStatus(),
          getAvailableProducts(),
        ]);

        setStatus(currentStatus);
        setProducts(availableProducts);
      } catch (error) {
        console.error('[useMonetization] Initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, []);

  // Handle banner ads based on route and premium status
  useEffect(() => {
    if (!MONETIZATION_FLAGS.enabled || !MONETIZATION_FLAGS.adsEnabled) {
      return;
    }

    // Don't show ads for premium users
    if (status.isPremium) {
      hideBanner();
      return;
    }

    // Show/hide banner based on current page
    if (shouldShowAdsOnPage(location)) {
      showBanner('bottom');
    } else {
      hideBanner();
    }

    // Cleanup on unmount
    return () => {
      hideBanner();
    };
  }, [location, status.isPremium]);

  // Purchase handler
  const purchase = useCallback(async (productId: string): Promise<boolean> => {
    if (!MONETIZATION_FLAGS.enabled) {
      if (MONETIZATION_FLAGS.debugMode) {
        console.log('[useMonetization] Would purchase:', productId);
      }
      return false;
    }

    const result = await purchaseProduct(productId);
    
    if (result.success) {
      // Refresh status after successful purchase
      const newStatus = await getMonetizationStatus();
      setStatus(newStatus);
      setShowUpgradeModal(false);
    }
    
    return result.success;
  }, []);

  // Restore purchases handler
  const restore = useCallback(async (): Promise<void> => {
    if (!MONETIZATION_FLAGS.enabled) {
      return;
    }

    const newStatus = await restorePurchases();
    setStatus(newStatus);
  }, []);

  // Track user action (for interstitial frequency)
  const trackAction = useCallback(async (): Promise<void> => {
    if (!MONETIZATION_FLAGS.enabled || status.isPremium) {
      return;
    }

    await maybeShowInterstitial();
  }, [status.isPremium]);

  return {
    status,
    isLoading,
    isPremium: status.isPremium,
    adsEnabled: status.adsEnabled && !status.isPremium,
    products,
    purchase,
    restore,
    trackAction,
    showUpgradeModal,
    setShowUpgradeModal,
  };
}
