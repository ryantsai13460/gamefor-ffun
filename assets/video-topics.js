export const videoTopics = [
  'Gaming', 'Music', 'Science', 'Technology', 'Nature',
  'History', 'Arts', 'Food', 'Travel', 'Sports'
];

export function videoLibraryLink(topic, format = 'all') {
  const params = new URLSearchParams({ format });
  if (topic) params.set('topic', topic);
  return `#youtube?${params}`;
}
