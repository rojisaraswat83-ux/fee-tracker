/**
 * storage.js
 * Handles LocalStorage data access, student validation, and CSV parsing/formatting.
 */

const STORAGE_KEY = 'edufee_students';

/**
 * Retrieve all student records from local storage.
 * @returns {Array} Array of student objects
 */
export function getStudents() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * Save student records to local storage.
 * @param {Array} students - Array of student records to save
 */
export function saveStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

/**
 * Check if a roll number already exists.
 * @param {string|number} rollNumber - The roll number to check
 * @param {string} [excludeId] - Optional student ID to exclude (useful during edits)
 * @returns {boolean} True if duplicate, false otherwise
 */
export function isDuplicateRollNumber(rollNumber, excludeId = null) {
  const students = getStudents();
  const rollStr = String(rollNumber).trim().toLowerCase();
  
  return students.some(student => {
    if (excludeId && student.id === excludeId) {
      return false;
    }
    return String(student.rollNumber).trim().toLowerCase() === rollStr;
  });
}

/**
 * Add or update a student record.
 * @param {Object} studentData - Student details
 * @returns {Object} Saved student object
 */
export function saveStudent(studentData) {
  const students = getStudents();
  
  if (studentData.id) {
    // Edit existing student
    const idx = students.findIndex(s => s.id === studentData.id);
    if (idx !== -1) {
      students[idx] = {
        ...students[idx],
        ...studentData,
        feeAmount: parseFloat(studentData.feeAmount) || 0
      };
    }
  } else {
    // Add new student
    studentData.id = 'std_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    studentData.feeAmount = parseFloat(studentData.feeAmount) || 0;
    students.push(studentData);
  }
  
  saveStudents(students);
  return studentData;
}

/**
 * Delete a student record by ID.
 * @param {string} id - Student ID to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteStudent(id) {
  const students = getStudents();
  const index = students.findIndex(s => s.id === id);
  
  if (index !== -1) {
    students.splice(index, 1);
    saveStudents(students);
    return true;
  }
  return false;
}

/**
 * Update the payment status of a student.
 * @param {string} id - Student ID
 * @param {string} status - New fee status ('paid' or 'unpaid')
 * @returns {Object|null} Updated student object or null
 */
export function toggleStudentStatus(id, status) {
  const students = getStudents();
  const student = students.find(s => s.id === id);
  
  if (student) {
    student.feeStatus = status;
    saveStudents(students);
    return student;
  }
  return null;
}

/**
 * Convert the student database into a CSV string.
 * @returns {string} CSV formatted data
 */
export function exportToCSVString() {
  const students = getStudents();
  const headers = ['Name', 'Class', 'Roll Number', 'Parent Name', 'Mobile Number', 'Fee Amount', 'Due Date', 'Fee Status'];
  
  const csvRows = [headers.join(',')];
  
  students.forEach(s => {
    const values = [
      escapeCsvValue(s.name),
      escapeCsvValue(s.class),
      escapeCsvValue(s.rollNumber),
      escapeCsvValue(s.parentName),
      escapeCsvValue(s.mobileNumber),
      s.feeAmount.toFixed(2),
      s.dueDate,
      s.feeStatus
    ];
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Parse and validate a CSV string to import students.
 * @param {string} csvText - Raw CSV text
 * @returns {Object} Result summary containing imported records, count, and error reports
 */
export function parseAndImportCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid.');
  }

  // Basic CSV header check (non-strict but checks header existence)
  const header = parseCsvLine(lines[0]);
  const requiredHeaders = ['name', 'class', 'roll', 'parent', 'mobile', 'fee', 'due', 'status'];
  
  const isHeaderValid = requiredHeaders.every(req => 
    header.some(h => h.toLowerCase().includes(req))
  );
  
  if (!isHeaderValid) {
    throw new Error('Invalid CSV format. Headers must include: Name, Class, Roll Number, Parent Name, Mobile Number, Fee Amount, Due Date, Fee Status.');
  }

  const existingStudents = getStudents();
  const newStudents = [...existingStudents];
  let importCount = 0;
  const errors = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    try {
      const columns = parseCsvLine(line);
      if (columns.length < 8) {
        errors.push(`Row ${i + 1}: Insufficient data columns.`);
        continue;
      }

      const name = columns[0].trim();
      const studentClass = columns[1].trim();
      const rollNumber = columns[2].trim();
      const parentName = columns[3].trim();
      const mobileNumber = columns[4].trim();
      const feeAmountRaw = columns[5].trim();
      const dueDate = columns[6].trim();
      const feeStatusRaw = columns[7].trim().toLowerCase();

      // Basic validation
      if (!name || !studentClass || !rollNumber || !parentName || !mobileNumber || !feeAmountRaw || !dueDate || !feeStatusRaw) {
        errors.push(`Row ${i + 1}: Contains empty values.`);
        continue;
      }

      // Roll number duplication check (in import payload and database)
      const isDuplicateInDb = newStudents.some(s => String(s.rollNumber).trim().toLowerCase() === rollNumber.toLowerCase());
      if (isDuplicateInDb) {
        errors.push(`Row ${i + 1}: Duplicate roll number "${rollNumber}" already exists.`);
        continue;
      }

      // Mobile format verification
      if (!/^\d{10}$/.test(mobileNumber)) {
        errors.push(`Row ${i + 1}: Mobile number must be exactly 10 digits.`);
        continue;
      }

      // Fee value validation
      const feeAmount = parseFloat(feeAmountRaw);
      if (isNaN(feeAmount) || feeAmount < 0) {
        errors.push(`Row ${i + 1}: Fee Amount must be a positive number.`);
        continue;
      }

      // Status check
      const feeStatus = (feeStatusRaw.includes('paid') || feeStatusRaw === 'cleared') ? 'paid' : 'unpaid';

      // Due date format check
      if (isNaN(Date.parse(dueDate))) {
        errors.push(`Row ${i + 1}: Invalid date format.`);
        continue;
      }

      const id = 'std_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + i;

      newStudents.push({
        id,
        name,
        class: studentClass,
        rollNumber,
        parentName,
        mobileNumber,
        feeAmount,
        dueDate,
        feeStatus
      });
      importCount++;

    } catch (e) {
      errors.push(`Row ${i + 1}: Failed to parse row. Error: ${e.message}`);
    }
  }

  if (importCount > 0) {
    saveStudents(newStudents);
  }

  return {
    success: importCount > 0,
    count: importCount,
    errors: errors
  };
}

/**
 * Escapes characters for CSV format.
 * @param {string|number} value 
 * @returns {string} Escaped value
 */
function escapeCsvValue(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parse a standard comma-separated line, handling double-quotes.
 * @param {string} line 
 * @returns {Array} List of columns parsed from the line
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
