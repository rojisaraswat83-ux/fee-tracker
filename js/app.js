/**
 * app.js
 * Main Application Orchestrator: manages state, renders views, handles forms, modals, search, and CSV import/export.
 */

import {
  getStudents,
  saveStudent,
  deleteStudent,
  toggleStudentStatus,
  isDuplicateRollNumber,
  exportToCSVString,
  parseAndImportCSV
} from './storage.js';

import {
  showSuccess,
  showError,
  showWarning,
  showInfo
} from './toast.js';

// --- State Management ---
let currentFilter = 'all';
let currentSearchQuery = '';
let currentSort = 'nameAsc';
let studentIdToDelete = null;

// --- DOM Element Cache ---
const elements = {
  // Sidebar
  sidebar: document.getElementById('appSidebar'),
  mobileCloseBtn: document.getElementById('mobileCloseBtn'),
  mobileToggleBtn: document.getElementById('mobileToggleBtn'),
  
  // Date & Time Header
  currentDateTime: document.getElementById('currentDateTime'),
  
  // CSV Import/Export
  importInput: document.getElementById('importCsvInput'),
  importBtn: document.getElementById('importCsvBtn'),
  exportBtn: document.getElementById('exportCsvBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  
  // Statistics Display
  statTotal: document.getElementById('statTotalStudents'),
  statPaid: document.getElementById('statPaidStudents'),
  statUnpaid: document.getElementById('statUnpaidStudents'),
  statCollected: document.getElementById('statTotalCollected'),
  statPending: document.getElementById('statTotalPending'),
  
  // Controls
  searchInput: document.getElementById('studentSearchInput'),
  filterSelect: document.getElementById('statusFilterSelect'),
  sortSelect: document.getElementById('sortBySelect'),
  addBtn: document.getElementById('addStudentBtn'),
  
  // Table & UI Overlay
  tableBody: document.getElementById('studentTableBody'),
  emptyState: document.getElementById('emptyState'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  
  // Add/Edit Modal
  studentModal: document.getElementById('studentModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  modalCancelBtn: document.getElementById('modalCancelBtn'),
  studentForm: document.getElementById('studentForm'),
  
  // Form Inputs
  editId: document.getElementById('editStudentId'),
  inputName: document.getElementById('studentNameInput'),
  inputClass: document.getElementById('studentClassInput'),
  inputRoll: document.getElementById('studentRollInput'),
  inputParent: document.getElementById('parentNameInput'),
  inputMobile: document.getElementById('mobileNumberInput'),
  inputFee: document.getElementById('feeAmountInput'),
  inputDate: document.getElementById('dueDateInput'),
  inputStatus: document.getElementById('feeStatusSelect'),
  
  // Delete Modal
  deleteModal: document.getElementById('deleteConfirmModal'),
  deleteCloseBtn: document.getElementById('deleteModalCloseBtn'),
  deleteCancelBtn: document.getElementById('deleteCancelBtn'),
  deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),
  deleteStudentName: document.getElementById('deleteStudentName')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize light/dark theme preference
  initializeTheme();

  // Update header clock
  updateClock();
  setInterval(updateClock, 60000); // refresh time every minute
  
  // Load database statistics & populate table
  refreshDashboard();
  
  // Register all interactive event listeners
  setupEventListeners();
});

// --- Update Live DateTime ---
function updateClock() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  elements.currentDateTime.textContent = now.toLocaleDateString('en-US', options);
}

// --- Refresh stats & reload table ---
function refreshDashboard() {
  showLoading(true);
  
  // Introduce a slight UI rendering delay for smooth loading transition feel
  setTimeout(() => {
    const students = getStudents();
    updateStats(students);
    renderStudents(students);
    showLoading(false);
  }, 300);
}

