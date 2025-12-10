/**
 * Purchase Service
 * 
 * Handles in-app purchases and subscriptions across platforms.
 * Uses RevenueCat for mobile (iOS/Android) via Capacitor plugin.
 * Uses Stripe for web purchases.
 * 
 * SETUP REQUIRED:
 * 1. Install: npm install @capgo/capacitor-purchases
 * 2. Create RevenueCat account and configure products
 * 3. Add API keys to config.ts
 * 4. Set MONETIZATION_FLAGS.purchasesEnabled = true
 * 
 * For web:
 * 1. Install: npm install @stripe/stripe-js
 * 2. Create Stripe account and configure products
 * 3. Add publishable key to config.ts
 */

import { MonetizationStatus, PurchaseResult, Product, SubscriptionTier } from './types';
import { MONETIZATION_FLAGS, PLATFORM_CONFIG, PRODUCTS } from './config';
import { getPlatform } from './adService';

// Cache the current status
let cachedStatus: MonetizationStatus | null = null;

/**
 * Default monetization status (free tier)
 */
const DEFAULT_STATUS: MonetizationStatus = {
  isPremium: false,
  hasActiveSubscription: false,
  subscriptionTier: 'free',
  adsEnabled: true,
};

/**
 * Initialize the purchase service
 * Call this once on app startup, after user is identified
 */
export async function initializePurchases(userId?: string): Promise<boolean> {
  if (!MONETIZATION_FLAGS.enabled || !MONETIZATION_FLAGS.purchasesEnabled) {
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Purchases] Purchases disabled by feature flag');
    }
    return false;
  }

  const platform = getPlatform();

  if (platform === 'web') {
    // Web uses Stripe - initialize separately
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Purchases] Web purchases use Stripe');
    }
    return true;
  }

  // Mobile - initialize RevenueCat
  try {
    const { Purchases } = await import('@capgo/capacitor-purchases');
    
    const apiKey = platform === 'ios' 
      ? PLATFORM_CONFIG.revenueCat.ios 
      : PLATFORM_CONFIG.revenueCat.android;

    await Purchases.configure({
      apiKey,
      appUserID: userId || undefined, // undefined = anonymous user
    });

    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Purchases] RevenueCat initialized');
    }
    return true;
  } catch (error) {
    console.error('[Purchases] Failed to initialize:', error);
    return false;
  }
}

/**
 * Get current monetization status
 */
export async function getMonetizationStatus(): Promise<MonetizationStatus> {
  if (!MONETIZATION_FLAGS.enabled || !MONETIZATION_FLAGS.purchasesEnabled) {
    return DEFAULT_STATUS;
  }

  // Return cached status if available
  if (cachedStatus) {
    return cachedStatus;
  }

  const platform = getPlatform();

  if (platform === 'web') {
    // Web - check against your backend or local storage
    // For now, return default
    return DEFAULT_STATUS;
  }

  // Mobile - check RevenueCat
  try {
    const { Purchases } = await import('@capgo/capacitor-purchases');
    
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Check for active entitlements
    const entitlements = customerInfo.customerInfo.entitlements.active;
    const hasPremium = 'premium' in entitlements || 'premium_plus' in entitlements;
    const hasPremiumPlus = 'premium_plus' in entitlements;
    
    let tier: SubscriptionTier = 'free';
    if (hasPremiumPlus) tier = 'premium_plus';
    else if (hasPremium) tier = 'premium';

    cachedStatus = {
      isPremium: hasPremium,
      hasActiveSubscription: Object.keys(entitlements).length > 0,
      subscriptionTier: tier,
      adsEnabled: !hasPremium, // Ads disabled for premium users
    };

    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Purchases] Status:', cachedStatus);
    }

    return cachedStatus;
  } catch (error) {
    console.error('[Purchases] Failed to get status:', error);
    return DEFAULT_STATUS;
  }
}

/**
 * Get available products for purchase
 */
