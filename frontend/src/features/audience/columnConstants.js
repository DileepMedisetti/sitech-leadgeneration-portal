export const ALL_COLUMNS = [
  { id: 'name', label: 'Name', required: true },
  { id: 'email', label: 'Email Address', required: true },
  { id: 'university', label: 'University / Institution', defaultVisible: true },
  { id: 'department', label: 'Department', defaultVisible: true },
  { id: 'profession', label: 'Designation / Profession', defaultVisible: true },
  { id: 'country', label: 'Country', defaultVisible: true },
  { id: 'research_specialization', label: 'Research Specialization', defaultVisible: false },
  { id: 'confidence_score', label: 'Confidence Score', defaultVisible: false },
  { id: 'created_at', label: 'Discovered Date', defaultVisible: false },
];

export const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.filter(
  (c) => c.required || c.defaultVisible
).map((c) => c.id);
