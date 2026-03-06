import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useRulesAcceptance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: userRulesAccepted, isLoading: loadingUserRules } = useQuery({
    queryKey: ['rules-acceptance', user?.id, 'user'],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Get user's acceptance
      const { data: acceptance, error } = await supabase
        .from('dkai_user_rules_acceptance')
        .select('rules_version')
        .eq('user_id', user.id)
        .eq('rule_type', 'user')
        .maybeSingle();

      if (error || !acceptance) return false;
      
      // Check if version is still active
      const { data: rules } = await supabase
        .from('dkai_platform_rules')
        .select('version')
        .eq('rule_type', 'user')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      return !!rules && acceptance.rules_version >= rules.version;
    },
    enabled: !!user?.id,
  });

  const { data: sellerRulesAccepted, isLoading: loadingSellerRules } = useQuery({
    queryKey: ['rules-acceptance', user?.id, 'seller'],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Get user's acceptance
      const { data: acceptance, error } = await supabase
        .from('user_rules_acceptance')
        .select('rules_version')
        .eq('user_id', user.id)
        .eq('rule_type', 'seller')
        .maybeSingle();

      if (error || !acceptance) return false;
      
      // Check if version is still active
      const { data: rules } = await supabase
        .from('platform_rules')
        .select('version')
        .eq('rule_type', 'seller')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      return !!rules && acceptance.rules_version >= rules.version;
    },
    enabled: !!user?.id,
  });

  const acceptRulesMutation = useMutation({
    mutationFn: async ({ ruleType }: { ruleType: 'user' | 'seller' }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current rules version
      const { data: rules, error: rulesError } = await supabase
        .from('platform_rules')
        .select('version')
        .eq('rule_type', ruleType)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (rulesError) throw rulesError;

      // Insert or update acceptance
      const { error } = await supabase
        .from('user_rules_acceptance')
        .upsert({
          user_id: user.id,
          rule_type: ruleType,
          rules_version: rules.version,
          accepted_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,rule_type',
        });

      if (error) throw error;
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rules-acceptance', user?.id, variables.ruleType] });
    },
  });

  return {
    userRulesAccepted: !!userRulesAccepted,
    sellerRulesAccepted: !!sellerRulesAccepted,
    loadingUserRules,
    loadingSellerRules,
    acceptRules: acceptRulesMutation.mutateAsync,
    isAccepting: acceptRulesMutation.isPending,
  };
}