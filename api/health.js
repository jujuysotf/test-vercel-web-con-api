module.exports = function health(_req, res) {
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
  });
};
