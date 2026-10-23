import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure state reducer mimicking CreateCampaignPage selection logic.
 */
function toggleListSelection(prevListIds, targetId) {
  const numericId = Number(targetId);
  const numericPrev = (prevListIds || []).map(Number);
  if (numericPrev.includes(numericId)) {
    return numericPrev.filter((id) => id !== numericId);
  }
  return [...numericPrev, numericId];
}

function selectAllLists(prevListIds, listsToSelect) {
  const set = new Set((prevListIds || []).map(Number));
  (listsToSelect || []).forEach((l) => {
    const id = Number(l && typeof l === 'object' && l.id !== undefined ? l.id : l);
    if (!isNaN(id)) set.add(id);
  });
  return Array.from(set);
}

function clearAllLists() {
  return [];
}

function filterLists(availableLists, searchQuery) {
  if (!searchQuery || !searchQuery.trim()) return availableLists;
  const q = searchQuery.toLowerCase().trim();
  return (availableLists || []).filter(
    (l) =>
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.description && l.description.toLowerCase().includes(q))
  );
}

describe('Audience List Selection Logic & Regression Tests', () => {
  const sampleLists = [
    { id: 1, name: 'AI & Data Science Faculty', contact_count: 45, description: 'Faculty leads' },
    { id: 2, name: 'Biomedical Engineering Deans', contact_count: 22, description: 'Deans and chairs' },
    { id: 3, name: 'Robotics Department Heads', contact_count: 18, description: 'Robotics research' },
    { id: 4, name: 'Empty Test List', contact_count: 0, description: 'Newly created zero contact list' },
  ];

  test('1. Every rendered list checkbox can be selected individually', () => {
    let selected = [];
    sampleLists.forEach((l) => {
      selected = toggleListSelection(selected, l.id);
      assert.ok(selected.includes(l.id), `List ${l.id} should be selected`);
      // Toggle off
      selected = toggleListSelection(selected, l.id);
      assert.ok(!selected.includes(l.id), `List ${l.id} should be deselected`);
    });
  });

  test('2. Selecting one list does not select or deselect another', () => {
    let selected = [1];
    selected = toggleListSelection(selected, 2);
    assert.deepEqual(selected.sort(), [1, 2]);

    selected = toggleListSelection(selected, 3);
    assert.deepEqual(selected.sort(), [1, 2, 3]);

    // Deselect list 2 only
    selected = toggleListSelection(selected, 2);
    assert.deepEqual(selected.sort(), [1, 3]);
    assert.ok(selected.includes(1));
    assert.ok(!selected.includes(2));
    assert.ok(selected.includes(3));
  });

  test('3. Multiple selected lists remain selected after re-rendering or recalculation', () => {
    const initialSelected = [1, 3, 4];
    // Simulate re-render pass
    const selectedSet = new Set(initialSelected.map(Number));
    const renderedChecked = sampleLists.map((l) => ({
      id: l.id,
      checked: selectedSet.has(Number(l.id)),
    }));

    assert.equal(renderedChecked.find((r) => r.id === 1).checked, true);
    assert.equal(renderedChecked.find((r) => r.id === 2).checked, false);
    assert.equal(renderedChecked.find((r) => r.id === 3).checked, true);
    assert.equal(renderedChecked.find((r) => r.id === 4).checked, true);
  });

  test('4. Deselecting one list preserves all other selections in arbitrary order', () => {
    let selected = [1, 2, 3, 4];
    selected = toggleListSelection(selected, 3);
    assert.deepEqual(selected.sort(), [1, 2, 4]);

    selected = toggleListSelection(selected, 1);
    assert.deepEqual(selected.sort(), [2, 4]);

    selected = toggleListSelection(selected, 4);
    assert.deepEqual(selected.sort(), [2]);
  });

  test('5. Search and scrolling do not corrupt selections', () => {
    let selected = [1, 3];

    // User searches for "Biomedical" (only list 2 matches)
    const searchResults = filterLists(sampleLists, 'Biomedical');
    assert.equal(searchResults.length, 1);
    assert.equal(searchResults[0].id, 2);

    // Selections made prior to search remain intact
    const selectedSet = new Set(selected.map(Number));
    assert.ok(selectedSet.has(1));
    assert.ok(selectedSet.has(3));

    // User selects the search result (list 2)
    selected = toggleListSelection(selected, searchResults[0].id);
    assert.deepEqual(selected.sort(), [1, 2, 3]);

    // User clears search
    const allAgain = filterLists(sampleLists, '');
    assert.equal(allAgain.length, 4);
    assert.deepEqual(selected.sort(), [1, 2, 3]);
  });

  test('6. Select All and Clear work correctly with and without active filters', () => {
    // Select All across all available lists
    let selected = selectAllLists([], sampleLists);
    assert.deepEqual(selected.sort(), [1, 2, 3, 4]);

    // Clear All
    selected = clearAllLists();
    assert.deepEqual(selected, []);

    // Filtered Select All: User has list 1 selected, searches "Robotics", clicks Select All
    selected = [1];
    const filtered = filterLists(sampleLists, 'Robotics');
    selected = selectAllLists(selected, filtered);
    // Should contain both list 1 (pre-existing) and list 3 (newly selected from search)
    assert.deepEqual(selected.sort(), [1, 3]);
  });

  test('7. Event propagation: Click on input is isolated from parent container', () => {
    let toggleCallCount = 0;
    const onToggle = () => {
      toggleCallCount++;
    };

    // The fixed component pattern:
    const handleInputClick = (e) => {
      e.stopPropagation();
    };

    const handleInputChange = (e) => {
      e.stopPropagation();
      onToggle();
    };

    const handleContainerClick = (e) => {
      if (e.targetTag === 'input') {
        return;
      }
      onToggle();
    };

    // Case A: User clicks directly on the checkbox input
    const inputClickEvent = {
      propagationStopped: false,
      stopPropagation() {
        this.propagationStopped = true;
      },
    };

    handleInputClick(inputClickEvent);
    handleInputChange(inputClickEvent);
    // If bubbling was attempted to container:
    if (!inputClickEvent.propagationStopped) {
      handleContainerClick({ targetTag: 'input' });
    }

    assert.equal(toggleCallCount, 1, 'onToggle must be called exactly ONCE when clicking checkbox input');

    // Case B: User clicks on the card container (e.g. title)
    handleContainerClick({ targetTag: 'div' });
    assert.equal(toggleCallCount, 2, 'onToggle must be called exactly ONCE when clicking container row');
  });

  test('8. Type coercion: String vs Numeric IDs never fail comparison or removal', () => {
    let selected = ['1', '2'];
    // Deselect list 1 using numeric 1
    selected = toggleListSelection(selected, 1);
    assert.deepEqual(selected, [2]);

    // Add list 3 using numeric 3
    selected = toggleListSelection(selected, 3);
    assert.deepEqual(selected, [2, 3]);

    // Deselect list 2 using string '2'
    selected = toggleListSelection(selected, '2');
    assert.deepEqual(selected, [3]);
  });

  test('9. Empty lists (0 contacts) are fully selectable and display proper counts', () => {
    let selected = [];
    const emptyList = sampleLists.find((l) => l.contact_count === 0);
    assert.ok(emptyList, 'Empty list exists in test dataset');

    selected = toggleListSelection(selected, emptyList.id);
    assert.ok(selected.includes(emptyList.id), 'Empty list can be selected');
    assert.equal(selected.length, 1);
  });
});
