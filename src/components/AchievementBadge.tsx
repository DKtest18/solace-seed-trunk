import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Zap, Award } from 'lucide-react';

interface AchievementBadgeProps {
  type: string;
  title: string;
  size?: 'sm' | 'md' | 'lg';
}

const ACHIEVEMENT_ICONS: Record<string, any> = {
  first_sale: Trophy,
  ten_sales: Star,
  hundred_sales: Zap,
  top_seller: Award,
  seller_account_created: Award,
};

const ACHIEVEMENT_COLORS: Record<string, string> = {
  first_sale: 'text-yellow-500',
  ten_sales: 'text-blue-500',
  hundred_sales: 'text-purple-500',
  top_seller: 'text-green-500',
  seller_account_created: 'text-primary',
};

export function AchievementBadge({ type, title, size = 'md' }: AchievementBadgeProps) {
  const Icon = ACHIEVEMENT_ICONS[type] || Trophy;
  const iconColor = ACHIEVEMENT_COLORS[type] || 'text-primary';
  
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <Badge variant="secondary" className="gap-1">
      <Icon className={`${iconSize} ${iconColor}`} />
      <span>{title}</span>
    </Badge>
  );
}
