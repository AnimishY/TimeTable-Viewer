// Course Schedule Manager - JavaScript Application

class CourseScheduleManager {
    constructor() {
        this.courses = [];
        this.selectedCourses = new Map();
        this.courseColors = {};
        this.colorIndex = 0;
        this.maxColors = 10;
        this.isDropdownVisible = false;

        // Async initialization
        this.init();
    }

    async init() {
        await this.initializeData();
        this.initializeElements();
        this.bindEvents();
        this.loadFromStorage();
        this.renderSelectedCourses();
        this.renderCalendar();
    }

    async initializeData() {
        // Load course data from merged_timetable.json
        try {
            const response = await fetch('merged_timetable.json');
            if (!response.ok) throw new Error('Failed to load timetable data');
            const timetableData = await response.json();
            this.courses = timetableData.timetable;
        } catch (error) {
            console.error('Error loading timetable data:', error);
            this.courses = [];
        }
    }

    initializeElements() {
        this.elements = {
            searchInput: document.getElementById('courseSearch'),
            dropdown: document.getElementById('courseDropdown'),
            dropdownContent: document.getElementById('dropdownContent'),
            selectedCoursesList: document.getElementById('selectedCoursesList'),
            calendarGrid: document.getElementById('calendarGrid'),
            conflictWarning: document.getElementById('conflictWarning'),
            tooltip: document.getElementById('tooltip'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            exportICS: document.getElementById('exportICS'),
            exportPDF: document.getElementById('exportPDF'),
            exportPNG: document.getElementById('exportPNG')
        };
    }

    bindEvents() {
        // Search input events
        this.elements.searchInput.addEventListener('input', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleSearch(e);
        });
        
        this.elements.searchInput.addEventListener('focus', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleSearch(e);
        });
        
