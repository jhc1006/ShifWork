// ShiftWork - Core Application Logic

// -------------------------------------------------------------
// 1. STATE MANAGEMENT & DUMMY DATA INITIALIZATION
// -------------------------------------------------------------
const SHIFT_SEQUENCE = ['A', 'B', 'C', 'OFF'];

let state = {
  employees: [],
  attendance: {},
  settings: {
    refDate: '2026-08-01',
    initialShifts: {
      '1조': 'OFF',
      '2조': 'A',
      '3조': 'B',
      '4조': 'C'
    }
  },
  overrides: {}
};

// Dummy Data to populate on first load
const INITIAL_DUMMY_EMPLOYEES = [
  { id: 'emp_1', name: '김철수', team: '1조' },
  { id: 'emp_2', name: '이영희', team: '1조' },
  { id: 'emp_3', name: '박민수', team: '2조' },
  { id: 'emp_4', name: '최지우', team: '2조' },
  { id: 'emp_5', name: '정우성', team: '3조' },
  { id: 'emp_6', name: '한효주', team: '3조' },
  { id: 'emp_7', name: '강동원', team: '4조' },
  { id: 'emp_8', name: '송혜교', team: '4조' },
  { id: 'emp_9', name: '홍길동', team: '통상조' },
  { id: 'emp_10', name: '성춘향', team: '통상조' }
];

function initLocalStorage() {
  const savedState = localStorage.getItem('shiftwork_state');
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      // Ensure all keys are initialized
      if (!state.employees) state.employees = [];
      if (!state.attendance) state.attendance = {};
      if (!state.settings) state.settings = { refDate: '2026-08-01', initialShifts: { '1조': 'OFF', '2조': 'A', '3조': 'B', '4조': 'C' } };
      if (!state.overrides) state.overrides = {};
    } catch (e) {
      console.error('Failed to parse saved state, resetting to default.', e);
      loadDummyData();
    }
  } else {
    loadDummyData();
  }
}

function loadDummyData() {
  state.employees = [...INITIAL_DUMMY_EMPLOYEES];
  state.attendance = {};
  state.overrides = {};
  state.settings = {
    refDate: '2026-08-01',
    initialShifts: {
      '1조': 'OFF',
      '2조': 'A',
      '3조': 'B',
      '4조': 'C'
    }
  };
  
  // Populate some dummy attendance data for August 2026
  const todayStr = '2026-08-19';
  state.attendance[todayStr] = {
    'emp_1': 'WORK',
    'emp_2': 'WORK',
    'emp_3': 'LATE',
    'emp_4': 'WORK',
    'emp_5': 'LEAVE',
    'emp_9': 'WORK',
    'emp_10': 'ABSENT'
  };
  
  saveToLocalStorage();
}

function saveToLocalStorage() {
  localStorage.setItem('shiftwork_state', JSON.stringify(state));
}

// -------------------------------------------------------------
// 2. DATE & SHIFT CALCULATION UTILITIES
// -------------------------------------------------------------
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysBetween(date1, date2) {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getShiftForTeam(team, date) {
  const dateStr = formatDate(date);
  
  // 1. Check if there's a manual schedule override for this day
  if (state.overrides[dateStr] && state.overrides[dateStr][team]) {
    const overrideVal = state.overrides[dateStr][team];
    if (overrideVal !== 'AUTO') {
      return overrideVal;
    }
  }

  // 2. If Regular Team (통상조), flat schedule (REG on weekday, OFF on weekend)
  if (team === '통상조') {
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'OFF';
    }
    return 'REG';
  }

  // 3. Rotating shifts for Teams 1, 2, 3, 4
  const refDateStr = state.settings.refDate;
  const initialShift = state.settings.initialShifts[team] || 'OFF';
  
  const diffDays = getDaysBetween(refDateStr, dateStr);
  const initialIndex = SHIFT_SEQUENCE.indexOf(initialShift);
  
  // Mathematical modulo to handle past/future dates correctly
  const sequenceIndex = ((initialIndex + diffDays) % 4 + 4) % 4;
  return SHIFT_SEQUENCE[sequenceIndex];
}

// -------------------------------------------------------------
// 3. NAVIGATION & VIEW ROUTING
// -------------------------------------------------------------
let currentView = 'dashboard';
let calendarSelectedDate = new Date(); // Stores the current month being viewed in the calendar
let todayDate = new Date(2026, 7, 19); // Lock current date to Aug 19, 2026 as per user metadata

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // Quick Action Header button
  document.getElementById('quick-add-btn').addEventListener('click', () => {
    openEmployeeModal();
  });
}

