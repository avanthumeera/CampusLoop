const technicalCouncilPage = 'https://www.nitt.edu/home/students/clubsnassocs/techclubs/';
const culturalCouncilPage = 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/cultclub/';
const sportsPage = 'https://www.nitt.edu/home/students/clubsnassocs/sports/nso/';
const technicalSource = 'https://www.nitt.edu/home/students/clubsnassocs/techclubs/';
const scientSource = 'https://scient.nitt.edu/clubs';

// Names and summaries come from official institute/council listings. The four
// supplied originals stay untouched beside square logo-only copies used by the UI.
// The images were supplied by the user; official provenance is still pending review.
const suppliedLogos = {
  'Nakshatra': '/team-logos/nakshatra-logo.png',
  'Orbit': '/team-logos/orbit-logo.png',
  'Spider R&D': '/team-logos/spider-logo.png',
  'Entrepreneurship Cell': '/team-logos/e-cell-logo.png',
};
const team = (name, mainCategory, category, focus, website, source) => ({
  name, mainCategory, category, focus, website, source,
  logo: suppliedLogos[name] || null,
  logoStatus: suppliedLogos[name] ? 'user-provided-pending-verification' : 'pending-verification',
  officialLinks: [{ label: 'Official institute information', url: website }],
  verificationStatus: 'listed-by-official-source',
});

