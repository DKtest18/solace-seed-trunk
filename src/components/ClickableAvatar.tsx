import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ClickableAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  username?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ClickableAvatar({ 
  userId, 
  avatarUrl, 
  username,
  size = 'md',
  className = '' 
}: ClickableAvatarProps) {
  const navigate = useNavigate();
  
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };
  
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  return (
    <a
      href={`/profile/${userId}`}
      onClick={handleClick}
      data-userid={userId}
      className={`profile-link cursor-pointer hover:opacity-80 transition-opacity inline-block ${className}`}
      title={username || 'View profile'}
    >
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={avatarUrl || undefined} alt={username || 'User avatar'} />
        <AvatarFallback>
          <User className={iconSizes[size]} />
        </AvatarFallback>
      </Avatar>
    </a>
  );
}
