/**
 * Activity Log Module
 * Manages activity log display and filtering
 */

const ActivityLog = {
    logs: [],
    currentFilter: '',

    /**
     * Initialize Activity Log
     */
    async init() {
        await this.loadStats();
        await this.loadLogs();
    },

    /**
     * Load activity log statistics
     */
    async loadStats() {
        try {
            const stats = await API.getActivityLogStats();
            document.getElementById('stat-total').textContent = stats.total || 0;
            document.getElementById('stat-today').textContent = stats.today || 0;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },

    /**
     * Load activity logs
     */
    async loadLogs() {
        try {
            this.logs = await API.getActivityLogs(500, this.currentFilter || null);
            this.renderLogs();
        } catch (error) {
            console.error('Error loading logs:', error);
            this.showError('Gagal memuat log aktivitas');
        }
    },

    /**
     * Filter logs by type
     */
    filterByType(type) {
        this.currentFilter = type;
        
        // Update active chip
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
            if (chip.dataset.type === type) {
                chip.classList.add('active');
            }
        });
        
        this.loadLogs();
    },

    /**
     * Render activity logs grouped by date
     */
    renderLogs() {
        const logList = document.getElementById('log-list');
        
        if (this.logs.length === 0) {
            logList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>Belum ada log aktivitas</p>
                </div>
            `;
            return;
        }

        // Group logs by date
        const groupedLogs = this.groupLogsByDate(this.logs);
        
        let html = '';
        for (const [date, logs] of Object.entries(groupedLogs)) {
            html += `
                <div class="log-date-group">
                    <div class="log-date-header">${date}</div>
                    <div class="log-items">
            `;
            
            for (const log of logs) {
                const icon = this.getActivityIcon(log.type, log.action);
                const time = this.formatTime(log.created_at);
                const typeClass = log.type.toLowerCase();
                
                html += `
                    <div class="log-item ${typeClass}">
                        <div class="log-icon">${icon}</div>
                        <div class="log-content">
                            <div class="log-description">${log.description}</div>
                            <div class="log-meta">
                                <span class="log-time">${time}</span>
                                <span class="log-type-badge ${typeClass}">${log.type}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += '</div></div>';
        }
        
        logList.innerHTML = html;
    },

    /**
     * Group logs by date
     */
    groupLogsByDate(logs) {
        const groups = {};
        
        for (const log of logs) {
            const date = this.formatDate(log.created_at);
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(log);
        }
        
        return groups;
    },

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Hari Ini';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Kemarin';
        } else {
            return date.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    },

    /**
     * Format time for display
     */
    formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Get activity icon based on type and action
     */
    getActivityIcon(type, action) {
        const icons = {
            TRANSAKSI: {
                CREATE: '🧾',
                UPDATE: '✏️',
                DELETE: '🗑️',
                PRINT: '🖨️'
            },
            BARANG: {
                CREATE: '📦',
                UPDATE: '✏️',
                DELETE: '🗑️'
            },
            VARIAN: {
                CREATE: '🏷️',
                UPDATE: '✏️',
                DELETE: '🗑️'
            },
            KATEGORI: {
                CREATE: '📁',
                UPDATE: '✏️',
                DELETE: '🗑️'
            },
            ORDER: {
                HOLD: '⏸️',
                RESUME: '▶️'
            },
            PENGATURAN: {
                UPDATE: '⚙️',
                RESET: '🔄'
            },
            BACKUP: {
                BACKUP: '💾',
                RESTORE: '📥'
            }
        };
        
        return icons[type]?.[action] || '📝';
    },

    /**
     * Show confirm modal for clearing all logs
     */
    confirmClearAll() {
        document.getElementById('modal-confirm-clear').style.display = 'flex';
    },

    /**
     * Hide confirm modal
     */
    hideConfirmModal() {
        document.getElementById('modal-confirm-clear').style.display = 'none';
    },

    /**
     * Clear all activity logs
     */
    async clearAllLogs() {
        try {
            await API.clearActivityLogs();
            this.hideConfirmModal();
            this.showSuccess('Semua log aktivitas berhasil dihapus');
            await this.loadStats();
            await this.loadLogs();
        } catch (error) {
            console.error('Error clearing logs:', error);
            this.showError('Gagal menghapus log: ' + error.message);
        }
    },

    /**
     * Show success message
     */
    showSuccess(message) {
        const container = document.getElementById('alert-container');
        if (container) {
            container.innerHTML = `<div class="alert alert-success">${message}</div>`;
            setTimeout(() => { container.innerHTML = ''; }, 3000);
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('alert-container');
        if (container) {
            container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
            setTimeout(() => { container.innerHTML = ''; }, 5000);
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    ActivityLog.init();
});
