export function openEventsSection(documentRef = document) {
  documentRef.getElementById('events')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function openClubsPage(navigate) {
  navigate('clubs');
}
