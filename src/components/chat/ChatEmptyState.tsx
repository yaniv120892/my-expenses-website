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
};

export default function ChatEmptyState({ onSelectPrompt }: Props) {
  return (
    // Auto margins center this in the scroll column without the container
    // needing justifyContent, which would push the top out of scroll reach.
    <Stack spacing={1} sx={{ my: 'auto' }}>
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
        flexWrap="wrap"
        useFlexGap
        spacing={1}
        justifyContent="center"
        sx={{ px: 2 }}
      >
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Chip
            key={prompt}
            label={prompt}
            variant="outlined"
            data-testid="chat-suggested-prompt"
            onClick={() => onSelectPrompt(prompt)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
