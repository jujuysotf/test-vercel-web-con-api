const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const OWNER_CALENDAR_ID = 'jujuysotf@gmail.com';
const TIMEZONE = 'America/Argentina/Buenos_Aires';
const TIMEZONE_OFFSET = '-03:00';

function loadServiceAccount() {
  const credPath = path.join(process.cwd(), 'google-credentials.json');
  if (fs.existsSync(credPath)) {
    const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    return {
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
    };
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return {
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
    };
  }

  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function getCalendarClient() {
  const creds = loadServiceAccount();
  if (!creds?.clientEmail || !creds.privateKey) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });

  return google.calendar({ version: 'v3', auth });
}

const SALON_HOURS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
];

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatHour(date) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

async function getCalendarBusyTimes(dateStr) {
  const calendar = getCalendarClient();
  if (!calendar) {
    throw new Error('Sin credenciales de Google Service Account');
  }

  const timeMin = `${dateStr}T00:00:00${TIMEZONE_OFFSET}`;
  const timeMax = `${dateStr}T23:59:59${TIMEZONE_OFFSET}`;
  const freeBusyRes = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      items: [{ id: OWNER_CALENDAR_ID }],
    },
  });

  const calResult = freeBusyRes.data.calendars?.[OWNER_CALENDAR_ID];
  if (calResult?.errors?.length) {
    const detail = calResult.errors.map((error) => error.reason || error.domain).join(', ');
    throw new Error(`Sin acceso al Calendar de ${OWNER_CALENDAR_ID} (${detail}).`);
  }

  const ranges = (calResult?.busy || []).map((item) => ({
    start: new Date(item.start),
    end: new Date(item.end),
    summary: 'Ocupado en Google Calendar',
  }));

  const eventsRes = await calendar.events.list({
    calendarId: OWNER_CALENDAR_ID,
    timeMin,
    timeMax,
    timeZone: TIMEZONE,
    singleEvents: true,
    orderBy: 'startTime',
  });

  for (const event of eventsRes.data.items || []) {
    if (event.status === 'cancelled') continue;
    if (event.start?.dateTime && event.end?.dateTime) {
      ranges.push({
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
        summary: event.summary || 'Ocupado',
      });
    } else if (event.start?.date) {
      ranges.push({
        start: new Date(`${event.start.date}T00:00:00${TIMEZONE_OFFSET}`),
        end: new Date(`${event.start.date}T23:59:59${TIMEZONE_OFFSET}`),
        summary: event.summary || 'Día bloqueado',
      });
    }
  }

  return ranges;
}

async function getAvailability(dateStr, durationMinutes) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  if (dayOfWeek === 0) {
    return {
      date: dateStr,
      isOpen: false,
      reason: 'Domingo cerrado',
      occupied: [],
      text: `${dateStr}\nDomingo cerrado`,
    };
  }

  const busyRanges = await getCalendarBusyTimes(dateStr);
  const slots = SALON_HOURS.map((hour) => {
    const [h, m] = hour.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + durationMinutes;

    if (endMinutes > 20 * 60) {
      return { hour, isAvailable: false, blockedReason: 'Supera horario de cierre (20:00)' };
    }

    const slotStart = new Date(`${dateStr}T${hour}:00${TIMEZONE_OFFSET}`).getTime();
    const endHour = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endMin = String(endMinutes % 60).padStart(2, '0');
    const slotEnd = new Date(`${dateStr}T${endHour}:${endMin}:00${TIMEZONE_OFFSET}`).getTime();

    for (const busy of busyRanges) {
      if (slotStart < busy.end.getTime() && slotEnd > busy.start.getTime()) {
        return {
          hour,
          isAvailable: false,
          blockedReason: busy.summary || 'Ocupado en Google Calendar',
        };
      }
    }

    return { hour, isAvailable: true };
  });

  const occupied = slots
    .filter((slot) => !slot.isAvailable)
    .map((slot) => ({ hour: slot.hour, reason: slot.blockedReason }));
  const lines = [
    `${dateStr} · ${durationMinutes} min`,
    occupied.length ? 'Ocupados:' : 'No hay horarios ocupados',
    ...occupied.map((slot) => `${slot.hour} — ${slot.reason}`),
  ];

  return {
    date: dateStr,
    durationMinutes,
    isOpen: true,
    calendarId: OWNER_CALENDAR_ID,
    occupied,
    busy: busyRanges.map((busy) => ({
      start: formatHour(busy.start),
      end: formatHour(busy.end),
      summary: busy.summary,
    })),
    text: lines.join('\n'),
  };
}

async function getCalendarStatus() {
  const creds = loadServiceAccount();
  if (!creds) {
    return {
      connected: false,
      calendarId: OWNER_CALENDAR_ID,
      message: 'Sin credenciales de Google Service Account',
    };
  }

  const calendar = getCalendarClient();
  const today = todayInArgentina();
  const freeBusyRes = await calendar.freebusy.query({
    requestBody: {
      timeMin: `${today}T00:00:00${TIMEZONE_OFFSET}`,
      timeMax: `${today}T23:59:59${TIMEZONE_OFFSET}`,
      timeZone: TIMEZONE,
      items: [{ id: OWNER_CALENDAR_ID }],
    },
  });

  const calResult = freeBusyRes.data.calendars?.[OWNER_CALENDAR_ID];
  if (calResult?.errors?.length) {
    const detail = calResult.errors.map((error) => error.reason || error.domain).join(', ');
    throw new Error(`Sin acceso al Calendar de ${OWNER_CALENDAR_ID} (${detail}).`);
  }

  return {
    connected: true,
    calendarId: OWNER_CALENDAR_ID,
    busySlotsTodayCount: (calResult?.busy || []).length,
    message: `Google Calendar conectado con ${OWNER_CALENDAR_ID}`,
  };
}

module.exports = { getCalendarStatus, getAvailability, todayInArgentina };
