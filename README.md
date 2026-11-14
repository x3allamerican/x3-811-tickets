# X3 811 Tickets

**The call-before-you-dig clock.** When may the excavator legally start, when must every utility have marked, what is the latest start the ticket allows and when does it expire, under each state's one-call law. Plus a parser for the plain-text tickets one-call centers email out.

**[Try the dig date calculator →](https://x3allamerican.github.io/x3-811-tickets/)**

Built and maintained by **[X3 Pipeline](https://x3pipeline.com)**.

- Zero dependencies. TypeScript, Node 22+ and the browser. Time-zone and daylight-saving correct.
- Each state is data with citations to the statute text. Michigan, Ohio (including the HB 227 changes effective June 9, 2026) and Texas are built in.
- Holidays come from your notification center's posted list. `federalHolidays()` is a starting point.

## Install

```sh
npm install github:x3allamerican/x3-811-tickets
```

## Use

```ts
import { digClock, responseStatus, parseTicket, federalHolidays } from '@x3/811-tickets';

const clock = digClock({
  state: 'MI',
  noticeAt: '2026-11-06T18:30:00-05:00',      // Friday evening
  plannedStart: '2026-11-16T07:00:00-05:00',
  holidays: federalHolidays(2026),           // or your center's posted list
});
clock.earliestStart; // Fri Nov 13, 7:00 a.m.: clock starts Monday 7 a.m., skips Veterans Day
clock.responsesDue;  // utilities must mark by then (MCL 460.727(1))
clock.latestStart;   // no more than 14 calendar days after the notice
clock.expires;       // 21 days from the start date (180 with longProject: true)
clock.problems;      // e.g. "The planned start ... is before the earliest legal start ..."
clock.citations;     // ['MCL 460.725(1)', 'MCL 460.727(1)', 'MCL 460.725(3)']

responseStatus(clock, [{ member: 'GAS CO', respondedAt: '...' }, { member: 'FIBER' }], new Date().toISOString());
// { rows: [... 'on time' | 'late' | 'overdue' | 'waiting'], clearToDig, overdue: ['FIBER'] }

parseTicket(emailBody);
// { ticketNumber, type, noticeAt, workStart, expires, excavator, address, location, latitude, longitude, members: [...], fields: {...} }
```

## Rules built in

| State | Earliest start | Latest start | Utilities respond | Ticket life | Source |
|---|---|---|---|---|---|
| Michigan | 72 hours, counted only on business days; the clock starts at once in business hours (7-5), at 7 a.m. otherwise | 14 calendar days | By the start time; emergencies 3 hours; re-marks 24 business hours | 21 days, or 180 for long projects | MCL 460.725, 460.727 |
| Ohio | 2 full working days, not counting the notice day | 16 calendar days | Within the same 2 working days | Not set by statute | ORC 3781.28(A), 3781.29(A) |
| Texas | 48 hours not counting Saturdays, Sundays and holidays; Saturday notice: 11:59 a.m. Tuesday (Wednesday after a Monday holiday) | 14 days | By the 48th hour | Not set by statute | Tex. Util. Code 251.151, 251.157 |

## Add a state

```ts
import { digClock, type StateRule } from '@x3/811-tickets';

const rule: StateRule = {
  state: 'Example', center: 'Example 811', timeZone: 'America/New_York',
  lead: { kind: 'workingDaysExcludingNoticeDay', days: 2 }, // or 'businessHours' or 'hoursExcludingWeekendsHolidays'
  maxDaysBeforeStart: 10, ticketLifeDays: 20, responseDue: 'start',
  citations: { lead: '...', response: '...' },
};
digClock({ state: rule, noticeAt: '...' });
```

Pull requests that add a state are welcome. Please cite the statute or rule for each number and add a test.

## Limits

Decision support, not legal advice. Interstate gas and hazardous liquid pipelines, emergencies, design tickets and large-project tickets often have their own rules. Ticket formats differ by center and software; `parseTicket` reads "Label: value" text and keeps every field it finds, but check the result against your tickets.

## Develop

```sh
npm install
npm test
npm run build
```

## License

MIT. Free for any use, including commercial.

---

**[X3 Pipeline](https://x3pipeline.com)** runs damage prevention, integrity, operator qualification and the rest of a PHMSA program in one place.