// --- Calculate and update stats cards ---
function updateStats(students) {
  const total = students.length;
  const paidCount = students.filter(s => s.feeStatus === 'paid').length;
  const unpaidCount = total - paidCount;
  
  const collected = students
    .filter(s => s.feeStatus === 'paid')
    .reduce((sum, s) => sum + s.feeAmount, 0);
    
  const pending = students
    .filter(s => s.feeStatus === 'unpaid')
    .reduce((sum, s) => sum + s.feeAmount, 0);
    
  elements.statTotal.textContent = total;
  elements.statPaid.textContent = paidCount;
  elements.statUnpaid.textContent = unpaidCount;
  elements.statCollected.textContent = `$${collected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  elements.statPending.textContent = `$${pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Render Table Body ---
function renderStudents(students) {
  // Filter student dataset
  let filtered = students.filter(s => {
    // 1. Status Filter
    if (currentFilter !== 'all' && s.feeStatus !== currentFilter) {
      return false;
    }
    
    // 2. Search query check
    if (currentSearchQuery) {
      const q = currentSearchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchClass = s.class.toLowerCase().includes(q);
      const matchRoll = String(s.rollNumber).toLowerCase().includes(q);
      const matchParent = s.parentName.toLowerCase().includes(q);
      return matchName || matchClass || matchRoll || matchParent;
    }
    
    return true;
  });
  
  // Sort dataset
  filtered.sort((a, b) => {
    if (currentSort === 'nameAsc') {
      return a.name.localeCompare(b.name);
    } else if (currentSort === 'nameDesc') {
      return b.name.localeCompare(a.name);
    } else if (currentSort === 'dueDateAsc') {
      return new Date(a.dueDate) - new Date(b.dueDate);
    } else if (currentSort === 'dueDateDesc') {
      return new Date(b.dueDate) - new Date(a.dueDate);
    }
    return 0;
  });
  
  // Reset table elements
  elements.tableBody.innerHTML = '';
  
  if (filtered.length === 0) {
    elements.emptyState.classList.remove('hidden');
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  
  filtered.forEach(s => {
    const row = document.createElement('tr');
    
    // Format individual parameters
    const formattedFee = `$${s.feeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const formattedDate = formatDateString(s.dueDate);
    const badgeClass = s.feeStatus === 'paid' ? 'badge-paid' : 'badge-unpaid';
    
    row.innerHTML = `
      <td>
        <div class="student-name-cell">${escapeHTML(s.name)}</div>
      </td>
      <td>
        <div class="student-name-cell">${escapeHTML(s.class)}</div>
        <div class="student-subinfo">Roll: ${escapeHTML(s.rollNumber)}</div>
      </td>
      <td>
        <div class="student-name-cell">${escapeHTML(s.parentName)}</div>
        <div class="student-subinfo">${escapeHTML(s.mobileNumber)}</div>
      </td>
      <td class="student-name-cell">${formattedFee}</td>
      <td>${formattedDate}</td>
      <td>
        <span class="badge ${badgeClass}" data-id="${s.id}" data-status="${s.feeStatus}" title="Click to toggle status">
          <span class="badge-dot"></span>
          <span>${s.feeStatus}</span>
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn-table-action edit-btn" data-id="${s.id}" title="Edit Student">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-table-action delete delete-btn" data-id="${s.id}" title="Delete Student">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </td>
    `;
    
    // Toggle Status click handler directly on the status badge
    const badge = row.querySelector('.badge');
    badge.addEventListener('click', () => {
      const currentStatus = badge.getAttribute('data-status');
      const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
      const updated = toggleStudentStatus(s.id, newStatus);
      
      if (updated) {
        showSuccess('Status Updated', `${updated.name}'s fee status changed to ${newStatus.toUpperCase()}`);
        refreshDashboard();
      }
    });

    // Edit button click event
    const editBtn = row.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => {
      openEditModal(s);
    });

    // Delete button click event
    const deleteBtn = row.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      openDeleteModal(s);
    });

    elements.tableBody.appendChild(row);
  });
}

// --- Setting Up Event Listeners ---
function setupEventListeners() {
  // Sidebar responsive toggle
  elements.mobileToggleBtn.addEventListener('click', () => {
    elements.sidebar.classList.add('show');
  });
  
  elements.mobileCloseBtn.addEventListener('click', () => {
    elements.sidebar.classList.remove('show');
  });
  
  // Theme toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

  // Modal togglers
  elements.addBtn.addEventListener('click', openAddModal);
  elements.modalCloseBtn.addEventListener('click', closeStudentModal);
  elements.modalCancelBtn.addEventListener('click', closeStudentModal);
  elements.studentForm.addEventListener('submit', handleFormSubmit);
  
  // Real-time input error removal during focus inputs
  const inputs = [
    elements.inputName, elements.inputClass, elements.inputRoll,
    elements.inputParent, elements.inputMobile, elements.inputFee, elements.inputDate
  ];
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      clearFieldError(input);
    });
  });
  
  elements.inputStatus.addEventListener('change', () => {
    clearFieldError(elements.inputStatus);
  });
  
  // Delete Confirmation Modals
  elements.deleteCloseBtn.addEventListener('click', closeDeleteModal);
  elements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
  elements.deleteConfirmBtn.addEventListener('click', handleStudentDelete);
  
  // Search, Filter, Sort Controls
  elements.searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    const students = getStudents();
    renderStudents(students);
  });
  
  elements.filterSelect.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    const students = getStudents();
    renderStudents(students);
  });
  
  elements.sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    const students = getStudents();
    renderStudents(students);
  });
  
  // CSV Import Elements
  elements.importBtn.addEventListener('click', () => {
    elements.importInput.click();
  });
  
  elements.importInput.addEventListener('change', handleCsvImport);
  
  // CSV Export Elements
  elements.exportBtn.addEventListener('click', handleCsvExport);
}

