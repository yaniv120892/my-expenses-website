// The app's wire format for a calendar day — date inputs, query params, CSV
// cells, period buckets. date-fns patterns are case-sensitive: 'DD' means
// day-of-year, so a typo'd copy compiles and silently produces wrong dates.
export const DAY_FORMAT = 'yyyy-MM-dd';
