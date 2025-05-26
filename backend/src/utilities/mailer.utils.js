const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465, // secure SMTP port
  secure: true, // use TLS
  auth: {
    user: process.env.SENDER_EMAIL, // email address on cPanel
    pass: process.env.SENDER_PW, // email password on cPanel
  },
});

const sendEmail = async (email, code) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Verification of Discovery Account',
      html: `
              <h1>Please Verify Your Account</h1>
              <p>Enter this code to to verify your email</p>
              <code>${code}</code>
              `,
    });
    console.log('Email sent to: ', email);
    return info;
  } catch (error) {
    throw {
      code: 400,
      message: `Error while sending email to: ${email}, Error: ${error}`,
    };
  }
};

module.exports = sendEmail;
