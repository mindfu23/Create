/**
 * Monetization Types
 * 
 * Shared types for ads, purchases, and subscriptions
 */

// User's monetization status
export interface MonetizationStatus {
  isPremium: boolean;           // Has active purchase or subscription
  hasActiveSubscription: boolean;
  subscriptionTier: SubscriptionTier;
  adsEnabled: boolean;          // Whether to show ads (false if premium)
  purchasedAt?: Date;
  expiresAt?: Date;             // For subscriptions
}

// Subscription tiers
export type SubscriptionTier = 'free' | 'premium' | 'premium_plus';

// Product definitions
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  type: 'one_time' | 'subscription';
  period?: 'monthly' | 'yearly';  // For subscriptions
  features: string[];
}

// Ad configuration
export interface AdConfig {
  enabled: boolean;
  bannerAdUnitId?: string;
  interstitialAdUnitId?: string;
  rewardedAdUnitId?: string;
  showBannerOnPages: string[];   // Page paths where banners show
  interstitialFrequency: number; // Show interstitial every N actions
}

// Ad placement types
export type AdPlacement = 'banner_top' | 'banner_bottom' | 'interstitial' | 'rewarded';

// Purchase result
export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

// Platform detection
export type Platform = 'web' | 'ios' | 'android';
