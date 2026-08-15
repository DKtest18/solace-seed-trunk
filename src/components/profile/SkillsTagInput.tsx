import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface SkillsTagInputProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  max?: number;
}

export function SkillsTagInput({ skills, onChange, max = 30 }: SkillsTagInputProps) {
  const [value, setValue] = useState('');

  const addSkill = () => {
    const clean = value.trim().slice(0, 50);
    if (!clean) return;
    const exists = skills.some((s) => s.toLowerCase() === clean.toLowerCase());
    if (exists || skills.length >= max) {
      setValue('');
      return;
    }
    onChange([...skills, clean]);
    setValue('');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 bg-primary-soft text-primary text-sm px-3 py-1 rounded-full"
          >
            {skill}
            <button
              type="button"
              aria-label={`Remove ${skill}`}
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              className="hover:opacity-70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={value}
        placeholder="Type a skill and press Enter"
        maxLength={50}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addSkill();
          } else if (e.key === 'Backspace' && !value && skills.length > 0) {
            onChange(skills.slice(0, -1));
          }
        }}
        onBlur={addSkill}
      />
      <p className="text-xs text-muted-foreground">
        {skills.length}/{max} skills
      </p>
    </div>
  );
}