function switchView(viewName) {
  currentView = viewName;
  
  // Toggle Active Nav Link
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Toggle Active Section
  document.querySelectorAll('.view-section').forEach(section => {
    if (section.id === `view-${viewName}`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // Update Header details
  const titleEl = document.getElementById('view-title');
  const subtitleEl = document.getElementById('view-subtitle');
  
  if (viewName === 'dashboard') {
    titleEl.textContent = '대시보드';
    subtitleEl.textContent = '오늘의 근무 현황과 교대 스케줄을 확인합니다.';
    renderDashboard();
  } else if (viewName === 'calendar') {
    titleEl.textContent = '근무 스케줄';
    subtitleEl.textContent = '달력형 스케줄러에서 일별 근무조 편성 및 근태를 관리합니다.';
    renderCalendar();
  } else if (viewName === 'members') {
    titleEl.textContent = '사원 관리';
    subtitleEl.textContent = '소속 사원을 관리하고 근무조 배치 현황을 확인합니다.';
    renderMembers();
  } else if (viewName === 'statistics') {
    titleEl.textContent = '근태 통계';
    subtitleEl.textContent = '월별 근태 지표 분석 및 상세 내역을 제공합니다.';
    renderStatistics();
  } else if (viewName === 'settings') {
    titleEl.textContent = '설정 및 백업';
    subtitleEl.textContent = '교대 스케줄 회전 기준을 맞춤 설정하고 데이터를 관리합니다.';
    renderSettings();
  }

  // Refresh lucide icons
  lucide.createIcons();
}

// -------------------------------------------------------------
// 4. DASHBOARD RENDERER
// -------------------------------------------------------------
function renderDashboard() {
  const dateStr = formatDate(todayDate);
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('dash-date').textContent = todayDate.toLocaleDateString('ko-KR', options);
  
  // 1. Calculate active workers, absences, and total
  const todayAtt = state.attendance[dateStr] || {};
  let workingCount = 0;
  let absentCount = 0;
  
  state.employees.forEach(emp => {
    const shift = getShiftForTeam(emp.team, todayDate);
    const savedStatus = todayAtt[emp.id];
    
    // Determine default status if not recorded
    const isWorkingShift = (shift === 'A' || shift === 'B' || shift === 'C' || shift === 'REG');
    const status = savedStatus || (isWorkingShift ? 'WORK' : 'OFF');
    
    if (status === 'WORK' || status === 'LATE' || status === 'EARLY') {
      workingCount++;
    } else if (status === 'ABSENT' || status === 'LEAVE') {
      absentCount++;
    }
  });

  document.getElementById('dash-working-count').textContent = `${workingCount}명`;
  document.getElementById('dash-absent-count').textContent = `${absentCount}명`;
  document.getElementById('dash-total-members').textContent = `${state.employees.length}명`;

  // 2. Render Today's Shifts Boxes
  const shiftBoxesContainer = document.getElementById('dash-shift-boxes');
  shiftBoxesContainer.innerHTML = '';

  const teams = ['통상조', '1조', '2조', '3조', '4조'];
  
  teams.forEach(team => {
    const shift = getShiftForTeam(team, todayDate);
    
    // Get employees in this team
    const teamMembers = state.employees.filter(e => e.team === team);
    let membersText = '';
    
    if (teamMembers.length === 0) {
      membersText = '<span style="color: var(--text-muted)">배치된 사원 없음</span>';
    } else {
      membersText = teamMembers.map(emp => {
        const savedStatus = todayAtt[emp.id];
        const isWorkingShift = (shift === 'A' || shift === 'B' || shift === 'C' || shift === 'REG');
        const status = savedStatus || (isWorkingShift ? 'WORK' : 'OFF');
        
        let statusBadge = '';
        if (status === 'LATE') statusBadge = ' (지각)';
        if (status === 'EARLY') statusBadge = ' (조퇴)';
        if (status === 'LEAVE') statusBadge = ' (휴가)';
        if (status === 'ABSENT') statusBadge = ' (결근)';
        
        const style = (status === 'ABSENT' || status === 'LEAVE') ? 'text-decoration: line-through; opacity: 0.5;' : '';
        return `<span style="${style}">${emp.name}${statusBadge}</span>`;
      }).join(', ');
    }

    let badgeClass = 'badge-off';
    let badgeText = '휴무조';
    
    if (shift === 'A') { badgeClass = 'badge-a'; badgeText = 'A조 (주간)'; }
    else if (shift === 'B') { badgeClass = 'badge-b'; badgeText = 'B조 (오후)'; }
    else if (shift === 'C') { badgeClass = 'badge-c'; badgeText = 'C조 (야간)'; }
    else if (shift === 'REG') { badgeClass = 'badge-reg'; badgeText = '통상 근무'; }

    const box = document.createElement('div');
    box.className = 'shift-status-box';
    box.innerHTML = `
      <span class="shift-box-title">${team}</span>
      <span class="badge ${badgeClass}">${badgeText}</span>
      <div class="shift-box-members">${membersText}</div>
    `;
    shiftBoxesContainer.appendChild(box);
  });

  // 3. Attendance distribution summary
  let totalWork = 0, totalLate = 0, totalLeave = 0, totalAbsent = 0;
  
  state.employees.forEach(emp => {
    const shift = getShiftForTeam(emp.team, todayDate);
    const savedStatus = todayAtt[emp.id];
    const isWorkingShift = (shift === 'A' || shift === 'B' || shift === 'C' || shift === 'REG');
    const status = savedStatus || (isWorkingShift ? 'WORK' : 'OFF');
    
    if (status === 'WORK') totalWork++;
    else if (status === 'LATE') totalLate++;
    else if (status === 'LEAVE') totalLeave++;
    else if (status === 'ABSENT' || status === 'EARLY') totalAbsent++; // Grouping early out/absence
  });

  document.getElementById('dash-att-work').textContent = totalWork;
  document.getElementById('dash-att-late').textContent = totalLate;
  document.getElementById('dash-att-leave').textContent = totalLeave;
  document.getElementById('dash-att-absent').textContent = totalAbsent;
}

// -------------------------------------------------------------
// 5. CALENDAR GENERATOR
// -------------------------------------------------------------
function renderCalendar() {
  const container = document.getElementById('calendar-days-container');
  container.innerHTML = '';
  
  const year = calendarSelectedDate.getFullYear();
  const month = calendarSelectedDate.getMonth();
  
  // Set month title
  document.getElementById('cal-month-title').textContent = `${year}년 ${month + 1}월`;
  
  // Get first day of the month and total days
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  
  // Render days from previous month to fill the first row
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, prevMonthTotalDays - i);
    renderDayCell(prevDate, true, container);
  }
  
  // Render current month days
  for (let i = 1; i <= totalDays; i++) {
    const currDate = new Date(year, month, i);
    renderDayCell(currDate, false, container);
  }
  
  // Render days from next month to complete the grid (multiples of 7)
  const totalCells = firstDayIndex + totalDays;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const nextDate = new Date(year, month + 1, i);
    renderDayCell(nextDate, true, container);
  }
}

