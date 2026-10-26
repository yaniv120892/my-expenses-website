export const CLICKABLE_SLICE_SX = {
  '& .recharts-sector': { cursor: 'pointer' },
};

export const UNSELECTED_SLICE_OPACITY = 0.3;

export const CLICKABLE_ROW_SX = {
  cursor: 'pointer',
  borderRadius: 1,
  px: 0.5,
  mx: -0.5,
  '&:hover': { bgcolor: 'action.hover' },
};

/** Trend arrows point along the reading direction, so they mirror in RTL. */
export const MIRROR_IN_RTL_SX = {
  '[dir=rtl] &': { transform: 'scaleX(-1)' },
};
