/**
 * tests/wheel.test.js
 * Deterministic tests for assets/js/wheel.js covering:
 * - Winner chosen FIRST via crypto.getRandomValues (including rejection sampling)
 * - Angle-to-index mapping and target-angle landing for N = 1, 2, 5, and 40 names
 *   so the shown winner always equals the calculated winner
 * - Empty and single-name list handling, plus excluding already-picked students.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickRandomIndexCrypto,
  getEligibleStudents,
  chooseWheelWinner,
  getIndexFromWheelAngle,
  getTargetAngleForWinner
} from '../assets/js/wheel.js';

function makeStudentList(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `s-${i + 1}`,
    name: `Siswa Contoh ${String(i + 1).padStart(2, '0')}`,
    active: true
  }));
}

test('Angle-to-index mapping and target-angle landing match for N = 1, 2, 5, and 40 names', () => {
  for (const N of [1, 2, 5, 40]) {
    const students = makeStudentList(N);
    for (let winnerIdx = 0; winnerIdx < N; winnerIdx++) {
      for (const startRotation of [0, 37.5, 180, 712.4]) {
        for (const offset of [0.25, 0.5, 0.75]) {
          const targetAngle = getTargetAngleForWinner(winnerIdx, N, startRotation, {
            extraSpins: 5,
            sliceOffsetRatio: offset
          });
          assert.ok(
            targetAngle > startRotation,
            `N=${N}: targetAngle (${targetAngle}) must advance forward from startRotation (${startRotation})`
          );
          const landedIndex = getIndexFromWheelAngle(targetAngle, N);
          assert.equal(
            landedIndex,
            winnerIdx,
            `N=${N} start=${startRotation} offset=${offset}: expected landed slice ${winnerIdx}, got ${landedIndex}`
          );
          assert.equal(students[landedIndex].id, students[winnerIdx].id);
        }
      }
    }
  }
});

test('chooseWheelWinner selects uniformly for N = 1, 2, 5, 40 and handles rejection sampling', () => {
  for (const N of [1, 2, 5, 40]) {
    const students = makeStudentList(N);
    for (let target = 0; target < N; target++) {
      // Inject a deterministic Uint32 generator that returns `target`
      const res = chooseWheelWinner(students, {
        fillRandom: (buf) => {
          buf[0] = target;
          return buf;
        }
      });
      assert.equal(res.winnerIndex, target);
      assert.equal(res.winner.id, `s-${target + 1}`);
    }
  }

  // Verify rejection sampling skips values >= limit for N = 5 (0x1_0000_0000 % 5 === 1, so 0xFFFFFFFF is rejected)
  let callCount = 0;
  const idx = pickRandomIndexCrypto(5, (buf) => {
    callCount++;
    buf[0] = callCount === 1 ? 0xffffffff : 3;
    return buf;
  });
  assert.equal(callCount, 2);
  assert.equal(idx, 3);
});

test('Empty list, single-name list, and excludePicked filtering work cleanly', () => {
  // Empty list
  const emptyChoice = chooseWheelWinner([]);
  assert.equal(emptyChoice.winner, null);
  assert.equal(emptyChoice.winnerIndex, -1);
  assert.equal(getIndexFromWheelAngle(0, 0), -1);
  assert.throws(() => pickRandomIndexCrypto(0), RangeError);

  // Single-name list
  const oneList = makeStudentList(1);
  const oneChoice = chooseWheelWinner(oneList);
  assert.equal(oneChoice.winnerIndex, 0);
  assert.equal(oneChoice.winner.id, 's-1');

  // Exclude already-picked students
  const five = makeStudentList(5);
  const remaining = getEligibleStudents(five, {
    excludePicked: true,
    pickedIds: ['s-1', 's-2', 's-4', 's-5']
  });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 's-3');

  const lastChoice = chooseWheelWinner(five, {
    excludePicked: true,
    pickedIds: ['s-1', 's-2', 's-4', 's-5']
  });
  assert.equal(lastChoice.winner.id, 's-3');
});