function renderDayCell(date, isOtherMonth, container) {
  const dateStr = formatDate(date);
  const dayCell = document.createElement('div');
  dayCell.className = `calendar-day ${isOtherMonth ? 'other-month' : ''}`;
  
  // Mark today
  if (formatDate(todayDate) === dateStr) {
    dayCell.classList.add('today');
  }

  // Header row of cell (Day number)
  const headerRow = document.createElement('div');
  headerRow.className = 'day-number-row';
  headerRow.innerHTML = `<span class="day-num">${date.getDate()}</span>`;
  dayCell.appendChild(headerRow);

  // Teams scheduled to work this day (A, B, C, REG)
  const previewDiv = document.createElement('div');
  previewDiv.className = 'day-shifts-preview';
  
  const teams = ['1조', '2조', '3조', '4조'];
  let workingShiftCount = 0;
  
  teams.forEach(team => {
    const shift = getShiftForTeam(team, date);
    if (shift !== 'OFF') {
      workingShiftCount++;
      let badgeClass = 'badge-a';
      if (shift === 'B') badgeClass = 'badge-b';
      if (shift === 'C') badgeClass = 'badge-c';
      
      const row = document.createElement('div');
      row.className = 'day-shift-preview-row';
      row.innerHTML = `
        <span class="day-shift-label">${team}</span>
        <span class="badge ${badgeClass}" style="font-size: 8px; padding: 1px 3px;">${shift}</span>
      `;
      previewDiv.appendChild(row);
    }
  });

  // Regular team row
  const regShift = getShiftForTeam('통상조', date);
  if (regShift === 'REG') {
    const row = document.createElement('div');
    row.className = 'day-shift-preview-row';
    row.innerHTML = `
      <span class="day-shift-label">통상</span>
      <span class="badge badge-reg" style="font-size: 8px; padding: 1px 3px;">통</span>
    `;
    previewDiv.appendChild(row);
  }
  
  dayCell.appendChild(previewDiv);

  // Bottom row: attendance indicator dots
  const attendanceDots = document.createElement('div');
  attendanceDots.className = 'day-attendance-dots';
  
  const dayAtt = state.attendance[dateStr] || {};
  let numDots = 0;
  
  Object.values(dayAtt).forEach(status => {
    if (status && status !== 'WORK' && status !== 'OFF') {
      let color = 'var(--text-muted)';
      if (status === 'LATE') color = 'var(--att-late-color)';
      if (status === 'EARLY') color = 'var(--att-early-color)';
      if (status === 'LEAVE') color = 'var(--att-leave-color)';
      if (status === 'ABSENT') color = 'var(--att-absent-color)';
      
      if (numDots < 5) { // Cap at 5 dots
        attendanceDots.innerHTML += `<span class="attendance-dot" style="background-color: ${color}"></span>`;
        numDots++;
      }
    }
  });

  if (numDots > 0) {
    dayCell.appendChild(attendanceDots);
  }

  // Click handler to open details
  dayCell.addEventListener('click', () => {
    openDailyModal(date);
  });

  container.appendChild(dayCell);
}

