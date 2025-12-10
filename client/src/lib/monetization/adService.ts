/**
 * Ad Service
 * 
 * Handles ad display across web and mobile platforms.
 * Uses AdMob for mobile (iOS/Android) via Capacitor plugin.
 * 
 * SETUP REQUIRED:
 * 1. Install: npm install @capacitor-community/admob
 * 2. Configure AdMob app IDs in capacitor.config.ts
 * 3. Replace test ad unit IDs with production IDs in config.ts
 * 4. Set MONETIZATION_FLAGS.adsEnabled = true
 */

import { AdPlacement, Platform } from './types';
import { AD_CONFIG, MONETIZATION_FLAGS } from './config';

// Track interstitial counter for frequency limiting
let interstitialCounter = 0;

/**
 * Detect current platform
 */
export function getPlatform(): Platform {
  // Check for Capacitor native platform
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const platform = (window as any).Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }
  return 'web';
}

/**
 * Initialize ad service
 * Call this once on app startup
 */
export async function initializeAds(): Promise<boolean> {
  if (!MONETIZATION_FLAGS.enabled || !MONETIZATION_FLAGS.adsEnabled) {
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] Ads disabled by feature flag');
    }
    return false;
  }

  const platform = getPlatform();
  
  if (platform === 'web') {
    // Web ads would use AdSense or similar
    // For now, just log
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] Web ads not yet implemented');
    }
    return false;
  }

  // Mobile - initialize AdMob
  try {
    // Dynamic import to avoid errors when plugin not installed
    const { AdMob } = await import('@capacitor-community/admob');
    
    await AdMob.initialize({
      // Set to false for production
      testingDevices: MONETIZATION_FLAGS.debugMode ? ['YOUR_TEST_DEVICE_ID'] : [],
      initializeForTesting: MONETIZATION_FLAGS.debugMode,
    });

    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] AdMob initialized successfully');
    }
    return true;
  } catch (error) {
    console.error('[Ads] Failed to initialize AdMob:', error);
    return false;
  }
}

/**
 * Show a banner ad
 */
export async function showBanner(position: 'top' | 'bottom' = 'bottom'): Promise<boolean> {
  if (!AD_CONFIG.enabled || !AD_CONFIG.bannerAdUnitId) {
    return false;
  }

  const platform = getPlatform();
  if (platform === 'web') {
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] Would show banner ad at:', position);
    }
    return false;
  }

  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
    
    await AdMob.showBanner({
      adId: AD_CONFIG.bannerAdUnitId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: position === 'top' ? BannerAdPosition.TOP_CENTER : BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });

    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] Banner shown at:', position);
    }
    return true;
  } catch (error) {
    console.error('[Ads] Failed to show banner:', error);
    return false;
  }
}

/**
 * Hide the banner ad
 */
export async function hideBanner(): Promise<void> {
  const platform = getPlatform();
  if (platform === 'web') return;

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.hideBanner();
  } catch (error) {
    console.error('[Ads] Failed to hide banner:', error);
  }
}

/**
 * Show an interstitial ad
 * Returns true if ad was shown
 */
export async function showInterstitial(): Promise<boolean> {
  if (!AD_CONFIG.enabled || !AD_CONFIG.interstitialAdUnitId) {
    return false;
  }

  const platform = getPlatform();
  if (platform === 'web') {
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] Would show interstitial ad');
    }
    return false;
  }

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    
    // Prepare the ad
    await AdMob.prepareInterstitial({
      adId: AD_CONFIG.interstitialAdUnitId,
    });
    
    // Show it
    await AdMob.showInterstitial();

    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] Interstitial shown');
    }
    return true;
  } catch (error) {
    console.error('[Ads] Failed to show interstitial:', error);
    return false;
  }
}

/**
 * Maybe show an interstitial based on frequency setting
 * Call this after major user actions (save, complete, etc.)
 */
export async function maybeShowInterstitial(): Promise<boolean> {
  if (!AD_CONFIG.enabled) return false;
  
  interstitialCounter++;
  
  if (interstitialCounter >= AD_CONFIG.interstitialFrequency) {
    interstitialCounter = 0;
    return showInterstitial();
  }
  
  return false;
}

/**
 * Show a rewarded ad
 * Returns true if user watched the full ad and earned the reward
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!AD_CONFIG.enabled || !AD_CONFIG.rewardedAdUnitId) {
    return false;
  }

  const platform = getPlatform();
  if (platform === 'web') {
    if (MONETIZATION_FLAGS.debugMode) {
      console.log('[Ads] Would show rewarded ad');
    }
    return false;
  }

  try {
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
    
    // Track if reward was earned
    let rewardEarned = false;
    
    // Listen for reward event
    const rewardListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewardEarned = true;
      if (MONETIZATION_FLAGS.debugMode) {
        console.log('[Ads] Reward earned!');
      }
    });

    // Prepare and show
    await AdMob.prepareRewardVideoAd({
      adId: AD_CONFIG.rewardedAdUnitId,
    });
    
    await AdMob.showRewardVideoAd();
    
    // Clean up listener
    rewardListener.remove();
    
    return rewardEarned;
  } catch (error) {
    console.error('[Ads] Failed to show rewarded ad:', error);
    return false;
  }
}

/**
 * Check if ads should be shown on a specific page
 */
export function shouldShowAdsOnPage(pagePath: string): boolean {
  if (!AD_CONFIG.enabled) return false;
  return AD_CONFIG.showBannerOnPages.includes(pagePath);
}
