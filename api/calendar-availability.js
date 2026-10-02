const { getAvailability, todayInArgentina } = require('../lib/calendar');

module.exports = async function calendarAvailability(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const date = url.searchParams.get('date') || todayInArgentina();
    const duration = parseInt(url.searchParams.get('duration') || '60', 10);
    const result = await getAvailability(date, Number.isFinite(duration) ? duration : 60);
    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({
      error: err?.message || String(err),
      text: err?.message || String(err),
    });
  }
};
