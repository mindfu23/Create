/**
 * Monetization Configuration
 * 
 * Central configuration for ads, purchases, and subscriptions.
 * Update these values when ready to activate monetization.
 */

import { AdConfig, Product, SubscriptionTier } from './types';

// ============================================================================
// FEATURE FLAGS - Set to true when ready to activate
// ============================================================================
export const MONETIZATION_FLAGS = {
  // Master switch - must be true for any monetization
  enabled: false,
  
  // Individual feature flags
  adsEnabled: false,
  purchasesEnabled: false,
  subscriptionsEnabled: false,
  
  // Debug mode - logs monetization events to console
  debugMode: true,
};

// ============================================================================
// AD CONFIGURATION
// ============================================================================
export const AD_CONFIG: AdConfig = {
  enabled: MONETIZATION_FLAGS.adsEnabled,
  
  // AdMob Unit IDs - Replace with real IDs when ready
  // These are test IDs that show test ads
  bannerAdUnitId: 'ca-app-pub-3940256099942544/6300978111',      // Test banner
  interstitialAdUnitId: 'ca-app-pub-3940256099942544/1033173712', // Test interstitial
  rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',     // Test rewarded
  
  // Pages where banner ads appear (when ads are enabled)
  showBannerOnPages: [
    '/',           // Home
    '/projects',   // Projects list
    '/todo',       // Todo list
  ],
  
  // Show interstitial ad every N major actions (e.g., saving a project)
  interstitialFrequency: 5,
};

// ============================================================================
// PRODUCT DEFINITIONS
// ============================================================================
export const PRODUCTS: Product[] = [
  {
    id: 'create_premium',
    name: 'Create Premium',
    description: 'Remove ads forever with a one-time purchase',
    price: 4.99,
    currency: 'USD',
    type: 'one_time',
    features: [
      'Remove all ads permanently',
      'Support app development',
      'Early access to new features',
    ],
  },
  {
    id: 'create_premium_monthly',
    name: 'Create Premium Monthly',
    description: 'Premium features with monthly billing',
    price: 1.99,
    currency: 'USD',
    type: 'subscription',
    period: 'monthly',
    features: [
      'Remove all ads',
      'Cloud sync across devices',
      'Priority support',
      'Cancel anytime',
    ],
  },
  {
    id: 'create_premium_yearly',
    name: 'Create Premium Yearly',
    description: 'Premium features with yearly billing (save 33%)',
    price: 15.99,
    currency: 'USD',
    type: 'subscription',
    period: 'yearly',
    features: [
      'Remove all ads',
      'Cloud sync across devices',
      'Priority support',
      'Cancel anytime',
      'Save 33% vs monthly',
    ],
  },
];

// ============================================================================
// SUBSCRIPTION TIER FEATURES
// ============================================================================
export const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    'Basic journal entries',
    'Basic project tracking',
    'Local storage',
    'Ads displayed',
  ],
  premium: [
    'Everything in Free',
    'No ads',
    'Cloud sync',
    'Unlimited entries',
  ],
  premium_plus: [
    'Everything in Premium',
    'Priority support',
    'Early access to features',
    'Custom themes',
  ],
};

// ============================================================================
// PLATFORM-SPECIFIC IDENTIFIERS
// ============================================================================
export const PLATFORM_CONFIG = {
  // RevenueCat API keys - Get from RevenueCat dashboard
  revenueCat: {
    ios: 'appl_XXXXXXXXXXXXXXXXXXXXXXXX',      // iOS API key
    android: 'goog_XXXXXXXXXXXXXXXXXXXXXXXX',  // Android API key
  },
  
  // Stripe (for web purchases)
  stripe: {
    publishableKey: 'pk_test_XXXXXXXXXXXXXXXXXXXXXXXX',
  },
  
  // AdMob App IDs
  admob: {
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get product by ID
 */
export function getProduct(productId: string): Product | undefined {
  return PRODUCTS.find(p => p.id === productId);
}

/**
 * Get all subscription products
 */
export function getSubscriptionProducts(): Product[] {
  return PRODUCTS.filter(p => p.type === 'subscription');
}

/**
 * Get one-time purchase products
 */
export function getOneTimePurchaseProducts(): Product[] {
  return PRODUCTS.filter(p => p.type === 'one_time');
}

/**
 * Check if monetization is fully enabled
 */
export function isMonetizationActive(): boolean {
  return MONETIZATION_FLAGS.enabled && (
    MONETIZATION_FLAGS.adsEnabled ||
    MONETIZATION_FLAGS.purchasesEnabled ||
    MONETIZATION_FLAGS.subscriptionsEnabled
  );
}
