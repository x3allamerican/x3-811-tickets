/**
 * X3 811 Tickets: the "call before you dig" clock. When may the excavator start, when must every utility have
 * marked or responded, and when does the ticket expire, under each state's one-call law. Plus a parser for the
 * plain-text tickets that one-call centers email to excavators and utilities.
 *
 * States are data (StateRule). Michigan, Ohio and Texas ship with citations to the statute text; add others the
 * same way. Holidays are the notification center's posted list: pass them in (federalHolidays() is a starting point).
 */
/**
 * The 11 U.S. federal holidays (5 U.S.C. 6103), observed dates. Most one-call centers close on some of these and
 * a few others (often the day after Thanksgiving); check your center's posted list and pass that instead.
 */
export declare function federalHolidays(year: number): string[];
export interface StateRule {
    state: string;
    center: string;
    timeZone: string;
    /** How the earliest legal start is computed from the time the notice is given. */
    lead: {
        kind: 'businessHours';
        hours: number;
        dayStart?: string;
        dayEnd?: string;
    } | {
        kind: 'workingDaysExcludingNoticeDay';
        days: number;
    } | {
        kind: 'hoursExcludingWeekendsHolidays';
        hours: number;
        saturdayRule?: boolean;
    };
    /** Notice may not be given more than this many calendar days before the start. */
    maxDaysBeforeStart?: number;
    /** Ticket life from the start date, in calendar days (and a long-project alternative if the law has one). */
    ticketLifeDays?: number;
    longProjectTicketLifeDays?: number;
    /** Utilities must mark or respond by: 'start' (the legal start time) or same rule as the lead. */
    responseDue: 'start';
    emergencyResponseHours?: number;
    remarkHours?: {
        hours: number;
        businessDaysOnly: boolean;
    };
    citations: {
        lead: string;
        max?: string;
        life?: string;
        response: string;
        emergency?: string;
        remark?: string;
    };
    notes?: string[];
}
export declare const STATE_RULES: Record<string, StateRule>;
export interface ClockInput {
    /** Two-letter state, or your own StateRule. */
    state: string | StateRule;
    /** When the notice (locate request) was given: ISO 8601 with an offset. */
    noticeAt: string;
    /** Planned start the excavator asked for, if any (ISO). */
    plannedStart?: string;
    /** Business-day holidays (YYYY-MM-DD) for the notification center. Default: federalHolidays() for the years involved. */
    holidays?: string[];
    /** The excavation will take longer than the normal ticket life (Michigan's 180-day ticket). */
    longProject?: boolean;
    /** Override the state's default zone (e.g. far west Texas). */
    timeZone?: string;
    /** For checking a planned start: is it now? Default now. */
    asOf?: string;
}
export interface ClockResult {
    state: string;
    center: string;
    timeZone: string;
    noticeAt: string;
    /** Earliest legal start (ISO). */
    earliestStart: string;
    /** Utilities must have marked or responded by this time (ISO). */
    responsesDue: string;
    /** Latest start allowed for this notice (end of that day, ISO), if the state caps it. */
    latestStart?: string;
    /** When the ticket expires (ISO), if the state sets a ticket life. Counted from the planned start, or the earliest start. */
    expires?: string;
    /** Problems with the planned start. */
    problems: string[];
    steps: string[];
    citations: string[];
    notes: string[];
}
export declare function digClock(input: ClockInput): ClockResult;
/** Emergency locate deadline, where the state sets one. */
export declare function emergencyDeadline(state: string, noticeAt: string): {
    due: string;
    citation: string;
} | null;
export interface MemberResponse {
    member: string;
    respondedAt?: string;
    code?: string;
    description?: string;
}
/** Which utilities on a ticket have not responded, and are they late? */
export declare function responseStatus(clock: Pick<ClockResult, 'responsesDue'>, members: MemberResponse[], asOf: string): {
    rows: (MemberResponse & {
        state: "on time" | "late" | "overdue" | "waiting";
    })[];
    clearToDig: boolean;
    overdue: string[];
};
export interface ParsedTicket {
    ticketNumber?: string;
    type?: string;
    revision?: string;
    noticeAt?: string;
    workStart?: string;
    expires?: string;
    excavator?: string;
    contact?: string;
    phone?: string;
    workType?: string;
    doneFor?: string;
    explosives?: boolean;
    state?: string;
    county?: string;
    place?: string;
    address?: string;
    street?: string;
    intersection?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    members: string[];
    /** Every "Label: value" pair found, keyed by the label as written. */
    fields: Record<string, string>;
}
/**
 * Parse the plain text of a one-call ticket (the email body). Formats differ by center and vendor; this reads
 * "Label: value" lines (several per line are fine), coordinates, and the members/utilities list. Unknown labels are
 * kept in `fields`.
 */
export declare function parseTicket(text: string): ParsedTicket;
