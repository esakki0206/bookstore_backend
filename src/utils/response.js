const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    status: 'success'
  });
};

const sendError = (res, message, statusCode = 400, error = null) => {
  const response = {
    success: false,
    message,
    status: 'error'
  };
  
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error;
  }
  
  res.status(statusCode).json(response);
};

const sendPaginated = (res, data, total, page, limit, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    },
    status: 'success'
  });
};

module.exports = { sendSuccess, sendError, sendPaginated };
