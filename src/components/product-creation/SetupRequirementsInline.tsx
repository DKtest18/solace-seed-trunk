import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Info, ShieldCheck } from 'lucide-react';

export type SpecType = 'api_key' | 'password' | 'oauth_token' | 'url' | 'text';
export interface Spec {
  key: string;
  label: string;
  description?: string;
  type: SpecType;
  required: boolean;
}

interface Props {
  specs: Spec[];
  onSpecsChange: (specs: Spec[]) => void;
  windowHours: number;
  onWindowHoursChange: (h: number) => void;
  noCredentials: boolean;
  onNoCredentialsChange: (v: boolean) => void;
}

export function SetupRequirementsInline({
  specs, onSpecsChange, windowHours, onWindowHoursChange, noCredentials, onNoCredentialsChange,
}: Props) {
  const add = () => onSpecsChange([...specs, { key: '', label: '', description: '', type: 'api_key', required: true }]);
  const remove = (i: number) => onSpecsChange(specs.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<Spec>) => onSpecsChange(specs.map((s, idx) => idx === i ? { ...s, ...p } : s));

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Credentials the buyer submits are AES-256-GCM encrypted at rest, only decrypted server-side, every access is logged,
          and they auto-purge after the access window or when the buyer marks the handover complete.
        </AlertDescription>
      </Alert>

      <label className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30 cursor-pointer">
        <Checkbox checked={noCredentials} onCheckedChange={(v) => onNoCredentialsChange(v === true)} className="mt-0.5" />
        <div>
          <div className="text-sm font-medium">No credentials needed — I set up via call / email</div>
          <p className="text-xs text-muted-foreground">Pick this if you don't need any keys or passwords from the buyer.</p>
        </div>
      </label>

      {!noCredentials && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Access window (hours, 1–168)</Label>
            <Input type="number" min={1} max={168} value={windowHours}
              onChange={(e) => onWindowHoursChange(Math.max(1, Math.min(168, parseInt(e.target.value || '48', 10))))}
              className="max-w-[160px]" />
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Required items</h4>
            <Button size="sm" variant="outline" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add item</Button>
          </div>

          {specs.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet — add at least one, or check the "no credentials" box above.</p>
          )}

          {specs.map((sp, i) => (
            <Card key={i} className="p-4 space-y-3 bg-muted/30">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Key (internal id)</Label>
                  <Input placeholder="openai_api_key" value={sp.key}
                    onChange={(e) => patch(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
                </div>
                <div>
                  <Label className="text-xs">Label shown to buyer</Label>
                  <Input placeholder="OpenAI API Key" value={sp.label}
                    onChange={(e) => patch(i, { label: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Instructions for the buyer</Label>
                <Textarea rows={2}
                  placeholder="Read-only key with GPT-4 access. Revoke after setup."
                  value={sp.description || ''}
                  onChange={(e) => patch(i, { description: e.target.value })} />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={sp.type} onValueChange={(v: SpecType) => patch(i, { type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="password">Password</SelectItem>
                      <SelectItem value="oauth_token">OAuth Token</SelectItem>
                      <SelectItem value="url">URL / Webhook</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 pt-6">
                  <Checkbox checked={sp.required} onCheckedChange={(v) => patch(i, { required: v === true })} />
                  <span className="text-sm">Required</span>
                </label>
                <Button size="icon" variant="ghost" className="mt-6 text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

          <Alert className="bg-primary/5">
            <Info className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Ask only for what you strictly need. Prefer read-only, scoped, or short-lived tokens. Instruct buyers to rotate credentials after handover.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
