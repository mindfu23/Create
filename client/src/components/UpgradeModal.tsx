/**
 * Upgrade Modal Component
 * 
 * Shows available products for purchase/subscription.
 * Only visible when monetization is enabled and user opens it.
 */

import { useMonetization, Product, TIER_FEATURES } from '@/lib/monetization';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Crown, Sparkles, X } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { products, purchase, restore, isLoading } = useMonetization();

  const handlePurchase = async (productId: string) => {
    const success = await purchase(productId);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleRestore = async () => {
    await restore();
    onOpenChange(false);
  };

  // Separate products by type
  const oneTimeProducts = products.filter(p => p.type === 'one_time');
  const subscriptionProducts = products.filter(p => p.type === 'subscription');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription>
            Remove ads and unlock premium features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* One-time purchase options */}
          {oneTimeProducts.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">
                One-Time Purchase
              </h3>
              {oneTimeProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPurchase={handlePurchase}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}

          {/* Subscription options */}
          {subscriptionProducts.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">
                Subscription Plans
              </h3>
              {subscriptionProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPurchase={handlePurchase}
                  isLoading={isLoading}
                  highlight={product.period === 'yearly'}
                />
              ))}
            </div>
          )}

          {/* Features comparison */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-sm text-muted-foreground mb-3">
              Premium Features
            </h3>
            <ul className="space-y-2">
              {TIER_FEATURES.premium.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Restore purchases link */}
          <div className="text-center">
            <button
              onClick={handleRestore}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Restore Previous Purchases
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProductCardProps {
  product: Product;
  onPurchase: (productId: string) => void;
  isLoading: boolean;
  highlight?: boolean;
}

function ProductCard({ product, onPurchase, isLoading, highlight }: ProductCardProps) {
  return (
    <div
      className={`relative border rounded-lg p-4 ${
        highlight ? 'border-primary bg-primary/5' : ''
      }`}
    >
      {highlight && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Best Value
        </div>
      )}
      
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-medium">{product.name}</h4>
          <p className="text-sm text-muted-foreground">{product.description}</p>
        </div>
        <div className="text-right">
          <div className="font-bold">
            ${product.price.toFixed(2)}
          </div>
          {product.type === 'subscription' && (
            <div className="text-xs text-muted-foreground">
              /{product.period === 'monthly' ? 'mo' : 'yr'}
            </div>
          )}
        </div>
      </div>
      
      <Button
        onClick={() => onPurchase(product.id)}
        disabled={isLoading}
        className="w-full mt-3"
        variant={highlight ? 'default' : 'outline'}
      >
        {product.type === 'one_time' ? 'Buy Now' : 'Subscribe'}
      </Button>
    </div>
  );
}