// --- Loading overlay controller ---
function showLoading(show) {
  if (show) {
    elements.loadingOverlay.classList.remove('hidden');
  } else {
    elements.loadingOverlay.classList.add('hidden');
  }
}

// --- Add/Edit Modal controls ---
function openAddModal() {
  resetForm();
  elements.modalTitle.textContent = 'Add Student Record';
  elements.studentModal.classList.remove('hidden');
  elements.inputName.focus();
}

function openEditModal(student) {
  resetForm();
  elements.modalTitle.textContent = 'Edit Student Record';
  
  // Populate form fields
  elements.editId.value = student.id;
  elements.inputName.value = student.name;
  elements.inputClass.value = student.class;
  elements.inputRoll.value = student.rollNumber;
  elements.inputParent.value = student.parentName;
  elements.inputMobile.value = student.mobileNumber;
  elements.inputFee.value = student.feeAmount;
  elements.inputDate.value = student.dueDate;
  elements.inputStatus.value = student.feeStatus;
  
  elements.studentModal.classList.remove('hidden');
  elements.inputName.focus();
}

function closeStudentModal() {
  elements.studentModal.classList.add('hidden');
  resetForm();
}

function resetForm() {
  elements.studentForm.reset();
  elements.editId.value = '';
  
  // Clear any validation visual indications
  const fields = elements.studentForm.querySelectorAll('.form-field');
  fields.forEach(f => f.classList.remove('invalid'));
}

// --- Form Validation & Submission ---
function handleFormSubmit(e) {
  e.preventDefault();
  
  const isValid = validateStudentForm();
  if (!isValid) {
    showWarning('Validation Error', 'Please check the form inputs for details.');
    return;
  }
  
  const studentData = {
    id: elements.editId.value || null,
    name: elements.inputName.value.trim(),
    class: elements.inputClass.value.trim(),
    rollNumber: parseInt(elements.inputRoll.value.trim(), 10),
    parentName: elements.inputParent.value.trim(),
    mobileNumber: elements.inputMobile.value.trim(),
    feeAmount: parseFloat(elements.inputFee.value.trim()),
    dueDate: elements.inputDate.value,
    feeStatus: elements.inputStatus.value
  };
  
  const saved = saveStudent(studentData);
  
  if (saved) {
    const isEdit = !!elements.editId.value;
    showSuccess(
      isEdit ? 'Record Updated' : 'Record Saved',
      `Student "${saved.name}" has been successfully ${isEdit ? 'updated' : 'added'}.`
    );
    closeStudentModal();
    refreshDashboard();
  } else {
    showError('Save Error', 'Failed to store record.');
  }
}

function validateStudentForm() {
  let isValid = true;
  const editId = elements.editId.value || null;
  
  // 1. Student Name
  if (!elements.inputName.value.trim()) {
    setFieldError(elements.inputName, 'Name is required');
    isValid = false;
  }
  
  // 2. Class
  if (!elements.inputClass.value.trim()) {
    setFieldError(elements.inputClass, 'Class is required');
    isValid = false;
  }
  
  // 3. Roll Number validation
  const rollVal = elements.inputRoll.value.trim();
  if (!rollVal || isNaN(parseInt(rollVal, 10)) || parseInt(rollVal, 10) <= 0) {
    setFieldError(elements.inputRoll, 'A positive roll number is required');
    isValid = false;
  } else if (isDuplicateRollNumber(rollVal, editId)) {
    setFieldError(elements.inputRoll, `Roll number ${rollVal} is already assigned`);
    isValid = false;
  }
  
  // 4. Parent Name
  if (!elements.inputParent.value.trim()) {
    setFieldError(elements.inputParent, "Parent's name is required");
    isValid = false;
  }
  
  // 5. Mobile Number (10 digits check)
  const mobileVal = elements.inputMobile.value.trim();
  if (!mobileVal) {
    setFieldError(elements.inputMobile, 'Mobile number is required');
    isValid = false;
  } else if (!/^\d{10}$/.test(mobileVal)) {
    setFieldError(elements.inputMobile, 'Enter a valid 10-digit mobile number');
    isValid = false;
  }
  
  // 6. Fee Amount
  const feeVal = elements.inputFee.value.trim();
  if (!feeVal || isNaN(parseFloat(feeVal)) || parseFloat(feeVal) < 0) {
    setFieldError(elements.inputFee, 'Fee must be a valid positive amount');
    isValid = false;
  }
  
  // 7. Due Date
  if (!elements.inputDate.value) {
    setFieldError(elements.inputDate, 'Due date is required');
    isValid = false;
  }
  
  return isValid;
}

