const AWS = require('aws-sdk');

// Configure AWS SES
const ses = new AWS.SES({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * Send an email using AWS SES
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML or text)
 * @returns {Promise}
 */
async function sendEmailSES(to, subject, body) {
  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: body,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: process.env.AWS_SES_FROM || 'info@aerapass.com',
  };
  return ses.sendEmail(params).promise();
}

module.exports = { sendEmailSES };
