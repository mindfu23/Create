/**
 * Monetization Module - Public API
 * 
 * Re-exports all monetization functionality for easy importing.
 * 
 * Usage:
 *   import { useMonetization, initializeAds, purchaseProduct } from '@/lib/monetization';
 */

// Types
export type {
  MonetizationStatus,
  Product,
  PurchaseResult,
  AdConfig,
  AdPlacement,
  SubscriptionTier,
  Platform,
} from './types';

// Configuration
export {
  MONETIZATION_FLAGS,
  AD_CONFIG,
  PRODUCTS,
  TIER_FEATURES,
  PLATFORM_CONFIG,
  getProduct,
  getSubscriptionProducts,
  getOneTimePurchaseProducts,
  isMonetizationActive,
} from './config';

// Ad Service
export {
  getPlatform,
  initializeAds,
  showBanner,
  hideBanner,
  showInterstitial,
  maybeShowInterstitial,
  showRewardedAd,
  shouldShowAdsOnPage,
} from './adService';

// Purchase Service
export {
  initializePurchases,
  getMonetizationStatus,
  getAvailableProducts,
  purchaseProduct,
  restorePurchases,
  hasFeatureAccess,
} from './purchaseService';
