const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

const { sendAppointmentEmail } = require('./utils/emailService');

const multer = require('multer');

// const fs = require('fs');

const Tesseract = require('tesseract.js');
const axios = require('axios');
const translate = require('translate-google');
const textToSpeech = require('@google-cloud/text-to-speech');
const ttsClient = new textToSpeech.TextToSpeechClient();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini with your API key
const genAI = new GoogleGenerativeAI("AIzaSyCYlT2PCDSiOzxKP1wQ0ut5IkseGpIhwoA");

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
console.log('Upload directory:', uploadDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('Multer destination called');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        console.log('Multer filename called');
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        console.log('Generated filename:', uniqueName);
        cb(null, uniqueName);
    }
});

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with proper CORS
const io = socketIO(server, {
    cors: {
        origin: [
            "http://localhost:3000",  // Doctor's frontend
            "http://localhost:3001",  // Patient's frontend
            "https://frontend-diagno.vercel.app",
            "https://doctors-frontend-diango.vercel.app"
        ],
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    }
});

// Initialize Supabase
const supabaseUrl = 'https://syeftlcapxekqravghmp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWZ0bGNhcHhla3FyYXZnaG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTYyMTIsImV4cCI6MjA3MDQ5MjIxMn0.TJve2dU8DoDs2wYbSDW9SFOcrHl5p6iulHnURl59Blc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure CORS
app.use(cors({
    origin: [
        'http://localhost:3001', 
        'http://localhost:3002', 
        'http://localhost:3000',
        'https://frontend-diagno.vercel.app',
        'https://doctors-frontend-diango.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Headers:', req.headers);
    }
    next();
});
const fileFilter = (req, file, cb) => {
    console.log('Received file:', file.originalname, 'Type:', file.mimetype);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        console.log('File type accepted');
        cb(null, true);
    } else {
        console.log('File type rejected');
        cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF) are allowed.'));
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max-size
    }
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Medical report analysis endpoint
app.post('/api/analyze', (req, res, next) => {
    console.log('Received analyze request');
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }

        try {
            console.log('File upload successful');
            if (!req.file) {
                throw new Error('No file uploaded');
            }

            console.log('Processing file:', req.file.path);
            const language = req.body.language || 'english';
            console.log('Target language:', language);
            
            const result = await handleMedicalReportAnalysis(req.file.path, language);
            console.log('Analysis completed successfully');

            res.json({
                success: true,
                formattedOutput: result.formattedOutput,
                extractedText: result.extractedText
            });
        } catch (error) {
            console.error('Analysis error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to analyze the medical report' 
            });
        }
    });
});

app.post('/api/login', async (request, response) => {
    try {
        const { username, password } = request.body;

        console.log('Login attempt for username:', username);

        // Query user from Supabase
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username);

        if (error) {
            console.error('Supabase query error:', error);
            throw error;
        }

        if (!users || users.length === 0) {
            return response.status(401).json({
                error: 'User not found'
            });
        }

        const user = users[0];
        console.log('Raw user data from DB:', user); // Debug log

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return response.status(401).json({
                error: 'Invalid password'
            });
        }

        // Format the date properly
        let formattedDateOfBirth = null;
        if (user.dateofbirth) {
            try {
                formattedDateOfBirth = new Date(user.dateofbirth).toISOString().split('T')[0];
            } catch (e) {
                console.error('Date formatting error:', e);
                formattedDateOfBirth = user.dateofbirth;
            }
        }

        // Create userDetails object with formatted date
        const userDetails = {
            id: user.id,
            username: user.username,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            phonenumber: user.phonenumber,
            dateofbirth: formattedDateOfBirth, // Use formatted date
            gender: user.gender
        };

        console.log('Formatted user details:', userDetails); // Debug log

        // Create JWT token
        const jwtToken = jwt.sign({ username }, 'MY_SECRET_TOKEN');

        // Send response
        response.json({
            jwt_token: jwtToken,
            user: userDetails
        });

    } catch (error) {
        console.error('Login error:', error);
        response.status(500).json({
            error: 'Login failed. Please try again.',
            details: error.message
        });
    }
});

// First, test if Supabase is connected
const testSupabaseConnection = async () => {
    const { data, error } = await supabase
        .from('doctors')
        .select('username');
    console.log('Supabase test:', {
        connected: !error,
        doctorsFound: data?.length || 0,
        error: error?.message
    });
};

// Call this when your server starts
testSupabaseConnection();

app.post('/api/doctor-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Doctor login attempt with username:', username);

        // Remove local database query and use Supabase instead
        const { data: doctor, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !doctor) {
            console.log('Login failed:', error?.message || 'No matching doctor found');
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        console.log('Doctor found:', {
            id: doctor.id,
            username: doctor.username,
            name: doctor.name
        });

        // Generate JWT token
        const jwt_token = jwt.sign(
            { doctorId: doctor.id },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: '30d' }
        );

        // Return success response
        res.json({
            success: true,
            jwt_token,
            doctor: {
                id: doctor.id,
                name: doctor.name,
                username: doctor.username,
                specialization: doctor.specialization,
                location: doctor.location,
                appointment_cost: doctor.appointment_cost,
                rating: doctor.rating,
                phone_number: doctor.phone_number
            }
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
});

