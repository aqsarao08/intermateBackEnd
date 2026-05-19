# Job Description Extraction - Implementation Guide

## ✅ What's Been Implemented

### Backend Endpoints Created

#### 1. **Node.js Backend** - `POST /api/projects/extract-job-description`
- **Authentication:** Required (bearer token)
- **Input:** Multipart form-data with field `jobDescriptionFile` (image or PDF)
- **Output:** `{"message": "Job description extracted successfully", "text": "cleaned text"}`
- **Location:** `src/routes/projects.js`

#### 2. **Python Microservice** - `POST /extract-job-description`
- **Input:** Multipart form-data with field `job_description_file`
- **Output:** `{"text": "cleaned text"}`
- **Location:** `microservice/app/api/routes/analyze.py`

### Python Service - `jd_cleaner.py`
Created comprehensive text extraction and cleaning service that:

✅ **Extracts text from:**
- Images (JPG, PNG, GIF, WebP) using EasyOCR
- PDFs using existing PDF parsers

✅ **Cleans extracted text by removing:**
- OCR artifacts and garbage symbols
- Decorative lines and QR code noise
- Excessive non-ASCII characters
- Duplicate consecutive lines
- Footer patterns and URLs
- Logo/brand fragments
- Social media handles
- Random special characters
- Broken/malformed OCR words

✅ **Keeps only job-relevant information:**
- Job titles and positions
- Qualifications and requirements
- Experience and education needs
- Skills required
- Location, salary, deadline info
- Eligibility criteria
- Age, major, field requirements

### Dependencies Installed
- `easyocr==1.7.1` - For image OCR
- `Pillow==11.0.0` - For image processing

## 🧪 How to Test

### 1. Start the Services
```bash
# Terminal 1: Start microservice
cd microservice
uvicorn app.main:app --reload --port 8001

# Terminal 2: Start Node.js backend
npm run dev
```

### 2. Test with cURL
```bash
# First, get authentication token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"password"}'

# Copy the token from response

# Then test job description extraction
curl -X POST http://localhost:4000/api/projects/extract-job-description \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "jobDescriptionFile=@/path/to/job-post.jpg"

# Response:
# {
#   "message": "Job description extracted successfully",
#   "text": "Cleaned job description text..."
# }
```

### 3. Test with Node.js Script
```javascript
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

async function testExtraction() {
  const token = 'YOUR_AUTH_TOKEN';
  const file = fs.createReadStream('./job-post.jpg');
  
  const form = new FormData();
  form.append('jobDescriptionFile', file);
  
  const response = await fetch('http://localhost:4000/api/projects/extract-job-description', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });
  
  const data = await response.json();
  console.log('Cleaned text:', data.text);
}

testExtraction();
```

## 🎨 Frontend Integration Guide

### Step 1: Add File Input to Create Project Form
```jsx
import { useState } from 'react';

export function CreateProject() {
  const [jobDescFile, setJobDescFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');

  return (
    <form>
      {/* Job Description Upload */}
      <div>
        <label>Job Description (upload image or PDF)</label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          onChange={handleFileUpload}
        />
      </div>

      {/* Loading State */}
      {extracting && <p>Processing job description...</p>}

      {/* Error Message */}
      {extractionError && (
        <p style={{color: 'red'}}>
          We could not read this job post clearly. Please paste the job description manually.
        </p>
      )}

      {/* Job Description Textarea */}
      <div>
        <label>Job Description</label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Job description will appear here after extraction, or paste manually"
        />
      </div>

      {/* Rest of form... */}
    </form>
  );
}
```

