import React from 'react';
import { Chip, Stack } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import EmptyState from '../EmptyState';

// Each prompt maps to a tool the assistant actually has; it answers questions
// about spending and cannot create transactions.
const SUGGESTED_PROMPTS = [
  'How much did I spend last month?',
  'What are my top spending categories this month?',
  'Compare this month to last month',
  'Show my largest transactions this month',
];

type Props = {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
};

export default function ChatEmptyState({ onSelectPrompt, disabled }: Props) {
  return (
    <Stack alignItems="center" spacing={1}>
      <EmptyState
        message="Ask about your spending — I can summarize, compare periods, and spot trends."
        icon={
          <AutoAwesomeRoundedIcon
            sx={{ fontSize: 44, color: 'text.secondary' }}
          />
        }
      />
      <Stack
        direction="row"
        sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 1, px: 2 }}
      >
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Chip
            key={prompt}
            label={prompt}
            variant="outlined"
            disabled={disabled}
            data-testid="chat-suggested-prompt"
            onClick={() => onSelectPrompt(prompt)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