app.get('/api/doctor-appointments/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        console.log('Fetching appointments for doctor:', doctorId);

        // Fetch appointments from Supabase with proper error handling
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                *,
                users (
                    firstname,
                    lastname
                )
            `)
            .eq('doctor_id', doctorId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Supabase query error:', error);
            throw error;
        }

        // Format the response data
        const formattedAppointments = data.map(apt => ({
            id: apt.id,
            patient_name: apt.patient_name || `${apt.users?.firstname || ''} ${apt.users?.lastname || ''}`,
            date: apt.date,
            time: apt.time,
            mode: apt.mode,
            status: apt.status,
            meeting_id: apt.meeting_id,
            prescription: apt.prescription
        }));

        console.log(`Found ${formattedAppointments.length} appointments for doctor ${doctorId}`);
        res.json(formattedAppointments);

    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ 
            error: 'Failed to fetch appointments',
            details: error.message 
        });
    }
});

// Helper function to generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Add patient history endpoint
app.get('/api/patient-history/:patientId/:doctorId', async (req, res) => {
    try {
        const { patientId, doctorId } = req.params;
        console.log('Fetching patient history:', { patientId, doctorId });

        const query = `
            SELECT 
                a.id,
                a.date,
                a.time,
                a.status,
                a.symptoms,
                a.prescription,
                a.diagnosis,
                a.notes
            FROM appointments a
            WHERE a.user_id = ? 
            AND a.doctor_id = ?
            ORDER BY a.date DESC, a.time DESC
        `;

        const history = await supabase.from('appointments').select().eq('user_id', patientId).eq('doctor_id', doctorId).order('date', { ascending: false });
        console.log(`Found ${history.length} historical records`);

        res.json(history);

    } catch (error) {
        console.error('Error fetching patient history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch patient history',
            details: error.message 
        });
    }
});

function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Signup endpoint
app.post('/api/signup', async (request, response) => {
    try {
        const {
            username,
            firstname,
            lastname,
            email,
            phoneNumber,
            dateOfBirth,
            password,
            gender
        } = request.body;

        // Format the date before storing
        let formattedDate = null;
        if (dateOfBirth) {
            try {
                formattedDate = new Date(dateOfBirth).toISOString().split('T')[0];
            } catch (e) {
                console.error('Date formatting error:', e);
                formattedDate = dateOfBirth;
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user object
        const newUser = {
            username,
            firstname,
            lastname,
            email,
            phonenumber: phoneNumber,
            dateofbirth: formattedDate, // Use formatted date
            password: hashedPassword,
            gender
        };

        console.log('Attempting to insert user with data:', {
            ...newUser,
            password: '[HIDDEN]'
        });

        // Insert into Supabase
        const { data, error } = await supabase
            .from('users')
            .insert([newUser]);

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        response.status(201).json({
            success: true,
            message: 'User registered successfully'
        });

    } catch (error) {
        console.error('Signup error:', error);
        response.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.',
            details: error.message
        });
    }
});

// Get user details including email
app.get('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, firstname, lastname')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching user:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json(user);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user details',
            details: error.message
        });
    }
});

app.get('/api/doctor-locations', async (req, res) => {
    try {
        // Get distinct locations from doctors table
        const { data, error } = await supabase
            .from('doctors')
            .select('location')
            .not('location', 'is', null);

        if (error) {
            throw error;
        }

        // Extract unique locations and remove any duplicates
        const uniqueLocations = [...new Set(data.map(item => item.location))];
        const formattedLocations = uniqueLocations.map(location => ({ location }));

        res.json(formattedLocations);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ 
            error: 'Failed to fetch locations',
            details: error.message 
        });
    }
});

app.get("/api/doctor-locations/getDoctors", async (req, res) => {
try {
    const { location, specialization } = req.query;
    console.log('Fetching doctors with:', { location, specialization });

    const query = `
        SELECT * FROM doctors 
        WHERE location = ? 
        AND specialization = ?
    `;
    
    const doctors = await supabase.from('doctors').select().eq('location', location).eq('specialization', specialization);
    console.log('Found doctors:', doctors);

    if (!doctors || doctors.length === 0) {
        return res.json([]);
    }

    res.json(doctors);
} catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
        error: 'Failed to fetch doctors',
        message: error.message 
    });
}
});

    
    




app.get('/api/appointments/check-availability', async (req, res) => {
try {
    const { doctor_id, date, time } = req.query;
    
    console.log('Checking availability for:', { doctor_id, date, time }); // Debug log

    const query = `
        SELECT COUNT(*) as count 
        FROM appointments 
        WHERE doctor_id = ? 
        AND date = ? 
        AND time = ?
    `;

    const result = await supabase.from('appointments').select('*').eq('doctor_id', doctor_id).eq('date', date).eq('time', time);
    
    console.log('Query result:', result); // Debug log

    // If count is 0, the slot is available
    const available = result.length === 0;

    res.json({ 
        available,
        message: available ? 'Time slot is available' : 'Time slot is already booked'
    });

} catch (error) {
    console.error('Error checking appointment availability:', error);
    res.status(500).json({ 
        message: 'Error checking appointment availability',
        error: error.message 
    });
}
});

const generateMeetingId = () => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    return `diagno-${timestamp}-${randomString}`;
};

app.post('/api/appointments', async (req, res) => {
    try {
        const {
            doctor_id,
            user_id,
            patient_name,
            gender,
            age,
            date,
            time,
            phone_number,
            address,
            specialist,
            location,
            mode,
            meeting_id,
            email
        } = req.body;

        console.log('Received appointment data:', req.body);

        // Insert into Supabase appointments table
        const { data: appointmentData, error: appointmentError } = await supabase
            .from('appointments')
            .insert([{
                doctor_id,
                user_id,
                patient_name,
                gender,
                age,
                date,
                time,
                phone_number,
                address,
                specialist,
                location,
                mode,
                meeting_id,
                status: 'Upcoming',
                symptoms: null,
                prescription: null,
                diagnosis: null,
                notes: null,
                created_at: new Date().toISOString()
            }])
            .select();

        if (appointmentError) {
            console.error('Supabase appointment insert error:', appointmentError);
            return res.status(400).json({
                success: false,
                error: appointmentError.message
            });
        }

        // Get doctor details for email
        const { data: doctorData } = await supabase
            .from('doctors')
            .select('*')
            .eq('id', doctor_id)
            .single();

        // Send email if we have both doctor data and user email
        if (doctorData && email) {
            try {
                await sendAppointmentEmail(
                    {
                        patient_name,
                        date,
                        time,
                        mode,
                        meeting_id,
                        location
                    },
                    doctorData,
                    email
                );
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                // Don't fail the appointment creation if email fails
            }
        }

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            data: appointmentData
        });

    } catch (error) {
        console.error('Appointment creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create appointment'
        });
    }
});

// Add a test endpoint to verify email functionality
app.get('/test-email/:email', async (req, res) => {
    try {
        const testResult = await sendAppointmentEmail(
            {
                patient_name: 'Test Patient',
                date: '2024-01-01',
                time: '10:00 AM',
                mode: 'Online',
                meeting_id: 'test-123',
                location: 'Test Location'
            },
            {
                name: 'Test Doctor',
                specialization: 'General'
            },
            req.params.email
        );

        res.json({
            success: true,
            emailSent: testResult,
            sentTo: req.params.email
        });
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Utility function to check slot availability
async function checkAvailability(db, doctor_id, date, time) {
    const query = `
        SELECT 1 
        FROM appointments 
        WHERE doctor_id = ? AND date = ? AND time = ?
    `;
    const row = await db.get(query, [doctor_id, date, time]);
    return !row; // Slot is available if no row is returned
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication token required' });
    }

    jwt.verify(token, 'MY_SECRET_TOKEN', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Add this new endpoint for booking history
app.get('/booking-history', authenticateToken, async (req, res) => {
    try {
        // Get username from the verified token
        const username = req.user.username;
        
        // First get the user's ID
        const userQuery = 'SELECT id FROM users WHERE username = ?';
        const user = await supabase.from('users').select('id').eq('username', username);
        
        if (!user || !user.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Then get their appointments
        const query = `
            SELECT 
                a.*,
                d.name as doctor_name,
                CASE
                    WHEN a.date > date('now') THEN 'Upcoming'
                    ELSE 'Completed'
                END as status
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            WHERE a.user_id = ?
            ORDER BY a.date DESC, a.time DESC
        `;
        
        const appointments = await supabase.from('appointments').select().eq('user_id', user[0].id).order('date', { ascending: false });
        res.json(appointments);
        
    } catch (error) {
        console.error('Error fetching booking history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch booking history',
            details: error.message 
        });
    }
});

// Add prescription update endpoint
app.post('/api/appointments/:appointmentId/prescription', async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { prescription, diagnosis_tests } = req.body;

        const { data, error } = await supabase
            .from('appointments')
            .update({
                prescription,
                diagnosis_tests,
                status: 'Completed'
            })
            .eq('id', appointmentId)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Prescription and diagnosis tests updated successfully',
            data
        });

    } catch (error) {
        console.error('Error updating prescription and tests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update prescription and tests'
        });
    }
});

// Upload route
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Upload request received:', {
        file: req?.file?.originalname,
        language: req.body?.language,
        fileType: req.body?.fileType
    });

    try {
        if (!req.file) {
            console.log('No file received');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const inputFile = req.file.path;
        const targetLanguage = (req.body.language || 'english').toLowerCase();
        const fileType = req.body.fileType || 'text';

        console.log('Processing file:', {
            path: inputFile,
            language: targetLanguage,
            type: fileType
        });

        let imagePath = inputFile;
        let analysisResult;

        try {
            if (fileType === 'xray') {
                console.log('Starting X-ray analysis...');
                analysisResult = await analyzeXrayUsingRapidAPI(imagePath);
                console.log('X-ray analysis completed');
            } else {
                const extractedText = await extractTextFromImage(imagePath);
                if (!extractedText) {
                    throw new Error('No text could be extracted from the image');
                }
                analysisResult = await analyzeTextUsingRapidAPI(extractedText);
            }

            if (!analysisResult) {
                throw new Error('Analysis failed to produce results');
            }

            let finalOutput = analysisResult;
            if (targetLanguage !== 'english') {
                console.log(`Translating to ${targetLanguage}...`);
                finalOutput = await translateText(analysisResult, targetLanguage);
            }

            // Cleanup files
            try {
                fs.unlinkSync(inputFile);
                if (imagePath !== inputFile) {
                    fs.unlinkSync(imagePath);
                }
            } catch (cleanupError) {
                console.error('File cleanup error:', cleanupError);
            }

            console.log('Processing completed successfully');
            res.status(200).json({
                formattedOutput: finalOutput,
                targetLanguage,
                translationPerformed: targetLanguage !== 'english',
                fileType
            });

        } catch (processingError) {
            console.error('Processing error:', processingError);
            res.status(400).json({
                error: 'Processing failed',
                details: processingError.message
            });
        }

    } catch (error) {
        console.error('Upload route error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
});

(async () => {
    try {
        await fs.mkdir(uploadDir, { recursive: true });
        console.log('Upload directory created/verified successfully');
    } catch (error) {
        console.error('Error creating upload directory:', error);
    }
})();

// Configure multer for file upload

// Extract text from image using tesseract.js
async function extractTextFromImage(imagePath) {
    console.log('Starting OCR for:', imagePath);
    try {
        // Verify file exists
        await fs.access(imagePath);
        console.log('File exists and is accessible');

        const result = await Tesseract.recognize(
            imagePath,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );
        console.log('OCR completed successfully');
        console.log('Extracted text length:', result.data.text.length);
        return result.data.text;
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error(`Error in OCR: ${error.message}`);
    }
}

// Analyze text using GPT-4 API
async function analyzeTextUsingRapidAPI(text) {
    console.log('Starting GPT analysis');
    const url = 'https://cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com/v1/chat/completions';
    
    const systemPrompt = `You are a medical expert. Analyze this medical report and provide a clear, structured response. 
    Always follow this EXACT format with EXACT numbering:

    1. Symptoms:
    - List all symptoms mentioned
    - Be specific and clear

    2. Diagnosis:
    - Provide clear diagnosis
    - Include medical terminology with simple explanations

    3. Severity Level:
    - Specify severity (Mild/Moderate/Severe)
    - Explain why this level was chosen

    4. Treatment Recommendations:
    - List specific treatments needed
    - Include medications if applicable
    - Provide lifestyle recommendations

    5. Recommended Specialist:
    - Specialist: [EXACTLY ONE OF: Dermatologist/Cardiologist/Neurologist/Orthopedist/Ophthalmologist/ENT/Gastroenterologist/Pulmonologist/Endocrinologist/Oncologist]
    - Reason: [Brief explanation why this specialist is needed]

    Ensure each section starts with the exact number and heading as shown above.`;
    
    try {
        console.log('Sending request to GPT API...');
        const response = await axios.post(url, {
            model: 'gpt-4-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: 0.3,
            max_tokens: 1000
        }, {
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': '54bd8d45b5mshbda6cdbbee7fe51p1ad5bfjsn9363f2cba62e',
                'X-RapidAPI-Host': 'cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com'
            }
        });

        console.log('Received response from GPT API');
        if (!response.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid API response structure');
        }

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('GPT API Error:', error.response?.data || error.message);
        throw error;
    }
}

// Translate text using Google Translate
async function translateText(text, targetLanguage) {
    if (targetLanguage === 'english') return text;
    
    try {
        console.log(`Translating to ${targetLanguage}...`);
        const languageCode = getLanguageCode(targetLanguage);
        
        // Split the text into sections based on numbered headers
        const sections = text.split(/(?=\d\.\s+[^:]+:)/);
        
        // Translate each section separately while preserving the numbering
        const translatedSections = await Promise.all(
            sections.map(async (section) => {
                if (!section.trim()) return '';
                
                // Extract the section header and content
                const match = section.match(/^(\d\.\s+[^:]+:)([\s\S]+)$/);
                if (match) {
                    const [_, header, content] = match;
                    // Translate only the content, keep the header structure
                    const translatedContent = await translate(content.trim(), { to: languageCode });
                    return `${header}\n${translatedContent}`;
                }
                return await translate(section.trim(), { to: languageCode });
            })
        );
        
        // Join the sections with newlines
        return translatedSections.join('\n\n');
    } catch (error) {
        console.error('Translation error:', error);
        throw new Error(`Translation failed: ${error.message}`);
    }
}

// Get language code for translation
function getLanguageCode(language) {
    const languageCodes = {
        'english': 'en',
        'telugu': 'te',
        'hindi': 'hi',
        'tamil': 'ta',
        'kannada': 'kn',
        'malayalam': 'ml',
        'marathi': 'mr',
        'bengali': 'bn',
        'gujarati': 'gu',
        'punjabi': 'pa'
    };
    return languageCodes[language.toLowerCase()] || 'en';
}

// Handle medical report analysis request
async function handleMedicalReportAnalysis(filePath, language = 'english') {
    console.log('Starting analysis for file:', filePath);
    try {
        // Verify file exists
        await fs.access(filePath);
        console.log('File exists and is accessible');

        // Extract text using Tesseract
        const text = await extractTextFromImage(filePath);
        console.log('Text extraction completed');

        if (!text || text.trim().length < 10) {
            throw new Error('Could not extract sufficient text from the image.');
        }

        // Change this line to use Gemini instead of RapidAPI
        const analysis = await analyzeTextUsingGemini(text);
        console.log('Analysis completed');

        // Translate the analysis if needed
        const translatedAnalysis = await translateText(analysis, language);
        console.log('Translation completed (if needed)');
        
        // Clean up uploaded file
        try {
            await fs.unlink(filePath);
            console.log('File cleanup completed');
        } catch (err) {
            console.error('Error deleting file:', err);
        }

        return {
            success: true,
            formattedOutput: translatedAnalysis,
            extractedText: text
        };

    } catch (error) {
        console.error('Analysis error:', error);
        
        // Clean up uploaded file in case of error
        try {
            await fs.unlink(filePath);
            console.log('File cleanup completed (error case)');
        } catch (err) {
            console.error('Error deleting file:', err);
        }

        throw error;
    }
}

const analyzeXrayUsingRapidAPI = async (imagePath) => {
    const url = 'https://cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com/v1/chat/completions';
    
    try {
        const imageBuffer = await fs.readFile(imagePath); // Fixed line
        const base64Image = imageBuffer.toString('base64');
        
        const headers = {
            'content-type': 'application/json',
            'X-RapidAPI-Key': '54bd8d45b5mshbda6cdbbee7fe51p1ad5bfjsn9363f2cba62e',
            'X-RapidAPI-Host': 'cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com'
        };

        const systemPrompt = `You are an experienced radiologist. Analyze this X-ray image and provide 
        a detailed interpretative report. Be specific and explain findings in both medical and simple terms. 
        Follow EXACTLY this format:
        1. X-ray Overview:
        - Describe what type of X-ray this is (e.g., chest, limb, spine)
        - Explain the quality and positioning of the image
        - Identify and describe key anatomical structures visible
        - Note any obvious abnormalities or areas of interest
        2. Fracture Status:
        - Clearly state if any fractures are present or not
        - If fractures exist, describe exact location and type
        - Explain bone alignment and any displacement
        - Describe any signs of previous fractures or healing
        3. Severity Level:
        - Provide clear assessment (Mild/Moderate/Severe)
        - Explain why this severity level was chosen
        - Describe potential impact on patient mobility/function
        - Compare to normal expected appearance
        4. Required Actions:
        - List specific immediate medical attention needed
        - Recommend types of specialists to consult
        - Suggest specific imaging or tests needed
        - Outline urgent vs non-urgent steps
        5. Care Instructions:
        - List specific activity restrictions with timeframes
        - Provide detailed pain management suggestions
        - Explain expected recovery timeline
        - Specify when to seek immediate medical attention
        - Detail follow-up care requirements`;

        const payload = {
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Please analyze this X-ray image following the specified format."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            temperature: 0.2,
            max_tokens: 1000
        };

        const response = await axios.post(url, payload, { headers });
        
        if (!response.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response structure from API');
        }

        return response.data.choices[0].message.content
            .trim()
            .replace(/\n\n+/g, '\n\n')
            .replace(/^\s+/gm, '')
            .replace(/^(\d+)\./gm, '\n$1.');

    } catch (error) {
        console.error('X-ray Analysis Error:', error.response?.data || error.message);
        throw new Error(`X-ray analysis failed: ${error.message}`);
    }
};

// Track active rooms and participants
const rooms = new Map();
const activeConnections = new Map(); // Track active connections by role

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    let currentRoom = null;

    socket.on('join-room', ({ meeting_id, role, clientId }) => {
        try {
            if (!role || !['Doctor', 'Patient'].includes(role)) {
                socket.emit('room-error', { message: 'Invalid role specified' });
                socket.disconnect();
                return;
            }

            console.log(`${role} ${socket.id} attempting to join room ${meeting_id}`);
            currentRoom = meeting_id;

            // Check if this client is already connected
            const existingConnection = activeConnections.get(`${meeting_id}-${role}`);
            if (existingConnection && existingConnection !== socket.id) {
                console.log(`Disconnecting previous ${role} connection:`, existingConnection);
                io.to(existingConnection).emit('force-disconnect', { 
                    message: `New ${role.toLowerCase()} connection initiated` 
                });
            }

            // Initialize or get room
            if (!rooms.has(meeting_id)) {
                rooms.set(meeting_id, new Map());
                console.log(`Created new room: ${meeting_id}`);
            }
            const room = rooms.get(meeting_id);

            // Remove any existing connection with the same role
            Array.from(room.entries()).forEach(([id, user]) => {
                if (user.role === role) {
                    room.delete(id);
                    io.to(id).emit('force-disconnect');
                }
            });

            // Join room
            socket.join(meeting_id);
            room.set(socket.id, {
                role,
                socketId: socket.id,
                joinedAt: Date.now(),
                status: 'connected',
                clientId // Store client identifier
            });

            // Update active connections
            activeConnections.set(`${meeting_id}-${role}`, socket.id);

            // Log room state
            console.log('\nRoom State:', meeting_id);
            console.log('Participants:');
            room.forEach((info, socketId) => {
                console.log(`- ${socketId}: ${info.role} (joined at: ${new Date(info.joinedAt).toLocaleTimeString()})`);
            });

            // Check if both participants are present
            if (room.size === 2) {
                const doctor = Array.from(room.entries()).find(([_, user]) => user.role === 'Doctor');
                const patient = Array.from(room.entries()).find(([_, user]) => user.role === 'Patient');

                if (doctor && patient) {
                    console.log('\nBoth participants present, initiating connection');
                    io.to(meeting_id).emit('start-call', {
                        doctor: doctor[0],
                        patient: patient[0]
                    });
                }
            }

            // Acknowledge successful join
            socket.emit('joined-room', {
                success: true,
                role,
                roomId: meeting_id
            });

        } catch (error) {
            console.error('Error in join-room:', error);
            socket.emit('room-error', { message: 'Failed to join room' });
        }
    });

    socket.on('ready-for-call', ({ meeting_id }) => {
        const room = rooms.get(meeting_id);
        if (room && room.has(socket.id)) {
            const participant = room.get(socket.id);
            participant.status = 'ready';
            console.log(`${participant.role} ${socket.id} is ready for call`);
        }
    });

    socket.on('disconnect', () => {
        if (!currentRoom) return;

        const room = rooms.get(currentRoom);
        if (!room) return;

        if (room.has(socket.id)) {
            const userInfo = room.get(socket.id);
            room.delete(socket.id);
            
            // Remove from active connections
            activeConnections.delete(`${currentRoom}-${userInfo.role}`);
            
            console.log(`\nUser disconnected: ${socket.id} (${userInfo.role}) from room ${currentRoom}`);
            
            // Notify others in the room
            io.to(currentRoom).emit('user-disconnected', {
                userId: socket.id,
                role: userInfo.role
            });

            if (room.size === 0) {
                rooms.delete(currentRoom);
                console.log(`Room ${currentRoom} deleted - no participants remaining`);
            } else {
                console.log('\nRemaining participants:');
                room.forEach((info, socketId) => {
                    console.log(`- ${socketId}: ${info.role}`);
                });
            }
        }
    });

    // Handle connection errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    // In your server.js, ensure proper signaling
    socket.on('offer', ({ offer, meeting_id }) => {
        const room = rooms.get(meeting_id);
        if (!room) return;

        const patient = Array.from(room.entries())
            .find(([_, user]) => user.role === 'Patient');

        if (patient) {
            const [patientId] = patient;
            console.log(`Sending offer from doctor ${socket.id} to patient ${patientId}`);
            socket.to(patientId).emit('offer', {
                offer,
                from: socket.id
            });
        }
    });

    socket.on('answer', ({ answer, meeting_id }) => {
        const room = rooms.get(meeting_id);
        if (!room) return;

        const doctor = Array.from(room.entries())
            .find(([_, user]) => user.role === 'Doctor');

        if (doctor) {
            const [doctorId] = doctor;
            console.log(`Sending answer from patient ${socket.id} to doctor ${doctorId}`);
            socket.to(doctorId).emit('answer', {
                answer,
                from: socket.id
            });
        }
    });

    socket.on('ice-candidate', ({ candidate, meeting_id }) => {
        const room = rooms.get(meeting_id);
        if (!room) return;

        const sender = room.get(socket.id);
        if (!sender) return;

        // Find the other participant
        const recipient = Array.from(room.entries())
            .find(([id, _]) => id !== socket.id);

        if (recipient) {
            const [recipientId] = recipient;
            console.log(`Sending ICE candidate from ${sender.role} to ${recipientId}`);
            socket.to(recipientId).emit('ice-candidate', {
                candidate,
                from: socket.id
            });
        }
    });
});

function logRoomState(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    console.log('\nRoom State:', roomId);
    console.log('Participants:');
    room.forEach((info, socketId) => {
        console.log(`- ${socketId} (${info.role}): ${info.connected ? 'Connected' : 'Waiting'}`);
    });
    console.log('=================\n');
}

// Start server with error handling
const startServer = async () => {
    try {
        const PORT = process.env.PORT || 3009;
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        server.on('error', (error) => {
            console.error('Server error:', error);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
};

startServer();

app.get('/api/appointments/history/:userId', async (req, res) => {
    try {
        // Get the token from the request headers
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const { userId } = req.params;
        console.log('Fetching appointments for user ID:', userId);

        // Fetch appointments from Supabase
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
                id,
                doctor_id,
                user_id,
                patient_name,
                date,
                time,
                status,
                mode,
                meeting_id,
                location,
                specialist,
                prescription,
                symptoms,
                diagnosis,
                notes
            `)
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Supabase query error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        console.log(`Found ${appointments?.length || 0} appointments for user ${userId}`);

        // If no appointments found, return empty array
        if (!appointments || appointments.length === 0) {
            return res.json([]);
        }

        // Return the appointments
        res.json(appointments);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointments',
            details: error.message
        });
    }
});

