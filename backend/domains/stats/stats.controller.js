const statsService = require('./stats.service');

const getSummary = async (req, res, next) => {
  try {
    const data = await statsService.getSummary();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
};