### Step 2: Handle File Upload and Extraction
```jsx
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  setExtracting(true);
  setExtractionError('');

  try {
    const formData = new FormData();
    formData.append('jobDescriptionFile', file);

    const response = await fetch('/api/projects/extract-job-description', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}` // Your auth token
      }
    });

    if (!response.ok) {
      throw new Error('Extraction failed');
    }

    const data = await response.json();
    setJobDescription(data.text); // Populate textarea with cleaned text
  } catch (error) {
    setExtractionError('Error extracting job description');
    console.error(error);
  } finally {
    setExtracting(false);
  }
}
```

### Step 3: Submit Project with Cleaned Job Description
```jsx
async function handleCreateProject(e) {
  e.preventDefault();

  const formData = new FormData();
  formData.append('title', projectTitle);
  formData.append('companyName', companyName);
  formData.append('jobRole', jobRole);
  formData.append('jobDescription', jobDescription); // Use cleaned text
  formData.append('resume', resumeFile);

  const response = await fetch('/api/projects', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  // Handle response...
}
```

## 🔄 Flow Diagram

```
User uploads job post image/PDF
         ↓
Frontend sends to /api/projects/extract-job-description
         ↓
Node.js backend receives file
         ↓
Calls Python microservice /extract-job-description
         ↓
Python:
  - Extract text with OCR (images) or PDF parser
  - Clean text (remove noise, symbols, irrelevant content)
  - Filter for job-relevant information
         ↓
Returns cleaned text to backend
         ↓
Backend returns to frontend
         ↓
Frontend displays in textarea for user review/edit
         ↓
User can edit and confirm
         ↓
Project created with final cleaned text
         ↓
Resume matching uses this cleaned job description
```

## 📝 Example: Before and After

### Before Cleaning (Raw OCR)
```
JOB POSTING
████████████████████████████████
⬛ company.com | CAREERS 📱
███ HIRE ENGINEERS ███
QR: ▓▓▓▓▓▓▓▓
www.example123.com/jobs

Senior Backend Engineer (ecnwiz rrogram)
Age 25-35 years
lllllll BENEFITS lllllll
- Health ***
- Dental ~~~

Required: BS in Computer Science, 5+ years exp
Preferred: AWS, Docker, Kubernetes
Location: San Francisco, CA
Deadline: Mar 2026
Apply: careers@company.com

[Footer] © 2024 Company Inc.
```

### After Cleaning
```
Senior Backend Engineer
Age 25-35 years

Required: BS in Computer Science, 5+ years exp
Preferred: AWS, Docker, Kubernetes
Location: San Francisco, CA
Deadline: Mar 2026
```

## ✨ Features

✅ **No manual "Extract" button needed** - Happens automatically on file upload
✅ **User can review/edit** - Shows extracted text in textarea
✅ **Graceful error handling** - Clear messages if extraction fails
✅ **Manual paste still works** - Doesn't break existing flow
✅ **Supports multiple formats** - Images (JPG, PNG, GIF, WebP) and PDFs
✅ **Intelligent filtering** - Keeps job info, removes noise
✅ **Uses cleaned text for matching** - Resume analysis works with clean data

## 🔧 Troubleshooting

### Issue: "Failed to extract text from image"
- Check file format (must be JPG, PNG, GIF, or WebP for images)
- Ensure image quality is reasonable
- Check file isn't corrupted

### Issue: "Extraction timed out"
- Image might be very large or complex
- Check network connection
- Ensure microservice is running

### Issue: "The extracted text was too noisy"
- Job post image is too unclear/corrupted
- File might not contain readable text
- User should paste manually instead

## 📦 Files Modified/Created

### Created:
- `microservice/app/services/jd_cleaner.py` - Text extraction and cleaning logic

### Modified:
- `microservice/requirements.txt` - Added easyocr, pillow
- `microservice/app/api/routes/analyze.py` - Added extract endpoint
- `src/routes/projects.js` - Added backend endpoint and multer config
- `src/utils/resumeAnalyzerClient.js` - Added extractJobDescription function

## 🚀 Next Steps

1. **Frontend Integration**: Implement the UI components shown above
2. **Testing**: Test with various job post formats and images
3. **Refinement**: Adjust cleaning rules based on real-world results
4. **Deployment**: Deploy updated microservice and backend

## 📚 API Contract

### Request
```
POST /api/projects/extract-job-description
Content-Type: multipart/form-data
Authorization: Bearer <token>

jobDescriptionFile: <File>
```

### Success Response (200)
```json
{
  "message": "Job description extracted successfully",
  "text": "Cleaned job description text..."
}
```

### Error Responses
```json
{
  "message": "Job description file is required"
}
```
or
```json
{
  "message": "Only PDF and image files (JPG, PNG, GIF, WebP) are accepted"
}
```

---

**Ready to integrate!** The backend is fully functional. Just add the frontend components to upload and handle the extracted text.