function setFieldError(inputEl, message) {
  const formField = inputEl.closest('.form-field');
  if (formField) {
    formField.classList.add('invalid');
    const errorMsgSpan = formField.querySelector('.error-msg');
    if (errorMsgSpan) {
      errorMsgSpan.textContent = message;
    }
  }
}

function clearFieldError(inputEl) {
  const formField = inputEl.closest('.form-field');
  if (formField) {
    formField.classList.remove('invalid');
  }
}

// --- Delete Dialog Modal controls ---
function openDeleteModal(student) {
  studentIdToDelete = student.id;
  elements.deleteStudentName.textContent = student.name;
  elements.deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  elements.deleteModal.classList.add('hidden');
  studentIdToDelete = null;
}

function handleStudentDelete() {
  if (!studentIdToDelete) return;
  
  const success = deleteStudent(studentIdToDelete);
  if (success) {
    showSuccess('Record Deleted', 'The student record has been deleted permanently.');
    closeDeleteModal();
    refreshDashboard();
  } else {
    showError('Delete Failed', 'Student record could not be found.');
  }
}

// --- CSV Export Action ---
function handleCsvExport() {
  const students = getStudents();
  if (students.length === 0) {
    showWarning('Export Error', 'There is no student data to export.');
    return;
  }
  
  try {
    const csvContent = exportToCSVString();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `edufee_students_export_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('Export Successful', 'Student CSV database file downloaded.');
  } catch (e) {
    showError('Export Failed', 'An error occurred during export processing.');
  }
}

// --- CSV Import Action ---
function handleCsvImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  showLoading(true);
  const reader = new FileReader();
  
  reader.onload = (event) => {
    try {
      const csvText = event.target.result;
      const result = parseAndImportCSV(csvText);
      
      showLoading(false);
      
      if (result.success) {
        showSuccess('Import Completed', `${result.count} student record(s) loaded.`);
        refreshDashboard();
      }
      
      if (result.errors.length > 0) {
        // Log errors to console and show warning toast
        console.warn('CSV Import Warnings:', result.errors);
        
        // Render detailed import logs inside a toast alert
        const errorSummary = result.errors.slice(0, 3).join(', ');
        const suffix = result.errors.length > 3 ? ` ...and ${result.errors.length - 3} more errors.` : '';
        showWarning('Import Log Warnings', `${result.errors.length} records skipped: ${errorSummary}${suffix}`);
      }
    } catch (err) {
      showLoading(false);
      showError('Import Failed', err.message);
    } finally {
      // Clear input value so same file can be imported again if needed
      elements.importInput.value = '';
    }
  };
  
  reader.onerror = () => {
    showLoading(false);
    showError('Read Error', 'Could not open CSV file.');
    elements.importInput.value = '';
  };
  
  reader.readAsText(file);
}

// --- String Helper Functions ---
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function formatDateString(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// --- Theme (Light/Dark Mode) Helpers ---
function initializeTheme() {
  const savedTheme = localStorage.getItem('edufee_theme') || 'light';
  const sunIcon = elements.themeToggleBtn.querySelector('.theme-sun');
  const moonIcon = elements.themeToggleBtn.querySelector('.theme-moon');

  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  } else {
    document.body.classList.remove('dark-theme');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
}

function toggleTheme() {
  const body = document.body;
  const sunIcon = elements.themeToggleBtn.querySelector('.theme-sun');
  const moonIcon = elements.themeToggleBtn.querySelector('.theme-moon');
  const isDarkMode = body.classList.toggle('dark-theme');

  if (isDarkMode) {
    localStorage.setItem('edufee_theme', 'dark');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
    showInfo('Dark Mode Enabled', 'Theme switched to dark color palette.');
  } else {
    localStorage.setItem('edufee_theme', 'light');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
    showInfo('Light Mode Enabled', 'Theme switched to light color palette.');
  }
}