// Add endpoint to fetch diagnosis tests
app.get('/api/diagnosis-tests', async (req, res) => {
    try {
        console.log('Fetching diagnosis tests from Supabase...');
        
        const { data, error } = await supabase
            .from('diagnosis')
            .select('tests');

        if (error) {
            console.error('Supabase query error:', error);
            throw error;
        }

        console.log('Raw data from diagnosis table:', data);

        if (!data || data.length === 0) {
            console.log('No data found in diagnosis table');
            return res.json([]);
        }

        // Extract tests from the data (each row has a 'tests' string)
        const tests = data.map(row => row.tests).filter(test => test);
        console.log('Processed tests:', tests);

        res.json(tests);

    } catch (error) {
        console.error('Error fetching diagnosis tests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch diagnosis tests',
            details: error.message
        });
    }
});

// Add this near the top of your server.js file
const testDiagnosisTable = async () => {
    try {
        console.log('Testing diagnosis table connection...');
        
        const { data, error } = await supabase
            .from('diagnosis')
            .select('tests');

        if (error) {
            console.error('Error accessing diagnosis table:', error);
            return;
        }

        console.log('Successfully connected to diagnosis table');
        console.log('Number of rows:', data?.length || 0);
        console.log('Sample data:', data?.[0] || 'No data');
        
    } catch (error) {
        console.error('Failed to test diagnosis table:', error);
    }
};

