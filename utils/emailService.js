const nodemailer = require('nodemailer');

// Create transporter with Gmail settings
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'diagnoaiteam1@gmail.com',
        // Replace this with the new 16-character app password you generated
        pass: 'qjjj bncw teai hypl'  // Your new app password here
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Test the connection immediately
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP connection error:', error);
    } else {
        console.log('Server is ready to send emails');
    }
});

const sendAppointmentEmail = async (appointment, doctor, userEmail) => {
    console.log('Attempting to send email to:', userEmail); // Debug log

    try {
        const mailOptions = {
            from: 'diagnoaiteam1@gmail.com',
            to: userEmail,
            subject: `Appointment Confirmation - ${appointment.mode} Consultation`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #171f46;">Appointment Confirmation</h2>
                    <p>Dear ${appointment.patient_name},</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2c3e50; margin-top: 0;">Appointment Details:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li>📅 Date: ${appointment.date}</li>
                            <li>⏰ Time: ${appointment.time}</li>
                            <li>👨‍⚕️ Doctor: Dr. ${doctor.name}</li>
                            <li>📍 Location: ${appointment.location}</li>
                            <li>🏥 Mode: ${appointment.mode}</li>
                        </ul>
                    </div>
                    ${appointment.mode === 'Online' ? `
                        <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px;">
                            <h3 style="color: #2c3e50; margin-top: 0;">Online Consultation Details</h3>
                            <p>Meeting ID: <strong>${appointment.meeting_id}</strong></p>
                            <p>Please join 5 minutes before the scheduled time.</p>
                        </div>
                    
                    ` : `
                        <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px;">
                            <h3 style="color: #2c3e50; margin-top: 0;">Clinic Visit Details</h3>
                            <p>Please arrive 15 minutes before your appointment time.</p>
                        </div>
                    `}
                </div>
            `
        };

        console.log('Sending email with options:', mailOptions); // Debug log

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId); // Debug log
        return true;

    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
};

module.exports = { sendAppointmentEmail }; 