function setupCalendarControls() {
  document.getElementById('cal-prev-month').addEventListener('click', () => {
    calendarSelectedDate.setMonth(calendarSelectedDate.getMonth() - 1);
    renderCalendar();
  });
  
  document.getElementById('cal-next-month').addEventListener('click', () => {
    calendarSelectedDate.setMonth(calendarSelectedDate.getMonth() + 1);
    renderCalendar();
  });
  
  document.getElementById('cal-today').addEventListener('click', () => {
    calendarSelectedDate = new Date(todayDate);
    renderCalendar();
  });
}

// -------------------------------------------------------------
// 6. EMPLOYEE MANAGEMENT (CRUD)
// -------------------------------------------------------------
let memberSearchQuery = '';

function renderMembers() {
  const tbody = document.getElementById('member-table-body');
  tbody.innerHTML = '';
  
  const searchLower = memberSearchQuery.toLowerCase();
  
  // Filter employees
  const filtered = state.employees.filter(emp => {
    return emp.name.toLowerCase().includes(searchLower) || 
           emp.team.toLowerCase().includes(searchLower);
  });

  // Calculate current month statistics
  const year = todayDate.getFullYear();
  const month = todayDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
          검색된 결과가 없거나 등록된 사원이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(emp => {
    // Count stats for current month
    let workDays = 0;
    let lateCount = 0;
    let leaveCount = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);
      const shift = getShiftForTeam(emp.team, date);
      const savedStatus = state.attendance[dateStr]?.[emp.id];
      
      const isWorkingShift = (shift === 'A' || shift === 'B' || shift === 'C' || shift === 'REG');
      const status = savedStatus || (isWorkingShift ? 'WORK' : 'OFF');
      
      if (status === 'WORK' || status === 'LATE' || status === 'EARLY') {
        workDays++;
      }
      if (status === 'LATE') {
        lateCount++;
      }
      if (status === 'LEAVE') {
        leaveCount++;
      }
    }

    const firstChar = emp.name.charAt(0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center;">
          <div class="avatar">${firstChar}</div>
          <span style="font-weight: 600;">${emp.name}</span>
        </div>
      </td>
      <td>
        <span class="badge ${emp.team === '통상조' ? 'badge-reg' : 'badge-a'}">${emp.team}</span>
      </td>
      <td><strong>${workDays}일</strong> / ${daysInMonth}일</td>
      <td style="color: ${lateCount > 0 ? 'var(--att-late-color)' : 'inherit'}; font-weight: ${lateCount > 0 ? '600' : 'normal'};">${lateCount}회</td>
      <td style="color: ${leaveCount > 0 ? 'var(--att-leave-color)' : 'inherit'};">${leaveCount}일</td>
      <td>
        <div class="action-buttons" style="justify-content: center;">
          <button class="action-btn edit" title="수정" onclick="openEmployeeModal('${emp.id}')">
            <i data-lucide="edit-3" width="16" height="16"></i>
          </button>
          <button class="action-btn delete" title="삭제" onclick="deleteEmployee('${emp.id}')">
            <i data-lucide="trash" width="16" height="16"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function setupMembersControls() {
  document.getElementById('member-search').addEventListener('input', (e) => {
    memberSearchQuery = e.target.value;
    renderMembers();
  });

  document.getElementById('add-member-btn').addEventListener('click', () => {
    openEmployeeModal();
  });
}

// Open Add/Edit Employee Modal
window.openEmployeeModal = function(id = '') {
  const modal = document.getElementById('modal-employee');
  const title = document.getElementById('employee-modal-title');
  const idInput = document.getElementById('employee-id-input');
  const nameInput = document.getElementById('employee-name-input');
  const teamInput = document.getElementById('employee-team-input');
  
  if (id) {
    // Edit Mode
    const emp = state.employees.find(e => e.id === id);
    if (!emp) return;
    title.textContent = '사원 정보 수정';
    idInput.value = emp.id;
    nameInput.value = emp.name;
    teamInput.value = emp.team;
  } else {
    // Add Mode
    title.textContent = '신규 사원 등록';
    idInput.value = '';
    nameInput.value = '';
    teamInput.value = '통상조';
  }
  
  modal.classList.add('active');
  lucide.createIcons();
};

window.deleteEmployee = function(id) {
  const emp = state.employees.find(e => e.id === id);
  if (!emp) return;
  
  if (confirm(`정말로 ${emp.name} 사원을 삭제하시겠습니까?\n해당 사원의 근태 기록도 삭제됩니다.`)) {
    // Delete employee
    state.employees = state.employees.filter(e => e.id !== id);
    
    // Clean attendance entries
    Object.keys(state.attendance).forEach(dateStr => {
      if (state.attendance[dateStr] && state.attendance[dateStr][id]) {
        delete state.attendance[dateStr][id];
      }
    });
    
    saveToLocalStorage();
    renderMembers();
    // If we're on dashboard, render that too
    if (currentView === 'dashboard') renderDashboard();
  }
};

function setupEmployeeSave() {
  document.getElementById('employee-save-btn').addEventListener('click', () => {
    const id = document.getElementById('employee-id-input').value;
    const name = document.getElementById('employee-name-input').value.trim();
    const team = document.getElementById('employee-team-input').value;
    
    if (!name) {
      alert('이름을 입력해주세요.');
      return;
    }
    
    if (id) {
      // Edit existing
      const emp = state.employees.find(e => e.id === id);
      if (emp) {
        emp.name = name;
        emp.team = team;
      }
    } else {
      // Create new
      const newId = 'emp_' + Date.now();
      state.employees.push({
        id: newId,
        name: name,
        team: team
      });
    }
    
    saveToLocalStorage();
    closeModal('modal-employee');
    
    if (currentView === 'members') renderMembers();
    if (currentView === 'dashboard') renderDashboard();
  });
}

// -------------------------------------------------------------
// 7. DAILY DETAIL MODAL (ATTENDANCE & SHIFT OVERRIDE)
// -------------------------------------------------------------
let dailyModalDate = new Date();
let dailyActiveTab = 'attendance'; // 'attendance' or 'override'

function openDailyModal(date) {
  dailyModalDate = date;
  const dateStr = formatDate(date);
  
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('daily-modal-title').textContent = `${date.toLocaleDateString('ko-KR', options)}`;
  
  // Set tab states
  setDailyModalTab('attendance');
  
  // Populate Attendance Tab
  populateDailyAttendanceTab();
  
  // Populate Override Tab
  populateDailyOverrideTab();
  
  document.getElementById('modal-daily').classList.add('active');
  lucide.createIcons();
}

function setDailyModalTab(tabName) {
  dailyActiveTab = tabName;
  const btnAtt = document.getElementById('tab-daily-attendance');
  const btnOver = document.getElementById('tab-daily-override');
  const divAtt = document.getElementById('modal-tab-attendance');
  const divOver = document.getElementById('modal-tab-override');
  
  if (tabName === 'attendance') {
    btnAtt.style.color = 'var(--color-primary)';
    btnAtt.style.borderBottomColor = 'var(--color-primary)';
    btnOver.style.color = 'var(--text-secondary)';
    btnOver.style.borderBottomColor = 'transparent';
    
    divAtt.style.display = 'block';
    divOver.style.display = 'none';
  } else {
    btnOver.style.color = 'var(--color-primary)';
    btnOver.style.borderBottomColor = 'var(--color-primary)';
    btnAtt.style.color = 'var(--text-secondary)';
    btnAtt.style.borderBottomColor = 'transparent';
    
    divAtt.style.display = 'none';
    divOver.style.display = 'block';
  }
}

function populateDailyAttendanceTab() {
  const container = document.getElementById('daily-attendance-list');
  const noMembersMsg = document.getElementById('daily-no-members-msg');
  container.innerHTML = '';
  
  if (state.employees.length === 0) {
    noMembersMsg.style.display = 'block';
    return;
  }
  noMembersMsg.style.display = 'none';

  const dateStr = formatDate(dailyModalDate);
  const todayAtt = state.attendance[dateStr] || {};

  // Sort employees by team for easier reading
  const sortedEmployees = [...state.employees].sort((a, b) => a.team.localeCompare(b.team));

  sortedEmployees.forEach(emp => {
    const shift = getShiftForTeam(emp.team, dailyModalDate);
    const savedStatus = todayAtt[emp.id];
    
    // Default attendance status logic
    const isWorkingShift = (shift === 'A' || shift === 'B' || shift === 'C' || shift === 'REG');
    const status = savedStatus || (isWorkingShift ? 'WORK' : 'OFF');

    let badgeClass = 'badge-off';
    let badgeText = '휴무';
    if (shift === 'A') { badgeClass = 'badge-a'; badgeText = 'A조'; }
    else if (shift === 'B') { badgeClass = 'badge-b'; badgeText = 'B조'; }
    else if (shift === 'C') { badgeClass = 'badge-c'; badgeText = 'C조'; }
    else if (shift === 'REG') { badgeClass = 'badge-reg'; badgeText = '통상'; }

    const row = document.createElement('div');
    row.className = 'att-employee-row';
    row.innerHTML = `
      <div class="att-employee-info">
        <div style="display: flex; flex-direction: column;">
          <span class="att-employee-name">${emp.name}</span>
          <span class="att-employee-team">${emp.team}</span>
        </div>
      </div>
      <div>
        <span class="badge ${badgeClass}" style="font-size: 11px;">${badgeText} 근무</span>
      </div>
      <div>
        <select class="att-status-select" data-emp-id="${emp.id}">
          <option value="WORK" ${status === 'WORK' ? 'selected' : ''}>출근</option>
          <option value="LATE" ${status === 'LATE' ? 'selected' : ''}>지각</option>
          <option value="EARLY" ${status === 'EARLY' ? 'selected' : ''}>조퇴</option>
          <option value="LEAVE" ${status === 'LEAVE' ? 'selected' : ''}>휴가</option>
          <option value="ABSENT" ${status === 'ABSENT' ? 'selected' : ''}>결근</option>
          <option value="OFF" ${status === 'OFF' ? 'selected' : ''}>휴무</option>
        </select>
      </div>
    `;
    container.appendChild(row);
  });
}

function populateDailyOverrideTab() {
  const dateStr = formatDate(dailyModalDate);
  const overrides = state.overrides[dateStr] || {};
  
  document.getElementById('override-team1').value = overrides['1조'] || 'AUTO';
  document.getElementById('override-team2').value = overrides['2조'] || 'AUTO';
  document.getElementById('override-team3').value = overrides['3조'] || 'AUTO';
  document.getElementById('override-team4').value = overrides['4조'] || 'AUTO';
  document.getElementById('override-teamreg').value = overrides['통상조'] || 'AUTO';
}

function saveDailyModal() {
  const dateStr = formatDate(dailyModalDate);
  
  // 1. Save Shift Overrides
  const override1 = document.getElementById('override-team1').value;
  const override2 = document.getElementById('override-team2').value;
  const override3 = document.getElementById('override-team3').value;
  const override4 = document.getElementById('override-team4').value;
  const overrideReg = document.getElementById('override-teamreg').value;
  
  if (override1 !== 'AUTO' || override2 !== 'AUTO' || override3 !== 'AUTO' || override4 !== 'AUTO' || overrideReg !== 'AUTO') {
    if (!state.overrides[dateStr]) state.overrides[dateStr] = {};
    
    state.overrides[dateStr]['1조'] = override1;
    state.overrides[dateStr]['2조'] = override2;
    state.overrides[dateStr]['3조'] = override3;
    state.overrides[dateStr]['4조'] = override4;
    state.overrides[dateStr]['통상조'] = overrideReg;
  } else {
    // If all are AUTO, clean up key
    if (state.overrides[dateStr]) {
      delete state.overrides[dateStr];
    }
  }

  // 2. Save Attendance Status
  const selectElements = document.querySelectorAll('.att-status-select');
  if (selectElements.length > 0) {
    if (!state.attendance[dateStr]) state.attendance[dateStr] = {};
    
    selectElements.forEach(select => {
      const empId = select.getAttribute('data-emp-id');
      const status = select.value;
      state.attendance[dateStr][empId] = status;
    });
  }
  
  saveToLocalStorage();
  closeModal('modal-daily');
  
  // Rerender active view
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'members') renderMembers();
}

function setupDailyModalControls() {
  document.getElementById('tab-daily-attendance').addEventListener('click', () => {
    setDailyModalTab('attendance');
  });
  
  document.getElementById('tab-daily-override').addEventListener('click', () => {
    setDailyModalTab('override');
  });
  
  document.getElementById('daily-save-btn').addEventListener('click', () => {
    saveDailyModal();
  });
}

// -------------------------------------------------------------
// 8. STATISTICS GENERATOR
// -------------------------------------------------------------
function setupStatistics() {
  const select = document.getElementById('stats-month-picker');
  select.innerHTML = '';
  
  // Generate options for last 6 months + next 6 months
  const now = new Date(todayDate);
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  
  for (let i = 0; i < 12; i++) {
    const item = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const val = `${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, '0')}`;
    const optionText = `${item.getFullYear()}년 ${item.getMonth() + 1}월`;
    
    const option = document.createElement('option');
    option.value = val;
    option.textContent = optionText;
    
    // Select current month by default
    if (item.getFullYear() === now.getFullYear() && item.getMonth() === now.getMonth()) {
      option.selected = true;
    }
    
    select.appendChild(option);
  }
  
  select.addEventListener('change', () => {
    renderStatistics();
  });

  document.getElementById('stats-export-btn').addEventListener('click', () => {
    exportToCSV();
  });
}

function renderStatistics() {
  const pickerVal = document.getElementById('stats-month-picker').value;
  if (!pickerVal) return;
  
  const [year, month] = pickerVal.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 1. Calculate Statistics for each employee
  const employeeStats = [];
  let totalWorks = 0, totalLates = 0, totalLeaves = 0, totalAbsents = 0, totalEarlies = 0;
  const crewWorks = { '1조': 0, '2조': 0, '3조': 0, '4조': 0, '통상조': 0 };

  state.employees.forEach(emp => {
    let wCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let earlyCount = 0;
    let absentCount = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = formatDate(date);
      
      const shift = getShiftForTeam(emp.team, date);
      const savedStatus = state.attendance[dateStr]?.[emp.id];
      const isWorkingShift = (shift === 'A' || shift === 'B' || shift === 'C' || shift === 'REG');
      const status = savedStatus || (isWorkingShift ? 'WORK' : 'OFF');
      
      if (status === 'WORK') {
        wCount++;
        crewWorks[emp.team]++;
      } else if (status === 'LATE') {
        lateCount++;
        wCount++;
        crewWorks[emp.team]++;
      } else if (status === 'EARLY') {
        earlyCount++;
        wCount++;
        crewWorks[emp.team]++;
      } else if (status === 'LEAVE') {
        leaveCount++;
      } else if (status === 'ABSENT') {
        absentCount++;
      }
    }
    
    employeeStats.push({
      name: emp.name,
      team: emp.team,
      work: wCount,
      late: lateCount,
      leave: leaveCount,
      early: earlyCount,
      absent: absentCount
    });

    totalWorks += wCount;
    totalLates += lateCount;
    totalLeaves += leaveCount;
    totalAbsents += absentCount;
    totalEarlies += earlyCount;
  });

  // 2. Render Statistics detailed table
  const tbody = document.getElementById('stats-table-body');
  tbody.innerHTML = '';

  if (employeeStats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
          사원 정보가 없습니다.
        </td>
      </tr>
    `;
  } else {
    employeeStats.forEach(stat => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${stat.name}</strong></td>
        <td><span class="badge ${stat.team === '통상조' ? 'badge-reg' : 'badge-a'}">${stat.team}</span></td>
        <td style="font-weight: 600; color: var(--att-work-color);">${stat.work}일</td>
        <td style="color: ${stat.late > 0 ? 'var(--att-late-color)' : 'inherit'}; font-weight: ${stat.late > 0 ? '600' : 'normal'};">${stat.late}회</td>
        <td style="color: ${stat.leave > 0 ? 'var(--att-leave-color)' : 'inherit'};">${stat.leave}일</td>
        <td style="color: ${stat.early > 0 ? 'var(--att-early-color)' : 'inherit'};">${stat.early}회</td>
        <td style="color: ${stat.absent > 0 ? 'var(--att-absent-color)' : 'inherit'}; font-weight: ${stat.absent > 0 ? '600' : 'normal'};">${stat.absent}일</td>
        <td><strong>${stat.work + stat.leave}일</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 3. Render Visual charts
  // Crew workload bar chart
  const crewContainer = document.getElementById('chart-crew-workload');
  crewContainer.innerHTML = '';
  
  // Find max crew workload to set scale
  const maxCrewWork = Math.max(...Object.values(crewWorks), 1);

  Object.entries(crewWorks).forEach(([crew, count]) => {
    const percentage = Math.min((count / maxCrewWork) * 100, 100);
    const item = document.createElement('div');
    item.className = 'chart-bar-item';
    item.innerHTML = `
      <div class="chart-bar-label-row">
        <span class="chart-bar-label">${crew}</span>
        <span class="chart-bar-value">${count} Man-Day</span>
      </div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${percentage}%;"></div>
      </div>
    `;
    crewContainer.appendChild(item);
  });

  // Attendance distributions
  const ratesContainer = document.getElementById('chart-attendance-rates');
  ratesContainer.innerHTML = '';
  
  const totalAttEntries = totalWorks + totalLates + totalLeaves + totalAbsents + totalEarlies || 1;
  const metrics = [
    { label: '정상 출근', count: totalWorks - totalLates - totalEarlies, color: 'var(--shift-b-color)' },
    { label: '지각', count: totalLates, color: 'var(--att-late-color)' },
    { label: '조퇴', count: totalEarlies, color: 'var(--att-early-color)' },
    { label: '휴가', count: totalLeaves, color: 'var(--att-leave-color)' },
    { label: '결근', count: totalAbsents, color: 'var(--att-absent-color)' }
  ];

  metrics.forEach(m => {
    const percentage = Math.min((m.count / totalAttEntries) * 100, 100);
    const item = document.createElement('div');
    item.className = 'chart-bar-item';
    item.innerHTML = `
      <div class="chart-bar-label-row">
        <span class="chart-bar-label">${m.label}</span>
        <span class="chart-bar-value">${m.count}건 (${percentage.toFixed(1)}%)</span>
      </div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${percentage}%; background: ${m.color};"></div>
      </div>
    `;
    ratesContainer.appendChild(item);
  });
}

function exportToCSV() {
  const pickerVal = document.getElementById('stats-month-picker').value;
  const [year, month] = pickerVal.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "사원명,근무조,출근일수,지각횟수,휴가일수,조퇴횟수,결근일수,합계\n";

  state.employees.forEach(emp => {
    let wCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let earlyCount = 0;
    let absentCount = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = formatDate(date);
      
      const shift = getShiftForTeam(emp.team, date);
      const savedStatus = state.attendance[dateStr]?.[emp.id];
      const isWorkingShift = (shift === 'A' || shift === 'B' || shift === 'C' || shift === 'REG');
      const status = savedStatus || (isWorkingShift ? 'WORK' : 'OFF');
      
      if (status === 'WORK') wCount++;
      else if (status === 'LATE') { lateCount++; wCount++; }
      else if (status === 'EARLY') { earlyCount++; wCount++; }
      else if (status === 'LEAVE') leaveCount++;
      else if (status === 'ABSENT') absentCount++;
    }
    
    csvContent += `"${emp.name}","${emp.team}",${wCount},${lateCount},${leaveCount},${earlyCount},${absentCount},${wCount + leaveCount}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `근태통계_${pickerVal}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// 9. SETTINGS & DATA PORTABILITY (BACKUP/RESTORE)
// -------------------------------------------------------------
function renderSettings() {
  document.getElementById('setting-ref-date').value = state.settings.refDate;
  document.getElementById('setting-ref-team1').value = state.settings.initialShifts['1조'] || 'OFF';
  document.getElementById('setting-ref-team2').value = state.settings.initialShifts['2조'] || 'A';
  document.getElementById('setting-ref-team3').value = state.settings.initialShifts['3조'] || 'B';
  document.getElementById('setting-ref-team4').value = state.settings.initialShifts['4조'] || 'C';
}

function setupSettingsControls() {
  document.getElementById('save-settings-btn').addEventListener('click', () => {
    const refDate = document.getElementById('setting-ref-date').value;
    if (!refDate) {
      alert('기준일을 설정해 주세요.');
      return;
    }
    
    state.settings.refDate = refDate;
    state.settings.initialShifts['1조'] = document.getElementById('setting-ref-team1').value;
    state.settings.initialShifts['2조'] = document.getElementById('setting-ref-team2').value;
    state.settings.initialShifts['3조'] = document.getElementById('setting-ref-team3').value;
    state.settings.initialShifts['4조'] = document.getElementById('setting-ref-team4').value;
    
    saveToLocalStorage();
    alert('기준 설정이 변경되었습니다. 근무조 스케줄을 업데이트합니다.');
    
    // Refresh representations
    if (currentView === 'dashboard') renderDashboard();
    if (currentView === 'calendar') renderCalendar();
  });

  // JSON Export
  document.getElementById('data-export-btn').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `shiftwork_backup_${formatDate(todayDate)}.json`);
    dlAnchorElem.click();
  });

  // JSON Import
  document.getElementById('data-import-input').addEventListener('change', (e) => {
    const fileReader = new FileReader();
    if (!e.target.files || e.target.files.length === 0) return;
    
    fileReader.onload = function (event) {
      try {
        const importedState = JSON.parse(event.target.result);
        
        // Validation of essential keys
        if (importedState.employees && importedState.settings && importedState.attendance) {
          state = importedState;
          saveToLocalStorage();
          alert('데이터 백업이 성공적으로 복원되었습니다.');
          location.reload();
        } else {
          alert('올바르지 않은 백업 파일 형식입니다.');
        }
      } catch (err) {
        alert('파일을 분석하는데 실패했습니다. 올바른 JSON 파일인지 확인해주세요.');
        console.error(err);
      }
    };
    fileReader.readAsText(e.target.files[0]);
  });

  // Reset database
  document.getElementById('data-reset-btn').addEventListener('click', () => {
    if (confirm('주의: 모든 사원 정보, 근태 기록 및 설정이 삭제되고 초기 샘플 데이터로 복원됩니다.\n정말로 초기화하시겠습니까?')) {
      localStorage.removeItem('shiftwork_state');
      loadDummyData();
      alert('전체 데이터가 초기 상태로 재설정되었습니다.');
      location.reload();
    }
  });
}

// -------------------------------------------------------------
// 10. MODAL DIALOGS HELPERS
// -------------------------------------------------------------
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

function setupModalClosers() {
  const closeButtons = document.querySelectorAll('[data-close-modal]');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });

  // Close when clicking outside of modal content
  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('active');
      }
    });
  });
}

// -------------------------------------------------------------
// 11. APPLICATION INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Initialize LocalStorage Data
  initLocalStorage();

  // Setup Nav Bar
  setupNavigation();
  
  // Setup Calendar Controls
  setupCalendarControls();
  
  // Setup Members Controls & Form listeners
  setupMembersControls();
  setupEmployeeSave();
  
  // Setup Daily Modal Controls
  setupDailyModalControls();
  
  // Setup Statistics Tab picker
  setupStatistics();
  
  // Setup Settings Tab actions
  setupSettingsControls();
  
  // Setup general Modals window bindings
  setupModalClosers();
  
  // Trigger first dashboard view render
  switchView('dashboard');
});