// Call this when your server starts
testDiagnosisTable();

// Fetch user's recommended diagnosis tests
app.get('/api/user-diagnosis-tests/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get all appointments for the user that have diagnosis tests
        const { data, error } = await supabase
            .from('appointments')
            .select('diagnosis_tests')
            .eq('user_id', userId)
            .not('diagnosis_tests', 'is', null);

        if (error) throw error;

        // Flatten and deduplicate all tests
        const allTests = data.reduce((tests, appointment) => {
            if (Array.isArray(appointment.diagnosis_tests)) {
                return [...tests, ...appointment.diagnosis_tests];
            }
            return tests;
        }, []);

        const uniqueTests = [...new Set(allTests)];
        res.json(uniqueTests);

    } catch (error) {
        console.error('Error fetching user diagnosis tests:', error);
        res.status(500).json({
            error: 'Failed to fetch diagnosis tests',
            details: error.message
        });
    }
});

// Create diagnosis appointment
app.post('/api/diagnosis-appointments', async (req, res) => {
    try {
        const {
            user_id,
            diagnosis_center_id,
            patient_name,
            gender,
            age,
            date,
            time,
            phone_number,
            address,
            location,
            tests
        } = req.body;

        const { data, error } = await supabase
            .from('diagnosis_appointments')
            .insert([{
                user_id,
                diagnosis_center_id,
                patient_name,
                gender,
                age,
                date,
                time,
                phone_number,
                address,
                location,
                tests
            }])
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Appointment booked successfully',
            data
        });

    } catch (error) {
        console.error('Error creating diagnosis appointment:', error);
        res.status(500).json({
            error: 'Failed to create appointment',
            details: error.message
        });
    }
});

