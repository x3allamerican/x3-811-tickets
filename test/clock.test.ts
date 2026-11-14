import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digClock, federalHolidays, responseStatus, emergencyDeadline, parseTicket, STATE_RULES, type StateRule } from '../src/index.ts';

const local = (iso: string, tz: string) => new Date(iso).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

test('federal holidays, with weekend observance', () => {
  const h = federalHolidays(2026);
  assert.equal(h.length, 11);
  assert.ok(h.includes('2026-11-26')); // Thanksgiving
  assert.ok(h.includes('2026-07-03')); // July 4 is a Saturday, observed Friday
  assert.ok(h.includes('2026-01-19')); // MLK Day
});

test('Michigan: 72 business hours from a notice during business hours (MCL 460.725(1))', () => {
  // Monday Nov 2, 2026 10:00 EST -> Thursday Nov 5 10:00.
  const r = digClock({ state: 'MI', noticeAt: '2026-11-02T10:00:00-05:00' });
  assert.equal(local(r.earliestStart, 'America/Detroit'), 'Thu, Nov 5, 10:00 AM');
  assert.equal(r.responsesDue, r.earliestStart);
  assert.ok(r.citations.includes('MCL 460.725(1)'));
});

test('Michigan: notice after 5 p.m. Friday starts the clock Monday 7 a.m.; weekend hours do not count', () => {
  const r = digClock({ state: 'MI', noticeAt: '2026-11-06T18:30:00-05:00', holidays: [] });
  assert.equal(local(r.earliestStart, 'America/Detroit'), 'Thu, Nov 12, 7:00 AM');
  // With the default federal holidays, Veterans Day (Wed Nov 11) is skipped too.
  assert.equal(local(digClock({ state: 'MI', noticeAt: '2026-11-06T18:30:00-05:00' }).earliestStart, 'America/Detroit'), 'Fri, Nov 13, 7:00 AM');
  assert.match(r.steps[0], /outside business hours/);
});

test('Michigan: Thursday notice runs across the weekend and Thanksgiving if the center closes', () => {
  const r = digClock({ state: 'MI', noticeAt: '2026-11-24T09:00:00-05:00', holidays: ['2026-11-26', '2026-11-27'] });
  // Tue 9:00 -> Wed 24:00 is 39h; Thu/Fri holidays, Sat/Sun skipped; Mon 33h left -> Mon 24:00 = 24h, Tue 09:00.
  assert.equal(local(r.earliestStart, 'America/Detroit'), 'Tue, Dec 1, 9:00 AM');
});

test('Michigan: ticket life 21 days, or 180 for a long project; 14-day cap on early notice', () => {
  const r = digClock({ state: 'MI', noticeAt: '2026-11-02T10:00:00-05:00', plannedStart: '2026-11-09T07:00:00-05:00' });
  assert.deepEqual(r.problems, []);
  assert.equal(local(r.expires!, 'America/Detroit'), 'Mon, Nov 30, 7:00 AM');
  assert.equal(new Date(digClock({ state: 'MI', noticeAt: '2026-11-02T10:00:00-05:00', longProject: true }).expires!).toISOString().slice(0, 10), '2027-05-04');
  const tooFar = digClock({ state: 'MI', noticeAt: '2026-11-02T10:00:00-05:00', plannedStart: '2026-11-20T07:00:00-05:00' });
  assert.match(tooFar.problems.join(), /more than 14 days/);
  const tooSoon = digClock({ state: 'MI', noticeAt: '2026-11-02T10:00:00-05:00', plannedStart: '2026-11-04T07:00:00-05:00' });
  assert.match(tooSoon.problems.join(), /before the earliest legal start/);
});

test('Michigan emergency: 3 hours (MCL 460.727(7))', () => {
  assert.deepEqual(emergencyDeadline('MI', '2026-11-02T10:00:00-05:00'), { due: '2026-11-02T18:00:00.000Z', citation: 'MCL 460.727(7)' });
  assert.equal(emergencyDeadline('TX', '2026-11-02T10:00:00-05:00'), null);
});

test('Ohio: two full working days not counting the notice day (ORC 3781.28(A), HB 227)', () => {
  const r = digClock({ state: 'OH', noticeAt: '2026-11-02T15:00:00-05:00' }); // Monday
  assert.equal(local(r.earliestStart, 'America/New_York'), 'Thu, Nov 5, 12:00 AM');
  // Friday notice -> Mon, Tue -> Wednesday 12:00 AM.
  assert.equal(local(digClock({ state: 'OH', noticeAt: '2026-11-06T08:00:00-05:00' }).earliestStart, 'America/New_York'), 'Wed, Nov 11, 12:00 AM');
  // Wednesday Nov 25 notice with Thanksgiving Thursday a holiday -> Fri, Mon -> Tue 12:00 AM.
  assert.equal(local(digClock({ state: 'OH', noticeAt: '2026-11-25T08:00:00-05:00' }).earliestStart, 'America/New_York'), 'Tue, Dec 1, 12:00 AM');
  assert.equal(r.latestStart!.slice(0, 10), '2026-11-19'); // 16 calendar days, end of day local = early UTC next day
});

