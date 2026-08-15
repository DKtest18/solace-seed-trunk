import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { EducationItem, emptyEducation, formatDateRange } from '@/types/profile';

interface Props {
  items: EducationItem[];
  onChange: (items: EducationItem[]) => void;
}

export function EducationEditor({ items, onChange }: Props) {
  const [draft, setDraft] = useState<EducationItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setDraft(emptyEducation());
    setIsNew(true);
  };

  const save = () => {
    if (!draft) return;
    const cleaned: EducationItem = {
      ...draft,
      school: draft.school.trim(),
      degree: draft.degree.trim(),
      field_of_study: draft.field_of_study.trim(),
      description: draft.description.trim(),
      end_date: draft.end_date || null,
    };
    if (!cleaned.school) return;
    onChange(isNew ? [...items, cleaned] : items.map((i) => (i.id === cleaned.id ? cleaned : i)));
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> Education
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add New
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No education added yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-4">
              <div className="h-10 w-10 rounded-md bg-background-soft flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.school}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {[item.degree, item.field_of_study].filter(Boolean).join(', ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateRange(item.start_date, item.end_date)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Edit education"
                  onClick={() => { setDraft({ ...item }); setIsNew(false); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Delete education"
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
            <DialogTitle>{isNew ? 'Add education' : 'Edit education'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edu-school">School *</Label>
                <Input
                  id="edu-school"
                  placeholder="Wirtschaftsmittelschule Luzern"
                  maxLength={120}
                  value={draft.school}
                  onChange={(e) => setDraft({ ...draft, school: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edu-degree">Degree</Label>
                  <Input
                    id="edu-degree"
                    placeholder="Bachelor"
                    maxLength={120}
                    value={draft.degree}
                    onChange={(e) => setDraft({ ...draft, degree: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edu-field">Field of study</Label>
                  <Input
                    id="edu-field"
                    placeholder="Business"
                    maxLength={120}
                    value={draft.field_of_study}
                    onChange={(e) => setDraft({ ...draft, field_of_study: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edu-start">Start date</Label>
                  <Input
                    id="edu-start"
                    type="month"
                    value={draft.start_date}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edu-end">End date</Label>
                  <Input
                    id="edu-end"
                    type="month"
                    value={draft.end_date || ''}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edu-description">Description</Label>
                <Textarea
                  id="edu-description"
                  rows={4}
                  maxLength={2000}
                  placeholder="Activities, focus areas, achievements"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={!draft?.school.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