// Fetch diagnosis centers
app.get('/api/diagnosis-centers', async (req, res) => {
    try {
        console.log('Fetching diagnosis centers...');
        
        const { data, error } = await supabase
            .from('diagnosis_centers')
            .select('*');

        if (error) {
            console.error('Error fetching diagnosis centers:', error);
            throw error;
        }

        console.log('Fetched diagnosis centers:', data);
        res.json(data);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch diagnosis centers',
            details: error.message
        });
    }
});

app.post('/api/diagnosis-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt with:', { username, password });

        // Updated query to use user_name instead of username
        const { data: center, error } = await supabase
            .from('diagnosis_centers')
            .select('*')
            .eq('user_name', username)  // Changed from username to user_name
            .eq('password', password)    // Make sure this matches your column name in the table
            .single();

        console.log('Database response:', { center, error });

        if (error || !center) {
            console.log('No user found with user_name:', username);
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        console.log('Login successful for:', center.name);

        // Generate JWT token
        const jwt_token = jwt.sign(
            { centerId: center.id },
            'your-secret-key',
            { expiresIn: '30d' }
        );

        // Return success response
        res.json({
            success: true,
            jwt_token,
            center: {
                id: center.id,
                name: center.name,
                location: center.location,
                phone_number: center.phone_number,
                address: center.address
            }
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
});

app.get('/api/diagnosis-appointments/today/:centerId', async (req, res) => {
    try {
        const { centerId } = req.params;
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('diagnosis_appointments')
            .select('*')
            .eq('diagnosis_center_id', centerId)
            .eq('date', today)
            .order('time');

        if (error) throw error;

        res.json(data || []);

    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({
            error: 'Failed to fetch appointments',
            details: error.message
        });
    }
});

app.get('/api/diagnosis-appointments/:centerId', async (req, res) => {
    try {
        const { centerId } = req.params;
        console.log('Fetching appointments for diagnosis center:', centerId);

        // First, let's log the query we're about to make
        const { data: appointments, error } = await supabase
            .from('diagnosis_appointments')
            .select('*')
            .eq('diagnosis_center_id', 1);  // Hardcoding to 1 for testing

        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ 
                error: 'Failed to fetch appointments',
                details: error.message 
            });
        }

        // Log the results
        console.log('Query results:', {
            centerIdRequested: centerId,
            appointmentsFound: appointments?.length,
            appointments: appointments
        });

        res.json(appointments || []);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Server error while fetching appointments',
            details: error.message 
        });
    }
});

