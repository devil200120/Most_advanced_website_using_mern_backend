// File: c:\Users\KIIT0001\Desktop\exam_site\backend\utils\generatePDF.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Generate exam report PDF
const generateExamReportPDF = async (examData, submissions) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const filename = `exam-report-${examData._id}-${Date.now()}.pdf`;
      const filepath = path.join('uploads', 'reports', filename);
      
      // Ensure reports directory exists
      const reportsDir = path.dirname(filepath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);
      
      // Header
      doc.fontSize(20).text('Exam Performance Report', { align: 'center' });
      doc.moveDown();
      
      // Exam details
      doc.fontSize(14).text(`Exam: ${examData.title}`);
      doc.text(`Subject: ${examData.subject}`);
      doc.text(`Grade: ${examData.grade}`);
      doc.text(`Total Questions: ${examData.totalQuestions}`);
      doc.text(`Total Marks: ${examData.totalMarks}`);
      doc.moveDown();
      
      // Statistics
      if (submissions && submissions.length > 0) {
        const scores = submissions.map(sub => sub.percentage);
        const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const passedCount = submissions.filter(sub => sub.isPassed).length;
        const passRate = (passedCount / submissions.length) * 100;
        
        doc.text('Statistics:');
        doc.text(`Total Submissions: ${submissions.length}`);
        doc.text(`Average Score: ${averageScore.toFixed(2)}%`);
        doc.text(`Pass Rate: ${passRate.toFixed(2)}%`);
        doc.text(`Highest Score: ${Math.max(...scores).toFixed(2)}%`);
        doc.text(`Lowest Score: ${Math.min(...scores).toFixed(2)}%`);
        doc.moveDown();
        
        // Submissions table
        doc.text('Student Results:');
        doc.moveDown(0.5);
        
        submissions.forEach((submission, index) => {
          doc.text(`${index + 1}. ${submission.student.firstName} ${submission.student.lastName}`);
          doc.text(`   Score: ${submission.percentage.toFixed(2)}% | Grade: ${submission.grade}`);
          doc.moveDown(0.3);
        });
      }
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(filepath);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
};

// Generate student progress report PDF
const generateStudentProgressPDF = async (studentData, submissions) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const filename = `student-progress-${studentData._id}-${Date.now()}.pdf`;
      const filepath = path.join('uploads', 'reports', filename);
      
      // Ensure reports directory exists
      const reportsDir = path.dirname(filepath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);
      
      // Header
      doc.fontSize(20).text('Student Progress Report', { align: 'center' });
      doc.moveDown();
      
      // Student details
      doc.fontSize(14).text(`Student: ${studentData.firstName} ${studentData.lastName}`);
      doc.text(`Email: ${studentData.email}`);
      doc.text(`Grade: ${studentData.grade}`);
      doc.text(`Section: ${studentData.section}`);
      doc.moveDown();
      
      // Progress statistics
      if (submissions && submissions.length > 0) {
        const scores = submissions.map(sub => sub.percentage);
        const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const passedCount = submissions.filter(sub => sub.isPassed).length;
        const passRate = (passedCount / submissions.length) * 100;
        
        doc.text('Overall Performance:');
        doc.text(`Total Exams Taken: ${submissions.length}`);
        doc.text(`Average Score: ${averageScore.toFixed(2)}%`);
        doc.text(`Pass Rate: ${passRate.toFixed(2)}%`);
        doc.moveDown();
        
        // Recent exams
        doc.text('Recent Exam Results:');
        doc.moveDown(0.5);
        
        const recentSubmissions = submissions
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
          .slice(0, 10);
        
        recentSubmissions.forEach((submission, index) => {
          doc.text(`${index + 1}. ${submission.exam.title}`);
          doc.text(`   Score: ${submission.percentage.toFixed(2)}% | Grade: ${submission.grade}`);
          doc.text(`   Date: ${new Date(submission.submittedAt).toLocaleDateString()}`);
          doc.moveDown(0.3);
        });
      }
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(filepath);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateExamReportPDF,
  generateStudentProgressPDF
};