export const clubs = [
  team('Delta Force', 'Technical Teams', 'Software & Development', 'Web Cell and programming team focused on coding, problem-solving, development, and technical activities.', 'https://www.nitt.edu/home/students/clubsnassocs/techclubs/delta/', technicalSource),
  team('Spider R&D', 'Technical Teams', 'AI/ML & Data Science', 'Research and development club with student projects in artificial intelligence, electronics, and computer technology.', 'https://spider.nitt.edu/', technicalSource),
  team('Robotics and Machine Intelligence (RMI)', 'Technical Teams', 'Core Engineering & Research', 'Official robotics and technical research club of NIT Trichy.', technicalCouncilPage, technicalSource),
  team('PSI Racing Club', 'Technical Teams', 'Core Engineering & Research', 'Student team that designs and builds off-road racing vehicles.', technicalCouncilPage, technicalSource),
  team("Designers' Club", 'Technical Teams', 'Design & Creative Technology', 'Product design and analysis using tools such as AutoCAD and Creo.', technicalCouncilPage, technicalSource),
  team('Nakshatra', 'Technical Teams', 'Core Engineering & Research', 'Astronomy and science club.', technicalCouncilPage, technicalSource),
  team('Aero Modelling Club', 'Technical Teams', 'Core Engineering & Research', 'Design and development of aerodynamic models, gliders, and autonomous drones.', technicalCouncilPage, technicalSource),
  team("Builders' Hive", 'Technical Teams', 'Core Engineering & Research', 'Civil and construction club.', technicalCouncilPage, technicalSource),
  team('Graphique', 'Technical Teams', 'Design & Creative Technology', 'Official graphic design club; creates visual communication for institute festivals and initiatives.', technicalCouncilPage, technicalSource),
  team('Maths & Algorithms Club', 'Technical Teams', 'Finance & Quantitative', 'Mathematics and algorithms club focused on problem-solving.', technicalCouncilPage, technicalSource),
  team('Entrepreneurship Cell', 'Technical Teams', 'Entrepreneurship & Innovation', 'Student-run organization supporting entrepreneurship and startup ideas through campus initiatives.', technicalCouncilPage, technicalSource),
  team("PG Students' Cell", 'Technical Teams', 'AI/ML & Data Science', 'Cognitive science club listed by the Technical Council.', technicalCouncilPage, technicalSource),
  team("Research Scholars' Consortium", 'Technical Teams', 'Core Engineering & Research', 'Forum functioning for the welfare of research scholars.', technicalCouncilPage, technicalSource),
  team('Business, Finance & Consulting Club', 'Technical Teams', 'Consulting & Business', 'Technical Council group covering student interests in business, finance, and consulting.', technicalCouncilPage, technicalSource),
  team('Force Hyperloop', 'Technical Teams', 'Product & Innovation', 'Student technical group listed by SCIEnT.', scientSource, scientSource),
  team('EVER', 'Technical Teams', 'Core Engineering & Research', 'Student technical group listed by SCIEnT.', scientSource, scientSource),
  team('3D Aerodynamics', 'Technical Teams', 'Core Engineering & Research', 'Student technical group listed by SCIEnT.', scientSource, scientSource),
  team('DataByte', 'Technical Teams', 'AI/ML & Data Science', 'Student technical group listed by SCIEnT.', scientSource, scientSource),
  team('Orbit', 'Technical Teams', 'Product & Innovation', 'Student technical group listed by SCIEnT.', scientSource, scientSource),
  team('Catalyst', 'Technical Teams', 'Product & Innovation', 'Student technical group listed by SCIEnT.', scientSource, scientSource),

  team('Music Troupe', 'Cultural Teams', 'Music', 'Western and classical music club.', culturalCouncilPage, culturalCouncilPage),
  team('Thespians’ Society', 'Cultural Teams', 'Drama & Theatre', 'Dramatics club.', culturalCouncilPage, culturalCouncilPage),
  team('Dance Troupe', 'Cultural Teams', 'Dance', 'Eastern and western dance club.', culturalCouncilPage, culturalCouncilPage),
  team('Fine Arts Club', 'Cultural Teams', 'Fine Arts', 'Promotes art, painting, and creativity.', culturalCouncilPage, culturalCouncilPage),
  team('Pixelbug', 'Cultural Teams', 'Photography & Filmmaking', 'Official photography and videography club, listed under the Media Club.', culturalCouncilPage, culturalCouncilPage),
  team('Film Society', 'Cultural Teams', 'Photography & Filmmaking', 'Club for film enthusiasts and short-film makers.', culturalCouncilPage, culturalCouncilPage),
  team('Tamil Mandram', 'Cultural Teams', 'Literary & Debating', 'Tamil cultural, literary, and linguistic club.', 'https://www.nitt.edu/students/clubsnassocs/language/tamil/', 'https://www.nitt.edu/students/clubsnassocs/language/tamil/'),
  team('Lakshya', 'Cultural Teams', 'Cultural Events', 'Defence and civil club listed on NITT’s cultural clubs page.', culturalCouncilPage, culturalCouncilPage),
  team('Sociology and Civics Club', 'Cultural Teams', 'Literary & Debating', 'Sociology and civics club listed on NITT’s cultural clubs page.', culturalCouncilPage, culturalCouncilPage),
  team('Unscripted', 'Cultural Teams', 'Literary & Debating', 'Public speaking and leadership club of NIT Trichy.', culturalCouncilPage, culturalCouncilPage),
  team('SPIC-MACAY', 'Cultural Teams', 'Cultural Events', 'Cultural society listed by NITT’s Cultural Council.', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/'),
  team('Amruthavarshini', 'Cultural Teams', 'Music', 'Cultural society listed by NITT’s Cultural Council.', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/'),
  team('TEDx NIT Trichy', 'Cultural Teams', 'Cultural Events', 'Student event organization listed by NITT’s Cultural Council.', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/'),
  team('Balls by Picasso', 'Cultural Teams', 'Cultural Events', 'Cultural Council society listed in the NITT directory.', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/'),
  team('Aayaam', 'Cultural Teams', 'Cultural Events', 'Cultural club listed in the NITT faculty-advisor roster.', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/', 'https://www.nitt.edu/home/students/clubsnassocs/Faculty_Advisors_Clubs_2025-2027.pdf'),
  team('Akshara', 'Cultural Teams', 'Literary & Debating', 'Cultural club listed in the NITT faculty-advisor roster.', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/', 'https://www.nitt.edu/home/students/clubsnassocs/Faculty_Advisors_Clubs_2025-2027.pdf'),
  team('Feeds', 'Cultural Teams', 'Media & Publicity', 'Cultural club listed in the NITT faculty-advisor roster.', 'https://www.nitt.edu/home/students/clubsnassocs/culturalsocieties/', 'https://www.nitt.edu/home/students/clubsnassocs/Faculty_Advisors_Clubs_2025-2027.pdf'),

  team('National Sports Organisation (NSO)', 'Sports Teams', 'Sports & Recreation', 'NITT chapter that organizes sports activity and maintains campus sports facilities.', sportsPage, sportsPage),
];

export const campusOpportunities = [
  { name: 'SCIEnT', kind: 'Innovation hub', focus: 'Student Centre for Innovation in Engineering and Technology; a campus space for prototyping and interdisciplinary projects.', website: 'https://scient.nitt.edu/' },
  { name: 'TransfiNITTe', kind: 'Hackathon', focus: 'NITT’s flagship hackathon, run by the Technical Council with SCIEnT collaboration. Current dates and registration link are not listed here until confirmed.', website: 'https://scient.nitt.edu/transfinitte' },
];