// Add a debug endpoint to check the diagnosis center ID
app.get('/api/debug/center-details', (req, res) => {
    try {
        const centerDetails = JSON.parse(localStorage.getItem('centerDetails'));
        res.json({
            storedCenterDetails: centerDetails,
            message: 'These are the stored center details'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get center details',
            details: error.message
        });
    }
});

// Add this new endpoint to fetch appointment details
app.get('/api/appointments/:meeting_id', async (req, res) => {
    try {
        const { meeting_id } = req.params;
        console.log('Fetching appointment details for meeting:', meeting_id); // Debug log
        
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('meeting_id', meeting_id)
            .single();

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log('Found appointment data:', data); // Debug log

        if (!data) {
            return res.status(404).json({
                error: 'Appointment not found'
            });
        }

        res.json({
            id: data.id,
            meeting_id: data.meeting_id,
            temperature: data.temperature,
            patient_name: data.patient_name,
            // Include other relevant fields...
        });

    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({
            error: 'Failed to fetch appointment details',
            details: error.message
        });
    }
});

// Add this new endpoint to update temperature
app.post('/api/appointments/:meeting_id/temperature', async (req, res) => {
    try {
        const { meeting_id } = req.params;
        const { temperature } = req.body;
        
        const { data, error } = await supabase
            .from('appointments')
            .update({ temperature })
            .eq('meeting_id', meeting_id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error updating temperature:', error);
        res.status(500).json({
            error: 'Failed to update temperature',
            details: error.message
        });
    }
});

app.get('/api/health-metrics/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      console.error('No userId provided');
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Fetching health metrics for user ID:', userId); // Debug log

    // Query using 'id' column
    const { data, error } = await supabase
      .from('users')
      .select('heart_rate, spo2, temperature')
      .eq('id', userId) // This matches the 'id' column in the users table
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Found health metrics:', data); // Debug log

    res.json({
      heart_rate: data?.heart_rate || '--',
      spo2: data?.spo2 || '--',
      temperature: data?.temperature || '--'
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Failed to fetch health metrics' });
  }
});

async function analyzeTextUsingGemini(text) {
    console.log('Starting Gemini analysis');
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const prompt = {
            contents: [{
                role: "user",
                parts: [{
                    text: `Analyze this medical report and provide analysis in this exact format:

                    1. Symptoms:
                    - List all symptoms mentioned
                    - Be specific and clear

                    2. Diagnosis:
                    - Provide clear diagnosis
                    - Include medical terminology with simple explanations

                    3. Severity Level:
                    - Specify severity (Mild/Moderate/Severe)
                    - Explain why this level was chosen

                    4. Treatment Recommendations:
                    - List specific treatments needed
                    - Include medications if applicable
                    - Provide lifestyle recommendations

                    5. Recommended Specialist:
                    - Specialist: [EXACTLY ONE OF: Dermatologist/Cardiologist/Neurologist/Orthopedist/Ophthalmologist/ENT/Gastroenterologist/Pulmonologist/Endocrinologist/Oncologist]
                    - Reason: [Brief explanation why this specialist is needed]

                    Medical Report to Analyze:
                    ${text}`
                }]
            }]
        };

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const analysis = response.text();

        if (!analysis) {
            throw new Error('No analysis generated');
        }

        return analysis;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
}