test('Texas: 48 hours excluding weekends and holidays (Tex. Util. Code 251.151)', () => {
  // Friday 3 p.m. -> 9 hours Friday, Monday 24, Tuesday 15 -> Tuesday 3 p.m.
  assert.equal(local(digClock({ state: 'TX', noticeAt: '2026-11-06T15:00:00-06:00' }).earliestStart, 'America/Chicago'), 'Tue, Nov 10, 3:00 PM');
  // Saturday notice -> Tuesday 11:59 a.m.
  assert.equal(local(digClock({ state: 'TX', noticeAt: '2026-11-07T09:00:00-06:00' }).earliestStart, 'America/Chicago'), 'Tue, Nov 10, 11:59 AM');
  // Saturday before a Monday holiday (Jan 17, 2026; MLK Jan 19) -> Wednesday 11:59 a.m.
  assert.equal(local(digClock({ state: 'TX', noticeAt: '2026-01-17T09:00:00-06:00' }).earliestStart, 'America/Chicago'), 'Wed, Jan 21, 11:59 AM');
  // Far west Texas override.
  assert.equal(digClock({ state: 'TX', noticeAt: '2026-11-06T15:00:00-07:00', timeZone: 'America/Denver' }).timeZone, 'America/Denver');
});

test('custom state rules', () => {
  const rule: StateRule = {
    state: 'Example', center: 'Example 811', timeZone: 'America/New_York', lead: { kind: 'workingDaysExcludingNoticeDay', days: 3 },
    responseDue: 'start', ticketLifeDays: 10, citations: { lead: 'Example Code 1', response: 'Example Code 2', life: 'Example Code 3' },
  };
  const r = digClock({ state: rule, noticeAt: '2026-11-02T10:00:00-05:00' });
  assert.equal(local(r.earliestStart, 'America/New_York'), 'Fri, Nov 6, 12:00 AM');
  assert.ok(r.expires);
  assert.throws(() => digClock({ state: 'ZZ', noticeAt: '2026-11-02T10:00:00-05:00' }), /No rules for "ZZ"/);
  assert.deepEqual(Object.keys(STATE_RULES), ['MI', 'OH', 'TX']);
});

test('positive response status', () => {
  const clock = digClock({ state: 'MI', noticeAt: '2026-11-02T10:00:00-05:00' });
  const s = responseStatus(clock, [
    { member: 'GAS CO', respondedAt: '2026-11-04T12:00:00-05:00', code: 'Marked' },
    { member: 'ELECTRIC', respondedAt: '2026-11-05T12:00:00-05:00', code: 'Marked' },
    { member: 'FIBER' },
  ], '2026-11-05T13:00:00-05:00');
  assert.deepEqual(s.rows.map((r) => r.state), ['on time', 'late', 'overdue']);
  assert.equal(s.clearToDig, false);
  assert.deepEqual(s.overdue, ['FIBER']);
});

const SAMPLE = `NOTICE OF INTENT TO EXCAVATE
Ticket No: 2026110200123     Type: NORMAL     Rev: 000
Taken: 11/02/26 10:04   Work to Begin: 11/05/26 10:15   Expires: 11/26/26
Excavator: EXAMPLE EXCAVATING LLC     Contact: PAT SAMPLE
Phone: (555) 010-0100
Type of Work: INSTALL WATER SERVICE     Done For: CITY OF EXAMPLE
Explosives: N
State: MI   County: INGHAM   Place: LANSING
Address: 100 MAIN ST
Intersection: OAK AVE
Location: MARK ENTIRE FRONT LOT
  AND 10 FT INTO ROADWAY
Lat/Long: 42.73350, -84.55550
Members:
CONSUMERS GAS   AT&T MICHIGAN   CITY WATER
LANSING BWL

End of ticket`;

test('parseTicket reads label/value tickets, members and coordinates', () => {
  const t = parseTicket(SAMPLE);
  assert.equal(t.ticketNumber, '2026110200123');
  assert.equal(t.type, 'NORMAL');
  assert.equal(t.noticeAt, '11/02/26 10:04');
  assert.equal(t.workStart, '11/05/26 10:15');
  assert.equal(t.expires, '11/26/26');
  assert.equal(t.excavator, 'EXAMPLE EXCAVATING LLC');
  assert.equal(t.workType, 'INSTALL WATER SERVICE');
  assert.equal(t.explosives, false);
  assert.deepEqual([t.state, t.county, t.place], ['MI', 'INGHAM', 'LANSING']);
  assert.equal(t.location, 'MARK ENTIRE FRONT LOT AND 10 FT INTO ROADWAY');
  assert.deepEqual([t.latitude, t.longitude], [42.7335, -84.5555]);
  assert.deepEqual(t.members, ['CONSUMERS GAS', 'AT&T MICHIGAN', 'CITY WATER', 'LANSING BWL']);
  assert.equal(t.fields['Rev'], '000');
});
