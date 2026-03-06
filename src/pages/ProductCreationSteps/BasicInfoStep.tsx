import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

export default function ProductCreationBasic() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_type: 'digital',
    demo_url: '',
    purpose: '',
    target_audience: '',
    value_proposition: '',
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
      description: 'Your product information has been saved.',
    });
    
    navigate('/create-product');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || formData.title.length < 3) {
      toast({
        title: 'Title Required',
        description: 'Product title must be at least 3 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.description || formData.description.length < 20) {
      toast({
        title: 'Description Required',
        description: 'Product description must be at least 20 characters.',
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
          <h1 className="text-3xl font-bold">Basic Information</h1>
          <p className="text-muted-foreground">
            Tell customers what makes your product unique
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>
                Provide essential information about your product
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Product Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  required
                  maxLength={100}
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., AI Content Generator"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.title.length}/100 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_type">
                  Product Type <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={formData.product_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, product_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital Product</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="physical">Physical Product</SelectItem>
                    <SelectItem value="course">Course/Training</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="software">Software/App</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your product in detail..."
                  rows={5}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.description.length}/1000 characters (minimum 20)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">What can customers use this for?</Label>
                <Textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                  placeholder="e.g., Generate blog posts, social media content, and marketing copy in seconds"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_audience">Who is this product for?</Label>
                <Input
                  id="target_audience"
                  value={formData.target_audience}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                  placeholder="e.g., Content creators, marketers, small business owners"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="value_proposition">What makes it valuable?</Label>
                <Textarea
                  id="value_proposition"
                  value={formData.value_proposition}
                  onChange={(e) => setFormData(prev => ({ ...prev, value_proposition: e.target.value }))}
                  placeholder="e.g., Save 10 hours per week on content creation with AI-powered writing"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="demo_url">Demo/Preview URL (Optional)</Label>
                <Input
                  id="demo_url"
                  type="url"
                  value={formData.demo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, demo_url: e.target.value }))}
                  placeholder="https://example.com/demo"
                />
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
