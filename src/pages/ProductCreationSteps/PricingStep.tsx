import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ProductCreationPricing() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    price: '',
    pricing_model: 'one_time',
    production_cost: '',
    available_quantity: '',
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('product-draft');
    if (stored) {
      const draft = JSON.parse(stored);
      setFormData(prev => ({ ...prev, ...draft }));
    }
  }, []);

  const handleSave = () => {
    const stored = sessionStorage.getItem('product-draft');
    const draft = stored ? JSON.parse(stored) : {};
    sessionStorage.setItem('product-draft', JSON.stringify({ ...draft, ...formData }));
    
    toast({
      title: 'Progress Saved',
      description: 'Your pricing information has been saved.',
    });
    
    navigate('/create-product');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast({
        title: 'Price Required',
        description: 'Please enter a valid price greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    handleSave();
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/create-product')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklist
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Pricing</h1>
          <p className="text-muted-foreground">
            Set your price and choose your pricing model
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Price Configuration</CardTitle>
              <CardDescription>
                Choose how customers will pay for your product
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price (USD) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="29.99"
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricing_model">
                  Pricing Model <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={formData.pricing_model} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, pricing_model: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-Time Purchase</SelectItem>
                    <SelectItem value="monthly">Monthly Subscription</SelectItem>
                    <SelectItem value="yearly">Yearly Subscription</SelectItem>
                    <SelectItem value="custom">Custom/Negotiable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="production_cost">Production Cost (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="production_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.production_cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, production_cost: e.target.value }))}
                    placeholder="15.00"
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  For your records only - not shown to customers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_quantity">Available Quantity (Optional)</Label>
                <Input
                  id="available_quantity"
                  type="number"
                  min="0"
                  value={formData.available_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, available_quantity: e.target.value }))}
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for digital products or unlimited availability
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save & Continue
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/create-product')}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
