import assert from 'node:assert/strict';
import test from 'node:test';
import { openClubsPage, openEventsSection } from '../src/homeNavigation.js';

test('Explore Events scrolls the existing events section into view', () => {
  let requestedId;
  let scrollOptions;
  const documentRef = {
    getElementById(id) {
      requestedId = id;
      return { scrollIntoView(options) { scrollOptions = options; } };
    },
  };

  openEventsSection(documentRef);

  assert.equal(requestedId, 'events');
  assert.deepEqual(scrollOptions, { behavior: 'smooth', block: 'start' });
});

test('Explore Clubs navigates to the existing clubs page', () => {
  let destination;

  openClubsPage((page) => { destination = page; });

  assert.equal(destination, 'clubs');
});
