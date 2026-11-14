/**
 * X3 811 Tickets: the "call before you dig" clock. When may the excavator start, when must every utility have
 * marked or responded, and when does the ticket expire, under each state's one-call law. Plus a parser for the
 * plain-text tickets that one-call centers email to excavators and utilities.
 *
 * States are data (StateRule). Michigan, Ohio and Texas ship with citations to the statute text; add others the
 * same way. Holidays are the notification center's posted list: pass them in (federalHolidays() is a starting point).
 */
const MIN = 60_000;
function toWall(instant, tz) {
    const d = typeof instant === 'string' ? new Date(instant) : instant;
    if (Number.isNaN(d.getTime()))
        throw new Error(`"${String(instant)}" is not a valid date-time.`);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(d).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) / MIN;
}
function fromWall(w, tz) {
    // Find the instant whose wall time in tz is w (two passes handle DST).
    let guess = w * MIN;
    for (let i = 0; i < 2; i++)
        guess -= (toWall(new Date(guess), tz) - w) * MIN;
    return new Date(guess).toISOString();
}
const dayOf = (w) => Math.floor(w / 1440);
const isoDay = (d) => new Date(d * 86_400_000).toISOString().slice(0, 10);
const weekday = (d) => new Date(d * 86_400_000).getUTCDay(); // 0 Sunday
// ---------------------------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------------------------
function nthWeekday(year, month, dow, n) {
    const first = new Date(Date.UTC(year, month, 1));
    const day = 1 + ((dow - first.getUTCDay() + 7) % 7) + (n - 1) * 7;
    return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}
function lastWeekday(year, month, dow) {
    const last = new Date(Date.UTC(year, month + 1, 0));
    return new Date(Date.UTC(year, month, last.getUTCDate() - ((last.getUTCDay() - dow + 7) % 7))).toISOString().slice(0, 10);
}
/** Saturday holidays observed Friday, Sunday holidays observed Monday (5 U.S.C. 6103(b) practice). */
function observed(date) {
    const d = new Date(`${date}T00:00:00Z`);
    const w = d.getUTCDay();
    if (w === 6)
        d.setUTCDate(d.getUTCDate() - 1);
    if (w === 0)
        d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}
/**
 * The 11 U.S. federal holidays (5 U.S.C. 6103), observed dates. Most one-call centers close on some of these and
 * a few others (often the day after Thanksgiving); check your center's posted list and pass that instead.
 */
