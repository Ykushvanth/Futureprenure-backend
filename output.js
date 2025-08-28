const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Tesseract = require('tesseract.js');
const axios = require('axios');
const translate = require('translate-google');
const textToSpeech = require('@google-cloud/text-to-speech');
const ttsClient = new textToSpeech.TextToSpeechClient();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI("AIzaSyCYlT2PCDSiOzxKP1wQ0ut5IkseGpIhwoA");

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
console.log('Upload directory:', uploadDir);

(async () => {
    try {
        await fs.mkdir(uploadDir, { recursive: true });
        console.log('Upload directory created/verified successfully');
    } catch (error) {
        console.error('Error creating upload directory:', error);
    }
})();

// Configure multer for file upload
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

// Analyze text using Gemini
async function analyzeTextUsingGemini(text) {
    console.log('Starting Gemini analysis');
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
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
        - Reason: [Brief explanation why this specialist is needed]`;

        const prompt = `${systemPrompt}\n\nAnalyze this medical report:\n${text}`;

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
            throw new Error('Could not extract sufficient text from the image. Please ensure the image is clear and contains readable text.');
        }

        console.log('Extracted text:', text.substring(0, 100) + '...');

        // Analyze the extracted text using Gemini
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

// Analyze X-ray using Gemini
async function analyzeXrayUsingGemini(imagePath) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
        
        const imageBuffer = await fs.readFile(imagePath);
        
        const systemPrompt = `You are an experienced radiologist. Analyze this X-ray image and provide 
        a detailed interpretative report. Be specific and explain findings in both medical and simple terms. 
        Follow EXACTLY this format:
        1. X-ray Overview:
        - Describe what type of X-ray this is
        - Explain the quality and positioning
        - Identify key anatomical structures
        - Note any obvious abnormalities

        2. Fracture Status:
        - State if fractures are present
        - Describe location and type
        - Explain bone alignment
        - Note previous fractures

        3. Severity Level:
        - Assessment (Mild/Moderate/Severe)
        - Impact on mobility
        - Comparison to normal

        4. Required Actions:
        - Immediate medical needs
        - Specialist recommendations
        - Additional tests needed

        5. Care Instructions:
        - Activity restrictions
        - Pain management
        - Recovery timeline
        - Follow-up care`;

        const imageParts = [{
            inlineData: {
                data: imageBuffer.toString('base64'),
                mimeType: 'image/jpeg'
            }
        }];

        const result = await model.generateContent([systemPrompt, ...imageParts]);
        const response = await result.response;
        const analysis = response.text();

        return analysis
            .trim()
            .replace(/\n\n+/g, '\n\n')
            .replace(/^\s+/gm, '')
            .replace(/^(\d+)\./gm, '\n$1.');

    } catch (error) {
        console.error('X-ray Analysis Error:', error);
        throw new Error(`X-ray analysis failed: ${error.message}`);
    }
};

module.exports = {
    upload,
    handleMedicalReportAnalysis,
    analyzeXrayUsingGemini
};