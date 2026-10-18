// One source of truth for team categories used by the form and server validator.
export const teamSubcategories = {
  'Technical Teams': [
    'Software & Development', 'AI/ML & Data Science', 'Core Engineering & Research',
    'Design & Creative Technology', 'Consulting & Business', 'Finance & Quantitative',
    'Product & Innovation', 'Management & Operations', 'Marketing & Outreach',
    'Entrepreneurship & Innovation',
  ],
  'Cultural Teams': [
    'Music', 'Dance', 'Drama & Theatre', 'Literary & Debating',
    'Photography & Filmmaking', 'Fine Arts', 'Cultural Events', 'Media & Publicity',
  ],
  'Sports Teams': ['Outdoor Sports', 'Indoor Sports', 'Individual Sports', 'Fitness & Martial Arts'],
};

export const teamMainCategories = Object.keys(teamSubcategories).map((name) => name.replace(' Teams', ''));
