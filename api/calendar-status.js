const { getCalendarStatus } = require('../lib/calendar');

module.exports = async function calendarStatus(_req, res) {
  try {
    res.status(200).json(await getCalendarStatus());
  } catch (err) {
    res.status(200).json({
      connected: false,
      calendarId: 'jujuysotf@gmail.com',
      error: err?.message || String(err),
    });
  }
};