        this.elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideDropdown();
            }
        });

        // Export button events
        this.elements.exportICS.addEventListener('click', () => this.exportICS());
        this.elements.exportPDF.addEventListener('click', () => this.exportPDF());
        this.elements.exportPNG.addEventListener('click', () => this.exportPNG());

        // Global click handler to close dropdown
        document.addEventListener('click', (e) => {
            if (!this.elements.searchInput.contains(e.target) && 
                !this.elements.dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
            this.hideDropdown();
            return;
        }

        const filteredCourses = this.courses.filter(course => {
            const codeMatch = course.courseCode.toLowerCase().includes(query);
            const nameMatch = course.courseName.toLowerCase().includes(query);
            return codeMatch || nameMatch;
        });

        this.renderDropdown(filteredCourses);
        this.showDropdown();
    }

    renderDropdown(courses) {
        this.elements.dropdownContent.innerHTML = '';

        if (courses.length === 0) {
            this.elements.dropdownContent.innerHTML = `
                <div class="dropdown-item" style="cursor: default; opacity: 0.6;">
                    <span>No courses found</span>
                </div>
            `;
            return;
        }

        courses.forEach(course => {
            const isSelected = this.selectedCourses.has(course.courseCode);
            const item = document.createElement('button');
            item.className = `dropdown-item ${isSelected ? 'selected' : ''}`;
            item.type = 'button';
            item.innerHTML = `
                <strong>${course.courseCode}</strong>
                <span>${course.courseName}</span>
            `;
            
            if (!isSelected) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectCourse(course);
                });
            }
            
            this.elements.dropdownContent.appendChild(item);
        });
    }

    showDropdown() {
        this.elements.dropdown.style.display = 'block';
        this.elements.dropdown.classList.remove('hidden');
        this.isDropdownVisible = true;
    }

    hideDropdown() {
        this.elements.dropdown.style.display = 'none';
        this.elements.dropdown.classList.add('hidden');
        this.isDropdownVisible = false;
    }

    selectCourse(course) {
        if (this.selectedCourses.has(course.courseCode)) return;

        // Assign color
        this.assignCourseColor(course.courseCode);
        
        this.selectedCourses.set(course.courseCode, course);
        this.renderSelectedCourses();
        this.renderCalendar();
        this.saveToStorage();
        this.elements.searchInput.value = '';
        this.hideDropdown();
    }

    assignCourseColor(courseCode) {
        if (!this.courseColors[courseCode]) {
            this.courseColors[courseCode] = this.colorIndex % this.maxColors;
            this.colorIndex++;
        }
    }

    removeCourse(courseCode) {
        this.selectedCourses.delete(courseCode);
        delete this.courseColors[courseCode];
        this.renderSelectedCourses();
        this.renderCalendar();
        this.saveToStorage();
    }

    renderSelectedCourses() {
        this.elements.selectedCoursesList.innerHTML = '';

        if (this.selectedCourses.size === 0) {
            this.elements.selectedCoursesList.innerHTML = `
                <div class="empty-state">
                    <p>No courses selected. Use the search box above to add courses.</p>
                </div>
            `;
            return;
        }

        this.selectedCourses.forEach(course => {
            const chip = document.createElement('div');
            const colorClass = `course-color-${this.courseColors[course.courseCode]}`;
            chip.className = `course-chip ${colorClass}`;
            chip.innerHTML = `
                <span>${course.courseCode}</span>
                <button class="course-chip__remove" type="button" data-course="${course.courseCode}">×</button>
            `;
            
            const removeBtn = chip.querySelector('.course-chip__remove');
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeCourse(course.courseCode);
            });
            
            this.elements.selectedCoursesList.appendChild(chip);
        });
    }

    renderCalendar() {
        // Clear existing sessions
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
            const dayElement = document.getElementById(day);
            if (dayElement) {
                dayElement.innerHTML = '';
            }
        });

        if (this.selectedCourses.size === 0) {
            this.hideConflictWarning();
            return;
        }

        const sessions = this.getAllSessions();
        const conflicts = this.detectConflicts(sessions);
        
        sessions.forEach(session => {
            this.renderSession(session, conflicts);
        });

        if (conflicts.length > 0) {
            this.showConflictWarning();
        } else {
            this.hideConflictWarning();
        }
    }

    getAllSessions() {
        const sessions = [];
        this.selectedCourses.forEach(course => {
            course.sessions.forEach(session => {
                sessions.push({
                    ...session,
                    courseCode: course.courseCode,
                    courseName: course.courseName,
                    classroom: course.classroom
                });
            });
        });
        return sessions;
    }

    detectConflicts(sessions) {
        const conflicts = [];
        
        for (let i = 0; i < sessions.length; i++) {
            for (let j = i + 1; j < sessions.length; j++) {
                const session1 = sessions[i];
                const session2 = sessions[j];
                
                if (session1.day === session2.day) {
                    const start1 = this.timeToMinutes(session1.startTime);
                    const end1 = this.timeToMinutes(session1.endTime);
                    const start2 = this.timeToMinutes(session2.startTime);
                    const end2 = this.timeToMinutes(session2.endTime);
                    
                    if ((start1 < end2 && end1 > start2)) {
                        conflicts.push(session1, session2);
                    }
                }
            }
        }
        
        return [...new Set(conflicts)];
    }

    renderSession(session, conflicts) {
        const dayElement = document.getElementById(this.getDayName(session.day));
        if (!dayElement) return;

        const isConflict = conflicts.includes(session);
        const colorClass = `course-color-${this.courseColors[session.courseCode]}`;
        
        const sessionElement = document.createElement('div');
        sessionElement.className = `session-block ${colorClass} ${isConflict ? 'conflict' : ''}`;
        
        const startMinutes = this.timeToMinutes(session.startTime);
        const endMinutes = this.timeToMinutes(session.endTime);
        const duration = endMinutes - startMinutes;
        
        // Calculate position (08:00 is the start time, each 30min slot is 30px)
        const topOffset = ((startMinutes - 480) / 30) * 30; // 480 minutes = 08:00
        const height = (duration / 30) * 30;
        
        sessionElement.style.top = `${topOffset}px`;
        sessionElement.style.height = `${height}px`;
        
        sessionElement.innerHTML = `
            <div class="session-block__code">${session.courseCode}</div>
            <div class="session-block__room">${session.classroom}</div>
            <div class="session-block__type">${session.label}</div>
        `;
        
        // Add tooltip events
        sessionElement.addEventListener('mouseenter', (e) => this.showTooltip(e, session));
        sessionElement.addEventListener('mouseleave', () => this.hideTooltip());
        sessionElement.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));
        
        dayElement.appendChild(sessionElement);
    }

    getDayName(shortDay) {
        const dayMap = {
            'Mon': 'Monday',
            'Tue': 'Tuesday',
            'Wed': 'Wednesday',
            'Thu': 'Thursday',
            'Fri': 'Friday'
        };
        return dayMap[shortDay];
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    showTooltip(e, session) {
        const tooltipContent = `
            <h4>${session.courseCode}</h4>
            <p><strong>Course:</strong> ${session.courseName}</p>
            <p><strong>Time:</strong> ${session.startTime} - ${session.endTime}</p>
            <p><strong>Room:</strong> ${session.classroom}</p>
            <p><strong>Type:</strong> ${session.label}</p>
            ${session.slotCode ? `<p><strong>Slot:</strong> ${session.slotCode}</p>` : ''}
        `;
        
        this.elements.tooltip.querySelector('.tooltip__content').innerHTML = tooltipContent;
        this.elements.tooltip.classList.remove('hidden');
        this.updateTooltipPosition(e);
    }

    updateTooltipPosition(e) {
        const tooltip = this.elements.tooltip;
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = e.clientX + 10;
        let top = e.clientY + 10;
        
        // Adjust if tooltip goes off screen
        if (left + tooltipRect.width > window.innerWidth) {
            left = e.clientX - tooltipRect.width - 10;
        }
        if (top + tooltipRect.height > window.innerHeight) {
            top = e.clientY - tooltipRect.height - 10;
        }
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    hideTooltip() {
        this.elements.tooltip.classList.add('hidden');
    }

    showConflictWarning() {
        this.elements.conflictWarning.classList.remove('hidden');
    }

    hideConflictWarning() {
        this.elements.conflictWarning.classList.add('hidden');
    }

    showLoading() {
        this.elements.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }

    // Export Functions
    async exportICS() {
        if (this.selectedCourses.size === 0) {
            alert('Please select courses first');
            return;
        }

        this.showLoading();

        try {
            // Generate ICS content manually
            let icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Course Schedule Manager//Course Schedule//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH'
            ];

            this.selectedCourses.forEach(course => {
                course.sessions.forEach(session => {
                    const startDate = this.getICSDateTime(session.day, session.startTime);
                    const endDate = this.getICSDateTime(session.day, session.endTime);
                    const uid = `${course.courseCode}-${session.day}-${session.startTime}@coursescheduler.com`;
                    
                    icsContent.push(
                        'BEGIN:VEVENT',
                        `UID:${uid}`,
                        `DTSTART:${startDate}`,
                        `DTEND:${endDate}`,
                        `SUMMARY:${course.courseCode} - ${session.label}`,
                        `DESCRIPTION:${course.courseName}\\nRoom: ${course.classroom}`,
                        `LOCATION:${course.classroom}`,
                        'RRULE:FREQ=WEEKLY;COUNT=16',
                        'STATUS:CONFIRMED',
                        'SEQUENCE:0',
                        'END:VEVENT'
                    );
                });
            });

            icsContent.push('END:VCALENDAR');
            
            const icsString = icsContent.join('\r\n');
            const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
            this.downloadFile(blob, 'course-schedule.ics');
        } catch (error) {
            console.error('Error generating ICS:', error);
            alert('Error generating calendar file: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async exportPDF() {
        if (this.selectedCourses.size === 0) {
            alert('Please select courses first');
            return;
        }

        this.showLoading();
        
        try {
            const { jsPDF } = window.jspdf;
            const calendar = document.querySelector('.calendar-container');
            
            const canvas = await html2canvas(calendar, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('landscape');
            
            const imgWidth = 280;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            pdf.save('course-schedule.pdf');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF');
        } finally {
            this.hideLoading();
        }
    }

    async exportPNG() {
        if (this.selectedCourses.size === 0) {
            alert('Please select courses first');
            return;
        }

        this.showLoading();
        
        try {
            const calendar = document.querySelector('.calendar-container');
            const canvas = await html2canvas(calendar, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            canvas.toBlob((blob) => {
                this.downloadFile(blob, 'course-schedule.png');
            });
        } catch (error) {
            console.error('Error generating PNG:', error);
            alert('Error generating image');
        } finally {
            this.hideLoading();
        }
    }

    getICSDateTime(day, time) {
        const dayMap = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5 };
        const [hours, minutes] = time.split(':').map(Number);
        
        // Get next occurrence of the day
        const today = new Date();
        const dayOfWeek = dayMap[day];
        const daysUntilTarget = (dayOfWeek - today.getDay() + 7) % 7 || 7;
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntilTarget);
        targetDate.setHours(hours, minutes, 0, 0);
        
        // Format as YYYYMMDDTHHMMSS
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const date = String(targetDate.getDate()).padStart(2, '0');
        const hour = String(targetDate.getHours()).padStart(2, '0');
        const minute = String(targetDate.getMinutes()).padStart(2, '0');
        
        return `${year}${month}${date}T${hour}${minute}00`;
    }

    getEventDateTime(day, time) {
        const dayMap = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5 };
        const [hours, minutes] = time.split(':').map(Number);
        
        // Get next occurrence of the day
        const today = new Date();
        const dayOfWeek = dayMap[day];
        const daysUntilTarget = (dayOfWeek - today.getDay() + 7) % 7 || 7;
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntilTarget);
        targetDate.setHours(hours, minutes, 0, 0);
        
        return [
            targetDate.getFullYear(),
            targetDate.getMonth() + 1,
            targetDate.getDate(),
            hours,
            minutes
        ];
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Storage Functions
    saveToStorage() {
        const selectedCodes = Array.from(this.selectedCourses.keys());
        const colorsData = this.courseColors;
        
        try {
            localStorage.setItem('selectedCourses', JSON.stringify(selectedCodes));
            localStorage.setItem('courseColors', JSON.stringify(colorsData));
        } catch (error) {
            console.warn('Could not save to localStorage:', error);
        }
    }

    loadFromStorage() {
        try {
            const savedCourses = localStorage.getItem('selectedCourses');
            const savedColors = localStorage.getItem('courseColors');
            
            if (savedCourses) {
                const coursesCodes = JSON.parse(savedCourses);
                coursesCodes.forEach(code => {
                    const course = this.courses.find(c => c.courseCode === code);
                    if (course) {
                        this.selectedCourses.set(code, course);
                    }
                });
            }
            
            if (savedColors) {
                this.courseColors = JSON.parse(savedColors);
                this.colorIndex = Math.max(...Object.values(this.courseColors), -1) + 1;
            }
        } catch (error) {
            console.warn('Could not load from localStorage:', error);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CourseScheduleManager();
});