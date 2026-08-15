import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { ExperienceItem, emptyExperience, formatDateRange } from '@/types/profile';

interface Props {
  items: ExperienceItem[];
  onChange: (items: ExperienceItem[]) => void;
}

export function ExperienceEditor({ items, onChange }: Props) {
  const [draft, setDraft] = useState<ExperienceItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setDraft(emptyExperience());
    setIsNew(true);
  };

  const openEdit = (item: ExperienceItem) => {
    setDraft({ ...item });
    setIsNew(false);
  };

  const save = () => {
    if (!draft) return;
    const cleaned: ExperienceItem = {
      ...draft,
      title: draft.title.trim(),
      company: draft.company.trim(),
      location: draft.location.trim(),
      description: draft.description.trim(),
      end_date: draft.is_current_role ? null : draft.end_date || null,
    };
    if (!cleaned.title || !cleaned.company) return;
    onChange(isNew ? [...items, cleaned] : items.map((i) => (i.id === cleaned.id ? cleaned : i)));
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Briefcase className="h-4 w-4" /> Work Experience
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add New
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No work experience added yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-4">
              <div className="h-10 w-10 rounded-md bg-background-soft flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.title}</p>
                <p className="text-sm text-muted-foreground truncate">{item.company}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateRange(item.start_date, item.end_date, item.is_current_role)}
                  {item.location ? ` · ${item.location}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" aria-label="Edit experience" onClick={() => openEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Delete experience"
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add experience' : 'Edit experience'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exp-title">Title *</Label>
                <Input
                  id="exp-title"
                  placeholder="Founder"
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-company">Company *</Label>
                <Input
                  id="exp-company"
                  placeholder="DK AI Marketplace"
                  maxLength={120}
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-location">Location</Label>
                <Input
                  id="exp-location"
                  placeholder="Lucerne, Switzerland · Remote"
                  maxLength={120}
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exp-current"
                  checked={draft.is_current_role}
                  onCheckedChange={(checked) =>
                    setDraft({ ...draft, is_current_role: !!checked, end_date: checked ? null : '' })
                  }
                />
                <Label htmlFor="exp-current" className="text-sm font-normal">
                  I currently work here
                </Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exp-start">Start date</Label>
                  <Input
                    id="exp-start"
                    type="month"
                    value={draft.start_date}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-end">End date</Label>
                  <Input
                    id="exp-end"
                    type="month"
                    disabled={draft.is_current_role}
                    value={draft.end_date || ''}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-description">Description</Label>
                <Textarea
                  id="exp-description"
                  rows={4}
                  maxLength={2000}
                  placeholder="What did you work on?"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={!draft?.title.trim() || !draft?.company.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