export async function getAvailableProducts(): Promise<Product[]> {
  if (!MONETIZATION_FLAGS.enabled || !MONETIZATION_FLAGS.purchasesEnabled) {
    return [];
  }

  const platform = getPlatform();

  if (platform === 'web') {
    // Return configured products for web
    return PRODUCTS;
  }

  // Mobile - get from RevenueCat
  try {
    const { Purchases } = await import('@capgo/capacitor-purchases');
    
    const offerings = await Purchases.getOfferings();
    
    if (!offerings.current) {
      return PRODUCTS; // Fallback to configured products
    }

    // Map RevenueCat packages to our Product type
    const products: Product[] = offerings.current.availablePackages.map(pkg => ({
      id: pkg.product.identifier,
      name: pkg.product.title,
      description: pkg.product.description,
      price: pkg.product.price,
      currency: pkg.product.currencyCode,
      type: pkg.packageType === 'LIFETIME' ? 'one_time' : 'subscription',
      period: pkg.packageType === 'MONTHLY' ? 'monthly' : 
              pkg.packageType === 'ANNUAL' ? 'yearly' : undefined,
      features: PRODUCTS.find(p => p.id === pkg.product.identifier)?.features || [],
    }));

    return products;
  } catch (error) {
    console.error('[Purchases] Failed to get products:', error);
    return PRODUCTS; // Fallback
  }
}

/**
 * Purchase a product (one-time or subscription)
 */
export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  if (!MONETIZATION_FLAGS.enabled || !MONETIZATION_FLAGS.purchasesEnabled) {
    return { success: false, error: 'Purchases not enabled' };
  }

  const platform = getPlatform();

  if (platform === 'web') {
    // Web - redirect to Stripe checkout
    return purchaseWithStripe(productId);
  }

  // Mobile - use RevenueCat
  try {
    const { Purchases } = await import('@capgo/capacitor-purchases');
    
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      p => p.product.identifier === productId
    );

    if (!pkg) {
      return { success: false, error: 'Product not found' };
    }

    const result = await Purchases.purchasePackage({ aPackage: pkg });
    
    // Clear cached status to force refresh
    cachedStatus = null;

    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Purchases] Purchase successful:', result);
    }

    return {
      success: true,
      productId,
      transactionId: result.customerInfo.originalAppUserId,
    };
  } catch (error: any) {
    // Check if user cancelled
    if (error.code === 'PURCHASE_CANCELLED') {
      return { success: false, error: 'Purchase cancelled' };
    }
    
    console.error('[Purchases] Purchase failed:', error);
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<MonetizationStatus> {
  if (!MONETIZATION_FLAGS.enabled || !MONETIZATION_FLAGS.purchasesEnabled) {
    return DEFAULT_STATUS;
  }

  const platform = getPlatform();

  if (platform === 'web') {
    // Web - check backend for purchase history
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Purchases] Web restore not implemented');
    }
    return DEFAULT_STATUS;
  }

  try {
    const { Purchases } = await import('@capgo/capacitor-purchases');
    
    await Purchases.restorePurchases();
    
    // Clear cache and get fresh status
    cachedStatus = null;
    return getMonetizationStatus();
  } catch (error) {
    console.error('[Purchases] Restore failed:', error);
    return DEFAULT_STATUS;
  }
}

/**
 * Handle Stripe purchase (web)
 */
async function purchaseWithStripe(productId: string): Promise<PurchaseResult> {
  if (MONETIZATION_FLAGS.debugMode) {
    console.log('[Purchases] Would redirect to Stripe for:', productId);
  }

  // In production, this would:
  // 1. Call your backend to create a Stripe Checkout session
  // 2. Redirect to Stripe's hosted checkout page
  // 3. Handle the webhook callback to update purchase status
  
  // Example implementation:
  /*
  try {
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripe = await loadStripe(PLATFORM_CONFIG.stripe.publishableKey);
    
    // Call your backend to create checkout session
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    
    const { sessionId } = await response.json();
    
    // Redirect to Stripe
    await stripe?.redirectToCheckout({ sessionId });
    
    return { success: true, productId };
  } catch (error) {
    return { success: false, error: error.message };
  }
  */

  return { success: false, error: 'Web purchases not yet implemented' };
}

/**
 * Check if user has access to a specific feature
 */
export async function hasFeatureAccess(feature: string): Promise<boolean> {
  const status = await getMonetizationStatus();
  
  // Premium users have access to all features
  if (status.isPremium) {
    return true;
  }
  
  // Check feature-specific access for free tier
  const freeFeatures = ['basic_journal', 'basic_projects', 'local_storage'];
  return freeFeatures.includes(feature);
}
