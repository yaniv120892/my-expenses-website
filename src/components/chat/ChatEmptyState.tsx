import React from 'react';
import { Chip, Stack } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import EmptyState from '../EmptyState';
import { useT } from '@/i18n/useT';

// Each prompt maps to a tool the assistant actually has; it answers questions
// about spending and cannot create transactions.
const SUGGESTED_PROMPTS = [
  'chat.prompt.lastMonth',
  'chat.prompt.topCategories',
  'chat.prompt.compareMonths',
  'chat.prompt.largest',
] as const;

type Props = {
  onSelectPrompt: (prompt: string) => void;
};

export default function ChatEmptyState({ onSelectPrompt }: Props) {
  const t = useT();
  return (
    // Auto margins center this in the scroll column without the container
    // needing justifyContent, which would push the top out of scroll reach.
    <Stack spacing={1} sx={{ my: 'auto' }}>
      <EmptyState
        message={t('chat.emptyState')}
        icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />}
      />
      <Stack
        direction="row"
        useFlexGap
        spacing={1}
        sx={{
          flexWrap: 'wrap',
          justifyContent: 'center',
          px: 2,
        }}
      >
        {SUGGESTED_PROMPTS.map((promptKey) => {
          const prompt = t(promptKey);
          return (
            <Chip
              key={promptKey}
              label={prompt}
              variant="outlined"
              data-testid="chat-suggested-prompt"
              onClick={() => onSelectPrompt(prompt)}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