export function federalHolidays(year) {
    return [
        observed(`${year}-01-01`), nthWeekday(year, 0, 1, 3), nthWeekday(year, 1, 1, 3), lastWeekday(year, 4, 1), observed(`${year}-06-19`),
        observed(`${year}-07-04`), nthWeekday(year, 8, 1, 1), nthWeekday(year, 9, 1, 2), observed(`${year}-11-11`), nthWeekday(year, 10, 4, 4), observed(`${year}-12-25`),
    ].sort();
}
export const STATE_RULES = {
    MI: {
        state: 'Michigan', center: 'MISS DIG 811', timeZone: 'America/Detroit',
        lead: { kind: 'businessHours', hours: 72, dayStart: '07:00', dayEnd: '17:00' },
        maxDaysBeforeStart: 14, ticketLifeDays: 21, longProjectTicketLifeDays: 180, responseDue: 'start', emergencyResponseHours: 3,
        remarkHours: { hours: 24, businessDaysOnly: true },
        citations: { lead: 'MCL 460.725(1)', max: 'MCL 460.725(1)', life: 'MCL 460.725(3)', response: 'MCL 460.727(1)', emergency: 'MCL 460.727(7)', remark: 'MCL 460.727(4)' },
        notes: [
            'Notice given during business hours (7 a.m. to 5 p.m. on business days) starts the 72 hours at once; before 7 a.m. it starts at 7 a.m.; after 5 p.m. or on a non-business day it starts at 7 a.m. the next business day. Hours on non-business days do not count.',
            'Business days exclude holidays observed by MISS DIG and posted on its website (MCL 460.723(d)).',
            'The statute says "eastern standard time"; this uses Michigan local time. Most of the Upper Peninsula border counties are on Central time.',
        ],
    },
    OH: {
        state: 'Ohio', center: 'OHIO811', timeZone: 'America/New_York',
        lead: { kind: 'workingDaysExcludingNoticeDay', days: 2 },
        maxDaysBeforeStart: 16, responseDue: 'start',
        citations: { lead: 'ORC 3781.28(A)', max: 'ORC 3781.28(A)', response: 'ORC 3781.29(A)(1)' },
        notes: [
            'As amended by HB 227, effective June 9, 2026: at least two working days, not counting the day of notice, and no more than 16 calendar days before excavation. Utilities mark within the same two working days.',
            'A working day runs 12:00 a.m. to 11:59 p.m. and excludes weekends and legal holidays (ORC 1.14).',
            'Interstate gas and hazardous liquid pipelines follow their own public safety program timelines (ORC 3781.28(C), 3781.29(A)(2)).',
        ],
    },
    TX: {
        state: 'Texas', center: 'Texas811', timeZone: 'America/Chicago',
        lead: { kind: 'hoursExcludingWeekendsHolidays', hours: 48, saturdayRule: true },
        maxDaysBeforeStart: 14, responseDue: 'start',
        citations: { lead: 'Tex. Util. Code 251.151(a)-(b)', max: 'Tex. Util. Code 251.151(a)', response: 'Tex. Util. Code 251.157(a), (d)' },
        notes: [
            'Notice between 14 days and 48 hours before excavation, not counting Saturdays, Sundays and legal holidays. A Saturday notice allows digging at 11:59 a.m. the next Tuesday, or Wednesday if Monday is a holiday.',
            'Class A operators mark, or say they will not mark, by the 48th hour (Tex. Util. Code 251.157).',
            'Most of far west Texas (El Paso, Hudspeth) is on Mountain time; pass timeZone to override.',
        ],
    },
};
const hhmm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export function digClock(input) {
    const rule = typeof input.state === 'string' ? STATE_RULES[input.state.toUpperCase()] : input.state;
    if (!rule)
        throw new Error(`No rules for "${String(input.state)}". Built in: ${Object.keys(STATE_RULES).join(', ')}. Pass your own StateRule for others.`);
    const tz = input.timeZone ?? rule.timeZone;
    const notice = toWall(input.noticeAt, tz);
    const years = [new Date(input.noticeAt).getUTCFullYear(), new Date(input.noticeAt).getUTCFullYear() + 1];
    const holidays = new Set(input.holidays ?? years.flatMap(federalHolidays));
    const isBusiness = (d) => { const w = weekday(d); return w !== 0 && w !== 6 && !holidays.has(isoDay(d)); };
    const steps = [];
    const fmt = (w) => new Date(fromWall(w, tz)).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    let start;
    const lead = rule.lead;
    if (lead.kind === 'businessHours') {
        const ds = hhmm(lead.dayStart ?? '00:00');
        const de = hhmm(lead.dayEnd ?? '24:00');
        let t = notice;
        let d = dayOf(t);
        const minute = t - d * 1440;
        if (!isBusiness(d) || minute >= de) {
            do
                d++;
            while (!isBusiness(d));
            t = d * 1440 + ds;
            steps.push(`Notice came outside business hours; the clock starts ${fmt(t)}.`);
        }
        else if (minute < ds) {
            t = d * 1440 + ds;
            steps.push(`Notice came before ${lead.dayStart}; the clock starts ${fmt(t)}.`);
        }
        else
            steps.push(`Notice came during business hours; the clock starts ${fmt(t)}.`);
        // Count clock hours, skipping every hour of non-business days.
        let left = lead.hours * 60;
        while (left > 0) {
            const dd = dayOf(t);
            if (!isBusiness(dd)) {
                t = (dd + 1) * 1440;
                continue;
            }
            const room = (dd + 1) * 1440 - t;
            if (left <= room) {
                t += left;
                left = 0;
            }
            else {
                left -= room;
                t = (dd + 1) * 1440;
            }
        }
        start = t;
        steps.push(`${lead.hours} hours on business days later: ${fmt(start)}.`);
    }
    else if (lead.kind === 'workingDaysExcludingNoticeDay') {
        let d = dayOf(notice);
        let n = 0;
        while (n < lead.days) {
            d++;
            if (isBusiness(d))
                n++;
        }
        // Digging may begin after those working days are complete: the next moment after the last one ends.
        start = (d + 1) * 1440;
        steps.push(`${lead.days} full working days after the day of notice end ${fmt(start - 1)}; digging may start after that.`);
    }
    else {
        const d0 = dayOf(notice);
        if (lead.saturdayRule && weekday(d0) === 6) {
            let tue = d0 + 3;
            const monHoliday = holidays.has(isoDay(d0 + 2));
            if (monHoliday)
                tue = d0 + 4;
            start = tue * 1440 + hhmm('11:59');
            steps.push(`Saturday notice: start at 11:59 a.m. the following ${monHoliday ? 'Wednesday (Monday is a holiday)' : 'Tuesday'}.`);
        }
        else {
            let t = notice;
            let left = lead.hours * 60;
            while (left > 0) {
                const dd = dayOf(t);
                if (!isBusiness(dd)) {
                    t = (dd + 1) * 1440;
                    continue;
                }
                const room = (dd + 1) * 1440 - t;
                if (left <= room) {
                    t += left;
                    left = 0;
                }
                else {
                    left -= room;
                    t = (dd + 1) * 1440;
                }
            }
            start = t;
            steps.push(`${lead.hours} hours after notice, not counting Saturdays, Sundays or holidays: ${fmt(start)}.`);
        }
    }
    const problems = [];
    const citations = [rule.citations.lead, rule.citations.response];
    let latestStart;
    if (rule.maxDaysBeforeStart) {
        const last = (dayOf(notice) + rule.maxDaysBeforeStart + 1) * 1440 - 1;
        latestStart = fromWall(last, tz);
        if (rule.citations.max)
            citations.push(rule.citations.max);
    }
    const planned = input.plannedStart ? toWall(input.plannedStart, tz) : undefined;
    if (planned !== undefined) {
        if (planned < start)
            problems.push(`The planned start ${fmt(planned)} is before the earliest legal start ${fmt(start)}.`);
        if (latestStart && planned > toWall(latestStart, tz))
            problems.push(`The planned start is more than ${rule.maxDaysBeforeStart} days after the notice; call in a new ticket closer to the start.`);
    }
    let expires;
    const life = input.longProject && rule.longProjectTicketLifeDays ? rule.longProjectTicketLifeDays : rule.ticketLifeDays;
    if (life) {
        const from = planned !== undefined && planned >= start ? planned : start;
        expires = fromWall(from + life * 1440, tz);
        if (rule.citations.life)
            citations.push(rule.citations.life);
        steps.push(`Ticket valid ${life} days from the start date: until ${fmt(from + life * 1440)}.`);
    }
    if (input.asOf && expires && new Date(input.asOf) > new Date(expires))
        problems.push('The ticket has expired; call in a new one before digging.');
    return {
        state: rule.state, center: rule.center, timeZone: tz, noticeAt: new Date(input.noticeAt).toISOString(),
        earliestStart: fromWall(start, tz), responsesDue: fromWall(start, tz), latestStart, expires, problems, steps,
        citations: [...new Set(citations)], notes: rule.notes ?? [],
    };
}
/** Emergency locate deadline, where the state sets one. */
export function emergencyDeadline(state, noticeAt) {
    const rule = STATE_RULES[state.toUpperCase()];
    if (!rule?.emergencyResponseHours)
        return null;
    return { due: new Date(new Date(noticeAt).getTime() + rule.emergencyResponseHours * 3_600_000).toISOString(), citation: rule.citations.emergency };
}
/** Which utilities on a ticket have not responded, and are they late? */
export function responseStatus(clock, members, asOf) {
    const due = new Date(clock.responsesDue).getTime();
    const now = new Date(asOf).getTime();
    const rows = members.map((m) => {
        const at = m.respondedAt ? new Date(m.respondedAt).getTime() : undefined;
        const state = at !== undefined ? (at <= due ? 'on time' : 'late') : now > due ? 'overdue' : 'waiting';
        return { ...m, state };
    });
    return { rows, clearToDig: rows.every((r) => r.state === 'on time' || r.state === 'late') && now >= due, overdue: rows.filter((r) => r.state === 'overdue').map((r) => r.member) };
}
const LABELS = [
    ['ticketNumber', /^(ticket|tkt|request|ticket\s*(no|number|#)|request\s*(no|number|#)|locate\s*request|serial\s*(no|number))\.?$/i],
    ['type', /^(ticket\s*type|type|request\s*type|priority)$/i],
    ['revision', /^(rev|revision|version)$/i],
    ['noticeAt', /^(taken|transmitted|transmit\s*date|call\s*date|notice\s*date|date\s*(received|taken)|created|original\s*call\s*date)$/i],
    ['workStart', /^(work\s*(to\s*)?begin|work\s*date|start\s*date|dig\s*date|excavation\s*start|work\s*start|start|legal\s*(dig|start)\s*date)$/i],
    ['expires', /^(expires?|expiration(\s*date)?|good\s*thru|valid\s*(thru|through|until)|update\s*by)$/i],
    ['excavator', /^(excavator|company|contractor|caller\s*company|done\s*by)$/i],
    ['contact', /^(contact|caller|contact\s*name|caller\s*name)$/i],
    ['phone', /^(phone|contact\s*phone|caller\s*phone|field\s*phone|cell)$/i],
    ['workType', /^(type\s*of\s*work|work\s*type|nature\s*of\s*work|work\s*description)$/i],
    ['doneFor', /^(done\s*for|work\s*done\s*for|for)$/i],
    ['explosives', /^(explosives?|blasting)$/i],
    ['state', /^(state|st)$/i],
    ['county', /^(county|cnty)$/i],
    ['place', /^(place|city|town|township|municipality|twp)$/i],
    ['address', /^(address|addr|street\s*address)$/i],
    ['street', /^(street|st\s*name)$/i],
    ['intersection', /^(intersection|cross\s*street|near\s*intersection|nearest\s*intersection|xst)$/i],
    ['location', /^(location|location\s*of\s*work|marking\s*instructions|remarks|work\s*area)$/i],
];
/**
 * Parse the plain text of a one-call ticket (the email body). Formats differ by center and vendor; this reads
 * "Label: value" lines (several per line are fine), coordinates, and the members/utilities list. Unknown labels are
 * kept in `fields`.
 */
export function parseTicket(text) {
    const out = { members: [], fields: {} };
    const lines = text.replace(/\r/g, '').split('\n');
    let inMembers = false;
    let lastKey = null;
    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (/^\s*(members?|utilities|districts?\s*notified|codes?\s*notified|sent\s*to|operators?\s*notified|facility\s*operators?)\s*:?\s*$/i.test(line)) {
            inMembers = true;
            continue;
        }
        if (inMembers) {
            if (!line.trim()) {
                if (out.members.length)
                    inMembers = false;
                continue;
            }
            for (const m of line.trim().split(/\s{2,}|,\s*|\t/))
                if (m.trim())
                    out.members.push(m.trim());
            continue;
        }
        // Split "A: x   B: y" into pairs.
        const pairs = [...line.matchAll(/([A-Za-z][A-Za-z #./()&-]{0,40}?)\s*:\s*(.*?)(?=\s{2,}[A-Za-z][A-Za-z #./()&-]{0,40}?\s*:|$)/g)];
        if (!pairs.length) {
            if (lastKey === 'location' && line.trim())
                out.location = `${out.location ?? ''} ${line.trim()}`.trim();
            continue;
        }
        for (const [, labelRaw, valueRaw] of pairs) {
            const label = labelRaw.trim();
            const value = valueRaw.trim();
            out.fields[label] = value;
            const hit = LABELS.find(([, re]) => re.test(label));
            lastKey = hit ? hit[0] : null;
            if (!hit || !value)
                continue;
            const key = hit[0];
            if (key === 'explosives')
                out.explosives = /^y/i.test(value);
            else if (out[key] === undefined)
                out[key] = value;
        }
    }
    const m = /(-?\d{1,2}\.\d{3,})[,\s/]+(-?\d{2,3}\.\d{3,})/.exec(text);
    if (m) {
        out.latitude = Number(m[1]);
        out.longitude = Number(m[2]);
    }
    if (!out.ticketNumber)
        out.ticketNumber = /\b(?:ticket|tkt)\s*(?:no\.?|number|#)?\s*[:#]?\s*([A-Z]?\d{6,14}(?:-\d{1,4})?)\b/i.exec(text)?.[1];
    return out;
}
