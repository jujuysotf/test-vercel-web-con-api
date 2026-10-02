const { getCalendarStatus } = require('../lib/calendar');

module.exports = async function calendarStatus(_req, res) {
  try {
    const result = await getCalendarStatus();
    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({
      connected: false,
      calendarId: 'jujuysotf@gmail.com',
      error: err?.message || String(err),
    });
  }
};
